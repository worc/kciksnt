import { EventEmitter } from 'node:events'
import type { DiscoveredDevice } from '../types/api'
import type { ServerMessage } from '../types/ws'

interface LifxProductFeatures { [key: string]: boolean | number | null }
interface LifxProduct { pid: number; name: string; features: LifxProductFeatures }
interface LifxVendor  { vid: number; name: string; products: LifxProduct[] }

export interface ProductInfo {
  vendorName:  string
  productName: string
  features:    LifxProductFeatures
}

export class DeviceRegistry extends EventEmitter {
  private readonly knownDevices = new Map<string, DiscoveredDevice>()
  private productsDb: LifxVendor[] | null = null

  // ---------------------------------------------------------------------------
  // Device routing table
  // ---------------------------------------------------------------------------

  setDevice (mac: string, device: DiscoveredDevice): void {
    this.knownDevices.set(mac, device)
  }

  getDevice (mac: string): DiscoveredDevice | undefined {
    return this.knownDevices.get(mac)
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
    this.emit('dispatch', msg)
  }
}
