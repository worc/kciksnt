import { buildMessage } from './buildMessage'

export function getService (): Uint8Array {
  return buildMessage(2)
}

export function getHostFirmware (target: string): Uint8Array {
  return buildMessage(14, target)
}

export function getWifiInfo (target: string): Uint8Array {
  return buildMessage(16, target)
}

export function getWifiFirmware (target: string): Uint8Array {
  return buildMessage(18, target)
}

export function getPower (target: string): Uint8Array {
  return buildMessage(20, target)
}

export function getLabel (target: string): Uint8Array {
  return buildMessage(23, target)
}

export function getVersion (target: string): Uint8Array {
  return buildMessage(32, target)
}

export function getInfo (target: string): Uint8Array {
  return buildMessage(34, target)
}

export function getLocation (target: string): Uint8Array {
  return buildMessage(48, target)
}

export function getGroup (target: string): Uint8Array {
  return buildMessage(51, target)
}

export function echoRequest (target: string, echoing: string): Uint8Array {
  const payload = new Uint8Array(64)
  const encoded = new TextEncoder().encode(echoing)
  payload.set(encoded.slice(0, 64))

  return buildMessage(58, target, payload)
}

export function getColor (target: string): Uint8Array {
  return buildMessage(101, target)
}

export function getLightPower (target: string): Uint8Array {
  return buildMessage(116, target)
}

export function getInfrared (target: string): Uint8Array {
  return buildMessage(120, target)
}

export function getHevCycle (target: string): Uint8Array {
  return buildMessage(142, target)
}

export function getHevCycleConfiguration (target: string): Uint8Array {
  return buildMessage(145, target)
}

export function getLastHevCycleResult (target: string): Uint8Array {
  return buildMessage(148, target)
}

export function getColorZones (target: string, start_index: number, end_index: number): Uint8Array {
  const payload = new Uint8Array(2)
  const view = new DataView(payload.buffer)
  view.setUint8(0, start_index)
  view.setUint8(1, end_index)

  return buildMessage(502, target, payload)
}

export function getMultiZoneEffect (target: string): Uint8Array {
  return buildMessage(507, target)
}

export function getExtendedColorZones (target: string): Uint8Array {
  return buildMessage(511)
}

export function getRPower (target: string, relay_index: number): Uint8Array {
  const payload = new Uint8Array(1)
  const view = new DataView(payload.buffer)
  view.setUint8(0, relay_index)

  return buildMessage(816, target, payload)
}

export function getDeviceChain (target: string): Uint8Array {
  return buildMessage(701)
}

export function get64 (target: string, tile_index: number, length: number, x: number, y: number, width: number): Uint8Array {
  const payload = new Uint8Array(5)
  const view = new DataView(payload.buffer)
  view.setUint8(0, tile_index)
  view.setUint8(1, length)
  // view.setUint(2, null) reserved byte
  view.setUint8(3, x)
  view.setUint8(4, y)
  view.setUint8(5, width)

  return buildMessage(707, target, payload)
}

export function getTilePacket (target: string): Uint8Array {
  return buildMessage(718)
}

export function sensorGetAmbientLight(target: string): Uint8Array {
  return buildMessage(401)
}
