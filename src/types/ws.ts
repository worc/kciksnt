import type { DiscoveredDevice } from './api'
import type { Lifx } from './lifx'

// ---------------------------------------------------------------------------
// Client → Server
// ---------------------------------------------------------------------------

export type ClientMessage =
  | { type: 'discover'; sentAt: number }
  | { type: 'inspect_device'; mac: string; sentAt: number }

// ---------------------------------------------------------------------------
// Device snapshot — the accumulated picture of one device built up
// progressively as individual query responses arrive from the server.
// Each key corresponds to a DeviceFieldUpdate.field so the client can merge
// with a simple  setSnapshot(prev => ({ ...prev, [update.field]: update.value }))
// ---------------------------------------------------------------------------

export interface DeviceSnapshot {
  mac: string
  label?:    string
  power?:    { level: number; on: boolean }
  color?:    Lifx.Application.Hsbk
  firmware?: { version_major: number; version_minor: number; build: string }
  wifi?:     { signal: number; rssi: number; quality: string }
  version?:  {
    vendor: number
    product: number
    vendorName?: string
    productName?: string
    features?: Record<string, boolean | number | null>
  }
  group?:    string
  location?: string
  info?:     { time: string; uptime_ns: string; downtime_ns: string }
}

export type DeviceFieldUpdate =
  | { field: 'label';    value: string }
  | { field: 'power';    value: NonNullable<DeviceSnapshot['power']> }
  | { field: 'color';    value: NonNullable<DeviceSnapshot['color']> }
  | { field: 'firmware'; value: NonNullable<DeviceSnapshot['firmware']> }
  | { field: 'wifi';     value: NonNullable<DeviceSnapshot['wifi']> }
  | { field: 'version';  value: NonNullable<DeviceSnapshot['version']> }
  | { field: 'group';    value: string }
  | { field: 'location'; value: string }
  | { field: 'info';     value: NonNullable<DeviceSnapshot['info']> }

// ---------------------------------------------------------------------------
// Server → Client
// ---------------------------------------------------------------------------

export type ServerMessage =
  | {
      type: 'discovery_result'
      devices: DiscoveredDevice[]
      timestamps: {
        clientSentAt: number      // echoed from client
        serverReceivedAt: number  // stamped when server message handler fired
        serverRespondedAt: number // stamped just before ws.send
      }
    }
  | { type: 'device_field';            mac: string; update: DeviceFieldUpdate; receivedAt: number }
  | { type: 'device_inspect_complete'; mac: string; completedAt: number }
  | { type: 'device_inspect_error';    mac: string; error: string }
  | { type: 'error'; message: string }
