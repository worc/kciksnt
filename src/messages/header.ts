import { Lifx } from '../types/lifx'
import {
  asUint8,
  asUint16,
  asUint32,
} from '../types/uint'

export function prepareFrameHeader (frameHeader: Lifx.Application.FrameHeader): Lifx.OverWire.FrameHeader {
  return {
    size: asUint16(frameHeader.size),
    protocol: asUint16(frameHeader.protocol),
    addressable: 0b1,
    tagged: (frameHeader.tagged ? 0b1 : 0b0),
    origin: asUint8(frameHeader.origin),
    source: asUint32(frameHeader.source),
  }
}

export function prepareFrameAddress (frameAddress: Lifx.Application.FrameAddress): Lifx.OverWire.FrameAddress {
  const deviceIdByteArray = new Uint8Array(6)
  const deviceIdView = new DataView(deviceIdByteArray.buffer)
  const deviceId = Uint8Array.fromHex(frameAddress.target)
  for (const [index, byte] of deviceId.entries()) {
    deviceIdView.setUint8(index, byte)
  }

  return {
    target: deviceIdByteArray,
    res_required: frameAddress.res_required ? 0b1 : 0b0,
    ack_required: frameAddress.ack_required ? 0b1 : 0b0,
    sequence: asUint8(frameAddress.sequence),
  }
}

export function prepareProtocolHeader (protocolHeader: Lifx.Application.ProtocolHeader): Lifx.OverWire.ProtocolHeader {
  return {
    type: asUint16(protocolHeader.type)
  }
}

interface Options {
  frameHeader: Lifx.Application.FrameHeader
  frameAddress: Lifx.Application.FrameAddress
  protocolHeader: Lifx.Application.ProtocolHeader
}
export function encodeHeader (options: Options): Lifx.OverWire.Header {
  const owFrameHeader = prepareFrameHeader(options.frameHeader)
  const owFrameAddress = prepareFrameAddress(options.frameAddress)
  const owProtocolHeader = prepareProtocolHeader(options.protocolHeader)

  const header = new Uint8Array(36)
  const view = new DataView(header.buffer)

  // FrameHeader, bytes 0-7
  view.setUint16(0, owFrameHeader.size, true)
  let protocol = owFrameHeader.protocol // fixed value
  protocol = asUint16(protocol | (owFrameHeader.addressable << 12)) // "addressable", always true
  protocol = asUint16(protocol | (owFrameHeader.tagged << 13))
  // protocol = asUint16(protocol | (owFrameHeader.origin << 14)) // no-op on byte 3, bits 6 and 7, as "origin" is always zero
  view.setUint16(2, protocol, true)
  view.setUint32(4, owFrameHeader.source, true)

  // FrameAddress, bytes 8-23
  for (const [index, byte] of owFrameAddress.target.entries()) {
    view.setUint8(8 + index, byte)
  }
  let resAckByte = 0
  resAckByte |= owFrameAddress.res_required       // bit 0
  resAckByte |= owFrameAddress.ack_required << 1  // bit 1
  view.setUint8(22, resAckByte)
  view.setUint8(23, owFrameAddress.sequence)

  // ProtocolHeader, bytes 32-33
  view.setUint16(32, owProtocolHeader.type, true)

  return header
}

export function decodeHeader(header: Lifx.OverWire.Header): {
  frameHeader: Lifx.Application.FrameHeader
  frameAddress: Lifx.Application.FrameAddress
  protocolHeader: Lifx.Application.ProtocolHeader
} {
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength)

  const size = view.getUint16(0, true)
  const protocolFlags = view.getUint16(2, true)
  const protocol = protocolFlags & 0x0FFF
  const tagged = Boolean((protocolFlags >> 13) & 0x1)
  const source = view.getUint32(4, true)

  const targetBytes = new Uint8Array(header.buffer, header.byteOffset + 8, 6)
  const target = Array.from(targetBytes).map(b => b.toString(16).padStart(2, '0')).join('')

  const resAckByte = view.getUint8(22)
  const res_required = Boolean(resAckByte & 0x1)
  const ack_required = Boolean((resAckByte >> 1) & 0x1)
  const sequence = view.getUint8(23)

  const type = view.getUint16(32, true)

  return {
    frameHeader: { size, protocol, addressable: true, tagged, origin: 0, source },
    frameAddress: { target, res_required, ack_required, sequence },
    protocolHeader: { type },
  }
}
