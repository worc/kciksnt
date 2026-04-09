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
}
