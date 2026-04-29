import type { SseHub } from './SseHub'

// ---------------------------------------------------------------------------
// /events fetch handler. Wraps an SseHub.attach() in a ReadableStream and
// returns a long-lived text/event-stream Response.
//
// Disconnect paths:
//   - ReadableStream.cancel() fires when the consumer closes the stream
//     normally (browser nav away, EventSource.close()).
//   - req.signal 'abort' fires when the underlying request is torn down
//     for other reasons (process shutdown, fetch abort upstream).
//   - controller.enqueue() throws if the stream has already been closed
//     by the runtime; the hub's safeSend treats that as a detach signal.
// All three paths converge on detach() — guarded by `detached` so it only
// runs once.
// ---------------------------------------------------------------------------

const encoder = new TextEncoder()

export function handleEventStream (req: Request, hub: SseHub): Response {
  // Per the SSE spec the browser sends Last-Event-ID as a header on
  // reconnect. Allow a ?lastEventId= query fallback for curl-driven
  // testing where setting headers is awkward.
  const headerValue = req.headers.get('Last-Event-ID')
  const queryValue  = new URL(req.url).searchParams.get('lastEventId')
  const raw         = headerValue ?? queryValue
  const parsed      = raw === null ? undefined : Number(raw)
  const lastEventId = parsed !== undefined && Number.isFinite(parsed) ? parsed : undefined

  let detach: (() => void) | null = null
  let detached = false
  function teardown () {
    if (detached) return
    detached = true
    detach?.()
  }

  const stream = new ReadableStream<Uint8Array>({
    start (controller) {
      const handle = hub.attach({
        send: frame => controller.enqueue(encoder.encode(frame)),
        lastEventId,
      })
      detach = handle.detach

      // Backup disconnect signal — fires when the request is aborted by
      // something other than the consumer canceling the stream.
      req.signal.addEventListener('abort', teardown, { once: true })
    },
    cancel () {
      teardown()
    },
  })

  return new Response(stream, {
    headers: {
      'Content-Type':       'text/event-stream',
      'Cache-Control':      'no-cache, no-transform',
      'Connection':         'keep-alive',
      // nginx defaults to buffering proxied responses; this header tells it
      // to flush each chunk immediately. Critical or the entire SSE design
      // collapses behind the reverse proxy.
      'X-Accel-Buffering':  'no',
    },
  })
}
