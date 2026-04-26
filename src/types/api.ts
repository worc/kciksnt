// the shape of data we expect between the browser and the server

export interface DiscoveredDevice {
  mac: string
  ip: string
  port: number
  // false = known from persisted store but not seen in this discovery run
  detected?: boolean
}
