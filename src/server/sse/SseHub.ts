import type { DeviceRegistry } from '../DeviceRegistry'
import type { ServerMessage } from '../../types/events'
import { formatEvent, formatComment } from './frame'

// ---------------------------------------------------------------------------
// SseHub — owns broadcast state for the SSE transport.
//
// One hub per process. It subscribes once to `registry.on('dispatch', ...)`,
// debounces high-frequency `device_field` events per (mac, field), maintains
// a ring buffer for `Last-Event-ID` resume, and fans formatted SSE frames
// out to every attached connection.
// ---------------------------------------------------------------------------

type SendFn = (frame: string) => void

interface Connection {
  send:      SendFn
  heartbeat: ReturnType<typeof setInterval>
}

interface BufferedEvent {
  id:    number

  // pre-formatted SSE wire bytes
  frame: string

  // timestamp
  ts:    number
}

interface PendingDebounce {
  msg:   ServerMessage  // latest msg for this (mac, field) key
  timer: ReturnType<typeof setTimeout>
}

export interface SseHubOptions {
  now?:              () => number
  debounceMs?:       number  // device_field coalesce window
  heartbeatMs?:      number  // SSE comment ":" emitted per connection
  bufferMaxEntries?: number  // hard cap on ring buffer length
  bufferMaxAgeMs?:   number  // hard cap on ring buffer age
}

export class SseHub {
  private readonly registry:         DeviceRegistry
  private readonly now:              () => number
  private readonly debounceMs:       number
  private readonly heartbeatMs:      number
  private readonly bufferMaxEntries: number
  private readonly bufferMaxAgeMs:   number

  private readonly connections      = new Set<Connection>()
  private readonly ringBuffer: BufferedEvent[] = []
  private readonly pendingDebounces = new Map<string, PendingDebounce>()
  private eventIdCounter            = 0

  constructor (registry: DeviceRegistry, opts: SseHubOptions = {}) {
    this.registry         = registry
    this.now              = opts.now              ?? Date.now
    this.debounceMs       = opts.debounceMs       ?? 75
    this.heartbeatMs      = opts.heartbeatMs      ?? 15_000
    this.bufferMaxEntries = opts.bufferMaxEntries ?? 1000
    this.bufferMaxAgeMs   = opts.bufferMaxAgeMs   ?? 5 * 60 * 1000

    registry.on('dispatch', this.onDispatch)
  }

  // ---------------------------------------------------------------------------
  // Connection lifecycle
  // ---------------------------------------------------------------------------

  attach (params: { send: SendFn; lastEventId?: number }): { detach: () => void } {
    const { send, lastEventId } = params

    // Resume logic: if the client's last-known id is still inside the ring,
    // replay everything newer. Otherwise (no id, gap, or future id) send a
    // fresh snapshot — the doc's "fresh snapshot is a full reset" rule.
    const oldestId = this.ringBuffer[0]?.id ?? Infinity
    const upToDate = lastEventId !== undefined && lastEventId >= this.eventIdCounter
    const inRange  = lastEventId !== undefined && oldestId <= lastEventId + 1

    if (upToDate) {
      // No catch-up needed
    } else if (inRange) {
      for (const entry of this.ringBuffer) {
        if (entry.id > lastEventId) this.safeSend(send, entry.frame)
      }
    } else {
      this.safeSend(send, this.buildSnapshotFrame())
    }

    const conn: Connection = {
      send,
      heartbeat: setInterval(() => {
        try { send(formatComment('hb')) } catch { this.detach(conn) }
      }, this.heartbeatMs),
    }
    this.connections.add(conn)

    return { detach: () => this.detach(conn) }
  }

  private detach (conn: Connection): void {
    clearInterval(conn.heartbeat)
    this.connections.delete(conn)
  }

  // ---------------------------------------------------------------------------
  // Dispatch routing
  // ---------------------------------------------------------------------------

  private onDispatch = (msg: ServerMessage): void => {
    if (msg.type === 'device_field') {
      const key = `${msg.mac}:${msg.update.field}`
      const existing = this.pendingDebounces.get(key)
      if (existing) clearTimeout(existing.timer)

      const timer = setTimeout(() => {
        const latest = this.pendingDebounces.get(key)
        this.pendingDebounces.delete(key)
        if (latest) this.emit(latest.msg)
      }, this.debounceMs)

      this.pendingDebounces.set(key, { msg, timer })
      return
    }

    // snapshot is never registry-dispatched (it's per-attach only); the
    // explicit guard documents that and prevents accidental amplification
    // if some future caller did dispatch one.
    if (msg.type === 'snapshot') return

    this.emit(msg)
  }

  // ---------------------------------------------------------------------------
  // Emit + buffer + fan-out
  // ---------------------------------------------------------------------------

  private emit (msg: ServerMessage): void {
    const id = ++this.eventIdCounter
    const frame = formatEvent({ id, event: msg.type, data: JSON.stringify(msg) })

    this.ringBuffer.push({ id, frame, ts: this.now() })
    this.trimBuffer()

    for (const conn of this.connections) this.safeSend(conn.send, frame, conn)
  }

  private trimBuffer (): void {
    while (this.ringBuffer.length > this.bufferMaxEntries) this.ringBuffer.shift()
    const cutoff = this.now() - this.bufferMaxAgeMs
    while (this.ringBuffer.length > 0 && this.ringBuffer[0].ts < cutoff) {
      this.ringBuffer.shift()
    }
  }

  private buildSnapshotFrame (): string {
    const snapshot: ServerMessage = {
      type:       'snapshot',
      devices:    this.registry.getAllSnapshots(),
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: this.now() },
    }
    return formatEvent({
      id:    this.eventIdCounter,  // current high-water mark; next live event is +1
      event: 'snapshot',
      data:  JSON.stringify(snapshot),
    })
  }

  private safeSend (send: SendFn, frame: string, conn?: Connection): void {
    try {
      send(frame)
    } catch {
      // Connection died mid-broadcast — drop it so it doesn't burn future
      // emit cycles. If we don't have a Connection record yet (snapshot/
      // replay during attach), there's nothing to detach; the caller will
      // see the stream close and clean up.
      if (conn) this.detach(conn)
    }
  }
}
