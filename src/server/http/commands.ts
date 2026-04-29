import type { DeviceRegistry } from '../DeviceRegistry'
import type { LifxSocket } from '../../udp/udpSocket'
import type { DeviceStateCommand, DeviceActionCommand } from '../../types/api'
import { handleSetColor }    from '../handlers/setColor'
import { handleSetLabel }    from '../handlers/setLabel'
import { handleSetGroup }    from '../handlers/setGroup'
import { handleSetLocation } from '../handlers/setLocation'
import { handleSetPower }    from '../handlers/setPower'
import { identifyDevice }    from '../handlers/identify'
import { inspectDevice }     from '../handlers/inspect'
import { discover }          from '../handlers/discover'

// ---------------------------------------------------------------------------
// HTTP command surface for the SSE-era client. Mirrors the WS router's
// dispatch table but lets each command carry a client-generated commandId,
// which the handlers thread back through dispatched device_field events as
// `origin`. Tabs use that origin to tell their own command's echo apart from
// foreign updates (another client, a wall switch, a scene).
//
// Responses are 202 Accepted — the authoritative confirmation flows back
// through the SSE stream, not this response. The body is awaited only so
// we can surface routing/validation failures synchronously.
// ---------------------------------------------------------------------------

const json = (status: number, body: unknown): Response =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  })

async function readJson<T> (req: Request): Promise<T | null> {
  try { return await req.json() as T } catch { return null }
}

// ---------------------------------------------------------------------------
// POST /devices/:mac/state
// ---------------------------------------------------------------------------

export async function handleDeviceState (
  req: Request,
  mac: string,
  registry: DeviceRegistry,
  udp: LifxSocket,
): Promise<Response> {
  const body = await readJson<DeviceStateCommand>(req)
  if (!body || typeof body.commandId !== 'string' || typeof body.field !== 'string') {
    return json(400, { error: 'invalid body: expected { commandId, field, value, ... }' })
  }

  const now    = Date.now()
  const origin = body.commandId

  switch (body.field) {
    case 'color':
      void handleSetColor(mac, body.value, body.duration ?? 0, now, now, registry, udp, undefined, origin)
      break
    case 'label':
      void handleSetLabel(mac, body.value, now, now, registry, udp, undefined, origin)
      break
    case 'group':
      void handleSetGroup(mac, body.value, now, now, registry, udp, undefined, origin)
      break
    case 'location':
      void handleSetLocation(mac, body.value, now, now, registry, udp, undefined, origin)
      break
    case 'power':
      void handleSetPower(mac, body.value, body.duration ?? 0, now, now, registry, udp, undefined, origin)
      break
    default:
      return json(400, { error: `unknown field: ${(body as { field: string }).field}` })
  }

  return json(202, { commandId: origin })
}

// ---------------------------------------------------------------------------
// POST /devices/:mac/identify
// POST /devices/:mac/inspect
// Action endpoints — no field/value, just a commandId for echo attribution.
// ---------------------------------------------------------------------------

export async function handleDeviceAction (
  req: Request,
  mac: string,
  action: 'identify' | 'inspect',
  registry: DeviceRegistry,
  udp: LifxSocket,
): Promise<Response> {
  const body = await readJson<DeviceActionCommand>(req)
  if (!body || typeof body.commandId !== 'string') {
    return json(400, { error: 'invalid body: expected { commandId }' })
  }

  const now    = Date.now()
  const origin = body.commandId
  const fn     = action === 'identify' ? identifyDevice : inspectDevice

  void fn(mac, now, now, registry, udp, undefined, origin)
  return json(202, { commandId: origin })
}

// ---------------------------------------------------------------------------
// POST /api/discover
// Synchronous — discovery returns the found device list directly so a
// freshly-loaded tab can render before the SSE stream's snapshot arrives.
// ---------------------------------------------------------------------------

export async function handleDiscover (
  registry: DeviceRegistry,
  udp: LifxSocket,
): Promise<Response> {
  const now     = Date.now()
  const devices = await discover(registry, udp, now, now)
  return json(200, devices)
}
