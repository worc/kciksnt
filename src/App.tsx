import React from 'react'
import { Switch, Route } from 'wouter'
import DiscoveredDevices from './components/DiscoveredDevices'
import Device from './components/Device'
import GroupView from './components/GroupView'

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
      <Route path="/devices/:mac"     component={({ params }) => <Device mac={params.mac} />} />
      <Route path="/locations/:label" component={({ params }) => <GroupView field="location" label={decodeURIComponent(params.label)} />} />
      <Route path="/groups/:label"    component={({ params }) => <GroupView field="group"    label={decodeURIComponent(params.label)} />} />
      <Route component={Home} />
    </Switch>
  )
}
