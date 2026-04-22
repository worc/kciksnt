import type { LifxSocket } from '../udp/udpSocket'
import type { DiscoveredDevice } from '../types/api'
import { parseMessage } from '../messages/parseMessage'
import type { ParsedMessage } from '../messages/parseMessage'

// ---------------------------------------------------------------------------
// Single request → single response, with per-call listener registration.
// Using on/off (rather than a single shared handler) means concurrent calls
// don't trample each other.
// ---------------------------------------------------------------------------

export function requestResponse <T extends number>(
  udp: LifxSocket,
  device: DiscoveredDevice,
  message: Uint8Array,
  expectedType: T,
  timeoutMs = 2000,
): Promise<ParsedMessage & { type: T }> {
  return new Promise((resolve, reject) => {
    function handler (data: Buffer, _port: number, address: string) {
      if (address !== device.ip || data.byteLength < 36) return
      const msg = parseMessage(new Uint8Array(data.buffer, data.byteOffset, data.byteLength))
      if (msg.type === expectedType) {
        clearTimeout(timer)
        udp.off('message', handler)
        resolve(msg as ParsedMessage & { type: T })
      }
    }

    const timer = setTimeout(() => {
      udp.off('message', handler)
      reject(new Error(`Timeout waiting for type ${expectedType} from ${device.ip}`))
    }, timeoutMs)

    udp.on('message', handler)
    udp.send(message, device.ip, device.port)
  })
}

// ---------------------------------------------------------------------------
// Convenience wrapper: wraps requestResponse in a try/catch and logs errors.
// Returns a no-op if the query times out so handlers can continue the sequence.
// ---------------------------------------------------------------------------

export function makeTryQuery (
  udp: LifxSocket,
  device: DiscoveredDevice,
  logPrefix: string,
) {
  return async function tryQuery <T extends number>(
    message: Uint8Array,
    expectedType: T,
    handler: (msg: ParsedMessage & { type: T }) => void,
  ): Promise<void> {
    try {
      const msg = await requestResponse(udp, device, message, expectedType)
      if (msg.type === expectedType) handler(msg as ParsedMessage & { type: T })
    } catch (e) {
      process.stderr.write(`${logPrefix}: ${e}\n`)
    }
  }
}
