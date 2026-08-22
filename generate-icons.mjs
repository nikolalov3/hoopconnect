import sharp from 'sharp'
import { readFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))
mkdirSync(resolve(__dirname, 'assets'), { recursive: true })

// Brand crest (faceted diamond + internal cage) — the same mark as the AuthPage
// logo, the loading splash, and the onboarding slide that flips into a basketball.
// Every icon uses it so the app icon, iPhone "Add to Home Screen" shortcut, splash
// and in-app logo all match. (The old icon-source.svg — HC hexagon in a metal frame
// with a gold bar — read badly as a home-screen icon, so it's no longer used.)
const crest = readFileSync(resolve(__dirname, 'assets/logo-crest.svg'))

// Square brand-gradient background (dark navy + a soft blue glow), at any size.
const bg = (S) => Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="${S}" height="${S}" viewBox="0 0 ${S} ${S}">
    <defs>
      <linearGradient id="bg" x1="0" y1="0" x2="0.3" y2="1">
        <stop offset="0%" stop-color="#0C1F38"/><stop offset="45%" stop-color="#091828"/><stop offset="100%" stop-color="#060F1E"/>
      </linearGradient>
      <radialGradient id="glow" cx="50%" cy="44%" r="46%">
        <stop offset="0%" stop-color="#5BB8F5" stop-opacity="0.22"/><stop offset="100%" stop-color="#5BB8F5" stop-opacity="0"/>
      </radialGradient>
    </defs>
    <rect width="${S}" height="${S}" fill="url(#bg)"/>
    <rect width="${S}" height="${S}" fill="url(#glow)"/>
  </svg>`
)

// Crest centered on the brand bg, square. ratio = crest size / icon size.
async function iconOnBg(size, ratio, dest) {
  const bgPng = await sharp(bg(size)).png().toBuffer()
  const s = Math.round(size * ratio)
  const logo = await sharp(crest).resize(s, s).png().toBuffer()
  await sharp(bgPng).composite([{ input: logo, gravity: 'center' }]).png()
    .toFile(resolve(__dirname, dest))
  console.log(`✓  ${dest}  (${size}×${size})`)
}

// ── App icons — crest on brand bg (iOS/Android round the corners themselves) ──
await iconOnBg(192,  0.66, 'public/icon-192.png')
await iconOnBg(512,  0.66, 'public/icon-512.png')
await iconOnBg(512,  0.56, 'public/icon-512-maskable.png')  // smaller = Android mask safe-zone
await iconOnBg(180,  0.66, 'public/apple-touch-icon.png')   // iPhone "Add to Home Screen"
await iconOnBg(32,   0.74, 'public/favicon-32.png')
await iconOnBg(1024, 0.66, 'assets/icon.png')               // App Store / @capacitor/assets source

// ── Native splash (2732 → all launch sizes via @capacitor/assets) ──
const SPLASH = 2732
const bgPng   = await sharp(bg(SPLASH)).png().toBuffer()
const diamond = await sharp(crest).resize(1120, 1120).png().toBuffer()
await sharp(bgPng).composite([{ input: diamond, gravity: 'center' }]).png()
  .toFile(resolve(__dirname, 'assets/splash.png'))
console.log(`✓  assets/splash.png  (${SPLASH}×${SPLASH})`)
// No separate splash-dark: the app is dark, so @capacitor/assets reuses splash.png.

console.log('\nDone — all icons + splash generated (crest on brand bg).')
