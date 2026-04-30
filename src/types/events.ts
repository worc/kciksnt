import type { DiscoveredDevice } from './api'
import type { Lifx } from './lifx'

// ---------------------------------------------------------------------------
// Server → Client envelope. Every dispatched event carries a `type` plus a
// timestamps bag that captures the round-trip stamps. With the SSE+POST
// transport, `clientSentAt` arrives in the POST body, the server stamps
// `serverReceivedAt` and `serverRespondedAt` in the handler, and the browser
// stamps `clientReceivedAt` when the SSE frame is received.
// ---------------------------------------------------------------------------

interface EventEnvelope {
  type:       string
  timestamps: {
    clientReceivedAt?:  number
    clientSentAt:       number
    serverReceivedAt?:  number
    serverRespondedAt?: number
  }
}

// ---------------------------------------------------------------------------
// Device snapshot — the accumulated picture of one device built up
// progressively as individual query responses arrive from the server.
// Each key corresponds to a DeviceFieldUpdate.field so the client can merge
// with a simple  setSnapshot(prev => ({ ...prev, [update.field]: update.value }))
// ---------------------------------------------------------------------------

export interface DeviceSnapshot {
  mac:       string
  ip?:       string
  port?:     number
  label?:    string
  power?:    { level: number; on: boolean }
  color?:    Lifx.Application.Hsbk
  firmware?: { version_major: number; version_minor: number; build: string }
  wifi?:     { signal: number; rssi: number; quality: string }
  version?:  {
    vendor:       number
    product:      number
    vendorName?:  string
    productName?: string
    features?:    Record<string, boolean | number | null>
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
// Server → Client message variants
// ---------------------------------------------------------------------------

interface DiscoveryResult extends EventEnvelope {
  type:    'discovery_result'
  devices: DiscoveredDevice[]
}

interface DeviceField extends EventEnvelope {
  type:    'device_field'
  mac:     string
  update:  DeviceFieldUpdate
  // commandId of the originating client command, when known. Lets a client
  // distinguish its own echoed change from a foreign one (another client, a
  // physical switch, a scheduled scene).
  origin?: string | null
}

interface Snapshot extends EventEnvelope {
  type:    'snapshot'
  devices: DeviceSnapshot[]
}

interface DeviceInspectComplete extends EventEnvelope {
  type: 'device_inspect_complete'
  mac:  string
}

interface DeviceInspectError extends EventEnvelope {
  type:  'device_inspect_error'
  mac:   string
  error: string
}

interface DevReload {
  type: 'dev_reload'
}

interface Error extends EventEnvelope {
  type:    'error'
  message: string
}

export type ServerMessage =
  | DiscoveryResult
  | DeviceField
  | DeviceInspectComplete
  | DeviceInspectError
  | DevReload
  | Error
  | Snapshot
