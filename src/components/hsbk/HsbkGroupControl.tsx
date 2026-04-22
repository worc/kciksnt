import React, { useEffect, useRef, useState } from 'react'
import type { Lifx } from '../../types/lifx'
import useDeviceStore from '../../store/DeviceStore'
import HsbkChannel from './HsbkChannel'

interface Props {
  macs:          string[]
  initialColor?: Lifx.Application.Hsbk   // seed from first available device; null until one arrives
}

interface Commanded {
  hue:        number
  saturation: number
  brightness: number
  kelvin:     number
}

export default function HsbkGroupControl ({ macs, initialColor }: Props) {
  const setColor = useDeviceStore(s => s.setColor)
  const [commanded, setCommanded] = useState<Commanded | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize commanded on first color arrival; ignore subsequent device updates
  useEffect(() => {
    if (initialColor && commanded === null) {
      setCommanded({
        hue:        initialColor.hue,
        saturation: initialColor.saturation,
        brightness: initialColor.brightness,
        kelvin:     initialColor.kelvin,
      })
    }
  }, [initialColor])

  function emitSetColor (next: Commanded) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      for (const mac of macs) {
        setColor(mac, next)
      }
      debounceTimer.current = null
    }, 250)
  }

  function handleChange (field: keyof Commanded, value: number) {
    if (commanded === null) return
    const next = { ...commanded, [field]: value }
    setCommanded(next)
    emitSetColor(next)
  }

  return (
    <section>
      <HsbkChannel
        label="Hue"
        min={0} max={360} step={0.1}
        commanded={commanded?.hue ?? null}
        reported={null}
        onChange={v => handleChange('hue', v)}
      />
      <HsbkChannel
        label="Saturation"
        min={0} max={1} step={0.001}
        commanded={commanded?.saturation ?? null}
        reported={null}
        onChange={v => handleChange('saturation', v)}
      />
      <HsbkChannel
        label="Brightness"
        min={0} max={1} step={0.001}
        commanded={commanded?.brightness ?? null}
        reported={null}
        onChange={v => handleChange('brightness', v)}
      />
      <HsbkChannel
        label="Kelvin"
        min={1500} max={9000} step={100}
        commanded={commanded?.kelvin ?? null}
        reported={null}
        onChange={v => handleChange('kelvin', v)}
      />
    </section>
  )
}
