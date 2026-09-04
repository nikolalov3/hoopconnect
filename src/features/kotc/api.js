import { supabase } from '../../lib/supabase'

// ── King of the Court — warstwa danych, TRYB SOLO (bez klubów) ────────────────
// Wchodzisz solo kodem, host startuje, apka losuje kolorowe drużyny (RPC).
// Stan sesji = JEDNO wywołanie RPC kotc_session_state (spójny snapshot, 1 round-trip
// zamiast 6 zapytań). Realtime: zdarzenia z 5 tabel, filtrowane po sesji, z debounce.

export async function createSession(config = {}) {
  const { data, error } = await supabase.rpc('kotc_create_session', {
    p_target: config.target ?? 67,
    p_rotate_after: config.rotateAfter ?? 3,
    p_win_pts: config.winPts ?? 15,
    p_streak3_bonus: config.streak3Bonus ?? 5,
    p_team_size: config.teamSize ?? 3,
    p_min_teams: config.minTeams ?? 3,
    p_max_teams: config.maxTeams ?? 6,
    p_confirm_votes: config.confirmVotes ?? 2,
  })
  if (error) throw error
  return data
}

// Dołączasz SOLO — sam kod, bez klubu.
export async function joinByCode(code) {
  const { data, error } = await supabase.rpc('kotc_join', { p_code: code })
  if (error) throw error
  return data
}

export async function leaveSession(sessionId) {
  const { error } = await supabase.rpc('kotc_leave', { p_session_id: sessionId })
  if (error) throw error
}

export async function abandonSession(sessionId) {
  const { error } = await supabase.rpc('kotc_abandon', { p_session_id: sessionId })
  if (error) throw error
}

export async function startSession(sessionId) {
  const { data, error } = await supabase.rpc('kotc_start', { p_session_id: sessionId })
  if (error) throw error
  return data
}

export async function castVote(gameId, teamId) {
  const { data, error } = await supabase.rpc('kotc_cast_vote', { p_game_id: gameId, p_voted_team_id: teamId })
  if (error) throw error
  return data
}

export async function voteMvp(sessionId, playerId) {
  const { data, error } = await supabase.rpc('kotc_vote_mvp', { p_session_id: sessionId, p_player_id: playerId })
  if (error) throw error
  return data
}

// Pełny stan sesji w jednym RPC — nazwy/ramki graczy dołączone server-side.
// Brak sesji (skasowana / sprzątnięta) → rzuca, a komponent wraca do ekranu startowego.
export async function getSessionState(sessionId) {
  const { data, error } = await supabase.rpc('kotc_session_state', { p_session_id: sessionId })
  if (error) throw error
  if (!data?.session) throw new Error('Sesja nie istnieje')
  const teams = data.teams || [], players = data.players || []
  const teamsById = {}
  teams.forEach(t => { teamsById[t.id] = { ...t, players: players.filter(p => p.session_team_id === t.id) } })
  return { session: data.session, teams, teamsById, players, currentGame: data.current_game || null, votes: data.votes || [] }
}

// Realtime: każda zmiana w sesji → jeden przeładunek stanu. Zdarzenia z jednej
// transakcji (potwierdzenie = głos + wyniki drużyn + gierka + sesja) zlewają się
// w JEDEN reload dzięki debounce — zamiast pięciu równoległych. Wszystkie tabele
// filtrowane po sesji (głosy mają denormalizowane session_id).
const DEBOUNCE_MS = 200
export function subscribeSession(sessionId, onChange) {
  let timer = null
  const fire = () => { clearTimeout(timer); timer = setTimeout(onChange, DEBOUNCE_MS) }
  const bySession = `session_id=eq.${sessionId}`
  const ch = supabase
    .channel(`kotc-${sessionId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_sessions',        filter: `id=eq.${sessionId}` }, fire)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_session_teams',   filter: bySession }, fire)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_session_players', filter: bySession }, fire)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_games',           filter: bySession }, fire)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_game_votes',      filter: bySession }, fire)
    .subscribe()
  return () => { clearTimeout(timer); try { supabase.removeChannel(ch) } catch {} }
}

// Aktywna sesja usera (dla karty „🔴 na żywo" w zakładce Klub) — po kotc_session_players.
export async function getMyActiveSession() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  // Sprzątnij martwe sesje (m.in. samotne lobby > 15 min), żeby karta „🔴 na żywo"
  // nie reklamowała sesji, której nie ma już sensu wznawiać.
  try { await supabase.rpc('kotc_cleanup_stale') } catch { /* best-effort */ }
  const { data } = await supabase.from('kotc_session_players')
    .select('session_id, kotc_sessions(*)').eq('user_id', user.id)
  const active = (data || []).map(r => r.kotc_sessions).find(s => s && (s.status === 'lobby' || s.status === 'live'))
  return active || null
}

// Globalna lista aktywnych sesji (lobby + live) — do dołączania bez kodu.
// Server-side sprząta martwe sesje przed zwróceniem listy.
export async function listActiveSessions() {
  const { data, error } = await supabase.rpc('kotc_list_active')
  if (error) throw error
  return data || []
}
