import { useState } from 'react'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useShootingSession } from '../hooks/useShootingSession'
import { checkShotAchievements, checkPerfectSession } from '../lib/achievements'
import { creditRestDayStreak } from '../lib/streak'
import StreakToast from '../components/ui/StreakToast'
import { shareSessionCard, doShare } from '../lib/shareCard'

const TODAY = new Date().toISOString().split('T')[0]

const TYPE_CONFIG = {
  shooting_3pt: { label: 'Trójki', target: 150, shotType: '3pt' },
  shooting_2pt: { label: 'Dwójki', target: 100, shotType: '2pt' },
  shooting_ft:  { label: 'Wolne',  target: 100, shotType: 'ft'  },
}

const MEDAL_COLORS = {
  bronze:   '#CD7F32',
  silver:   '#A8B9C8',
  gold:     '#FFD700',
  diamond:  '#5BB8F5',
  platinum: '#E8E8F0',
}

function SuccessScreen({ made, attempted, target, shotType, onBack, newAchievements = [], playerName }) {
  const pct = attempted > 0 ? Math.round((made / attempted) * 100) : 0
  const [sharing, setSharing] = useState(false)

  async function handleShare() {
    setSharing(true)
    try {
      const blob = await shareSessionCard({ made, attempted, target, shotType, playerName })
      await doShare(blob, 'hoopconnect-sesja.png')
    } finally {
      setSharing(false)
    }
  }
  const missed = attempted - made
  const pctColor = pct >= 60 ? 'var(--green-shot)' : pct >= 40 ? 'var(--orange)' : 'var(--red-shot)'
  const filledPct = Math.min(attempted / target, 1)

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(6,4,2,0.97)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        display: 'flex', flexDirection: 'column',
        padding: '0 20px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        overflowY: 'auto',
      }}
    >
      {/* Glow */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 220,
        background: `radial-gradient(ellipse 90% 100% at 50% 0%, ${pctColor}20 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />

      {/* Header */}
      <div style={{ paddingTop: 48, paddingBottom: 20, position: 'relative', zIndex: 1 }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 3,
          color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 8,
        }}>
          {TYPE_CONFIG[shotType]?.label ?? 'Sesja'} · zakończona
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 44,
          color: 'var(--text-primary)', letterSpacing: 1, lineHeight: 1.05,
          textTransform: 'uppercase',
        }}>
          TRENING<br />ZALICZONY
        </h1>
      </div>

      {/* Główna karta: % + rzuty */}
      <div style={{
        position: 'relative', zIndex: 1,
        background: 'rgba(12,8,4,0.70)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        border: `1px solid ${pctColor}35`,
        borderTop: `1px solid ${pctColor}55`,
        borderRadius: 20,
        padding: '20px 20px 16px',
        marginBottom: 10,
        boxShadow: `0 8px 32px rgba(0,0,0,0.45), 0 0 40px ${pctColor}10`,
      }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
          <div>
            <p style={{ color: 'var(--text-dim)', fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Skuteczność</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 56, color: pctColor, lineHeight: 1, letterSpacing: -2 }}>
              {pct}%
            </p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: 'var(--text-dim)', fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', fontWeight: 600, marginBottom: 4 }}>Rzuty</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 26, color: 'var(--text-primary)', lineHeight: 1 }}>
              {made}/{attempted}
            </p>
          </div>
        </div>
        {/* Pasek postępu sesji */}
        <div style={{ background: 'rgba(255,255,255,0.07)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 4,
            width: `${filledPct * 100}%`,
            background: `linear-gradient(90deg, ${pctColor}, ${pctColor}aa)`,
            transition: 'width 0.8s ease',
          }} />
        </div>
        <p style={{ color: 'var(--text-dim)', fontSize: 10, marginTop: 6, fontWeight: 500 }}>
          {attempted} z {target} rzutów
        </p>
      </div>

      {/* Trafione / Pudła */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, position: 'relative', zIndex: 1, marginBottom: 10 }}>
        {[
          { label: 'Trafione', val: made,   color: 'var(--green-shot)', emoji: '✓' },
          { label: 'Pudła',    val: missed, color: 'var(--red-shot)',   emoji: '✗' },
        ].map(({ label, val, color, emoji }) => (
          <div key={label} style={{
            background: 'rgba(12,8,4,0.55)',
            backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
            border: '1px solid rgba(255,255,255,0.08)',
            borderTop: '1px solid rgba(255,255,255,0.14)',
            borderRadius: 16,
            padding: '14px 16px',
            boxShadow: '0 4px 16px rgba(0,0,0,0.30)',
          }}>
            <p style={{ fontSize: 22, marginBottom: 4, color }}>{emoji}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 36, color, lineHeight: 1 }}>{val}</p>
            <p style={{ color: 'var(--text-dim)', fontSize: 9, letterSpacing: 1.5, marginTop: 5, textTransform: 'uppercase', fontWeight: 600 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* Nowe osiągnięcia */}
      {newAchievements.length > 0 && (
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.4 }}
          style={{ position: 'relative', zIndex: 1, marginBottom: 10 }}
        >
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 9, letterSpacing: 2.5,
            color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600,
            marginBottom: 8,
          }}>
            Osiągnięcia odblokowane
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {newAchievements.map((a, i) => {
              const color = MEDAL_COLORS[a.stage?.medal] || 'var(--orange)'
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: `${color}12`,
                  border: `1px solid ${color}30`,
                  borderTop: `1px solid ${color}50`,
                  borderRadius: 12,
                  padding: '10px 14px',
                  backdropFilter: 'blur(20px)',
                  WebkitBackdropFilter: 'blur(20px)',
                }}>
                  {a.stage?.image
                    ? <img src={a.stage.image} alt={a.stage.label} style={{ width: 44, height: 44, objectFit: 'contain', filter: `drop-shadow(0 0 8px ${color}80)` }} />
                    : <span style={{ fontSize: 22, lineHeight: 1 }}>{a.stage?.icon || '🏆'}</span>
                  }
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
                      color, textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>{a.title}</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 1 }}>
                      {a.stage?.description || `${a.stage?.label} odblokowany`} · {a.total} traf.
                    </p>
                  </div>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10,
                    color, letterSpacing: 1, textTransform: 'uppercase',
                    background: `${color}20`, border: `1px solid ${color}40`,
                    padding: '3px 8px', borderRadius: 99,
                  }}>{a.stage?.label}</span>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}

      {/* Spacer + przyciski */}
      <div style={{ flex: 1 }} />
      <div style={{ padding: '12px 0 28px', position: 'relative', zIndex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {/* Share button */}
        <button
          onClick={handleShare}
          disabled={sharing}
          style={{
            width: '100%', padding: '14px',
            background: 'rgba(6,14,30,0.52)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: '1px solid rgba(120,190,255,0.18)',
            borderTop: '1px solid rgba(160,210,255,0.28)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            fontSize: 15, fontWeight: 700, letterSpacing: 1.5,
            textTransform: 'uppercase', cursor: sharing ? 'default' : 'pointer',
            opacity: sharing ? 0.6 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'opacity 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          {sharing ? 'Generuję...' : 'Udostępnij wyniki'}
        </button>
        <button className="btn-primary" onClick={onBack} style={{ fontSize: 15, padding: '16px' }}>
          Wróć do planu
        </button>
      </div>
    </motion.div>
  )
}

export default function ShootingPage() {
  const { id } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuth()
  const [streakToast, setStreakToast] = useState(0)

  const training = state?.training
  const config = TYPE_CONFIG[training?.type] || TYPE_CONFIG.shooting_3pt
  const target = training?.target_reps || config.target

  const { history, addShot, undoShot, clearSession, loaded } = useShootingSession(id)
  const [flashKey, setFlashKey] = useState(0)
  const [flash, setFlash] = useState(null)
  const [finished, setFinished] = useState(false)
  const [saving, setSaving] = useState(false)
  const [finalStats, setFinalStats] = useState({ made: 0, attempted: 0 })
  const [newAchievements, setNewAchievements] = useState([])
  const [showManualInput, setShowManualInput] = useState(false)
  const [manualMade, setManualMade] = useState('')
  const [manualMissed, setManualMissed] = useState('')

  const made = history.filter(Boolean).length
  const attempted = history.length
  const pct = attempted > 0 ? Math.round((made / attempted) * 100) : 0
  const progress = Math.min(attempted / target, 1)

  function triggerFlash(type) {
    setFlash(type)
    setFlashKey(k => k + 1)
    setTimeout(() => setFlash(null), 260)
  }

  // Współdzielona logika: odznacz trening w activity_log + zalicz serię
  async function markDoneAndCreditStreak(trainingId) {
    // 1. Pobierz aktualny activity_log dla dzisiaj
    const { data: existingLog } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', TODAY)
      .maybeSingle()

    // 2. Dodaj trening do ukończonych (jeśli nie ma)
    const prevCompleted = existingLog?.trainings_completed || []
    if (!prevCompleted.includes(trainingId)) {
      const newCompleted = [...prevCompleted, trainingId]

      await supabase.from('activity_log').upsert(
        { user_id: profile.id, date: TODAY, trainings_completed: newCompleted, all_done: true },
        { onConflict: 'user_id,date' }
      )
    }

    // 3. Pobierz świeży profil z DB (bez stale closure!)
    const { data: freshProfile } = await supabase
      .from('profiles')
      .select('streak, longest_streak, last_active')
      .eq('id', profile.id)
      .single()

    const lastActiveDate = (freshProfile?.last_active || '').slice(0, 10)
    if (lastActiveDate !== TODAY) {
      const newStreak = (freshProfile?.streak || 0) + 1
      const { error: strErr } = await supabase.from('profiles').update({
        streak:         newStreak,
        longest_streak: Math.max(newStreak, freshProfile?.longest_streak || 0),
        last_active:    TODAY,
      }).eq('id', profile.id)

      if (!strErr) {
        await refreshProfile()
        setStreakToast(newStreak)
      }
    }
  }

  async function handleShot(isMade) {
    if (finished || saving || !loaded) return
    addShot(isMade)
    triggerFlash(isMade ? 'made' : 'missed')
    const newAttempted = attempted + 1
    if (newAttempted >= target) {
      const finalMade = isMade ? made + 1 : made
      setSaving(true)

      await supabase.from('shooting_sessions').insert({
        user_id: profile.id,
        training_id: id,
        shot_type: config.shotType,
        made: finalMade,
        attempted: newAttempted,
      })

      // Odznacz trening w activity_log i zalicz serię
      await markDoneAndCreditStreak(id)

      setFinalStats({ made: finalMade, attempted: newAttempted })
      clearSession()

      // Sprawdź osiągnięcia skumulowane + perfekcyjne sesje
      const daysSinceJoin = Math.floor((new Date() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24))
      const weekNumber = Math.floor(daysSinceJoin / 7) + 1
      const [unlocked, perfect] = await Promise.all([
        checkShotAchievements(profile.id, config.shotType, weekNumber),
        checkPerfectSession(profile.id, config.shotType, finalMade, newAttempted, weekNumber),
      ])
      const allNew = [...unlocked, ...perfect]
      if (allNew.length > 0) setNewAchievements(allNew)

      setSaving(false)
      setFinished(true)
    }
  }

  async function handleManualSubmit() {
    const m = parseInt(manualMade) || 0
    const miss = parseInt(manualMissed) || 0
    const total = m + miss
    if (total === 0 || total > target) return
    setSaving(true)
    setShowManualInput(false)

    await supabase.from('shooting_sessions').insert({
      user_id: profile.id,
      training_id: id,
      shot_type: config.shotType,
      made: m,
      attempted: total,
    })

    // Odznacz trening w activity_log i zalicz serię
    await markDoneAndCreditStreak(id)

    setFinalStats({ made: m, attempted: total })
    clearSession()

    const daysSinceJoin = Math.floor((new Date() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24))
    const weekNumber = Math.floor(daysSinceJoin / 7) + 1
    const [unlocked, perfect] = await Promise.all([
      checkShotAchievements(profile.id, config.shotType, weekNumber),
      checkPerfectSession(profile.id, config.shotType, m, total, weekNumber),
    ])
    const allNew = [...unlocked, ...perfect]
    if (allNew.length > 0) setNewAchievements(allNew)

    setSaving(false)
    setFinished(true)
  }

  if (!training) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div className="spinner" />
    </div>
  )

  const glassCard = {
    background: 'rgba(12,8,4,0.60)',
    backdropFilter: 'blur(28px)',
    WebkitBackdropFilter: 'blur(28px)',
    border: '1px solid rgba(255,255,255,0.10)',
    borderTop: '1px solid rgba(255,255,255,0.17)',
    borderRadius: 'var(--radius)',
    boxShadow: '0 8px 28px rgba(0,0,0,0.40)',
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'transparent', position: 'relative', overflow: 'hidden',
    }}>
      <AnimatePresence>
        {finished && (
          <SuccessScreen
            made={finalStats.made}
            attempted={finalStats.attempted}
            target={target}
            shotType={training.type}
            onBack={() => navigate('/', { replace: true })}
            newAchievements={newAchievements}
            playerName={profile?.name}
          />
        )}
      </AnimatePresence>

      {/* Manual Input Modal */}
      <AnimatePresence>
        {showManualInput && (() => {
          const m = parseInt(manualMade) || 0
          const miss = parseInt(manualMissed) || 0
          const total = m + miss
          const overLimit = total > target
          const canSubmit = total > 0 && !overLimit
          return (
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              onClick={() => setShowManualInput(false)}
              style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(6px)', WebkitBackdropFilter: 'blur(6px)' }}
            >
              <motion.div
                initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                transition={{ type: 'spring', damping: 28, stiffness: 300 }}
                onClick={e => e.stopPropagation()}
                style={{
                  position: 'absolute', bottom: 0, left: 0, right: 0,
                  background: 'rgba(14,10,6,0.97)',
                  borderTop: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: '24px 24px 0 0',
                  padding: '24px 20px 40px',
                }}
              >
                <div style={{ width: 36, height: 4, background: 'rgba(255,255,255,0.15)', borderRadius: 2, margin: '0 auto 20px' }} />
                <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4 }}>
                  Wpisz ręcznie
                </p>
                <p style={{ color: 'var(--text-dim)', fontSize: 12, marginBottom: 20 }}>
                  Limit: {target} rzutów łącznie
                </p>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 16 }}>
                  {[
                    { label: 'Trafione', color: 'var(--green-shot)', val: manualMade, set: setManualMade },
                    { label: 'Pudła',    color: 'var(--red-shot)',   val: manualMissed, set: setManualMissed },
                  ].map(({ label, color, val, set }) => (
                    <div key={label}>
                      <p style={{ fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', color, fontWeight: 700, marginBottom: 8 }}>{label}</p>
                      <input
                        type="number" inputMode="numeric" min="0" max={target}
                        value={val}
                        onChange={e => set(e.target.value.replace(/[^0-9]/g, ''))}
                        placeholder="0"
                        style={{
                          width: '100%', background: 'rgba(255,255,255,0.06)',
                          border: `1px solid ${color}40`,
                          borderRadius: 14, padding: '16px 12px',
                          fontFamily: 'var(--font-display)', fontWeight: 900,
                          fontSize: 32, color, textAlign: 'center',
                          outline: 'none', boxSizing: 'border-box',
                        }}
                      />
                    </div>
                  ))}
                </div>

                {/* Suma */}
                <div style={{
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  padding: '12px 16px',
                  background: overLimit ? 'rgba(255,61,61,0.10)' : 'rgba(255,255,255,0.04)',
                  border: `1px solid ${overLimit ? 'rgba(255,61,61,0.35)' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 12, marginBottom: 16,
                }}>
                  <span style={{ color: 'var(--text-dim)', fontSize: 12, fontWeight: 600, letterSpacing: 1, textTransform: 'uppercase' }}>Suma</span>
                  <span style={{
                    fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20,
                    color: overLimit ? 'var(--red-shot)' : total > 0 ? 'var(--text-primary)' : 'var(--text-dim)',
                  }}>
                    {total} / {target}
                    {overLimit && <span style={{ fontSize: 13, marginLeft: 8 }}>— za dużo!</span>}
                  </span>
                </div>

                <button
                  onClick={handleManualSubmit}
                  disabled={!canSubmit}
                  className="btn-primary"
                  style={{ width: '100%', opacity: canSubmit ? 1 : 0.35 }}
                >
                  Zatwierdź trening
                </button>
              </motion.div>
            </motion.div>
          )
        })()}
      </AnimatePresence>

      {/* Header */}
      <div style={{ padding: '16px 20px 10px', flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12 }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'rgba(12,8,4,0.65)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(255,255,255,0.13)',
          borderRadius: 12, width: 40, height: 40, cursor: 'pointer',
          color: 'var(--text-secondary)', fontSize: 18, flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>←</button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontSize: 10, letterSpacing: 2.5, color: 'var(--orange)', textTransform: 'uppercase', fontWeight: 600 }}>
            {config.label}
          </p>
          <h2 style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textTransform: 'uppercase', letterSpacing: 0.5 }}>
            {training.title}
          </h2>
        </div>
        {attempted > 0 && !finished && (
          <span style={{ background: 'rgba(91,184,245,0.15)', color: 'var(--orange)', fontSize: 10, padding: '4px 10px', borderRadius: 99, fontFamily: 'var(--font-display)', fontWeight: 700, letterSpacing: 1, border: '1px solid rgba(91,184,245,0.25)' }}>
            WZNOWIONO
          </span>
        )}
        {saving && <div className="spinner" style={{ width: 20, height: 20, flexShrink: 0 }} />}
      </div>

      {/* Progress bar */}
      <div style={{ padding: '0 20px 10px', flexShrink: 0 }}>
        <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 4, overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', background: 'linear-gradient(90deg, var(--orange), var(--orange-hot))', borderRadius: 4, originX: 0, boxShadow: '0 0 8px rgba(91,184,245,0.50)' }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ duration: 0.15 }}
          />
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 12, fontWeight: 500 }}>{attempted} / {target}</span>
          <motion.span key={pct} initial={{ scale: 1.3 }} animate={{ scale: 1 }}
            style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18, color: 'var(--orange)', letterSpacing: 1 }}>
            {pct}%
          </motion.span>
        </div>
      </div>

      {/* Stats row */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 10px', flexShrink: 0 }}>
        {[
          { val: made,              label: 'TRAFIONE',  color: 'var(--green-shot)' },
          { val: attempted - made,  label: 'PUDŁA',     color: 'var(--red-shot)'   },
          { val: target - attempted,label: 'ZOSTAŁO',   color: 'var(--text-dim)'   },
        ].map(({ val, label, color }) => (
          <div key={label} style={{ flex: 1, ...glassCard, padding: '10px 6px', textAlign: 'center' }}>
            <motion.p key={val} initial={{ y: -6, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28, color, lineHeight: 1 }}>
              {val}
            </motion.p>
            <p style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 1.5, textTransform: 'uppercase', marginTop: 4, fontWeight: 600 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* BIG SHOT BUTTONS */}
      <div style={{ flex: 1, display: 'flex', gap: 10, padding: '0 20px 10px', minHeight: 0 }}>
        {/* MADE */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => handleShot(true)}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            background: 'rgba(0,230,118,0.06)',
            border: '1px solid rgba(0,230,118,0.18)',
            borderTop: '1px solid rgba(0,230,118,0.28)',
            borderRadius: 22, cursor: 'pointer', outline: 'none',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.40)',
          }}
        >
          <AnimatePresence>
            {flash === 'made' && (
              <motion.div key={flashKey} initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} transition={{ duration: 0.28 }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(0,230,118,0.35)', pointerEvents: 'none', borderRadius: 'inherit' }} />
            )}
          </AnimatePresence>
          <span style={{ fontSize: 44, filter: 'drop-shadow(0 0 12px rgba(0,230,118,0.50))' }}>✓</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, color: 'var(--green-shot)', letterSpacing: 2, textTransform: 'uppercase' }}>
            TRAFIONY
          </span>
          <span style={{ color: 'var(--text-dim)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>tapnij</span>
        </motion.button>

        {/* MISSED */}
        <motion.button
          whileTap={{ scale: 0.94 }}
          onClick={() => handleShot(false)}
          style={{
            flex: 1, position: 'relative', overflow: 'hidden',
            background: 'rgba(255,61,61,0.06)',
            border: '1px solid rgba(255,61,61,0.18)',
            borderTop: '1px solid rgba(255,61,61,0.28)',
            borderRadius: 22, cursor: 'pointer', outline: 'none',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10,
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            boxShadow: '0 8px 28px rgba(0,0,0,0.40)',
          }}
        >
          <AnimatePresence>
            {flash === 'missed' && (
              <motion.div key={flashKey} initial={{ opacity: 0.7 }} animate={{ opacity: 0 }} transition={{ duration: 0.28 }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(255,61,61,0.35)', pointerEvents: 'none', borderRadius: 'inherit' }} />
            )}
          </AnimatePresence>
          <span style={{ fontSize: 44, filter: 'drop-shadow(0 0 12px rgba(255,61,61,0.50))' }}>✗</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22, color: 'var(--red-shot)', letterSpacing: 2, textTransform: 'uppercase' }}>
            PUDŁO
          </span>
          <span style={{ color: 'var(--text-dim)', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>tapnij</span>
        </motion.button>
      </div>

      {/* Manual input + Undo */}
      <div style={{ padding: '0 20px 20px', flexShrink: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <button
          className="btn-ghost"
          onClick={() => { setManualMade(''); setManualMissed(''); setShowManualInput(true) }}
          style={{ width: '100%', padding: '11px', fontSize: 13, letterSpacing: 1, textTransform: 'uppercase', fontFamily: 'var(--font-display)', fontWeight: 600 }}
        >
          ✎ Wpisz ręcznie
        </button>
        <button className="btn-ghost" onClick={undoShot} disabled={history.length === 0}
          style={{ width: '100%', padding: '11px', fontSize: 13, letterSpacing: 1, opacity: history.length === 0 ? 0.25 : 1, textTransform: 'uppercase', fontFamily: 'var(--font-display)', fontWeight: 600 }}>
          ↩ Cofnij
          {history.length > 0 && (
            <span style={{ marginLeft: 8, opacity: 0.5, fontSize: 11 }}>
              ({history[history.length - 1] ? 'trafiony' : 'pudło'})
            </span>
          )}
        </button>
      </div>

      <StreakToast streak={streakToast} visible={streakToast > 0} onHide={() => setStreakToast(0)} />
    </div>
  )
}

