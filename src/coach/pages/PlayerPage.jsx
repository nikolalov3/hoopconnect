import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCoachAuth } from '../context/CoachAuthContext'
import { ARENAS } from '../../lib/arenas'

export default function PlayerPage() {
  const { playerId } = useParams()
  const navigate = useNavigate()
  const { currentTeam } = useCoachAuth()

  const [member, setMember] = useState(null)
  const [loading, setLoading] = useState(true)
  const [firstName, setFirstName] = useState('')
  const [lastName, setLastName]   = useState('')
  const [jersey, setJersey]       = useState('')
  const [savedAt, setSavedAt]     = useState(null)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState(null)
  const [confirmRemove, setConfirmRemove] = useState(false)
  const [removing, setRemoving] = useState(false)
  const [stats, setStats] = useState(null)

  useEffect(() => {
    if (!currentTeam?.id || !playerId) return
    let cancelled = false
    ;(async () => {
      setLoading(true)
      const { data, error } = await supabase.rpc('get_team_roster', { p_team_id: currentTeam.id })
      if (cancelled) return
      if (error) { setError(error.message); setLoading(false); return }
      const m = (data || []).find(r => r.player_id === playerId)
      if (m) {
        setMember(m)
        setFirstName(m.display_first_name || '')
        setLastName(m.display_last_name || '')
        setJersey(m.jersey_number == null ? '' : String(m.jersey_number))
      }
      // Player stats — fire-and-forget, non-fatal (degrades before the migration runs)
      supabase.rpc('get_player_stats', { p_team_id: currentTeam.id, p_player_id: playerId })
        .then(r => { if (!cancelled) setStats(r.data || null) })
      setLoading(false)
    })()
    return () => { cancelled = true }
  }, [currentTeam?.id, playerId])

  const save = async () => {
    setError(null); setSaving(true)
    const jerseyNum = jersey.trim() === '' ? null : parseInt(jersey, 10)
    if (jerseyNum != null && (isNaN(jerseyNum) || jerseyNum < 0 || jerseyNum > 99)) {
      setError('Numer musi być liczbą 0–99.')
      setSaving(false); return
    }
    const { error } = await supabase.rpc('update_team_member', {
      p_team_id:      currentTeam.id,
      p_player_id:    playerId,
      p_first_name:   firstName.trim() || null,
      p_last_name:    lastName.trim()  || null,
      p_jersey_number: jerseyNum,
    })
    setSaving(false)
    if (error) { setError(error.message); return }
    setSavedAt(Date.now())
    // reload from server so UI reflects normalized values
    const { data } = await supabase.rpc('get_team_roster', { p_team_id: currentTeam.id })
    const m = (data || []).find(r => r.player_id === playerId)
    if (m) setMember(m)
    setTimeout(() => setSavedAt(null), 2000)
  }

  const remove = async () => {
    setRemoving(true)
    const { error } = await supabase.rpc('remove_team_member', {
      p_team_id:   currentTeam.id,
      p_player_id: playerId,
    })
    setRemoving(false)
    if (error) { setError(error.message); return }
    navigate('/team')
  }

  if (!currentTeam) return null

  const displayLabel = member
    ? ([member.display_first_name, member.display_last_name].filter(Boolean).join(' ')
       || member.player_email?.split('@')[0]
       || 'Zawodnik')
    : '...'

  const arenaName = stats ? (ARENAS[stats.arena_level]?.name || ARENAS[0]?.name) : null
  const att = stats?.attendance
  const attTotal = att?.total || 0
  const attRate = attTotal ? Math.round(((att.present + att.late) / attTotal) * 100) : null
  const shooting = stats?.shooting || {}
  const shotTypes = Object.keys(shooting)

  return (
    <div>
      <Link to="/team" className="coach-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: '6px 10px' }}>
        ← Wróć do drużyny
      </Link>

      <header style={{ marginBottom: 24 }}>
        <h1 className="coach-h1">{displayLabel}</h1>
        {member?.player_email && (
          <p className="coach-subtitle">{member.player_email}</p>
        )}
      </header>

      {loading ? (
        <div className="coach-card"><div className="coach-placeholder" style={{ minHeight: 200 }}><div className="spinner" /></div></div>
      ) : !member ? (
        <div className="coach-card">
          <div className="coach-placeholder">
            <div className="coach-placeholder-title">Nie znaleziono zawodnika</div>
            <div>Mogło zostać usunięte z drużyny.</div>
          </div>
        </div>
      ) : (
        <>
          {/* Edycja danych */}
          <div className="coach-card" style={{ marginBottom: 16 }}>
            <h2 className="coach-h2" style={{ marginBottom: 4 }}>Dane zawodnika</h2>
            <p className="coach-subtitle" style={{ marginBottom: 16 }}>Imię i numer dla Ciebie — nie zmienia ustawień gracza w jego aplikacji.</p>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label className="coach-label">Imię</label>
                <input className="coach-input" type="text" value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="np. Jan"/>
              </div>
              <div>
                <label className="coach-label">Nazwisko</label>
                <input className="coach-input" type="text" value={lastName} onChange={e => setLastName(e.target.value)} placeholder="np. Kowalski"/>
              </div>
            </div>
            <div style={{ marginBottom: 16, maxWidth: 140 }}>
              <label className="coach-label">Numer (0–99)</label>
              <input className="coach-input" type="number" min="0" max="99" value={jersey} onChange={e => setJersey(e.target.value)} placeholder="—" style={{ textAlign: 'center' }}/>
            </div>

            {error && (
              <div style={{ background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A', padding: '10px 12px', borderRadius: 10, fontSize: 13, marginBottom: 12 }}>
                {error}
              </div>
            )}

            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button onClick={save} disabled={saving} className="coach-btn-primary" style={{ opacity: saving ? 0.6 : 1 }}>
                {saving ? 'Zapisywanie...' : 'Zapisz'}
              </button>
              {savedAt && <span style={{ fontSize: 12, color: '#3FA86A', fontWeight: 600 }}>✓ Zapisano</span>}
            </div>
          </div>

          {/* Statystyki zawodnika */}
          <div className="coach-card" style={{ marginBottom: 16 }}>
            <h2 className="coach-h2" style={{ marginBottom: 16 }}>Statystyki</h2>
            {!stats ? (
              <div className="coach-placeholder" style={{ minHeight: 80 }}><div className="spinner" /></div>
            ) : (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 16 }}>
                  <StatTile label="Arena" value={arenaName} sub={`${stats.xp} XP`} accent="#5591CD" />
                  <StatTile label="Obecność" value={attRate != null ? `${attRate}%` : '—'} sub={`${att.present + att.late}/${attTotal} treningów`} accent="#3FA86A" />
                  <StatTile label="Wynik ub. tydzień" value={String(stats.last_week_score)} sub="pkt" accent="#E5A93C" />
                </div>

                {attTotal > 0 && (
                  <div style={{ fontSize: 12, color: '#8A9AB0', marginBottom: shotTypes.length ? 18 : 0 }}>
                    Obecny: <b style={{ color: '#3FA86A' }}>{att.present}</b> · Spóźniony: <b style={{ color: '#E5A93C' }}>{att.late}</b> · Nieobecny: <b style={{ color: '#D85546' }}>{att.absent}</b>
                  </div>
                )}

                {shotTypes.length > 0 ? (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.8, color: '#8A9AB0', marginBottom: 10 }}>Rzuty</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {shotTypes.map(st => {
                        const s = shooting[st]
                        const pct = s.attempted ? Math.round((s.made / s.attempted) * 100) : 0
                        return (
                          <div key={st} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                            <span style={{ width: 54, fontSize: 12, fontWeight: 700, color: '#1A2233' }}>{st.toUpperCase()}</span>
                            <div style={{ flex: 1, height: 8, borderRadius: 99, background: '#EDF1F7', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: '#5591CD' }} />
                            </div>
                            <span style={{ width: 100, textAlign: 'right', fontSize: 12, color: '#4D5C73' }}>{s.made}/{s.attempted} · {pct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 12, color: '#8A9AB0', margin: 0 }}>Brak jeszcze danych o rzutach.</p>
                )}
              </>
            )}
          </div>

          {/* Strefa niebezpieczna — usuwanie */}
          <div className="coach-card" style={{ borderColor: '#FCE5E2' }}>
            <h2 className="coach-h2" style={{ color: '#D85546', marginBottom: 4 }}>Usuń z drużyny</h2>
            <p className="coach-subtitle" style={{ marginBottom: 16 }}>
              Zawodnik dostanie powiadomienie i przestanie być widoczny w Twojej drużynie. Może wrócić tylko przez nowe zaproszenie.
            </p>

            {confirmRemove ? (
              <div style={{ display: 'flex', gap: 10 }}>
                <button onClick={() => setConfirmRemove(false)} disabled={removing} className="coach-btn-secondary" style={{ flex: 1 }}>
                  Anuluj
                </button>
                <button onClick={remove} disabled={removing} className="coach-btn-primary"
                  style={{ flex: 1, background: '#D85546', opacity: removing ? 0.6 : 1 }}>
                  {removing ? 'Usuwanie...' : 'Tak, usuń'}
                </button>
              </div>
            ) : (
              <button onClick={() => setConfirmRemove(true)} className="coach-btn-secondary"
                style={{ borderColor: '#D85546', color: '#D85546' }}>
                Usuń zawodnika
              </button>
            )}
          </div>
        </>
      )}
    </div>
  )
}

function StatTile({ label, value, sub, accent }) {
  return (
    <div style={{ background: '#F6F8FB', borderRadius: 12, padding: '12px 14px' }}>
      <div style={{ fontSize: 10.5, fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.6, color: '#8A9AB0', marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent || '#1A2233', lineHeight: 1.1 }}>{value ?? '—'}</div>
      {sub && <div style={{ fontSize: 11, color: '#8A9AB0', marginTop: 2 }}>{sub}</div>}
    </div>
  )
}
