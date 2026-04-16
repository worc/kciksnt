import React from 'react'
import { Switch, Route } from 'wouter'
import DiscoveredDevices from './components/DiscoveredDevices'
import Device from './components/Device'

function Home () {
  return (
    <main>
      <h1>LIFX Control</h1>
      <DiscoveredDevices />
    </main>
  )
}

export default function App () {
  return (
    <Switch>
      <Route path="/devices/:mac" component={({ params }) => <Device mac={params.mac} />} />
      <Route component={Home} />
    </Switch>
  )
}
