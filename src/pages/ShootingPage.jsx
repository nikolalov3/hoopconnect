import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useLocation, useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { useShootingSession } from '../hooks/useShootingSession'
import { getCache, setCache, bustCache } from '../lib/queryCache'
import { pct as calcPct } from '../lib/pct'
import { checkShotAchievements, checkPerfectSession } from '../lib/achievements'
import { recalcFraud } from '../lib/anticheat'
import { nextStreakValue } from '../lib/streak'
import StreakToast from '../components/ui/StreakToast'
import { shareSessionCard, doShare } from '../lib/shareCard'
import { dispatchLocal } from '../lib/realtimeManager'
import { calendarWeekNumber } from '../lib/week'

const TODAY = new Date().toISOString().split('T')[0]

const TYPE_CONFIG = {
  shooting_3pt: { target: 150, shotType: '3pt' },
  shooting_2pt: { target: 100, shotType: '2pt' },
  shooting_ft:  { target: 100, shotType: 'ft'  },
}

const MEDAL_COLORS = {
  bronze:   '#CD7F32',
  silver:   '#A8B9C8',
  gold:     '#FFD700',
  diamond:  '#5BB8F5',
  platinum: '#E8E8F0',
}

function SuccessScreen({ made, attempted, target, shotType, onBack, newAchievements = [], playerName }) {
  const { t } = useTranslation('shooting')
  const pct = calcPct(made, attempted)
  const [sharing, setSharing] = useState(false)

  async function handleShare() {
    setSharing(true)
    try {
      const blob = await shareSessionCard({ made, attempted, target, shotType, playerName })
      await doShare(blob, 'hoopconnect-sesja.png', {
        title: t('success.shareTitle', { pct }),
        text:  t('success.shareText', { pct, made, attempted }),
      })
    } finally {
      setSharing(false)
    }
  }
  const missed = attempted - made
  // Softer semantic colors — bez czerwonego, kończymy pomarańczem (warm not alarm).
  // ≥60 emerald, 30-59 amber, <30 warm orange (jak SF crystal w Club).
  const pctColor = pct >= 60 ? '#34D399' : pct >= 30 ? '#FCD34D' : '#FF8830'
  const support =
    pct === 100 ? t('success.support.perfect') :
    pct >= 80   ? t('success.support.elite') :
    pct >= 65   ? t('success.support.great') :
    pct >= 50   ? t('success.support.solid') :
    pct >= 30   ? t('success.support.tryHarder') :
                  t('success.support.everyChampion')

  return (
    <motion.div
      initial={{ opacity: 0, y: 40 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: 'easeOut' }}
      style={{
        position: 'fixed',
        top: 0, bottom: 0,
        left: 'max(0px, calc((100vw - 430px) / 2))',
        width: 'min(100vw, 430px)',
        zIndex: 300,
        // Lżejszy navy zamiast prawie-czarnego brązu (#06,04,02). Spójny z resztą apki.
        background: 'linear-gradient(180deg, #0E1A2E 0%, #0A1422 60%, #07101C 100%)',
        backdropFilter: 'blur(40px)',
        WebkitBackdropFilter: 'blur(40px)',
        display: 'flex', flexDirection: 'column',
        padding: '0 24px',
        paddingTop: 'env(safe-area-inset-top, 0px)',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        overflowY: 'auto',
      }}
    >
      {/* Ambient halo — bardzo subtelne, kolor wyniku */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 320,
        background: `radial-gradient(ellipse 90% 100% at 50% 0%, ${pctColor}22 0%, transparent 72%)`,
        pointerEvents: 'none',
      }} />

      {/* Header — sentence case, ciszej */}
      <div style={{ paddingTop: 52, paddingBottom: 28, position: 'relative', zIndex: 1 }}>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 13, letterSpacing: 0.1,
          color: 'rgba(180,195,220,0.62)', fontWeight: 500, marginBottom: 6,
        }}>
          {(TYPE_CONFIG[shotType] ? t(`types.${shotType}`) : null) ?? t('success.sessionFallback')} · {t('success.finishedSuffix')}
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 38,
          color: 'var(--text-primary)', letterSpacing: 0.1, lineHeight: 1.05,
        }}>
          {t('success.titleLine1')}<br/>{t('success.titleLine2')}
        </h1>
      </div>

      {/* HERO — gigantyczne % bez karty, editorialne */}
      <motion.div
        initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 220, damping: 26, delay: 0.05 }}
        style={{ position: 'relative', zIndex: 1, marginBottom: 28 }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 116,
          color: pctColor, lineHeight: 0.95, letterSpacing: -4,
          textShadow: `0 0 24px ${pctColor}22`,
        }}>
          {pct}<span style={{ fontSize: 56, fontWeight: 700, marginLeft: -4 }}>%</span>
        </p>
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 16, fontWeight: 500,
          color: 'rgba(220,228,242,0.78)', marginTop: 8, letterSpacing: 0.1,
        }}>
          {support}
        </p>
      </motion.div>

      {/* Floating stats — bez kart, ikony + cyfry editorial */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 240, damping: 26, delay: 0.12 }}
        style={{ position: 'relative', zIndex: 1, marginBottom: 26 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="#34D399" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M20 6L9 17l-5-5"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 30, color: '#34D399', lineHeight: 1, letterSpacing: -0.5 }}>
              {made}
            </span>
            <span style={{ color: 'rgba(180,195,220,0.62)', fontSize: 13, fontWeight: 500 }}>{t('success.madeLabel')}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none"
              stroke="#FB7185" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 22, color: '#FB7185', lineHeight: 1 }}>
              {missed}
            </span>
            <span style={{ color: 'rgba(180,195,220,0.55)', fontSize: 13, fontWeight: 500 }}>{missed === 1 ? t('success.missOne') : t('success.missOther')}</span>
          </div>
        </div>
        <p style={{
          color: 'rgba(180,195,220,0.45)', fontSize: 12, fontWeight: 400,
          marginTop: 12, letterSpacing: 0.1,
        }}>
          {attempted} {attempted === 1 ? t('success.totalOne') : attempted < 5 ? t('success.totalFew') : t('success.totalMany')} {t('success.totalSuffix')}
        </p>

        {/* Liquid progress line — alive, shimmer */}
        <div style={{
          marginTop: 16,
          background: 'rgba(255,255,255,0.04)',
          borderRadius: 3, height: 3, overflow: 'hidden',
          position: 'relative',
        }}>
          <motion.div
            initial={{ width: '0%' }}
            animate={{ width: `${Math.min(attempted / target, 1) * 100}%` }}
            transition={{ type: 'spring', stiffness: 60, damping: 18, delay: 0.25 }}
            style={{
              height: '100%', borderRadius: 3,
              background: `linear-gradient(90deg, ${pctColor}88, ${pctColor})`,
              boxShadow: `0 0 8px ${pctColor}40`,
              position: 'relative', overflow: 'hidden',
            }}
          >
            {/* Shimmer overlay — subtelny ruch światła wzdłuż linii */}
            <motion.div
              animate={{ x: ['-30%', '130%'] }}
              transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut', repeatDelay: 1.5 }}
              style={{
                position: 'absolute', top: 0, left: 0, height: '100%', width: '30%',
                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.45), transparent)',
              }}
            />
          </motion.div>
        </div>
      </motion.div>

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
            {t('success.achievementsUnlocked')}
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {newAchievements.map((a, i) => {
              const color = MEDAL_COLORS[a.stage?.medal] || 'var(--orange)'
              return (
                <div key={i} style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  background: `${color}12`,
                  border: 'none',
                  borderRadius: 14,
                  padding: '10px 14px',
                  backdropFilter: 'blur(24px)',
                  WebkitBackdropFilter: 'blur(24px)',
                  boxShadow: `inset 0 1px 0 ${color}40, inset 0 -1px 0 rgba(0,0,0,0.14), inset 0 0 0 0.5px ${color}28`,
                }}>
                  {a.stage?.image
                    ? <img src={a.stage.image} alt={a.stage.label} style={{ width: 44, height: 44, objectFit: 'contain', filter: `drop-shadow(0 0 8px ${color}73)` }} />
                    : <span style={{ fontSize: 22, lineHeight: 1 }}>{a.stage?.icon || '🏆'}</span>
                  }
                  <div style={{ flex: 1 }}>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
                      color, textTransform: 'uppercase', letterSpacing: 0.5,
                    }}>{a.title}</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: 11, marginTop: 1 }}>
                      {a.stage?.description || t('success.unlockedFallback', { label: a.stage?.label })} · {a.total} {t('success.hitsSuffix')}
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
            background: 'linear-gradient(180deg, rgba(40,55,85,0.42) 0%, rgba(22,32,52,0.34) 100%)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
            border: 'none',
            borderRadius: 14,
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)',
            fontSize: 14, fontWeight: 600, letterSpacing: 0.1,
            cursor: sharing ? 'default' : 'pointer',
            opacity: sharing ? 0.6 : 1,
            boxShadow: 'inset 0 1px 0 rgba(200,225,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.16), inset 0 0 0 0.5px rgba(150,200,255,0.10), 0 1px 6px rgba(0,0,0,0.20)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            transition: 'opacity 0.15s',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          {sharing ? t('success.generating') : t('success.shareResults')}
        </button>
        <button className="btn-primary" onClick={onBack} style={{ fontSize: 15, padding: '16px' }}>
          {t('success.backToPlan')}
        </button>
      </div>
    </motion.div>
  )
}

export default function ShootingPage() {
  const { t } = useTranslation('shooting')
  const { id } = useParams()
  const { state } = useLocation()
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuth()
  const [streakToast, setStreakToast] = useState(0)

  // Freestyle mode = sesja dodana z Stats (+) zamiast z dziennego treningu.
  // Brak training_id, brak points_log, brak activity_log credit.
  const isFreestyle = id === 'freestyle'
  const fsParams = isFreestyle ? new URLSearchParams(window.location.search) : null
  const freestyleType = fsParams?.get('type') || null
  // Clamp do dozwolonego zakresu (20-150, krok 10) na wypadek manipulacji URL
  const rawTarget = parseInt(fsParams?.get('target') || '', 10)
  const freestyleTarget = Number.isFinite(rawTarget)
    ? Math.min(150, Math.max(20, Math.round(rawTarget / 10) * 10))
    : 20
  const freestyleConfigKey = ({
    '3pt': 'shooting_3pt',
    '2pt': 'shooting_2pt',
    'ft':  'shooting_ft',
  })[freestyleType] || 'shooting_3pt'

  const training = isFreestyle
    ? {
        id: 'freestyle',
        type: freestyleConfigKey,
        title: t('freestyleTitle', { label: t(`types.${freestyleConfigKey}`) }),
        target_reps: freestyleTarget,
      }
    : state?.training

  const configKey = TYPE_CONFIG[training?.type] ? training.type : 'shooting_3pt'
  const config = TYPE_CONFIG[configKey]
  const configLabel = t(`types.${configKey}`)
  const target = training?.target_reps || config.target

  const { history, addShot, undoShot, clearSession, loaded } = useShootingSession(id)
  const sessionStartRef = useRef(null)
  useEffect(() => { if (loaded && !sessionStartRef.current) sessionStartRef.current = new Date().toISOString() }, [loaded])
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
  const pct = calcPct(made, attempted)
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

      const { data: savedLog } = await supabase.from('activity_log').upsert(
        { user_id: profile.id, date: TODAY, trainings_completed: newCompleted, all_done: true },
        { onConflict: 'user_id,date' }
      ).select().single()

      // Bust cache + refill + DISPATCH event dla HomePage (która jest keep-alive
      // w App.jsx — useEffect[profile] nie fire'uje przy powrocie, więc Realtime
      // czasem zdąży, czasem nie. Event jest gwarancją że state odświeży się
      // synchronicznie zanim user zdąży kliknąć w trening po raz drugi).
      try {
        bustCache(`log:${profile.id}:${TODAY}`)
        if (savedLog) {
          setCache(`log:${profile.id}:${TODAY}`, savedLog, 15 * 1000)
          window.dispatchEvent(new CustomEvent('hc:activity-log-updated', { detail: savedLog }))
        }
      } catch {}
    }

    // 3. Pobierz świeży profil z DB (bez stale closure!)
    const { data: freshProfile } = await supabase
      .from('profiles')
      .select('streak, longest_streak, last_active')
      .eq('id', profile.id)
      .single()

    const lastActiveDate = (freshProfile?.last_active || '').slice(0, 10)
    if (lastActiveDate !== TODAY) {
      const newStreak = nextStreakValue(freshProfile?.last_active, freshProfile?.streak)
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

  // Prepend nowo zapisanej sesji do cache `sessions:${userId}` — Stats pokaże
  // ją od razu po wejściu, bez czekania na refetch z DB. Insert i tak idzie
  // do DB; tu tylko przyspieszamy lokalny render.
  function pushSessionToCache(row) {
    if (!profile?.id || !row) return
    const key = `sessions:${profile.id}`
    const cached = getCache(key) || []
    // 2 min TTL (jak w StatsPage). Najnowsza na górze (order DESC).
    setCache(key, [row, ...cached], 2 * 60 * 1000)
  }

  async function handleShot(isMade) {
    if (finished || saving || !loaded) return
    addShot(isMade)
    triggerFlash(isMade ? 'made' : 'missed')
    const newAttempted = attempted + 1
    // Auto-finish gdy user osiągnie ustawiony target (też w freestyle — target przyszedł z suwaka).
    if (newAttempted >= target) {
      const finalMade = isMade ? made + 1 : made
      setSaving(true)

      const { data: insertedRow1 } = await supabase.from('shooting_sessions').insert({
        user_id:      profile.id,
        training_id:  isFreestyle ? null : id,
        shot_type:    config.shotType,
        made:         finalMade,
        attempted:    newAttempted,
        started_at:   sessionStartRef.current,
        session_date: new Date().toISOString().split('T')[0],
      }).select('*, trainings(title)').single()
      pushSessionToCache(insertedRow1)
      if (insertedRow1) dispatchLocal('shooting_sessions', 'INSERT', insertedRow1)

      if (!isFreestyle) {
        // Punkty + credit do streak — TYLKO dla dziennego treningu, nie freestyle.
        const TODAY_DATE = new Date().toISOString().split('T')[0]
        const weekNum2 = calendarWeekNumber(new Date())
        await supabase.from('points_log').upsert(
          {
            user_id: profile.id,
            training_id: id,
            points: 30,
            week_number: weekNum2,
            date: TODAY_DATE,
            source: 'shooting_session',
          },
          { onConflict: 'user_id,training_id,date,source', ignoreDuplicates: true }
        )
        await markDoneAndCreditStreak(id)
      }

      setFinalStats({ made: finalMade, attempted: newAttempted })
      clearSession()

      // Sprawdź osiągnięcia skumulowane + perfekcyjne sesje
      const weekNumber = calendarWeekNumber(new Date())
      const [unlocked, perfect] = await Promise.all([
        checkShotAchievements(profile.id, config.shotType, weekNumber),
        checkPerfectSession(profile.id, config.shotType, finalMade, newAttempted, weekNumber),
      ])
      const allNew = [...unlocked, ...perfect]
      if (allNew.length > 0) setNewAchievements(allNew)

      recalcFraud(profile.id)   // fire-and-forget anti-cheat
      setSaving(false)
      setFinished(true)
    }
  }

  // Zakończenie freestyle ręcznie — przycisk "Zakończ sesję".
  // Zapisuje shooting_session z bieżącymi liczbami, pomija punkty/streak,
  // sprawdza achievementy i pokazuje SuccessScreen z share.
  async function handleFinishFreestyle() {
    if (finished || saving || attempted === 0) return
    setSaving(true)
    const { data: insertedRow2 } = await supabase.from('shooting_sessions').insert({
      user_id:      profile.id,
      training_id:  null,
      shot_type:    config.shotType,
      made,
      attempted,
      started_at:   sessionStartRef.current,
      session_date: new Date().toISOString().split('T')[0],
    }).select('*, trainings(title)').single()
    pushSessionToCache(insertedRow2)
    if (insertedRow2) dispatchLocal('shooting_sessions', 'INSERT', insertedRow2)
    setFinalStats({ made, attempted })
    clearSession()
    const weekNumber = calendarWeekNumber(new Date())
    const [unlocked, perfect] = await Promise.all([
      checkShotAchievements(profile.id, config.shotType, weekNumber),
      checkPerfectSession(profile.id, config.shotType, made, attempted, weekNumber),
    ])
    const allNew = [...unlocked, ...perfect]
    if (allNew.length > 0) setNewAchievements(allNew)
    recalcFraud(profile.id)
    setSaving(false)
    setFinished(true)
  }

  async function handleManualSubmit() {
    const m = parseInt(manualMade) || 0
    const miss = parseInt(manualMissed) || 0
    const total = m + miss
    if (total === 0 || total > target) return
    setSaving(true)
    setShowManualInput(false)

    const { data: insertedRow3 } = await supabase.from('shooting_sessions').insert({
      user_id:      profile.id,
      training_id:  isFreestyle ? null : id,
      shot_type:    config.shotType,
      made:         m,
      attempted:    total,
      started_at:   sessionStartRef.current,
      session_date: new Date().toISOString().split('T')[0],
    }).select('*, trainings(title)').single()
    pushSessionToCache(insertedRow3)
    if (insertedRow3) dispatchLocal('shooting_sessions', 'INSERT', insertedRow3)

    if (!isFreestyle) {
      const TODAY_DATE = new Date().toISOString().split('T')[0]
      const weekNum2 = calendarWeekNumber(new Date())
      await supabase.from('points_log').upsert(
        {
          user_id: profile.id,
          training_id: id,
          points: 30,
          week_number: weekNum2,
          date: TODAY_DATE,
          source: 'shooting_session',
        },
        { onConflict: 'user_id,training_id,date,source', ignoreDuplicates: true }
      )
      await markDoneAndCreditStreak(id)
    }

    setFinalStats({ made: m, attempted: total })
    clearSession()

    const weekNumber = calendarWeekNumber(new Date())
    const [unlocked, perfect] = await Promise.all([
      checkShotAchievements(profile.id, config.shotType, weekNumber),
      checkPerfectSession(profile.id, config.shotType, m, total, weekNumber),
    ])
    const allNew = [...unlocked, ...perfect]
    if (allNew.length > 0) setNewAchievements(allNew)

    recalcFraud(profile.id)   // fire-and-forget anti-cheat
    setSaving(false)
    setFinished(true)
  }

  if (!training) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
      <div className="spinner" />
    </div>
  )

  // Liquid-glass — bez twardych obrysów, krawędzie z luminancji (top highlight
  // + bottom shade), warstwa nad tłem zamiast „karty".
  const glassCard = {
    background: 'linear-gradient(180deg, rgba(40,55,85,0.32) 0%, rgba(22,32,52,0.26) 100%)',
    backdropFilter: 'blur(28px) saturate(1.55)',
    WebkitBackdropFilter: 'blur(28px) saturate(1.55)',
    border: 'none',
    borderRadius: 14,
    boxShadow: [
      'inset 0 1px 0 rgba(200,225,255,0.10)',
      'inset 0 -1px 0 rgba(0,0,0,0.16)',
      'inset 0 0 0 0.5px rgba(150,200,255,0.05)',
      '0 1px 6px rgba(0,0,0,0.18)',
    ].join(', '),
  }

  return (
    <div style={{
      // Scroll root so the bottom CTAs (incl. freestyle "Zakończ sesję") stay
      // reachable on small phones instead of being clipped below the fold.
      height: '100%', display: 'flex', flexDirection: 'column',
      background: 'transparent', position: 'relative',
      overflowY: 'auto', WebkitOverflowScrolling: 'touch',
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

      {/* Manual Input Modal
          - createPortal on outside, AnimatePresence inside (required for exit animations)
          - overlay uses flex column so sheet is a normal flow child, NOT position:fixed again
            → on iOS when keyboard opens the sheet scrolls up naturally instead of being
              buried under the keyboard (position:fixed inside position:fixed is the bug)
          - single-column layout avoids grid overflow on narrow screens             */}
      {createPortal(
        <AnimatePresence>
          {showManualInput && (() => {
            const m = parseInt(manualMade) || 0
            const miss = parseInt(manualMissed) || 0
            const total = m + miss
            const overLimit = total > target
            const canSubmit = total > 0 && !overLimit
            return (
              <motion.div
                key="manual-overlay"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                onClick={() => setShowManualInput(false)}
                style={{
                  position: 'fixed', inset: 0, zIndex: 9000,
                  background: 'rgba(4,2,0,0.75)',
                  backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
                  // center horizontally to match app's max-width:430px container
                  display: 'flex', flexDirection: 'column', justifyContent: 'flex-end',
                  alignItems: 'center',
                }}
              >
                <motion.div
                  key="manual-sheet"
                  initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
                  transition={{ type: 'spring', damping: 32, stiffness: 360 }}
                  onClick={e => e.stopPropagation()}
                  style={{
                    // constrained to app width — same as #root max-width
                    width: '100%', maxWidth: 430,
                    background: 'rgba(7,12,24,0.98)',
                    backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
                    border: '1px solid rgba(120,190,255,0.14)',
                    borderBottom: 'none',
                    borderRadius: '22px 22px 0 0',
                    padding: '18px 20px 0',
                    paddingBottom: 'env(safe-area-inset-bottom, 24px)',
                    boxShadow: '0 -8px 48px rgba(0,0,0,0.60)',
                  }}
                >
                  {/* Drag pill */}
                  <div style={{ width: 36, height: 4, background: 'rgba(120,190,255,0.20)',
                    borderRadius: 2, margin: '0 auto 16px' }} />

                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'baseline',
                    justifyContent: 'space-between', marginBottom: 16 }}>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20,
                      textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-primary)',
                    }}>{t('manualModal.title')}</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: 11, fontWeight: 500 }}>
                      {t('manualModal.max', { target })}
                    </p>
                  </div>

                  {/* Two rows: Trafione + Pudła — single column, no overflow */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
                    {[
                      { label: t('manualModal.made'), color: 'var(--green-shot)', val: manualMade, set: setManualMade },
                      { label: t('manualModal.missed'),    color: 'var(--red-shot)',   val: manualMissed, set: setManualMissed },
                    ].map(({ label, color, val, set }) => (
                      <div key={label} style={{
                        display: 'flex', alignItems: 'center',
                        background: 'rgba(6,18,38,0.70)',
                        border: `1.5px solid ${color}35`,
                        borderRadius: 14, overflow: 'hidden',
                      }}>
                        {/* Label + EDYTOWALNE pole liczbowe */}
                        <div style={{
                          padding: '8px 14px', flexShrink: 0,
                          display: 'flex', flexDirection: 'column', gap: 2,
                        }}>
                          <span style={{
                            fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
                            color, fontWeight: 700,
                          }}>{label}</span>
                          <input
                            type="text"
                            inputMode="numeric"
                            pattern="[0-9]*"
                            placeholder="0"
                            value={val}
                            onChange={e => set(e.target.value.replace(/[^0-9]/g, ''))}
                            onFocus={e => e.target.select()}
                            style={{
                              width: 90,
                              fontFamily: 'var(--font-display)', fontWeight: 900,
                              fontSize: 32, color, lineHeight: 1,
                              background: 'transparent', border: 'none', outline: 'none',
                              padding: 0, caretColor: color,
                            }}
                          />
                        </div>
                        {/* Stepper buttons */}
                        <div style={{ marginLeft: 'auto', display: 'flex',
                          borderLeft: `1px solid ${color}20` }}>
                          {[
                            { lbl: '−', delta: -1 },
                            { lbl: '+', delta:  1 },
                          ].map(({ lbl, delta }) => (
                            <button key={lbl}
                              type="button"
                              onClick={() => set(prev => String(Math.max(0, (parseInt(prev)||0) + delta)))}
                              style={{
                                width: 54, height: 56,
                                background: 'transparent',
                                border: 'none',
                                borderLeft: lbl === '+' ? `1px solid ${color}20` : 'none',
                                color, fontSize: 26, fontWeight: 300,
                                cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                              }}>{lbl}</button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Suma */}
                  <div style={{
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                    padding: '10px 14px', borderRadius: 12, marginBottom: 14,
                    background: overLimit ? 'rgba(255,61,61,0.08)' : 'rgba(120,190,255,0.04)',
                    border: `1px solid ${overLimit ? 'rgba(255,61,61,0.28)' : 'rgba(120,190,255,0.10)'}`,
                  }}>
                    <span style={{ fontFamily: 'var(--font-body)', color: 'var(--text-dim)',
                      fontSize: 11, fontWeight: 600, letterSpacing: 1.5, textTransform: 'uppercase',
                    }}>{t('manualModal.sum')}</span>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20,
                      color: overLimit ? 'var(--red-shot)' : total > 0 ? 'var(--text-primary)' : 'var(--text-dim)',
                    }}>
                      {total} / {target}
                      {overLimit && <span style={{ fontSize: 12, marginLeft: 8 }}>{t('manualModal.tooMany')}</span>}
                    </span>
                  </div>

                  <button onClick={handleManualSubmit} disabled={!canSubmit}
                    className="btn-primary" style={{ opacity: canSubmit ? 1 : 0.32, marginBottom: 24 }}>
                    {t('manualModal.submit')}
                  </button>
                </motion.div>
              </motion.div>
            )
          })()}
        </AnimatePresence>,
        document.body
      )}

      {/* Header — chłodny label, sentence-case tytuł */}
      <div style={{
        // iPhone notch/island safe area + minimum 14px top padding
        padding: 'max(14px, calc(env(safe-area-inset-top, 0px) + 8px)) 20px 12px',
        flexShrink: 0, display: 'flex', alignItems: 'center', gap: 12,
      }}>
        <button onClick={() => navigate(-1)} aria-label={t('back')} style={{
          background: 'transparent', border: 'none',
          width: 36, height: 36, cursor: 'pointer',
          color: 'var(--text-secondary)', flexShrink: 0,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          padding: 0,
        }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, letterSpacing: 0.2, color: 'rgba(180,195,220,0.65)', fontWeight: 500, marginBottom: 2 }}>
            {configLabel}
          </p>
          <h2 style={{
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18,
            lineHeight: 1.2, letterSpacing: 0.1,
            display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}>
            {training.title}
          </h2>
        </div>
        {attempted > 0 && !finished && (
          <span style={{
            background: 'rgba(91,184,245,0.10)', color: '#7ECBFF',
            fontSize: 10, padding: '4px 9px', borderRadius: 99,
            fontFamily: 'var(--font-body)', fontWeight: 600, letterSpacing: 0.2,
            boxShadow: 'inset 0 1px 0 rgba(180,220,255,0.10)',
          }}>
            {t('resumed')}
          </span>
        )}
        {saving && <div className="spinner" style={{ width: 20, height: 20, flexShrink: 0 }} />}
      </div>

      {/* Progress — target z suwaka/daily zawsze widoczny */}
      <div style={{ padding: '4px 20px 14px', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 8 }}>
          <span style={{ color: 'rgba(180,195,220,0.62)', fontSize: 13, fontWeight: 500, letterSpacing: 0.1 }}>
            {attempted} / {target}
          </span>
          <motion.span key={pct} initial={{ opacity: 0.7 }} animate={{ opacity: 1 }}
            style={{ display: 'inline-flex', alignItems: 'baseline', gap: 7 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 24, color: 'var(--orange)', letterSpacing: 0.1, lineHeight: 1 }}>
              {pct}%
            </span>
            <span style={{ color: 'rgba(180,195,220,0.55)', fontSize: 12, fontWeight: 400, letterSpacing: 0.1 }}>
              {t('accuracy')}
            </span>
          </motion.span>
        </div>
        <div style={{ background: 'rgba(255,255,255,0.05)', borderRadius: 3, height: 3, overflow: 'hidden' }}>
          <motion.div
            style={{ height: '100%', background: 'linear-gradient(90deg, var(--orange), var(--orange-hot))', borderRadius: 3, originX: 0 }}
            animate={{ width: `${progress * 100}%` }}
            transition={{ type: 'spring', stiffness: 140, damping: 22 }}
          />
        </div>
      </div>

      {/* Stats row — trafione/pudła/zostało */}
      <div style={{ display: 'flex', gap: 8, padding: '0 20px 10px', flexShrink: 0 }}>
        {([
          { val: made,              label: t('statLabels.made'), color: '#34D399' },
          { val: attempted - made,  label: t('statLabels.missed'),    color: '#FB7185' },
          { val: target - attempted,label: t('statLabels.remaining'),  color: 'rgba(180,195,220,0.55)' },
        ]
        ).map(({ val, label, color }) => (
          <div key={label} style={{ flex: 1, ...glassCard, padding: '12px 6px', textAlign: 'center' }}>
            <motion.p key={val} initial={{ y: -4, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 320, damping: 26 }}
              style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 26, color, lineHeight: 1, letterSpacing: -0.5 }}>
              {val}
            </motion.p>
            <p style={{ fontSize: 11, color: 'rgba(180,195,220,0.55)', letterSpacing: 0.1, marginTop: 5, fontWeight: 500 }}>{label}</p>
          </div>
        ))}
      </div>

      {/* SHOT BUTTONS — emerald/coral glass, mixed case, spring tap */}
      <div style={{ display: 'flex', gap: 10, padding: '6px 20px 14px', flexShrink: 0 }}>
        {/* MADE */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          onClick={() => handleShot(true)}
          style={{
            flex: 1, height: 138, position: 'relative', overflow: 'hidden',
            // Emerald glass — wycieniowane i subtelnie warstwowe
            background: 'linear-gradient(180deg, rgba(52,211,153,0.16) 0%, rgba(20,90,70,0.06) 100%)',
            border: 'none',
            borderRadius: 14, cursor: 'pointer', outline: 'none',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10,
            backdropFilter: 'blur(24px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
            boxShadow: [
              'inset 0 1px 0 rgba(150,255,210,0.18)',
              'inset 0 -1px 0 rgba(0,0,0,0.18)',
              'inset 0 0 0 0.5px rgba(52,211,153,0.18)',
              '0 1px 6px rgba(0,0,0,0.22)',
            ].join(', '),
          }}
        >
          <AnimatePresence>
            {flash === 'made' && (
              <motion.div key={flashKey} initial={{ opacity: 0.55 }} animate={{ opacity: 0 }} transition={{ duration: 0.32 }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(52,211,153,0.30)', pointerEvents: 'none', borderRadius: 'inherit' }} />
            )}
          </AnimatePresence>
          <svg width="34" height="34" viewBox="0 0 24 24" fill="none"
            stroke="#34D399" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: '#34D399', letterSpacing: 0.1 }}>
            {t('shotButtons.made')}
          </span>
        </motion.button>

        {/* MISSED */}
        <motion.button
          whileTap={{ scale: 0.97 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          onClick={() => handleShot(false)}
          style={{
            flex: 1, height: 138, position: 'relative', overflow: 'hidden',
            background: 'linear-gradient(180deg, rgba(251,113,133,0.14) 0%, rgba(120,40,55,0.06) 100%)',
            border: 'none',
            borderRadius: 14, cursor: 'pointer', outline: 'none',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center', gap: 10,
            backdropFilter: 'blur(24px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(24px) saturate(1.5)',
            boxShadow: [
              'inset 0 1px 0 rgba(255,200,210,0.18)',
              'inset 0 -1px 0 rgba(0,0,0,0.18)',
              'inset 0 0 0 0.5px rgba(251,113,133,0.18)',
              '0 1px 6px rgba(0,0,0,0.22)',
            ].join(', '),
          }}
        >
          <AnimatePresence>
            {flash === 'missed' && (
              <motion.div key={flashKey} initial={{ opacity: 0.55 }} animate={{ opacity: 0 }} transition={{ duration: 0.32 }}
                style={{ position: 'absolute', inset: 0, background: 'rgba(251,113,133,0.28)', pointerEvents: 'none', borderRadius: 'inherit' }} />
            )}
          </AnimatePresence>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none"
            stroke="#FB7185" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 17, color: '#FB7185', letterSpacing: 0.1 }}>
            {t('shotButtons.missed')}
          </span>
        </motion.button>
      </div>

      {/* Recent shots — kropki ostatnich 12 strzałów, subtelny insight zamiast pustki */}
      {history.length > 0 && (
        <div style={{ padding: '0 20px 14px', flexShrink: 0 }}>
          <p style={{ color: 'rgba(180,195,220,0.45)', fontSize: 11, fontWeight: 500, letterSpacing: 0.1, marginBottom: 8 }}>
            {t('recentShots')}
          </p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            {history.slice(-12).map((made, i, arr) => {
              const fade = 0.35 + (i / arr.length) * 0.65  // starsze blakną
              return (
                <motion.div
                  key={`${history.length}-${i}`}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={{ scale: 1, opacity: fade }}
                  transition={{ type: 'spring', stiffness: 340, damping: 24 }}
                  style={{
                    width: 10, height: 10, borderRadius: '50%',
                    background: made
                      ? `radial-gradient(circle at 35% 30%, rgba(52,211,153,0.95), rgba(52,211,153,0.50) 70%)`
                      : `radial-gradient(circle at 35% 30%, rgba(251,113,133,0.95), rgba(251,113,133,0.45) 70%)`,
                    boxShadow: `inset 0 0 0 0.5px ${made ? 'rgba(52,211,153,0.30)' : 'rgba(251,113,133,0.30)'}`,
                  }}
                />
              )
            })}
          </div>
        </div>
      )}

      {/* CTA — Wpisz ręcznie primary pill, Cofnij subtelne, freestyle: Zakończ */}
      <div style={{ padding: '0 20px 20px', flexShrink: 0, marginTop: 'auto', display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isFreestyle && (
          <motion.button
            whileTap={{ scale: 0.98 }}
            transition={{ type: 'spring', stiffness: 420, damping: 22 }}
            onClick={handleFinishFreestyle}
            disabled={attempted === 0 || saving}
            style={{
              width: '100%', padding: '14px',
              background: attempted === 0
                ? 'linear-gradient(180deg, rgba(40,55,85,0.30) 0%, rgba(22,32,52,0.24) 100%)'
                : 'linear-gradient(180deg, rgba(91,184,245,0.22) 0%, rgba(40,120,200,0.10) 100%)',
              border: 'none', borderRadius: 14,
              cursor: attempted === 0 ? 'not-allowed' : 'pointer',
              color: attempted === 0 ? 'rgba(180,200,230,0.35)' : '#7ECBFF',
              fontFamily: 'var(--font-display)', fontWeight: 600,
              fontSize: 15, letterSpacing: 0.1,
              opacity: (attempted === 0 || saving) ? 0.5 : 1,
              boxShadow: 'inset 0 1px 0 rgba(180,220,255,0.14), inset 0 0 0 0.5px rgba(91,184,245,0.18), 0 1px 6px rgba(0,0,0,0.20)',
              backdropFilter: 'blur(24px)',
              WebkitBackdropFilter: 'blur(24px)',
            }}
          >
            {t('finishSession')}
          </motion.button>
        )}
        <motion.button
          whileTap={{ scale: 0.98 }}
          transition={{ type: 'spring', stiffness: 420, damping: 22 }}
          onClick={() => { setManualMade(''); setManualMissed(''); setShowManualInput(true) }}
          style={{
            width: '100%', padding: '14px',
            background: 'linear-gradient(180deg, rgba(40,55,85,0.42) 0%, rgba(22,32,52,0.34) 100%)',
            border: 'none', borderRadius: 14, cursor: 'pointer',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-display)', fontWeight: 600,
            fontSize: 14, letterSpacing: 0.1,
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
            boxShadow: 'inset 0 1px 0 rgba(200,225,255,0.14), inset 0 -1px 0 rgba(0,0,0,0.16), 0 1px 6px rgba(0,0,0,0.20)',
            backdropFilter: 'blur(24px)',
            WebkitBackdropFilter: 'blur(24px)',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 20h9"/>
            <path d="M16.5 3.5a2.121 2.121 0 1 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
          </svg>
          {t('enterManually')}
        </motion.button>
        <button onClick={undoShot} disabled={history.length === 0}
          style={{
            width: '100%', padding: '11px',
            background: 'transparent', border: 'none',
            color: history.length === 0 ? 'rgba(180,195,220,0.25)' : 'rgba(180,195,220,0.58)',
            fontFamily: 'var(--font-body)', fontWeight: 500,
            fontSize: 13, letterSpacing: 0.1,
            cursor: history.length === 0 ? 'not-allowed' : 'pointer',
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 6,
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 7v6h6"/>
            <path d="M21 17a9 9 0 0 0-15-6.7L3 13"/>
          </svg>
          {t('undoLast')}
          {history.length > 0 && (
            <span style={{ opacity: 0.65, fontSize: 12 }}>
              ({history[history.length - 1] ? t('success.madeLabel') : t('success.missOne')})
            </span>
          )}
        </button>
      </div>

      <StreakToast streak={streakToast} visible={streakToast > 0} onHide={() => setStreakToast(0)} />
    </div>
  )
}

