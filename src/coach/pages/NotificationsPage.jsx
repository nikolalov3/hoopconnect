import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useCoachAuth } from '../context/CoachAuthContext'

export default function NotificationsPage() {
  const { currentTeam } = useCoachAuth()
  const [broadcasts, setBroadcasts] = useState([])
  const [roster, setRoster]         = useState([])
  const [loading, setLoading]       = useState(true)
  const [expandedId, setExpandedId] = useState(null)
  const [revoking, setRevoking]     = useState(null)

  // Compose form
  const [title, setTitle] = useState('')
  const [body, setBody]   = useState('')
  const [mode, setMode]   = useState('all')              // 'all' | 'select'
  const [selected, setSelected] = useState(new Set())
  const [sending, setSending] = useState(false)
  const [error, setError]     = useState(null)
  const [success, setSuccess] = useState(null)

  useEffect(() => {
    if (!currentTeam?.id) return
    load()
  }, [currentTeam?.id])

  async function load() {
    setLoading(true)
    const [bRes, rRes] = await Promise.all([
      supabase.from('coach_broadcasts')
        .select('*').eq('team_id', currentTeam.id)
        .order('created_at', { ascending: false }).limit(30),
      supabase.rpc('get_team_roster', { p_team_id: currentTeam.id }),
    ])
    setBroadcasts(bRes.data || [])
    setRoster(rRes.data || [])
    setLoading(false)
  }

  // Realtime: refresh historii gdy ktoś (np. inny zalogowany trener) cofnie
  useEffect(() => {
    if (!currentTeam?.id) return
    let channel = null
    try {
      channel = supabase
        .channel(`coach-broadcasts-${currentTeam.id}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'coach_broadcasts',
          filter: `team_id=eq.${currentTeam.id}`,
        }, () => load())
        .subscribe()
    } catch {}
    return () => { try { if (channel) supabase.removeChannel(channel) } catch {} }
  }, [currentTeam?.id])

  const toggleSelect = (id) => {
    setSelected(prev => {
      const n = new Set(prev)
      if (n.has(id)) n.delete(id); else n.add(id)
      return n
    })
  }

  const send = async (e) => {
    e?.preventDefault()
    setError(null); setSuccess(null)
    if (!body.trim()) { setError('Wpisz treść powiadomienia.'); return }
    if (mode === 'select' && selected.size === 0) {
      setError('Wybierz co najmniej jednego zawodnika.'); return
    }
    setSending(true)
    const { data, error: rpcErr } = await supabase.rpc('send_coach_broadcast', {
      p_team_id:    currentTeam.id,
      p_title:      title.trim() || null,
      p_body:       body.trim(),
      p_player_ids: mode === 'all' ? null : Array.from(selected),
    })
    setSending(false)
    if (rpcErr) { setError(rpcErr.message); return }
    setSuccess(`Wysłano do ${data?.recipient_count || 0} zawodników.`)
    setTitle(''); setBody(''); setMode('all'); setSelected(new Set())
    load()
    setTimeout(() => setSuccess(null), 4000)
  }

  const revoke = async (id) => {
    setRevoking(id)
    const { error } = await supabase.rpc('revoke_coach_broadcast', { p_broadcast_id: id })
    setRevoking(null)
    if (error) { setError(error.message); return }
    load()
  }

  const nameOf = (playerId) => {
    const m = roster.find(r => r.player_id === playerId)
    if (!m) return playerId.slice(0, 8) + '…'
    const full = [m.display_first_name, m.display_last_name].filter(Boolean).join(' ')
    return full || (m.player_email?.split('@')[0]) || 'Zawodnik'
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="coach-h1">Powiadomienia</h1>
        <p className="coach-subtitle">Wyślij wiadomość do całej drużyny lub wybranych zawodników.</p>
      </header>

      {/* Compose */}
      <div className="coach-card" style={{ marginBottom: 18 }}>
        <h2 className="coach-h2" style={{ marginBottom: 16 }}>Nowe powiadomienie</h2>

        <form onSubmit={send} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="coach-label">Tytuł (opcjonalny)</label>
            <input className="coach-input" type="text" value={title}
              onChange={e => setTitle(e.target.value)} maxLength={80}
              placeholder="np. Trening odwołany"/>
          </div>
          <div>
            <label className="coach-label">Treść *</label>
            <textarea className="coach-input" rows="4" value={body}
              onChange={e => setBody(e.target.value)} required
              placeholder="Co chcesz przekazać drużynie?"
              style={{ resize: 'vertical', fontFamily: 'inherit' }}/>
          </div>

          <div>
            <label className="coach-label">Odbiorcy</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" onClick={() => setMode('all')}
                className={mode === 'all' ? 'coach-btn-primary' : 'coach-btn-secondary'}
                style={{ flex: 1, padding: '10px', fontSize: 13 }}>
                Cała drużyna ({roster.length})
              </button>
              <button type="button" onClick={() => setMode('select')}
                className={mode === 'select' ? 'coach-btn-primary' : 'coach-btn-secondary'}
                style={{ flex: 1, padding: '10px', fontSize: 13 }}>
                Wybrani ({selected.size})
              </button>
            </div>
          </div>

          {mode === 'select' && (
            <div style={{
              border: '1px solid #E6ECF3', borderRadius: 12, padding: 4,
              maxHeight: 220, overflowY: 'auto',
            }}>
              {roster.length === 0 ? (
                <div style={{ padding: 18, fontSize: 13, color: '#8A9AB0', textAlign: 'center' }}>
                  Brak zawodników w drużynie.
                </div>
              ) : roster.map(r => {
                const fullName = [r.display_first_name, r.display_last_name].filter(Boolean).join(' ')
                const label = fullName || r.player_email?.split('@')[0] || 'Zawodnik'
                const checked = selected.has(r.player_id)
                return (
                  <label key={r.player_id} style={{
                    display: 'flex', alignItems: 'center', gap: 10, padding: '8px 10px',
                    cursor: 'pointer', borderRadius: 8,
                    background: checked ? '#E8F1FA' : 'transparent',
                  }}>
                    <input type="checkbox" checked={checked}
                      onChange={() => toggleSelect(r.player_id)}/>
                    <span style={{ flex: 1, fontSize: 13, color: '#1A2233' }}>{label}</span>
                    {r.jersey_number != null && (
                      <span style={{ fontSize: 11, color: '#8A9AB0' }}>#{r.jersey_number}</span>
                    )}
                  </label>
                )
              })}
            </div>
          )}

          {error && (
            <div style={{ background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A',
              padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>{error}</div>
          )}
          {success && (
            <div style={{ background: '#E2F4EB', border: '1px solid #9CD9B7', color: '#1E6B3D',
              padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>{success}</div>
          )}

          <button type="submit" className="coach-btn-primary" disabled={sending}
            style={{ opacity: sending ? 0.6 : 1, alignSelf: 'flex-start' }}>
            {sending ? 'Wysyłanie...' : 'Wyślij'}
          </button>
        </form>
      </div>

      {/* History */}
      <div className="coach-card">
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Historia</h2>
        <p className="coach-subtitle" style={{ marginBottom: 16 }}>
          Wysłane powiadomienia. Cofnięcie usuwa je z aplikacji odbiorców.
        </p>

        {loading ? (
          <div className="coach-placeholder" style={{ minHeight: 120 }}><div className="spinner" /></div>
        ) : broadcasts.length === 0 ? (
          <div className="coach-placeholder" style={{ minHeight: 100 }}>
            <div>Brak wysłanych powiadomień.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {broadcasts.map(b => {
              const isOpen = expandedId === b.id
              const isRevoked = !!b.revoked_at
              const dateStr = new Date(b.created_at).toLocaleDateString('pl-PL', {
                day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
              })
              return (
                <div key={b.id} style={{
                  border: '1px solid #E6ECF3', borderRadius: 12,
                  background: isRevoked ? '#FAFBFC' : '#FFFFFF',
                  opacity: isRevoked ? 0.7 : 1,
                }}>
                  <button onClick={() => setExpandedId(isOpen ? null : b.id)}
                    style={{
                      width: '100%', background: 'transparent', border: 'none',
                      padding: '12px 14px', display: 'flex', alignItems: 'flex-start',
                      gap: 12, cursor: 'pointer', textAlign: 'left',
                    }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2233',
                        textDecoration: isRevoked ? 'line-through' : 'none' }}>
                        {b.title || b.body.slice(0, 60) + (b.body.length > 60 ? '…' : '')}
                      </div>
                      <div style={{ fontSize: 11, color: '#8A9AB0', marginTop: 2 }}>
                        {dateStr} · {b.recipient_count} {b.recipient_count === 1 ? 'odbiorca' : 'odbiorców'}
                        {isRevoked && ' · cofnięte'}
                      </div>
                    </div>
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#8A9AB0" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"
                      style={{ transform: isOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </button>
                  {isOpen && (
                    <div style={{ padding: '0 14px 14px', borderTop: '1px solid #F0F3F7' }}>
                      {b.title && (
                        <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2233', marginTop: 12, marginBottom: 4 }}>
                          {b.title}
                        </div>
                      )}
                      <div style={{ fontSize: 13, color: '#4D5C73', lineHeight: 1.55, whiteSpace: 'pre-wrap',
                        marginTop: b.title ? 0 : 12, marginBottom: 12 }}>
                        {b.body}
                      </div>
                      {b.recipient_player_ids && b.recipient_player_ids.length > 0 && (
                        <div style={{ marginBottom: 12 }}>
                          <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 0.6, textTransform: 'uppercase', color: '#8A9AB0', marginBottom: 4 }}>
                            Wysłane do:
                          </div>
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                            {b.recipient_player_ids.map(pid => (
                              <span key={pid} style={{
                                fontSize: 11, color: '#4D5C73',
                                background: '#F6F8FB', border: '1px solid #E6ECF3',
                                padding: '3px 8px', borderRadius: 99,
                              }}>{nameOf(pid)}</span>
                            ))}
                          </div>
                        </div>
                      )}
                      {!isRevoked && (
                        <button onClick={() => revoke(b.id)} disabled={revoking === b.id}
                          style={{
                            padding: '8px 14px', borderRadius: 9,
                            border: '1px solid #D85546', background: 'transparent',
                            color: '#D85546', fontSize: 12, fontWeight: 600,
                            cursor: 'pointer', opacity: revoking === b.id ? 0.5 : 1,
                          }}>
                          {revoking === b.id ? 'Cofanie...' : 'Cofnij powiadomienie'}
                        </button>
                      )}
                      {isRevoked && (
                        <div style={{ fontSize: 11, color: '#8A9AB0' }}>
                          Cofnięte {new Date(b.revoked_at).toLocaleDateString('pl-PL', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
