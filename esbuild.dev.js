import * as esbuild from 'esbuild'
import ejs from 'ejs'
import fs from 'fs'

const OUTFILE = 'index.js'

if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true })
}
fs.mkdirSync('dist')

ejs.renderFile(
  'src/index.ejs',
  { index: OUTFILE },
  {},
  (err, str) => {
    if (err) {
      console.error(err)
    }
    fs.writeFileSync('dist/index.html', str)
  },
)

const context = await esbuild.context({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  outfile: `dist/${OUTFILE}`,
})

await context.watch()

const { hosts, port } = await context.serve({
  servedir: 'dist',
})

console.log(`http://${hosts[0]}:${port}`)
