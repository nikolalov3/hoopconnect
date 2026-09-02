import { supabase } from '../../lib/supabase'

// ── King of the Court — warstwa danych, TRYB SOLO (bez klubów) ────────────────
// Wchodzisz solo kodem, host startuje, apka losuje kolorowe drużyny (RPC).
// Stan sesji czytany z: kotc_sessions + kotc_session_teams (kolor) +
// kotc_session_players (skład + profil) + kotc_games + kotc_game_votes.

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

// Pełny stan sesji. Profile graczy dociągane osobno (public_profiles po id),
// żeby nie zależeć od embedu FK.
export async function getSessionState(sessionId) {
  const [{ data: session }, { data: teams }, { data: players }, { data: games }] = await Promise.all([
    supabase.from('kotc_sessions').select('*').eq('id', sessionId).single(),
    supabase.from('kotc_session_teams').select('*').eq('session_id', sessionId),
    supabase.from('kotc_session_players').select('session_id, user_id, session_team_id').eq('session_id', sessionId),
    supabase.from('kotc_games').select('*').eq('session_id', sessionId).order('created_at', { ascending: false }),
  ])

  // profile (nick + ramka) dla wszystkich graczy w jednym zapytaniu
  const ids = [...new Set((players || []).map(p => p.user_id))]
  const profById = {}
  if (ids.length) {
    const { data: profs } = await supabase.from('public_profiles')
      .select('id, name, equipped_frame').in('id', ids)
    ;(profs || []).forEach(p => { profById[p.id] = p })
  }
  const playersFull = (players || []).map(p => ({
    ...p,
    name: profById[p.user_id]?.name || '—',
    frame: profById[p.user_id]?.equipped_frame || 'none',
  }))

  const currentGame = (games || []).find(g => g.status === 'voting') || null
  let votes = []
  if (currentGame) {
    const { data: v } = await supabase.from('kotc_game_votes').select('*').eq('game_id', currentGame.id)
    votes = v || []
  }

  const teamsById = {}
  ;(teams || []).forEach(t => { teamsById[t.id] = { ...t, players: playersFull.filter(p => p.session_team_id === t.id) } })

  return { session, teams: teams || [], teamsById, players: playersFull, currentGame, votes, games: games || [] }
}

export function subscribeSession(sessionId, onChange) {
  const ch = supabase
    .channel(`kotc-${sessionId}`)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_sessions', filter: `id=eq.${sessionId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_session_teams', filter: `session_id=eq.${sessionId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_session_players', filter: `session_id=eq.${sessionId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_games', filter: `session_id=eq.${sessionId}` }, onChange)
    .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_game_votes' }, onChange)
    .subscribe()
  return () => { try { supabase.removeChannel(ch) } catch {} }
}

// Aktywna sesja usera (dla karty „🔴 na żywo" w zakładce Klub) — po kotc_session_players.
export async function getMyActiveSession() {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from('kotc_session_players')
    .select('session_id, kotc_sessions(*)').eq('user_id', user.id)
  const active = (data || []).map(r => r.kotc_sessions).find(s => s && (s.status === 'lobby' || s.status === 'live'))
  return active || null
}
