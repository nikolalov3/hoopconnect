import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { listActiveSessions } from './api'

// ── Aktywne sesje KotC — globalna lista (bez kodu) ───────────────────────────
// lobby → „Dołącz" jednym tapnięciem (albo „Wróć", jeśli już jestem w środku),
// live → „Trwa" (nie da się dołączyć; „Wróć" jeśli to moja). Odświeża się na żywo
// ze zmian kotc_sessions / kotc_session_players (mały wolumen → bez filtra, z debounce).
// RPC kotc_list_active sprząta martwe sesje (m.in. samotne lobby > 15 min) przed listą.

const TXT = '#EEF4FF', MUTED = 'rgba(238,244,255,0.5)', BLUE = '#5BB8F5', LIVE = '#FF5A5A'

export default function KotcActiveSessions({ onJoin, onOpen, compact = false }) {
  const [rows, setRows] = useState(null)      // null = ładowanie
  const [busy, setBusy] = useState(null)      // id sesji w trakcie dołączania
  const [err, setErr] = useState('')

  const load = useCallback(() => {
    listActiveSessions().then(setRows).catch(() => setRows([]))
  }, [])

  useEffect(() => {
    load()
    let t = null
    const fire = () => { clearTimeout(t); t = setTimeout(load, 300) }
    const ch = supabase.channel('kotc-active-list')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_sessions' }, fire)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kotc_session_players' }, fire)
      .subscribe()
    return () => { clearTimeout(t); try { supabase.removeChannel(ch) } catch { /* już zamknięty */ } }
  }, [load])

  async function join(row) {
    setBusy(row.id); setErr('')
    try { await onJoin(row.code) } catch (e) { setErr(e?.message || 'Nie udało się dołączyć') } finally { setBusy(null) }
  }

  const label = (
    <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>
      Aktywne sesje
    </div>
  )

  if (rows === null) return <div>{label}<div style={{ fontSize: 12, color: MUTED }}>Szukam sesji…</div></div>
  if (!rows.length) {
    return (
      <div>{label}<div style={{ fontSize: 12.5, color: MUTED }}>Brak aktywnych sesji — utwórz pierwszą i podaj kod na boisku.</div></div>
    )
  }

  return (
    <div>
      {label}
      {err && <div style={{ fontSize: 12, color: '#F3A6A6', marginBottom: 8 }}>{err}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map(r => {
          const lobby = r.status === 'lobby'
          const full = r.players >= r.capacity
          const mine = !!r.i_am_in
          const canJoin = lobby && !full && !mine
          return (
            <div key={r.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: compact ? '9px 12px' : '11px 14px',
              borderRadius: 12, background: 'rgba(255,255,255,0.05)',
              border: `1px solid ${mine ? 'rgba(91,184,245,0.45)' : 'rgba(255,255,255,0.12)'}`,
            }}>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                  <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: compact ? 18 : 21, letterSpacing: 3, color: BLUE }}>{r.code}</span>
                  <span style={{ fontSize: 10.5, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: lobby ? '#3FD07F' : LIVE }}>
                    {lobby ? 'czeka' : '🔴 trwa'}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: MUTED, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  host <b style={{ color: TXT, fontWeight: 600 }}>{r.host_name}</b> · {r.players}/{r.capacity} graczy
                </div>
              </div>
              {mine ? (
                <button onClick={() => onOpen?.(r.id)} style={btn(BLUE, '#04213A')}>Wróć</button>
              ) : canJoin ? (
                <button onClick={() => join(r)} disabled={busy === r.id} style={{ ...btn(BLUE, '#04213A'), opacity: busy === r.id ? 0.6 : 1 }}>
                  {busy === r.id ? '…' : 'Dołącz'}
                </button>
              ) : (
                <span style={{ fontSize: 11, color: MUTED, whiteSpace: 'nowrap' }}>{lobby ? 'pełna' : 'w grze'}</span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

const btn = (bg, fg) => ({
  padding: '8px 14px', borderRadius: 10, border: 'none', cursor: 'pointer', flexShrink: 0,
  background: bg, color: fg, fontSize: 12.5, fontWeight: 800, fontFamily: 'inherit', letterSpacing: 0.3,
})
