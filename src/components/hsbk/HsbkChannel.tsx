import React from 'react'

interface Props {
  label:      string
  min:        number
  max:        number
  step:       number
  commanded:  number | null   // active control; null = not yet initialized
  reported:   number | null   // last known device value; null = not yet known
  onChange:   (value: number) => void
}

export default function HsbkChannel ({ label, min, max, step, commanded, reported, onChange }: Props) {
  const initialized = commanded !== null

  return (
    <div>
      <label>{label}</label>

      {/* Commanded (active) — disabled until we have an initial value from the device */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={commanded ?? min}
        disabled={!initialized}
        onChange={e => onChange(Number(e.target.value))}
      />
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={commanded ?? ''}
        disabled={!initialized}
        onChange={e => onChange(Number(e.target.value))}
      />

      {/* Reported (ghost) — always disabled, mirrors last known device state */}
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={reported ?? min}
        disabled
        readOnly
        aria-label={`${label} reported`}
      />
    </div>
  )
}
