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
  timeoutMs = 1000,
  origin: string | null = null,
): Promise<void> {
  const device = registry.getDevice(mac)
  if (!device) {
    process.stderr.write(`set_label: ${mac} not in cache — run discover first\n`)
    return
  }

  try {
    await requestResponse(udp, device, buildSetLabel(mac, label, { ack_required: true }), 45, timeoutMs)
    registry.dispatch({
      type:       'device_field',
      mac,
      origin,
      update:     { field: 'label', value: label },
      timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
    })
  } catch (e) {
    process.stderr.write(`set_label ${mac}: no ack — ${e}\n`)
  }
}
