import type { DiscoveredDevice } from './api'
import type { Lifx } from './lifx'

interface WebSocketMessage {
  type: string,
  timestamps: {
    clientReceivedAt?: number   // stamped onmessage
    clientSentAt: number        // echoed from client
    serverReceivedAt?: number    // stamped when server message handler fired
    serverRespondedAt?: number   // stamped just before ws.send
  }
}

// ---------------------------------------------------------------------------
// Client → Server
// ---------------------------------------------------------------------------
interface Discover extends WebSocketMessage {
  type: 'discover'
}

interface IdentifyDevice extends WebSocketMessage {
  type: 'identify_device'
  mac: string
}

interface InspectDevice extends WebSocketMessage {
  type: 'inspect_device'
  mac: string
}

interface SetColor extends WebSocketMessage {
  type: 'set_color'
  mac: string
  hsbk: Lifx.Application.Hsbk
  duration?: number
}

interface SetLabel extends WebSocketMessage {
  type: 'set_label'
  mac: string
  label: string
}

interface SetGroup extends WebSocketMessage {
  type: 'set_group'
  mac: string
  label: string
}

interface SetLocation extends WebSocketMessage {
  type: 'set_location'
  mac: string
  label: string
}

export type ClientMessage =
  | Discover
  | IdentifyDevice
  | InspectDevice
  | SetColor
  | SetLabel
  | SetGroup
  | SetLocation

// ---------------------------------------------------------------------------
// Device snapshot — the accumulated picture of one device built up
// progressively as individual query responses arrive from the server.
// Each key corresponds to a DeviceFieldUpdate.field so the client can merge
// with a simple  setSnapshot(prev => ({ ...prev, [update.field]: update.value }))
// ---------------------------------------------------------------------------

export interface DeviceSnapshot {
  mac: string
  ip?: string
  port?: number
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
interface DiscoveryResult extends WebSocketMessage {
  type: 'discovery_result'
  devices: DiscoveredDevice[]
}

interface DeviceField extends WebSocketMessage {
  type: 'device_field'
  mac: string
  update: DeviceFieldUpdate
}

interface DeviceInspectComplete extends WebSocketMessage {
  type:'device_inspect_complete'
  mac: string
}

interface DeviceInspectError extends WebSocketMessage {
  type: 'device_inspect_error'
  mac: string
  error: string
}

interface DevReload {
  type: 'dev_reload'
}

interface Error extends WebSocketMessage {
  type: 'error'
  message: string
}

export type ServerMessage =
  | DiscoveryResult
  | DeviceField
  | DeviceInspectComplete
  | DeviceInspectError
  | DevReload
  | Error
