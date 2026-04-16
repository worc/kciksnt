import { Lifx } from '../types/lifx'
import { decodeHeader } from './header'
import { decodeHsbk } from './hsbk'
import { decodeLifxString } from '../protocol/strings'

type DecodedHeader = ReturnType<typeof decodeHeader>

export interface StateServicePayload   { service: number; port: number }
export interface StateHostFirmwarePayload { build: bigint; version_minor: number; version_major: number }
export interface StateWifiInfoPayload  { signal: number; rssi: number; quality: string }
export interface StateWifiFirmwarePayload { build: Date; version_major: number; version_minor: number }
export interface StatePowerPayload     { level: number; on: boolean }
export interface StateLabelPayload     { label: string }
export interface StateVersionPayload   { vendor: number; product: number }
export interface StateLocationPayload  { location: Uint8Array; label: string; updated_at: bigint }
export interface StateGroupPayload     { group: Uint8Array; label: string; updated_at: bigint }
export interface LightStatePayload     { color: Lifx.Application.Hsbk; power: number; on: boolean; label: string }
export interface StateLightPowerPayload { level: number; on: boolean }
export interface StateInfoPayload      { time: bigint; uptime: bigint; downtime: bigint }

export type ParsedMessage =
  | { type: 3;   header: DecodedHeader; payload: StateServicePayload }
  | { type: 15;  header: DecodedHeader; payload: StateHostFirmwarePayload }
  | { type: 17;  header: DecodedHeader; payload: StateWifiInfoPayload }
  | { type: 19;  header: DecodedHeader; payload: StateWifiFirmwarePayload }
  | { type: 22;  header: DecodedHeader; payload: StatePowerPayload }
  | { type: 25;  header: DecodedHeader; payload: StateLabelPayload }
  | { type: 33;  header: DecodedHeader; payload: StateVersionPayload }
  | { type: 45;  header: DecodedHeader; payload: null }
  | { type: 50;  header: DecodedHeader; payload: StateLocationPayload }
  | { type: 53;  header: DecodedHeader; payload: StateGroupPayload }
  | { type: 107; header: DecodedHeader; payload: LightStatePayload }
  | { type: 35;  header: DecodedHeader; payload: StateInfoPayload }
  | { type: 118; header: DecodedHeader; payload: StateLightPowerPayload }
  | { type: number; header: DecodedHeader; payload: null }

function signalQuality(signal: number): { rssi: number; quality: string } {
  const rssi = Math.floor(10 * Math.log10(signal) + 0.5)
  if (rssi === 200 || rssi < 0) {
    if (rssi === 200)  return { rssi, quality: 'No signal' }
    if (rssi <= -80)   return { rssi, quality: 'Very bad signal' }
    if (rssi <= -70)   return { rssi, quality: 'Somewhat bad signal' }
    if (rssi <= -60)   return { rssi, quality: 'Alright signal' }
    return               { rssi, quality: 'Good signal' }
  }
  if (rssi <= 6)   return { rssi, quality: 'Very bad signal' }
  if (rssi <= 11)  return { rssi, quality: 'Somewhat bad signal' }
  if (rssi <= 16)  return { rssi, quality: 'Alright signal' }
  return             { rssi, quality: 'Good signal' }
}

export function parseMessage (data: Uint8Array): ParsedMessage {
  const headerBuf = new Uint8Array(data.buffer, data.byteOffset, 36)
  const header = decodeHeader(headerBuf)
  const type = header.protocolHeader.type

  const payloadLength = Math.max(0, data.byteLength - 36)
  if (payloadLength === 0) {
    return { type, header, payload: null }
  }

  const payloadBuf = new Uint8Array(data.buffer, data.byteOffset + 36, payloadLength)
  const view = new DataView(payloadBuf.buffer, payloadBuf.byteOffset, payloadBuf.byteLength)

  switch (type) {
    case 3: return { type, header, payload: {
      service: view.getUint8(0),
      port: view.getUint32(1, true),
    }}

    case 15: return { type, header, payload: {
      build: view.getBigUint64(0, true),
      version_minor: view.getUint16(16, true),
      version_major: view.getUint16(18, true),
    }}

    case 17: {
      const signal = view.getFloat32(0, true)
      return { type, header, payload: { signal, ...signalQuality(signal) } }
    }

    case 19: return { type, header, payload: {
      build: new Date(Number(view.getBigUint64(0, true))),
      version_minor: view.getUint16(16),
      version_major: view.getUint16(18),
    }}

    case 22: {
      const level = view.getUint16(0, true)
      return { type, header, payload: { level, on: level > 0 } }
    }

    case 25: return { type, header, payload: {
      label: decodeLifxString(payloadBuf.slice(0, 32)),
    }}

    case 33: return { type, header, payload: {
      vendor: view.getUint32(0, true),
      product: view.getUint32(4, true),
    }}

    case 45: return { type, header, payload: null }

    case 50: return { type, header, payload: {
      location: payloadBuf.slice(0, 16),
      label: decodeLifxString(payloadBuf.slice(16, 48)),
      updated_at: view.getBigUint64(48, true),
    }}

    case 53: return { type, header, payload: {
      group: payloadBuf.slice(0, 16),
      label: decodeLifxString(payloadBuf.slice(16, 48)),
      updated_at: view.getBigUint64(48, true),
    }}

    case 107: {
      // hue(2) sat(2) bright(2) kelvin(2) reserved(2) power(2) label(32) reserved(8)
      const color = decodeHsbk(payloadBuf.slice(0, 8))
      const power = view.getUint16(10, true)
      const label = decodeLifxString(payloadBuf.slice(12, 44))
      return { type, header, payload: { color, power, on: power > 0, label } }
    }

    case 35: return { type, header, payload: {
      time:     view.getBigUint64(0,  true),
      uptime:   view.getBigUint64(8,  true),
      downtime: view.getBigUint64(16, true),
    }}

    case 118: {
      const level = view.getUint16(0, true)
      return { type, header, payload: { level, on: level > 0 } }
    }

    default: return { type, header, payload: null }
  }
}
