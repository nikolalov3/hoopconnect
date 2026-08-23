/**
 * PlayerCard3D — karta zawodnika: PŁASKA plakietka (bez grubości/głębi), ale
 * przechyla się przy przeciąganiu (perspective+rotate na JEDNEJ płaszczyźnie —
 * bez preserve-3d i bez zagnieżdżonych warstw 3D). Holograficzny połysk reaguje
 * na przechył. Kształt keycard z wcięciem u dołu (clip-path na .pc3d-face — czyli
 * na DZIECKU, które samo nie ma transformacji; tilt jest na rodzicu .pc3d-card).
 * Ten rozdział (clip-path osobno od perspektywy) + brak backdrop-filter nad kartą
 * to zabezpieczenie przed bugiem "trójkątnego ucinania" na WebKit/iOS.
 * Avatar + ramka renderowane przez HexAvatar (ramka warunkowa wg equipped_frame).
 *
 * Props:
 *   name, hcId, arenaLevel, xp, frameVariant, matchWins, kotcWins
 *   interactive — drag-to-rotate (domyślnie true); idle — delikatne bujanie w spoczynku.
 */
import { useEffect, useRef } from 'react'
import HexAvatar from './HexAvatar'
import { ARENAS, arenaProgress } from '../../lib/arenas'

const CSS = `
.pc3d-stage { position: relative;
  display: flex; align-items: center; justify-content: center; padding: 18px 0 8px; }
.pc3d-card { --rx: -8; --ry: -14; position: relative; width: 300px; height: 452px;
  /* FLAT plaque that tilts: perspective+rotate on THIS single plane only (no
     transform-style:preserve-3d, no nested 3D layers, no thickness). --rx/--ry are
     driven by the drag handler; the defaults are the resting tilt (also used by
     non-interactive/static cards so the holo calc() always has a value). */
  transform: perspective(1150px) rotateX(calc(var(--rx)*1deg)) rotateY(calc(var(--ry)*1deg));
  transform-origin: 50% 50%; will-change: transform;
  /* Soft drop-shadow via filter (not box-shadow) so it hugs the notched silhouette
     and tilts with the card — a flat grounding shadow, not an extruded edge. */
  filter: drop-shadow(0 9px 18px rgba(0,0,0,0.34));
  cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.pc3d-card:active { cursor: grabbing; }
/* Keycard shape with the bottom-right notch (clip-path). It lives on .pc3d-face — a
   child that carries NO transform — while the perspective/tilt lives on the parent
   .pc3d-card. Keeping the clip-path off the transformed node avoids the WebKit/iOS
   triangle mis-clip; there is no preserve-3d anywhere. */
.pc3d-sil { clip-path: path('M22,0 L278,0 Q300,0 300,22 L300,400 Q300,414 286,414 L210,414 Q196,414 192,428 L182,440 Q178,452 164,452 L22,452 Q0,452 0,430 L0,22 Q0,0 22,0 Z'); }
.pc3d-face { position: absolute; inset: 0; padding: 18px 20px 14px;
  display: flex; flex-direction: column;
  background: linear-gradient(157deg, #16304f 0%, #0d1f38 46%, #0a1830 100%);
  border: 1px solid rgba(150,200,255,.28); }
.pc3d-face::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 40%;
  background: linear-gradient(180deg, rgba(150,205,255,.16), transparent); pointer-events: none; }
.pc3d-bg { position: absolute; inset: 0; z-index: 0; background-size: cover; background-position: center; background-repeat: no-repeat; }
.pc3d-bg::after { content: ''; position: absolute; inset: 0;
  background: linear-gradient(158deg,
    rgba(236,72,153,.30) 0%, rgba(168,60,224,.30) 46%, rgba(30,8,50,.66) 100%); }
/* Holographic sheen — angle shifts with the tilt (--ry/--rx always have a default
   from .pc3d-card so the calc() is valid even on non-interactive cards). */
.pc3d-holo { position: absolute; inset: 0; pointer-events: none; z-index: 4; mix-blend-mode: screen; opacity: .5;
  background: linear-gradient(calc(118deg + var(--ry)*1.6deg),
    rgba(0,240,220,0) 8%, rgba(120,200,255,.42) 30%, rgba(190,130,255,.42) 46%,
    rgba(255,150,210,.30) 56%, rgba(120,255,220,.34) 72%, rgba(0,240,220,0) 92%); }
/* Cards with a custom background get a warmer pink/violet/gold holo to match;
   plain (no-background) cards keep the neutral shimmer above. */
.pc3d-hasbg .pc3d-holo { opacity: .58;
  background: linear-gradient(calc(118deg + var(--ry)*1.6deg),
    rgba(255,120,210,0) 8%, rgba(255,120,210,.42) 28%, rgba(190,110,255,.46) 46%,
    rgba(255,185,120,.34) 60%, rgba(120,220,255,.30) 74%, rgba(255,120,210,0) 92%); }
.pc3d-spec { position: absolute; inset: 0; pointer-events: none; z-index: 5; mix-blend-mode: screen;
  background: radial-gradient(120% 80% at calc(50% + var(--ry)*1.5%) calc(38% - var(--rx)*1.4%),
    rgba(255,255,255,.4), rgba(255,255,255,.05) 40%, transparent 60%); }
.pc3d-slot { position: absolute; top: 8px; left: 50%; transform: translateX(-50%); z-index: 7;
  width: 54px; height: 9px; border-radius: 999px; background: #050c18;
  box-shadow: inset 0 1px 2px rgba(0,0,0,.8), 0 1px 0 rgba(150,200,255,.14); }
.pc3d-content { position: relative; z-index: 6; display: flex; flex-direction: column; height: 100%; }
.pc3d-hdr { display: flex; align-items: center; gap: 9px; margin-top: 10px; margin-bottom: 4px; }
.pc3d-hdr img { width: 26px; height: 26px; flex: none; filter: drop-shadow(0 2px 6px rgba(60,140,220,.5)); }
.pc3d-wm { font-family: var(--font-display); font-weight: 900; font-size: 20px; letter-spacing: .06em; text-transform: uppercase; line-height: 1; color: #EAF2FF; }
.pc3d-wm i { font-style: normal; color: #5BB8F5; }
.pc3d-av { display: flex; justify-content: center; margin: 6px auto 2px; }
.pc3d-name { text-align: center; font-family: var(--font-display); font-weight: 900; font-size: 28px; letter-spacing: .01em; text-transform: uppercase; line-height: 1; margin-top: 6px; color: #F2F7FF; }
.pc3d-arena { text-align: center; font-family: var(--font-display); font-weight: 700; font-size: 12px; letter-spacing: .18em; text-transform: uppercase; color: #8FD3FF; margin-top: 5px; }
.pc3d-prog { display: flex; align-items: center; gap: 11px; margin: 10px 2px 0; }
.pc3d-ah { width: 32px; height: 32px; object-fit: contain; flex: none; filter: drop-shadow(0 2px 8px rgba(0,0,0,.5)); }
.pc3d-ah.next { opacity: .38; filter: grayscale(.5) drop-shadow(0 2px 6px rgba(0,0,0,.4)); }
.pc3d-track { flex: 1; position: relative; height: 6px; border-radius: 999px; background: rgba(150,200,255,.13); box-shadow: inset 0 0 0 1px rgba(150,200,255,.06); }
.pc3d-fill { position: absolute; left: 0; top: 0; bottom: 0; border-radius: 999px; background: linear-gradient(90deg, #1E6BB0, #8FD3FF); box-shadow: 0 0 12px rgba(120,200,255,.55); }
.pc3d-node { position: absolute; top: 50%; width: 11px; height: 11px; border-radius: 50%; transform: translate(-50%,-50%); background: #EAF7FF; box-shadow: 0 0 10px 2px rgba(150,220,255,.9), 0 0 0 3px rgba(120,200,255,.22); }
.pc3d-cap { text-align: center; margin-top: 7px; font-family: var(--font-display); font-weight: 700; font-size: 9.5px; letter-spacing: .12em; text-transform: uppercase; color: #86a6c6; }
.pc3d-cap b { color: #8FD3FF; }
.pc3d-stats { display: flex; gap: 7px; margin-top: 11px; }
.pc3d-stat { flex: 1; text-align: center; background: rgba(8,20,40,.5); border: 1px solid rgba(150,200,255,.12); border-radius: 10px; padding: 8px 4px; }
.pc3d-stat b { display: block; font-family: var(--font-display); font-weight: 900; font-size: 17px; color: #EAF2FF; line-height: 1; }
.pc3d-stat span { font-family: var(--font-display); font-weight: 700; font-size: 8px; letter-spacing: .12em; color: #7d9cbb; text-transform: uppercase; }
.pc3d-foot { margin-top: auto; padding-top: 12px; border-top: 1px solid rgba(150,200,255,.12); }
.pc3d-foot .id { font-family: var(--font-display); font-weight: 700; font-size: 9px; letter-spacing: .1em; color: #6f8dab; line-height: 1.5; }
.pc3d-foot .id b { color: #a9c6e4; }
@media (prefers-reduced-motion: reduce) { .pc3d-holo, .pc3d-spec { transition: none; } }
`

// Wstrzyknij CSS RAZ do <head> (przy imporcie modułu), zamiast <style> per render.
// Dzięki temu style są gotowe zanim karta pierwszy raz się namaluje — inaczej
// przy pierwszym otwarciu profilu widać było szare warstwy grubości zamiast lica
// (style łapały się o klatkę za późno; drugie otwarcie działało bo <style> już był).
if (typeof document !== 'undefined' && !document.getElementById('pc3d-styles')) {
  const _el = document.createElement('style')
  _el.id = 'pc3d-styles'
  _el.textContent = CSS
  document.head.appendChild(_el)
}

function arenaImg(i) { return `/arenas/arena-${i}.png` }

export default function PlayerCard3D({ name, hcId, arenaLevel = 0, xp = 0, frameVariant = 'none', matchWins = 0, kotcWins = 0, scale = 1, background = null, interactive = true, blank = false, idle = false }) {
  const cardRef = useRef(null)

  const prog = arenaProgress(xp, arenaLevel)
  const curArena = ARENAS[prog.current] || ARENAS[0]
  const nextArena = prog.next != null ? ARENAS[prog.next] : null
  const pct = Math.max(6, Math.min(100, prog.pct ?? 0))

  // Drag-to-rotate + idle sway on a single FLAT plane (writes --rx/--ry on the card;
  // .pc3d-card's transform reads them). No 3D depth — just the tilt. Static previews
  // (interactive=false) bind no handlers so a tap selects instead of rotating. The
  // rAF loop runs only while dragging/settling (or while idle) — zero repaint at rest.
  useEffect(() => {
    const card = cardRef.current
    if (!card || !interactive) return
    const REST_X = -8, REST_Y = -14
    let rx = REST_X, ry = REST_Y, tx = REST_X, ty = REST_Y
    let dragging = false, sx = 0, sy = 0, brx = 0, bry = 0
    let raf = 0, running = false, t0 = 0
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
    const apply = () => {
      card.style.setProperty('--rx', rx.toFixed(2))
      card.style.setProperty('--ry', ry.toFixed(2))
    }
    const loop = (now) => {
      if (!t0) t0 = now || 0
      if (idle && !dragging) {
        const s = ((now || 0) - t0) / 1000
        tx = REST_X + Math.sin(s * 0.5) * 2.5
        ty = REST_Y + Math.sin(s * 0.35) * 4
      }
      rx += (tx - rx) * 0.12
      ry += (ty - ry) * 0.12
      apply()
      if (!idle && !dragging && Math.abs(tx - rx) < 0.05 && Math.abs(ty - ry) < 0.05) {
        rx = tx; ry = ty; apply(); running = false; return   // settled → stop (non-idle)
      }
      raf = requestAnimationFrame(loop)
    }
    const kick = () => { if (!running) { running = true; raf = requestAnimationFrame(loop) } }
    const down = (e) => { dragging = true; sx = e.clientX; sy = e.clientY; brx = rx; bry = ry; try { card.setPointerCapture(e.pointerId) } catch (_) {}; kick() }
    const move = (e) => { if (!dragging) return; ty = clamp(bry + (e.clientX - sx) * 0.38, -46, 46); tx = clamp(brx - (e.clientY - sy) * 0.34, -34, 34); kick() }
    const up = () => { if (!dragging) return; dragging = false; tx = REST_X; ty = REST_Y; kick() }
    card.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    apply()
    if (idle) kick()
    return () => { cancelAnimationFrame(raf); card.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [interactive, idle])

  const stage = (
    <div className="pc3d-stage">
        <div className="pc3d-card" ref={cardRef}>
          <div className={`pc3d-face pc3d-sil${background ? ' pc3d-hasbg' : ''}`}>
            {background && <div className="pc3d-bg" style={{ backgroundImage: `url(${background})` }} />}
            <div className="pc3d-holo" />
            <div className="pc3d-spec" />
            {!blank && <div className="pc3d-content">
              <div className="pc3d-hdr">
                <img src="/hoop.svg" alt="" />
                <div className="pc3d-wm">HOOP<i>CONNECT</i></div>
              </div>

              <div className="pc3d-av">
                <HexAvatar name={name} size={118} variant={frameVariant} />
              </div>

              <div className="pc3d-name">{name || '—'}</div>
              <div className="pc3d-arena">{curArena?.name}{arenaLevel != null ? ` · Arena ${arenaLevel}` : ''}</div>

              <div className="pc3d-prog">
                <img className="pc3d-ah" src={arenaImg(prog.current)} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
                <div className="pc3d-track">
                  <div className="pc3d-fill" style={{ width: `${pct}%` }} />
                  <div className="pc3d-node" style={{ left: `${pct}%` }} />
                </div>
                {nextArena && <img className="pc3d-ah next" src={arenaImg(prog.next)} alt="" onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />}
              </div>
              <div className="pc3d-cap">
                {nextArena
                  ? <>Jeszcze <b>{prog.toNext} XP</b> do areny {nextArena.name}</>
                  : <>Szczyt osiągnięty — <b>{curArena?.name}</b></>}
              </div>

              <div className="pc3d-stats">
                <div className="pc3d-stat"><b>{matchWins}</b><span>🏀 Wygrane mecze</span></div>
                <div className="pc3d-stat"><b>{kotcWins}</b><span>👑 Wygrane KotC</span></div>
              </div>

              <div className="pc3d-foot">
                <div className="id">HC-ID · <b>{hcId ?? '—'}</b></div>
              </div>
            </div>}
          </div>
        </div>
      </div>
  )

  if (scale && scale !== 1) {
    // Reserve the scaled footprint (transform doesn't shrink the layout box) so a
    // smaller card doesn't leave a tall gap. The clip-path is in the card's local
    // coords, so it scales cleanly with this ancestor transform.
    return (
      <div style={{ width: 300 * scale, height: 478 * scale, margin: '0 auto' }}>
        <div style={{ width: 300, transform: `scale(${scale})`, transformOrigin: 'top left' }}>
          {stage}
        </div>
      </div>
    )
  }
  return stage
}
