import type { ServerMessage } from '../types/events'

// ---------------------------------------------------------------------------
// SSE + POST transport. One EventSource shared across the app — the store
// and any components that care about connection state subscribe here; they
// never open their own connections.
//
// EventSource handles auto-reconnect with backoff and `Last-Event-ID` resume
// on every reconnect. We translate `event:`-typed frames into ServerMessages
// and fan them out to handlers.
// ---------------------------------------------------------------------------

type ConnectionState = 'idle' | 'connecting' | 'open' | 'reconnecting'

// Every event type the SSE hub emits frames for. EventSource has no wildcard
// listener, so we register one addEventListener per known type. Heartbeats
// arrive as SSE comments (`:hb`) and are silently dropped by EventSource.
const SSE_EVENT_TYPES: ReadonlyArray<ServerMessage['type']> = [
  'discovery_result',
  'device_field',
  'device_inspect_complete',
  'device_inspect_error',
  'dev_reload',
  'error',
  'snapshot',
]

let es: EventSource | null = null
const handlers       = new Set<(msg: ServerMessage) => void>()
const stateListeners = new Set<(s: ConnectionState) => void>()
let connectionState: ConnectionState = 'idle'

function setState (next: ConnectionState): void {
  if (connectionState === next) return
  connectionState = next
  for (const l of stateListeners) l(next)
}

function onEvent (event: MessageEvent): void {
  const clientReceivedAt = Date.now()
  let msg: ServerMessage
  try {
    msg = JSON.parse(event.data as string) as ServerMessage
  } catch {
    return
  }

  // dev_reload is a transport-level signal — never propagate it to handlers
  if (msg.type === 'dev_reload') {
    window.location.reload()
    return
  }

  if (msg.timestamps) msg.timestamps.clientReceivedAt = clientReceivedAt
  for (const handler of handlers) handler(msg)
}

function connect (): void {
  if (es) return
  setState('connecting')
  es = new EventSource('/events')

  es.onopen  = () => setState('open')
  es.onerror = () => {
    // EventSource will auto-reconnect unless readyState === CLOSED. We surface
    // 'reconnecting' uniformly so the UI can dim the echo state until 'open'
    // ticks back through.
    setState('reconnecting')
  }

  for (const type of SSE_EVENT_TYPES) es.addEventListener(type, onEvent)
}

export function subscribe (handler: (msg: ServerMessage) => void): () => void {
  handlers.add(handler)
  if (!es) connect()
  return () => handlers.delete(handler)
}

export function subscribeConnectionState (
  listener: (state: ConnectionState) => void,
): () => void {
  stateListeners.add(listener)
  listener(connectionState)
  return () => stateListeners.delete(listener)
}

// ---------------------------------------------------------------------------
// Command POSTs. The body must include a client-generated `commandId` so the
// resulting device_field event echoes back through SSE with `origin` set,
// letting a tab tell its own change apart from a foreign one.
// ---------------------------------------------------------------------------

export function newCommandId (): string {
  return crypto.randomUUID()
}

export async function command (path: string, body: unknown): Promise<Response> {
  return fetch(path, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })
}
