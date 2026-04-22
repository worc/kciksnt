import type { DeviceRegistry } from '../DeviceRegistry'
import type { LifxSocket } from '../../udp/udpSocket'
import type { DeviceFieldUpdate } from '../../types/ws'
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
// Undetected-but-known devices are folded in with detected: false so the UI
// can still navigate to them and attempt a manual re-inspect.
// ---------------------------------------------------------------------------

export async function discover (
  registry: DeviceRegistry,
  udp: LifxSocket,
  clientSentAt: number,
  serverReceivedAt: number,
  timeoutMs = 2500,
): Promise<DiscoveredDevice[]> {
  const devices = await runDiscovery(registry, udp, timeoutMs)

  const detectedMacs  = new Set(devices.map(d => d.mac))
  const undetected    = registry.getUndetectedDevices(detectedMacs)

  // discovery_result first so clients create entries for all macs before
  // the per-field cache dispatches below try to merge into them.
  registry.dispatch({
    type: 'discovery_result',
    devices: [...devices, ...undetected],
    timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
  })

  // Re-hydrate undetected devices from the persisted snapshot so the UI
  // can show last-known state immediately.
  for (const u of undetected) {
    const snapshot = registry.getSnapshot(u.mac)
    if (!snapshot) continue

    const updates: DeviceFieldUpdate[] = []
    if (snapshot.label    !== undefined) updates.push({ field: 'label',    value: snapshot.label })
    if (snapshot.group    !== undefined) updates.push({ field: 'group',    value: snapshot.group })
    if (snapshot.location !== undefined) updates.push({ field: 'location', value: snapshot.location })
    if (snapshot.version  !== undefined) updates.push({ field: 'version',  value: snapshot.version })
    if (snapshot.firmware !== undefined) updates.push({ field: 'firmware', value: snapshot.firmware })
    if (snapshot.wifi     !== undefined) updates.push({ field: 'wifi',     value: snapshot.wifi })
    if (snapshot.color    !== undefined) updates.push({ field: 'color',    value: snapshot.color })
    if (snapshot.power    !== undefined) updates.push({ field: 'power',    value: snapshot.power })
    if (snapshot.info     !== undefined) updates.push({ field: 'info',     value: snapshot.info })

    for (const update of updates) {
      registry.dispatch({
        type: 'device_field',
        mac: u.mac,
        update,
        timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
      })
    }
  }

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
