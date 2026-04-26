import React from 'react'
import styled from 'styled-components'
import useDeviceStore from '../store/DeviceStore'

const Bar = styled.div`
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 6px 16px;
  background: #f4f4f4;
  border-top: 1px solid #ddd;
  font-size: 0.85em;
`

function formatDuration (ms: number): string {
  if (ms === 0) return 'instant'
  if (ms < 1000) return `${ms}ms`
  return `${(ms / 1000).toFixed(1)}s`
}

export default function GlobalTransitionDuration () {
  const { duration, setDuration } = useDeviceStore()

  return (
    <Bar>
      <span>Transition: <strong>{formatDuration(duration)}</strong></span>
      <input
        type="range"
        min={0}
        max={5000}
        step={50}
        value={duration}
        onChange={e => setDuration(Number(e.target.value))}
        style={{ width: '200px' }}
      />
    </Bar>
  )
}
