/**
 * Lustro danych apki potrzebnych na stronie konta (/konto). Trzymać zgodność z apką:
 *  - FRAMES   ← src/lib/frames.js (FRAME_CATALOG) + i18n pl/settings.json (frames.*) + supabase card_items (frame_*)
 *  - ARENAS   ← src/lib/arenas.js (nazwy i progi XP; apka liczy poziom po stronie klienta z tych progów)
 * Nowa ramka w apce = nowy wpis tutaj + plik public/frames/<id>.webp (scripts/optimize-assets.mjs).
 * Tła kart NIE są tu mirrorowane: lista idzie z tabeli card_items (type = 'background'), a obraz z originu apki.
 */
export type Frame = { id: string; itemId: string; name: string; rarity: 'rare' | 'legendary'; free: boolean; src: string }

export const FRAMES: Frame[] = [
  { id: 'early_access', itemId: 'frame_early_access', name: 'Early Access', rarity: 'rare', free: true, src: '/frames/earlyaccess.webp' },
  { id: 'diamond_s1', itemId: 'frame_diamond_s1', name: 'Diament S1', rarity: 'legendary', free: false, src: '/frames/diamond_s1.webp' },
  { id: 'ff', itemId: 'frame_ff', name: 'Friends & Family', rarity: 'legendary', free: false, src: '/frames/ff.webp' },
]

export const frameById = (id: string | null | undefined) => FRAMES.find((f) => f.id === id) ?? null

export const ARENAS: { name: string; threshold: number }[] = [
  { name: 'Rozgrzewka', threshold: 0 },
  { name: 'Street Court', threshold: 500 },
  { name: 'City Run', threshold: 1500 },
  { name: 'Golden Reign', threshold: 2700 },
  { name: 'Ankh Court', threshold: 3900 },
  { name: 'Void Gem', threshold: 5500 },
  { name: 'Seraphim', threshold: 7500 },
]

/** Poziom areny z XP (jak arenaLevelForXp w apce). */
export function arenaLevelForXp(xp: number): number {
  let lvl = 0
  for (let i = 0; i < ARENAS.length; i++) if (xp >= ARENAS[i].threshold) lvl = i
  return lvl
}

/** Postęp do następnej areny (jak arenaProgress w apce): { current, next, pct, toNext }. */
export function arenaProgress(xp: number) {
  const cur = arenaLevelForXp(xp)
  const next = ARENAS[cur + 1]
  if (!next) return { current: cur, next: null as number | null, pct: 100, toNext: 0 }
  const base = ARENAS[cur].threshold
  const span = next.threshold - base
  const pct = Math.max(0, Math.min(100, Math.round(((xp - base) / span) * 100)))
  return { current: cur, next: cur + 1, pct, toNext: Math.max(0, next.threshold - xp) }
}
