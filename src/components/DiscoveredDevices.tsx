import React, { useEffect } from 'react'
import styled from 'styled-components'
import { Link } from 'wouter'
import useDeviceStore from '../store/DeviceStore'

const DeviceListItem = styled.li`
  display: flex;
  flex-flow: row nowrap;
  gap: 4px;
`

export default function DiscoveredDevices () {
  const { devices, undetectedMacs, discover } = useDeviceStore()

  // initial discover
  useEffect(() => {
    discover()
  }, [])

  // Collect distinct non-empty location and group labels
  const locations = [...new Set(devices.map(d => d.location).filter(Boolean) as string[])]
  const groups    = [...new Set(devices.map(d => d.group).filter(Boolean)    as string[])]

  return (
    <section>
      <button onClick={discover}>
        Discover devices
      </button>

      {devices.length === 0 ? (
        <div>No devices found.</div>
      ) : (
        <>
          {locations.length > 0 && (
            <div>
              <strong>Locations: </strong>
              {locations.map((loc, i) => (
                <span key={loc}>
                  {i > 0 && ' · '}
                  <Link href={`/locations/${encodeURIComponent(loc)}`}>{loc}</Link>
                </span>
              ))}
            </div>
          )}

          {groups.length > 0 && (
            <div>
              <strong>Groups: </strong>
              {groups.map((grp, i) => (
                <span key={grp}>
                  {i > 0 && ' · '}
                  <Link href={`/groups/${encodeURIComponent(grp)}`}>{grp}</Link>
                </span>
              ))}
            </div>
          )}

          <div>
            <strong>Devices: </strong>
            <ul>
              {devices.map(device => (
                <DeviceListItem key={device.mac}>
                  {device.location && (
                    <Link href={`/locations/${encodeURIComponent(device.location)}`}>
                      {device.location}
                    </Link>
                  )}
                  {device.location && device.group && ' · '}
                  {device.group && (
                    <Link href={`/groups/${encodeURIComponent(device.group)}`}>
                      {device.group}
                    </Link>
                  )}
                  {(device.location || device.group) && ' · '}
                  <span>{device.label || <em>unnamed</em>} —</span>
                  <Link href={`/devices/${device.mac}`}>
                    <code>{device.mac}</code>
                  </Link>
                  {device.ip && ` — ${device.ip}:${device.port}`}
                  {undetectedMacs.has(device.mac) && <em> (offline)</em>}
                </DeviceListItem>
              ))}
            </ul>
          </div>
        </>
      )}
    </section>
  )
}
