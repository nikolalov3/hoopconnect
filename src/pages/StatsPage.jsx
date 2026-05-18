import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { getCache, setCache, bustCache } from '../lib/queryCache'
import { shareStatsCard, doShare } from '../lib/shareCard'
import { pct as calcPct } from '../lib/pct'
import AddSessionModal from '../components/ui/AddSessionModal'

const SHOT_LABELS = { '3pt': 'Trójki', '2pt': 'Dwójki', ft: 'Wolne' }

const BLUE = '#5BB8F5'

// Adekwatne ikony — czyste numery rzutowe w okręgu (3pt / 2pt / 1pt),
// plus trending-up dla ogólnego. Apple-style: minimalne, czytelne, na temat.
const NumIcon = ({ n }) => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
    <circle cx="12" cy="12" r="10" stroke={BLUE} strokeWidth="1.5" opacity="0.55"/>
    <text x="12" y="16" textAnchor="middle"
      fontFamily="var(--font-display)" fontSize="12" fontWeight="800" fill={BLUE}>
      {n}
    </text>
  </svg>
)
const IconOverall = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke={BLUE} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 17l6-6 4 4 8-8"/>
    <path d="M17 7h4v4"/>
  </svg>
)
const IconThree = () => <NumIcon n="3" />
const IconMid   = () => <NumIcon n="2" />
const IconFT    = () => <NumIcon n="1" />

const FILTERS = [
  { key: '7d',  label: '7 dni' },
  { key: '30d', label: '30 dni' },
  { key: 'all', label: 'Wszystko' },
]

// Liquid-glass material — Apple iOS-26 vibe.
// Krawędzie powstają z luminancji (jasny top-edge + ciemniejszy dół) zamiast
// twardych obrysów stroke. Daje wrażenie krawędzi "z światła", nie "z linii".
const glassCard = {
  background: 'linear-gradient(180deg, rgba(40,55,85,0.40) 0%, rgba(22,32,52,0.34) 100%)',
  backdropFilter: 'blur(30px) saturate(1.55)',
  WebkitBackdropFilter: 'blur(30px) saturate(1.55)',
  border: 'none',
  borderRadius: 14,
  boxShadow: [
    'inset 0 1px 0 rgba(200,225,255,0.10)',     // luminance top-edge
    'inset 0 -1px 0 rgba(0,0,0,0.18)',          // subtle bottom shade
    'inset 0 0 0 0.5px rgba(150,200,255,0.04)', // micro hairline for definition
    '0 1px 6px rgba(0,0,0,0.18)',               // ambient floor shadow
  ].join(', '),
}

function StatTile({ label, value, sub, accent }) {
  return (
    <div style={{ ...glassCard, padding: '18px 14px', textAlign: 'center' }}>
      <p style={{
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 38,
        color: accent || 'var(--orange)', lineHeight: 1,
        // Glow przyciszony — z 20px/full-alpha do 8px/niska alpha
        textShadow: `0 0 8px ${accent ? `${accent}33` : 'rgba(91,184,245,0.12)'}`,
      }}>{value}</p>
      <p style={{
        fontFamily: 'var(--font-body)', fontSize: 11, fontWeight: 600,
        letterSpacing: 0.4, color: 'var(--text-secondary)', marginTop: 8,
      }}>{label}</p>
      {sub && (
        <p style={{
          fontSize: 12, color: 'rgba(180,195,220,0.55)', marginTop: 2,
          fontWeight: 400, letterSpacing: 0.1,
        }}>{sub}</p>
      )}
    </div>
  )
}

function ScrollStatCard({ icon, label, pct, made, attempted, sessions, accent, filterLabel, snapAlign, hero, delay = 0 }) {
  const pctColor = accent || (pct >= 50 ? 'var(--green-shot)' : pct >= 35 ? 'var(--orange)' : pct === 0 ? 'var(--text-dim)' : 'var(--red-shot)')
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 320, damping: 30, delay }}
      style={{
        ...(hero ? {
          width: '100%',
          marginBottom: 14,
        } : {
          flex: '0 0 64%',
          scrollSnapAlign: snapAlign || 'center',
          scrollSnapStop: 'always',
        }),
        ...glassCard,
        padding: hero ? '22px 22px 20px' : '16px 16px 14px',
        display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
        minHeight: hero ? 168 : 132,
      }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ marginBottom: 6, opacity: 0.7 }}>{icon}</div>
          <p style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: hero ? 15 : 12,
            color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 1,
          }}>{label}</p>
          <p style={{
            color: 'rgba(180,195,220,0.62)', fontSize: 12, marginTop: 2,
            fontWeight: 400, letterSpacing: 0.1,
          }}>{filterLabel}</p>
        </div>
        <motion.p
          key={pct}
          initial={{ opacity: 0.6 }} animate={{ opacity: 1 }}
          transition={{ type: 'spring', stiffness: 260, damping: 26 }}
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: hero ? 54 : 36,
            color: pctColor, lineHeight: 1, letterSpacing: -1.4,
            textShadow: `0 0 8px ${pctColor}14`,
          }}>{pct}%</motion.p>
      </div>
      <div>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 3, overflow: 'hidden', marginBottom: 10 }}>
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${pct}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 24, delay: delay + 0.15 }}
            style={{ height: '100%', borderRadius: 3, background: pctColor }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <p style={{ color: 'rgba(180,195,220,0.62)', fontSize: 12, fontWeight: 500 }}>
            {made} / {attempted} rzutów
          </p>
          <p style={{ color: 'rgba(180,195,220,0.55)', fontSize: 12 }}>
            {sessions} {sessions === 1 ? 'sesja' : sessions < 5 ? 'sesje' : 'sesji'}
          </p>
        </div>
      </div>
    </motion.div>
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
  const [addOpen, setAddOpen] = useState(false)
  const [savingStrength, setSavingStrength] = useState(false)

  // Limit dziennie: 3 strength sessions. Sprawdzane przed insert'em.
  async function handleSaveStrength({ exercises, notes }) {
    if (!profile) return
    setSavingStrength(true)
    try {
      const today = new Date().toISOString().slice(0, 10)
      const { count } = await supabase
        .from('strength_sessions')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', profile.id)
        .eq('date', today)
      if ((count || 0) >= 3) {
        alert('Limit 3 sesji siłowych dziennie został osiągnięty.')
        return
      }
      const { error } = await supabase.from('strength_sessions').insert({
        user_id: profile.id, date: today, exercises, notes,
      })
      if (error) {
        console.error('[strength insert]', error)
        alert('Nie udało się zapisać sesji: ' + error.message)
        return
      }
      setAddOpen(false)
      // TODO: odświeżyć listę sesji strength gdy będzie sekcja w Stats
    } finally {
      setSavingStrength(false)
    }
  }

  useEffect(() => {
    if (!profile) return
    const cacheKey = `sessions:${profile.id}`

    async function fetchSessions() {
      const { data } = await supabase
        .from('shooting_sessions')
        .select('*, trainings(title)')
        .eq('user_id', profile.id)
        .order('session_date', { ascending: false })
        .limit(500)
      if (data) { setCache(cacheKey, data, 2 * 60 * 1000); setSessions(data) }
      setLoading(false)
    }

    // Pokaż cache natychmiast — zero opóźnienia przy powrocie na kartę
    const cached = getCache(cacheKey)
    if (cached) { setSessions(cached); setLoading(false) }
    fetchSessions()

    // Realtime: nowe sesje rzutowe wpadają od razu (insert z trackera).
    const channel = supabase
      .channel(`stats-sessions:${profile.id}`)
      .on('postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'shooting_sessions', filter: `user_id=eq.${profile.id}` },
        () => { bustCache(cacheKey); fetchSessions() })
      .on('postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'shooting_sessions', filter: `user_id=eq.${profile.id}` },
        () => { bustCache(cacheKey); fetchSessions() })
      .subscribe()

    // Powrót na zakładkę / fokus okna — refetch (gdy Realtime padł np. w Safari w tle)
    function onFocus() {
      if (document.visibilityState !== 'visible') return
      bustCache(cacheKey)
      fetchSessions()
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)

    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      supabase.removeChannel(channel)
    }
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
  const totalPct       = calcPct(totalMade, totalAttempted)

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

  // OGÓLNIE wyciągnięte poza scroll — to jest hero metryka, dostaje
  // dedykowaną pełnoszerokościową kartę. W scrollu zostają tylko typy rzutów.
  const HERO_CARD = { key: 'all', icon: <IconOverall />, label: 'Ogólnie', type: null }
  const SCROLL_CARDS = [
    { key: '3pt', icon: <IconThree />,   label: 'Trójki',    type: '3pt' },
    { key: '2pt', icon: <IconMid />,     label: 'Mid-Range', type: '2pt' },
    { key: 'ft',  icon: <IconFT />,      label: 'Wolne',     type: 'ft'  },
  ]
  const heroData = { made: totalMade, attempted: totalAttempted, sessions: filtered.length }
  const heroPct = calcPct(heroData.made, heroData.attempted)

  return (
    <div className="page-content" style={{ padding: 'max(52px, calc(env(safe-area-inset-top) + 20px)) 22px 22px' }}>
      {/* WIP: AddSessionModal — widoczne tylko w dev do czasu pełnego flow.
          Na produkcji ukryte, żeby userzy nie trafiali na niedokończone ścieżki. */}
      <AddSessionModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        onSaveStrength={handleSaveStrength}
        saving={savingStrength}
      />
      <p className="section-label" style={{ marginBottom: 4 }}>Twoje wyniki</p>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
        <h1 className="display-title" style={{ fontSize: 38 }}>Statystyki</h1>
        {/* Icon row — bare icon buttons, no background */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          {/* + Add session — tylko w dev */}
          {import.meta.env.DEV && (
            <motion.button
              whileTap={{ scale: 0.82 }}
              onClick={() => setAddOpen(true)}
              aria-label="Dodaj sesję"
              style={{
                width: 40, height: 40,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'none', border: 'none', cursor: 'pointer',
                color: 'rgba(200,210,230,0.55)',
              }}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
              </svg>
            </motion.button>
          )}
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

      {/* ── FILTRY — quieter glass segmented control ── */}
      <div style={{
        display: 'flex', marginBottom: 20,
        background: 'rgba(30,42,68,0.40)',
        backdropFilter: 'blur(28px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(28px) saturate(1.6)',
        border: '1px solid rgba(150,200,255,0.10)',
        borderRadius: 99,
        padding: 3,
        boxShadow: '0 2px 10px rgba(0,0,0,0.22)',
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
                    background: 'linear-gradient(145deg, rgba(40,130,220,0.65), rgba(16,90,180,0.70))',
                    boxShadow: '0 1px 4px rgba(0,0,0,0.20), inset 0 1px 0 rgba(180,230,255,0.10)',
                  }}
                />
              )}
              {label}
            </motion.button>
          )
        })}
      </div>

      {/* ── HERO: OGÓLNIE (full-width, dominująca metryka) ── */}
      <ScrollStatCard
        hero
        icon={HERO_CARD.icon}
        label={HERO_CARD.label}
        pct={heroPct}
        made={heroData.made}
        attempted={heroData.attempted}
        sessions={heroData.sessions}
        filterLabel={filterLabel}
      />

      {/* ── SERIA / SESJE (mini kafelki) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 16 }}>
        <StatTile label="Seria"  value={profile?.streak || 0} sub="dni z rzędu" />
        <StatTile label="Sesje"  value={filtered.length}      sub={filterLabel} accent="var(--text-secondary)" />
      </div>

      {/* ── SCROLL KART RZUTOWYCH (3pt / 2pt / ft) ── */}
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
          const pct = calcPct(made, attempted)
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
              delay={0.08 + index * 0.07}
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
          <img src="/brokelogo.png" alt="" style={{ width: 56, height: 56, objectFit: 'contain', opacity: 0.7 }}/>
          <p style={{ color: 'var(--text-secondary)', marginTop: 8, fontFamily: 'var(--font-display)', fontSize: 16, textTransform: 'uppercase', letterSpacing: 1 }}>
            Brak sesji – zacznij trening!
          </p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8, paddingBottom: 32 }}>
          {filtered.map(s => {
            const pct = calcPct(s.made, s.attempted)
            // 3-stopniowa skala: ≥60 emerald, 30-59 amber, <30 warm orange (SF crystal vibe)
            const tier = pct >= 60 ? 'good' : pct >= 30 ? 'mid' : 'low'
            const tierColor = tier === 'good' ? '#34D399' : tier === 'mid' ? '#FCD34D' : '#FF8830'
            const tierRgb   = tier === 'good' ? '52,211,153' : tier === 'mid' ? '252,211,77' : '255,136,48'
            return (
              <div key={s.id} style={{
                background: 'linear-gradient(180deg, rgba(40,55,85,0.34) 0%, rgba(22,32,52,0.30) 100%)',
                backdropFilter: 'blur(28px) saturate(1.5)', WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
                border: 'none',
                borderRadius: 14,
                padding: '12px 14px',
                display: 'flex', alignItems: 'center', gap: 12,
                boxShadow: [
                  'inset 0 1px 0 rgba(200,225,255,0.08)',
                  'inset 0 -1px 0 rgba(0,0,0,0.14)',
                  '0 1px 4px rgba(0,0,0,0.14)',
                ].join(', '),
              }}>
                <div style={{
                  width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                  background: `radial-gradient(circle at 35% 30%, rgba(${tierRgb},0.22), rgba(${tierRgb},0.06) 70%)`,
                  boxShadow: `inset 0 0 0 0.5px rgba(${tierRgb},0.20)`,
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
                  color: tierColor,
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
