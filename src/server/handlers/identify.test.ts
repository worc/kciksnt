import { describe, it, expect, spyOn } from 'bun:test'
import { EventEmitter } from 'node:events'
import type { LifxSocket } from '../../udp/udpSocket'
import type { ServerMessage } from '../../types/ws'
import { DeviceRegistry } from '../DeviceRegistry'
import { buildMessage } from '../../messages/buildMessage'
import { encodeLifxString } from '../../protocol/strings'
import { identifyDevice } from './identify'

spyOn(Bun, 'write').mockResolvedValue(0 as never)

describe('identifyDevice', () => {
  it('queries label/group/location and dispatches each field plus inspect_complete', async () => {
    const mac = 'd073d5000030'
    const ip = '192.168.1.70'
    const port = 56700

    const registry = new DeviceRegistry()
    registry.setDevice(mac, { mac, ip, port })

    const dispatched: ServerMessage[] = []
    registry.on('dispatch', m => dispatched.push(m))

    // StateLabel (25): 32-byte null-terminated label.
    const stateLabel = buildMessage(25, mac, encodeLifxString('Den'))

    // StateGroup (53) and StateLocation (50): uuid(16) + label(32) + updated_at(8) = 56 bytes.
    // parseMessage only reads the label for our purposes; uuid/updated_at can be zeros.
    const groupPayload = new Uint8Array(56)
    groupPayload.set(encodeLifxString('Upstairs'), 16)
    const stateGroup = buildMessage(53, mac, groupPayload)

    const locationPayload = new Uint8Array(56)
    locationPayload.set(encodeLifxString('Home'), 16)
    const stateLocation = buildMessage(50, mac, locationPayload)

    const emitter = new EventEmitter()
    const udp: LifxSocket = {
      on:  (e, l) => { emitter.on(e, l) },
      off: (e, l) => { emitter.off(e, l) },
      broadcast: () => {},
      send: payload => {
        // Outgoing protocol type lives at bytes 32-33 (LE) of the header.
        const reqType = new DataView(
          (payload as Uint8Array).buffer,
          (payload as Uint8Array).byteOffset,
        ).getUint16(32, true)
        const reply =
          reqType === 23 ? stateLabel    : // GetLabel    → StateLabel (25)
          reqType === 51 ? stateGroup    : // GetGroup    → StateGroup (53)
          reqType === 48 ? stateLocation : // GetLocation → StateLocation (50)
          null
        if (reply) queueMicrotask(() => emitter.emit('message', Buffer.from(reply), port, ip))
      },
      close: () => {},
    }

    await identifyDevice(mac, 100, 110, registry, udp)

    // 3 device_field dispatches (label, group, location) + 1 inspect_complete.
    expect(dispatched).toHaveLength(4)

    const fields = dispatched.filter(m => m.type === 'device_field')
    expect(fields.map(m => m.type === 'device_field' && m.update)).toEqual([
      { field: 'label',    value: 'Den' },
      { field: 'group',    value: 'Upstairs' },
      { field: 'location', value: 'Home' },
    ])

    expect(dispatched[3].type).toBe('device_inspect_complete')
  })
})
