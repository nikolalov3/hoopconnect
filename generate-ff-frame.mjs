import sharp from 'sharp'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// ── Friends & Family (ff) frame — a gold, legendary hex frame ─────────────────
// Same format as earlyaccess.png / ramkas1diax.png: 512×495 transparent PNG,
// a pointy-top hexagonal band (point at top+bottom, vertical sides), sized so it
// lines up with the avatar hole when drawn as <image x=-16 y=-16 w=122 h=122>.
const W = 512, H = 495

// pointy-top hexagon (point top+bottom, vertical left/right sides), shoulder at 1/3
function hex(x0, y0, x1, y1) {
  const cx = (x0 + x1) / 2
  const s = (y1 - y0) / 3
  return [
    [cx, y0],            // top point
    [x1, y0 + s],        // upper-right
    [x1, y1 - s],        // lower-right
    [cx, y1],            // bottom point
    [x0, y1 - s],        // lower-left
    [x0, y0 + s],        // upper-left
  ]
}
const pts = (a) => a.map(p => `${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
const path = (a) => `M ${a.map(p => `${p[0].toFixed(1)} ${p[1].toFixed(1)}`).join(' L ')} Z`

// Outer edge of the band (near the canvas edge) and inner hole (frames the avatar).
const O = hex(9, 7, 503, 488)
const I = hex(97, 86, 415, 409)

// six band facets (trapezoids between outer edge and inner hole). Alternating
// light/dark overlays give a cut-metal, faceted "legendary" look; upper facets
// catch more light (directional), lower ones sit in shadow.
const facetShade = [0.00, -0.10, -0.20, -0.14, 0.06, 0.16]  // per-facet, top→around
const facets = O.map((o, i) => {
  const o2 = O[(i + 1) % 6], i2 = I[(i + 1) % 6], iC = I[i]
  const quad = `${o[0].toFixed(1)},${o[1].toFixed(1)} ${o2[0].toFixed(1)},${o2[1].toFixed(1)} ${i2[0].toFixed(1)},${i2[1].toFixed(1)} ${iC[0].toFixed(1)},${iC[1].toFixed(1)}`
  const s = facetShade[i]
  const col = s >= 0 ? '#FFFFFF' : '#3A2800'
  return `<polygon points="${quad}" fill="${col}" fill-opacity="${Math.abs(s).toFixed(2)}"/>`
}).join('\n    ')

// facet seams: a line from each outer vertex to the matching inner vertex
const seams = O.map((o, i) => `<line x1="${o[0].toFixed(1)}" y1="${o[1].toFixed(1)}" x2="${I[i][0].toFixed(1)}" y2="${I[i][1].toFixed(1)}" stroke="#5A3E06" stroke-width="2.2" stroke-opacity="0.55"/>`).join('\n    ')
const seamsHi = O.map((o, i) => `<line x1="${(o[0]+1).toFixed(1)}" y1="${(o[1]+1).toFixed(1)}" x2="${(I[i][0]+1).toFixed(1)}" y2="${(I[i][1]+1).toFixed(1)}" stroke="#FFE9A6" stroke-width="1" stroke-opacity="0.45"/>`).join('\n    ')

// corner studs at the outer vertices
const studs = O.map(o => `
    <circle cx="${o[0].toFixed(1)}" cy="${o[1].toFixed(1)}" r="17" fill="url(#stud)" stroke="#5A3E06" stroke-width="1.5"/>
    <circle cx="${(o[0]-4).toFixed(1)}" cy="${(o[1]-4).toFixed(1)}" r="4.5" fill="#FFF6DC" opacity="0.9"/>`).join('')

// top ornament — a small gem (rotated square) sitting on the top band
const gemCx = 256, gemCy = 46, gemR = 15
const gem = `
    <g transform="rotate(45 ${gemCx} ${gemCy})">
      <rect x="${gemCx-gemR}" y="${gemCy-gemR}" width="${gemR*2}" height="${gemR*2}" rx="3" fill="url(#gem)" stroke="#5A3E06" stroke-width="1.5"/>
      <rect x="${gemCx-gemR+3}" y="${gemCy-gemR+3}" width="${gemR-2}" height="${gemR-2}" rx="2" fill="#FFF6DC" opacity="0.75"/>
    </g>`

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
  <defs>
    <linearGradient id="body" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0%"  stop-color="#FFE9A6"/>
      <stop offset="18%" stop-color="#F2CF6A"/>
      <stop offset="50%" stop-color="#D9A836"/>
      <stop offset="82%" stop-color="#A5761A"/>
      <stop offset="100%" stop-color="#7A550E"/>
    </linearGradient>
    <linearGradient id="sheen" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="#FFFFFF" stop-opacity="0.55"/>
      <stop offset="30%" stop-color="#FFFFFF" stop-opacity="0.05"/>
      <stop offset="100%" stop-color="#FFFFFF" stop-opacity="0"/>
    </linearGradient>
    <radialGradient id="stud" cx="38%" cy="35%" r="70%">
      <stop offset="0%" stop-color="#FFF6DC"/>
      <stop offset="45%" stop-color="#E8B84B"/>
      <stop offset="100%" stop-color="#8A6010"/>
    </radialGradient>
    <radialGradient id="gem" cx="40%" cy="35%" r="75%">
      <stop offset="0%" stop-color="#FFFFFF"/>
      <stop offset="40%" stop-color="#FFE082"/>
      <stop offset="100%" stop-color="#C9962E"/>
    </radialGradient>
    <filter id="soft"><feGaussianBlur stdDeviation="0.5"/></filter>
  </defs>

  <!-- the gold band: outer hex minus inner hole (even-odd) -->
  <path d="${path(O)} ${path(I)}" fill-rule="evenodd" fill="url(#body)"/>

  <!-- per-facet cut-metal shading -->
  <g>
    ${facets}
  </g>

  <!-- diagonal sheen over the band -->
  <path d="${path(O)} ${path(I)}" fill-rule="evenodd" fill="url(#sheen)"/>

  <!-- facet seams (dark) + their highlight -->
  <g>
    ${seams}
  </g>
  <g>
    ${seamsHi}
  </g>

  <!-- outer edge: dark keyline + inner-hole bright rim (bevel) -->
  <polygon points="${pts(O)}" fill="none" stroke="#4A3200" stroke-width="3"/>
  <polygon points="${pts(O)}" fill="none" stroke="#FFE9A6" stroke-width="1" stroke-opacity="0.5"/>
  <polygon points="${pts(I)}" fill="none" stroke="#FFF3CC" stroke-width="2.5" stroke-opacity="0.85"/>
  <polygon points="${pts(I)}" fill="none" stroke="#4A3200" stroke-width="1.2"/>

  ${studs}
  ${gem}
</svg>`

await sharp(Buffer.from(svg)).png().toFile(resolve(__dirname, 'public/ff.png'))
console.log('✓  public/ff.png  (512×495, gold Friends & Family frame)')
