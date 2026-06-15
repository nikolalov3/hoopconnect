// ── ARENY — wspólne źródło danych ──────────────────────────────────────────────
// Kolejność: od najniższej (index 0) do najwyższej.
// "Sół tej Ziemi" jest ZAWSZE ostatnią ODKRYTĄ areną — aktualny szczyt.
// Gdy dodajesz nową arenę: wstaw ją PRZED "Sól tej Ziemi" i podnieś jej próg.
// Areny z `secret: true` to zablokowane teasery (Clash Royale "więcej wkrótce").

export const ARENAS = [
  {
    name: 'Rozgrzewka', threshold: 0, noFrame: true,
    glow: '#8899CC', badge: ['#AABBD8', '#5566AA', '#0C0E22'],
    tagline: 'Tu zaczyna się każda legenda.',
  },
  {
    name: 'Street Court', threshold: 500,
    glow: '#FF8C30', badge: ['#FFCC80', '#E07020', '#180900'],
    tagline: 'Ulica weryfikuje. Ty zdałeś.',
  },
  {
    name: 'City Run', threshold: 1500,
    glow: '#E8B030', badge: ['#FFE090', '#C88820', '#1A1000'],
    tagline: 'Miasto nigdy nie śpi. Ty też nie zwalniasz.',
  },
  {
    name: 'Golden Reign', threshold: 2700,
    glow: '#FFC940', badge: ['#FFF2B0', '#C9A227', '#241200'],
    tagline: 'Złota era. Rządzisz parkietem.',
  },
  {
    name: 'Ankh Court', threshold: 3900,
    glow: '#2DD4BF', badge: ['#A8FFF0', '#1FA89A', '#001A18'],
    tagline: 'Starożytna moc, nowoczesna gra.',
  },
  {
    name: 'Void Gem', threshold: 5500,
    glow: '#A855F7', badge: ['#E0B0FF', '#7C3AED', '#180029'],
    tagline: 'W pustce świecisz najjaśniej.',
  },
  {
    name: 'Seraphim', threshold: 7500,
    glow: '#FDE68A', badge: ['#FFFFFF', '#FFD700', '#3A2C00'],
    tagline: 'Ostatni stopień. Boska forma.',
  },
]

// Aktualny poziom areny na podstawie XP (index w ARENAS, tylko areny nie-secret)
export function arenaLevelForXp(xp) {
  let lvl = 0
  for (let i = 0; i < ARENAS.length; i++) {
    if (ARENAS[i].secret) break
    if (xp >= ARENAS[i].threshold) lvl = i
  }
  return lvl
}

// Postęp do następnej areny: { current, next, pct, toNext }
export function arenaProgress(xp) {
  const cur = arenaLevelForXp(xp)
  const next = ARENAS[cur + 1]
  if (!next) return { current: cur, next: null, pct: 100, toNext: 0 }
  const base = ARENAS[cur].threshold
  const span = next.threshold - base
  const pct = Math.max(0, Math.min(100, Math.round(((xp - base) / span) * 100)))
  return { current: cur, next: cur + 1, pct, toNext: Math.max(0, next.threshold - xp) }
}
