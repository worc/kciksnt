import React, { useEffect } from 'react'
import { Link } from 'wouter'
import useDeviceStore from '../store/DeviceStore'

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
            <li key={device.mac}>
              <Link href={`/devices/${device.mac}`}>
                <code>{device.mac}</code>
              </Link>
              {device.ip && ` — ${device.ip}:${device.port}`}
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}
