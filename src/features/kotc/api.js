import { supabase } from '../../lib/supabase'

// ── King of the Court — warstwa danych (RPC + realtime) ───────────────────────

// Drużyny, którymi user może dołączyć (trener LUB zawodnik) + liczność składu.
export async function getMyTeams() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  // drużyny gdzie jestem trenerem
  const { data: coached } = await supabase.from('teams').select('id, name').eq('coach_id', user.id)
  // drużyny gdzie jestem zawodnikiem
  const { data: memberOf } = await supabase
    .from('team_members').select('team_id, teams(id, name)').eq('player_id', user.id)
  const map = new Map()
  ;(coached || []).forEach(t => map.set(t.id, { id: t.id, name: t.name }))
  ;(memberOf || []).forEach(r => r.teams && map.set(r.teams.id, { id: r.teams.id, name: r.teams.name }))
  const teams = [...map.values()]
  // dolicz liczbę graczy w składzie
  await Promise.all(teams.map(async (t) => {
    const { count } = await supabase.from('team_members')
      .select('*', { count: 'exact', head: true }).eq('team_id', t.id)
    t.roster = count || 0
  }))
  return teams
}

export async function createSession(config = {}) {
  const { data, error } = await supabase.rpc('kotc_create_session', {
    p_target: config.target ?? 90,
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

export async function joinByCode(code, teamId) {
  const { data, error } = await supabase.rpc('kotc_join', { p_code: code, p_team_id: teamId })
  if (error) throw error
  return data
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

export async function findSessionByCode(code) {
  const { data, error } = await supabase.from('kotc_sessions')
    .select('*').eq('code', code.toUpperCase()).maybeSingle()
  if (error) throw error
  return data
}

// Pełny stan sesji: sesja + drużyny (z nazwami) + aktualna gierka + głosy.
export async function getSessionState(sessionId) {
  const [{ data: session }, { data: teams }, { data: games }] = await Promise.all([
    supabase.from('kotc_sessions').select('*').eq('id', sessionId).single(),
    supabase.from('kotc_session_teams').select('*, teams(id, name)').eq('session_id', sessionId),
    supabase.from('kotc_games').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }),
  ])
  const currentGame = (games || []).find(g => g.status === 'voting') || null
  let votes = []
  if (currentGame) {
    const { data: v } = await supabase.from('kotc_game_votes').select('*').eq('game_id', currentGame.id)
    votes = v || []
  }
  const teamsById = {}
  ;(teams || []).forEach(t => { teamsById[t.team_id] = { ...t, name: t.teams?.name } })
  return { session, teams: teams || [], teamsById, currentGame, votes, games: games || [] }
}

// Realtime: reaguj na zmiany sesji/drużyn/gierek/głosów danej sesji.
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
  // drużyny, w których jestem (zawodnik lub trener)
  const { data: memberRows } = await supabase.from('team_members').select('team_id').eq('player_id', user.id)
  const { data: coachRows } = await supabase.from('teams').select('id').eq('coach_id', user.id)
  const teamIds = [...new Set([...(memberRows || []).map(r => r.team_id), ...(coachRows || []).map(r => r.id)])]
  if (teamIds.length === 0) return null
  const { data: st } = await supabase.from('kotc_session_teams')
    .select('session_id, kotc_sessions(*)').in('team_id', teamIds)
  const active = (st || []).map(r => r.kotc_sessions).find(s => s && (s.status === 'lobby' || s.status === 'live'))
  return active || null
}
