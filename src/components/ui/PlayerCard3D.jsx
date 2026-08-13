/**
 * PlayerCard3D — latająca karta zawodnika (drag = obrót, holograficzny połysk,
 * realna grubość 3D przez stos warstw, kształt keycard z wcięciem).
 * Avatar + ramka renderowane przez HexAvatar (ramka warunkowa wg equipped_frame).
 *
 * Props:
 *   name, hcId, arenaLevel, xp, frameVariant, matchWins, kotcWins
 */
import { useEffect, useRef } from 'react'
import HexAvatar from './HexAvatar'
import { ARENAS, arenaProgress } from '../../lib/arenas'

const CSS = `
.pc3d-stage { perspective: 1300px; perspective-origin: 50% 45%; position: relative;
  display: flex; align-items: center; justify-content: center; padding: 18px 0 8px; }
.pc3d-floor { position: absolute; left: 50%; bottom: 6px; transform: translateX(-50%);
  width: 252px; height: 44px; border-radius: 50%; z-index: -1;
  background: radial-gradient(ellipse at center, rgba(0,0,0,.6), rgba(0,0,0,0) 70%); filter: blur(9px); }
.pc3d-card { --rx: -8; --ry: -14; position: relative; width: 300px; height: 452px;
  transform-style: preserve-3d; transform: rotateX(calc(var(--rx)*1deg)) rotateY(calc(var(--ry)*1deg));
  cursor: grab; touch-action: none; user-select: none; -webkit-user-select: none; }
.pc3d-card:active { cursor: grabbing; }
.pc3d-sil { clip-path: path('M22,0 L278,0 Q300,0 300,22 L300,400 Q300,414 286,414 L210,414 Q196,414 192,428 L182,440 Q178,452 164,452 L22,452 Q0,452 0,430 L0,22 Q0,0 22,0 Z'); }
.pc3d-body { position: absolute; inset: 0; transform-style: preserve-3d; }
.pc3d-slab { position: absolute; inset: 0; background: linear-gradient(158deg, #4a648c 0%, #26394f 52%, #0d1a2b 100%); }
.pc3d-face { position: absolute; inset: 0; overflow: hidden; padding: 18px 20px 14px;
  display: flex; flex-direction: column;
  background: linear-gradient(157deg, #16304f 0%, #0d1f38 46%, #0a1830 100%);
  border: 1px solid rgba(150,200,255,.28); }
.pc3d-face::before { content: ''; position: absolute; top: 0; left: 0; right: 0; height: 40%;
  background: linear-gradient(180deg, rgba(150,205,255,.16), transparent); pointer-events: none; }
.pc3d-holo { position: absolute; inset: -20%; pointer-events: none; z-index: 4; mix-blend-mode: screen; opacity: .55;
  background: linear-gradient(calc(118deg + var(--ry)*1.6deg),
    rgba(0,240,220,0) 8%, rgba(120,200,255,.42) 30%, rgba(190,130,255,.42) 46%,
    rgba(255,150,210,.30) 56%, rgba(120,255,220,.34) 72%, rgba(0,240,220,0) 92%); }
.pc3d-spec { position: absolute; inset: 0; pointer-events: none; z-index: 5; mix-blend-mode: screen;
  background: radial-gradient(120% 80% at calc(50% + var(--ry)*1.5%) calc(38% - var(--rx)*1.4%),
    rgba(255,255,255,.42), rgba(255,255,255,.05) 40%, transparent 60%); }
.pc3d-grid { position: absolute; inset: 0; pointer-events: none; z-index: 3; opacity: .06;
  background-image: linear-gradient(rgba(150,200,255,1) 1px, transparent 1px); background-size: 100% 8px; }
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
.pc3d-hint { text-align: center; font-family: var(--font-display); font-weight: 700; font-size: 10px; letter-spacing: .22em; text-transform: uppercase; color: rgba(160,190,220,.45); margin-top: 6px; }
@media (prefers-reduced-motion: reduce) { .pc3d-holo, .pc3d-spec { transition: none; } }
`

function arenaImg(i) { return `/arenas/arena-${i}.png` }

export default function PlayerCard3D({ name, hcId, arenaLevel = 0, xp = 0, frameVariant = 'none', matchWins = 0, kotcWins = 0 }) {
  const cardRef = useRef(null)
  const slabsRef = useRef(null)

  const prog = arenaProgress(xp, arenaLevel)
  const curArena = ARENAS[prog.current] || ARENAS[0]
  const nextArena = prog.next != null ? ARENAS[prog.next] : null
  const pct = Math.max(6, Math.min(100, prog.pct ?? 0))

  // slab extrusion (once)
  useEffect(() => {
    const slabs = slabsRef.current
    if (!slabs || slabs.childElementCount) return
    const N = 20, step = 1.15
    for (let i = 1; i <= N; i++) {
      const d = document.createElement('div')
      d.className = 'pc3d-slab pc3d-sil'
      d.style.transform = `translateZ(-${(i * step).toFixed(2)}px)`
      d.style.filter = `brightness(${(1 - (i / N) * 0.55).toFixed(3)})`
      slabs.appendChild(d)
    }
  }, [])

  // drag-to-rotate + idle float
  useEffect(() => {
    const card = cardRef.current
    if (!card) return
    let rx = -8, ry = -14, tx = -8, ty = -14
    let dragging = false, sx = 0, sy = 0, brx = 0, bry = 0
    let t0 = performance.now(), raf = 0
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v))
    const loop = (now) => {
      if (!dragging) {
        const s = (now - t0) / 1000
        tx = -8 + Math.sin(s * 0.6) * 4
        ty = -14 + Math.sin(s * 0.45) * 7
      }
      rx += (tx - rx) * 0.12
      ry += (ty - ry) * 0.12
      card.style.setProperty('--rx', rx.toFixed(2))
      card.style.setProperty('--ry', ry.toFixed(2))
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const down = (e) => { dragging = true; sx = e.clientX; sy = e.clientY; brx = rx; bry = ry; try { card.setPointerCapture(e.pointerId) } catch (_) {} }
    const move = (e) => { if (!dragging) return; ty = clamp(bry + (e.clientX - sx) * 0.38, -46, 46); tx = clamp(brx - (e.clientY - sy) * 0.34, -34, 34) }
    const up = () => { if (dragging) { dragging = false; t0 = performance.now() } }
    card.addEventListener('pointerdown', down)
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    return () => { cancelAnimationFrame(raf); card.removeEventListener('pointerdown', down); window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up) }
  }, [])

  return (
    <>
      <style>{CSS}</style>
      <div className="pc3d-stage">
        <div className="pc3d-floor" />
        <div className="pc3d-card" ref={cardRef}>
          <div className="pc3d-body pc3d-sil" ref={slabsRef} />
          <div className="pc3d-face pc3d-sil">
            <div className="pc3d-grid" />
            <div className="pc3d-holo" />
            <div className="pc3d-spec" />
            <div className="pc3d-slot" />
            <div className="pc3d-content">
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
            </div>
          </div>
        </div>
      </div>
      <div className="pc3d-hint">↔ Przeciągnij, aby obrócić</div>
    </>
  )
}
