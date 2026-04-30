import { describe, it, expect, spyOn } from 'bun:test'
import { EventEmitter } from 'node:events'
import type { LifxSocket } from '../../udp/udpSocket'
import type { ServerMessage } from '../../types/events'
import { DeviceRegistry } from '../DeviceRegistry'
import { buildMessage } from '../../messages/buildMessage'
import { discover } from './discover'

spyOn(Bun, 'write').mockResolvedValue(0 as never)

describe('discover', () => {
  it('collects StateService responses, registers them, and dispatches discovery_result', async () => {
    const mac = 'd073d5000010'
    const ip = '192.168.1.50'
    const port = 56700

    const registry = new DeviceRegistry()
    const dispatched: ServerMessage[] = []
    registry.on('dispatch', m => dispatched.push(m))

    // Build a StateService (type 3) frame: service(1) + port(uint32 LE).
    const payload = new Uint8Array(5)
    const view = new DataView(payload.buffer)
    view.setUint8(0, 1)
    view.setUint32(1, port, true)
    const stateService = buildMessage(3, mac, payload)

    const emitter = new EventEmitter()
    const broadcasts: Uint8Array[] = []
    const udp: LifxSocket = {
      on:        (e, l) => { emitter.on(e, l) },
      off:       (e, l) => { emitter.off(e, l) },
      broadcast: payload => {
        broadcasts.push(payload as Uint8Array)
        // Simulate one device replying mid-window.
        queueMicrotask(() => emitter.emit('message', Buffer.from(stateService), port, ip))
      },
      send:  () => { /* no-op */ },
      close: () => { /* no-op */ },
    }

    const found = await discover(registry, udp, 100, 110, 50)

    expect(broadcasts).toHaveLength(1)
    expect(found).toEqual([{ mac, ip, port }])

    expect(registry.getDevice(mac)).toEqual({ mac, ip, port })

    expect(dispatched).toHaveLength(1)
    const msg = dispatched[0]
    if (msg.type !== 'discovery_result') throw new Error(`expected discovery_result, got ${msg.type}`)
    expect(msg.devices).toEqual([{ mac, ip, port }])
    expect(msg.timestamps.clientSentAt).toBe(100)
    expect(msg.timestamps.serverReceivedAt).toBe(110)
  })

  it('folds in known-but-undetected devices and re-dispatches their cached snapshot fields', async () => {
    const presentMac = 'd073d5000020'
    const presentIp  = '192.168.1.60'
    const offlineMac = 'd073d5000021'
    const offlineIp  = '192.168.1.61'
    const port = 56700

    const registry = new DeviceRegistry()

    // Pre-seed offline device into the persistent snapshot store. Going through
    // setDevice + dispatch is the only public path; that's also how the system
    // builds these entries during a normal session.
    registry.setDevice(offlineMac, { mac: offlineMac, ip: offlineIp, port })
    registry.dispatch({
      type:       'device_field',
      mac:        offlineMac,
      update:     { field: 'label', value: 'Bedroom' },
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })

    const dispatched: ServerMessage[] = []
    registry.on('dispatch', m => dispatched.push(m))

    // StateService for the present device only — offline one stays silent.
    const payload = new Uint8Array(5)
    const view = new DataView(payload.buffer)
    view.setUint8(0, 1)
    view.setUint32(1, port, true)
    const stateService = buildMessage(3, presentMac, payload)

    const emitter = new EventEmitter()
    const udp: LifxSocket = {
      on:        (e, l) => { emitter.on(e, l) },
      off:       (e, l) => { emitter.off(e, l) },
      broadcast: () => {
        queueMicrotask(() => emitter.emit('message', Buffer.from(stateService), port, presentIp))
      },
      send:  () => { /* no-op */ },
      close: () => { /* no-op */ },
    }

    await discover(registry, udp, 100, 110, 50)

    const result = dispatched.find(m => m.type === 'discovery_result')
    if (!result || result.type !== 'discovery_result') throw new Error('no discovery_result')
    expect(result.devices).toEqual([
      { mac: presentMac,  ip: presentIp,  port },
      { mac: offlineMac, ip: offlineIp, port, detected: false },
    ])

    // Re-hydrated label for the offline device should appear after the discovery_result.
    const labelDispatch = dispatched.find(
      m => m.type === 'device_field' && m.mac === offlineMac,
    )
    if (!labelDispatch || labelDispatch.type !== 'device_field') throw new Error('no re-hydrate dispatch')
    expect(labelDispatch.update).toEqual({ field: 'label', value: 'Bedroom' })
  })
})
