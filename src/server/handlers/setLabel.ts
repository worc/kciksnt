import type { DeviceRegistry } from '../DeviceRegistry'
import type { LifxSocket } from '../../udp/udpSocket'
import { requestResponse } from '../requestResponse'
import { setLabel as buildSetLabel } from '../../messages/setMessages'

export async function handleSetLabel (
  mac: string,
  label: string,
  clientSentAt: number,
  serverReceivedAt: number,
  registry: DeviceRegistry,
  udp: LifxSocket,
): Promise<void> {
  const device = registry.getDevice(mac)
  if (!device) {
    process.stderr.write(`set_label: ${mac} not in cache — run discover first\n`)
    return
  }

  try {
    await requestResponse(udp, device, buildSetLabel(mac, label, { ack_required: true }), 45, 1000)
    registry.dispatch({
      type: 'device_field', mac,
      update: { field: 'label', value: label },
      timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
    })
  } catch (e) {
    process.stderr.write(`set_label ${mac}: no ack — ${e}\n`)
  }
}
