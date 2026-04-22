import { EventEmitter } from 'node:events'
import { mkdir } from 'node:fs/promises'
import type { DiscoveredDevice } from '../types/api'
import type { ServerMessage, DeviceSnapshot } from '../types/ws'

interface LifxProductFeatures { [key: string]: boolean | number | null }
interface LifxProduct { pid: number; name: string; features: LifxProductFeatures }
interface LifxVendor  { vid: number; name: string; products: LifxProduct[] }

export interface ProductInfo {
  vendorName:  string
  productName: string
  features:    LifxProductFeatures
}

const DATA_FILE = 'data/devices.json'

export class DeviceRegistry extends EventEmitter {
  private readonly knownDevices   = new Map<string, DiscoveredDevice>()
  private readonly knownSnapshots = new Map<string, DeviceSnapshot>()
  private productsDb: LifxVendor[] | null = null
  private saveTimer: ReturnType<typeof setTimeout> | null = null

  // ---------------------------------------------------------------------------
  // Device routing table
  // ---------------------------------------------------------------------------

  setDevice (mac: string, device: DiscoveredDevice): void {
    this.knownDevices.set(mac, device)
    // Keep the persisted snapshot's ip/port up-to-date when a device is (re)discovered
    const existing = this.knownSnapshots.get(mac) ?? { mac }
    this.knownSnapshots.set(mac, { ...existing, ip: device.ip, port: device.port })
    this.scheduleSave()
  }

  getDevice (mac: string): DiscoveredDevice | undefined {
    return this.knownDevices.get(mac)
  }

  // ---------------------------------------------------------------------------
  // Persistent snapshot store
  // ---------------------------------------------------------------------------

  getSnapshot (mac: string): DeviceSnapshot | undefined {
    return this.knownSnapshots.get(mac)
  }

  /** Returns known devices whose MACs are not in detectedMacs, for folding into
   *  discovery results as offline/undetected entries. */
  getUndetectedDevices (detectedMacs: Set<string>): DiscoveredDevice[] {
    const result: DiscoveredDevice[] = []
    for (const [mac, snapshot] of this.knownSnapshots) {
      if (detectedMacs.has(mac)) continue
      if (!snapshot.ip || !snapshot.port) continue
      result.push({ mac, ip: snapshot.ip, port: snapshot.port, detected: false })
    }
    return result
  }

  async loadFromDisk (): Promise<void> {
    const file = Bun.file(DATA_FILE)
    if (!(await file.exists())) return
    const snapshots: DeviceSnapshot[] = await file.json()
    for (const snapshot of snapshots) {
      this.knownSnapshots.set(snapshot.mac, snapshot)
      // Pre-populate routing table so identify/inspect can reach persisted devices
      if (snapshot.ip && snapshot.port) {
        this.knownDevices.set(snapshot.mac, { mac: snapshot.mac, ip: snapshot.ip, port: snapshot.port })
      }
    }
    process.stdout.write(`Loaded ${snapshots.length} known device(s) from disk\n`)
  }

  private scheduleSave (): void {
    if (this.saveTimer !== null) clearTimeout(this.saveTimer)
    this.saveTimer = setTimeout(() => {
      this.saveTimer = null
      void this.saveToDisk()
    }, 500)
  }

  private async saveToDisk (): Promise<void> {
    await mkdir('data', { recursive: true })
    const snapshots = Array.from(this.knownSnapshots.values())
    await Bun.write(DATA_FILE, JSON.stringify(snapshots, null, 2))
  }

  // ---------------------------------------------------------------------------
  // Product registry (optional vendor/lifx-products submodule)
  // ---------------------------------------------------------------------------

  async loadProducts (): Promise<void> {
    const file = Bun.file('vendor/lifx-products/products.json')
    if (await file.exists()) {
      this.productsDb = await file.json() as LifxVendor[]
      process.stdout.write(`Loaded LIFX product registry (${this.productsDb.length} vendors)\n`)
    }
  }

  lookupProduct (vendor: number, product: number): ProductInfo | undefined {
    if (!this.productsDb) return undefined
    const v = this.productsDb.find(e => e.vid === vendor)
    if (!v) return undefined
    const p = v.products.find(e => e.pid === product)
    if (!p) return undefined
    return { vendorName: v.name, productName: p.name, features: p.features }
  }

  // ---------------------------------------------------------------------------
  // Output bus — handlers call dispatch(); the WS router listens on 'dispatch'
  // ---------------------------------------------------------------------------

  dispatch (msg: ServerMessage): void {
    // Intercept device_field updates to keep the persistent snapshot current
    if (msg.type === 'device_field') {
      const existing = this.knownSnapshots.get(msg.mac) ?? { mac: msg.mac }
      this.knownSnapshots.set(msg.mac, { ...existing, [msg.update.field]: msg.update.value })
      this.scheduleSave()
    }
    this.emit('dispatch', msg)
  }
}
