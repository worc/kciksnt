import { describe, it, expect, spyOn } from 'bun:test'
import { EventEmitter } from 'node:events'
import type { LifxSocket } from '../../udp/udpSocket'
import type { ServerMessage } from '../../types/ws'
import { DeviceRegistry } from '../DeviceRegistry'
import { buildMessage } from '../../messages/buildMessage'
import { handleSetColor } from './setColor'

// Registry's debounced disk save would fire 500ms after each setDevice/dispatch
// and try to overwrite data/devices.json. Stub once for the file's lifetime —
// not restored, since the timer may fire after the test body returns.
spyOn(Bun, 'write').mockResolvedValue(0 as never)

describe('handleSetColor', () => {
  it('sends SetColor over UDP and dispatches device_field on ack', async () => {
    const mac = 'd073d5000001'
    const ip = '192.168.1.42'
    const port = 56700
    const hsbk = { hue: 200, saturation: 1, brightness: 0.5, kelvin: 3500 }

    const registry = new DeviceRegistry()
    registry.setDevice(mac, { mac, ip, port })

    const dispatched: ServerMessage[] = []
    registry.on('dispatch', m => dispatched.push(m))

    // Inline socket fake: replays an ack (type 45) the moment send() is called.
    const emitter = new EventEmitter()
    const sends: { payload: Uint8Array; ip: string; port?: number }[] = []
    const udp: LifxSocket = {
      on:  (e, l) => { emitter.on(e, l) },
      off: (e, l) => { emitter.off(e, l) },
      broadcast: () => {},
      send: (payload, sendIp, sendPort) => {
        sends.push({ payload: payload as Uint8Array, ip: sendIp, port: sendPort })
        const ack = buildMessage(45, mac)
        queueMicrotask(() => emitter.emit('message', Buffer.from(ack), port, ip))
      },
      close: () => {},
    }

    await handleSetColor(mac, hsbk, 0, 100, 110, registry, udp)

    expect(sends).toHaveLength(1)
    expect(sends[0].ip).toBe(ip)
    expect(sends[0].port).toBe(port)

    expect(dispatched).toHaveLength(1)
    const msg = dispatched[0]
    if (msg.type !== 'device_field') throw new Error(`expected device_field, got ${msg.type}`)
    expect(msg.mac).toBe(mac)
    expect(msg.update).toEqual({ field: 'color', value: hsbk })
    expect(msg.timestamps.clientSentAt).toBe(100)
    expect(msg.timestamps.serverReceivedAt).toBe(110)
    expect(typeof msg.timestamps.serverRespondedAt).toBe('number')
  })
})
