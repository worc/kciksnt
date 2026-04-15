import { Lifx } from '../types/lifx'
import { asUint16 } from '../types/uint'

export function encodeHsbk(hsbk: Lifx.Application.Hsbk): Uint8Array {
  const bytes = new Uint8Array(8)
  const view = new DataView(bytes.buffer)
  view.setUint16(0, asUint16(Math.round(0x10000 * hsbk.hue / 360) % 0x10000), true)
  view.setUint16(2, asUint16(Math.round(0xFFFF * hsbk.saturation)), true)
  view.setUint16(4, asUint16(Math.round(0xFFFF * hsbk.brightness)), true)
  view.setUint16(6, asUint16(hsbk.kelvin), true)
  return bytes
}

export function decodeHsbk(buf: Uint8Array): Lifx.Application.Hsbk {
  const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength)
  return {
    hue: (view.getUint16(0, true) / 0x10000) * 360,
    saturation: view.getUint16(2, true) / 0xFFFF,
    brightness: view.getUint16(4, true) / 0xFFFF,
    kelvin: view.getUint16(6, true),
  }
}

export const PRESETS: Record<string, Lifx.Application.Hsbk> = {
  red:        { hue: 0,   saturation: 1, brightness: 1, kelvin: 5000 },
  green:      { hue: 120, saturation: 1, brightness: 1, kelvin: 5000 },
  blue:       { hue: 240, saturation: 1, brightness: 1, kelvin: 5000 },
  warm_white: { hue: 0,   saturation: 0, brightness: 1, kelvin: 2700 },
  daylight:   { hue: 0,   saturation: 0, brightness: 1, kelvin: 5500 },
  cool_white: { hue: 0,   saturation: 0, brightness: 1, kelvin: 7500 },
}
