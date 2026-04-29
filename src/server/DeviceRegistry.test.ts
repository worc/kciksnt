import { describe, it, expect, spyOn } from 'bun:test'
import { DeviceRegistry } from './DeviceRegistry'

spyOn(Bun, 'write').mockResolvedValue(0 as never)

describe('DeviceRegistry.getAllSnapshots', () => {
  it('returns an empty array when nothing has been seen', () => {
    const registry = new DeviceRegistry()
    expect(registry.getAllSnapshots()).toEqual([])
  })

  it('returns one snapshot per known device, with ip/port from setDevice', () => {
    const registry = new DeviceRegistry()
    registry.setDevice('d073d5000001', { mac: 'd073d5000001', ip: '192.168.1.10', port: 56700 })
    registry.setDevice('d073d5000002', { mac: 'd073d5000002', ip: '192.168.1.11', port: 56700 })

    const snapshots = registry.getAllSnapshots()
    expect(snapshots).toHaveLength(2)
    expect(snapshots).toEqual(expect.arrayContaining([
      { mac: 'd073d5000001', ip: '192.168.1.10', port: 56700 },
      { mac: 'd073d5000002', ip: '192.168.1.11', port: 56700 },
    ]))
  })

  it('reflects accumulated device_field updates in each snapshot', () => {
    const registry = new DeviceRegistry()
    registry.setDevice('d073d5000003', { mac: 'd073d5000003', ip: '192.168.1.12', port: 56700 })
    registry.dispatch({
      type:       'device_field',
      mac:        'd073d5000003',
      update:     { field: 'label', value: 'Hallway' },
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })
    registry.dispatch({
      type:       'device_field',
      mac:        'd073d5000003',
      update:     { field: 'power', value: { level: 65535, on: true } },
      timestamps: { clientSentAt: 0, serverReceivedAt: 0, serverRespondedAt: 0 },
    })

    const [snapshot] = registry.getAllSnapshots()
    expect(snapshot).toEqual({
      mac:   'd073d5000003',
      ip:    '192.168.1.12',
      port:  56700,
      label: 'Hallway',
      power: { level: 65535, on: true },
    })
  })
})
