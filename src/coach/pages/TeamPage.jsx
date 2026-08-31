import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCoachAuth } from '../context/CoachAuthContext'
import { ARENAS } from '../../lib/arenas'

export default function TeamPage() {
  const navigate = useNavigate()
  const { currentTeam, user, refreshTeams } = useCoachAuth()
  const [members, setMembers] = useState([])
  const [invites, setInvites] = useState([])
  const [attendance, setAttendance] = useState([])  // [{ player_id, practice_id, scheduled_at, status }]
  const [loading, setLoading] = useState(true)
  const [showInvite, setShowInvite] = useState(false)
  const [loadError, setLoadError] = useState(null)
  // Join code (players self-join by typing it in the player app)
  const [joinCode, setJoinCode] = useState(currentTeam?.join_code || '')
  const [codeCopied, setCodeCopied] = useState(false)
  const [regenerating, setRegenerating] = useState(false)
  const [scores, setScores] = useState({})  // player_id -> { arena_level, xp, last_week_score }

  useEffect(() => {
    if (!currentTeam) return
    loadRoster()
  }, [currentTeam?.id])

  // Refetch when coach returns to tab (covers cases where the websocket
  // dropped or Realtime isn't enabled on the tables yet)
  useEffect(() => {
    if (!currentTeam) return
    const onVisible = () => {
      if (document.visibilityState === 'visible') loadRoster()
    }
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [currentTeam?.id])

  // Realtime: refresh roster the instant a player accepts/leaves or an
  // invite status flips. Wrapped defensively — must not crash the page.
  useEffect(() => {
    if (!currentTeam?.id) return
    const teamId = currentTeam.id
    let channel = null
    try {
      channel = supabase
        .channel(`coach-team-${teamId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'team_members',
          filter: `team_id=eq.${teamId}`,
        }, () => loadRoster())
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'team_invites',
          filter: `team_id=eq.${teamId}`,
        }, () => loadRoster())
        .subscribe((status) => {
          if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            console.warn('[coach/team] realtime status:', status)
          }
        })
    } catch (err) {
      console.warn('[coach/team] realtime subscribe failed:', err)
    }
    return () => {
      try { if (channel) supabase.removeChannel(channel) } catch {}
    }
  }, [currentTeam?.id])

  // Keep the displayed code in sync when the team switches / refreshes
  useEffect(() => { setJoinCode(currentTeam?.join_code || '') }, [currentTeam?.id, currentTeam?.join_code])

  function copyJoinCode() {
    if (!joinCode) return
    try { navigator.clipboard?.writeText(joinCode) } catch {}
    setCodeCopied(true)
    setTimeout(() => setCodeCopied(false), 1500)
  }

  async function handleRegenCode() {
    if (regenerating || !currentTeam) return
    setRegenerating(true)
    const { data, error } = await supabase.rpc('regenerate_team_code', { p_team_id: currentTeam.id })
    setRegenerating(false)
    if (!error && data) { setJoinCode(data); refreshTeams?.() }
  }

  async function loadRoster() {
    setLoading(true)
    setLoadError(null)
    // get_team_roster joins team_members + auth.users.email server-side
    // so the UI can show the email-local-part as a label fallback when
    // first/last name haven't been typed yet.
    const [rosterRes, invitesRes, attRes, scoresRes] = await Promise.all([
      supabase.rpc('get_team_roster', { p_team_id: currentTeam.id }),
      supabase.from('team_invites').select('*').eq('team_id', currentTeam.id).eq('status', 'pending').order('created_at', { ascending: false }),
      supabase.rpc('get_team_attendance_recent', { p_team_id: currentTeam.id, p_limit: 10 }),
      supabase.rpc('get_team_scores', { p_team_id: currentTeam.id }),  // optional — degrades if migration not run
    ])

    const errors = []
    if (rosterRes.error)  errors.push(`Roster RPC: ${rosterRes.error.message}`)
    if (invitesRes.error) errors.push(`Invites: ${invitesRes.error.message}`)
    if (attRes.error)     errors.push(`Frekwencja: ${attRes.error.message}`)
    if (errors.length) {
      console.error('[coach/team] load errors:', errors, { rosterRes, invitesRes, attRes })
      setLoadError(errors.join(' · '))
    }

    setMembers(rosterRes.data || [])
    setInvites(invitesRes.data || [])
    setAttendance(attRes.data || [])
    const scoreMap = {}
    for (const s of (scoresRes.data || [])) scoreMap[s.player_id] = s
    setScores(scoreMap)   // scoresRes.error (e.g. pre-migration) is non-fatal — roster still renders
    setLoading(false)
  }

  if (!currentTeam) return null

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="coach-h1">Drużyna · {currentTeam.name}</h1>
          <p className="coach-subtitle">
            {members.length} {members.length === 1 ? 'zawodnik' : members.length >= 2 && members.length <= 4 ? 'zawodników' : 'zawodników'}
            {invites.length > 0 && ` · ${invites.length} zaproszeń oczekuje`}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button
            className="coach-btn-secondary"
            onClick={loadRoster}
            disabled={loading}
            title="Odśwież listę"
            aria-label="Odśwież"
            style={{ padding: '10px 12px', display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" style={{
              animation: loading ? 'spin 0.8s linear infinite' : 'none',
            }}>
              <polyline points="23 4 23 10 17 10"/>
              <polyline points="1 20 1 14 7 14"/>
              <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"/>
            </svg>
            Odśwież
          </button>
          <button className="coach-btn-primary" onClick={() => setShowInvite(true)}>+ Dodaj zawodnika</button>
        </div>
      </header>

      {/* Kod dołączenia — trener udostępnia, zawodnik wpisuje w apce */}
      <div className="coach-card" style={{
        marginBottom: 14, display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', gap: 14, flexWrap: 'wrap',
      }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#8A9AB0', marginBottom: 4 }}>
            Kod dołączenia
          </div>
          <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: 4, color: '#1A2233', fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace' }}>
            {joinCode || '••••••'}
          </div>
          <div style={{ fontSize: 12, color: '#8A9AB0', marginTop: 4 }}>
            Podaj go zawodnikom — dołączą w aplikacji w Ustawieniach.
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
          <button className="coach-btn-secondary" onClick={copyJoinCode} disabled={!joinCode}>
            {codeCopied ? '✓ Skopiowano' : 'Kopiuj'}
          </button>
          <button className="coach-btn-ghost" onClick={handleRegenCode} disabled={regenerating}
            style={{ color: '#8A9AB0' }} title="Wygeneruj nowy kod — stary przestanie działać">
            {regenerating ? '...' : 'Nowy kod'}
          </button>
        </div>
      </div>

      {loadError && (
        <div className="coach-card" style={{
          marginBottom: 14,
          background: '#FCE5E2', borderColor: '#F4B5AB',
          color: '#A1372A', fontSize: 13,
        }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Błąd ładowania danych:</strong>
          <code style={{ fontSize: 12, wordBreak: 'break-all' }}>{loadError}</code>
        </div>
      )}
      {loading ? (
        <div className="coach-card"><div className="coach-placeholder" style={{ minHeight: 200 }}><div className="spinner" /></div></div>
      ) : (
        <>
          {/* Members list */}
          {members.length === 0 && invites.length === 0 ? (
            <div className="coach-card">
              <div className="coach-placeholder" style={{ minHeight: 240 }}>
                <div className="coach-placeholder-title">Brak zawodników</div>
                <div style={{ marginBottom: 18 }}>Wyślij zaproszenie e-mailowe — zawodnik zaakceptuje je w aplikacji.</div>
                <button className="coach-btn-primary" onClick={() => setShowInvite(true)}>Dodaj pierwszego zawodnika</button>
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {members.map(m => {
                const fullName  = [m.display_first_name, m.display_last_name].filter(Boolean).join(' ')
                const emailLocal = m.player_email?.split('@')[0] || ''
                const displayLabel = fullName || emailLocal || 'Zawodnik'
                const nameInitials = (m.display_first_name?.charAt(0) || '') + (m.display_last_name?.charAt(0) || '')
                const initials = nameInitials || emailLocal.charAt(0).toUpperCase() || '?'
                const subLine = fullName
                  ? (m.jersey_number ? `#${m.jersey_number}` : 'bez numeru')
                  : 'uzupełnij imię'

                const stat = scores[m.player_id]
                const arenaName = stat ? (ARENAS[stat.arena_level]?.name || ARENAS[0].name) : null

                // Attendance dots: pull this player's rows from the matrix
                const myAtt = attendance
                  .filter(a => a.player_id === m.player_id)
                  // Ensure descending by date (RPC already orders DESC, ale tłem sortujemy)
                  .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))

                return (
                  <button
                    key={m.player_id}
                    onClick={() => navigate(`/team/${m.player_id}`)}
                    className="coach-card"
                    style={{ textAlign: 'left', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 14, padding: 14 }}
                  >
                    <div style={{
                      width: 42, height: 42, borderRadius: 11,
                      background: '#E8F1FA', color: '#1E3A5F',
                      fontWeight: 700, fontSize: 14,
                      display: 'grid', placeItems: 'center', flexShrink: 0,
                    }}>
                      {initials}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{
                        fontSize: 14, fontWeight: 600,
                        color: fullName ? '#1A2233' : '#4D5C73',
                        whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                      }}>
                        {displayLabel}
                      </div>
                      <div style={{ fontSize: 12, color: '#8A9AB0' }}>
                        {subLine}
                      </div>
                      {stat && (
                        <div style={{ fontSize: 11, marginTop: 3, display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
                          <span style={{ color: '#5591CD', fontWeight: 700 }}>{arenaName}</span>
                          <span style={{ color: '#8A9AB0' }}>{stat.last_week_score} pkt · ub. tydzień</span>
                        </div>
                      )}
                    </div>
                    <AttendanceDots items={myAtt}/>
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#8A9AB0" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="9 18 15 12 9 6"/>
                    </svg>
                  </button>
                )
              })}

              {invites.length > 0 && (
                <>
                  <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#8A9AB0', padding: '12px 4px 4px' }}>
                    Oczekujące zaproszenia
                  </div>
                  {invites.map(inv => {
                    const fullName = [inv.invited_first_name, inv.invited_last_name].filter(Boolean).join(' ')
                    const initials = (inv.invited_first_name?.charAt(0) || '') + (inv.invited_last_name?.charAt(0) || '')
                    const emailInitial = inv.invited_email?.charAt(0)?.toUpperCase() || '?'
                    return (
                    <div key={inv.id} className="coach-card" style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 14, opacity: 0.7 }}>
                      <div style={{
                        width: 42, height: 42, borderRadius: 11,
                        background: '#FCF2DE', color: '#A37416',
                        fontWeight: 700, fontSize: 14,
                        display: 'grid', placeItems: 'center', flexShrink: 0,
                      }}>
                        {initials || emailInitial}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2233' }}>
                          {fullName || inv.invited_email}
                        </div>
                        {fullName && <div style={{ fontSize: 12, color: '#8A9AB0' }}>{inv.invited_email}</div>}
                      </div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: '#A37416', background: '#FCF2DE', padding: '4px 9px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: 0.5 }}>
                        Oczekuje
                      </span>
                      <button
                        onClick={async () => {
                          // RPC also marks the player's notification as read
                          // so the red dot disappears immediately.
                          await supabase.rpc('revoke_team_invite', { p_invite_id: inv.id })
                          loadRoster()
                        }}
                        className="coach-btn-ghost"
                        style={{ fontSize: 12, padding: '6px 10px', color: '#D85546' }}
                      >Anuluj</button>
                    </div>
                    )
                  })}
                </>
              )}
            </div>
          )}
        </>
      )}

      {showInvite && (
        <InvitePlayerModal
          team={currentTeam}
          coachId={user.id}
          onClose={() => setShowInvite(false)}
          onInvited={() => { setShowInvite(false); loadRoster() }}
        />
      )}
    </div>
  )
}

/**
 * Wiersz mini-kropek pokazujący frekwencję zawodnika na ostatnich N treningach.
 * Najnowszy z prawej, najstarszy z lewej (czyli wchodzi z lewej w czasie).
 */
function AttendanceDots({ items }) {
  if (!items || items.length === 0) return null
  // Pokazujemy w kolejności od najstarszego do najnowszego (lewo→prawo)
  const ordered = [...items].reverse()
  return (
    <div style={{ display: 'flex', gap: 3, flexShrink: 0, marginRight: 6 }}>
      {ordered.map((a, i) => {
        const color =
          a.status === 'present' ? '#3FA86A' :
          a.status === 'late'    ? '#E5A93C' :
          a.status === 'absent'  ? '#D85546' :
                                   '#D4DDE8'
        const label =
          a.status === 'present' ? 'Obecny' :
          a.status === 'late'    ? 'Spóźniony' :
          a.status === 'absent'  ? 'Nieobecny' :
                                   'Niezaznaczony'
        return (
          <div key={i}
            title={`${label} · ${new Date(a.scheduled_at).toLocaleDateString('pl-PL')}`}
            style={{
              width: 8, height: 8, borderRadius: '50%',
              background: a.status ? color : 'transparent',
              border: a.status ? 'none' : `1.5px solid ${color}`,
            }}
          />
        )
      })}
    </div>
  )
}

function InvitePlayerModal({ team, coachId, onClose, onInvited }) {
  const [email, setEmail] = useState('')
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [success, setSuccess] = useState(null)  // { status, team_name }

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    setSuccess(null)
    if (!email.trim()) {
      setError('Podaj email zawodnika.')
      return
    }
    setSubmitting(true)

    try {
      // Single RPC handles everything: dedup pending, refresh notification,
      // detect "already in team", recover from races. Never crashes.
      const { data, error: rpcErr } = await supabase.rpc('invite_player', {
        p_team_id:    team.id,
        p_email:      email.trim(),
        p_first_name: firstName.trim() || null,
        p_last_name:  lastName.trim() || null,
      })

      if (rpcErr) {
        setError(rpcErr.message)
        setSubmitting(false)
        return
      }

      setSuccess(data)
      setSubmitting(false)

      // For created/resent invites: tell parent to refresh, close shortly after
      if (data?.status !== 'already_member') {
        setTimeout(() => onInvited(), 900)
      }
    } catch (err) {
      setError(err?.message || 'Nie udało się wysłać zaproszenia.')
      setSubmitting(false)
    }
  }

  const successCopy = (() => {
    if (!success) return null
    if (success.status === 'invite_created') return 'Zaproszenie wysłane.'
    if (success.status === 'invite_resent')  return 'Zaproszenie odświeżone. Powiadomienie dotarło ponownie.'
    if (success.status === 'already_member') return 'Ten zawodnik jest już w drużynie.'
    return 'Gotowe.'
  })()

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(20, 35, 60, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, zIndex: 200,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FFFFFF',
        width: '100%', maxWidth: 460,
        borderRadius: 18,
        padding: 28,
      }}>
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Dodaj zawodnika</h2>
        <p className="coach-subtitle" style={{ marginBottom: 20 }}>
          Wystarczy email. Imię i nazwisko możesz uzupełnić później na profilu zawodnika.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="coach-label">Email zawodnika *</label>
            <input
              className="coach-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="zawodnik@email.pl"
              autoFocus
              required
            />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="coach-label">Imię (opcjonalne)</label>
              <input className="coach-input" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} />
            </div>
            <div>
              <label className="coach-label">Nazwisko (opcjonalne)</label>
              <input className="coach-input" type="text" value={lastName} onChange={e => setLastName(e.target.value)} />
            </div>
          </div>

          {error && (
            <div style={{ background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>
              {error}
            </div>
          )}

          {successCopy && (
            <div style={{
              background: success?.status === 'already_member' ? '#FCF2DE' : '#E2F4EB',
              border: `1px solid ${success?.status === 'already_member' ? '#E8C97A' : '#9CD9B7'}`,
              color: success?.status === 'already_member' ? '#7A5818' : '#1E6B3D',
              padding: '10px 12px',
              borderRadius: 10,
              fontSize: 13,
            }}>
              {successCopy}
            </div>
          )}

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button type="button" onClick={onClose} className="coach-btn-secondary" style={{ flex: 1 }}>
              {success?.status === 'already_member' ? 'Zamknij' : 'Anuluj'}
            </button>
            {success?.status !== 'already_member' && (
              <button type="submit" className="coach-btn-primary" disabled={submitting} style={{ flex: 1, opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Wysyłanie...' : 'Wyślij zaproszenie'}
              </button>
            )}
          </div>
        </form>
      </div>
    </div>
  )
}
