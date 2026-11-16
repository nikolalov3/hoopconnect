/**
 * Obrót karty gracza myszą i palcem, jak w apce (PlayerCard3D): lekki przechył w stronę kursora w promieniu karty
 * i przeciąganie. Bez bujania w pętli: pętla rAF działa tylko w trakcie ruchu (zasada wydajności z BRAND.md).
 *
 * Ruch niczego nie maluje: skrypt ustawia transform na trzech elementach (karta i dwie warstwy połysku, patrz
 * PlayerCard.astro, .pc-live), resztę składa karta graficzna. W przeglądarkach bez sin() w CSS zostaje droga
 * przez zmienne --rx0/--ry0 (połysk to wtedy zwykły gradient). Wzory te same, co w hero na stronie głównej.
 */
const TRIG = typeof CSS !== 'undefined' && typeof CSS.supports === 'function' && CSS.supports('width', 'calc(1px * sin(1deg))')
const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))

export function attachTilt(root: HTMLElement, opts: { rest?: { x: number; y: number }; zone?: HTMLElement } = {}) {
  const rest = opts.rest ?? { x: -6, y: -14 }
  const zone = opts.zone ?? root.parentElement ?? root
  const card = root.querySelector<HTMLElement>('.pc3d-card')
  const holo = root.querySelector<HTMLElement>('.pc3d-holo')
  const spec = root.querySelector<HTMLElement>('.pc3d-spec')
  if (!card) return { destroy() {} }
  root.classList.add('pc-live')

  const fine = matchMedia('(hover: hover) and (pointer: fine)').matches
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches
  let rx = rest.x, ry = rest.y, tx = rest.x, ty = rest.y, px = NaN, py = NaN
  let running = false, raf = 0
  let drag: { sx: number; sy: number; brx: number; bry: number; moved: boolean } | null = null

  const paint = () => {
    if (px === rx && py === ry) return
    px = rx; py = ry
    if (TRIG) {
      const a = 118 + ry * 1.6, r = (a * Math.PI) / 180
      const len = Math.abs(Math.sin(r)) * 300 + Math.abs(Math.cos(r)) * 452
      card.style.transform = `scale(var(--pcs)) translate(150px, 226px) perspective(1150px) rotateX(${rx.toFixed(2)}deg) rotateY(${ry.toFixed(2)}deg) translate(-150px, -226px)`
      if (holo) holo.style.transform = `rotate(${a.toFixed(2)}deg) scaleY(${(len / 560).toFixed(4)})`
      if (spec) spec.style.transform = `translate(${(ry * 4.5).toFixed(1)}px, ${(rx * -6.328).toFixed(1)}px)`
    } else {
      root.style.setProperty('--rx0', rx.toFixed(2)); root.style.setProperty('--ry0', ry.toFixed(2))
    }
  }
  const loop = () => {
    rx += (tx - rx) * 0.12; ry += (ty - ry) * 0.12
    paint()
    const busy = Math.abs(tx - rx) > 0.03 || Math.abs(ty - ry) > 0.03
    if (busy || drag) raf = requestAnimationFrame(loop); else running = false
  }
  const kick = () => { if (!running) { running = true; raf = requestAnimationFrame(loop) } }
  paint()

  const onMove = (e: PointerEvent) => {
    if (drag || !fine || reduce) return
    const r = card.getBoundingClientRect()
    const R = Math.max(260, r.width * 1.2)
    const dx = e.clientX - (r.left + r.width / 2), dy = e.clientY - (r.top + r.height / 2)
    const d = Math.hypot(dx, dy)
    if (d < R) { const k = 1 - d / R; ty = rest.y + (dx / R) * 24 * k; tx = rest.x - (dy / R) * 18 * k } else { tx = rest.x; ty = rest.y }
    kick()
  }
  const onLeave = () => { if (drag) return; tx = rest.x; ty = rest.y; kick() }
  const onDown = (e: PointerEvent) => {
    drag = { sx: e.clientX, sy: e.clientY, brx: rx, bry: ry, moved: false }
    try { root.setPointerCapture(e.pointerId) } catch { /* brak przechwytu: obrót nadal działa */ }
    kick()
  }
  const onDrag = (e: PointerEvent) => {
    if (!drag) return
    const dx = e.clientX - drag.sx, dy = e.clientY - drag.sy
    if (Math.hypot(dx, dy) > 6) drag.moved = true
    ty = clamp(drag.bry + dx * 0.38, -46, 46); tx = clamp(drag.brx - dy * 0.34, -34, 34)
  }
  const onUp = () => { if (!drag) return; drag = null; tx = rest.x; ty = rest.y; kick() }

  zone.addEventListener('pointermove', onMove)
  zone.addEventListener('pointerleave', onLeave)
  root.addEventListener('pointerdown', onDown)
  root.addEventListener('pointermove', onDrag)
  root.addEventListener('pointerup', onUp)
  root.addEventListener('pointercancel', onUp)
  return {
    destroy() {
      cancelAnimationFrame(raf)
      zone.removeEventListener('pointermove', onMove); zone.removeEventListener('pointerleave', onLeave)
      root.removeEventListener('pointerdown', onDown); root.removeEventListener('pointermove', onDrag)
      root.removeEventListener('pointerup', onUp); root.removeEventListener('pointercancel', onUp)
    },
  }
}
