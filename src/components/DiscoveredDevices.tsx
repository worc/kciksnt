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
  const { devices, discover } = useDeviceStore()

  // initial discover
  useEffect(() => {
    discover()
  }, [])

  return (
    <section>
      <button onClick={discover}>
        Discover devices
      </button>

      {devices.length === 0 ? (
        <p>No devices found.</p>
      ) : (
        <ul>
          {devices.map(device => (
            <DeviceListItem key={device.mac}>
              <span>{ device.location } · {device.group } · { device.label } —</span>
              <Link href={`/devices/${device.mac}`}>
                <code>{device.mac}</code>
              </Link>
              {device.ip && ` — ${device.ip}:${device.port}`}
            </DeviceListItem>
          ))}
        </ul>
      )}
    </section>
  )
}
