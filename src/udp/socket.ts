type MessageHandler = (data: Buffer<ArrayBufferLike>, port: number, address: string) => void

const LIFX_PORT = 56700
const BROADCAST_IP = '255.255.255.255'

export async function createSocket(port = LIFX_PORT) {
  let messageHandler: MessageHandler = () => {}

  const socket = await Bun.udpSocket({
    port,
    socket: {
      data(_sock, data, p, address) {
        messageHandler(data, p, address)
      },
      drain() {},
      error(...args) { console.error('Socket error:', ...args) },
    },
  })

  socket.setBroadcast(true)

  return {
    onMessage(handler: MessageHandler) {
      messageHandler = handler
    },
    close() {
      socket.close()
    },
    broadcast(payload: Bun.udp.Data) {
      socket.send(payload, LIFX_PORT, BROADCAST_IP)
    },
    send(payload: Bun.udp.Data, ip: string, p = LIFX_PORT) {
      socket.send(payload, p, ip)
    },
  }
}

export type LifxSocket = Awaited<ReturnType<typeof createSocket>>
