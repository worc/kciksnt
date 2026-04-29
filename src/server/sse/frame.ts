// ---------------------------------------------------------------------------
// SSE wire-format helpers — pure string transforms, no I/O.
// Spec: https://html.spec.whatwg.org/multipage/server-sent-events.html
// ---------------------------------------------------------------------------

interface EventFrame {
  id:    number
  event: string
  data:  string
}

export function formatEvent ({ id, event, data }: EventFrame): string {
  // Each line of `data` must carry its own `data:` prefix or the browser will
  // collapse newlines incorrectly. Most callers pass JSON (single line), but
  // honoring the spec keeps multiline payloads safe.
  const dataLines = data.split('\n').map(line => `data: ${line}`).join('\n')
  return `event: ${event}\nid: ${id}\n${dataLines}\n\n`
}

// SSE comments are lines starting with ":" — used here as nginx-friendly
// heartbeats. Browsers ignore them but the bytes keep the proxy from idling
// the connection out.
export function formatComment (text: string): string {
  return `: ${text}\n\n`
}
