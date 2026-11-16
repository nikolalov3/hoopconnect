/**
 * Strona konta (/konto): logowanie, podgląd profilu i wybór tła karty oraz ramki.
 * Dane i Supabase siedzą w accountApi.ts; tu jest tylko interfejs. Zmiana zapisuje się w profiles.equipped_*,
 * czyli w tym samym miejscu, z którego czyta aplikacja, więc karta jest ta sama po obu stronach.
 *
 * Wszystko, co przychodzi z bazy (imię, miasto, nazwy tła), trafia do DOM przez textContent. Nigdzie nie ma innerHTML z danymi gracza.
 */
import { ACCOUNT, APP_URL } from '../consts'
import { ARENAS, FRAMES, arenaProgress, frameById } from '../data/cosmetics'
import { attachTilt } from './cardTilt'
import type { AccountApi, Equipped, Snapshot } from './accountApi'

const root = document.querySelector<HTMLElement>('[data-acc]')
if (root) void start(root)

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const MSG = {
  invalid: 'Nieprawidłowy e-mail lub hasło. Sprawdź dane albo ustaw nowe hasło w aplikacji.',
  rate: 'Za dużo prób. Poczekaj chwilę i spróbuj jeszcze raz.',
  network: 'Brak połączenia. Spróbuj jeszcze raz.',
  unknown: 'Nie udało się zalogować. Spróbuj jeszcze raz.',
} as const

const assetUrl = (path: string) => new URL(path, APP_URL).href

async function start(root: HTMLElement) {
  const $ = <T extends HTMLElement>(sel: string) => root.querySelector<T>(sel)!
  const $$ = <T extends HTMLElement>(sel: string) => Array.from(root.querySelectorAll<T>(sel))
  const views = $$('[data-view]')
  const lead = document.querySelector<HTMLElement>('[data-lead]')!   // leży w nagłówku strony, poza sekcją konta
  const LEAD_OUT = lead.textContent ?? ''
  let view = 'boot'
  const show = (name: string) => { view = name; views.forEach((v) => { v.hidden = v.dataset.view !== name }); lead.hidden = name === 'error' }

  // ── Połączenie z danymi: atrapa tylko w dev (?mock=1), inaczej prawdziwy Supabase ──
  let api: AccountApi
  try {
    const q = new URLSearchParams(location.search)
    if (import.meta.env.DEV && q.has('mock')) {
      const { createMockApi } = await import('./accountMock')
      api = createMockApi(q)
      root.dataset.mock = '1'
    } else {
      if (!ACCOUNT.supabaseUrl || !ACCOUNT.supabaseKey) throw new Error('config')
      const { createRealApi } = await import('./accountApi')
      api = await createRealApi({ url: ACCOUNT.supabaseUrl, key: ACCOUNT.supabaseKey })
    }
  } catch {
    $('[data-error-msg]').textContent = 'Logowanie jest chwilowo niedostępne. Spróbuj jeszcze raz za jakiś czas.'
    $('[data-retry]').hidden = true
    show('error')
    return
  }

  // ── Stan konta ──
  let snap: Snapshot | null = null
  let saved: Equipped = { frame: null, background: null }
  let draft: Equipped = { frame: null, background: null }
  let entering = false

  const card = $('[data-stage] .pc3d-wrap')
  const stage = $('[data-stage]')
  attachTilt(stage, { zone: $('[data-account-grid]') })
  const els = {
    face: card.querySelector<HTMLElement>('.pc3d-face')!,
    letter: card.querySelector<SVGTextElement>('.pc3d-av text')!,
    frameImg: card.querySelector<SVGImageElement>('.pc3d-av image')!,
    name: card.querySelector<HTMLElement>('.pc3d-name')!,
    arena: card.querySelector<HTMLElement>('.pc3d-arena')!,
    ah: Array.from(card.querySelectorAll<HTMLImageElement>('.pc3d-ah')),
    fill: card.querySelector<HTMLElement>('.pc3d-fill')!,
    node: card.querySelector<HTMLElement>('.pc3d-node')!,
    cap: card.querySelector<HTMLElement>('.pc3d-cap')!,
    stats: Array.from(card.querySelectorAll<HTMLElement>('.pc3d-stat b')),
    id: card.querySelector<HTMLElement>('.pc3d-foot .id b')!,
  }

  const letterOf = (name: string) => (name.trim()[0] ?? '?').toUpperCase()

  /** Karta na stronie = karta z apki (PlayerCard3D): te same dane, ta sama kolejność pól. */
  function paintCard() {
    if (!snap?.profile) return
    const p = snap.profile
    // tło
    const bgItem = snap.backgrounds.find((b) => b.id === draft.background) ?? null
    let bg = els.face.querySelector<HTMLElement>('.pc3d-bg')
    if (bgItem) {
      if (!bg) { bg = document.createElement('div'); bg.className = 'pc3d-bg'; els.face.insertBefore(bg, els.face.firstChild) }
      bg.style.backgroundImage = `url("${assetUrl(bgItem.asset)}")`
      els.face.classList.add('pc3d-hasbg')
    } else { bg?.remove(); els.face.classList.remove('pc3d-hasbg') }
    // ramka i inicjał
    const fr = frameById(draft.frame)
    els.letter.textContent = letterOf(p.name)
    if (fr) { els.frameImg.setAttribute('href', fr.src); els.frameImg.style.display = '' } else els.frameImg.style.display = 'none'
    // nazwa, arena, postęp (jak w apce: poziom po XP z progów, numer areny z profilu)
    const prog = arenaProgress(p.xp)
    const cur = ARENAS[prog.current]
    const next = prog.next != null ? ARENAS[prog.next] : null
    const pct = Math.max(6, Math.min(100, prog.pct))
    els.name.textContent = p.name || '—'
    els.arena.textContent = `${cur.name} · Arena ${p.arenaLevel}`
    const [ahCur, ahNext] = els.ah
    if (ahCur) { ahCur.src = `/arenas/thumb/arena-${prog.current}.webp`; ahCur.style.visibility = prog.current === 0 ? 'hidden' : '' }
    if (ahNext) { if (next) { ahNext.src = `/arenas/thumb/arena-${prog.next}.webp`; ahNext.style.display = '' } else ahNext.style.display = 'none' }
    els.fill.style.width = `${pct}%`; els.node.style.left = `${pct}%`
    els.cap.replaceChildren()
    if (next) {
      const b = document.createElement('b'); b.textContent = `${prog.toNext} XP`
      els.cap.append('Jeszcze ', b, ` do areny ${next.name}`)
    } else {
      const b = document.createElement('b'); b.textContent = cur.name
      els.cap.append('Szczyt osiągnięty, ', b)
    }
    if (els.stats[0]) els.stats[0].textContent = String(snap.matchWins)
    if (els.stats[1]) els.stats[1].textContent = String(p.kotcWins)
    els.id.textContent = p.hcId != null ? String(p.hcId) : '—'
  }

  // ── Kafelki wyboru: tło i ramka ──
  let seq = 0
  function hexVisual(letter: string, frameSrc: string | null) {
    const id = `acx${++seq}`
    const holder = document.createElement('span')
    holder.className = 'acc-hex'
    holder.innerHTML =
      `<svg width="48" height="48" viewBox="-16 -16 122 122" style="overflow:visible" aria-hidden="true"><defs><linearGradient id="${id}" x1="20%" y1="0%" x2="80%" y2="100%">` +
      `<stop offset="0%" stop-color="#7BC8F8"/><stop offset="40%" stop-color="#5BB8F5"/><stop offset="100%" stop-color="#1B3A6B"/></linearGradient></defs>` +
      `<polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,0.30)"/><polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill="url(#${id})"/>` +
      `<polygon points="45,6 8,32 45,42" fill="rgba(255,255,255,0.28)"/><polygon points="45,6 82,32 45,42" fill="rgba(255,255,255,0.13)"/>` +
      `<polygon points="8,32 8,58 45,48 45,42" fill="rgba(91,184,245,0.15)"/><polygon points="82,32 82,58 45,48 45,42" fill="rgba(0,0,0,0.22)"/>` +
      `<polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill="none" stroke="rgba(255,255,255,0.40)" stroke-width="1.5" stroke-linejoin="round"/>` +
      `<text x="45" y="49" text-anchor="middle" dominant-baseline="middle" fill="white" font-size="30" font-weight="800" font-family="'Barlow Condensed', Barlow, sans-serif"></text>` +
      (frameSrc ? `<image href="${frameSrc}" x="-16" y="-16" width="122" height="122" preserveAspectRatio="xMidYMid meet"/>` : '') + `</svg>`
    holder.querySelector('text')!.textContent = letter
    return holder
  }

  const tiles: { btn: HTMLButtonElement; kind: 'background' | 'frame'; value: string | null }[] = []
  function addTile(list: HTMLElement, kind: 'background' | 'frame', value: string | null, label: string, visual: HTMLElement) {
    const btn = document.createElement('button')
    btn.type = 'button'; btn.className = 'acc-tile'
    const l = document.createElement('span'); l.className = 'acc-tile-l'; l.textContent = label
    btn.append(visual, l)
    btn.addEventListener('click', () => {
      if (kind === 'background') draft.background = value; else draft.frame = value
      sync()
    })
    list.append(btn); tiles.push({ btn, kind, value })
  }

  function buildTiles() {
    tiles.length = 0
    const bgList = $('[data-bg-list]'), frList = $('[data-frame-list]')
    bgList.replaceChildren(); frList.replaceChildren()
    const mk = (cls: string, url?: string) => { const d = document.createElement('span'); d.className = cls; if (url) d.style.backgroundImage = `url("${url}")`; return d }
    addTile(bgList, 'background', null, 'Klasyczne', mk('acc-bg acc-bg-classic'))
    for (const b of snap!.backgrounds) addTile(bgList, 'background', b.id, b.name, mk('acc-bg', assetUrl(b.asset)))
    const letter = letterOf(snap!.profile!.name)
    addTile(frList, 'frame', null, 'Brak', hexVisual(letter, null))
    for (const f of FRAMES) if (snap!.ownedFrames.includes(f.id)) addTile(frList, 'frame', f.id, f.name, hexVisual(letter, f.src))
    $('[data-bg-empty]').hidden = snap!.backgrounds.length > 0
  }

  const saveBtn = $<HTMLButtonElement>('[data-save]')
  const resetBtn = $<HTMLButtonElement>('[data-reset]')
  const saveMsg = $('[data-save-msg]')
  const setMsg = (text: string, state: '' | 'ok' | 'err') => { saveMsg.textContent = text; saveMsg.dataset.state = state }
  const dirty = () => draft.frame !== saved.frame || draft.background !== saved.background

  /** Jedno miejsce, które po każdej zmianie wyboru odświeża kafelki, kartę i przyciski. */
  function sync() {
    for (const t of tiles) {
      const cur = t.kind === 'background' ? draft.background : draft.frame
      t.btn.setAttribute('aria-pressed', String(cur === t.value))
    }
    paintCard()
    const d = dirty()
    saveBtn.disabled = !d; resetBtn.disabled = !d
    if (d && saveMsg.dataset.state !== 'err') setMsg('', '')
  }

  function renderAccount() {
    const p = snap!.profile!
    saved = { frame: p.frame, background: p.background }
    // jeśli zapisane tło nie jest już dostępne (np. wycofane), pokazujemy klasyczne
    if (saved.background && !snap!.backgrounds.some((b) => b.id === saved.background)) saved.background = null
    draft = { ...saved }
    buildTiles()
    setMsg('', '')
    const arena = ARENAS[arenaProgress(p.xp).current]
    const set = (k: string, v: string | null) => { const el = root!.querySelector<HTMLElement>(`[data-f="${k}"]`); if (!el) return; el.textContent = v ?? ''; const row = el.closest<HTMLElement>('[data-row]'); if (row) row.hidden = !v }
    set('name', p.name || '—'); set('hc', p.hcId != null ? String(p.hcId) : null); set('city', p.city)
    set('arena', arena.name); set('xp', String(p.xp)); set('wins', String(snap!.matchWins)); set('kotc', String(p.kotcWins))
    $('[data-email]').textContent = snap!.email
    lead.textContent = `Cześć, ${p.name || 'graczu'}. Wybierz tło i ramkę karty, a zmianę zapiszesz jednym kliknięciem.`
    sync()
  }

  async function enter() {
    if (entering || view === 'account') return
    entering = true
    show('boot')
    try {
      snap = await api.load()
    } catch {
      entering = false
      $('[data-error-msg]').textContent = 'Nie udało się wczytać konta. Spróbuj jeszcze raz.'
      $('[data-retry]').hidden = false
      show('error'); return
    }
    entering = false
    if (!snap.profile) { lead.textContent = 'Jesteś zalogowany, ale to konto nie ma jeszcze profilu gracza.'; show('nopro'); return }
    renderAccount(); show('account')
  }

  function leave() {
    snap = null; lead.textContent = LEAD_OUT
    root!.querySelectorAll<HTMLElement>('[data-f], [data-email]').forEach((el) => { el.textContent = '' })
    els.name.textContent = ''; els.id.textContent = ''; els.stats.forEach((b) => { b.textContent = '0' })
    const pass = root!.querySelector<HTMLInputElement>('#acc-pass'); if (pass) pass.value = ''
    show('login')
  }

  // ── Logowanie ──
  const form = $<HTMLFormElement>('[data-login]')
  const emailEl = $<HTMLInputElement>('#acc-email'), passEl = $<HTMLInputElement>('#acc-pass')
  const loginBtn = $<HTMLButtonElement>('[data-login-btn]'), loginMsg = $('[data-login-msg]')
  const say = (text: string, focus?: HTMLElement, kind: 'busy' | 'err' = 'err') => { loginMsg.textContent = text; loginMsg.dataset.state = text ? kind : ''; focus?.focus() }
  form.addEventListener('submit', async (e) => {
    e.preventDefault()
    const email = emailEl.value.trim(), pass = passEl.value
    if (!EMAIL.test(email)) return say('Wpisz poprawny adres e-mail.', emailEl)
    if (!pass) return say('Wpisz hasło.', passEl)
    loginBtn.disabled = true; say('Loguję…', undefined, 'busy')
    const r = await api.signIn(email, pass)
    loginBtn.disabled = false
    if (!r.ok) return say(MSG[r.error], r.error === 'invalid' ? passEl : undefined)
    say(''); passEl.value = ''
    await enter()
  })
  root.querySelector<HTMLButtonElement>('[data-google]')?.addEventListener('click', async () => {
    say('Przekierowuję do Google…', undefined, 'busy')
    const r = await api.signInGoogle()
    if (!r.ok) say('Nie udało się połączyć z Google. Użyj e-maila i hasła.')
  })

  // ── Akcje na koncie ──
  saveBtn.addEventListener('click', async () => {
    if (!dirty()) return
    saveBtn.disabled = true; resetBtn.disabled = true; setMsg('Zapisuję…', '')
    const r = await api.save(draft)
    if (r.ok) {
      saved = { ...draft }
      setMsg('Zapisane na koncie. Aplikacja pokaże nową kartę po powrocie do niej.', 'ok')
    } else {
      setMsg(r.error === 'network' ? 'Brak połączenia. Spróbuj jeszcze raz.' : 'Nie udało się zapisać zmiany. Odśwież stronę i spróbuj jeszcze raz.', 'err')
    }
    const d = dirty(); saveBtn.disabled = !d; resetBtn.disabled = !d
  })
  resetBtn.addEventListener('click', () => { draft = { ...saved }; setMsg('', ''); sync() })
  root.querySelectorAll<HTMLButtonElement>('[data-signout]').forEach((b) => b.addEventListener('click', async () => { await api.signOut(); leave() }))
  $<HTMLButtonElement>('[data-retry]').addEventListener('click', () => { void enter() })

  // ── Start: sesja z poprzedniej wizyty, powrót z Google albo formularz ──
  api.onChange((signedIn) => { if (signedIn) void enter(); else if (view === 'account') leave() })
  if (await api.hasSession()) await enter(); else show('login')
}
