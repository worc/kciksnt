import React, { useEffect, useState } from 'react'
import { Link } from 'wouter'
import type { ClientMessage, ServerMessage, DeviceSnapshot, DeviceFieldUpdate } from '../types/ws'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function nsToHuman (nsStr: string): string {
  const ns = BigInt(nsStr)
  const s  = Number(ns / 1_000_000_000n)
  const m  = Math.floor(s / 60)
  const h  = Math.floor(m / 60)
  const d  = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h ${m % 60}m`
  if (h > 0) return `${h}h ${m % 60}m ${s % 60}s`
  if (m > 0) return `${m}m ${s % 60}s`
  return `${s}s`
}

function nsToDate (nsStr: string): string {
  const ms = Number(BigInt(nsStr) / 1_000_000n)
  return new Date(ms).toLocaleString()
}

function pct (n: number) { return `${(n * 100).toFixed(1)}%` }
function deg (n: number) { return `${n.toFixed(1)}°` }

// ---------------------------------------------------------------------------
// Sub-renderers for individual fields
// ---------------------------------------------------------------------------

function ColorRow ({ color }: { color: NonNullable<DeviceSnapshot['color']> }) {
  // if (color.saturation < 0.01) {
  //   return <>{color.kelvin}K · brightness {pct(color.brightness)}</>
  // }
  return <>hue {deg(color.hue)} · sat {pct(color.saturation)} · brightness {pct(color.brightness)} · {color.kelvin}K</>
}

function VersionRow ({ version }: { version: NonNullable<DeviceSnapshot['version']> }) {
  if (version.productName) {
    return <>{version.productName} ({version.vendorName ?? `vendor ${version.vendor}`} · pid {version.product})</>
  }
  return <>vendor {version.vendor} · product {version.product}</>
}

function FeaturesRow ({ features }: { features: NonNullable<DeviceSnapshot['version']>['features'] }) {
  if (!features) return null
  const entries = Object.entries(features).filter(([, v]) => v)
  if (entries.length === 0) return null
  return (
    <tr>
      <th scope="row">Capabilities</th>
      <td>{entries.map(([k]) => k).join(', ')}</td>
    </tr>
  )
}

// A placeholder shown while a field hasn't arrived yet
function Pending () {
  return <span aria-busy="true">…</span>
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props { mac: string }

export default function Device ({ mac }: Props) {
  const [snapshot, setSnapshot] = useState<DeviceSnapshot>({ mac })
  const [complete, setComplete] = useState(false)
  const [error, setError]       = useState<string | null>(null)

  useEffect(() => {
    const ws = new WebSocket(`ws://${window.location.host}/ws`)

    ws.onopen = () => {
      const msg: ClientMessage = { type: 'inspect_device', mac, sentAt: Date.now() }
      ws.send(JSON.stringify(msg))
    }

    ws.onmessage = (event: MessageEvent) => {
      let msg: ServerMessage
      try {
        msg = JSON.parse(event.data as string) as ServerMessage
      } catch {
        return
      }

      if (msg.type === 'device_field' && msg.mac === mac) {
        const update = msg.update as DeviceFieldUpdate
        setSnapshot(prev => ({ ...prev, [update.field]: update.value }))
      }

      if (msg.type === 'device_inspect_complete' && msg.mac === mac) {
        setComplete(true)
      }

      if (msg.type === 'device_inspect_error' && msg.mac === mac) {
        setError(msg.error)
      }
    }

    return () => ws.close()
  }, [mac])

  return (
    <main>
      <nav><Link href="/">← All devices</Link></nav>

      <h1>{snapshot.label ?? mac}</h1>
      <p>
        <code>{mac}</code>
        {complete ? ' · fully loaded' : error ? ` · error: ${error}` : ' · loading…'}
      </p>

      <table>
        <tbody>

          {/* Light state */}
          <tr>
            <th scope="row">Power</th>
            <td>{snapshot.power ? (snapshot.power.on ? 'On' : 'Off') : <Pending />}</td>
          </tr>
          <tr>
            <th scope="row">Color</th>
            <td>{snapshot.color ? <ColorRow color={snapshot.color} /> : <Pending />}</td>
          </tr>

          {/* Identity */}
          <tr>
            <th scope="row">Label</th>
            <td>{snapshot.label ?? <Pending />}</td>
          </tr>
          <tr>
            <th scope="row">Group</th>
            <td>{snapshot.group ?? <Pending />}</td>
          </tr>
          <tr>
            <th scope="row">Location</th>
            <td>{snapshot.location ?? <Pending />}</td>
          </tr>

          {/* Hardware */}
          <tr>
            <th scope="row">Product</th>
            <td>{snapshot.version ? <VersionRow version={snapshot.version} /> : <Pending />}</td>
          </tr>
          {snapshot.version && <FeaturesRow features={snapshot.version.features} />}

          {/* Firmware */}
          <tr>
            <th scope="row">Firmware</th>
            <td>
              {snapshot.firmware
                ? `v${snapshot.firmware.version_major}.${snapshot.firmware.version_minor} (build ${snapshot.firmware.build})`
                : <Pending />}
            </td>
          </tr>

          {/* Network */}
          <tr>
            <th scope="row">Wifi</th>
            <td>
              {snapshot.wifi
                ? `${snapshot.wifi.quality} · RSSI ${snapshot.wifi.rssi} dBm`
                : <Pending />}
            </td>
          </tr>

          {/* Device clock / uptime */}
          <tr>
            <th scope="row">Uptime</th>
            <td>{snapshot.info ? nsToHuman(snapshot.info.uptime_ns) : <Pending />}</td>
          </tr>
          <tr>
            <th scope="row">Device time</th>
            <td>{snapshot.info ? nsToDate(snapshot.info.time) : <Pending />}</td>
          </tr>
          <tr>
            <th scope="row">Last downtime</th>
            <td>{snapshot.info ? nsToHuman(snapshot.info.downtime_ns) : <Pending />}</td>
          </tr>

        </tbody>
      </table>
    </main>
  )
}
