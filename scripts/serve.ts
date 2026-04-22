import { DeviceRegistry } from '../src/server/DeviceRegistry'
import { createWsServer } from '../src/server/ws/router'
import { createUdpSocket } from '../src/udp/udpSocket'

const PORT = 7410

const registry = new DeviceRegistry()
await registry.loadProducts()
await registry.loadFromDisk()

let udp: Awaited<ReturnType<typeof createUdpSocket>>
try {
  udp = await createUdpSocket()
} catch (e) {
  process.stderr.write(`Failed to open socket: ${e}\n`)
  process.exit(1)
}

createWsServer(registry, udp!, PORT)

process.stdout.write(`http://localhost:${PORT}\n`)
