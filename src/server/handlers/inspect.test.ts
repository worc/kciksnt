import { describe, it, expect, spyOn } from 'bun:test'
import { EventEmitter } from 'node:events'
import type { LifxSocket } from '../../udp/udpSocket'
import type { ServerMessage } from '../../types/ws'
import { DeviceRegistry } from '../DeviceRegistry'
import { buildMessage } from '../../messages/buildMessage'
import { encodeHsbk } from '../../messages/hsbk'
import { encodeLifxString } from '../../protocol/strings'
import { inspectDevice } from './inspect'

spyOn(Bun, 'write').mockResolvedValue(0 as never)

describe('inspectDevice', () => {
  it('walks the 7-query inspection cycle and dispatches one field per response plus inspect_complete', async () => {
    const mac = 'd073d5000040'
    const ip = '192.168.1.80'
    const port = 56700

    const registry = new DeviceRegistry()
    registry.setDevice(mac, { mac, ip, port })

    const dispatched: ServerMessage[] = []
    registry.on('dispatch', m => dispatched.push(m))

    // ---- LightState (107): hsbk(8) + reserved(2) + power(2) + label(32) + reserved(8) ----
    const lightPayload = new Uint8Array(52)
    lightPayload.set(encodeHsbk({ hue: 120, saturation: 1, brightness: 1, kelvin: 5000 }), 0)
    new DataView(lightPayload.buffer).setUint16(10, 65535, true)
    lightPayload.set(encodeLifxString('Desk'), 12)
    const lightState = buildMessage(107, mac, lightPayload)

    // ---- StateHostFirmware (15): build(u64) + reserved(8) + minor(u16) + major(u16) ----
    const fwPayload = new Uint8Array(20)
    const fwView = new DataView(fwPayload.buffer)
    fwView.setBigUint64(0, 1700000000000000000n, true)
    fwView.setUint16(16, 70, true)
    fwView.setUint16(18, 3,  true)
    const stateHostFirmware = buildMessage(15, mac, fwPayload)

    // ---- StateWifiInfo (17): signal(float32) + padding ----
    const wifiPayload = new Uint8Array(12)
    new DataView(wifiPayload.buffer).setFloat32(0, 30, true)
    const stateWifiInfo = buildMessage(17, mac, wifiPayload)

    // ---- StateVersion (33): vendor(u32) + product(u32) ----
    const versionPayload = new Uint8Array(8)
    const versionView = new DataView(versionPayload.buffer)
    versionView.setUint32(0, 1, true)
    versionView.setUint32(4, 22, true)
    const stateVersion = buildMessage(33, mac, versionPayload)

    // ---- StateGroup (53) / StateLocation (50): uuid(16) + label(32) + updated_at(8) ----
    const groupPayload = new Uint8Array(56)
    groupPayload.set(encodeLifxString('Studio'), 16)
    const stateGroup = buildMessage(53, mac, groupPayload)

    const locationPayload = new Uint8Array(56)
    locationPayload.set(encodeLifxString('Home'), 16)
    const stateLocation = buildMessage(50, mac, locationPayload)

    // ---- StateInfo (35): time(u64) + uptime(u64) + downtime(u64) ----
    const infoPayload = new Uint8Array(24)
    const infoView = new DataView(infoPayload.buffer)
    infoView.setBigUint64(0,  1700000000000000000n, true)
    infoView.setBigUint64(8,  3600000000000n,        true)
    infoView.setBigUint64(16, 0n,                     true)
    const stateInfo = buildMessage(35, mac, infoPayload)

    const emitter = new EventEmitter()
    const udp: LifxSocket = {
      on:  (e, l) => { emitter.on(e, l) },
      off: (e, l) => { emitter.off(e, l) },
      broadcast: () => {},
      send: payload => {
        const reqType = new DataView(
          (payload as Uint8Array).buffer,
          (payload as Uint8Array).byteOffset,
        ).getUint16(32, true)
        const reply =
          reqType === 101 ? lightState         : // GetColor        → LightState (107)
          reqType === 14  ? stateHostFirmware  : // GetHostFirmware → StateHostFirmware (15)
          reqType === 16  ? stateWifiInfo      : // GetWifiInfo     → StateWifiInfo (17)
          reqType === 32  ? stateVersion       : // GetVersion      → StateVersion (33)
          reqType === 51  ? stateGroup         : // GetGroup        → StateGroup (53)
          reqType === 48  ? stateLocation      : // GetLocation     → StateLocation (50)
          reqType === 34  ? stateInfo          : // GetInfo         → StateInfo (35)
          null
        if (reply) queueMicrotask(() => emitter.emit('message', Buffer.from(reply), port, ip))
      },
      close: () => {},
    }

    await inspectDevice(mac, 100, 110, registry, udp)

    // LightState fans out into 3 fields (label/color/power); the other 6 queries
    // each contribute 1 field; closing inspect_complete brings the total to 10.
    expect(dispatched).toHaveLength(10)

    const fields = dispatched
      .filter(m => m.type === 'device_field')
      .map(m => m.type === 'device_field' ? m.update.field : null)
    expect(fields).toEqual([
      'label', 'color', 'power',  // from LightState
      'firmware',
      'wifi',
      'version',
      'group',
      'location',
      'info',
    ])

    expect(dispatched[9].type).toBe('device_inspect_complete')
  })
})
