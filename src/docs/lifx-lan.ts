// Type structure for a "docs" object. Used by the front end to generate tooltips or help page snippets,
// and as the schema for lifx-lan.json.

export interface FieldDescription {
  name: string
  type: string // deliberately a plain string — BoolInt, Reserved, Color[N], Tile[N] etc. don't map cleanly to TS types
  description?: string
}

export interface LifxLanDoc {
  // Packet type number — the 2 in "GetService (2)"
  packet_number: number

  // Packet name — the GetService in "GetService (2)"
  name: string

  // Message flow direction
  direction: 'get' | 'set' | 'state' | 'core'

  category: 'Core' | 'Discovery' | 'Device' | 'Light' | 'MultiZone' | 'Relay' | 'Tile'

  description: string

  // Payload fields, in wire order. Omitted for empty-payload packets.
  fields?: FieldDescription[]

  // For get/set packets: the packet type number(s) expected in response.
  // Arrays only for packets like GetColorZones that can return either StateZone or StateMultiZone.
  reply_type?: number | number[]

  // For state packets: which get/set packet type(s) this is a reply to.
  reply_to?: number[]

  // Capability string required to use this packet, e.g. "infrared", "hev", "Linear Zones".
  requires_capability?: string
}
