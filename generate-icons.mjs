import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath   = resolve(__dirname, 'public/icon-source.svg')
const svg       = readFileSync(svgPath)

const icons = [
  // Android manifest icons
  { file: 'public/icon-192.png',       size: 192 },
  { file: 'public/icon-512.png',       size: 512 },
  // Android maskable (full bleed, no clip — system applies its own mask)
  { file: 'public/icon-512-maskable.png', size: 512, maskable: true },
  // iOS apple-touch-icon (no clip radius — iOS applies its own)
  { file: 'public/apple-touch-icon.png',  size: 180 },
  // Favicon PNG fallback
  { file: 'public/favicon-32.png',     size: 32 },
]

for (const icon of icons) {
  const dest = resolve(__dirname, icon.file)

  if (icon.maskable) {
    // Maskable: fill entire square with dark bg, hex centered with 10% padding
    await sharp(svg)
      .resize(460, 460)           // hex fits ~460 in 512 canvas (10% safe zone each side)
      .extend({
        top: 26, bottom: 26, left: 26, right: 26,
        background: { r: 6, g: 12, b: 24, alpha: 1 },
      })
      .resize(512, 512)
      .png()
      .toFile(dest)
  } else {
    await sharp(svg)
      .resize(icon.size, icon.size)
      .png()
      .toFile(dest)
  }

  console.log(`✓  ${icon.file}  (${icon.size}×${icon.size})`)
}

console.log('\nDone — all icons generated in /public/')
