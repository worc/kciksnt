import type { DeviceRegistry } from '../DeviceRegistry'
import type { LifxSocket } from '../../udp/udpSocket'
import { parseMessage } from '../../messages/parseMessage'
import { getService } from '../../messages/getMessages'
import type { DiscoveredDevice } from '../../types/api'

// ---------------------------------------------------------------------------
// Core: run a discovery cycle, populate registry, return found devices.
// Attaches a temporary listener so concurrent discover calls don't collide.
// ---------------------------------------------------------------------------

async function runDiscovery (
  registry: DeviceRegistry,
  udp: LifxSocket,
  timeoutMs: number,
): Promise<DiscoveredDevice[]> {
  const found = new Map<string, DiscoveredDevice>()

  function handler (data: Buffer, _port: number, address: string) {
    if (data.byteLength < 36) return
    const msg = parseMessage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
    if (msg.type === 3 && msg.payload) {
      const mac = msg.header.frameAddress.target
      found.set(mac, { mac, ip: address, port: msg.payload.port })
    }
  }

  udp.on('message', handler)
  udp.broadcast(getService())
  await Bun.sleep(timeoutMs)
  udp.off('message', handler)

  for (const [mac, device] of found) registry.setDevice(mac, device)

  return Array.from(found.values())
}

// ---------------------------------------------------------------------------
// WS-facing: discovers, dispatches discovery_result to clients.
// ---------------------------------------------------------------------------

export async function discover (
  registry: DeviceRegistry,
  udp: LifxSocket,
  clientSentAt: number,
  serverReceivedAt: number,
  timeoutMs = 1500,
): Promise<DiscoveredDevice[]> {
  const devices = await runDiscovery(registry, udp, timeoutMs)
  registry.dispatch({
    type: 'discovery_result',
    devices,
    timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
  })
  return devices
}

// ---------------------------------------------------------------------------
// Internal: discovers for cache population only — no WS dispatch.
// Used by identify/inspect when a MAC isn't in the registry yet.
// ---------------------------------------------------------------------------

export function discoverForCache (
  registry: DeviceRegistry,
  udp: LifxSocket,
  timeoutMs = 1000,
): Promise<DiscoveredDevice[]> {
  return runDiscovery(registry, udp, timeoutMs)
}
