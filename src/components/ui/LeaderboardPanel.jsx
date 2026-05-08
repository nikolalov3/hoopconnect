import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../../lib/supabase'
import { useAuth } from '../../context/AuthContext'

const TIERS = [
  { key: 'diamond',  label: 'Diament', color: '#B9F2FF', min: 850 },
  { key: 'platinum', label: 'Platyna', color: '#5BB8F5', min: 700 },
  { key: 'gold',     label: 'Złoto',   color: '#FFD700', min: 500 },
  { key: 'silver',   label: 'Srebro',  color: '#A8A8A8', min: 300 },
  { key: 'bronze',   label: 'Brąz',    color: '#CD7F32', min: 0   },
]

function getTier(score) {
  return TIERS.find(t => score >= t.min) || TIERS[TIERS.length - 1]
}

function MedalHex({ color, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 90 90" style={{ flexShrink: 0 }}>
      <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,0.25)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill={color} fillOpacity="0.85"/>
      <polygon points="45,6 8,32 45,42" fill="rgba(255,255,255,0.20)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
        fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round"/>
    </svg>
  )
}

function RankBadge({ rank }) {
  if (rank === 1) return <span style={{ fontSize: 18, lineHeight: 1 }}>🥇</span>
  if (rank === 2) return <span style={{ fontSize: 18, lineHeight: 1 }}>🥈</span>
  if (rank === 3) return <span style={{ fontSize: 18, lineHeight: 1 }}>🥉</span>
  return (
    <span style={{ fontSize: 11, fontWeight: 700, color: '#8A9BB0',
      fontFamily: 'var(--font-display)', width: 20, textAlign: 'center' }}>
      {rank}
    </span>
  )
}

export default function LeaderboardPanel({ open, onClose }) {
  const { user } = useAuth()
  const [rows,    setRows]    = useState([])
  const [period,  setPeriod]  = useState(null)
  const [loading, setLoading] = useState(true)
  const [myRank,  setMyRank]  = useState(null)

  useEffect(() => {
    if (!open) return
    fetchLeaderboard()
  }, [open])

  async function fetchLeaderboard() {
    setLoading(true)
    try {
      // 1. Pobierz aktywny okres ligi
      const { data: periods } = await supabase
        .from('league_periods')
        .select('*')
        .lte('starts_at', new Date().toISOString().split('T')[0])
        .gte('ends_at',   new Date().toISOString().split('T')[0])
        .order('starts_at', { ascending: false })
        .limit(1)

      const activePeriod = periods?.[0] || null
      setPeriod(activePeriod)

      if (!activePeriod) { setRows([]); setLoading(false); return }

      // 2. Pobierz punkty z points_log dla tego okresu
      const { data: pts } = await supabase
        .from('points_log')
        .select('user_id, points')
        .gte('date', activePeriod.starts_at)
        .lte('date', activePeriod.ends_at)

      if (!pts?.length) { setRows([]); setLoading(false); return }

      // 3. Sumuj per user
      const totals = {}
      for (const p of pts) {
        totals[p.user_id] = (totals[p.user_id] || 0) + p.points
      }

      // 4. Pobierz profile
      const uids = Object.keys(totals)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, name, fraud_probability')
        .in('id', uids)

      const pm = Object.fromEntries((profiles || []).map(p => [p.id, p]))

      // 5. Zbuduj ranking — sortuj malejąco
      const sorted = Object.entries(totals)
        .map(([uid, score]) => ({
          uid,
          name:  pm[uid]?.name || 'Gracz',
          score: Math.min(score, 1000),
          fraud: pm[uid]?.fraud_probability || 0,
          tier:  getTier(Math.min(score, 1000)),
        }))
        .sort((a, b) => b.score - a.score)

      setRows(sorted)

      const myIdx = sorted.findIndex(r => r.uid === user?.id)
      setMyRank(myIdx >= 0 ? myIdx + 1 : null)
    } catch (e) {
      console.error('[leaderboard]', e)
    } finally {
      setLoading(false)
    }
  }

  const myRow = rows.find(r => r.uid === user?.id)

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div key="lb-backdrop"
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{ position: 'fixed', inset: 0, zIndex: 500,
              background: 'rgba(4,8,16,0.75)', backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)' }}
          />

          <motion.div key="lb-sheet"
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 32 }}
            style={{
              position: 'fixed',
              left: 'max(0px, calc((100vw - 430px) / 2))',
              width: 'min(100vw, 430px)',
              bottom: 0, zIndex: 501,
              background: 'linear-gradient(180deg, #0D1B2E 0%, #060E1A 100%)',
              borderRadius: '22px 22px 0 0',
              border: '1px solid rgba(91,184,245,0.15)',
              borderBottom: 'none',
              maxHeight: '90dvh',
              display: 'flex', flexDirection: 'column',
            }}
          >
            {/* Header */}
            <div style={{ flexShrink: 0, padding: '14px 18px 0', position: 'relative',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{ width: 36, height: 4, borderRadius: 2,
                background: 'rgba(255,255,255,0.15)' }}/>
              <button onClick={onClose} style={{
                position: 'absolute', right: 16, top: 8,
                width: 28, height: 28, borderRadius: '50%',
                background: 'rgba(255,255,255,0.08)', border: 'none',
                cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                WebkitTapHighlightColor: 'transparent',
              }}>
                <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(255,255,255,0.5)" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Title */}
            <div style={{ flexShrink: 0, padding: '12px 18px 0' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, color: '#8A9BB0',
                    textTransform: 'uppercase', margin: '0 0 2px' }}>
                    {period?.season_label || 'Ranking'}
                  </p>
                  <h2 style={{ fontSize: 20, fontWeight: 900, color: '#FFB300',
                    fontFamily: 'var(--font-display)', letterSpacing: 0.5,
                    textTransform: 'uppercase', margin: 0 }}>
                    Leaderboard
                  </h2>
                </div>
                {period && (
                  <div style={{ textAlign: 'right' }}>
                    <p style={{ fontSize: 9, color: '#8A9BB0', margin: 0 }}>Koniec ligi</p>
                    <p style={{ fontSize: 11, fontWeight: 600, color: 'rgba(255,255,255,0.6)',
                      margin: '2px 0 0' }}>
                      {new Date(period.ends_at).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                    </p>
                  </div>
                )}
              </div>

              {/* My position sticky bar */}
              {myRow && myRank && (
                <div style={{
                  marginTop: 12,
                  padding: '10px 14px', borderRadius: 12,
                  background: 'linear-gradient(135deg, rgba(255,179,0,0.14), rgba(255,179,0,0.06))',
                  border: '1px solid rgba(255,179,0,0.30)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <RankBadge rank={myRank}/>
                  <MedalHex color={myRow.tier.color} size={20}/>
                  <div style={{ flex: 1 }}>
                    <p style={{ fontSize: 12, fontWeight: 700, color: '#FFB300', margin: 0 }}>
                      Twoja pozycja
                    </p>
                    <p style={{ fontSize: 10, color: '#8A9BB0', margin: 0 }}>
                      {myRow.tier.label} · {myRow.score} pkt
                    </p>
                  </div>
                  <span style={{ fontSize: 11, fontWeight: 800, color: '#FFB300',
                    fontFamily: 'var(--font-display)' }}>
                    #{myRank} / {rows.length}
                  </span>
                </div>
              )}

              <div style={{ height: 1, background: 'rgba(255,255,255,0.07)', margin: '14px 0 0' }}/>
            </div>

            {/* List */}
            <div style={{ flex: 1, overflowY: 'auto', WebkitOverflowScrolling: 'touch',
              padding: '8px 18px calc(env(safe-area-inset-bottom, 0px) + 24px)' }}>

              {loading ? (
                <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 48 }}>
                  <div className="spinner"/>
                </div>
              ) : rows.length === 0 ? (
                <div style={{ textAlign: 'center', paddingTop: 48 }}>
                  <div style={{ fontSize: 36, marginBottom: 12 }}>🏀</div>
                  <p style={{ fontSize: 13, fontWeight: 700, color: 'rgba(255,255,255,0.7)', margin: '0 0 6px' }}>
                    Brak danych
                  </p>
                  <p style={{ fontSize: 11, color: '#8A9BB0', margin: 0 }}>
                    Bądź pierwszym który zdobędzie punkty!
                  </p>
                </div>
              ) : (
                rows.map((row, idx) => {
                  const rank  = idx + 1
                  const isMe  = row.uid === user?.id
                  const suspicious = row.fraud > 0.5

                  return (
                    <div key={row.uid} style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '10px 12px', borderRadius: 12,
                      marginTop: 6,
                      background: isMe
                        ? 'linear-gradient(135deg, rgba(255,179,0,0.10), rgba(255,179,0,0.04))'
                        : 'rgba(255,255,255,0.03)',
                      border: isMe
                        ? '1px solid rgba(255,179,0,0.25)'
                        : '1px solid rgba(255,255,255,0.06)',
                    }}>
                      {/* Rank */}
                      <div style={{ width: 24, display: 'flex',
                        justifyContent: 'center', flexShrink: 0 }}>
                        <RankBadge rank={rank}/>
                      </div>

                      {/* Tier hex */}
                      <MedalHex color={row.tier.color} size={22}/>

                      {/* Name */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <p style={{ fontSize: 13, fontWeight: isMe ? 700 : 500,
                          color: isMe ? '#FFB300' : 'rgba(255,255,255,0.85)',
                          margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {row.name}{isMe ? ' (Ty)' : ''}
                        </p>
                        <p style={{ fontSize: 9.5, color: row.tier.color,
                          fontWeight: 600, margin: '1px 0 0' }}>
                          {row.tier.label}
                          {suspicious && <span style={{ color: '#FF6B35', marginLeft: 6 }}>⚠️ obserwowany</span>}
                        </p>
                      </div>

                      {/* Score */}
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <p style={{ fontSize: 15, fontWeight: 900, color: '#FFB300',
                          fontFamily: 'var(--font-display)', margin: 0 }}>
                          {row.score}
                        </p>
                        <p style={{ fontSize: 8, color: '#8A9BB0', margin: 0, letterSpacing: 0.5 }}>
                          PKT
                        </p>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
