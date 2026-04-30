import { describe, it, expect, spyOn } from 'bun:test'
import { DeviceRegistry } from '../DeviceRegistry'
import { SseHub } from './SseHub'

spyOn(Bun, 'write').mockResolvedValue(0 as never)

// ---------------------------------------------------------------------------
// Frame parsing helper used inline by some tests for clarity. The hub emits
// raw SSE wire bytes; pulling the JSON payload out of `data:` keeps the
// assertions readable without leaving the test file's view.
//
// (Per the unrolled-tests convention this lives in the file but is invoked
// explicitly per test — no shared setup.)
// ---------------------------------------------------------------------------
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function parseFrame (frame: string): { event: string; id: number; data: any } {
  const lines = frame.split('\n')
  const event = lines.find(l => l.startsWith('event: '))!.slice(7)
  const id    = Number(lines.find(l => l.startsWith('id: '))!.slice(4))
  const data  = JSON.parse(lines.filter(l => l.startsWith('data: ')).map(l => l.slice(6)).join('\n'))
  return { event, id, data }
}

describe('SseHub — pass-through emission', () => {
  it('forwards non-device_field dispatches immediately to attached connections', () => {
    const registry = new DeviceRegistry()
    const hub = new SseHub(registry, { debounceMs: 50, heartbeatMs: 60_000 })

    const sent: string[] = []
    const { detach } = hub.attach({ send: f => sent.push(f) })
    sent.length = 0  // discard the initial snapshot

    registry.dispatch({
      type:       'discovery_result',
      devices:    [{ mac: 'd073d5000001', ip: '192.168.1.1', port: 56700 }],
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })

    expect(sent).toHaveLength(1)
    const parsed = parseFrame(sent[0])
    expect(parsed.event).toBe('discovery_result')
    expect(parsed.id).toBe(1)
    expect(parsed.data.devices).toHaveLength(1)

    detach()
  })

  it('does not echo a snapshot dispatched through the registry (defensive guard)', () => {
    const registry = new DeviceRegistry()
    const hub = new SseHub(registry, { debounceMs: 50, heartbeatMs: 60_000 })

    const sent: string[] = []
    const { detach } = hub.attach({ send: f => sent.push(f) })
    sent.length = 0

    registry.dispatch({
      type:       'snapshot',
      devices:    [],
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })

    expect(sent).toEqual([])
    detach()
  })
})

describe('SseHub — device_field debouncing', () => {
  it('coalesces rapid same-(mac,field) dispatches into one emission with the latest value', async () => {
    const registry = new DeviceRegistry()
    const hub = new SseHub(registry, { debounceMs: 10, heartbeatMs: 60_000 })

    const sent: string[] = []
    const { detach } = hub.attach({ send: f => sent.push(f) })
    sent.length = 0

    const mac = 'd073d5000010'
    for (const value of [{ level: 100, on: true }, { level: 200, on: true }, { level: 300, on: true }]) {
      registry.dispatch({
        type:       'device_field',
        mac,
        update:     { field: 'power', value },
        timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
      })
    }

    expect(sent).toEqual([])  // nothing emitted yet — still debouncing

    await Bun.sleep(30)

    expect(sent).toHaveLength(1)
    const parsed = parseFrame(sent[0])
    expect(parsed.event).toBe('device_field')
    expect(parsed.data.update).toEqual({ field: 'power', value: { level: 300, on: true } })

    detach()
  })

  it('does NOT coalesce dispatches across different MACs', async () => {
    const registry = new DeviceRegistry()
    const hub = new SseHub(registry, { debounceMs: 10, heartbeatMs: 60_000 })

    const sent: string[] = []
    const { detach } = hub.attach({ send: f => sent.push(f) })
    sent.length = 0

    registry.dispatch({
      type:       'device_field',
      mac:        'd073d5000020',
      update:     { field: 'label', value: 'A' },
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })
    registry.dispatch({
      type:       'device_field',
      mac:        'd073d5000021',
      update:     { field: 'label', value: 'B' },
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })

    await Bun.sleep(30)

    expect(sent).toHaveLength(2)
    detach()
  })

  it('does NOT coalesce dispatches across different fields on the same MAC', async () => {
    const registry = new DeviceRegistry()
    const hub = new SseHub(registry, { debounceMs: 10, heartbeatMs: 60_000 })

    const sent: string[] = []
    const { detach } = hub.attach({ send: f => sent.push(f) })
    sent.length = 0

    const mac = 'd073d5000030'
    registry.dispatch({
      type:       'device_field',
      mac,
      update:     { field: 'label', value: 'Den' },
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })
    registry.dispatch({
      type:       'device_field',
      mac,
      update:     { field: 'group', value: 'Upstairs' },
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })

    await Bun.sleep(30)

    expect(sent).toHaveLength(2)
    detach()
  })
})

describe('SseHub — ring buffer eviction', () => {
  it('drops oldest entries when buffer length exceeds bufferMaxEntries', () => {
    const registry = new DeviceRegistry()
    const hub = new SseHub(registry, { bufferMaxEntries: 3, debounceMs: 50, heartbeatMs: 60_000 })

    // discovery_result is pass-through (no debounce wait), and the buffer
    // grows by one per emit regardless of message type.
    for (let i = 0; i < 5; i++) {
      registry.dispatch({
        type:       'discovery_result',
        devices:    [{ mac: `d073d50000${i.toString().padStart(2, '0')}`, ip: '0.0.0.0', port: 0 }],
        timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
      })
    }

    // After 5 emits with cap 3, ids 1–2 should be evicted; 3, 4, 5 remain.
    // Reach in via a fresh attach with lastEventId=2 to confirm only 3..5 replay.
    const sent: string[] = []
    const { detach } = hub.attach({ send: f => sent.push(f), lastEventId: 2 })
    expect(sent).toHaveLength(3)
    expect(sent.map(f => parseFrame(f).id)).toEqual([3, 4, 5])

    detach()
  })

  it('drops entries older than bufferMaxAgeMs using injected clock', () => {
    let nowValue = 1_000_000
    const registry = new DeviceRegistry()
    const hub = new SseHub(registry, {
      bufferMaxAgeMs:   100,
      bufferMaxEntries: 1000,
      debounceMs:       50,
      heartbeatMs:      60_000,
      now:              () => nowValue,
    })

    registry.dispatch({
      type:       'discovery_result',
      devices:    [],
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })  // id=1, ts=1_000_000

    nowValue += 50
    registry.dispatch({
      type:       'discovery_result',
      devices:    [],
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })  // id=2, ts=1_000_050

    nowValue += 200  // jump well past the 100ms age cap from id=1
    registry.dispatch({
      type:       'discovery_result',
      devices:    [],
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })  // id=3, ts=1_000_250 — at trim time, id=1 (age 250) and id=2 (age 200) both evicted

    // Only id=3 remains in the buffer.
    const sent: string[] = []
    const { detach } = hub.attach({ send: f => sent.push(f), lastEventId: 0 })
    // lastEventId=0 with oldestId=3 → gap → snapshot, not replay.
    expect(parseFrame(sent[0]).event).toBe('snapshot')

    detach()
  })
})

describe('SseHub — attach / resume semantics', () => {
  it('sends a snapshot on first attach when the ring buffer has no events', () => {
    const registry = new DeviceRegistry()
    registry.setDevice('d073d5000040', { mac: 'd073d5000040', ip: '192.168.1.40', port: 56700 })
    const hub = new SseHub(registry, { debounceMs: 50, heartbeatMs: 60_000 })

    const sent: string[] = []
    const { detach } = hub.attach({ send: f => sent.push(f) })

    expect(sent).toHaveLength(1)
    const parsed = parseFrame(sent[0])
    expect(parsed.event).toBe('snapshot')
    expect(parsed.id).toBe(0)
    expect(parsed.data.devices).toHaveLength(1)
    expect(parsed.data.devices[0].mac).toBe('d073d5000040')

    detach()
  })

  it('replays only events newer than lastEventId when it is inside the ring', () => {
    const registry = new DeviceRegistry()
    const hub = new SseHub(registry, { debounceMs: 50, heartbeatMs: 60_000 })

    for (let i = 0; i < 5; i++) {
      registry.dispatch({
        type:       'discovery_result',
        devices:    [],
        timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
      })
    }
    // Buffer now holds ids 1..5.

    const sent: string[] = []
    const { detach } = hub.attach({ send: f => sent.push(f), lastEventId: 2 })

    expect(sent).toHaveLength(3)
    expect(sent.map(f => parseFrame(f).id)).toEqual([3, 4, 5])
    expect(sent.every(f => parseFrame(f).event !== 'snapshot')).toBe(true)

    detach()
  })

  it('falls back to snapshot when lastEventId is older than the oldest buffered id', () => {
    const registry = new DeviceRegistry()
    const hub = new SseHub(registry, { bufferMaxEntries: 2, debounceMs: 50, heartbeatMs: 60_000 })

    for (let i = 0; i < 5; i++) {
      registry.dispatch({
        type:       'discovery_result',
        devices:    [],
        timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
      })
    }
    // Buffer now holds ids 4..5; client thinks it's at id=1 — gap.

    const sent: string[] = []
    const { detach } = hub.attach({ send: f => sent.push(f), lastEventId: 1 })

    expect(sent).toHaveLength(1)
    expect(parseFrame(sent[0]).event).toBe('snapshot')

    detach()
  })

  it('sends nothing when lastEventId equals the current high-water mark', () => {
    const registry = new DeviceRegistry()
    const hub = new SseHub(registry, { debounceMs: 50, heartbeatMs: 60_000 })

    registry.dispatch({
      type:       'discovery_result',
      devices:    [],
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })  // id=1 emitted; counter now 1

    const sent: string[] = []
    const { detach } = hub.attach({ send: f => sent.push(f), lastEventId: 1 })

    expect(sent).toEqual([])
    detach()
  })
})

describe('SseHub — connection lifecycle', () => {
  it('stops broadcasting to a connection after detach', () => {
    const registry = new DeviceRegistry()
    const hub = new SseHub(registry, { debounceMs: 50, heartbeatMs: 60_000 })

    const sent: string[] = []
    const { detach } = hub.attach({ send: f => sent.push(f) })
    sent.length = 0

    detach()

    registry.dispatch({
      type:       'discovery_result',
      devices:    [],
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })

    expect(sent).toEqual([])
  })

  it('drops a connection whose send throws during emit (defensive)', () => {
    const registry = new DeviceRegistry()
    const hub = new SseHub(registry, { debounceMs: 50, heartbeatMs: 60_000 })

    // First connection is healthy; second throws on every send. After the
    // first emit, the throwing connection should be dropped — proven by the
    // fact that a second emit still reaches the healthy one without error.
    const goodSent: string[] = []
    const goodHandle = hub.attach({ send: f => goodSent.push(f) })
    goodSent.length = 0

    let badCallCount = 0
    hub.attach({
      send: () => {
        badCallCount++
        throw new Error('connection closed')
      },
    })
    badCallCount = 0  // discard the initial snapshot attempt count

    registry.dispatch({
      type:       'discovery_result',
      devices:    [],
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })

    expect(goodSent).toHaveLength(1)
    expect(badCallCount).toBe(1)  // tried once, threw, was detached

    registry.dispatch({
      type:       'discovery_result',
      devices:    [],
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })

    expect(goodSent).toHaveLength(2)
    expect(badCallCount).toBe(1)  // not called again — confirmed detached

    goodHandle.detach()
  })
})
