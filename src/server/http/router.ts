import type { DeviceRegistry } from '../DeviceRegistry'
import type { LifxSocket } from '../../udp/udpSocket'
import { SseHub } from '../sse/SseHub'
import { handleEventStream } from '../sse/eventStream'
import { handleDeviceState, handleDeviceAction, handleDiscover } from './commands'

// ---------------------------------------------------------------------------
// HTTP server. SSE on `/events`, command POSTs on `/devices/:mac/...` and
// `/api/discover`, plus static-file serving and an SPA fallback.
// ---------------------------------------------------------------------------

export function createHttpServer (
  registry: DeviceRegistry,
  udp:      LifxSocket,
  port:     number,
): void {
  const sseHub = new SseHub(registry)

  Bun.serve({
    hostname: '0.0.0.0',
    port,

    fetch (req) {
      const url = new URL(req.url)
      process.stdout.write(`${req.method} ${url.pathname}\n`)

      // SSE event stream — long-lived text/event-stream response
      if (url.pathname === '/events') {
        return handleEventStream(req, sseHub)
      }

      // Dev live-reload — esbuild pings this after each rebuild. Dispatched
      // through the registry so the SSE hub picks it up and reloads tabs.
      if (url.pathname === '/dev/reload' && req.method === 'POST') {
        registry.dispatch({ type: 'dev_reload' })
        return new Response('ok')
      }

      // ----- HTTP command surface -----------------------------------------
      if (req.method === 'POST' && url.pathname === '/api/discover') {
        return handleDiscover(registry, udp)
      }

      // /devices/:mac/{state,identify,inspect}
      const deviceMatch = /^\/devices\/([^/]+)\/(state|identify|inspect)$/.exec(url.pathname)
      if (deviceMatch && req.method === 'POST') {
        const [, mac, action] = deviceMatch
        if (action === 'state') return handleDeviceState(req, mac!, registry, udp)
        return handleDeviceAction(req, mac!, action as 'identify' | 'inspect', registry, udp)
      }

      // GET fallback for /api/discover keeps existing tooling working.
      if (url.pathname === '/api/discover') {
        return handleDiscover(registry, udp)
      }

      // Static files (paths with a dot) or SPA fallback
      if (url.pathname.includes('.')) {
        const staticFile = Bun.file(`dist${url.pathname}`)
        return staticFile.exists().then(exists =>
          exists ? new Response(staticFile) : new Response('Not Found', { status: 404 })
        )
      }

      return new Response(Bun.file('dist/index.html'))
    },
  })
}
