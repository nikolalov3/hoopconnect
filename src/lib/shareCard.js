/**
 * Canvas-based share card generator — no external deps.
 * Generates a 1080×1080 PNG image and shares via Web Share API (or downloads as fallback).
 */

import { pct as calcPct } from './pct'

// ── helpers ─────────────────────────────────────────────────────────────────

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.arcTo(x + w, y,     x + w, y + r,     r)
  ctx.lineTo(x + w, y + h - r)
  ctx.arcTo(x + w, y + h, x + w - r, y + h, r)
  ctx.lineTo(x + r, y + h)
  ctx.arcTo(x,     y + h, x,       y + h - r, r)
  ctx.lineTo(x,     y + r)
  ctx.arcTo(x,     y,     x + r,   y,         r)
  ctx.closePath()
}

function canvasToBlob(canvas) {
  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

function drawBackground(ctx, W, H, glowColor) {
  const bg = ctx.createLinearGradient(0, 0, 0, H)
  bg.addColorStop(0, '#0C1F38')
  bg.addColorStop(0.55, '#081525')
  bg.addColorStop(1,  '#04090F')
  ctx.fillStyle = bg
  ctx.fillRect(0, 0, W, H)

  const glow = ctx.createRadialGradient(W / 2, H * 0.36, 0, W / 2, H * 0.36, W * 0.58)
  glow.addColorStop(0, `${glowColor}1A`)
  glow.addColorStop(1, 'transparent')
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
}

function drawFooter(ctx, W, H) {
  const date = new Date().toLocaleDateString('pl-PL', {
    day: 'numeric', month: 'long', year: 'numeric',
  }).toUpperCase()
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.font = '500 22px Barlow, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(date, W / 2, H - 92)

  ctx.fillStyle = '#5BB8F5'
  ctx.font = '700 30px "Barlow Condensed", sans-serif'
  ctx.fillText('HOOPCONNECT.APP', W / 2, H - 50)
}

function drawStatBox(ctx, x, y, w, h, value, label, color) {
  ctx.fillStyle = `${color}12`
  roundRect(ctx, x, y, w, h, 18)
  ctx.fill()
  ctx.strokeStyle = `${color}28`
  ctx.lineWidth = 1.5
  roundRect(ctx, x, y, w, h, 18)
  ctx.stroke()

  ctx.fillStyle = color
  ctx.font = '900 80px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'center'
  ctx.shadowColor = color
  ctx.shadowBlur = 18
  ctx.fillText(value, x + w / 2, y + h * 0.63)
  ctx.shadowBlur = 0

  ctx.fillStyle = `${color}99`
  ctx.font = '700 22px "Barlow Condensed", sans-serif'
  ctx.fillText(label, x + w / 2, y + h * 0.87)
}

// ── HEX LOGO ─────────────────────────────────────────────────────────────────
// Draws pointy-top hexagon outline + "HC" text centred at (cx, cy)
function drawHexLogo(ctx, cx, cy, size, color) {
  ctx.save()
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 6   // pointy-top: start at -30°
    const x = cx + size * Math.cos(a)
    const y = cy + size * Math.sin(a)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.strokeStyle = color
  ctx.lineWidth = size * 0.12
  ctx.shadowColor = color
  ctx.shadowBlur = size * 0.6
  ctx.stroke()
  ctx.shadowBlur = 0

  // Inner hex (smaller, filled dimly)
  ctx.beginPath()
  for (let i = 0; i < 6; i++) {
    const a = Math.PI / 3 * i - Math.PI / 6
    const x = cx + (size * 0.65) * Math.cos(a)
    const y = cy + (size * 0.65) * Math.sin(a)
    i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
  }
  ctx.closePath()
  ctx.fillStyle = `${color}18`
  ctx.fill()

  // "HC" text
  ctx.fillStyle = color
  ctx.font = `800 ${Math.round(size * 0.68)}px "Barlow Condensed", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('HC', cx, cy + size * 0.04)
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

// ── helpers do premium-grade layoutu ────────────────────────────────────────

async function loadOptionalImage(src) {
  return new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = () => resolve(null)
    img.src = src
  })
}

// Obsidian background + volumetric green spill + vignette + subtle grain.
// Cel: cinematic, dark, expensive feel.
function drawPremiumBackground(ctx, W, H, accentColor) {
  // 1) Navy obsidian base — granatowy, spójny z resztą apki (nie pure black)
  const baseG = ctx.createLinearGradient(0, 0, 0, H)
  baseG.addColorStop(0,    '#0E1A2E')
  baseG.addColorStop(0.55, '#081427')
  baseG.addColorStop(1,    '#04091A')
  ctx.fillStyle = baseG
  ctx.fillRect(0, 0, W, H)

  // 2) Volumetric spill — bardzo subtelny, 70% słabszy niż przedtem
  const spill = ctx.createRadialGradient(W * 0.22, H * 0.18, 0, W * 0.22, H * 0.18, W * 0.85)
  spill.addColorStop(0,    `${accentColor}0C`)
  spill.addColorStop(0.35, `${accentColor}04`)
  spill.addColorStop(1,    'transparent')
  ctx.fillStyle = spill
  ctx.fillRect(0, 0, W, H)

  // 3) Hero light source — TYLKO wokół centrum (najjaśniejszy element to %)
  const heroGlow = ctx.createRadialGradient(W * 0.5, H * 0.42, 0, W * 0.5, H * 0.42, W * 0.55)
  heroGlow.addColorStop(0,    `${accentColor}1A`)
  heroGlow.addColorStop(0.45, `${accentColor}04`)
  heroGlow.addColorStop(1,    'transparent')
  ctx.fillStyle = heroGlow
  ctx.fillRect(0, 0, W, H)

  // 4) Vignette — dark corners for cinematic depth
  const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.35, W / 2, H / 2, W * 0.85)
  vig.addColorStop(0, 'transparent')
  vig.addColorStop(1, 'rgba(0,0,0,0.55)')
  ctx.fillStyle = vig
  ctx.fillRect(0, 0, W, H)

  // 5) Subtle film grain — random low-alpha dots
  ctx.save()
  ctx.globalAlpha = 0.05
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * W, y = Math.random() * H
    const v = Math.random() * 60 + 40
    ctx.fillStyle = `rgb(${v},${v},${v})`
    ctx.fillRect(x, y, 1, 1)
  }
  ctx.restore()
}

// Apple Liquid Glass panel — frosted, translucentny, multi-layer reflections
function drawFloatingGlass(ctx, x, y, w, h, opts = {}) {
  const r = opts.radius ?? 22
  const accent = opts.accent ?? '#FFFFFF'

  ctx.save()
  // 1) Soft ambient drop — minimal
  ctx.shadowColor = 'rgba(0,0,0,0.40)'
  ctx.shadowBlur = 28
  ctx.shadowOffsetY = 10

  // 2) Layer A — ciemniejsze frosted glass, mniej kolorowe
  const bgA = ctx.createLinearGradient(x, y, x, y + h)
  bgA.addColorStop(0,    'rgba(60,80,110,0.16)')
  bgA.addColorStop(0.5,  'rgba(30,42,60,0.12)')
  bgA.addColorStop(1,    'rgba(15,22,35,0.10)')
  ctx.fillStyle = bgA
  roundRect(ctx, x, y, w, h, r); ctx.fill()
  ctx.shadowBlur = 0; ctx.shadowOffsetY = 0

  // 2b) Layer A2 — subtelniejszy radial highlight z top-left
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const tlg = ctx.createRadialGradient(x + r * 1.8, y + r * 0.8, 0, x + r * 1.8, y + r * 0.8, w * 0.55)
  tlg.addColorStop(0,   'rgba(255,255,255,0.05)')
  tlg.addColorStop(0.5, 'rgba(255,255,255,0.01)')
  tlg.addColorStop(1,   'transparent')
  ctx.fillStyle = tlg
  roundRect(ctx, x, y, w, h, r); ctx.fill()
  ctx.restore()

  // 3) Layer B — diagonal frost gradient (subtle Apple-style refraction)
  const bgB = ctx.createLinearGradient(x, y, x + w, y + h)
  bgB.addColorStop(0,   'rgba(255,255,255,0.05)')
  bgB.addColorStop(0.5, 'rgba(255,255,255,0.00)')
  bgB.addColorStop(1,   'rgba(180,210,255,0.04)')
  ctx.fillStyle = bgB
  roundRect(ctx, x, y, w, h, r); ctx.fill()

  // 4) Top reflection sheen — sharp gradient na upper third (glass reflection)
  const sheen = ctx.createLinearGradient(x, y, x, y + h * 0.40)
  sheen.addColorStop(0,    'rgba(255,255,255,0.22)')
  sheen.addColorStop(0.5,  'rgba(255,255,255,0.06)')
  sheen.addColorStop(1,    'transparent')
  ctx.fillStyle = sheen
  roundRect(ctx, x, y, w, h, r); ctx.fill()

  // 4b) Diagonal light sweep — refrakcyjne pasmo światła w poprzek panelu
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const sweep = ctx.createLinearGradient(x, y, x + w, y + h)
  sweep.addColorStop(0,    'rgba(255,255,255,0)')
  sweep.addColorStop(0.42, 'rgba(255,255,255,0.02)')
  sweep.addColorStop(0.5,  'rgba(255,255,255,0.08)')
  sweep.addColorStop(0.58, 'rgba(255,255,255,0.02)')
  sweep.addColorStop(1,    'rgba(255,255,255,0)')
  ctx.fillStyle = sweep
  roundRect(ctx, x, y, w, h, r); ctx.fill()
  ctx.restore()

  // 4c) Corner specular hit — jasny punkt na top-left rogu (jak światło lampy)
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const specular = ctx.createRadialGradient(x + r * 1.4, y + r * 0.6, 0, x + r * 1.4, y + r * 0.6, w * 0.45)
  specular.addColorStop(0,    'rgba(255,255,255,0.18)')
  specular.addColorStop(0.4,  'rgba(255,255,255,0.04)')
  specular.addColorStop(1,    'transparent')
  ctx.fillStyle = specular
  roundRect(ctx, x, y, w, h, r); ctx.fill()
  ctx.restore()

  // 5) Accent stroke — subtle akcent panela
  ctx.strokeStyle = `${accent}26`
  ctx.lineWidth = 1
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke()

  // 6) Top inner hairline — luminance highlight (jaśniejszy niż wcześniej)
  ctx.strokeStyle = 'rgba(255,255,255,0.22)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + r * 0.5, y + 1)
  ctx.lineTo(x + w - r * 0.5, y + 1)
  ctx.stroke()

  // 7) Bottom inner soft shadow line — depth
  ctx.strokeStyle = 'rgba(0,0,0,0.22)'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(x + r * 0.5, y + h - 1)
  ctx.lineTo(x + w - r * 0.5, y + h - 1)
  ctx.stroke()

  ctx.restore()
}

// Silver gradient divider line — pozioma kreska, jak edge w klasycznych Apple shareach
function drawSilverDivider(ctx, x1, x2, y) {
  ctx.save()
  const g = ctx.createLinearGradient(x1, 0, x2, 0)
  g.addColorStop(0,    'transparent')
  g.addColorStop(0.15, 'rgba(180,195,220,0.10)')
  g.addColorStop(0.5,  'rgba(230,235,245,0.32)')
  g.addColorStop(0.85, 'rgba(180,195,220,0.10)')
  g.addColorStop(1,    'transparent')
  ctx.fillStyle = g
  ctx.fillRect(x1, y, x2 - x1, 1)
  ctx.restore()
}

// Pill label "PODSUMOWANIE TRENINGU" — mniej zaokrąglone, geometryczne
function drawPill(ctx, cx, y, text, w, h = 44) {
  ctx.save()
  const x = cx - w / 2
  const r = 14
  ctx.fillStyle = 'rgba(20,28,40,0.85)'
  roundRect(ctx, x, y, w, h, r); ctx.fill()
  ctx.strokeStyle = 'rgba(180,210,250,0.14)'
  ctx.lineWidth = 1
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke()
  ctx.fillStyle = 'rgba(220,228,242,0.85)'
  ctx.font = '600 19px Barlow, sans-serif'
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.fillText(text, cx, y + h / 2 + 1)
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

// Ultra-subtle frame — light-catching edge, no glow. Apple "material separation".
function drawSilverFrame(ctx, x, y, w, h, r = 24) {
  ctx.save()

  // 1) Inner fill — matte black with subtle warmth
  const baseG = ctx.createLinearGradient(x, y, x, y + h)
  baseG.addColorStop(0,   '#0A0E16')
  baseG.addColorStop(0.5, '#06090F')
  baseG.addColorStop(1,   '#040609')
  ctx.fillStyle = baseG
  roundRect(ctx, x, y, w, h, r); ctx.fill()

  // 2) Subtle ambient drop (premium soft, low)
  ctx.save()
  ctx.shadowColor = 'rgba(0,0,0,0.65)'
  ctx.shadowBlur = 22
  ctx.shadowOffsetY = 8
  ctx.strokeStyle = 'rgba(0,0,0,0.001)'
  ctx.lineWidth = 0.1
  roundRect(ctx, x + 0.5, y + 0.5, w - 1, h - 1, r); ctx.stroke()
  ctx.restore()

  // 3) Silver edge — brushed metal gradient, jaśniejszy niż przedtem
  const edgeG = ctx.createLinearGradient(x, y, x, y + h)
  edgeG.addColorStop(0,    'rgba(235,240,250,0.36)')
  edgeG.addColorStop(0.25, 'rgba(190,200,220,0.16)')
  edgeG.addColorStop(0.5,  'rgba(140,150,175,0.08)')
  edgeG.addColorStop(0.85, 'rgba(180,190,210,0.16)')
  edgeG.addColorStop(1,    'rgba(220,228,242,0.26)')
  ctx.strokeStyle = edgeG
  ctx.lineWidth = 1.2
  roundRect(ctx, x + 0.6, y + 0.6, w - 1.2, h - 1.2, r); ctx.stroke()

  // 4) Inner top hairline
  ctx.beginPath()
  ctx.moveTo(x + r * 0.8, y + 1.8)
  ctx.lineTo(x + w - r * 0.8, y + 1.8)
  ctx.strokeStyle = 'rgba(255,255,255,0.18)'
  ctx.lineWidth = 1
  ctx.stroke()

  // 5) Specular highlights — 5 punktów światła rozproszonego po ramce
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  const lights = [
    { px: x + w * 0.20, py: y + 2,        rad: 80,  alpha: 0.16, color: '255,255,255' },
    { px: x + w * 0.78, py: y + 2,        rad: 65,  alpha: 0.11, color: '210,230,255' },
    { px: x + 2,        py: y + h * 0.38, rad: 90,  alpha: 0.08, color: '200,220,255' },
    { px: x + w - 2,    py: y + h * 0.58, rad: 90,  alpha: 0.09, color: '230,220,200' },
    { px: x + w * 0.48, py: y + h - 2,    rad: 100, alpha: 0.07, color: '200,215,235' },
  ]
  for (const l of lights) {
    const g = ctx.createRadialGradient(l.px, l.py, 0, l.px, l.py, l.rad)
    g.addColorStop(0,   `rgba(${l.color},${l.alpha})`)
    g.addColorStop(0.5, `rgba(${l.color},${l.alpha * 0.32})`)
    g.addColorStop(1,   'transparent')
    ctx.fillStyle = g
    ctx.beginPath(); ctx.arc(l.px, l.py, l.rad, 0, Math.PI * 2); ctx.fill()
  }
  ctx.restore()

  ctx.restore()
}

// Athletic hero % — Barlow Condensed 900, mocny neon glow (jak we wzorze).
// Wielowarstwowy bloom: hero to JEDYNY element światła, ma być MOCNY.
function drawHeroPercent(ctx, cx, cy, pct, color) {
  ctx.save()
  const txt = `${pct}%`
  const size = pct >= 100 ? 320 : 340       // monumental, dominuje kompozycję
  ctx.font = `900 ${size}px "Barlow Condensed", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'

  // 4-pass neon bloom — mocny, wide, jak na wzorze
  const passes = [
    { blur: 100, alpha: 0.22 },
    { blur:  56, alpha: 0.35 },
    { blur:  26, alpha: 0.55 },
    { blur:   0, alpha: 1.00 },
  ]
  for (const p of passes) {
    ctx.save()
    ctx.shadowColor = color
    ctx.shadowBlur = p.blur
    ctx.globalAlpha = p.alpha
    ctx.fillStyle = color
    ctx.fillText(txt, cx, cy)
    ctx.restore()
  }

  // Inner core highlight
  ctx.save()
  ctx.globalCompositeOperation = 'lighter'
  ctx.shadowBlur = 0
  ctx.fillStyle = 'rgba(255,255,255,0.16)'
  ctx.fillText(txt, cx, cy)
  ctx.restore()

  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

// Letter-spaced text — Canvas nie ma niezawodnego letter-spacing, więc rysujemy
// znak po znaku z dodatkową przerwą. textAlign='center' liczy całkowitą szerokość.
function drawLetterSpaced(ctx, text, cx, y, opts) {
  ctx.save()
  ctx.font = opts.font
  ctx.fillStyle = opts.color
  ctx.textAlign = 'left'
  // Zmierz szerokości znaków + spacing
  const chars = [...text]
  const widths = chars.map(ch => ctx.measureText(ch).width)
  const totalW = widths.reduce((a, b) => a + b, 0) + opts.letterSpacing * (chars.length - 1)
  let x = cx - totalW / 2
  chars.forEach((ch, i) => {
    ctx.fillText(ch, x, y)
    x += widths[i] + opts.letterSpacing
  })
  ctx.restore()
}

// ── SESSION CARD — new graffiti-inspired layout ──────────────────────────────

// Lazy-load Google Font — wstrzykuje <link> i czeka na faktyczne dostępność glyphów.
async function loadGoogleFontFamily(family, weight) {
  const id = `gfont-${family}-${weight}`.replace(/\s+/g, '-')
  if (!document.getElementById(id)) {
    const link = document.createElement('link')
    link.id = id
    link.href = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:wght@${weight}&display=swap`
    link.rel = 'stylesheet'
    document.head.appendChild(link)
  }
  try { await document.fonts.load(`${weight} 16px "${family}"`) } catch {}
}

export async function shareSessionCard({ made, attempted, target }) {
  // Sora ExtraBold dla hero % — athletic luxury (Apple / Nike / NBA vibe)
  await loadGoogleFontFamily('Sora', 800)
  await document.fonts.ready

  const W = 1080, H = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  const pct = calcPct(made, attempted)
  const missed = attempted - made
  // Trzy-stopniowa skala kolorów (sync z aplikacją)
  const heroColor = pct >= 60 ? '#34D399' : pct >= 30 ? '#FCD34D' : '#FF8830'
  const greenStat = '#34D399'
  const redStat   = '#FB7185'

  // ── 1. Premium obsidian background z volumetric spill + grain ──
  drawPremiumBackground(ctx, W, H, heroColor)

  // ── 1b. Srebrna ramka — premium proporcje ──
  const FRAME_PAD = 80
  const FW = W - FRAME_PAD * 2
  const FH = H - FRAME_PAD * 2
  drawSilverFrame(ctx, FRAME_PAD, FRAME_PAD, FW, FH, 22)

  // ── 3. (top-right logo USUNIĘTE — graffiti jest jedynym brandingiem) ──

  // ── 4. Pill „PODSUMOWANIE TRENINGU" — delikatniej, wyżej ──
  drawPill(ctx, W / 2, 250, 'PODSUMOWANIE TRENINGU', 320, 38)

  // ── 5. Hero %: dominantny, monumentalny ──
  drawHeroPercent(ctx, W / 2, 440, pct, heroColor)

  // ── 6. „SKUTECZNOŚĆ" — +15px padding od % ──
  drawLetterSpaced(ctx, 'SKUTECZNOŚĆ', W / 2, 595, {
    font: '500 22px Barlow, sans-serif',
    color: 'rgba(220,228,242,0.70)',
    letterSpacing: 14,
  })

  // ── 6b. „X/Y RZUTÓW" + green progress bar ──
  {
    const SIDE_BAR = FRAME_PAD + 28
    const lineY = 640
    ctx.save()
    ctx.font = '900 40px "Barlow Condensed", sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'top'
    ctx.shadowColor = heroColor; ctx.shadowBlur = 14
    ctx.fillStyle = heroColor
    ctx.fillText(`${made}/${attempted}`, SIDE_BAR, lineY)
    ctx.shadowBlur = 0
    const numW = ctx.measureText(`${made}/${attempted}`).width
    ctx.font = '600 22px Barlow, sans-serif'
    ctx.fillStyle = 'rgba(220,228,242,0.62)'
    ctx.textBaseline = 'alphabetic'
    ctx.fillText('RZUTÓW', SIDE_BAR + numW + 14, lineY + 32)
    ctx.restore()

    // Progress bar — premium, soft green
    const bX = SIDE_BAR
    const bY = lineY + 58
    const bW = W - SIDE_BAR * 2
    const bH = 5
    ctx.fillStyle = 'rgba(255,255,255,0.05)'
    roundRect(ctx, bX, bY, bW, bH, 2.5); ctx.fill()

    const fillRatio = Math.min(attempted / Math.max(target, 1), 1)
    const fillW = bW * fillRatio
    ctx.save()
    ctx.shadowColor = heroColor; ctx.shadowBlur = 14
    const barG = ctx.createLinearGradient(bX, 0, bX + bW, 0)
    barG.addColorStop(0, `${heroColor}99`)
    barG.addColorStop(1, heroColor)
    ctx.fillStyle = barG
    roundRect(ctx, bX, bY, fillW, bH, 2.5); ctx.fill()
    ctx.restore()
    if (fillRatio > 0.02) {
      ctx.save()
      ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = 14
      ctx.fillStyle = '#FFFFFF'
      ctx.beginPath()
      ctx.arc(bX + fillW - 2, bY + bH / 2, 3.5, 0, Math.PI * 2)
      ctx.fill()
      ctx.restore()
    }
  }

  // ── 7. Floating stat row: TRAFIONE / PUDŁA — większe, premium ──
  const SIDE = FRAME_PAD + 28
  const statY = 800
  const statH = 170
  const statGap = 22
  const statW = (W - SIDE * 2 - statGap) / 2

  drawFloatingGlass(ctx, SIDE, statY, statW, statH, { accent: greenStat, radius: 22 })
  drawFloatingGlass(ctx, SIDE + statW + statGap, statY, statW, statH, { accent: redStat, radius: 22 })

  function drawStatContent(x, y, color, icon, value) {
    // Ikona wycentrowana wertykalnie do całego panelu
    const icx = x + 70, icy = y + statH / 2
    // Glass-style bloom za ikoną — mniej intensywny
    ctx.save()
    ctx.fillStyle = `${color}10`
    ctx.shadowColor = color; ctx.shadowBlur = 6
    ctx.beginPath(); ctx.arc(icx, icy, 40, 0, Math.PI * 2); ctx.fill()
    ctx.restore()
    ctx.save()
    ctx.strokeStyle = `${color}70`
    ctx.lineWidth = 1.8
    ctx.beginPath(); ctx.arc(icx, icy, 40, 0, Math.PI * 2); ctx.stroke()
    ctx.restore()
    // Glyph — czyste, bez glow
    ctx.save()
    ctx.strokeStyle = color
    ctx.lineWidth = 5.5; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.beginPath()
    if (icon === 'check') {
      ctx.moveTo(icx - 17, icy + 3)
      ctx.lineTo(icx - 4,  icy + 16)
      ctx.lineTo(icx + 18, icy - 13)
    } else {
      ctx.moveTo(icx - 13, icy - 13); ctx.lineTo(icx + 13, icy + 13)
      ctx.moveTo(icx + 13, icy - 13); ctx.lineTo(icx - 13, icy + 13)
    }
    ctx.stroke()
    ctx.restore()
    // Value — czysta typografia, wycentrowana wertykalnie do panelu (bez labela)
    ctx.save()
    ctx.fillStyle = color
    ctx.font = '600 108px "Barlow Condensed", sans-serif'
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle'
    ctx.fillText(String(value), icx + 70, y + statH / 2)
    ctx.restore()
  }

  drawStatContent(SIDE, statY, greenStat, 'check', made)
  drawStatContent(SIDE + statW + statGap, statY, redStat, 'x', missed)

  // ── Silver divider — oddziela najnizszą sekcję (footer) ──
  const FOOTER_TOP_Y = H - FRAME_PAD - 100
  drawSilverDivider(ctx, FRAME_PAD + 50, W - FRAME_PAD - 50, FOOTER_TOP_Y)

  // ── 2. GRAFFITI — 2x WIĘKSZE, dominant element, multi-layer glow ──
  const graffiti = await loadOptionalImage('/graffiti.png')
  if (graffiti) {
    const maxW = 697, maxH = 459              // -15% vs poprzednio (820x540)
    const ratio = Math.min(maxW / graffiti.width, maxH / graffiti.height, 1)
    const gw = graffiti.width * ratio
    const gh = graffiti.height * ratio
    // Bliżej top-left edge — większy oddech między grafficie a ramką (FRAME_PAD=100)
    const gx = 4, gy = 6
    // 3-pass bloom — od soft external do mid + sharp top
    ctx.save()
    ctx.shadowColor = '#34D399'
    ctx.shadowBlur = 90
    ctx.globalAlpha = 0.22
    ctx.drawImage(graffiti, gx, gy, gw, gh)
    ctx.restore()
    ctx.save()
    ctx.shadowColor = '#34D399'
    ctx.shadowBlur = 45
    ctx.globalAlpha = 0.32
    ctx.drawImage(graffiti, gx, gy, gw, gh)
    ctx.restore()
    // Sharp top
    ctx.drawImage(graffiti, gx, gy, gw, gh)
  }

  // ── 8. Footer USUNIĘTY — czysty dolny obszar ramki ──

  return canvasToBlob(canvas)
}

// ── STATS CARD ───────────────────────────────────────────────────────────────

export async function shareStatsCard({ sessions, profile, filter }) {
  await document.fonts.ready

  const W = 1080, H = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  // compute
  const totalMade = sessions.reduce((a, s) => a + s.made, 0)
  const totalAtt  = sessions.reduce((a, s) => a + s.attempted, 0)
  const totalPct  = calcPct(totalMade, totalAtt)

  const byType = {}
  sessions.forEach(s => {
    if (!byType[s.shot_type]) byType[s.shot_type] = { made: 0, att: 0 }
    byType[s.shot_type].made += s.made
    byType[s.shot_type].att  += s.attempted
  })
  const pct3  = calcPct(byType['3pt']?.made || 0, byType['3pt']?.att || 0)
  const pct2  = calcPct(byType['2pt']?.made || 0, byType['2pt']?.att || 0)
  const pctFT = calcPct(byType.ft?.made   || 0, byType.ft?.att   || 0)

  const mainColor = '#5BB8F5'
  const pctColor  = totalPct >= 60 ? '#00E676' : totalPct >= 40 ? '#5BB8F5' : '#FF5050'

  drawBackground(ctx, W, H, mainColor)

  // ── HEADER: hex logo + wordmark ──
  drawHexLogo(ctx, 72 + 34, 76, 34, mainColor)
  ctx.fillStyle = mainColor
  ctx.font = '700 28px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('HOOPCONNECT', 72 + 34 + 46, 84)

  if (profile?.name) {
    ctx.fillStyle = 'rgba(255,255,255,0.35)'
    ctx.font = '500 26px "Barlow Condensed", sans-serif'
    ctx.textAlign = 'right'
    ctx.fillText(profile.name.toUpperCase(), W - 72, 88)
  }

  ctx.fillStyle = 'rgba(255,255,255,0.22)'
  ctx.font = '600 20px Barlow, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('TWOJE STATYSTYKI', W / 2, 148)

  // ── BIG % ──
  ctx.fillStyle = pctColor
  ctx.font = '900 280px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'center'
  ctx.shadowColor = pctColor
  ctx.shadowBlur = 22
  ctx.fillText(`${totalPct}%`, W / 2, 400)
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.font = '600 20px Barlow, sans-serif'
  ctx.fillText('OGÓŁEM', W / 2, 443)

  // ── DIVIDER ──
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(72, 472); ctx.lineTo(W - 72, 472); ctx.stroke()

  // ── 3 TYPE BOXES ──
  const typeBoxes = [
    { label: '3PKT',  pct: pct3,  color: '#7ECBFF' },
    { label: '2PKT',  pct: pct2,  color: '#00E676'  },
    { label: 'WOLNE', pct: pctFT, color: '#8AAEC8'  },
  ]
  const bw = (W - 144 - 24) / 3
  typeBoxes.forEach((b, i) => {
    const bx = 72 + i * (bw + 12)
    drawStatBox(ctx, bx, 492, bw, 195, `${b.pct}%`, b.label, b.color)
  })

  // ── BOTTOM ROW ──
  const filterLabel = filter === '7d' ? 'OST. 7 DNI' : filter === '30d' ? 'OST. 30 DNI' : 'WSZYSTKO'
  const streak = profile?.streak || 0

  ctx.fillStyle = 'rgba(255,255,255,0.06)'
  roundRect(ctx, 72, 710, W - 144, 124, 20); ctx.fill()
  ctx.strokeStyle = 'rgba(255,255,255,0.08)'
  ctx.lineWidth = 1
  roundRect(ctx, 72, 710, W - 144, 124, 20); ctx.stroke()

  const bStats = [
    { v: `🔥 ${streak}`,       l: 'DNI SERII' },
    { v: String(sessions.length), l: 'SESJI'    },
    { v: filterLabel,             l: 'OKRES'    },
  ]
  const colW = (W - 144) / 3
  bStats.forEach((s, i) => {
    const cx = 72 + i * colW + colW / 2
    ctx.fillStyle = 'rgba(255,255,255,0.80)'
    ctx.font = '800 44px "Barlow Condensed", sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(s.v, cx, 766)
    ctx.fillStyle = 'rgba(255,255,255,0.25)'
    ctx.font = '600 18px Barlow, sans-serif'
    ctx.fillText(s.l, cx, 810)
  })

  drawFooter(ctx, W, H)

  return canvasToBlob(canvas)
}

// ── MATCH CARD ───────────────────────────────────────────────────────────────

export async function shareMatchCard({ match, clubName }) {
  await document.fonts.ready

  const W = 1080, H = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  const modeColors = { '2v2': '#9050FF', '3v3': '#00CCFF', '5v5': '#FFA820' }
  const color = modeColors[match.mode] || '#00CCFF'

  // ── SLOT HEX HELPER ──
  function drawSlotHex(cx, cy, r, player, slotColor) {
    const hexPath = () => {
      ctx.beginPath()
      for (let i = 0; i < 6; i++) {
        const a = Math.PI / 3 * i - Math.PI / 6
        const x = cx + r * Math.cos(a), y = cy + r * Math.sin(a)
        i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
      }
      ctx.closePath()
    }
    if (player) {
      // Outer glow ring
      hexPath()
      ctx.fillStyle = `${slotColor}18`; ctx.fill()
      ctx.strokeStyle = slotColor; ctx.lineWidth = r * 0.13
      ctx.shadowColor = slotColor; ctx.shadowBlur = r * 0.7
      ctx.stroke(); ctx.shadowBlur = 0
      // Initial letter
      const init = player.profile?.name?.[0]?.toUpperCase() || '?'
      ctx.fillStyle = slotColor
      ctx.font = `900 ${Math.round(r * 0.88)}px "Barlow Condensed", sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.shadowColor = slotColor; ctx.shadowBlur = 8
      ctx.fillText(init, cx, cy + r * 0.06)
      ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic'
    } else {
      hexPath()
      ctx.fillStyle = 'rgba(255,255,255,0.04)'; ctx.fill()
      ctx.strokeStyle = 'rgba(255,255,255,0.10)'; ctx.lineWidth = r * 0.09; ctx.stroke()
      ctx.fillStyle = 'rgba(255,255,255,0.14)'
      ctx.font = `300 ${Math.round(r * 0.80)}px "Barlow Condensed", sans-serif`
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
      ctx.fillText('+', cx, cy + r * 0.06)
      ctx.textBaseline = 'alphabetic'
    }
  }

  drawBackground(ctx, W, H, color)

  // ── HEADER ──
  drawHexLogo(ctx, 72 + 34, 76, 34, color)
  ctx.fillStyle = color
  ctx.font = '700 28px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('HOOPCONNECT', 72 + 34 + 46, 84)

  // Mode hex badge (top right) — reuse drawHexLogo then overwrite text
  const badgeCx = W - 72 - 34
  drawHexLogo(ctx, badgeCx, 76, 34, color)
  ctx.fillStyle = color
  ctx.font = `900 ${Math.round(34 * 0.52)}px "Barlow Condensed", sans-serif`
  ctx.textAlign = 'center'; ctx.textBaseline = 'middle'
  ctx.shadowColor = color; ctx.shadowBlur = 8
  ctx.fillText(match.mode.toUpperCase(), badgeCx, 76 + 34 * 0.04)
  ctx.shadowBlur = 0; ctx.textBaseline = 'alphabetic'

  // ── BIG HEADLINE ──
  ctx.fillStyle = '#FFFFFF'
  ctx.font = '900 190px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'center'
  ctx.shadowColor = color; ctx.shadowBlur = 55
  ctx.fillText('GRAMY!', W / 2, 284)
  ctx.shadowBlur = 0

  ctx.fillStyle = color
  ctx.font = '700 44px "Barlow Condensed", sans-serif'
  ctx.fillText('DOŁĄCZYŁEM DO MECZU', W / 2, 342)

  // ── DIVIDER ──
  ctx.strokeStyle = `${color}28`; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(72, 374); ctx.lineTo(W - 72, 374); ctx.stroke()

  // ── TEAMS SECTION (hero) ──────────────────────────────────────────────────
  const n = match.mode === '5v5' ? 5 : match.mode === '3v3' ? 3 : 2
  const homePlayers = (match.players || []).filter(p => p.team === 'home')
  const awayPlayers = (match.players || []).filter(p => p.team === 'away')
  const homeTeamName = (match._club?.name || 'Drużyna A').toUpperCase()
  const awayTeamName = (clubName || 'Rywale').toUpperCase()

  const hexR   = n === 5 ? 28 : n === 3 ? 38 : 44
  const hexGap = n === 5 ? 66 : n === 3 ? 88 : 100
  const homeGC = n === 5 ? W * 0.24 : W * 0.265
  const awayGC = n === 5 ? W * 0.76 : W * 0.735
  const slotsY = 536

  // Subtle glow halo behind each team group
  const gR = (n - 1) * hexGap / 2 + hexR * 1.8
  ;[{ cx: homeGC, c: color }, { cx: awayGC, c: '#FFA820' }].forEach(({ cx, c }) => {
    const glow = ctx.createRadialGradient(cx, slotsY, 0, cx, slotsY, gR)
    glow.addColorStop(0, `${c}14`)
    glow.addColorStop(1, 'transparent')
    ctx.fillStyle = glow
    ctx.fillRect(cx - gR, slotsY - gR, gR * 2, gR * 2)
  })

  // Team name labels
  const teamLabelY = slotsY - hexR - 36
  ctx.font = '800 34px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillStyle = color
  ctx.shadowColor = color; ctx.shadowBlur = 10
  ctx.fillText(homeTeamName.slice(0, 14), homeGC, teamLabelY)
  ctx.shadowBlur = 0

  ctx.fillStyle = '#FFA820'
  ctx.shadowColor = '#FFA820'; ctx.shadowBlur = 10
  ctx.fillText(awayTeamName.slice(0, 14), awayGC, teamLabelY)
  ctx.shadowBlur = 0

  // VS label (vertical center of slots)
  ctx.fillStyle = 'rgba(255,255,255,0.18)'
  ctx.font = '900 40px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('VS', W / 2, slotsY + hexR * 0.38)

  // Home slots
  const homeStartX = homeGC - (n - 1) * hexGap / 2
  for (let i = 0; i < n; i++) {
    drawSlotHex(homeStartX + i * hexGap, slotsY, hexR,
      homePlayers.find(p => p.slot === i + 1) || null, color)
  }

  // Away slots
  const awayStartX = awayGC - (n - 1) * hexGap / 2
  for (let i = 0; i < n; i++) {
    drawSlotHex(awayStartX + i * hexGap, slotsY, hexR,
      awayPlayers.find(p => p.slot === i + 1) || null, '#FFA820')
  }

  // Player count
  const totalFilled = homePlayers.length + awayPlayers.length
  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.font = '600 26px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${totalFilled} / ${n * 2} GRACZY`, W / 2, slotsY + hexR + 46)

  // ── DIVIDER ──
  const divY2 = slotsY + hexR + 82
  ctx.strokeStyle = `${color}20`; ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(72, divY2); ctx.lineTo(W - 72, divY2); ctx.stroke()

  // ── MATCH INFO ───────────────────────────────────────────────────────────
  const infoY = divY2 + 20
  const infoH = 208
  ctx.fillStyle = `${color}0C`
  roundRect(ctx, 72, infoY, W - 144, infoH, 24); ctx.fill()
  ctx.strokeStyle = `${color}1E`; ctx.lineWidth = 1.5
  roundRect(ctx, 72, infoY, W - 144, infoH, 24); ctx.stroke()
  // top highlight
  ctx.strokeStyle = `${color}38`; ctx.lineWidth = 1
  roundRect(ctx, 73, infoY + 1, W - 146, 1, 0); ctx.stroke()

  const d = new Date(match.scheduled_at)
  const dateStr = d.toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).toUpperCase()
  const timeStr = `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`

  // Mode — just "3V3", big + colored, left side
  ctx.fillStyle = color
  ctx.font = '900 60px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'left'
  ctx.shadowColor = color; ctx.shadowBlur = 14
  ctx.fillText(match.mode.toUpperCase(), 72 + 36, infoY + 68)
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(255,255,255,0.65)'
  ctx.font = '600 34px "Barlow Condensed", sans-serif'
  ctx.fillText(dateStr, 72 + 36, infoY + 116)

  ctx.fillStyle = 'rgba(255,255,255,0.45)'
  ctx.font = '500 30px "Barlow Condensed", sans-serif'
  ctx.fillText(`🕐  ${timeStr}`, 72 + 36, infoY + 158)

  if (match.address) {
    ctx.fillStyle = 'rgba(255,255,255,0.30)'
    ctx.font = '400 24px Barlow, sans-serif'
    const addr = match.address.length > 56 ? match.address.slice(0, 53) + '…' : match.address
    ctx.fillText('📍  ' + addr, 72 + 36, infoY + 196)
  }

  // ── CTA ──
  ctx.fillStyle = 'rgba(255,255,255,0.14)'
  ctx.font = '600 23px Barlow, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('DOŁĄCZ PRZEZ HOOPCONNECT', W / 2, infoY + infoH + 56)

  drawFooter(ctx, W, H)

  // ── COLORED BORDER FRAME ──
  ctx.strokeStyle = `${color}50`; ctx.lineWidth = 10
  roundRect(ctx, 5, 5, W - 10, H - 10, 0); ctx.stroke()
  ctx.strokeStyle = `${color}1A`; ctx.lineWidth = 3
  roundRect(ctx, 16, 16, W - 32, H - 32, 0); ctx.stroke()

  return canvasToBlob(canvas)
}

// ── WEB SHARE / DOWNLOAD ─────────────────────────────────────────────────────

// PNG → base64 bez prefiksu data-URL (tego oczekuje Capacitor Filesystem.writeFile).
function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader()
    r.onload = () => resolve(String(r.result).split(',')[1] || '')
    r.onerror = reject
    r.readAsDataURL(blob)
  })
}

// Otwiera systemowy share sheet (iOS / Android / desktop). User wybiera np. IG
// → Stories, Messages, AirDrop, Photos albo Save. Pełna integracja Web Share L2.
// meta = { title, text } — opcjonalny kontekst dla aplikacji odbierającej.
export async function doShare(blob, filename = 'hoopconnect.png', meta = {}) {
  const file = new File([blob], filename, { type: 'image/png', lastModified: Date.now() })
  const shareData = {
    files: [file],
    title: meta.title || 'HoopConnect',
    text:  meta.text  || 'Sprawdź mój wynik na HoopConnect 🏀',
  }
  // Natywna powłoka (Capacitor): Android WebView zwykle NIE ma navigator.share, a
  // fallback <a download> nie ma menedżera pobierań → udostępnianie cicho nic nie robi.
  // Zapisz PNG do cache apki i otwórz systemowy share sheet pluginem. Pluginy dochodzą
  // przy pakowaniu (@capacitor/share + @capacitor/filesystem); bez nich — jak na webie.
  const cap = typeof window !== 'undefined' ? window.Capacitor : null
  if (cap?.isNativePlatform?.() && cap.Plugins?.Share && cap.Plugins?.Filesystem) {
    try {
      const data = await blobToBase64(blob)
      const { uri } = await cap.Plugins.Filesystem.writeFile({ path: filename, data, directory: 'CACHE' })
      await cap.Plugins.Share.share({ title: shareData.title, text: shareData.text, files: [uri], dialogTitle: shareData.title })
      return { ok: true, method: 'native' }
    } catch (e) {
      if (/cancel/i.test(String(e?.message || e))) return { ok: false, method: 'cancelled' }
      console.warn('[share] native share failed', e)
    }
  }
  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share(shareData)
      return { ok: true, method: 'system' }
    }
  } catch (e) {
    if (e?.name === 'AbortError') return { ok: false, method: 'cancelled' }
    console.warn('[share] navigator.share failed', e)
  }
  // Fallback: pobierz plik PNG (Firefox desktop, niektóre desktop browsers)
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
  return { ok: true, method: 'download' }
}
