import { describe, it, expect, spyOn } from 'bun:test'
import { EventEmitter } from 'node:events'
import type { LifxSocket } from '../../udp/udpSocket'
import type { ServerMessage } from '../../types/ws'
import { DeviceRegistry } from '../DeviceRegistry'
import { buildMessage } from '../../messages/buildMessage'
import { handleSetLocation } from './setLocation'

spyOn(Bun, 'write').mockResolvedValue(0 as never)

describe('handleSetLocation', () => {
  it('sends SetLocation and dispatches location label on ack', async () => {
    const mac = 'd073d5000006'
    const ip = '192.168.1.47'
    const port = 56700

    const registry = new DeviceRegistry()
    registry.setDevice(mac, { mac, ip, port })
    const dispatched: ServerMessage[] = []
    registry.on('dispatch', m => dispatched.push(m))

    const emitter = new EventEmitter()
    const sends: Uint8Array[] = []
    const udp: LifxSocket = {
      on:        (e, l) => { emitter.on(e, l) },
      off:       (e, l) => { emitter.off(e, l) },
      broadcast: () => { /* no-op */ },
      send:      payload => {
        sends.push(payload as Uint8Array)
        queueMicrotask(() => emitter.emit('message', Buffer.from(buildMessage(45, mac)), port, ip))
      },
      close: () => { /* no-op */ },
    }

    await handleSetLocation(mac, 'Home', 100, 110, registry, udp)

    expect(sends).toHaveLength(1)
    const msg = dispatched[0]
    if (msg?.type !== 'device_field') throw new Error(`expected device_field, got ${msg?.type}`)
    expect(msg.update).toEqual({ field: 'location', value: 'Home' })
  })

  it('logs and returns without sending when device is not in cache', async () => {
    spyOn(process.stderr, 'write').mockImplementation(() => true as never)

    const mac = 'd073d50000d1'

    const registry = new DeviceRegistry()
    const dispatched: ServerMessage[] = []
    registry.on('dispatch', m => dispatched.push(m))

    const sends: Uint8Array[] = []
    const udp: LifxSocket = {
      on:        () => { /* no-op */ },
      off:       () => { /* no-op */ },
      broadcast: () => { /* no-op */ },
      send:      payload => { sends.push(payload as Uint8Array) },
      close:     () => { /* no-op */ },
    }

    await handleSetLocation(mac, 'Home', 100, 110, registry, udp)

    expect(sends).toEqual([])
    expect(dispatched).toEqual([])
  })

  it('does not dispatch when no ack arrives within timeoutMs', async () => {
    spyOn(process.stderr, 'write').mockImplementation(() => true as never)

    const mac = 'd073d50000d2'
    const ip = '192.168.1.141'
    const port = 56700

    const registry = new DeviceRegistry()
    registry.setDevice(mac, { mac, ip, port })
    const dispatched: ServerMessage[] = []
    registry.on('dispatch', m => dispatched.push(m))

    const sends: Uint8Array[] = []
    const udp: LifxSocket = {
      on:        () => { /* no-op */ },
      off:       () => { /* no-op */ },
      broadcast: () => { /* no-op */ },
      send:      payload => { sends.push(payload as Uint8Array) },
      close:     () => { /* no-op */ },
    }

    await handleSetLocation(mac, 'Home', 100, 110, registry, udp, 5)

    expect(sends).toHaveLength(1)
    expect(dispatched).toEqual([])
  })
})
