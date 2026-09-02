import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { formatTime } from '../lib/dateUtil'

const STATUS_BUTTONS = [
  { value: 'present', label: 'Obecny',     short: '✓', color: '#3FA86A' },
  { value: 'late',    label: 'Spóźniony',  short: '◐', color: '#E5A93C' },
  { value: 'absent',  label: 'Nieobecny',  short: '✗', color: '#D85546' },
]

/**
 * Sheet do zaznaczania frekwencji na konkretnym treningu.
 *
 * Props:
 *   practice — { id, scheduled_at, ... }
 *   onClose
 */
export default function PracticeAttendanceModal({ practice, onClose }) {
  const [roster, setRoster] = useState([])
  const [loading, setLoading] = useState(true)
  const [savingId, setSavingId] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    if (!practice?.id) return
    load()
  }, [practice?.id])

  async function load() {
    setLoading(true); setError(null)
    const { data, error } = await supabase.rpc('get_practice_attendance', { p_practice_id: practice.id })
    if (error) { setError(error.message); setLoading(false); return }
    setRoster(data || [])
    setLoading(false)
  }

  async function mark(playerId, status) {
    // Toggle off when clicking the same status that's already set
    const current = roster.find(r => r.player_id === playerId)?.status
    const next = (current === status) ? null : status

    // Optimistic
    setRoster(prev => prev.map(r =>
      r.player_id === playerId ? { ...r, status: next } : r
    ))
    setSavingId(playerId)
    const { error } = await supabase.rpc('mark_attendance', {
      p_practice_id: practice.id,
      p_player_id:   playerId,
      p_status:      next,
    })
    setSavingId(null)
    if (error) {
      setError(error.message)
      await load()  // resync
    }
  }

  async function markAll(status) {
    setSavingId('__all__')
    setError(null)
    // Mark every player that doesn't already have this status
    const targets = roster.filter(r => r.status !== status)
    setRoster(prev => prev.map(r => ({ ...r, status })))
    for (const r of targets) {
      const { error } = await supabase.rpc('mark_attendance', {
        p_practice_id: practice.id,
        p_player_id:   r.player_id,
        p_status:      status,
      })
      if (error) { setError(error.message); break }
    }
    setSavingId(null)
    await load()
  }

  const counts = roster.reduce((acc, r) => {
    if (r.status) acc[r.status] = (acc[r.status] || 0) + 1
    return acc
  }, {})

  const dateLabel = practice
    ? new Date(practice.scheduled_at).toLocaleDateString('pl-PL', {
        day: 'numeric', month: 'long',
      }) + ' · ' + formatTime(practice.scheduled_at)
    : ''

  return (
    <div onClick={onClose} style={{
      position: 'fixed', inset: 0, zIndex: 220,
      background: 'rgba(20,35,60,0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20,
    }}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FFFFFF', width: '100%', maxWidth: 560,
        borderRadius: 18, padding: '24px 24px 20px',
        maxHeight: '92vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
          <h2 className="coach-h2">Frekwencja</h2>
          <button onClick={onClose} style={{
            background: 'transparent', border: 'none', color: '#8A9AB0',
            fontSize: 22, cursor: 'pointer', lineHeight: 1,
          }}>×</button>
        </div>
        <p className="coach-subtitle" style={{ marginBottom: 16 }}>{dateLabel}</p>

        {/* Counters */}
        <div style={{
          display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap',
        }}>
          {STATUS_BUTTONS.map(s => (
            <div key={s.value} style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              padding: '4px 10px', borderRadius: 99,
              background: `${s.color}14`, border: `1px solid ${s.color}40`,
              color: s.color, fontSize: 12, fontWeight: 600,
            }}>
              <span style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }}/>
              {s.label}: <strong>{counts[s.value] || 0}</strong>
            </div>
          ))}
          <div style={{ flex: 1 }}/>
          <button onClick={() => markAll('present')} disabled={savingId === '__all__'}
            className="coach-btn-ghost" style={{ padding: '4px 10px', fontSize: 12 }}>
            Wszyscy obecni
          </button>
        </div>

        {error && (
          <div style={{
            background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A',
            padding: '8px 12px', borderRadius: 10, fontSize: 13, marginBottom: 12,
          }}>{error}</div>
        )}

        {loading ? (
          <div style={{ padding: 40, textAlign: 'center' }}><div className="spinner" /></div>
        ) : roster.length === 0 ? (
          <div style={{ padding: 32, textAlign: 'center', color: '#8A9AB0', fontSize: 13 }}>
            Brak zawodników w drużynie. Najpierw dodaj zawodników w zakładce Drużyna.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {roster.map(p => {
              const fullName = [p.display_first_name, p.display_last_name].filter(Boolean).join(' ')
              const emailLocal = p.player_email?.split('@')[0] || ''
              const label = fullName || emailLocal || 'Zawodnik'
              return (
                <div key={p.player_id} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '8px 12px', borderRadius: 11,
                  background: '#FAFBFC', border: '1px solid #E6ECF3',
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: 14, fontWeight: 600, color: '#1A2233',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis',
                    }}>{label}</div>
                    {p.jersey_number != null && (
                      <div style={{ fontSize: 11, color: '#8A9AB0' }}>#{p.jersey_number}</div>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 4 }}>
                    {STATUS_BUTTONS.map(s => {
                      const active = p.status === s.value
                      return (
                        <button key={s.value}
                          onClick={() => mark(p.player_id, s.value)}
                          disabled={savingId === p.player_id || savingId === '__all__'}
                          title={s.label}
                          style={{
                            width: 36, height: 36, borderRadius: 9,
                            border: `1.5px solid ${active ? s.color : '#D4DDE8'}`,
                            background: active ? s.color : '#FFFFFF',
                            color:      active ? '#FFFFFF' : s.color,
                            fontSize: 16, fontWeight: 700, cursor: 'pointer',
                            display: 'grid', placeItems: 'center',
                            WebkitTapHighlightColor: 'transparent',
                            transition: 'background 0.1s, border-color 0.1s',
                          }}>
                          {s.short}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
