// Renders resources/icon.svg into the PNGs @capacitor/assets and the PWA need:
//   resources/icon-only.png, icon-foreground.png, icon-background.png, splash(-dark).png
//   public/icon-512.png, public/icon-180.png
// Then: npx @capacitor/assets generate --android
// Run from frontend/: node scripts/render-icons.mjs
import { readFileSync, mkdirSync } from 'node:fs'
import sharp from 'sharp'

const BG = '#0c0e12'
const src = readFileSync('resources/icon.svg', 'utf8')
const mark = src.match(/<g id="mark"[\s\S]*?<\/g>/)[0]
// The mark alone on a 512 canvas, scaled around the centre. Adaptive icons are masked to the
// middle ~2/3, so the foreground layer gets a smaller mark than the full-bleed icon.
const markSvg = (scale, bg) => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  ${bg ? `<rect width="512" height="512" fill="${bg}"/>` : ''}
  <g transform="translate(256 256) scale(${scale}) translate(-256 -256)">${mark}</g></svg>`
const png = (svg, size) => sharp(Buffer.from(svg), { density: 72 * size / 512 }).resize(size, size).png()

await png(src, 1024).toFile('resources/icon-only.png')
await png(markSvg(0.72), 1024).toFile('resources/icon-foreground.png')
await sharp({ create: { width: 1024, height: 1024, channels: 4, background: BG } }).png().toFile('resources/icon-background.png')
for (const f of ['splash', 'splash-dark']) await png(markSvg(0.3, BG), 2732).toFile(`resources/${f}.png`)
await png(src, 512).toFile('public/icon-512.png')
await png(src, 180).toFile('public/icon-180.png')

// Google Play store listing: 512 icon (same as the PWA one) + the 1024×500 feature graphic.
mkdirSync('resources/play', { recursive: true })
await png(src, 512).toFile('resources/play/icon-512.png')
const feature = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="500" viewBox="0 0 1024 500">
  <rect width="1024" height="500" fill="${BG}"/>
  <g transform="translate(250 256) scale(0.8) translate(-256 -256)">${mark}</g>
  <text x="400" y="248" font-family="Segoe UI, Roboto, sans-serif" font-size="100" font-weight="700" fill="#ffffff" letter-spacing="-3">GymApp</text>
  <text x="404" y="300" font-family="Segoe UI, Roboto, sans-serif" font-size="30" fill="#9a9aa0">Plan, train and track. Private by design.</text>
</svg>`
await sharp(Buffer.from(feature)).flatten({ background: BG }).png().toFile('resources/play/feature-graphic.png')
console.log('icons rendered')
