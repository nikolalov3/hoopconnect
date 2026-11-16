// Wspólny ruch stron (główna, ranking): liczniki, wejścia przy scrollu, sceny sticky.
// Zasada z BRAND.md: animujemy tylko transform i opacity; liczniki zmieniają kilka węzłów tekstu przez ok. sekundę.

export const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches
export const hasIO = () => 'IntersectionObserver' in window
export const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms))

/** Liczba dobija do celu z wyhamowaniem (ease-out cubic). */
export function countUp(el: HTMLElement, to: number, ms: number, from = 0): Promise<void> {
  return new Promise((res) => {
    const t0 = performance.now()
    const step = (t: number) => {
      const p = Math.min(1, (t - t0) / ms)
      el.textContent = String(Math.round(from + (to - from) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) requestAnimationFrame(step); else res()
    }
    requestAnimationFrame(step)
  })
}

/** Jednorazowo: wywołaj cb, gdy element wjedzie na ekran. Bez IntersectionObserver od razu. */
export function onceVisible(el: Element, cb: () => void, threshold = 0.4) {
  if (!hasIO()) { cb(); return }
  const io = new IntersectionObserver((en) => { if (en[0].isIntersecting) { io.disconnect(); cb() } }, { threshold })
  io.observe(el)
}

/** Liczniki pojedyncze: <b data-count="620">620</b> startuje od zera, gdy wjedzie na ekran. */
export function initCounters(root: ParentNode = document) {
  if (prefersReducedMotion() || !hasIO()) return
  root.querySelectorAll<HTMLElement>('[data-count]').forEach((el) => {
    const to = Number(el.dataset.count)
    el.textContent = '0'
    onceVisible(el, () => { setTimeout(() => countUp(el, to, 1000), 150) }, 0.6)
  })
}

/**
 * Sceny sticky: obraz przyklejony, kroki tekstu przewijają się obok. Krok, który przecina linię
 * ok. 55% wysokości okna (na telefonie ok. 2/3), ustawia data-step na scenie i klasę .on na sobie.
 * Bez scroll-jackingu i bez liczenia pozycji w pętli. onStep pozwala stronie dołożyć własną reakcję.
 */
export function initScenes(onStep?: (scene: HTMLElement, step: string) => void) {
  if (!hasIO()) return
  document.querySelectorAll<HTMLElement>('.scene[data-scene]').forEach((scene) => {
    const steps = Array.from(scene.querySelectorAll<HTMLElement>('.step'))
    if (!steps.length) return
    const io = new IntersectionObserver((entries) => {
      for (const en of entries) {
        if (!en.isIntersecting) continue
        const el = en.target as HTMLElement
        const step = el.dataset.i || '1'
        if (scene.dataset.step === step && el.classList.contains('on')) continue
        scene.dataset.step = step
        steps.forEach((s) => s.classList.toggle('on', s === el))
        onStep?.(scene, step)
      }
    }, { rootMargin: window.innerWidth < 900 ? '-66% 0px -29% 0px' : '-55% 0px -40% 0px', threshold: 0 })
    steps.forEach((s) => io.observe(s))
  })
}

/**
 * Animacje w pętli (pasek, karuzela aren, błysk po liniach) stoją, gdy ich kontener jest poza ekranem.
 * Przeglądarka nie oddaje wtedy takiej animacji karcie graficznej, tylko liczy ją w głównym wątku
 * w każdej klatce (pomiar: ok. 20% rdzenia w bezczynności w połowie strony). Kontener oznaczamy
 * atrybutem data-loop, pauzę robi klasa .loop-off z global.css.
 */
export function pauseOffscreen(root: ParentNode = document) {
  if (!hasIO()) return
  const io = new IntersectionObserver((entries) => {
    for (const en of entries) en.target.classList.toggle('loop-off', !en.isIntersecting)
  }, { rootMargin: '120px 0px' })
  root.querySelectorAll('[data-loop]').forEach((el) => io.observe(el))
}
