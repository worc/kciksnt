import type { DeviceRegistry } from '../DeviceRegistry'
import type { LifxSocket } from '../../udp/udpSocket'
import type { DeviceFieldUpdate } from '../../types/ws'
import { makeTryQuery } from '../requestResponse'
import {
  getColor,
  getHostFirmware,
  getWifiInfo,
  getVersion,
  getGroup,
  getLocation,
  getInfo,
} from '../../messages/getMessages'
import { discoverForCache } from './discover'

export async function inspectDevice (
  mac: string,
  clientSentAt: number,
  serverReceivedAt: number,
  registry: DeviceRegistry,
  udp: LifxSocket,
): Promise<void> {
  let device = registry.getDevice(mac)
  if (!device) {
    process.stdout.write(`${mac} not in cache, triggering discovery\n`)
    const found = await discoverForCache(registry, udp)
    device = found.find(d => d.mac === mac)
    if (!device) {
      registry.dispatch({
        type: 'device_inspect_error',
        mac,
        error: 'Device not found on network',
        timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
      })
      return
    }
  }

  const tryQuery = makeTryQuery(udp, device, `inspect ${mac}`)
  let fieldCount = 0

  function field (update: DeviceFieldUpdate) {
    fieldCount++
    registry.dispatch({
      type: 'device_field',
      mac,
      update,
      timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
    })
  }

  // 1. LightState — label, color, power in one shot
  await tryQuery(getColor(mac), 107, msg => {
    if (!msg.payload) return
    field({ field: 'label',  value: msg.payload.label })
    field({ field: 'color',  value: msg.payload.color })
    field({ field: 'power',  value: { level: msg.payload.power, on: msg.payload.on } })
  })

  // 2. Host firmware
  await tryQuery(getHostFirmware(mac), 15, msg => {
    if (!msg.payload) return
    field({ field: 'firmware', value: {
      version_major: msg.payload.version_major,
      version_minor: msg.payload.version_minor,
      build:         msg.payload.build.toString(),
    }})
  })

  // 3. Wifi signal
  await tryQuery(getWifiInfo(mac), 17, msg => {
    if (!msg.payload) return
    field({ field: 'wifi', value: {
      signal:  msg.payload.signal,
      rssi:    msg.payload.rssi,
      quality: msg.payload.quality,
    }})
  })

  // 4. Version — vendor/product IDs + optional registry lookup
  await tryQuery(getVersion(mac), 33, msg => {
    if (!msg.payload) return
    const { vendor, product } = msg.payload
    const productInfo = registry.lookupProduct(vendor, product)
    field({ field: 'version', value: { vendor, product, ...productInfo } })
  })

  // 5. Group
  await tryQuery(getGroup(mac), 53, msg => {
    if (!msg.payload) return
    field({ field: 'group', value: msg.payload.label })
  })

  // 6. Location
  await tryQuery(getLocation(mac), 50, msg => {
    if (!msg.payload) return
    field({ field: 'location', value: msg.payload.label })
  })

  // 7. Uptime / device clock
  await tryQuery(getInfo(mac), 35, msg => {
    if (!msg.payload) return
    field({ field: 'info', value: {
      time:        msg.payload.time.toString(),
      uptime_ns:   msg.payload.uptime.toString(),
      downtime_ns: msg.payload.downtime.toString(),
    }})
  })

  if (fieldCount === 0) {
    registry.dispatch({
      type: 'device_inspect_error',
      mac,
      error: 'unreachable',
      timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
    })
  } else {
    registry.dispatch({
      type: 'device_inspect_complete',
      mac,
      timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
    })
  }
}
