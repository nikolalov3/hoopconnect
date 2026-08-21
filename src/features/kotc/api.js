import { supabase } from '../../lib/supabase'

// ── King of the Court — warstwa danych (RPC + realtime), na KLUBACH ──────────

// Kluby, którymi user może dołączyć (właściciel LUB członek) + liczba graczy.
export async function getMyClubs() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const { data: owned } = await supabase.from('clubs').select('id, name, abbr').eq('owner_id', user.id)
  const { data: memberOf } = await supabase
    .from('club_members').select('club_id, clubs(id, name, abbr)').eq('user_id', user.id)
  const map = new Map()
  ;(owned || []).forEach(c => map.set(c.id, { id: c.id, name: c.name, abbr: c.abbr }))
  ;(memberOf || []).forEach(r => r.clubs && map.set(r.clubs.id, { id: r.clubs.id, name: r.clubs.name, abbr: r.clubs.abbr }))
  const clubs = [...map.values()]
  await Promise.all(clubs.map(async (c) => {
    const { count } = await supabase.from('club_members')
      .select('*', { count: 'exact', head: true }).eq('club_id', c.id).not('user_id', 'is', null)
    c.roster = count || 0
  }))
  return clubs
}

export async function createSession(config = {}) {
  const { data, error } = await supabase.rpc('kotc_create_session', {
    p_target: config.target ?? 67,
    p_rotate_after: config.rotateAfter ?? 3,
    p_win_pts: config.winPts ?? 15,
    p_streak3_bonus: config.streak3Bonus ?? 5,
    p_min_teams: config.minTeams ?? 4,
    p_max_teams: config.maxTeams ?? 6,
    p_confirm_votes: config.confirmVotes ?? 6,
    p_vote_cooldown_sec: config.voteCooldownSec ?? 150,
  })
  if (error) throw error
  return data
}

export async function joinByCode(code, clubId) {
  const { data, error } = await supabase.rpc('kotc_join', { p_code: code, p_team_id: clubId })
  if (error) throw error
  return data
}

export async function startSession(sessionId) {
  const { data, error } = await supabase.rpc('kotc_start', { p_session_id: sessionId })
  if (error) throw error
  return data
}

export async function castVote(gameId, clubId) {
  const { data, error } = await supabase.rpc('kotc_cast_vote', { p_game_id: gameId, p_voted_team_id: clubId })
  if (error) throw error
  return data
}

// Pełny stan sesji: sesja + kluby (nazwa+skrót) + aktualna gierka + głosy.
export async function getSessionState(sessionId) {
  const [{ data: session }, { data: teams }, { data: games }] = await Promise.all([
    supabase.from('kotc_sessions').select('*').eq('id', sessionId).single(),
    supabase.from('kotc_session_teams').select('*, clubs(id, name, abbr)').eq('session_id', sessionId),
    supabase.from('kotc_games').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }),
  ])
  const currentGame = (games || []).find(g => g.status === 'voting') || null
  let votes = []
  if (currentGame) {
    const { data: v } = await supabase.from('kotc_game_votes').select('*').eq('game_id', currentGame.id)
    votes = v || []
  }
  const teamsById = {}
  ;(teams || []).forEach(t => { teamsById[t.team_id] = { ...t, name: t.clubs?.name, abbr: t.clubs?.abbr } })
  return { session, teams: teams || [], teamsById, currentGame, votes, games: games || [] }
}

export function subscribeSession(sessionId, onChange) {
  const ch = supabase
    .channel(`kotc-${sessionId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_sessions', filter: `id=eq.${sessionId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_session_teams', filter: `session_id=eq.${sessionId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_games', filter: `session_id=eq.${sessionId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_game_votes' }, onChange)
    .subscribe()
  return () => { try { supabase.removeChannel(ch) } catch {} }
}

// Aktywna sesja, w której user uczestniczy (dla karty „na żywo" w Klubie).
export async function getMyActiveSession() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data: memberRows } = await supabase.from('club_members').select('club_id').eq('user_id', user.id)
  const { data: ownRows } = await supabase.from('clubs').select('id').eq('owner_id', user.id)
  const clubIds = [...new Set([...(memberRows || []).map(r => r.club_id), ...(ownRows || []).map(r => r.id)])]
  if (clubIds.length === 0) return null
  const { data: st } = await supabase.from('kotc_session_teams')
    .select('session_id, kotc_sessions(*)').in('team_id', clubIds)
  const active = (st || []).map(r => r.kotc_sessions).find(s => s && (s.status === 'lobby' || s.status === 'live'))
  return active || null
}
