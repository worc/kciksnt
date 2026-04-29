import { describe, it, expect } from 'bun:test'
import { formatEvent, formatComment } from './frame'

describe('formatEvent', () => {
  it('produces the standard event: / id: / data: triplet terminated by a blank line', () => {
    const frame = formatEvent({ id: 42, event: 'device_field', data: '{"mac":"d073d5"}' })
    expect(frame).toBe('event: device_field\nid: 42\ndata: {"mac":"d073d5"}\n\n')
  })

  it('prefixes each line of multi-line data with its own data: marker', () => {
    const frame = formatEvent({ id: 1, event: 'snapshot', data: 'line one\nline two\nline three' })
    expect(frame).toBe('event: snapshot\nid: 1\ndata: line one\ndata: line two\ndata: line three\n\n')
  })

  it('emits a single empty data line when data is the empty string', () => {
    const frame = formatEvent({ id: 7, event: 'noop', data: '' })
    expect(frame).toBe('event: noop\nid: 7\ndata: \n\n')
  })

  it('handles id zero (initial event before any state changes)', () => {
    const frame = formatEvent({ id: 0, event: 'snapshot', data: '{}' })
    expect(frame).toBe('event: snapshot\nid: 0\ndata: {}\n\n')
  })
})

describe('formatComment', () => {
  it('produces a colon-prefixed line terminated by a blank line', () => {
    expect(formatComment('hb')).toBe(': hb\n\n')
  })
})
