import { encodeHeader } from './header'

const TARGET_ALL = '000000000000'

interface BuildOpts {
  res_required?: boolean
  ack_required?: boolean
  sequence?: number
  source?: number
}

export function buildMessage(
  type: number,
  target = TARGET_ALL,
  payload?: Uint8Array,
  opts: BuildOpts = {}
): Uint8Array {
  const payloadBytes = payload ?? new Uint8Array(0)
  const size = 36 + payloadBytes.length

  const header = encodeHeader({
    frameHeader: {
      size,
      protocol: 1024,
      addressable: true,
      tagged: target === TARGET_ALL,
      origin: 0,
      source: opts.source ?? 1,
    },
    frameAddress: {
      target,
      res_required: opts.res_required ?? false,
      ack_required: opts.ack_required ?? false,
      sequence: opts.sequence ?? 1,
    },
    protocolHeader: { type },
  })

  const message = new Uint8Array(size)
  message.set(header, 0)
  if (payloadBytes.length > 0) message.set(payloadBytes, 36)
  return message
}
