import { useState, useEffect, useCallback, useMemo, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUI } from '../../context/UIContext'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const ORANGE = '#FFA820'
const CY     = '#00FFEE'

const TIERS = [
  { key: 'diamond',  label: 'Diament', color: '#B9F2FF', min: 850 },
  { key: 'platinum', label: 'Platyna', color: '#5BB8F5', min: 700 },
  { key: 'gold',     label: 'Złoto',   color: '#FFD700', min: 500 },
  { key: 'silver',   label: 'Srebro',  color: '#C0C0C0', min: 300 },
  { key: 'bronze',   label: 'Brąz',    color: '#CD7F32', min: 0   },
]
function getTier(s) { return TIERS.find(t => s >= t.min) || TIERS[TIERS.length - 1] }

/* ── static styles (defined once, not recreated on re-render) ──── */
const S = {
  drawer: {
    position: 'fixed',
    left: 'max(0px, calc((100vw - 430px) / 2))',
    width: 'min(100vw, 430px)',
    top: 0, bottom: 0,
    zIndex: 600,
    background: '#060C16',
    display: 'flex', flexDirection: 'column',
    overflow: 'hidden',
    borderLeft: `2px solid ${ORANGE}`,
    willChange: 'transform',
    contain: 'layout style',
  },
  cyCorner: {
    position: 'absolute', top: 0, left: -2, width: 24, height: 24,
    borderTop: `2px solid ${CY}`, borderLeft: `2px solid ${CY}`,
    pointerEvents: 'none', zIndex: 1,
  },
  topBar: {
    flexShrink: 0,
    paddingTop: 'calc(env(safe-area-inset-top,0px) + 14px)',
    padding: 'calc(env(safe-area-inset-top,0px) + 14px) 18px 14px',
    borderBottom: `1px solid ${ORANGE}18`,
    display: 'flex', alignItems: 'center', gap: 12,
    background: 'rgba(6,12,22,0.98)',
  },
  backBtn: {
    width: 34, height: 34, borderRadius: 0, flexShrink: 0,
    background: `${ORANGE}12`,
    border: `1px solid ${ORANGE}35`,
    borderTop: `1px solid ${ORANGE}55`,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
    position: 'relative', outline: 'none',
  },
  backCorner: {
    position: 'absolute', top: -1, left: -1, width: 7, height: 7,
    borderTop: `1px solid ${CY}`, borderLeft: `1px solid ${CY}`,
  },
  refreshBtn: {
    width: 34, height: 34, borderRadius: 0, flexShrink: 0,
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderTop: '1px solid rgba(255,255,255,0.18)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    cursor: 'pointer', WebkitTapHighlightColor: 'transparent', outline: 'none',
  },
  divider: {
    flexShrink: 0, height: 1, margin: '10px 16px 0',
    background: `linear-gradient(90deg,transparent,${ORANGE}20,transparent)`,
  },
  scrollList: {
    flex: 1, overflowY: 'auto',
    WebkitOverflowScrolling: 'touch',
    overscrollBehavior: 'contain',
    padding: '8px 16px 32px',
  },
  emptyWrap: {
    textAlign: 'center', padding: '60px 24px 0',
  },
  emptyLabel: {
    fontSize: 9, fontWeight: 800, letterSpacing: 3,
    color: `${ORANGE}44`, textTransform: 'uppercase', marginBottom: 16,
  },
  emptyTitle: {
    fontSize: 13, fontWeight: 600,
    color: 'rgba(255,255,255,0.55)', margin: '0 0 8px', lineHeight: 1.6,
  },
  emptyBody: {
    fontSize: 10.5, color: 'rgba(255,255,255,0.28)', lineHeight: 1.7, margin: 0,
  },
  spinnerWrap: {
    display: 'flex', justifyContent: 'center', paddingTop: 60,
  },
}

// tween — GPU-composited, no per-frame JS spring computation
const SLIDE_TRANSITION = {
  type: 'tween',
  duration: 0.26,
  ease: [0.16, 1, 0.3, 1],   // ease-out-expo: fast start, smooth stop
}

/* ── memoized sub-components ─────────────────────────────────────── */
const TierDot = memo(function TierDot({ color }) {
  return (
    <div style={{
      width: 9, height: 9, flexShrink: 0,
      background: color,
      boxShadow: `0 0 5px ${color}77`,
    }}/>
  )
})

const RankNum = memo(function RankNum({ rank }) {
  const isTop3  = rank <= 3
  const c = rank === 1 ? ORANGE : rank === 2 ? '#C0C0C0' : '#CD7F32'
  return (
    <div style={{
      width: 26, height: 26, flexShrink: 0,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: isTop3 ? `${c}18` : 'transparent',
      border: isTop3 ? `1px solid ${c}50` : 'none',
      position: 'relative',
    }}>
      {isTop3 && <>
        <div style={{position:'absolute',top:-1,left:-1,width:6,height:6,
          borderTop:`1px solid ${c}`,borderLeft:`1px solid ${c}`}}/>
        <div style={{position:'absolute',bottom:-1,right:-1,width:6,height:6,
          borderBottom:`1px solid ${c}`,borderRight:`1px solid ${c}`}}/>
      </>}
      <span style={{
        fontSize: isTop3 ? 13 : 11, fontWeight: 900, letterSpacing: 0.5,
        color: isTop3 ? c : 'rgba(255,255,255,0.25)',
        fontFamily: 'var(--font-display)',
      }}>{rank}</span>
    </div>
  )
})

const RowItem = memo(function RowItem({ row, rank, isMe }) {
  const isTop3 = rank <= 3
  const top3C  = rank === 1 ? ORANGE : rank === 2 ? '#C0C0C0' : '#CD7F32'
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 10,
      padding: '10px 13px', marginTop: 6,
      background: isMe
        ? `${ORANGE}0D`
        : isTop3 ? `${top3C}06` : 'rgba(255,255,255,0.02)',
      border: isMe
        ? `1px solid ${ORANGE}40`
        : isTop3 ? `1px solid ${top3C}22` : '1px solid rgba(255,255,255,0.06)',
      borderTop: isMe
        ? `1px solid ${ORANGE}70`
        : isTop3 ? `1px solid ${top3C}42` : '1px solid rgba(255,255,255,0.09)',
      borderBottom: isMe
        ? `1px solid ${ORANGE}70`
        : isTop3 ? `1px solid ${top3C}42` : '1px solid rgba(255,255,255,0.09)',
      position: 'relative',
    }}>
      {/* left accent bar */}
      {(isMe || isTop3) && (
        <div style={{
          position: 'absolute', left: 0, top: 0, bottom: 0, width: 2,
          background: isMe
            ? `linear-gradient(180deg,${ORANGE}CC,${ORANGE}33)`
            : `linear-gradient(180deg,${top3C}88,${top3C}11)`,
        }}/>
      )}
      <RankNum rank={rank}/>
      <TierDot color={row.tier.color}/>
      <div style={{ flex: 1, minWidth: 0, paddingLeft: 2 }}>
        <p style={{
          fontSize: 13, fontWeight: isMe ? 700 : 500,
          color: isMe ? ORANGE : 'rgba(255,255,255,0.85)',
          margin: 0, overflow: 'hidden',
          textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          fontFamily: isMe ? 'var(--font-display)' : 'inherit',
          letterSpacing: isMe ? 0.5 : 0,
        }}>
          {row.name}{isMe ? ' (TY)' : ''}
        </p>
        <p style={{
          fontSize: 9, fontWeight: 600, margin: '2px 0 0',
          color: `${row.tier.color}88`, letterSpacing: 0.5, textTransform: 'uppercase',
        }}>
          {row.tier.label}
          {row.fraud > 0.5 && (
            <span style={{ color: '#FF6B35', marginLeft: 6, fontSize: 8, letterSpacing: 1 }}>
              ⚠ OBSERWOWANY
            </span>
          )}
        </p>
      </div>
      <div style={{ textAlign: 'right', flexShrink: 0 }}>
        <p style={{
          fontSize: 17, fontWeight: 900, margin: 0,
          fontFamily: 'var(--font-display)', letterSpacing: 0.5,
          color: isMe ? ORANGE : isTop3 ? top3C : 'rgba(255,255,255,0.60)',
        }}>
          {row.score}
        </p>
        <p style={{ fontSize: 7.5, color: 'rgba(255,255,255,0.20)',
          margin: 0, letterSpacing: 1, textTransform: 'uppercase' }}>pkt</p>
      </div>
    </div>
  )
})

/* ── main ────────────────────────────────────────────────────────── */
export default function LeaderboardDrawer() {
  const {
    leaderboardOpen, setLeaderboardOpen,
    leaderboardFromLeague, setLeaderboardFromLeague,
    setLeagueOpen,
  } = useUI()
  const { user } = useAuth()
  const [rows,      setRows]      = useState([])
  const [period,    setPeriod]    = useState(null)
  const [loading,   setLoading]   = useState(false)
  const [lastFetch, setLastFetch] = useState(0)

  const CACHE_MS = 5 * 60 * 1000

  const fetchData = useCallback(async () => {
    setLoading(true)
    try {
      const today = new Date().toISOString().split('T')[0]
      const { data: periods } = await supabase
        .from('league_periods').select('*')
        .lte('starts_at', today).gte('ends_at', today)
        .order('starts_at', { ascending: false }).limit(1)

      const p = periods?.[0] || null
      setPeriod(p)
      if (!p) return

      const { data: pts } = await supabase
        .from('points_log').select('user_id, points, source')
        .gte('date', p.starts_at).lte('date', p.ends_at)

      if (!pts?.length) return

      const totals = {}
      for (const r of pts) {
        const w = r.source === 'training' ? 0.5 : r.source === 'achievement' ? 0.75 : 1.0
        totals[r.user_id] = (totals[r.user_id] || 0) + Math.round(r.points * w)
      }

      const uids = Object.keys(totals)
      const { data: profiles } = await supabase
        .from('profiles').select('id, name, fraud_probability').in('id', uids)
      const pm = Object.fromEntries((profiles || []).map(p => [p.id, p]))

      setRows(
        Object.entries(totals)
          .map(([uid, score]) => ({
            uid,
            name:  pm[uid]?.name  || 'Gracz',
            score: Math.min(score, 1000),
            fraud: pm[uid]?.fraud_probability || 0,
            tier:  getTier(Math.min(score, 1000)),
          }))
          .sort((a, b) => b.score - a.score)
      )
      setLastFetch(Date.now())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!leaderboardOpen) return
    if (Date.now() - lastFetch > CACHE_MS) fetchData()
  }, [leaderboardOpen])

  const handleBack = useCallback(() => {
    if (leaderboardFromLeague) {
      setLeaderboardFromLeague(false)
      setLeagueOpen(true)
      setTimeout(() => setLeaderboardOpen(false), 40)
    } else {
      setLeaderboardOpen(false)
    }
  }, [leaderboardFromLeague])

  const { myRow, myRank } = useMemo(() => {
    const idx = rows.findIndex(r => r.uid === user?.id)
    return { myRow: idx >= 0 ? rows[idx] : null, myRank: idx >= 0 ? idx + 1 : null }
  }, [rows, user?.id])

  const periodEnd = useMemo(() =>
    period ? new Date(period.ends_at).toLocaleDateString('pl-PL',
      { day: 'numeric', month: 'short' }) : null
  , [period])

  return (
    <AnimatePresence>
      {leaderboardOpen && (
        <motion.div
          key="lb-drawer"
          initial={{ x: '100%' }}
          animate={{ x: 0 }}
          exit={{ x: '100%' }}
          transition={SLIDE_TRANSITION}
          style={S.drawer}
        >
          <div style={S.cyCorner}/>

          {/* ── Top bar ─────────────────────────────────────────── */}
          <div style={S.topBar}>
            <button style={S.backBtn} onClick={handleBack}>
              <div style={S.backCorner}/>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none"
                stroke={ORANGE} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
            </button>

            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 2.5,
                color: `${ORANGE}55`, textTransform: 'uppercase', margin: '0 0 1px' }}>
                {period?.season_label || '◆ Season 01'}
              </p>
              <h1 style={{ fontSize: 20, fontWeight: 900, color: ORANGE,
                fontFamily: 'var(--font-display)', letterSpacing: 1,
                textTransform: 'uppercase', margin: 0, lineHeight: 1 }}>
                RANKING
              </h1>
            </div>

            <button
              style={{ ...S.refreshBtn, opacity: loading ? 0.35 : 1 }}
              onClick={fetchData}
              disabled={loading}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="rgba(255,255,255,0.45)" strokeWidth="2.2"
                strokeLinecap="round" strokeLinejoin="round"
                style={{ animation: loading ? 'spin 0.8s linear infinite' : 'none' }}>
                <polyline points="23 4 23 10 17 10"/>
                <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
              </svg>
            </button>

            {periodEnd && (
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <p style={{ fontSize: 8, color: `${ORANGE}44`, margin: 0,
                  letterSpacing: 1, textTransform: 'uppercase' }}>Koniec</p>
                <p style={{ fontSize: 11, fontWeight: 700, margin: '2px 0 0',
                  color: 'rgba(255,255,255,0.50)',
                  fontFamily: 'var(--font-display)', letterSpacing: 0.5 }}>
                  {periodEnd}
                </p>
              </div>
            )}
          </div>

          {/* ── My position ─────────────────────────────────────── */}
          {myRow && myRank && (
            <div style={{
              flexShrink: 0, margin: '12px 16px 0', padding: '10px 14px',
              background: `${ORANGE}0E`,
              border: `1px solid ${ORANGE}35`,
              borderTop: `1px solid ${ORANGE}65`,
              borderBottom: `1px solid ${ORANGE}65`,
              display: 'flex', alignItems: 'center', gap: 10, position: 'relative',
            }}>
              <div style={{position:'absolute',top:-1,left:-1,width:10,height:10,
                borderTop:`1.5px solid ${CY}`,borderLeft:`1.5px solid ${CY}`}}/>
              <div style={{position:'absolute',bottom:-1,right:-1,width:10,height:10,
                borderBottom:`1.5px solid ${CY}`,borderRight:`1.5px solid ${CY}`}}/>
              <RankNum rank={myRank}/>
              <TierDot color={myRow.tier.color}/>
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.5,
                  color: `${ORANGE}88`, textTransform: 'uppercase', margin: '0 0 1px' }}>
                  Twoja pozycja
                </p>
                <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.50)', margin: 0 }}>
                  {myRow.tier.label} · {myRow.score} pkt
                </p>
              </div>
              <span style={{ fontSize: 13, fontWeight: 900, color: ORANGE,
                fontFamily: 'var(--font-display)', letterSpacing: 0.5 }}>
                #{myRank}
                <span style={{ color: `${ORANGE}44`, fontSize: 10 }}> / {rows.length}</span>
              </span>
            </div>
          )}

          <div style={S.divider}/>

          {/* ── List ────────────────────────────────────────────── */}
          <div style={S.scrollList}>
            {loading ? (
              <div style={S.spinnerWrap}><div className="spinner"/></div>
            ) : rows.length === 0 ? (
              <div style={S.emptyWrap}>
                <div style={S.emptyLabel}>◆ Brak wyników</div>
                <p style={S.emptyTitle}>Bądź pierwszym który zdobędzie punkty!</p>
                <p style={S.emptyBody}>
                  Oficjalne rankingi startują 01 czerwca 2026.<br/>
                  Liga resetuje się co poniedziałek.
                </p>
              </div>
            ) : rows.map((row, idx) => (
              <RowItem
                key={row.uid}
                row={row}
                rank={idx + 1}
                isMe={row.uid === user?.id}
              />
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
