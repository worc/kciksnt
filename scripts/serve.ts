import { createSocket } from '../src/udp/socket'
import type { LifxSocket } from '../src/udp/socket'
import { parseMessage } from '../src/messages/parseMessage'
import type { ParsedMessage } from '../src/messages/parseMessage'
import {
  getService,
  getColor,
  getHostFirmware,
  getWifiInfo,
  getVersion,
  getGroup,
  getLocation,
  getInfo,
} from '../src/messages/getMessages'
import { PRESETS } from '../src/messages/hsbk'
import { setColor } from '../src/messages/setMessages'
import type { DiscoveredDevice } from '../src/types/api'
import type {ClientMessage, ServerMessage, DeviceFieldUpdate, DeviceSnapshot} from '../src/types/ws'

const PORT = 7410

let socket: LifxSocket
try {
  socket = await createSocket()
} catch (e) {
  process.stderr.write(`Failed to open socket: ${e}\n`)
  process.exit(1)
}

// ---------------------------------------------------------------------------
// Device cache — populated by discovery, consumed by inspect
// ---------------------------------------------------------------------------

const knownDevices = new Map<string, DiscoveredDevice>()

// ---------------------------------------------------------------------------
// LIFX product registry — optional submodule at vendor/lifx-products/
// Run:  git submodule add git@github.com:LIFX/products.git vendor/lifx-products
// ---------------------------------------------------------------------------

interface LifxProductFeatures { [key: string]: boolean | number | null }
interface LifxProduct { pid: number; name: string; features: LifxProductFeatures }
interface LifxVendor  { vid: number; name: string; products: LifxProduct[] }

let productsDb: LifxVendor[] | null = null

async function loadProducts () {
  const file = Bun.file('vendor/lifx-products/products.json')
  if (await file.exists()) {
    productsDb = await file.json() as LifxVendor[]
    process.stdout.write(`Loaded LIFX product registry (${productsDb.length} vendors)\n`)
  }
}

function lookupProduct (vendor: number, product: number) {
  if (!productsDb) return undefined
  const v = productsDb.find(e => e.vid === vendor)
  if (!v) return undefined
  const p = v.products.find(e => e.pid === product)
  if (!p) return undefined
  return { vendorName: v.name, productName: p.name, features: p.features }
}

await loadProducts()

// ---------------------------------------------------------------------------
// UDP helpers
// ---------------------------------------------------------------------------

function sleep (ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms))
}

async function discover (timeoutMs = 1500): Promise<DeviceSnapshot[]> {
  const devices = new Map<string, DeviceSnapshot>()

  socket.onMessage((data, _port, address) => {
    if (data.byteLength < 36) return
    const msg = parseMessage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
    if (msg.type === 3 && msg.payload) {
      const mac = msg.header.frameAddress.target
      devices.set(mac, { mac, ip: address, port: msg.payload.port })
    }
  })

  socket.broadcast(getService())
  await sleep(timeoutMs)

  // Merge into persistent cache
  for (const [mac, device] of devices) knownDevices.set(mac, device)

  return Array.from(devices.values())
}

function requestResponse (
  device: DiscoveredDevice,
  message: Uint8Array,
  expectedType: number,
  timeoutMs = 2000
): Promise<ParsedMessage> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error(`Timeout waiting for type ${expectedType} from ${device.ip}`)),
      timeoutMs
    )
    socket.onMessage((data, _port, address) => {
      if (address !== device.ip || data.byteLength < 36) return
      const msg = parseMessage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
      if (msg.type === expectedType) {
        clearTimeout(timer)
        resolve(msg)
      }
    })
    socket.send(message, device.ip, device.port)
  })
}

// ---------------------------------------------------------------------------
// Device inspection — sequential queries, streaming each field as it arrives
// ---------------------------------------------------------------------------

async function inspectDevice (
  mac: string,
  clientSentAt: number,
  serverReceivedAt: number,
  send: (msg: ServerMessage) => void
): Promise<void> {
  let device = knownDevices.get(mac)
  if (!device) {
    process.stdout.write(`${mac} not in cache, triggering discovery\n`)
    const found = await discover(1000)
    device = found.find(d => d.mac === mac)
    if (!device) {
      send({
        type: 'device_inspect_error',
        mac,
        error: 'Device not found on network',
        timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
      })
      return
    }
  }

  function field (update: DeviceFieldUpdate) {
    send({
      type: 'device_field',
      mac,
      update,
      timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
    })
  }

  // Each query is wrapped so a single timeout doesn't abort the whole sequence
  const tryQuery = async <T extends number>(
    message: Uint8Array,
    expectedType: T,
    handler: (msg: ParsedMessage & { type: T }) => void
  ) => {
    try {
      const msg = await requestResponse(device!, message, expectedType)
      if (msg.type === expectedType) handler(msg as ParsedMessage & { type: T })
    } catch (e) {
      process.stderr.write(`inspect ${mac}: ${e}\n`)
    }
  }

  // 1. LightState — label, color, power all in one shot
  await tryQuery(getColor(mac), 107, msg => {
    if (!msg.payload) return
    field({ field: 'label', value: msg.payload.label })
    field({ field: 'color', value: msg.payload.color })
    field({ field: 'power', value: { level: msg.payload.power, on: msg.payload.on } })
  })

  // 2. Host firmware
  await tryQuery(getHostFirmware(mac), 15, msg => {
    if (!msg.payload) return
    field({ field: 'firmware', value: {
      version_major: msg.payload.version_major,
      version_minor: msg.payload.version_minor,
      build:         msg.payload.build.toString(),
    }})
  })

  // 3. Wifi signal
  await tryQuery(getWifiInfo(mac), 17, msg => {
    if (!msg.payload) return
    field({ field: 'wifi', value: {
      signal:  msg.payload.signal,
      rssi:    msg.payload.rssi,
      quality: msg.payload.quality,
    }})
  })

  // 4. Version — vendor/product IDs + optional registry lookup
  await tryQuery(getVersion(mac), 33, msg => {
    if (!msg.payload) return
    const { vendor, product } = msg.payload
    const productInfo = lookupProduct(vendor, product)
    field({ field: 'version', value: { vendor, product, ...productInfo } })
  })

  // 5. Group
  await tryQuery(getGroup(mac), 53, msg => {
    if (!msg.payload) return
    field({ field: 'group', value: msg.payload.label })
  })

  // 6. Location
  await tryQuery(getLocation(mac), 50, msg => {
    if (!msg.payload) return
    field({ field: 'location', value: msg.payload.label })
  })

  // 7. Uptime / device clock
  await tryQuery(getInfo(mac), 35, msg => {
    if (!msg.payload) return
    field({ field: 'info', value: {
      time:        msg.payload.time.toString(),
      uptime_ns:   msg.payload.uptime.toString(),
      downtime_ns: msg.payload.downtime.toString(),
    }})
  })

  send({
    type: 'device_inspect_complete',
    mac,
    timestamps: { clientSentAt, serverReceivedAt, serverRespondedAt: Date.now() },
  })
}

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------

// Track connected WS clients so we can broadcast dev reloads
const wsClients = new Set<{ send(data: string | ArrayBuffer | Buffer): void }>()

Bun.serve({
  port: PORT,

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

      if (msg.type === 'discover') {
        const devices = await discover()
        const response: ServerMessage = {
          type: 'discovery_result',
          devices,
          timestamps: {
            clientSentAt:      msg.timestamps.clientSentAt,
            serverReceivedAt,
            serverRespondedAt: Date.now(),
          },
        }
        ws.send(JSON.stringify(response))
      }

      if (msg.type === 'inspect_device') {
        const clientSentAt = msg.timestamps.clientSentAt
        await inspectDevice(msg.mac, clientSentAt, serverReceivedAt, m => ws.send(JSON.stringify(m)))
      }
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
      const payload = JSON.stringify({ type: 'dev_reload' })
      for (const client of wsClients) client.send(payload)
      return new Response('ok')
    }

    // HTTP API — kept as a fallback for direct curl-style access
    if (url.pathname === '/api/discover') {
      return discover().then(devices => new Response(JSON.stringify(devices), {
        headers: { 'Content-Type': 'application/json' },
      }))
    }

    if (url.pathname.startsWith('/api/setColor/')) {
      const id = url.pathname.split('/api/setColor/')[1]
      socket.send(setColor(id, PRESETS.red), '192.168.0.124')
      return new Response(`setColor ${id}`)
    }

    // Static files (paths with a dot) or SPA fallback
    if (url.pathname.includes('.')) {
      const staticFile = Bun.file(`dist${url.pathname}`)
      return staticFile.exists().then(exists =>
        exists
          ? new Response(staticFile)
          : new Response('Not Found', { status: 404 })
      )
    }

    return new Response(Bun.file('dist/index.html'))
  },
})

process.stdout.write(`http://localhost:${PORT}\n`)
