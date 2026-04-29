import { describe, it, expect, spyOn } from 'bun:test'
import { EventEmitter } from 'node:events'
import type { LifxSocket } from '../../udp/udpSocket'
import type { ServerMessage } from '../../types/ws'
import { DeviceRegistry } from '../DeviceRegistry'
import { buildMessage } from '../../messages/buildMessage'
import { decodeHeader } from '../../messages/header'
import { handleSetPower } from './setPower'

spyOn(Bun, 'write').mockResolvedValue(0 as never)

describe('handleSetPower', () => {
  it('uses SetPower (21) when duration is 0 and dispatches power on ack', async () => {
    const mac = 'd073d5000002'
    const ip = '192.168.1.43'
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
      broadcast: () => {},
      send:      payload => {
        sends.push(payload as Uint8Array)
        queueMicrotask(() => emitter.emit('message', Buffer.from(buildMessage(45, mac)), port, ip))
      },
      close: () => {},
    }

    await handleSetPower(mac, true, 0, 100, 110, registry, udp)

    expect(sends).toHaveLength(1)
    expect(decodeHeader(sends[0].slice(0, 36)).protocolHeader.type).toBe(21)

    expect(dispatched).toHaveLength(1)
    const msg = dispatched[0]
    if (msg.type !== 'device_field') throw new Error(`expected device_field, got ${msg.type}`)
    expect(msg.update).toEqual({ field: 'power', value: { level: 65535, on: true } })
  })

  it('uses SetLightPower (117) when duration > 0', async () => {
    const mac = 'd073d5000003'
    const ip = '192.168.1.44'
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
      broadcast: () => {},
      send:      payload => {
        sends.push(payload as Uint8Array)
        queueMicrotask(() => emitter.emit('message', Buffer.from(buildMessage(45, mac)), port, ip))
      },
      close: () => {},
    }

    await handleSetPower(mac, false, 1500, 100, 110, registry, udp)

    expect(decodeHeader(sends[0].slice(0, 36)).protocolHeader.type).toBe(117)
    const msg = dispatched[0]
    if (msg.type !== 'device_field') throw new Error(`expected device_field, got ${msg.type}`)
    expect(msg.update).toEqual({ field: 'power', value: { level: 0, on: false } })
  })

  it('logs and returns without sending when device is not in cache', async () => {
    spyOn(process.stderr, 'write').mockImplementation(() => true as never)

    const mac = 'd073d50000a1'

    const registry = new DeviceRegistry()
    const dispatched: ServerMessage[] = []
    registry.on('dispatch', m => dispatched.push(m))

    const sends: Uint8Array[] = []
    const udp: LifxSocket = {
      on:        () => {}, off:       () => {}, broadcast: () => {},
      send:      payload => { sends.push(payload as Uint8Array) },
      close:     () => {},
    }

    await handleSetPower(mac, true, 0, 100, 110, registry, udp)

    expect(sends).toEqual([])
    expect(dispatched).toEqual([])
  })

  it('does not dispatch when no ack arrives within timeoutMs', async () => {
    spyOn(process.stderr, 'write').mockImplementation(() => true as never)

    const mac = 'd073d50000a2'
    const ip = '192.168.1.111'
    const port = 56700

    const registry = new DeviceRegistry()
    registry.setDevice(mac, { mac, ip, port })
    const dispatched: ServerMessage[] = []
    registry.on('dispatch', m => dispatched.push(m))

    const sends: Uint8Array[] = []
    const udp: LifxSocket = {
      on:        () => {}, off:       () => {}, broadcast: () => {},
      send:      payload => { sends.push(payload as Uint8Array) },
      close:     () => {},
    }

    await handleSetPower(mac, true, 0, 100, 110, registry, udp, 5)

    expect(sends).toHaveLength(1)
    expect(dispatched).toEqual([])
  })
})
