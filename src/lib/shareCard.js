/**
 * Canvas-based share card generator — no external deps.
 * Generates a 1080×1080 PNG image and shares via Web Share API (or downloads as fallback).
 */

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

// ── SHOT TYPE GRAPHIC ─────────────────────────────────────────────────────────
// Draws a simplified court-line icon at (cx, cy) representing the shot zone.
function drawShotTypeGraphic(ctx, cx, cy, color) {
  ctx.save()
  ctx.strokeStyle = `${color}70`
  ctx.lineWidth = 7
  ctx.lineCap = 'round'

  // Basket (small circle at top)
  const baskY = cy - 110
  ctx.beginPath()
  ctx.arc(cx, baskY, 18, 0, Math.PI * 2)
  ctx.fillStyle = `${color}25`
  ctx.fill()
  ctx.strokeStyle = `${color}88`
  ctx.lineWidth = 6
  ctx.stroke()

  // Rim line
  ctx.beginPath()
  ctx.moveTo(cx - 24, baskY + 18)
  ctx.lineTo(cx + 24, baskY + 18)
  ctx.strokeStyle = `${color}55`
  ctx.lineWidth = 5
  ctx.stroke()

  // Shot arc / line — differs by type
  ctx.lineWidth = 6
  ctx.strokeStyle = `${color}60`

  // The three arcs are centred on the *basket*, curving from the shooter's spot
  // We draw them from cy (shooter level) up toward the basket
  const rad3  = 200   // 3pt — wide arc
  const rad2  = 130   // 2pt — mid arc
  const radFT = 0     // ft  — straight

  if (color /* always true, just for structure */) {
    // Ball dot (shooter position)
    ctx.beginPath()
    ctx.arc(cx, cy, 22, 0, Math.PI * 2)
    ctx.fillStyle = `${color}30`
    ctx.fill()
    ctx.strokeStyle = `${color}70`
    ctx.lineWidth = 5
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(cx, cy, 10, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.shadowColor = color
    ctx.shadowBlur = 14
    ctx.fill()
    ctx.shadowBlur = 0
  }

  ctx.restore()
}

// Draws a basketball-court zone indicator below the badge area
function drawCourtZone(ctx, W, shotType, pctColor) {
  // position: right side, vertically between header and big %
  const cx = W - 72 - 90, cy = 175
  const sz  = 54

  ctx.save()

  // Background hex
  drawHexLogo(ctx, cx, cy, sz, pctColor)

  // Shot-type label inside (already drawn by hex logo as "HC")
  // Overwrite inner text with shot type abbreviation
  const abbr = shotType === '3pt' ? '3PT' : shotType === '2pt' ? '2PT' : 'FT'
  ctx.fillStyle = pctColor
  ctx.font = `900 ${Math.round(sz * 0.5)}px "Barlow Condensed", sans-serif`
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.shadowColor = pctColor
  ctx.shadowBlur = 10
  ctx.fillText(abbr, cx, cy + sz * 0.04)
  ctx.shadowBlur = 0
  ctx.textBaseline = 'alphabetic'
  ctx.restore()
}

// ── SESSION CARD ─────────────────────────────────────────────────────────────

export async function shareSessionCard({ made, attempted, target, shotType, playerName }) {
  await document.fonts.ready

  const W = 1080, H = 1080
  const canvas = document.createElement('canvas')
  canvas.width = W; canvas.height = H
  const ctx = canvas.getContext('2d')

  const pct = attempted > 0 ? Math.round((made / attempted) * 100) : 0
  const missed = attempted - made
  const pctColor = pct >= 60 ? '#00E676' : pct >= 40 ? '#5BB8F5' : '#FF5050'

  const typeLabels = { '3pt': 'TRÓJKI', '2pt': 'MID-RANGE', ft: 'WOLNE' }
  const typeLabel = typeLabels[shotType] || 'SESJA'

  drawBackground(ctx, W, H, pctColor)

  // ── HEADER: hex logo + HOOPCONNECT wordmark ──
  drawHexLogo(ctx, 72 + 34, 76, 34, '#5BB8F5')
  ctx.fillStyle = '#5BB8F5'
  ctx.font = '700 28px "Barlow Condensed", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText('HOOPCONNECT', 72 + 34 + 46, 84)

  // ── SHOT-TYPE HEX (right side of header) ──
  drawCourtZone(ctx, W, shotType, pctColor)

  // ── BIG % ──
  ctx.fillStyle = pctColor
  ctx.font = `900 ${pct >= 100 ? 220 : 260}px "Barlow Condensed", sans-serif`
  ctx.textAlign = 'center'
  ctx.shadowColor = pctColor
  ctx.shadowBlur = 20
  ctx.fillText(`${pct}%`, W / 2, 390)
  ctx.shadowBlur = 0

  ctx.fillStyle = 'rgba(255,255,255,0.28)'
  ctx.font = '600 20px Barlow, sans-serif'
  ctx.fillText('SKUTECZNOŚĆ', W / 2, 432)

  // made/attempted
  ctx.fillStyle = 'rgba(255,255,255,0.75)'
  ctx.font = '700 50px "Barlow Condensed", sans-serif'
  ctx.fillText(`${made}/${attempted} RZUTÓW`, W / 2, 498)

  // ── DIVIDER ──
  ctx.strokeStyle = 'rgba(255,255,255,0.07)'
  ctx.lineWidth = 1
  ctx.beginPath(); ctx.moveTo(72, 528); ctx.lineTo(W - 72, 528); ctx.stroke()

  // ── STAT BOXES ──
  const boxW = (W - 144 - 16) / 2
  drawStatBox(ctx,  72,             548, boxW, 165, String(made),   'TRAFIONE', '#00E676')
  drawStatBox(ctx, 72 + boxW + 16,  548, boxW, 165, String(missed), 'PUDŁA',    '#FF5050')

  // ── PROGRESS BAR ──
  const bX = 72, bY = 733, bW = W - 144, bH = 10
  ctx.fillStyle = 'rgba(255,255,255,0.07)'
  roundRect(ctx, bX, bY, bW, bH, 5); ctx.fill()

  const fill = bW * Math.min(attempted / Math.max(target, 1), 1)
  const barG = ctx.createLinearGradient(bX, 0, bX + bW, 0)
  barG.addColorStop(0, pctColor); barG.addColorStop(1, `${pctColor}88`)
  ctx.fillStyle = barG
  roundRect(ctx, bX, bY, fill, bH, 5); ctx.fill()

  ctx.fillStyle = 'rgba(255,255,255,0.25)'
  ctx.font = '500 20px Barlow, sans-serif'
  ctx.fillText(`${attempted} Z ${target} RZUTÓW DO CELU`, W / 2, 775)

  // player name
  if (playerName) {
    ctx.fillStyle = 'rgba(255,255,255,0.40)'
    ctx.font = '600 26px "Barlow Condensed", sans-serif'
    ctx.fillText(playerName.toUpperCase(), W / 2, 840)
  }

  drawFooter(ctx, W, H)

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
  const totalPct  = totalAtt > 0 ? Math.round(totalMade / totalAtt * 100) : 0

  const byType = {}
  sessions.forEach(s => {
    if (!byType[s.shot_type]) byType[s.shot_type] = { made: 0, att: 0 }
    byType[s.shot_type].made += s.made
    byType[s.shot_type].att  += s.attempted
  })
  const pct3  = byType['3pt']?.att > 0 ? Math.round(byType['3pt'].made / byType['3pt'].att * 100) : 0
  const pct2  = byType['2pt']?.att > 0 ? Math.round(byType['2pt'].made / byType['2pt'].att * 100) : 0
  const pctFT = byType.ft?.att   > 0 ? Math.round(byType.ft.made   / byType.ft.att   * 100) : 0

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

// ── WEB SHARE / DOWNLOAD ─────────────────────────────────────────────────────

export async function doShare(blob, filename = 'hoopconnect.png') {
  const file = new File([blob], filename, { type: 'image/png' })
  try {
    if (navigator.share && navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: 'HoopConnect' })
      return
    }
  } catch (e) {
    if (e.name === 'AbortError') return  // user cancelled
  }
  // Fallback: download
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url; a.download = filename; a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}
