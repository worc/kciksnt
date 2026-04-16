import { create } from 'zustand'
import { send, subscribe } from '../utils/useWebSocket'
import type { ClientMessage, DeviceSnapshot, DeviceFieldUpdate } from '../types/ws'

interface InspectTelemetry {
  clientSentAt:      number
  serverReceivedAt:  number
  serverRespondedAt: number
  clientReceivedAt:  number
}

interface DeviceStore {
  devices:           DeviceSnapshot[]
  inspecting:        Set<string>                    // MACs currently in flight
  inspectErrors:     Record<string, string>
  inspectTelemetry:  Record<string, InspectTelemetry>

  discover: () => void
  inspect:  (mac: string) => void
}

const useDeviceStore = create<DeviceStore>((set, get) => {

  // Subscribe once at store-creation time.  All incoming WS messages flow
  // through here; components read state via useDeviceStore().
  subscribe(msg => {

    if (msg.type === 'discovery_result') {
      set({ devices: msg.devices })
    }

    if (msg.type === 'device_field') {
      const { mac, update } = msg as { mac: string; update: DeviceFieldUpdate }
      set(state => ({
        devices: state.devices.map(d =>
          d.mac === mac
            ? { ...d, [update.field]: update.value } as DeviceSnapshot
            : d
        ),
      }))
    }

    if (msg.type === 'device_inspect_complete') {
      const { mac } = msg
      set(state => {
        const next: Partial<DeviceStore> = {
          inspecting: new Set([...state.inspecting].filter(m => m !== mac)),
        }
        const t = msg.timestamps
        if (
          t?.clientSentAt      != null &&
          t?.serverReceivedAt  != null &&
          t?.serverRespondedAt != null &&
          t?.clientReceivedAt  != null
        ) {
          next.inspectTelemetry = {
            ...state.inspectTelemetry,
            [mac]: {
              clientSentAt:      t.clientSentAt,
              serverReceivedAt:  t.serverReceivedAt,
              serverRespondedAt: t.serverRespondedAt,
              clientReceivedAt:  t.clientReceivedAt,
            },
          }
        }
        return next
      })
    }

    if (msg.type === 'device_inspect_error') {
      const { mac, error } = msg
      set(state => ({
        inspecting:    new Set([...state.inspecting].filter(m => m !== mac)),
        inspectErrors: { ...state.inspectErrors, [mac]: error },
      }))
    }

  })

  return {
    devices:          [],
    inspecting:       new Set(),
    inspectErrors:    {},
    inspectTelemetry: {},

    discover () {
      const message: ClientMessage = {
        type: 'discover',
        timestamps: { clientSentAt: Date.now() },
      }
      send(message)
    },

    inspect (mac: string) {
      // Prevent concurrent inspections of the same device
      if (get().inspecting.has(mac)) return

      // Ensure the device exists in the list so field merges have a target
      if (!get().devices.some(d => d.mac === mac)) {
        set(state => ({ devices: [...state.devices, { mac }] }))
      }

      // Clear any previous error and mark as in-progress
      set(state => ({
        inspecting:    new Set([...state.inspecting, mac]),
        inspectErrors: { ...state.inspectErrors, [mac]: '' },
      }))

      const message: ClientMessage = {
        type: 'inspect_device',
        mac,
        timestamps: { clientSentAt: Date.now() },
      }
      send(message)
    },
  }
})

export default useDeviceStore
export type { InspectTelemetry }
