import type { DeviceRegistry } from '../DeviceRegistry'
import type { LifxSocket } from '../../udp/udpSocket'
import { requestResponse } from '../requestResponse'
import { setLocation as buildSetLocation } from '../../messages/setMessages'

export async function handleSetLocation (
  mac: string,
  label: string,
  clientSentAt: number,
  serverReceivedAt: number,
  registry: DeviceRegistry,
  udp: LifxSocket,
): Promise<void> {
  const device = registry.getDevice(mac)
  if (!device) {
    process.stderr.write(`set_location: ${mac} not in cache — run discover first\n`)
    return
  }

  try {
    await requestResponse(udp, device, buildSetLocation(mac, label), 45, 1000)
    registry.dispatch({
      type: 'device_field', mac,
      update: { field: 'location', value: label },
      timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
    })
  } catch (e) {
    process.stderr.write(`set_location ${mac}: no ack — ${e}\n`)
  }
}
