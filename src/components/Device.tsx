import React, { useEffect, useRef, useState } from 'react'
import { Link } from 'wouter'
import useDeviceStore from '../store/DeviceStore'
import type { DeviceSnapshot } from '../types/ws'
import type { InspectTelemetry } from '../store/DeviceStore'

import Hsbk from './hsbk/Hsbk'
import PowerToggle from './PowerToggle'

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
// Sub-renderers
// ---------------------------------------------------------------------------

function Pending () {
  return <span aria-busy="true">…</span>
}

function ColorRow ({ color }: { color: NonNullable<DeviceSnapshot['color']> }) {
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

interface EditableFieldProps {
  value?: string
  onCommit: (next: string) => void
}

function EditableField ({ value, onCommit }: EditableFieldProps) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  function startEdit () {
    setDraft(value ?? '')
    setEditing(true)
    setTimeout(() => inputRef.current?.select(), 0)
  }

  function commit () {
    const trimmed = draft.trim()
    if (trimmed !== (value ?? '')) onCommit(trimmed)
    setEditing(false)
  }

  function handleKeyDown (e: React.KeyboardEvent) {
    if (e.key === 'Enter') commit()
    if (e.key === 'Escape') setEditing(false)
  }

  if (!editing) {
    return (
      <>
        {value !== undefined ? (value || <em>none</em>) : <Pending />}
        {value !== undefined && (
          <button onClick={startEdit} style={{ marginLeft: '0.5em', fontSize: '0.8em' }}>
            edit
          </button>
        )}
      </>
    )
  }

  return (
    <>
      <input
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={handleKeyDown}
        style={{ marginRight: '0.25em' }}
      />
      <button onClick={commit}>save</button>
      <button onClick={() => setEditing(false)} style={{ marginLeft: '0.25em' }}>cancel</button>
    </>
  )
}

function Telemetry ({ t }: { t: InspectTelemetry }) {
  const clientToServer   = t.serverReceivedAt  - t.clientSentAt
  const serverQueryTime  = t.serverRespondedAt - t.serverReceivedAt
  const serverToClient   = t.clientReceivedAt  - t.serverRespondedAt
  const fullRtt          = t.clientReceivedAt  - t.clientSentAt

  return (
    <p>
      Inspect RTT {fullRtt}ms
      {' ('}↑{clientToServer}ms · queries {serverQueryTime}ms · ↓{serverToClient}ms{')'}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props { mac: string }

export default function Device ({ mac }: Props) {
  const { devices, undetectedMacs, inspecting, inspectErrors, inspectTelemetry, inspect, reinspect, setLabel, setGroup, setLocation } = useDeviceStore()
  const [reinspectCount, setReinspectCount] = useState(0)
  const [snapshot, setSnapshot] = useState({})

  // const snapshot  = devices.find(d => d.mac === mac)
  const loading    = inspecting.has(mac)
  const error      = inspectErrors[mac]
  const telemetry  = inspectTelemetry[mac]
  const isOffline  = undetectedMacs.has(mac)

  useEffect(() => {
    inspect(mac)
  }, [mac])

  useEffect(() => {
    setSnapshot(devices.find(d => d.mac === mac))
  }, [devices])

  function handleReinspect () {
    reinspect(mac)
    setReinspectCount(n => n + 1)
  }

  return (
    <main>
      <nav><Link href="/">← All devices</Link></nav>

      <h1>{snapshot?.label ?? mac}</h1>
      <p>
        <code>{mac}</code>
        {loading
          ? ' · loading…'
          : error
            ? ` · error: ${error}`
            : isOffline
              ? ' · offline — showing cached data'
              : ' · fully loaded'}
        {!loading && <> · <button onClick={handleReinspect}>re-inspect</button></>}
      </p>
      {isOffline && !loading && !error && (
        <p><em>This device was not seen in the last discovery run. Data shown is from a previous session. Use re-inspect to attempt contact.</em></p>
      )}

      {telemetry && <Telemetry t={telemetry} />}

      <table>
        <tbody>

          {/* Light state */}
          <tr>
            <th scope="row">Power</th>
            <td><PowerToggle macs={[mac]} /></td>
          </tr>
          <tr>
            <th scope="row">Color</th>
            <td>{snapshot?.color ? <ColorRow color={snapshot.color} /> : <Pending />}</td>
          </tr>

          {/* Identity */}
          <tr>
            <th scope="row">Label</th>
            <td><EditableField value={snapshot?.label} onCommit={v => setLabel(mac, v)} /></td>
          </tr>
          <tr>
            <th scope="row">Group</th>
            <td><EditableField value={snapshot?.group} onCommit={v => setGroup(mac, v)} /></td>
          </tr>
          <tr>
            <th scope="row">Location</th>
            <td><EditableField value={snapshot?.location} onCommit={v => setLocation(mac, v)} /></td>
          </tr>

          {/* Hardware */}
          <tr>
            <th scope="row">Product</th>
            <td>{snapshot?.version ? <VersionRow version={snapshot.version} /> : <Pending />}</td>
          </tr>
          {snapshot?.version && <FeaturesRow features={snapshot.version.features} />}

          {/* Firmware */}
          <tr>
            <th scope="row">Firmware</th>
            <td>
              {snapshot?.firmware
                ? `v${snapshot.firmware.version_major}.${snapshot.firmware.version_minor} (build ${snapshot.firmware.build})`
                : <Pending />}
            </td>
          </tr>

          {/* Network */}
          <tr>
            <th scope="row">Wifi</th>
            <td>
              {snapshot?.wifi
                ? `${snapshot.wifi.quality} · RSSI ${snapshot.wifi.rssi} dBm`
                : <Pending />}
            </td>
          </tr>

          {/* Device clock / uptime */}
          <tr>
            <th scope="row">Uptime</th>
            <td>{snapshot?.info ? nsToHuman(snapshot.info.uptime_ns) : <Pending />}</td>
          </tr>
          <tr>
            <th scope="row">Device time</th>
            <td>{snapshot?.info ? nsToDate(snapshot.info.time) : <Pending />}</td>
          </tr>
          <tr>
            <th scope="row">Last downtime</th>
            <td>{snapshot?.info ? nsToHuman(snapshot.info.downtime_ns) : <Pending />}</td>
          </tr>

        </tbody>
      </table>
      <hr/>
      <Hsbk key={reinspectCount} mac={mac} color={snapshot?.color} />
    </main>
  )
}
