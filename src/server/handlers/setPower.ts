import type { DeviceRegistry } from '../DeviceRegistry'
import type { LifxSocket } from '../../udp/udpSocket'
import { requestResponse } from '../requestResponse'
import { setPower as buildSetPower, setLightPower as buildSetLightPower } from '../../messages/setMessages'

export async function handleSetPower (
  mac: string,
  on: boolean,
  duration: number,
  clientSentAt: number,
  serverReceivedAt: number,
  registry: DeviceRegistry,
  udp: LifxSocket,
): Promise<void> {
  const device = registry.getDevice(mac)
  if (!device) {
    process.stderr.write(`set_power: ${mac} not in cache — run discover first\n`)
    return
  }

  // SetLightPower (117) when duration > 0 so the transition fades.
  // SetPower (21) otherwise — instant state change.
  const msg = duration > 0
    ? buildSetLightPower(mac, on, duration, { ack_required: true })
    : buildSetPower(mac, on, { ack_required: true })

  try {
    // Ack (type 45) fires immediately when the device has accepted the command,
    // not after the fade completes — so the timeout can stay short.
    await requestResponse(udp, device, msg, 45, 1000)
    registry.dispatch({
      type: 'device_field',
      mac,
      update: { field: 'power', value: { level: on ? 65535 : 0, on } },
      timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
    })
  } catch (e) {
    process.stderr.write(`set_power ${mac}: no ack — ${e}\n`)
  }
}
