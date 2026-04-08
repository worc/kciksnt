import * as esbuild from 'esbuild'
import ejs from 'ejs'
import fs from 'fs'
import crypto from 'crypto'

if (fs.existsSync('dist')) {
  fs.rmSync('dist', { recursive: true })
}
fs.mkdirSync('dist')

const result = await esbuild.build({
  entryPoints: ['src/index.tsx'],
  bundle: true,
  minify: true,
  sourcemap: true,
  metafile: true,
  write: false,
})

// Content-hash the output filename
const hash = crypto
  .createHash('md5')
  .update(result.outputFiles[0].contents)
  .digest('hex')
  .slice(0, 8)

const outfile = `index.${hash}.js`
fs.writeFileSync(`dist/${outfile}`, result.outputFiles[0].contents)

// Write sourcemap if present
if (result.outputFiles[1]) {
  fs.writeFileSync(`dist/${outfile}.map`, result.outputFiles[1].contents)
}

ejs.renderFile(
  'src/index.ejs',
  { index: outfile },
  {},
  (err, str) => {
    if (err) {
      console.error(err)
      process.exit(1)
    }
    fs.writeFileSync('dist/index.html', str)
  },
)

console.log('Build complete:', outfile)
