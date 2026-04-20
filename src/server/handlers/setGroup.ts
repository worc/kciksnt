import type { DeviceRegistry } from '../DeviceRegistry'
import type { LifxSocket } from '../../udp/udpSocket'
import { requestResponse } from '../requestResponse'
import { setGroup as buildSetGroup } from '../../messages/setMessages'

export async function handleSetGroup (
  mac: string,
  label: string,
  clientSentAt: number,
  serverReceivedAt: number,
  registry: DeviceRegistry,
  udp: LifxSocket,
): Promise<void> {
  const device = registry.getDevice(mac)
  if (!device) {
    process.stderr.write(`set_group: ${mac} not in cache — run discover first\n`)
    return
  }

  try {
    await requestResponse(udp, device, buildSetGroup(mac, label), 45, 1000)
    registry.dispatch({
      type: 'device_field', mac,
      update: { field: 'group', value: label },
      timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
    })
  } catch (e) {
    process.stderr.write(`set_group ${mac}: no ack — ${e}\n`)
  }
}
