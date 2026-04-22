import type { DeviceRegistry } from '../DeviceRegistry'
import type { LifxSocket } from '../../udp/udpSocket'
import type { Lifx } from '../../types/lifx'
import { requestResponse } from '../requestResponse'
import { setColor as buildSetColor } from '../../messages/setMessages'

export async function handleSetColor (
  mac: string,
  hsbk: Lifx.Application.Hsbk,
  duration: number,
  clientSentAt: number,
  serverReceivedAt: number,
  registry: DeviceRegistry,
  udp: LifxSocket,
): Promise<void> {
  const device = registry.getDevice(mac)
  if (!device) {
    process.stderr.write(`set_color: ${mac} not in cache — run discover first\n`)
    return
  }

  try {
    // ack_required (type 45) fires when the device has processed the command.
    // res_required would give back a LightState reflecting the state *before* the
    // change — that's the wrong snapshot to show as the confirmed ghost state.
    await requestResponse(udp, device, buildSetColor(mac, hsbk, duration, { ack_required: true }), 45, 1000)
    registry.dispatch({
      type: 'device_field', mac,
      update: { field: 'color', value: hsbk },
      timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
    })
  } catch (e) {
    process.stderr.write(`set_color ${mac}: no ack — ${e}\n`)
  }
}
