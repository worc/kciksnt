import type { ClientMessage, ServerMessage } from '../types/ws'

// ---------------------------------------------------------------------------
// Module-level singleton — one WebSocket shared across the entire app.
// Stores and DeviceStore components subscribe here; they never manage their
// own connections.
// ---------------------------------------------------------------------------

let ws: WebSocket | null = null
let connected = false
const handlers = new Set<(msg: ServerMessage) => void>()
const sendQueue: string[] = []

function connect () {
  ws = new WebSocket(`ws://${window.location.host}/ws`)

  ws.onopen = () => {
    connected = true
    while (sendQueue.length) ws!.send(sendQueue.shift()!)
  }

  ws.onmessage = (event: MessageEvent) => {
    const clientReceivedAt = Date.now()
    let msg: ServerMessage
    try {
      msg = JSON.parse(event.data as string) as ServerMessage
    } catch {
      return
    }

    // dev_reload has no timestamps — handle it first and bail
    if (msg.type === 'dev_reload') {
      window.location.reload()
      return
    }

    // Stamp the client-side receive time on messages that carry timestamps
    if (msg.timestamps) {
      msg.timestamps.clientReceivedAt = clientReceivedAt
    }

    for (const handler of handlers) handler(msg)
  }

  ws.onclose = () => {
    connected = false
    ws = null
    setTimeout(connect, 1500)
  }
}

export function send (message: ClientMessage): void {
  if (!ws) connect()
  const raw = JSON.stringify(message)
  if (ws?.readyState === WebSocket.OPEN) {
    ws.send(raw)
  } else {
    sendQueue.push(raw)
  }
}

// Returns an unsubscribe function.
export function subscribe (handler: (msg: ServerMessage) => void): () => void {
  handlers.add(handler)
  if (!ws) connect()
  return () => handlers.delete(handler)
}

export function isConnected (): boolean {
  return connected
}
