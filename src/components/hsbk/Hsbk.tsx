import React, { useEffect, useRef, useState } from 'react'
import type { Lifx } from '../../types/lifx'
import useDeviceStore from '../../store/DeviceStore'
import HsbkChannel from './HsbkChannel'

interface Props {
  mac:    string
  color?: Lifx.Application.Hsbk
}

// Commanded state — null until the device gives us an initial value
interface Commanded {
  hue:        number
  saturation: number
  brightness: number
  kelvin:     number
}

export default function Hsbk ({ mac, color }: Props) {
  const setColor = useDeviceStore(s => s.setColor)
  const [commanded, setCommanded] = useState<Commanded | null>(null)
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Initialize commanded on first color arrival; ignore subsequent device updates
  useEffect(() => {
    if (color && commanded === null) {
      setCommanded({
        hue:        color.hue,
        saturation: color.saturation,
        brightness: color.brightness,
        kelvin:     color.kelvin,
      })
    }
  }, [color])

  function emitSetColor (next: Commanded) {
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      setColor(mac, next)
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
        reported={color?.hue ?? null}
        onChange={v => handleChange('hue', v)}
      />
      <HsbkChannel
        label="Saturation"
        min={0} max={1} step={0.001}
        commanded={commanded?.saturation ?? null}
        reported={color?.saturation ?? null}
        onChange={v => handleChange('saturation', v)}
      />
      <HsbkChannel
        label="Brightness"
        min={0} max={1} step={0.001}
        commanded={commanded?.brightness ?? null}
        reported={color?.brightness ?? null}
        onChange={v => handleChange('brightness', v)}
      />
      <HsbkChannel
        label="Kelvin"
        min={1500} max={9000} step={100}
        commanded={commanded?.kelvin ?? null}
        reported={color?.kelvin ?? null}
        onChange={v => handleChange('kelvin', v)}
      />
    </section>
  )
}
