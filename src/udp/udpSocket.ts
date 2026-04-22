import { EventEmitter } from 'node:events'

type MessageHandler = (data: Buffer<ArrayBufferLike>, port: number, address: string) => void

export interface LifxSocket {
  on(event: 'message', listener: MessageHandler): void
  off(event: 'message', listener: MessageHandler): void
  broadcast(payload: Bun.udp.Data): void
  send(payload: Bun.udp.Data, ip: string, port?: number): void
  close(): void
}

const LIFX_PORT = 56700
const BROADCAST_IP = '255.255.255.255'

export async function createUdpSocket (port = LIFX_PORT): Promise<LifxSocket> {
  const emitter = new EventEmitter()

  const socket = await Bun.udpSocket({
    port,
    socket: {
      data (_sock, data, p, address) {
        emitter.emit('message', data, p, address)
      },
      drain () {},
      error (...args) { console.error('Socket error:', ...args) },
    },
  })

  socket.setBroadcast(true)

  return {
    on  (event: 'message', listener: MessageHandler) { emitter.on(event, listener) },
    off (event: 'message', listener: MessageHandler) { emitter.off(event, listener) },
    broadcast (payload)           { socket.send(payload, LIFX_PORT, BROADCAST_IP) },
    send      (payload, ip, p = LIFX_PORT) { socket.send(payload, p, ip) },
    close     ()                  { socket.close() },
  }
}
