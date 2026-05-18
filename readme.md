# kciksnt

*Turn on the lamp.*

A local controller for LIFX bulbs. Speaks the LIFX LAN protocol over UDP, exposes an SSE stream and a small HTTP command surface to the browser, and stays entirely on the LAN—no cloud, no LIFX account, no app store.

## What's running

```
                ┌──────────────────────────┐
   bulbs (UDP)  │  Bun server              │   browser
   ◀──────────▶ │  ┌──────┐  ┌──────────┐  │  ◀───────▶
                │  │ UDP  │  │ HTTP+SSE │  │
                │  └──────┘  └──────────┘  │
                │       ↑    ↑             │
                │     DeviceRegistry       │
                │     (cache + bus)        │
                └──────────────────────────┘
```

- A Bun process holds the UDP socket and a `DeviceRegistry` that caches device state.
- Handlers translate browser intents into LIFX wire messages, await acks, and `dispatch()` updates back through the registry's event bus.
- An `SseHub` subscribes to the registry, debounces, ring-buffers, and fans events out to every connected tab as `text/event-stream`.
- The browser uses `EventSource('/events')` to receive state and plain `POST` requests to issue commands. No WebSocket anywhere.

## Why SSE + POST, not WebSockets

I started with a CLI prototype (it's down in `git stash` now) to prove out dealing with the LIFX LAN protocol. It also proved how much better a UDP broadcast on the LAN is. Responses are *absurdly* fast. Round-trips that would be hundreds of milliseconds out to a cloud API are single-digit milliseconds here. It also simplified troubleshooting. A dropped UDP packet is obvious and easy to retry when everything is local, while a full round-trip through the HTTP/TCP cloud protocol introduces the uncertainty of the wider internet.

The webapp took what I learned from the CLI and started with WebSockets. The WebSockets suggestion came from a Claude Code agent during the early design pass, and seemed mostly appropriate for the task. You get an open data channel for both live updates from the server and commands back *to* server.

But WebSockets can also be pretty brittle. I had desynchronization between browers, tabs, and devices. And a lot of dropped connections and stale data. I was halfway through writing a whole set of retry, resume, and cache (and cache-busting) code when I sort of randomly came across [a youtube video on Server Side Events](https://www.youtube.com/watch?v=hd_d-K-jDFM). SSE comes with the tools for retry and resume for a push-system built in. And the general shape of SSE better fit the use-case here. The server needed a long-lived open channel. While the client only needs to send occasional updates:

- **Client → server:** rare, discrete commands. Must round-trip, and must be acknowledged.
- **Server → client:** continuous state updates from the UDP listener. Frequent, broadcast, fan-out to N tabs.

The concrete wins, in the order they showed up:

1. **`Last-Event-ID` resume is built into the browser.** The "navigate home" stale-data workaround was essentially a manual version of what `EventSource` does on every reconnect. Server keeps a 5-minute / 1000-event ring buffer; on reconnect, the browser sends `Last-Event-ID` automatically and the server replays the gap (or sends a fresh snapshot if the gap is too wide).
2. **Auto-reconnect with backoff is already in `EventSource`.** SSE only sends one HTTP promise that's held open, so the browser's normal retry behavior still applies. While WebSockets breaks typical HTTP response behaviors and the browser can't recover state automatically.
3. **Heartbeats degrade into "did the stream go quiet."** WebSockets requires pinging the client to hold open the connection through network hardware and to prevent the client from sleeping on the connection, while SSE is an open HTTP connection that's mostly respected by the network and client
4. **`curl -N localhost:7410/events` tails the firehose.** Logging, debugging, and "what is the server actually sending right now" becomes trivial when you can tap directly into that long-lived response channel. Huge for a homelab where the ops team is one person.

The concurrency-cost argument that comes up in WS-vs-SSE debates doesn't really apply at this scale (a couple of users, a dozen open tabs across devices).

The migration ran in three sessions, each self-contained and reversible:

1. Add SSE alongside WS—same `dispatch` bus, two subscribers.
2. Swap the client to `EventSource` + `POST`, leave WS in place.
3. Tear out WebSockets entirely.

## Command shape

Commands are `POST` requests with a discriminated body:

```http
POST /devices/:mac/state
{ "commandId": "...", "field": "color", "value": { "h": 180, "s": 1, "b": 1, "k": 3500 }, "duration": 500 }
```

The route surface stays small (`/devices/:mac/state`, plus `/identify` and `/inspect` for non-state actions) and the discriminator lives in the body. This pays off when LIFX adds a new field—or when "scenes" and "schedules" land later as their own broad categories—without churning the URL space.

The `commandId` is generated by the client. The server echoes it back through the SSE stream as `origin` on the resulting `device_field` event. That's how a tab tells "this update was triggered by *my* command" from "someone else changed this"—another tab, device, or maybe a future scheduler.

The naming choice underneath is deliberate: this project is the source of truth on what a "device," a "field," a "command" means. LIFX's LAN protocol and (eventually) Matter are *subsets* it consumes, not standards it inherits naming from. It's a small instance of [xkcd 927](https://xkcd.com/927/)—but in a homelab controller for one user, that's a defensible call. The cost of keeping internal names neutral is a thin translation layer; the benefit is that tomorrow's bridge to a different protocol fits without renaming today's surface.

## Front end: the engine telegraph

Sliders that snap back on failure are lying to the user during the optimistic window. For a system where "I told the bulb to turn on and it didn't" is a real failure mode (exterior lights, network hiccups), that lie is actively harmful.

The UI design—still in flight at the time of writing—uses two tracks:

- **Commanded:** what the user just set. Stays where they put it. Doesn't move on its own.
- **Reported:** authoritative state from the SSE stream. Updates only when the device confirms.

Like the engine telegraph on a ship's bridge: the captain sets the order, the engine room reports back the actual state, and the gap between them is legible.

The hue control takes this further. The commanded marker sits *outside* the color band, framing it; the reported marker slides *within* the band as the device drifts toward (or away from) the commanded value. The asymmetric placement is the notation: outside-the-band reads as "the order I'm sending," inside-the-band reads as "the world reporting back." A slider that puts both thumbs in the same channel can't make that distinction visible.

When the two diverge — another tab changed it, a wall switch flipped it, the bulb hasn't caught up — three buttons let the user pick what to do:

- **Reconcile.** Pull reported into commanded. "Yes, what's running is what I want."
- **Override.** Re-send commanded. "No, do what I said."
- **Blend.** Midpoint. (Circular for hue, since 350° and 10° should average to 0°, not 180°.) Slightly silly, but it's a prototype, and it surfaces the question of what "halfway between two states" even means.

When SSE is reconnecting, the reported track's trustworthiness is in question — dim it, mark it stale. Honest UI; the user can see when the displayed reality might not match.

## Process notes

This project is one of the first I've written more by orchestration than by implementation. The work I did directly was small interface stubs as style-guides, planning docs that doubled as design specs, and review—file-by-file, sometimes line-by-line—of code an LLM agent produced from those specs.

Reviewing the code an LLM generates is super important, not just for local correctness, but also for the wider design intent.

For example, I caught the LLM starting to leak abstractions during the WS-to-SSE refactor. I intended for all network calls to go into the Zustand store, but it started adding them to the React components directly. This was techincally correct work, but I was foreseeing a lot of clunkiness and clean-up work in the future if all our network calls were scattered around the app instead of gathered into a single module.

I made the correction, politely, and it backtracked to clear up all the network calls, then move them to the Zustand store.

And, it's worth noting that when you make a correction like this, Anthropic's harness will direct the LLM to record a memory detailing that request. Those memories are stored in the .claude hidden directory in your home directory, and they're stored per-project.

Claude's take: "Agents don't remove the need to understand the system — they raise the cost of *not* understanding it, because review is now the primary lever."

The WS-to-SSE arc is a decent example the strengths and weakness of LLM collaboration. An agent suggested WebSockets early on: it was a reasonable solution to bidirectional data flow between a client and server. Agents will give you a plausible architecture quickly, but you still have to be diligent in testing the system and making a change if it's picked something that really doesn't fit the situation.

Claude's take on sharing a branch with a human user: "The state-management pass that landed alongside the engine telegraph is another shape worth naming: working in parallel on the same branch, in the same physical files. The user was sketching `ColorTelegraph.tsx` and tweaking debounce constants while I was rewriting the discovery merge logic and threading capability data through `Hsbk`. We trampled each other's work occasionally — I re-read files mid-edit and was uncertain what had happened — but the conflicts stayed shallow because we'd aligned on what we were each doing before splitting up. There's probably a more sophisticated approach with shared collab branches and per-actor side branches, but git's mental model isn't quite ready for "two collaborators editing the same working tree simultaneously." When the working memory between human and agent is well-aligned, you can mostly get away with a single branch and no formal handoff. When it isn't, you'd want isolation. Read your own context before spending the cost."

## Develop

```bash
bun run dev      # esbuild watch + dev reload
bun run serve    # the Bun server on :7410
bun run build    # production bundle to dist/
bun test         # 46 tests, ~500ms
```

Tail the event stream live:

```bash
curl -N localhost:7410/events
```
