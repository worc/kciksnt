import type { DiscoveredDevice } from './api'

// Client → Server
export type ClientMessage =
  | { type: 'discover'; sentAt: number }

// Server → Client
export type ServerMessage =
  | {
      type: 'discovery_result'
      devices: DiscoveredDevice[]
      timestamps: {
        clientSentAt: number      // echoed from client
        serverReceivedAt: number  // stamped when server message handler fired
        serverRespondedAt: number // stamped just before ws.send
      }
    }
  | { type: 'error'; message: string; sentAt: number }
