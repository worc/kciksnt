import * as esbuild from 'esbuild'
import ejs from 'ejs'
import fs from 'fs'

const OUTFILE = 'index.js'
const BUN_PORT = 7410

if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true })
}
fs.mkdirSync('dist')

ejs.renderFile(
  'src/index.ejs',
  { index: OUTFILE },
  {},
  (err, str) => {
    if (err) { console.error(err); return }
    fs.writeFileSync('dist/index.html', str)
  },
)

// After each successful rebuild, ping the Bun server so it can broadcast
// a dev_reload message to all connected WebSocket clients.
const notifyBun = {
  name: 'notify-bun',
  setup (build) {
    build.onEnd(result => {
      if (result.errors.length > 0) return
      fetch(`http://localhost:${BUN_PORT}/dev/reload`, { method: 'POST' })
        .catch(() => {}) // server may not be running yet — that's fine
    })
  },
}

const context = await esbuild.context({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  outfile: `dist/${OUTFILE}`,
  plugins: [notifyBun],
})

await context.watch()

console.log(`Watching for changes (reload via Bun server on :${BUN_PORT})`)
