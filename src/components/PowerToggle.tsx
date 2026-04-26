import React, { useEffect, useState } from 'react'
import useDeviceStore from '../store/DeviceStore'

type PowerState = 'on' | 'off' | 'mixed' | 'unknown'

function computePowerState (
  devices: { mac: string; power?: { on: boolean } }[],
  macs: string[],
): PowerState {
  const powers = macs.map(mac => devices.find(d => d.mac === mac)?.power?.on)
  if (powers.some(p => p === undefined)) return 'unknown'
  if (powers.every(p => p === true))  return 'on'
  if (powers.every(p => p === false)) return 'off'
  return 'mixed'
}

interface Props {
  macs: string[]
}

export default function PowerToggle ({ macs }: Props) {
  const devices  = useDeviceStore(s => s.devices)
  const setPower = useDeviceStore(s => s.setPower)

  // null = idle; boolean = the target state we sent, waiting for confirmation
  const [pendingTarget, setPendingTarget] = useState<boolean | null>(null)
  const [fromLabel,     setFromLabel]     = useState<string>('')

  const powerState = computePowerState(devices, macs)

  // Clear pending once all devices reach the target state
  useEffect(() => {
    if (pendingTarget === null) return
    const resolved = pendingTarget ? powerState === 'on' : powerState === 'off'
    if (resolved) setPendingTarget(null)
  }, [powerState, pendingTarget])

  function handleToggle () {
    if (powerState === 'unknown') return
    // on → off, off → on, mixed → on (normalize to uniform state)
    const target = powerState === 'off' ? true : false
    setFromLabel(powerState === 'on' ? 'ON' : powerState === 'off' ? 'OFF' : 'MIXED')
    setPendingTarget(target)
    for (const mac of macs) {
      setPower(mac, target)
    }
  }

  let label: string
  if (pendingTarget !== null) {
    label = `${fromLabel} → ${pendingTarget ? 'ON' : 'OFF'}`
  } else {
    label = powerState === 'on' ? 'ON' : powerState === 'off' ? 'OFF' : powerState === 'mixed' ? 'MIXED' : '…'
  }

  return (
    <button onClick={handleToggle} disabled={powerState === 'unknown' || pendingTarget !== null}>
      {label}
    </button>
  )
}
