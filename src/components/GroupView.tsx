import React, { useEffect } from 'react'
import { Link } from 'wouter'
import useDeviceStore from '../store/DeviceStore'
import HsbkGroupControl from './hsbk/HsbkGroupControl'
import PowerToggle from './PowerToggle'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function pct (n: number) { return `${(n * 100).toFixed(0)}%` }
function deg (n: number) { return `${n.toFixed(0)}°` }

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

interface Props {
  field: 'group' | 'location'
  label: string
}

export default function GroupView ({ field, label }: Props) {
  const { devices, inspect } = useDeviceStore()

  const groupDevices = devices.filter(d => d[field] === label)
  const macs         = groupDevices.map(d => d.mac)
  const initialColor = groupDevices.find(d => d.color)?.color

  // Trigger full inspects so we have color + power data for each device in the group.
  // Staggered to avoid flooding. Re-runs when the device list for this group changes
  // (e.g. a device is added or renamed into/out of the group).
  useEffect(() => {
    const macString = macs.join(',')
    // store in a local so the cleanup closure has the right timers
    const timers: ReturnType<typeof setTimeout>[] = []
    macs.forEach((mac, i) => {
      timers.push(setTimeout(() => inspect(mac), i * 100))
    })
    return () => { timers.forEach(clearTimeout) }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [macs.join(',')])

  const title = field === 'location' ? `Location: ${label}` : `Group: ${label}`

  return (
    <main>
      <nav><Link href="/">← All devices</Link></nav>

      <h1>{title}</h1>
      <p>
        {groupDevices.length} device{groupDevices.length !== 1 ? 's' : ''}
        {' · '}
        <PowerToggle macs={macs} />
      </p>

      <HsbkGroupControl macs={macs} initialColor={initialColor} />

      <table>
        <thead>
          <tr>
            <th scope="col">Device</th>
            <th scope="col">Power</th>
            <th scope="col">Color</th>
          </tr>
        </thead>
        <tbody>
          {groupDevices.map(device => (
            <tr key={device.mac}>
              <td>
                <Link href={`/devices/${device.mac}`}>
                  {device.label || <code>{device.mac}</code>}
                </Link>
              </td>
              <td><PowerToggle macs={[device.mac]} /></td>
              <td>
                {device.color
                  ? `${deg(device.color.hue)} · ${pct(device.color.saturation)} sat · ${pct(device.color.brightness)} · ${device.color.kelvin}K`
                  : <span aria-busy="true">…</span>}
              </td>
            </tr>
          ))}
          {groupDevices.length === 0 && (
            <tr>
              <td colSpan={3}>No devices found in this {field}.</td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  )
}
