import React from 'react'
import type { DiscoveredDevice } from '../types/api'

export interface DiscoveryTimestamps {
  clientSentAt: number
  serverReceivedAt: number
  serverRespondedAt: number
  clientReceivedAt: number
}

export interface DiscoveryState {
  devices: DiscoveredDevice[]
  timestamps: DiscoveryTimestamps | null
  pending: boolean
}

function Telemetry ({ t }: { t: DiscoveryTimestamps }) {
  const clientToServer   = t.serverReceivedAt  - t.clientSentAt
  const serverDiscovery  = t.serverRespondedAt - t.serverReceivedAt
  const serverToClient   = t.clientReceivedAt  - t.serverRespondedAt
  const fullRtt          = t.clientReceivedAt  - t.clientSentAt

  const updatedAt = new Date(t.clientReceivedAt).toLocaleTimeString()

  return (
    <p>
      <time dateTime={new Date(t.clientReceivedAt).toISOString()}>
        Last updated: {updatedAt}
      </time>
      {' · '}
      RTT {fullRtt}ms
      {' ('}↑{clientToServer}ms · discovery {serverDiscovery}ms · ↓{serverToClient}ms{')'}
    </p>
  )
}

export default function DiscoveredDevices ({ state }: { state: DiscoveryState }) {
  if (!state.timestamps && !state.pending) {
    return <p>No discovery requested yet.</p>
  }

  if (state.pending && !state.timestamps) {
    return <p>Discovering…</p>
  }

  return (
    <section>
      {state.timestamps && <Telemetry t={state.timestamps} />}
      {state.pending && <p>Discovering…</p>}

      {state.devices.length === 0 ? (
        <p>No devices found.</p>
      ) : (
        <ul>
          {state.devices.map(device => (
            <li key={device.mac}>
              <code>{device.mac}</code> — {device.ip}:{device.port}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
