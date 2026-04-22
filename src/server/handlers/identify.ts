import type { DeviceRegistry } from '../DeviceRegistry'
import type { LifxSocket } from '../../udp/udpSocket'
import type { DeviceFieldUpdate } from '../../types/ws'
import { makeTryQuery } from '../requestResponse'
import { getLabel, getGroup, getLocation } from '../../messages/getMessages'
import { discoverForCache } from './discover'

export async function identifyDevice (
  mac: string,
  clientSentAt: number,
  serverReceivedAt: number,
  registry: DeviceRegistry,
  udp: LifxSocket,
): Promise<void> {
  let device = registry.getDevice(mac)
  if (!device) {
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

  const tryQuery = makeTryQuery(udp, device, `identify ${mac}`)
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

  await tryQuery(getLabel(mac), 25, msg => {
    if (!msg.payload) return
    field({ field: 'label', value: msg.payload.label })
  })

  await tryQuery(getGroup(mac), 53, msg => {
    if (!msg.payload) return
    field({ field: 'group', value: msg.payload.label })
  })

  await tryQuery(getLocation(mac), 50, msg => {
    if (!msg.payload) return
    field({ field: 'location', value: msg.payload.label })
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
