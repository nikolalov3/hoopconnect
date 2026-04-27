import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import TrainingCard from '../components/training/TrainingCard'
import { fetchAchievementsCatalog, getNewlyUnlocked, awardMedalPoints, revokeStaleAchievements } from '../lib/achievements'
import SettingsPanel from '../components/ui/SettingsPanel'
import { useUI } from '../context/UIContext'
import StreakToast from '../components/ui/StreakToast'
import { getCache, setCache, bustCache } from '../lib/queryCache'

const TODAY = new Date().toISOString().split('T')[0]

function getDailySeed() {
  const d = new Date()
  return d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
}
function seededRandom(seed) {
  let s = seed
  return function() {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    return (s >>> 0) / 0xffffffff
  }
}

const SCHEDULES = {
  3: ['T','O','T','O','T','R','O'],
  4: ['T','T','O','T','T','R','O'],
  5: ['T','T','R','T','T','T','O'],
  6: ['T','T','T','R','T','T','T'],
}

function getDayType(profile) {
  // Dzień rejestracji zawsze = trening
  if (profile?.created_at) {
    const regDate = new Date(profile.created_at).toISOString().split('T')[0]
    if (regDate === TODAY) return 'T'
  }
  const days = profile?.training_days || 4
  const schedule = SCHEDULES[days] || SCHEDULES[4]
  const dow = new Date().getDay()
  const idx = dow === 0 ? 6 : dow - 1
  return schedule[idx]
}

function pickDailyTrainings(allTrainings, profile) {
  const dayType = getDayType(profile)
  const age = profile?.age || 16
  const rand = seededRandom(getDailySeed())

  if (dayType === 'O') return []

  if (dayType === 'R') {
    const pool = allTrainings.filter(t => t.category === 'recovery')
    const shuffled = [...pool].sort(() => rand() - 0.5)
    return shuffled.slice(0, 3).map(t => ({ ...t, _slot: 'recovery' }))
  }

  const mainCats = age <= 14
    ? ['shooting', 'dribbling']
    : age <= 16
    ? ['shooting', 'dribbling', 'athleticism']
    : ['shooting', 'dribbling', 'athleticism', 'strength', 'iq']

  const result = []

  // ── SESJA PORANNA: 1 ćwiczenie z conditioning/recovery, 1PKT × losowo 11-20 ──
  const morningPool = allTrainings.filter(t => ['conditioning', 'recovery'].includes(t.category))
  if (morningPool.length > 0) {
    const idx = Math.floor(rand() * morningPool.length)
    const morningMultiplier = 11 + Math.floor(rand() * 10)
    result.push({ ...morningPool[idx], _slot: 'morning', _slotLabel: 'PORANNA', _slotEmoji: '🌅', _pts: 1, _multiplier: morningMultiplier })
  }

  // ── SESJA GŁÓWNA: 1-2 ćwiczenia, min. 66% z rzutami, 2PKT × 40/30 ──
  const shootingPool = allTrainings.filter(t => t.category === 'shooting')
  const nonShootingPool = allTrainings.filter(t => mainCats.includes(t.category) && t.category !== 'shooting')

  const isShootingDay = rand() < 0.667
  const hasTwoActivities = rand() < 0.5

  function mainPts(t) { return { _pts: 2, _multiplier: (t.difficulty || 1) >= 3 ? 40 : 30 } }

  if (isShootingDay && shootingPool.length > 0) {
    const idx1 = Math.floor(rand() * shootingPool.length)
    const t1 = shootingPool[idx1]
    result.push({ ...t1, _slot: 'main', _slotLabel: 'GŁÓWNA', _slotEmoji: '🏀', ...mainPts(t1) })
    if (hasTwoActivities && nonShootingPool.length > 0) {
      const idx2 = Math.floor(rand() * nonShootingPool.length)
      const t2 = nonShootingPool[idx2]
      result.push({ ...t2, _slot: 'main', _slotLabel: 'GŁÓWNA', _slotEmoji: '🏀', ...mainPts(t2) })
    }
  } else {
    const mainPool = allTrainings.filter(t => mainCats.includes(t.category))
    if (mainPool.length > 0) {
      const idx1 = Math.floor(rand() * mainPool.length)
      const t1 = mainPool[idx1]
      result.push({ ...t1, _slot: 'main', _slotLabel: 'GŁÓWNA', _slotEmoji: '🏀', ...mainPts(t1) })
      if (hasTwoActivities && mainPool.length > 1) {
        const remaining = mainPool.filter((_, i) => i !== idx1)
        const idx2 = Math.floor(rand() * remaining.length)
        const t2 = remaining[idx2]
        result.push({ ...t2, _slot: 'main', _slotLabel: 'GŁÓWNA', _slotEmoji: '🏀', ...mainPts(t2) })
      }
    }
  }

  return result
}

// ── REPORT RATING RING — hexagonal diamond shape ────────────────────────────
// Hex outer: points="105,14 191,75 191,135 105,196 19,135 19,75" in 210×210 space
// Each half (right / left) path length ≈ 270.88 units
// Left 500 pts fills from top counter-clockwise; right 500 pts fills clockwise.
// Both halves fill simultaneously — at 1000 pts the ring is fully closed.
const HEX_HALF_LEN = 270.88

function ReportRatingRing({ score, daysLeft, loading }) {
  const isLocked = daysLeft > 0
  const fillRatio = isLocked ? 0 : Math.min(score, 1000) / 1000
  const dash = fillRatio * HEX_HALF_LEN

  const color = score >= 750 ? '#00E676' : score >= 500 ? '#7ECBFF' : score >= 250 ? '#5BB8F5' : '#6B5040'
  const ringColor = isLocked ? 'rgba(255,255,255,0.10)' : color

  return (
    <div style={{ position: 'relative', width: 210, height: 210, margin: '0 auto' }}>

      {/* SVG: inner fill + track + progress */}
      <svg width="210" height="210" viewBox="0 0 210 210"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <radialGradient id="ringFillGrad" cx="50%" cy="42%" r="58%">
            <stop offset="0%"   stopColor="rgba(10,6,3,0.82)" />
            <stop offset="100%" stopColor="rgba(3,1,0,0.97)" />
          </radialGradient>
        </defs>

        {/* Inner glass fill — 92 % scaled hex, leaves room for the ring stroke */}
        <polygon
          points="105,21 184,77 184,133 105,189 26,133 26,77"
          fill="url(#ringFillGrad)"
          stroke="rgba(255,255,255,0.10)"
          strokeWidth="1"
        />

        {/* Background track — full hexagon outline */}
        <polygon
          points="105,14 191,75 191,135 105,196 19,135 19,75"
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="8"
          strokeLinejoin="round"
        />

        {/* Right half — top → clockwise → bottom (500 pts) */}
        {!isLocked && (
          <polyline
            points="105,14 191,75 191,135 105,196"
            fill="none" stroke={ringColor} strokeWidth="8"
            strokeDasharray={`${dash} 9999`}
            strokeLinejoin="round" strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 18px ${color}70)`,
              transition: 'stroke-dasharray 1.2s ease',
            }}
          />
        )}

        {/* Left half — top → counter-clockwise → bottom (500 pts) */}
        {!isLocked && (
          <polyline
            points="105,14 19,75 19,135 105,196"
            fill="none" stroke={ringColor} strokeWidth="8"
            strokeDasharray={`${dash} 9999`}
            strokeLinejoin="round" strokeLinecap="round"
            style={{
              filter: `drop-shadow(0 0 8px ${color}) drop-shadow(0 0 18px ${color}70)`,
              transition: 'stroke-dasharray 1.2s ease',
            }}
          />
        )}
      </svg>

      {/* Center content */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 2,
      }}>
        {loading ? (
          <div className="spinner" style={{ width: 24, height: 24 }} />
        ) : isLocked ? (
          <>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-dim)" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round"
              style={{ marginBottom: 4, opacity: 0.5 }}>
              <rect x="3" y="11" width="18" height="11" rx="3"/>
              <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
            </svg>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 28, lineHeight: 1, color: 'var(--text-dim)', letterSpacing: -1 }}>
              {daysLeft}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--text-dim)', marginTop: 2 }}>
              DNI DO RAPORTU
            </span>
          </>
        ) : (
          <>
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: 62, lineHeight: 1, color, letterSpacing: '-1px', textShadow: `0 0 22px ${color}80` }}>
              {score}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--text-dim)', marginTop: 2 }}>
              PKT
            </span>
          </>
        )}
      </div>
    </div>
  )
}

// ── QUOTE PANEL ──────────────────────────────────────────────────────────────
function QuotePanel({ quote, onClose }) {
  if (!quote) return null
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(4,2,0,0.80)',
        backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 110px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          margin: '0 16px',
          background: 'rgba(12,8,4,0.95)',
          backdropFilter: 'blur(30px)', WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(91,184,245,0.20)',
          borderTop: '1px solid rgba(91,184,245,0.40)',
          borderRadius: 28,
          padding: '28px 28px 24px',
          boxShadow: '0 -4px 60px rgba(0,0,0,0.60), 0 0 40px rgba(91,184,245,0.08)',
        }}
      >
        <div style={{ width: 36, height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2, margin: '0 auto 24px' }} />
        <p style={{
          fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: 13,
          letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--orange)',
          marginBottom: 16,
        }}>Cytat dnia</p>
        <p style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700,
          fontSize: 22, lineHeight: 1.35, color: 'var(--text-primary)',
          marginBottom: 18, letterSpacing: 0.3,
        }}>
          „{quote.text}"
        </p>
        <p style={{
          color: 'var(--orange)', fontFamily: 'var(--font-display)',
          fontWeight: 600, fontSize: 13, letterSpacing: 1, marginBottom: 24,
        }}>
          — {quote.author}
        </p>
        <button className="btn-ghost" onClick={onClose} style={{ width: '100%', padding: '13px' }}>
          Zamknij
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── SLOT HEADER ──────────────────────────────────────────────────────────────
function SlotHeader({ emoji, label }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, marginTop: 20 }}>
      <span style={{ fontSize: 16 }}>{emoji}</span>
      <p className="section-label">{label}</p>
      <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.06)', borderRadius: 1 }} />
    </div>
  )
}

// ── ACHIEVEMENT TOAST ────────────────────────────────────────────────────────
function AchievementToast({ data, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000)
    return () => clearTimeout(t)
  }, [])

  const medalColors = {
    bronze:   '#CD7F32',
    silver:   '#A8A8A8',
    gold:     '#FFD700',
    diamond:  '#5BB8F5',
    platinum: '#E5E4E2',
  }
  const color = medalColors[data.stage.medal] || 'var(--orange)'

  return (
    <motion.div
      initial={{ opacity: 0, y: -90, x: '-50%' }}
      animate={{ opacity: 1, y: 0,   x: '-50%' }}
      exit={{    opacity: 0, y: -90, x: '-50%' }}
      transition={{ type: 'spring', stiffness: 340, damping: 28 }}
      style={{
        position: 'fixed', top: 20, left: '50%',
        zIndex: 1000,
        background: 'rgba(10,6,3,0.95)',
        backdropFilter: 'blur(30px)',
        WebkitBackdropFilter: 'blur(30px)',
        border: `1px solid ${color}40`,
        borderTop: `1px solid ${color}70`,
        borderRadius: 20,
        padding: '12px 18px 12px 12px',
        display: 'flex', alignItems: 'center', gap: 12,
        boxShadow: `0 8px 40px rgba(0,0,0,0.65), 0 0 24px ${color}20`,
        minWidth: 260, maxWidth: 320,
        cursor: 'pointer',
      }}
      onClick={onClose}
    >
      <img
        src={data.stage.image}
        alt={data.title}
        style={{ width: 54, height: 54, objectFit: 'contain', flexShrink: 0, filter: `drop-shadow(0 0 8px ${color}60)` }}
      />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 9, letterSpacing: 2.5, color: color, textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>
          Nowe osiągnięcie
        </p>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.1 }}>
          {data.title}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, fontWeight: 500 }}>
          {data.stage.label} odblokowany
        </p>
      </div>
    </motion.div>
  )
}

// ── REST DAY CARD ────────────────────────────────────────────────────────────
function RestDayCard() {
  return (
    <div style={{
      padding: '28px 20px', textAlign: 'center',
      background: 'rgba(8,5,2,0.55)',
      backdropFilter: 'blur(24px)',
      WebkitBackdropFilter: 'blur(24px)',
      border: '1px solid rgba(255,255,255,0.08)',
      borderTop: '1px solid rgba(255,255,255,0.14)',
      borderRadius: 'var(--radius)',
      boxShadow: '0 8px 28px rgba(0,0,0,0.40)',
    }}>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-primary)', marginBottom: 6 }}>
        Dzień odpoczynku
      </p>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.5 }}>
        Mistrzowie regenerują się tak samo serio jak trenują. Sprawdź co masz dziś do zrobienia w zakładce Regeneracja.
      </p>
    </div>
  )
}

// ── DAY DONE MODAL ───────────────────────────────────────────────────────────
function DayDoneModal({ completedCount, onClose }) {
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setWidth(100), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(6,4,2,0.75)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '0 24px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.88, y: 24 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.88, y: 24 }}
        transition={{ type: 'spring', stiffness: 320, damping: 26 }}
        style={{
          width: '100%', maxWidth: 360,
          background: 'rgba(10,6,3,0.95)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: '1px solid rgba(0,230,118,0.30)',
          borderTop: '1px solid rgba(0,230,118,0.55)',
          borderRadius: 24,
          padding: '36px 28px 28px',
          textAlign: 'center',
          boxShadow: '0 8px 40px rgba(0,0,0,0.70), 0 0 32px rgba(0,230,118,0.12)',
        }}
      >
        <p style={{ fontSize: 9, letterSpacing: 3, color: 'var(--green-shot)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>
          Dzień zaliczony
        </p>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 30, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 6 }}>
          DZIEŃ ZALICZONY
        </p>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 64, lineHeight: 1, color: 'var(--green-shot)', letterSpacing: '-3px', textShadow: '0 0 24px rgba(0,230,118,0.50)', marginBottom: 4 }}>
          {completedCount}
        </p>
        <p style={{ fontSize: 10, letterSpacing: 2.5, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 28 }}>
          SESJE
        </p>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 28 }}>
          <motion.div
            style={{ height: '100%', background: 'var(--green-shot)', borderRadius: 2, originX: 0, boxShadow: '0 0 10px rgba(0,230,118,0.60)' }}
            initial={{ width: '0%' }}
            animate={{ width: `${width}%` }}
            transition={{ duration: 1.0, ease: 'easeOut', delay: 0.2 }}
          />
        </div>

        <button
          onClick={onClose}
          style={{
            width: '100%', padding: '14px',
            background: 'rgba(0,230,118,0.12)',
            border: '1px solid rgba(0,230,118,0.35)',
            borderRadius: 12,
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14,
            letterSpacing: 2, textTransform: 'uppercase',
            color: 'var(--green-shot)',
            cursor: 'pointer',
          }}
        >
          DALEJ
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { profile, refreshProfile } = useAuth()
  const [trainings, setTrainings] = useState([])
  const [activityLog, setActivityLog] = useState(null)
  const [quote, setQuote] = useState(null)
  const [showQuote, setShowQuote] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dayType, setDayType] = useState('T')
  const [reportScore, setReportScore] = useState(0)
  const [reportLoading, setReportLoading] = useState(true)
  const [daysUntilReport, setDaysUntilReport] = useState(7)
  const [achievementToast, setAchievementToast] = useState(null) // { title, stage }
  const { setSettingsOpen } = useUI()
  const [showSettings, setShowSettings] = useState(false)

  function openSettings() { setShowSettings(true); setSettingsOpen(true) }
  function closeSettings() { setShowSettings(false); setSettingsOpen(false) }
  const swipeStartX = useRef(null)
  const swipeStartY = useRef(null)

  function notifyAchievement(data) {
    setAchievementToast(data)
  }
  const [showDayDoneModal, setShowDayDoneModal] = useState(false)
  const [streakToast,     setStreakToast]     = useState(0)   // >0 = visible, value = new streak

  useEffect(() => { loadData() }, [profile])

  async function loadData() {
    if (!profile) return

    const dt = getDayType(profile)
    setDayType(dt)

    // ── 1. Natychmiastowe dane z cache (zero opóźnienia przy ponownym wejściu) ──
    const cachedTrainings = getCache(`trainings:${TODAY}`)
    const cachedLog       = getCache(`log:${profile.id}:${TODAY}`)
    const cachedQuotes    = getCache('quotes')
    const cachedReport    = getCache(`report:${profile.id}`)

    if (cachedTrainings) {
      setTrainings(cachedTrainings)
      setLoading(false)
    }
    if (cachedLog !== null)    setActivityLog(cachedLog)
    if (cachedQuotes)          setQuote(cachedQuotes[Math.floor(Math.random() * cachedQuotes.length)])
    if (cachedReport != null)  { setReportScore(cachedReport.score); setDaysUntilReport(cachedReport.daysLeft); setReportLoading(false) }

    // ── 2. Odświeżenie w tle — wszystkie 3 startują równolegle ──
    const trainingsPromise = supabase.from('trainings').select('*').eq('is_active', true)
    const logPromise       = supabase.from('activity_log').select('*').eq('user_id', profile.id).eq('date', TODAY).maybeSingle()
    const quotesPromise    = supabase.from('quotes').select('*').eq('is_active', true)

    const { data: allTrainings } = await trainingsPromise
    if (allTrainings) {
      const picked = pickDailyTrainings(allTrainings, profile)
      setCache(`trainings:${TODAY}`, picked, 30 * 60 * 1000)  // 30 min
      setTrainings(picked)
    }
    setLoading(false)

    const [{ data: log }, { data: quotes }] = await Promise.all([logPromise, quotesPromise])
    setActivityLog(log)
    setCache(`log:${profile.id}:${TODAY}`, log, 15 * 1000)  // 15 s — zmienia się po zaznaczeniu

    if (quotes?.length) {
      setCache('quotes', quotes, 60 * 60 * 1000)  // 1 h
      setQuote(quotes[Math.floor(Math.random() * quotes.length)])
    }

    // ── 3. Weekly report ──
    const createdAt = profile.created_at ? new Date(profile.created_at) : new Date()
    const daysSinceJoin = Math.floor((new Date() - createdAt) / (1000 * 60 * 60 * 24))
    const remaining = Math.max(0, 7 - daysSinceJoin)
    setDaysUntilReport(remaining)

    const visibleWeek = Math.floor(daysSinceJoin / 7)

    if (visibleWeek >= 1) {
      const { data: existingReport } = await supabase
        .from('weekly_reports')
        .select('*')
        .eq('user_id', profile.id)
        .eq('week_number', visibleWeek)
        .single()

      if (!existingReport) {
        const { data: pointsData } = await supabase
          .from('points_log')
          .select('points')
          .eq('user_id', profile.id)
          .eq('week_number', visibleWeek)

        const total = (pointsData || []).reduce((sum, r) => sum + r.points, 0)
        await supabase.from('weekly_reports').upsert({
          user_id: profile.id,
          week_number: visibleWeek,
          total_points: total,
          revealed_at: new Date().toISOString(),
        })
        setCache(`report:${profile.id}`, { score: total, daysLeft: remaining }, 10 * 60 * 1000)
        setReportScore(total)
      } else {
        setCache(`report:${profile.id}`, { score: existingReport.total_points, daysLeft: remaining }, 10 * 60 * 1000)
        setReportScore(existingReport.total_points)
      }
    }

    setReportLoading(false)
  }

  async function markTrainingDone(trainingId) {
    if (!profile) return
    bustCache(`log:${profile.id}:${TODAY}`)  // unieważnij cache — dane się zmieniają

    // Zawsze czytaj świeże dane z DB żeby uniknąć stale state
    const { data: freshLog } = await supabase
      .from('activity_log')
      .select('*')
      .eq('user_id', profile.id)
      .eq('date', TODAY)
      .maybeSingle()

    const prevCompleted = freshLog?.trainings_completed || []
    if (prevCompleted.includes(trainingId)) return   // już zaliczone

    const newCompleted = [...prevCompleted, trainingId]
    const allDone = newCompleted.length >= trainings.length

    // Upsert — działa niezależnie czy wiersz istnieje czy nie
    const { data: savedLog, error: logErr } = await supabase
      .from('activity_log')
      .upsert(
        { user_id: profile.id, date: TODAY, trainings_completed: newCompleted, all_done: allDone },
        { onConflict: 'user_id,date' }
      )
      .select()
      .single()

    if (logErr) console.error('[activity_log upsert error]', logErr)

    setActivityLog(savedLog ?? { ...(freshLog || {}), user_id: profile.id, date: TODAY, trainings_completed: newCompleted, all_done: allDone })

    // ── Streak: zawsze pobierz świeży profil z DB, bez stale closure ──
    const { data: freshProfile, error: fpErr } = await supabase
      .from('profiles')
      .select('streak, longest_streak, last_active')
      .eq('id', profile.id)
      .single()

    const lastActiveDate = (freshProfile?.last_active || '').slice(0, 10)
    const alreadyCredited = lastActiveDate === TODAY

    if (!alreadyCredited) {
      const newStreak = (freshProfile?.streak || 0) + 1
      const { error: strErr } = await supabase
        .from('profiles')
        .update({
          streak:         newStreak,
          longest_streak: Math.max(newStreak, freshProfile?.longest_streak || 0),
          last_active:    TODAY,
        })
        .eq('id', profile.id)

      if (!strErr) {
        await refreshProfile()
        setStreakToast(newStreak)
      }
    }

    const training = trainings.find(t => t.id === trainingId)
    const points = (training?._pts || 1) * (training?._multiplier || 1)
    const daysSinceJoin = Math.floor((new Date() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24))
    const weekNumber = Math.floor(daysSinceJoin / 7) + 1
    await supabase.from('points_log').insert({
      user_id: profile.id,
      training_id: trainingId,
      points,
      week_number: weekNumber,
      date: TODAY,
    })

    if (allDone) setShowDayDoneModal(true)
    // Defer achievement check — nie blokuje UI po ukończeniu ćwiczenia
    setTimeout(() => checkAchievements(trainingId, allDone), 0)
  }

  async function unmarkTrainingDone(trainingId) {
    if (!profile || !activityLog) return
    bustCache(`log:${profile.id}:${TODAY}`)  // unieważnij cache
    const completed = activityLog.trainings_completed || []
    if (!completed.includes(trainingId)) return
    const newCompleted = completed.filter(id => id !== trainingId)

    await Promise.all([
      // Usuń z activity_log
      supabase.from('activity_log')
        .update({ trainings_completed: newCompleted, all_done: false })
        .eq('id', activityLog.id),
      // Usuń punkty
      supabase.from('points_log')
        .delete()
        .eq('user_id', profile.id)
        .eq('training_id', trainingId)
        .eq('date', TODAY),
      // Usuń sesję rzutową z dzisiejszego dnia (jeśli istnieje)
      supabase.from('shooting_sessions')
        .delete()
        .eq('user_id', profile.id)
        .eq('training_id', trainingId)
        .eq('session_date', TODAY),
    ])

    setActivityLog(prev => ({ ...prev, trainings_completed: newCompleted, all_done: false }))

    // ── Cofnij serię jeśli to był jedyny trening dziś i brak recovery ──
    const { data: freshProfile } = await supabase
      .from('profiles')
      .select('streak, last_active')
      .eq('id', profile.id)
      .single()

    const lastActiveDate = (freshProfile?.last_active || '').slice(0, 10)
    if (newCompleted.length === 0 && lastActiveDate === TODAY) {
      // Sprawdź czy są jakieś aktywności recovery dziś
      const { data: recoveryToday } = await supabase
        .from('recovery_log')
        .select('id')
        .eq('user_id', profile.id)
        .eq('date', TODAY)
        .limit(1)

      if (!recoveryToday?.length) {
        // Żadnych aktywności dziś — cofnij serię
        const newStreak = Math.max(0, (freshProfile.streak || 0) - 1)
        await supabase.from('profiles').update({
          streak:      newStreak,
          last_active: null,
        }).eq('id', profile.id)
        await refreshProfile()
      }
    }

    // Cofnij wszystkie staged achievements które nie są już zasłużone
    await revokeStaleAchievements(profile.id)
  }

  // ── Sprawdź czy odblokowano nowe osiągnięcie ─────────────────────────────
  async function checkAchievements(completedTrainingId, newAllDone) {
    if (!profile) return

    const daysSinceJoin = Math.floor((new Date() - new Date(profile.created_at)) / (1000 * 60 * 60 * 24))
    const weekNumber = Math.floor(daysSinceJoin / 7) + 1

    const [
      catalog,
      { data: logs },
      { data: recoveryTrainings },
      { data: shootingTrainings },
      { data: unlockedAchievements },
    ] = await Promise.all([
      fetchAchievementsCatalog(),
      supabase.from('activity_log').select('trainings_completed, all_done, date').eq('user_id', profile.id),
      supabase.from('trainings').select('id').in('category', ['recovery', 'conditioning']),
      supabase.from('trainings').select('id').eq('category', 'shooting'),
      supabase.from('user_achievements').select('achievement_id').eq('user_id', profile.id),
    ])

    const unlockedIds = new Set((unlockedAchievements || []).map(a => a.achievement_id))
    const recoveryIds = new Set((recoveryTrainings || []).map(t => t.id))
    const shootingIds = new Set((shootingTrainings || []).map(t => t.id))

    function countUnlocks(baseId) {
      // Liczy tylko rekordy repeatable: goat_1, goat_2, early_bird_2026-04-12 itp.
      // NIE liczy staged (regeneracja_bronze) bo te mają medal jako suffix
      return [...unlockedIds].filter(id => {
        if (!id.startsWith(`${baseId}_`)) return false
        const suffix = id.slice(baseId.length + 1)
        // repeatable z licznikiem: suffix to cyfra (goat_1)
        // repeatable z datą: suffix to data (early_bird_2026-04-12)
        // staged: suffix to medal (regeneracja_bronze) — pomijamy
        return /^\d+$/.test(suffix) || /^\d{4}-\d{2}-\d{2}$/.test(suffix)
      }).length
    }

    async function addUnlock(baseId) {
      const ach = catalog.find(a => a.id === baseId)
      if (!ach) return
      const n = countUnlocks(baseId) + 1
      await supabase.from('user_achievements').insert({
        user_id: profile.id,
        achievement_id: `${baseId}_${n}`,
        base_id: baseId,
      })
      const stage = (ach.stages || [])[0]
      notifyAchievement({ title: ach.title, stage })
      if (stage?.medal) await awardMedalPoints(profile.id, stage.medal, weekNumber)
    }

    // ── Stage achievements (regeneracja, allday) ──
    let recoveryCount = 0
    let allDayCount = 0
    let totalTrainingsCount = 0
    let shootingSessionsCount = 0
    for (const log of (logs || [])) {
      if (log.all_done) allDayCount++
      for (const tid of (log.trainings_completed || [])) {
        if (recoveryIds.has(tid)) recoveryCount++
        if (shootingIds.has(tid)) shootingSessionsCount++
        totalTrainingsCount++
      }
    }
    const stageProgress = { regeneracja: recoveryCount, allday: allDayCount, the_grind: totalTrainingsCount, shooting_sessions: shootingSessionsCount }
    for (const achievement of catalog.filter(a => a.type === 'staged')) {
      const count = stageProgress[achievement.id] || 0
      for (const stage of (achievement.stages || [])) {
        const stageKey = `${achievement.id}_${stage.medal}`
        if (count >= stage.threshold && !unlockedIds.has(stageKey)) {
          await supabase.from('user_achievements').insert({
            user_id: profile.id,
            achievement_id: stageKey,
            base_id: achievement.id,
          })
          notifyAchievement({ title: achievement.title, stage })
          await awardMedalPoints(profile.id, stage.medal, weekNumber)
          break
        }
      }
    }

    // ── Repeatable achievements powiązane z konkretnym treningiem ──
    for (const achievement of catalog.filter(a => a.type === 'repeatable' && a.training_id)) {
      if (completedTrainingId !== achievement.training_id) continue
      const completions = (logs || []).reduce((acc, log) =>
        acc + (log.trainings_completed || []).filter(id => id === achievement.training_id).length, 0)
      const everyN = achievement.threshold || 1
      const target = Math.floor(completions / everyN)
      const current = countUnlocks(achievement.id)
      if (target > current) {
        for (let i = current + 1; i <= target; i++) {
          await addUnlock(achievement.id)
        }
      }
    }

    // ── Comeback (raz w życiu, po 7+ dniach nieaktywności) ──
    if (!unlockedIds.has('comeback_1')) {
      const previousLogs = [...(logs || [])]
        .filter(l => l.date < TODAY && (l.trainings_completed || []).length > 0)
        .sort((a, b) => new Date(b.date) - new Date(a.date))
      if (previousLogs.length > 0) {
        const daysSinceLast = Math.floor(
          (new Date(TODAY) - new Date(previousLogs[0].date)) / (1000 * 60 * 60 * 24)
        )
        if (daysSinceLast >= 14) {
          const ach = catalog.find(a => a.id === 'comeback')
          if (ach) {
            await supabase.from('user_achievements').insert({
              user_id: profile.id,
              achievement_id: 'comeback_1',
              base_id: 'comeback',
            })
            const comebackStage = (ach.stages || [])[0]
            notifyAchievement({ title: ach.title, stage: comebackStage })
            if (comebackStage?.medal) await awardMedalPoints(profile.id, comebackStage.medal, weekNumber)
          }
        }
      }
    }

    // ── Early Bird (jedno na dzień, przed 7:00) ──
    if (new Date().getHours() < 7) {
      const dateKey = `early_bird_${TODAY}`
      if (!unlockedIds.has(dateKey)) {
        const ach = catalog.find(a => a.id === 'early_bird')
        if (ach) {
          await supabase.from('user_achievements').insert({
            user_id: profile.id,
            achievement_id: dateKey,
            base_id: 'early_bird',
          })
          const earlyStage = (ach.stages || [])[0]
          notifyAchievement({ title: ach.title, stage: earlyStage })
          if (earlyStage?.medal) await awardMedalPoints(profile.id, earlyStage.medal, weekNumber)
        }
      }
    }

    // ── Elastyczna Stal (jedno na dzień, gdy warunek spełniony) ──
    if (newAllDone) {
      const sortedLogs = [...(logs || [])].sort((a, b) => new Date(b.date) - new Date(a.date))
      const yesterday = sortedLogs[1]
      if (yesterday?.all_done) {
        const todayHasRecovery = (activityLog?.trainings_completed || []).some(id => recoveryIds.has(id))
        const yesterdayHasRecovery = (yesterday.trainings_completed || []).some(id => recoveryIds.has(id))
        if (todayHasRecovery && !yesterdayHasRecovery) {
          const dateKey = `elastyczna_stal_${TODAY}`
          if (!unlockedIds.has(dateKey)) {
            const ach = catalog.find(a => a.id === 'elastyczna_stal')
            if (ach) {
              await supabase.from('user_achievements').insert({
                user_id: profile.id,
                achievement_id: dateKey,
                base_id: 'elastyczna_stal',
              })
              const stalStage = (ach.stages || [])[0]
              notifyAchievement({ title: ach.title, stage: stalStage })
              if (stalStage?.medal) await awardMedalPoints(profile.id, stalStage.medal, weekNumber)
            }
          }
        }
      }
    }

    // ── Oblicz serię ──
    if (newAllDone) {
      const doneLogs = [...(logs || [])].filter(l => l.all_done).sort((a, b) => new Date(b.date) - new Date(a.date))
      let streak = 0
      let cursor = new Date(TODAY)
      for (const log of doneLogs) {
        const cursorStr = cursor.toISOString().split('T')[0]
        if (log.date === cursorStr) { streak++; cursor.setDate(cursor.getDate() - 1) }
        else break
      }

      // ── Dyscyplina (co 7 dni serii) ──
      const dyscTarget = Math.floor(streak / 7)
      const dyscCurrent = countUnlocks('dyscyplina')
      for (let i = dyscCurrent; i < dyscTarget; i++) await addUnlock('dyscyplina')

      // ── Man of the Month (co 30 dni serii) ──
      const motmTarget = Math.floor(streak / 30)
      const motmCurrent = countUnlocks('man_of_the_month')
      for (let i = motmCurrent; i < motmTarget; i++) await addUnlock('man_of_the_month')
    }
  }

  const completed = activityLog?.trainings_completed || []
  const progress = trainings.length > 0 ? (completed.length / trainings.length) * 100 : 0


  const greeting = profile?.name ? `Cześć, ${profile.name}` : 'Dzisiaj'
  const dateStr = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })

  const slots = [
    { key: 'morning',  label: 'SESJA PORANNA',  emoji: '🌅' },
    { key: 'main',     label: 'SESJA GŁÓWNA',   emoji: '🏀' },
    { key: 'recovery', label: 'REGENERACJA',    emoji: '🧘' },
  ]

  const scoreColor = reportScore >= 750 ? 'var(--green-shot)' : reportScore >= 500 ? 'var(--orange-hot)' : reportScore >= 250 ? 'var(--orange)' : 'var(--text-dim)'
  const scoreLabel = reportScore >= 750 ? 'ŚWIETNA REGULARNOŚĆ' : reportScore >= 500 ? 'DOBRY POSTĘP' : reportScore >= 250 ? 'ZACZNIJ SERIĘ' : 'TRENUJESZ?'

  function handleTouchStart(e) {
    const t = e.touches[0]
    swipeStartX.current = t.clientX
    swipeStartY.current = t.clientY
  }

  function handleTouchEnd(e) {
    if (swipeStartX.current === null) return
    const t = e.changedTouches[0]
    const dx = t.clientX - swipeStartX.current
    const dy = Math.abs(t.clientY - swipeStartY.current)
    // swipe right z lewej połowy ekranu otwiera ustawienia
    if (swipeStartX.current < window.innerWidth * 0.55 && dx >= 70 && dy < 70) {
      openSettings()
    }
    swipeStartX.current = null
    swipeStartY.current = null
  }

  return (
    <div
      className="page-content"
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      <SettingsPanel open={showSettings} onClose={closeSettings} />
      <AnimatePresence>{showQuote && <QuotePanel quote={quote} onClose={() => setShowQuote(false)} />}</AnimatePresence>
      <AnimatePresence>
        {achievementToast && (
          <AchievementToast data={achievementToast} onClose={() => setAchievementToast(null)} />
        )}
      </AnimatePresence>
      <AnimatePresence>
        {showDayDoneModal && (
          <DayDoneModal completedCount={completed.length} onClose={() => setShowDayDoneModal(false)} />
        )}
      </AnimatePresence>
      <StreakToast streak={streakToast} visible={streakToast > 0} onHide={() => setStreakToast(0)} />

      {/* Header */}
      <div style={{ padding: '32px 22px 0', display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p className="section-label">{dateStr}</p>
          <h1 className="display-title" style={{ fontSize: 28, marginTop: 4 }}>{greeting}</h1>
          {dayType !== 'T' && (
            <span className={`badge ${dayType === 'R' ? 'badge-green' : 'badge-gray'}`} style={{ marginTop: 6, display: 'inline-flex' }}>
              {dayType === 'R' ? '🧘 Regeneracja' : '😴 Odpoczynek'}
            </span>
          )}
        </div>
        <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
          <button onClick={openSettings} style={{
            background: 'none', border: 'none',
            width: 40, height: 40, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0.55, transition: 'opacity 0.18s',
          }}
            onTouchStart={e => e.currentTarget.style.opacity = '1'}
            onTouchEnd={e => e.currentTarget.style.opacity = '0.55'}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.90)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
          </button>
          <button onClick={() => setShowQuote(true)} style={{
            background: 'none', border: 'none',
            width: 40, height: 40, cursor: 'pointer',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            opacity: 0.55, transition: 'opacity 0.18s',
          }}
            onTouchStart={e => e.currentTarget.style.opacity = '1'}
            onTouchEnd={e => e.currentTarget.style.opacity = '0.55'}
          >
            <span style={{ fontSize: 18, lineHeight: 1, color: 'rgba(255,255,255,0.90)' }}>✦</span>
          </button>
        </div>
      </div>

      {/* Ocena Raportu */}
      <div style={{ padding: '24px 22px 4px' }}>
        {/* Label + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p className="section-label" style={{ marginBottom: 2 }}>{daysUntilReport === 0 ? 'Draft Score' : 'Twój Raport Scoutingowy'}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              Twój postęp
            </p>
          </div>
          {!daysUntilReport && !reportLoading && (
            <span style={{
              padding: '4px 12px',
              background: `${scoreColor}18`,
              border: `1px solid ${scoreColor}40`,
              borderRadius: 'var(--radius-full)',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10,
              color: scoreColor, letterSpacing: 1.5, textTransform: 'uppercase',
            }}>{scoreLabel}</span>
          )}
        </div>

        <ReportRatingRing
          score={reportScore}
          daysLeft={daysUntilReport}
          loading={reportLoading}
        />

        {/* Info below ring */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {daysUntilReport > 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.6 }}>
              Twój pierwszy raport będzie gotowy za{' '}
              <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{daysUntilReport} {daysUntilReport === 1 ? 'dzień' : 'dni'}</span>.
              <br />Im więcej trenujesz teraz, tym wyższy wynik.
            </p>
          ) : (
            <>
              <div style={{ width: '70%', margin: '0 auto 10px', height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <motion.div style={{ height: '100%', background: scoreColor, borderRadius: 2, originX: 0 }}
                  animate={{ width: `${progress}%` }} transition={{ duration: 0.8, ease: 'easeOut' }} />
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>
                {completed.length} / {trainings.length} SESJI UKOŃCZONYCH DZIŚ
              </span>
              {activityLog?.all_done && !showDayDoneModal && (
                <div style={{ marginTop: 8 }}><span className="badge badge-green">✓ Dzień zaliczony</span></div>
              )}
            </>
          )}
        </div>

      </div>


      <hr className="divider" style={{ margin: '12px 22px' }} />

      {/* Training sessions */}
      <div style={{ padding: '8px 22px 28px' }}>
        {loading ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}><div className="spinner" /></div>
        ) : dayType === 'O' ? (
          <RestDayCard />
        ) : (
          <>
            {slots.map(slot => {
              const slotTrainings = trainings.filter(t => t._slot === slot.key)
              if (slotTrainings.length === 0) return null
              return (
                <div key={slot.key}>
                  <SlotHeader emoji={slot.emoji} label={slot.label} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {slotTrainings.map(t => (
                      <TrainingCard
                        key={t.id}
                        training={t}
                        done={completed.includes(t.id)}
                        onDone={() => markTrainingDone(t.id)}
                        onUndo={() => unmarkTrainingDone(t.id)}
                      />
                    ))}
                  </div>
                </div>
              )
            })}
          </>
        )}
      </div>
    </div>
  )
}
