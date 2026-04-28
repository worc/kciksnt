import { describe, it, expect, spyOn } from 'bun:test'
import { EventEmitter } from 'node:events'
import type { LifxSocket } from '../../udp/udpSocket'
import type { ServerMessage } from '../../types/ws'
import { DeviceRegistry } from '../DeviceRegistry'
import { buildMessage } from '../../messages/buildMessage'
import { handleSetLabel } from './setLabel'

spyOn(Bun, 'write').mockResolvedValue(0 as never)

describe('handleSetLabel', () => {
  it('sends SetLabel and dispatches label on ack', async () => {
    const mac = 'd073d5000004'
    const ip = '192.168.1.45'
    const port = 56700

    const registry = new DeviceRegistry()
    registry.setDevice(mac, { mac, ip, port })
    const dispatched: ServerMessage[] = []
    registry.on('dispatch', m => dispatched.push(m))

    const emitter = new EventEmitter()
    const sends: Uint8Array[] = []
    const udp: LifxSocket = {
      on:  (e, l) => { emitter.on(e, l) },
      off: (e, l) => { emitter.off(e, l) },
      broadcast: () => {},
      send: payload => {
        sends.push(payload as Uint8Array)
        queueMicrotask(() => emitter.emit('message', Buffer.from(buildMessage(45, mac)), port, ip))
      },
      close: () => {},
    }

    await handleSetLabel(mac, 'Kitchen', 100, 110, registry, udp)

    expect(sends).toHaveLength(1)
    const msg = dispatched[0]
    if (msg?.type !== 'device_field') throw new Error(`expected device_field, got ${msg?.type}`)
    expect(msg.update).toEqual({ field: 'label', value: 'Kitchen' })
  })
})
