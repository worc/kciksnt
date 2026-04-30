import { create } from 'zustand'
import { command, newCommandId, subscribe } from '../utils/useEventStream'
import type { DeviceSnapshot, DeviceFieldUpdate } from '../types/ws'
import type { DeviceStateCommand, DeviceStatePayload, DeviceActionCommand } from '../types/api'
import type { Lifx } from '../types/lifx'

interface InspectTelemetry {
  clientSentAt:      number
  serverReceivedAt:  number
  serverRespondedAt: number
  clientReceivedAt:  number
}

interface DeviceStore {
  devices:          DeviceSnapshot[]
  undetectedMacs:   Set<string>
  inspecting:       Set<string>
  inspectErrors:    Record<string, string>
  inspectTelemetry: Record<string, InspectTelemetry>
  duration:         number   // global transition duration in ms

  discover:    () => void
  identify:    (mac: string) => void
  inspect:     (mac: string) => void
  reinspect:   (mac: string) => void
  setColor:    (mac: string, hsbk: Lifx.Application.Hsbk, duration?: number) => void
  setPower:    (mac: string, on: boolean) => void
  setLabel:    (mac: string, label: string) => void
  setGroup:    (mac: string, label: string) => void
  setLocation: (mac: string, label: string) => void
  setDuration: (ms: number) => void
}

// Retry delays: fast attempts first, then once-per-minute
const RETRY_DELAYS = [2000, 5000, 15000, 60000]

// Module-level maps so timers survive re-renders
const retryTimers = new Map<string, ReturnType<typeof setTimeout>>()
const retryCounts = new Map<string, number>()

// ---------------------------------------------------------------------------
// Transport helpers — POST envelope + URL builders. All `send` calls live
// here so the store body stays focused on state shape.
// ---------------------------------------------------------------------------

function postState (mac: string, payload: DeviceStatePayload): void {
  const envelope: DeviceStateCommand = {
    commandId:    newCommandId(),
    clientSentAt: Date.now(),
    ...payload,
  }
  void command(`/devices/${mac}/state`, envelope)
}

function postAction (mac: string, action: 'identify' | 'inspect'): void {
  const envelope: DeviceActionCommand = {
    commandId:    newCommandId(),
    clientSentAt: Date.now(),
  }
  void command(`/devices/${mac}/${action}`, envelope)
}

const useDeviceStore = create<DeviceStore>((set, get) => {

  // ---------------------------------------------------------------------------
  // Internal helpers (closed over set/get)
  // ---------------------------------------------------------------------------

  function forceInspect (mac: string) {
    set(state => ({
      inspecting:    new Set([...state.inspecting, mac]),
      inspectErrors: { ...state.inspectErrors, [mac]: '' },
    }))
    postAction(mac, 'inspect')
  }

  function scheduleRetry (mac: string) {
    const count = retryCounts.get(mac) ?? 0
    const delay = RETRY_DELAYS[Math.min(count, RETRY_DELAYS.length - 1)]
    retryCounts.set(mac, count + 1)
    const timer = setTimeout(() => {
      retryTimers.delete(mac)
      forceInspect(mac)
    }, delay)
    retryTimers.set(mac, timer)
  }

  function cancelRetry (mac: string) {
    const timer = retryTimers.get(mac)
    if (timer !== undefined) {
      clearTimeout(timer)
      retryTimers.delete(mac)
    }
    retryCounts.delete(mac)
  }

  function identify (mac: string) {
    if (get().inspecting.has(mac)) return

    if (!get().devices.some(d => d.mac === mac)) {
      set(state => ({ devices: [...state.devices, { mac }] }))
    }

    set(state => ({
      inspecting:    new Set([...state.inspecting, mac]),
      inspectErrors: { ...state.inspectErrors, [mac]: '' },
    }))

    postAction(mac, 'identify')
  }

  // ---------------------------------------------------------------------------
  // Subscribe once at store-creation time
  // ---------------------------------------------------------------------------

  subscribe(msg => {

    if (msg.type === 'snapshot') {
      // Server's authoritative cache on (re)connect. Replaces local devices
      // wholesale — localStorage and stale state lose to the server here.
      // Snapshot carries no detected/undetected split; the next discover
      // run repopulates undetectedMacs.
      set({ devices: msg.devices, undetectedMacs: new Set() })
      return
    }

    if (msg.type === 'discovery_result') {
      const undetectedMacs = new Set(
        msg.devices.filter(d => d.detected === false).map(d => d.mac)
      )
      set({ devices: msg.devices, undetectedMacs })
      // Stagger identifies so we don't flood the network
      msg.devices.forEach((device, i) => {
        setTimeout(() => identify(device.mac), i * 150)
      })
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
      cancelRetry(mac)
      set(state => {
        const next: Partial<DeviceStore> = {
          inspecting: new Set([...state.inspecting].filter(m => m !== mac)),
        }
        const t = msg.timestamps
        // TODO: coerced inequality here?
        /* eslint-disable */
        if (
          t?.clientSentAt      != null &&
          t?.serverReceivedAt  != null &&
          t?.serverRespondedAt != null &&
          t?.clientReceivedAt  != null
        ) {
        /* eslint-enable */
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
      // Only auto-retry full inspect errors, not identify failures
      // We detect full inspect by checking if this device was inspected (not just identified).
      // Since we can't distinguish here, retry for 'unreachable' on any mac that had a full inspect.
      // The retryTimers map acts as the dedup guard — identify errors clear quickly anyway.
      if (error === 'unreachable' && !retryTimers.has(mac)) {
        scheduleRetry(mac)
      }
    }

  })

  // ---------------------------------------------------------------------------
  // Public actions
  // ---------------------------------------------------------------------------

  return {

    devices:          [],
    undetectedMacs:   new Set(),
    inspecting:       new Set(),
    inspectErrors:    {},
    inspectTelemetry: {},
    duration:         500,

    discover () {
      void command('/api/discover', {})
    },

    identify,

    inspect (mac: string) {
      if (get().inspecting.has(mac)) return

      if (!get().devices.some(d => d.mac === mac)) {
        set(state => ({ devices: [...state.devices, { mac }] }))
      }

      forceInspect(mac)
    },

    reinspect (mac: string) {
      cancelRetry(mac)
      // Clear HSBK-sensitive fields so controls reset to uninitialized
      set(state => ({
        devices: state.devices.map(d =>
          d.mac === mac ? { ...d, color: undefined, power: undefined } : d
        ),
      }))
      forceInspect(mac)
    },

    setColor (mac: string, hsbk: Lifx.Application.Hsbk, duration?: number) {
      postState(mac, { field: 'color', value: hsbk, duration: duration ?? get().duration })
    },

    setPower (mac: string, on: boolean) {
      postState(mac, { field: 'power', value: on, duration: get().duration })
    },

    setLabel (mac: string, label: string) {
      postState(mac, { field: 'label', value: label })
    },

    setGroup (mac: string, label: string) {
      postState(mac, { field: 'group', value: label })
    },

    setLocation (mac: string, label: string) {
      postState(mac, { field: 'location', value: label })
    },

    setDuration (ms: number) {
      set({ duration: ms })
    },
  }
})

export default useDeviceStore
export type { InspectTelemetry }
