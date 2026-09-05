import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import HexAvatar from '../components/ui/HexAvatar'
import { ARENAS } from '../lib/arenas'

// ── /rank — publiczny ranking (bez logowania) ────────────────────────────────
// Metryki: XP (za mecze i grę), wygrane mecze (+ % wygranych), King of the Court —
// każda osobno. Draft Score celowo NIE: to prywatna, tygodniowa metryka użytkownika.
// Dane: RPC rank_board / rank_cities (security definer) → tylko publiczne pola, miasto
// jest filtrem (nie kolumną per osoba), profile z flagą anti-cheat pominięte.

const NAVY = '#060B16', BLUE = '#5BB8F5', TXT = '#EEF4FF', MUTED = 'rgba(238,244,255,0.55)', DIM = 'rgba(238,244,255,0.34)'
const MEDAL = ['#FFC940', '#C9D4E3', '#D9925B']
const h1 = { fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontWeight: 900, letterSpacing: 0.5 }
const glass = { background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.10)', borderRadius: 14 }
const METRICS = ['xp', 'matches', 'kotc']

export default function RankPage() {
  const { t } = useTranslation('rank')
  const { user } = useAuth()
  const me = user?.id || null
  const [metric, setMetric] = useState('xp')
  const [city, setCity]     = useState(null)
  const [period, setPeriod] = useState('all')
  const [cities, setCities] = useState([])
  const [rows, setRows]     = useState(null)   // null = ładowanie
  const [err, setErr]       = useState(false)

  useEffect(() => { document.title = `${t('title')} · HoopConnect` }, [t])
  useEffect(() => { supabase.rpc('rank_cities').then(({ data }) => setCities(Array.isArray(data) ? data : [])) }, [])
  useEffect(() => {
    let alive = true
    setRows(null); setErr(false)
    supabase.rpc('rank_board', { p_metric: metric, p_city: city, p_period: metric === 'matches' ? period : 'all', p_limit: 100 })
      .then(({ data, error }) => {
        if (!alive) return
        if (error) { setErr(true); setRows([]) } else setRows(Array.isArray(data) ? data : [])
      })
    return () => { alive = false }
  }, [metric, city, period])

  const value = (r) => metric === 'xp' ? `${r.value} XP` : metric === 'kotc' ? `${r.value} 🏆` : `${r.value} ${t('wins')}`
  const sub = (r) => metric === 'matches' ? `${r.played} ${t('games')} · ${r.pct ?? 0}%`
    : metric === 'kotc' ? `${r.played ?? 0} ${t('sessions')}`
    : (ARENAS[r.arena]?.name || '')
  const podium = rows ? rows.slice(0, 3) : []
  const rest   = rows ? rows.slice(3) : []

  return (
    <div style={{ minHeight: '100dvh', color: TXT, fontFamily: "'Barlow', sans-serif",
      background: `radial-gradient(ellipse 120% 60% at 50% -10%, rgba(91,184,245,0.16) 0%, transparent 60%), linear-gradient(170deg, #14243E 0%, #0B172A 52%, ${NAVY} 100%)` }}>
      <div style={{ maxWidth: 430, margin: '0 auto', padding: 'max(22px, env(safe-area-inset-top, 0px)) 18px 48px' }}>

        {/* Nagłówek */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6 }}>
          <img src="/hoop.svg" alt="" style={{ width: 26, height: 26, filter: 'drop-shadow(0 3px 10px rgba(91,184,245,0.45))' }} />
          <span style={{ fontSize: 11, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: MUTED }}>HoopConnect</span>
        </div>
        <h1 style={{ ...h1, fontSize: 40, margin: 0, lineHeight: 1 }}>{t('title')}</h1>
        <p style={{ color: MUTED, fontSize: 13, margin: '8px 0 18px', lineHeight: 1.45 }}>{t('subtitle')}</p>

        {/* Metryka */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 10 }}>
          {METRICS.map(m => <Pill key={m} active={metric === m} onClick={() => setMetric(m)}>{t(`tabs.${m}`)}</Pill>)}
        </div>
        {/* Miasto */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: metric === 'matches' ? 10 : 18 }}>
          <Pill small active={city === null} onClick={() => setCity(null)}>{t('allCities')}</Pill>
          {cities.map(c => <Pill key={c.city} small active={city === c.city} onClick={() => setCity(c.city)}>{c.city} <span style={{ opacity: 0.55 }}>{c.n}</span></Pill>)}
        </div>
        {/* Okres — tylko mecze */}
        {metric === 'matches' && (
          <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
            {['all', '30d'].map(p => <Pill key={p} small active={period === p} onClick={() => setPeriod(p)}>{t(`period.${p}`)}</Pill>)}
          </div>
        )}

        {/* Stany */}
        {rows === null && <p style={{ color: MUTED, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>{t('loading')}</p>}
        {rows && err && <p style={{ color: '#F3A6A6', fontSize: 13, textAlign: 'center', padding: '40px 0' }}>{t('unavailable')}</p>}
        {rows && !err && rows.length === 0 && <p style={{ color: MUTED, fontSize: 13, textAlign: 'center', padding: '40px 0' }}>{t('empty')}</p>}

        {/* Podium */}
        {podium.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.15fr 1fr', gap: 8, alignItems: 'end', marginBottom: 14 }}>
            {[podium[1], podium[0], podium[2]].map((r, i) => {
              if (!r) return <div key={`e${i}`} />
              const place = i === 1 ? 0 : i === 0 ? 1 : 2
              const mine = r.user_id === me
              return (
                <div key={r.user_id} style={{ ...glass, padding: place === 0 ? '16px 10px 14px' : '12px 8px 12px', textAlign: 'center',
                  border: `1px solid ${mine ? BLUE : MEDAL[place]}55`, boxShadow: `0 6px 24px ${MEDAL[place]}22` }}>
                  <div style={{ ...h1, fontSize: place === 0 ? 30 : 22, color: MEDAL[place], lineHeight: 1 }}>{place + 1}</div>
                  <div style={{ display: 'flex', justifyContent: 'center', margin: '8px 0 6px' }}>
                    <HexAvatar name={r.name} variant={r.frame} size={place === 0 ? 66 : 52} noAnim />
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}{mine ? ` · ${t('you')}` : ''}</div>
                  <div style={{ ...h1, fontSize: 17, color: MEDAL[place], marginTop: 4 }}>{value(r)}</div>
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 2 }}>{sub(r)}</div>
                </div>
              )
            })}
          </div>
        )}

        {/* Lista */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rest.map((r, i) => {
            const mine = r.user_id === me
            return (
              <div key={r.user_id} style={{ ...glass, display: 'flex', alignItems: 'center', gap: 12, padding: '9px 12px',
                border: `1px solid ${mine ? 'rgba(91,184,245,0.55)' : 'rgba(255,255,255,0.10)'}`, background: mine ? 'rgba(91,184,245,0.08)' : glass.background }}>
                <span style={{ ...h1, fontSize: 18, color: DIM, minWidth: 26, textAlign: 'center' }}>{i + 4}</span>
                <HexAvatar name={r.name} variant={r.frame} size={36} noAnim />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.name}{mine ? <span style={{ color: BLUE }}> · {t('you')}</span> : null}</div>
                  <div style={{ fontSize: 11.5, color: MUTED }}>{sub(r)}</div>
                </div>
                <div style={{ ...h1, fontSize: 17, color: TXT, whiteSpace: 'nowrap' }}>{value(r)}</div>
              </div>
            )
          })}
        </div>

        {/* CTA dla niezalogowanych */}
        {!me && rows && (
          <a href="/" style={{ display: 'block', marginTop: 26, padding: '14px 16px', borderRadius: 14, textDecoration: 'none',
            background: `linear-gradient(120deg, ${BLUE}, #2272C3)`, color: NAVY, textAlign: 'center' }}>
            <div style={{ ...h1, fontSize: 16 }}>{t('cta')}</div>
            <div style={{ fontSize: 12, opacity: 0.8, marginTop: 2 }}>{t('ctaSub')}</div>
          </a>
        )}
      </div>
    </div>
  )
}

function Pill({ active, onClick, small, children }) {
  return (
    <button onClick={onClick} style={{
      flex: small ? '0 0 auto' : 1, padding: small ? '6px 11px' : '9px 0', borderRadius: 999, cursor: 'pointer',
      fontSize: small ? 11.5 : 12.5, fontWeight: 800, fontFamily: 'inherit', letterSpacing: 0.3, whiteSpace: 'nowrap',
      border: `1px solid ${active ? BLUE + 'aa' : 'rgba(255,255,255,0.14)'}`,
      background: active ? 'rgba(91,184,245,0.16)' : 'rgba(255,255,255,0.04)', color: active ? BLUE : MUTED,
    }}>{children}</button>
  )
}
