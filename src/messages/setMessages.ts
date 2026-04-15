import { Lifx } from '../types/lifx'
import { buildMessage } from './buildMessage'
import { encodeHsbk } from './hsbk'
import { encodeLifxString } from '../protocol/strings'

interface Opts {
  res_required?: boolean
  ack_required?: boolean
  sequence?: number
}

export function setPower (target: string, on: boolean, opts: Opts = {}): Uint8Array {
  const payload = new Uint8Array(2)
  new DataView(payload.buffer).setUint16(0, on ? 65535 : 0, true)

  return buildMessage(21, target, payload, opts)
}

export function setLabel (target: string, label: string, opts: Opts = {}): Uint8Array {
  return buildMessage(24, target, encodeLifxString(label), opts)
}

export function setReboot (target: string): Uint8Array {
  return buildMessage(38, target)
}

export function setLocation (target: string, label: string, locationId?: Uint8Array): Uint8Array {
  const payload = new Uint8Array(56)
  const uuid = locationId ?? labelToUuid(label)
  payload.set(uuid, 0)
  payload.set(encodeLifxString(label), 16)
  new DataView(payload.buffer).setBigUint64(48, msToNs(Date.now()), true)

  return buildMessage(49, target, payload, { ack_required: true })
}

export function setGroup (target: string, label: string, groupId?: Uint8Array): Uint8Array {
  const payload = new Uint8Array(56) // uuid(16) + label(32) + updated_at(8)
  const uuid = groupId ?? labelToUuid(label)
  payload.set(uuid, 0)
  payload.set(encodeLifxString(label), 16)
  new DataView(payload.buffer).setBigUint64(48, msToNs(Date.now()), true)

  return buildMessage(52, target, payload, { ack_required: true })
}

export function setColor (target: string, hsbk: Lifx.Application.Hsbk, duration = 0, opts: Opts = {}): Uint8Array {
  const payload = new Uint8Array(13) // reserved(1) + hsbk(8) + duration(4)
  payload.set(encodeHsbk(hsbk), 1)
  new DataView(payload.buffer).setUint32(9, duration, true)

  return buildMessage(102, target, payload, opts)
}

export function setWaveform (
  target: string,
  transient: boolean,
  hsbk: Lifx.Application.Hsbk,
  period: number,
  cycles: number,
  skew_ratio: number,
  waveform: number
): Uint8Array {
  const payload = new Uint8Array(21)
  const view = new DataView(payload.buffer)
  // view.set(0, null) reserved byte
  view.setInt8(1, transient ? 1 : 0)
  payload.set(encodeHsbk(hsbk), 2)
  view.setUint16(10, period, true)
  view.setFloat32(14, cycles, true)
  view.setInt16(18, skew_ratio, true)
  view.setUint8(20, waveform)

  return buildMessage(103, target, payload)
}

/**
 *
 * Extension of SetPower(21) that allows you to define a transition *duration*
 *
 * @param target
 * @param on
 * @param duration
 * @param opts
 */
export function setLightPower (target: string, on: boolean, duration = 0, opts: Opts = {}): Uint8Array {
  const payload = new Uint8Array(6)
  const view = new DataView(payload.buffer)
  view.setUint16(0, on ? 65535 : 0, true)
  view.setUint32(2, duration, true)

  return buildMessage(117, target, payload, opts)
}

export function setWaveformOptional (
  target: string,
  transient: boolean,
  hsbk: Lifx.Application.Hsbk,
  period: number,
  cycles: number,
  skew_ratio: number,
  waveform: number,
  set_hue: boolean,
  set_saturation: boolean,
  set_brightness: boolean,
  set_kelvin: boolean,
  opts: Opts = {}
): Uint8Array {
  const payload = new Uint8Array(25)
  const view = new DataView(payload.buffer)
  // view.set(0, null) reserved byte
  view.setInt8(1, transient ? 1 : 0)
  payload.set(encodeHsbk(hsbk), 2)
  view.setUint32(10, period, true)
  view.setFloat32(14, cycles, true)
  view.setInt16(18, skew_ratio, true)
  view.setUint8(20, waveform)
  view.setUint8(21, set_hue ? 1 : 0)
  view.setUint8(22, set_saturation ? 1 : 0)
  view.setUint8(23, set_brightness ? 1 : 0)
  view.setUint8(24, set_kelvin ? 1 : 0)

  return buildMessage(119, target, payload, opts)
}

export function setInfrared (target: string, brightness: number, opts: Opts = {}): Uint8Array {
  const payload = new Uint8Array(2)
  new DataView(payload.buffer).setUint16(0, brightness, true)

  return buildMessage(122, target, payload, opts)
}

export function setHevCycle (target: string, enable: boolean, duration_s: number, opts: Opts = {}): Uint8Array {
  const payload = new Uint8Array(5)
  const view = new DataView(payload.buffer)
  view.setUint8(0, enable ? 1 : 0)
  view.setUint32(1, duration_s, true)

  return buildMessage(143, target, payload, opts)
}

export function setColorZones (
  target: string,
  start_index: number,
  end_index: number,
  hsbk: Lifx.Application.Hsbk,
  duration: number,
  apply: number,
  opts: Opts = {}
): Uint8Array {
  const payload = new Uint8Array(15)
  const view = new DataView(payload.buffer)
  view.setUint8(0, start_index)
  view.setUint8(1, end_index)
  payload.set(encodeHsbk(hsbk), 2)
  view.setUint32(10, duration, true)
  view.setUint8(14, apply)

  return buildMessage(501, target, payload, opts)
}

export function setMultiZoneEffect (
  target: string,
  instanceid: number,
  type: number,
  speed: number,
  duration: bigint,
  parameters: Uint8Array,
  opts: Opts = {}
): Uint8Array {
  const payload = new Uint8Array(59)
  const view = new DataView(payload.buffer)
  view.setUint32(0, instanceid, true)
  view.setUint8(4, type)
  // offset 5-6: reserved6
  view.setUint32(7, speed, true)
  view.setBigUint64(11, duration, true)
  // offset 19-22: reserved7
  // offset 23-26: reserved8
  payload.set(parameters.slice(0, 32), 27)

  return buildMessage(508, target, payload, opts)
}

export function setExtendedColorZones (
  target: string,
  duration: number,
  apply: number,
  zone_index: number,
  colors: Lifx.Application.Hsbk[],
  opts: Opts = {}
): Uint8Array {
  const payload = new Uint8Array(664) // duration(4) + apply(1) + zone_index(2) + colors_count(1) + colors(82*8)
  const view = new DataView(payload.buffer)
  view.setUint32(0, duration, true)
  view.setUint8(4, apply)
  view.setUint16(5, zone_index, true)
  const count = Math.min(colors.length, 82)
  view.setUint8(7, count)
  for (let i = 0; i < count; i++) {
    payload.set(encodeHsbk(colors[i]), 8 + i * 8)
  }

  return buildMessage(510, target, payload, opts)
}

export function setUserPosition (
  target: string,
  tile_index: number,
  user_x: number,
  user_y: number
): Uint8Array {
  const payload = new Uint8Array(11)
  const view = new DataView(payload.buffer)
  view.setUint8(0, tile_index)
  // offset 1-2: reserved6
  view.setFloat32(3, user_x, true)
  view.setFloat32(7, user_y, true)

  return buildMessage(703, target, payload)
}

export function copyFrameBuffer (
  target: string,
  tile_index: number,
  length: number,
  src_fb_index: number,
  dst_fb_index: number,
  src_x: number,
  src_y: number,
  dst_x: number,
  dst_y: number,
  width: number,
  height: number,
  duration: number
): Uint8Array {
  const payload = new Uint8Array(15)
  const view = new DataView(payload.buffer)
  view.setUint8(0, tile_index)
  view.setUint8(1, length)
  view.setUint8(2, src_fb_index)
  view.setUint8(3, dst_fb_index)
  view.setUint8(4, src_x)
  view.setUint8(5, src_y)
  view.setUint8(6, dst_x)
  view.setUint8(7, dst_y)
  view.setUint8(8, width)
  view.setUint8(9, height)
  view.setUint32(10, duration, true)
  // offset 14: reserved1

  return buildMessage(716, target, payload)
}

export function setTileEffect (
  target: string,
  instanceid: number,
  type: number,
  speed: number,
  duration: bigint,
  skyType: number,
  cloudSaturationMin: number,
  palette: Lifx.Application.Hsbk[],
  opts: Opts = {}
): Uint8Array {
  const payload = new Uint8Array(188)
  const view = new DataView(payload.buffer)
  // offset 0: reserved0
  // offset 1: reserved1
  view.setUint32(2, instanceid, true)
  view.setUint8(6, type)
  view.setUint32(7, speed, true)
  view.setBigUint64(11, duration, true)
  // offset 19-22: reserved2
  // offset 23-26: reserved3
  view.setUint8(27, skyType)
  // offset 28-30: reserved4
  view.setUint8(31, cloudSaturationMin)
  // offset 32-34: reserved5
  // offset 35-58: reserved6
  const count = Math.min(palette.length, 16)
  view.setUint8(59, count)
  for (let i = 0; i < count; i++) {
    payload.set(encodeHsbk(palette[i]), 60 + i * 8)
  }

  return buildMessage(719, target, payload, opts)
}

export function setRPower (target: string, relay_index: number, on: boolean, opts: Opts = {}): Uint8Array {
  const payload = new Uint8Array(3)
  const view = new DataView(payload.buffer)
  view.setUint8(0, relay_index)
  view.setUint16(1, on ? 65535 : 0, true)

  return buildMessage(817, target, payload, opts)
}

// Deterministic UUID from label so all devices in the same named group share an ID
function labelToUuid (label: string): Uint8Array {
  const uuid = new Uint8Array(16)
  uuid.set(new TextEncoder().encode(label).slice(0, 16))
  return uuid
}

function msToNs (ms: number): bigint {
  return BigInt(ms) * 1_000_000n
}
