import type { DeviceRegistry } from '../DeviceRegistry'
import type { LifxSocket } from '../../udp/udpSocket'
import type { ClientMessage, ServerMessage } from '../../types/ws'
import { discover } from '../handlers/discover'
import { identifyDevice } from '../handlers/identify'
import { inspectDevice } from '../handlers/inspect'
import { handleSetColor } from '../handlers/setColor'
import { handleSetLabel } from '../handlers/setLabel'
import { handleSetGroup } from '../handlers/setGroup'
import { handleSetLocation } from '../handlers/setLocation'

type WSClient = { send(data: string | ArrayBuffer | Buffer): void }

// ---------------------------------------------------------------------------
// Route map — each handler receives its narrowed message type.
// Add a key for every ClientMessage['type'] to keep TypeScript exhaustive.
// ---------------------------------------------------------------------------

type RouteMap = {
  [K in ClientMessage['type']]: (
    msg: Extract<ClientMessage, { type: K }>,
    registry: DeviceRegistry,
    udp: LifxSocket,
    serverReceivedAt: number,
  ) => void | Promise<void>
}

const routes: RouteMap = {
  discover (msg, registry, udp, serverReceivedAt) {
    void discover(registry, udp, msg.timestamps.clientSentAt, serverReceivedAt)
  },
  identify_device (msg, registry, udp, serverReceivedAt) {
    return identifyDevice(msg.mac, msg.timestamps.clientSentAt, serverReceivedAt, registry, udp)
  },
  inspect_device (msg, registry, udp, serverReceivedAt) {
    return inspectDevice(msg.mac, msg.timestamps.clientSentAt, serverReceivedAt, registry, udp)
  },
  set_color (msg, registry, udp, serverReceivedAt) {
    return handleSetColor(msg.mac, msg.hsbk, msg.duration ?? 0, msg.timestamps.clientSentAt, serverReceivedAt, registry, udp)
  },
  set_label (msg, registry, udp, serverReceivedAt) {
    return handleSetLabel(msg.mac, msg.label, msg.timestamps.clientSentAt, serverReceivedAt, registry, udp)
  },
  set_group (msg, registry, udp, serverReceivedAt) {
    return handleSetGroup(msg.mac, msg.label, msg.timestamps.clientSentAt, serverReceivedAt, registry, udp)
  },
  set_location (msg, registry, udp, serverReceivedAt) {
    return handleSetLocation(msg.mac, msg.label, msg.timestamps.clientSentAt, serverReceivedAt, registry, udp)
  },
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

export function createWsServer (
  registry: DeviceRegistry,
  udp: LifxSocket,
  port: number,
): void {
  const wsClients = new Set<WSClient>()

  function broadcast (msg: ServerMessage): void {
    const payload = JSON.stringify(msg)
    for (const client of wsClients) client.send(payload)
  }

  // Anything handlers dispatch flows out to all connected WS clients
  registry.on('dispatch', broadcast)

  Bun.serve({
    hostname: '0.0.0.0',
    port,

    websocket: {
      open (ws) {
        wsClients.add(ws)
        process.stdout.write('WebSocket client connected\n')
      },

      async message (ws, raw) {
        const serverReceivedAt = Date.now()
        let msg: ClientMessage
        try {
          msg = JSON.parse(typeof raw === 'string' ? raw : raw.toString()) as ClientMessage
        } catch {
          return
        }

        const handler = routes[msg.type]
        if (handler) await (handler as (m: ClientMessage, r: DeviceRegistry, u: LifxSocket, t: number) => void | Promise<void>)(msg, registry, udp, serverReceivedAt)
      },

      close (ws) {
        wsClients.delete(ws)
        process.stdout.write('WebSocket client disconnected\n')
      },
    },

    fetch (req, server) {
      const url = new URL(req.url)
      process.stdout.write(`${req.method} ${url.pathname}\n`)

      // WebSocket upgrade
      if (url.pathname === '/ws') {
        const upgraded = server.upgrade(req)
        if (!upgraded) return new Response('WebSocket upgrade failed', { status: 400 })
        return
      }

      // Dev live-reload — esbuild pings this after each rebuild
      if (url.pathname === '/dev/reload' && req.method === 'POST') {
        for (const client of wsClients) client.send(JSON.stringify({ type: 'dev_reload' }))
        return new Response('ok')
      }

      // HTTP API fallback
      if (url.pathname === '/api/discover') {
        const now = Date.now()
        return discover(registry, udp, now, now).then(devices =>
          new Response(JSON.stringify(devices), { headers: { 'Content-Type': 'application/json' } })
        )
      }

      // Static files (paths with a dot) or SPA fallback
      if (url.pathname.includes('.')) {
        const staticFile = Bun.file(`dist${url.pathname}`)
        return staticFile.exists().then(exists =>
          exists ? new Response(staticFile) : new Response('Not Found', { status: 404 })
        )
      }

      return new Response(Bun.file('dist/index.html'))
    },
  })
}
