import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getCache, setCache } from '../lib/queryCache'
import { shareStatsCard, doShare } from '../lib/shareCard'

const SHOT_LABELS = { '3pt': 'Trójki', '2pt': 'Dwójki', ft: 'Wolne' }

const BLUE = '#5BB8F5'

const IconOverall = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/>
  </svg>
)
const IconThree = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="9"/>
    <path d="M12 3a9 9 0 0 1 6.36 15.36"/>
    <path d="M3 12h18"/>
    <path d="M12 3c2 2.5 3 5.5 3 9s-1 6.5-3 9"/>
  </svg>
)
const IconMid = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="12" r="3"/>
    <path d="M12 2v3M12 19v3M2 12h3M19 12h3"/>
    <path d="M5.64 5.64l2.12 2.12M16.24 16.24l2.12 2.12M16.24 7.76l2.12-2.12M5.64 18.36l2.12-2.12"/>
  </svg>
)
const IconFT = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <circle cx="12" cy="5" r="2"/>
    <path d="M12 7v8"/><path d="M8 21h8"/><path d="M10 21v-4"/><path d="M14 21v-4"/>
    <path d="M8 12l-2 3"/><path d="M16 12l2 3"/>
  </svg>
)

const FILTERS = [
  { key: '7d',  label: '7 dni' },
  { key: '30d', label: '30 dni' },
  { key: 'all', label: 'Wszystko' },
]

const glassCard = {
  background: 'rgba(6,14,30,0.52)',
  backdropFilter: 'blur(24px) saturate(1.7)',
  WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
  border: '1px solid rgba(120,190,255,0.09)',
  borderTop: '1px solid rgba(160,210,255,0.16)',
  borderRadius: 'var(--radius)',
  boxShadow: '0 4px 20px rgba(0,0,0,0.25), inset 0 1px 0 rgba(180,220,255,0.06)',
}

function StatTile({ label, value, sub, accent }) {
  return (
    <div style={{ ...glassCard, padding: '18px 14px', textAlign: 'center' }}>
      <p style={{
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 42,
        color: accent || 'var(--orange)', lineHeight: 1,
        textShadow: `0 0 20px ${accent || 'rgba(91,184,245,0.40)'}`,
      }}>{value}</p>
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 600,
        letterSpacing: 2, textTransform: 'uppercase', color: 'var(--text-dim)', marginTop: 6,
      }}>{label}</p>
      {sub && <p style={{ fontSize: 11, color: 'var(--text-dim)', marginTop: 3 }}>{sub}</p>}
    </div>
  )
}

function ScrollStatCard({ icon, label, pct, made, attempted, sessions, accent, filterLabel, snapAlign }) {
  const pctColor = accent || (pct >= 50 ? 'var(--green-shot)' : pct >= 35 ? 'var(--orange)' : pct === 0 ? 'var(--text-dim)' : 'var(--red-shot)')
  return (
    <div style={{
      flex: '0 0 78%',
      scrollSnapAlign: snapAlign || 'center',
      scrollSnapStop: 'always',
      ...glassCard,
      padding: '20px 18px 18px',
      display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
      minHeight: 148,
      border: `1px solid rgba(180,180,200,0.18)`,
      borderTop: `1px solid rgba(200,200,220,0.30)`,
      boxShadow: `0 8px 28px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.08), 0 0 0 0.5px rgba(160,160,180,0.10), 0 0 12px ${pctColor}15`,
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ marginBottom: 6, opacity: 0.85 }}>{icon}</div>
          <p style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
            color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 1,
          }}>{label}</p>
          <p style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 1 }}>{filterLabel}</p>
        </div>
        <p style={{
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 52,
          color: pctColor, lineHeight: 1, letterSpacing: -2,
          textShadow: `0 0 24px ${pctColor}55`,
        }}>{pct}%</p>
      </div>
      <div>
        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 3, height: 3, overflow: 'hidden', marginBottom: 8 }}>
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${pct}%` }} transition={{ duration: 0.9, ease: 'easeOut' }}
            style={{ height: '100%', borderRadius: 3, background: pctColor, boxShadow: `0 0 6px ${pctColor}` }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 500 }}>
            {made} / {attempted} rzutów
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: 11 }}>
            {sessions} {sessions === 1 ? 'sesja' : sessions < 5 ? 'sesje' : 'sesji'}
          </p>
        </div>
      </div>
    </div>
  )
}

function filterByDate(sessions, range) {
  if (range === 'all') return sessions
  const now = new Date()
  const days = range === '7d' ? 7 : 30
  const cutoff = new Date(now.getFullYear(), now.getMonth(), now.getDate() - days + 1)
  return sessions.filter(s => new Date(s.session_date) >= cutoff)
}

export default function StatsPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [sessions, setSessions] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('7d')

  useEffect(() => {
    if (!profile) return
    const cacheKey = `sessions:${profile.id}`
    // Pokaż cache natychmiast — zero opóźnienia przy powrocie na kartę
    const cached = getCache(cacheKey)
    if (cached) { setSessions(cached); setLoading(false) }
    // Odśwież w tle
    supabase
      .from('shooting_sessions')
      .select('*, trainings(title)')
      .eq('user_id', profile.id)
      .order('session_date', { ascending: false })
      .then(({ data }) => {
        if (data) { setCache(cacheKey, data, 2 * 60 * 1000); setSessions(data) }
        setLoading(false)
      })
  }, [profile])

  const filtered = useMemo(() => filterByDate(sessions, filter), [sessions, filter])

  const byType = useMemo(() => {
    const acc = {}
    filtered.forEach(s => {
      if (!acc[s.shot_type]) acc[s.shot_type] = { made: 0, attempted: 0, sessions: 0 }
      acc[s.shot_type].made      += s.made
      acc[s.shot_type].attempted += s.attempted
      acc[s.shot_type].sessions  += 1
    })
    return acc
  }, [filtered])

  const totalMade      = filtered.reduce((a, s) => a + s.made, 0)
  const totalAttempted = filtered.reduce((a, s) => a + s.attempted, 0)
  const totalPct       = totalAttempted > 0 ? Math.round((totalMade / totalAttempted) * 100) : 0

  const filterLabel = filter === '7d' ? 'ostatnie 7 dni' : filter === '30d' ? 'ostatnie 30 dni' : 'wszystkie'

  const [sharing, setSharing] = useState(false)
  async function handleShare() {
    setSharing(true)
    try {
      const blob = await shareStatsCard({ sessions: filtered, profile, filter })
      await doShare(blob, 'hoopconnect-statystyki.png')
    } finally {
      setSharing(false)
    }
  }

  const SCROLL_CARDS = [
    { key: 'all', icon: <IconOverall />, label: 'Ogólnie',   type: null },
    { key: '3pt', icon: <IconThree />,   label: 'Trójki',    type: '3pt' },
    { key: '2pt', icon: <IconMid />,     label: 'Mid-Range', type: '2pt' },
    { key: 'ft',  icon: <IconFT />,      label: 'Wolne',     type: 'ft'  },
  ]

  return (
    <div className="page-content" style={{ padding: '32px 22px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 18 }}>
        <div>
          <p className="section-label" style={{ marginBottom: 4 }}>Twoje wyniki</p>
          <h1 className="display-title" style={{ fontSize: 38 }}>Statystyki</h1>
        </div>
        {/* Icon row — bare icon buttons, no background */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* Calendar icon — bare, matches gear/sparkle style */}
          <motion.button
            whileTap={{ scale: 0.82 }}
            onClick={() => navigate('/calendar')}
            style={{
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none', cursor: 'pointer',
              color: 'rgba(200,210,230,0.55)',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              {/* Calendar outline */}
              <rect x="3" y="4" width="18" height="17" rx="2"/>
              <path d="M16 2v4M8 2v4M3 9h18"/>
              {/* Dot grid — activity indicators */}
              <circle cx="8"  cy="14" r="1" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="14" r="1" fill="currentColor" stroke="none"/>
              <circle cx="16" cy="14" r="1" fill="currentColor" stroke="none"/>
              <circle cx="8"  cy="18" r="1" fill="currentColor" stroke="none"/>
              <circle cx="12" cy="18" r="1" fill="currentColor" stroke="none"/>
            </svg>
          </motion.button>

          {/* Share icon — bare, same style */}
          <motion.button
            whileTap={{ scale: 0.82 }}
            onClick={handleShare}
            disabled={sharing || filtered.length === 0}
            style={{
              width: 40, height: 40,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: 'none', border: 'none',
              cursor: (sharing || filtered.length === 0) ? 'default' : 'pointer',
              color: 'rgba(200,210,230,0.55)',
              opacity: filtered.length === 0 ? 0.25 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
              <polyline points="16 6 12 2 8 6"/>
              <line x1="12" y1="2" x2="12" y2="15"/>
            </svg>
          </motion.button>
        </div>
      </div>

      {/* ── FILTRY ── */}
      <div style={{
        display: 'flex', marginBottom: 20,
        background: 'rgba(6,14,30,0.52)',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(120,190,255,0.09)',
        borderTop: '1px solid rgba(160,210,255,0.15)',
        borderRadius: 99,
        padding: 3,
        boxShadow: '0 4px 18px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>
        {FILTERS.map(({ key, label }) => {
          const active = filter === key
          return (
            <motion.button
              key={key}
              whileTap={{ scale: 0.94 }}
              onClick={() => setFilter(key)}
              style={{
                position: 'relative', flex: 1,
                padding: '11px 0',
                borderRadius: 99, border: 'none', cursor: 'pointer',
                background: 'transparent',
                fontFamily: 'var(--font-body)', fontWeight: active ? 700 : 500,
                fontSize: 9.5, letterSpacing: 1.2, textTransform: 'uppercase',
                color: active ? 'var(--text-primary)' : 'var(--text-dim)',
                transition: 'color 0.18s',
                zIndex: 1,
              }}
            >
              {active && (
                <motion.div
                  layoutId="stats-filter-pill"
                  transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                  style={{
                    position: 'absolute', inset: 0, borderRadius: 99, zIndex: -1,
                    background: 'linear-gradient(145deg, rgba(40,130,220,0.90), rgba(16,90,180,0.95))',
                    boxShadow: '0 2px 14px rgba(91,184,245,0.28), inset 0 1px 0 rgba(180,230,255,0.18)',
                  }}
                />
              )}
              {label}
            </motion.button>
          )
        })}
      </div>

      {/* ── SERIA (stały kafelek) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatTile label="Seria"  value={profile?.streak || 0} sub="dni z rzędu" />
        <StatTile label="Sesje"  value={filtered.length}      sub={filterLabel} accent="var(--text-secondary)" />
      </div>

      {/* ── SCROLL KART RZUTOWYCH ── */}
      <div style={{
        display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory',
        WebkitOverflowScrolling: 'touch', scrollbarWidth: 'none',
        margin: '0 -22px', padding: '0 22px 4px',
        scrollPaddingLeft: 22, scrollPaddingRight: 22,
        marginBottom: 24,
      }}>
        {SCROLL_CARDS.map(({ key, icon, label, type }, index) => {
          const isFirst = index === 0
          const isLast  = index === SCROLL_CARDS.length - 1
          const snapAlign = isFirst ? 'start' : isLast ? 'end' : 'center'
          const d = type ? byType[type] : { made: totalMade, attempted: totalAttempted, sessions: filtered.length }
          const made      = d?.made      || 0
          const attempted = d?.attempted || 0
          const sessions  = d?.sessions  || 0
          const pct = attempted > 0 ? Math.round((made / attempted) * 100) : 0
          return (
            <ScrollStatCard
              key={key}
              icon={icon}
              label={label}
              pct={pct}
              made={made}
              attempted={attempted}
              sessions={sessions}
              filterLabel={filterLabel}
              snapAlign={snapAlign}
            />
          )
        })}
      </div>


      {/* ── OSTATNIE SESJE ── */}
      <p className="section-label" style={{ marginBottom: 14 }}>Sesje ({filtered.length})</p>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <div className="spinner" />
        </div>
      ) : filtered.length === 0 ? (
        <div style={{ ...glassCard, textAlign: 'center', padding: 32 }}>
          <p style={{ fontSize: 28 }}>🏀</p>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
            Brak sesji – zacznij trening!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 32 }}>
          {filtered.map(s => {
            const pct  = s.attempted > 0 ? Math.round((s.made / s.attempted) * 100) : 0
            const good = pct >= 50
            return (
              <div key={s.id} style={{
                background: 'rgba(10,6,3,0.55)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.09)',
                borderTop: '1px solid rgba(255,255,255,0.14)',
                borderRadius: 'var(--radius-sm)',
                padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: '0 4px 16px rgba(0,0,0,0.35)',
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: good ? 'rgba(0,230,118,0.10)' : 'rgba(255,61,61,0.10)',
                  border: `1px solid ${good ? 'rgba(0,230,118,0.22)' : 'rgba(255,61,61,0.22)'}`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 13,
                  color: good ? 'var(--green-shot)' : 'var(--red-shot)',
                }}>
                  {pct}%
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontWeight: 600, fontSize: 14, overflow: 'hidden',
                    textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    color: 'var(--text-primary)', textTransform: 'uppercase',
                    letterSpacing: 0.5, fontFamily: 'var(--font-display)',
                  }}>
                    {s.trainings?.title || SHOT_LABELS[s.shot_type]}
                  </p>
                  <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>
                    {s.made}/{s.attempted} · {new Date(s.session_date).toLocaleDateString('pl-PL')}
                  </p>
                </div>
                <span className={`badge ${s.shot_type === '3pt' ? 'badge-orange' : s.shot_type === '2pt' ? 'badge-green' : 'badge-gray'}`}>
                  {SHOT_LABELS[s.shot_type]}
                </span>
              </div>
            )
          })}
        </div>
      )}


    </div>
  )
}
