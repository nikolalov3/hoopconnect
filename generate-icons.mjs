import sharp from 'sharp'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const svgPath   = resolve(__dirname, 'public/icon-source.svg')
const svg       = readFileSync(svgPath)

// Brand background (matches theme-color / manifest background_color #04080F)
const BG = { r: 4, g: 8, b: 15, alpha: 1 }

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
  // App Store / Play native source for @capacitor/assets (opaque — App Store forbids alpha).
  // Lives in assets/ (not public/) so it isn't shipped in the web deploy.
  { file: 'assets/icon.png',           size: 1024, flatten: true },
]

// Native assets live in assets/ — create it up front.
import { mkdirSync } from 'fs'
mkdirSync(resolve(__dirname, 'assets'), { recursive: true })

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
  } else if (icon.flatten) {
    // Opaque icon on brand bg — App Store 1024 marketing icon must have no alpha
    await sharp(svg)
      .resize(icon.size, icon.size)
      .flatten({ background: BG })
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

// ── Native splash source for @capacitor/assets (2732×2732 → all launch sizes) ────
// Clean brand mark (hoop.svg — the faceted diamond, NO app-icon frame/grid/gold bar)
// centered on the app's own gradient background. Reads like the login-screen logo.
const SPLASH = 2732
// Brand crest with the internal cage/grid (same mark as AuthPage + the onboarding
// slide that flips into a basketball) — the richer "app logo" the team prefers.
const hoopSvg = readFileSync(resolve(__dirname, 'assets/logo-crest.svg'))
const bgSvg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${SPLASH}" height="${SPLASH}" viewBox="0 0 ${SPLASH} ${SPLASH}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.28" y2="1">
        <stop offset="0%" stop-color="#0C1F38"/><stop offset="42%" stop-color="#091828"/><stop offset="100%" stop-color="#060F1E"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="45%" r="42%">
        <stop offset="0%" stop-color="#5BB8F5" stop-opacity="0.22"/><stop offset="100%" stop-color="#5BB8F5" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${SPLASH}" height="${SPLASH}" fill="url(#bg)"/>
    <rect width="${SPLASH}" height="${SPLASH}" fill="url(#glow)"/>
  </svg>`
)
const bgPng   = await sharp(bgSvg).png().toBuffer()
const diamond = await sharp(hoopSvg).resize(1120, 1120).png().toBuffer()
await sharp(bgPng).composite([{ input: diamond, gravity: 'center' }]).png()
  .toFile(resolve(__dirname, 'assets/splash.png'))
console.log(`✓  assets/splash.png  (${SPLASH}×${SPLASH})`)
// No separate splash-dark: the app is dark, so @capacitor/assets reuses splash.png
// for both light and dark modes.

console.log('\nDone — all icons + splash generated in /public/')
