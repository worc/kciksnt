import {
  Uint8,
  Uint16,
  Uint32,
} from './uint'

export namespace Lifx {
  export namespace Application {
    export interface FrameHeader {
      size: number // Uint16
      protocol: number // Uint16
      addressable: true
      tagged: boolean
      origin: 0
      source: number // Uint32
    }

    export interface FrameAddress {
      target: string // 6 Uint8 integers as hex string
      res_required: boolean // "response required", or "state message required" from devices
      ack_required: boolean // "acknowledgement required", or "acknowledgement message required" from devices
      sequence: number // Uint8, wraparound message sequence number
    }

    export interface ProtocolHeader {
      type: number // Uint16
    }

    export interface Hsbk {
      hue: number        // 0.0–360.0 degrees
      saturation: number // 0.0–1.0
      brightness: number // 0.0–1.0
      kelvin: number     // 1500–9000 K (valid range varies by device)
    }
  }

  export namespace OverWire {
    export interface FrameHeader {
      size: Uint16
      protocol: Uint16
      addressable: 0b1
      tagged: 0b0 | 0b1
      origin: Uint8
      source: Uint32
    }

    export interface FrameAddress {
      target: Uint8Array
      res_required: 0b0 | 0b1
      ack_required: 0b0 | 0b1
      sequence: Uint8
    }

    export interface ProtocolHeader {
      type: Uint16
    }

    export type Header = Uint8Array
  }
}
