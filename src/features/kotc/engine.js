// ── King of the Court — silnik gry (czysta logika, bez UI/bazy) ───────────────
// Model: winner-stays, przegrany na koniec kolejki, król schodzi po N obronach.
// Punkty: +winPts za wygraną, +streak3Bonus gdy trafisz serię `rotateAfter`.
// Sesję wygrywa pierwsza drużyna, która osiągnie `target`.
// Logika 1:1 jak symulacja z Obsidian [[Król boiska — spec]] (sekcja 4e/9b).

export const KOTC_DEFAULTS = {
  target: 90,        // pkt do wygrania sesji
  rotateAfter: 3,    // po ilu obronach król schodzi
  winPts: 15,        // pkt za wygraną gierkę
  streak3Bonus: 5,   // bonus gdy seria === rotateAfter
}

// Utwórz nową sesję z listy nazw drużyn.
export function createSession(names, config = {}) {
  const cfg = { ...KOTC_DEFAULTS, ...config }
  const teams = names
    .map((n) => (n || '').trim())
    .filter(Boolean)
    .map((name, i) => ({ id: i, name, score: 0, wins: 0, played: 0, bestStreak: 0 }))
  return {
    cfg,
    teams,
    queue: teams.map((t) => t.id), // wszyscy czekają na starcie
    king: null,
    streak: 0,
    phase: teams.length >= 2 ? 'playing' : 'setup',
    history: [],
    sessionWinner: null,
  }
}

// Zwraca [idA, idB] — dwie drużyny aktualnie na boisku.
export function onCourt(s) {
  if (s.king == null) return [s.queue[0], s.queue[1]]
  return [s.king, s.queue[0]]
}

export function teamById(s, id) {
  return s.teams.find((t) => t.id === id)
}

// Zapisz wynik gierki (winnerId = id drużyny, która wygrała). Zwraca NOWY stan.
export function recordWin(state, winnerId) {
  const s = structuredClone(state)
  if (s.phase !== 'playing') return s
  const t = (id) => s.teams.find((x) => x.id === id)
  const [aId, bId] = onCourt(s)
  if (winnerId !== aId && winnerId !== bId) return s // ignoruj błędne
  const loserId = winnerId === aId ? bId : aId

  t(aId).played++
  t(bId).played++

  if (s.king == null) {
    // świeża para — zdejmij obie z przodu kolejki
    s.queue = s.queue.filter((id) => id !== aId && id !== bId)
    const w = t(winnerId)
    w.score += s.cfg.winPts
    w.wins++
    w.bestStreak = Math.max(w.bestStreak, 1)
    s.king = winnerId
    s.streak = 1
    s.queue.push(loserId)
    s.history.push({ a: aId, b: bId, winner: winnerId })
  } else {
    const challengerId = s.queue[0]
    s.queue = s.queue.slice(1)
    const oldKing = s.king
    if (winnerId === oldKing) {
      s.streak++
      let pts = s.cfg.winPts
      if (s.streak === s.cfg.rotateAfter) pts += s.cfg.streak3Bonus
      const kt = t(oldKing)
      kt.score += pts
      kt.wins++
      kt.bestStreak = Math.max(kt.bestStreak, s.streak)
      s.queue.push(challengerId) // przegrany na koniec
      s.history.push({ a: oldKing, b: challengerId, winner: oldKing })
      if (s.streak >= s.cfg.rotateAfter) {
        s.queue.push(oldKing) // król oddaje koronę
        s.king = null
        s.streak = 0
      }
    } else {
      // challenger obala króla
      const ct = t(challengerId)
      ct.score += s.cfg.winPts
      ct.wins++
      ct.bestStreak = Math.max(ct.bestStreak, 1)
      s.queue.push(oldKing) // stary król na koniec
      s.king = challengerId
      s.streak = 1
      s.history.push({ a: oldKing, b: challengerId, winner: challengerId })
    }
  }

  const leader = [...s.teams].sort((x, y) => y.score - x.score)[0]
  if (leader && leader.score >= s.cfg.target) {
    s.phase = 'finished'
    s.sessionWinner = leader.id
  }
  return s
}

// Ranking (kopia posortowana malejąco po pkt, potem wygranych).
export function ranking(s) {
  return [...s.teams].sort((a, b) => b.score - a.score || b.wins - a.wins)
}
