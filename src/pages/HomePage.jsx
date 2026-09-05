import { useState, useEffect, useRef, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useMotionValue, useTransform, animate as fmAnimate } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { onTableChange } from '../lib/realtimeManager'
import TrainingCard from '../components/training/TrainingCard'
import { fetchAchievementsCatalog, awardMedalPoints, revokeStaleAchievements } from '../lib/achievements'
import SettingsPanel from '../components/ui/SettingsPanel'
import { useAutoCity } from '../hooks/useAutoCity'
import LeagueInfoPanel from '../components/ui/LeagueInfoPanel'
import { useUI } from '../context/UIContext'
import StreakToast from '../components/ui/StreakToast'
import { nextStreakValue } from '../lib/streak'
import { getCache, setCache, bustCache } from '../lib/queryCache'
import { pGet, pSet } from '../lib/persistentCache'
import { useNotifications } from '../context/NotificationsContext'
import { useTodayTeamPractice } from '../hooks/useTodayTeamPractice'
import { calendarWeekNumber, startOfCalendarWeek } from '../lib/week'
import TeamPracticeCard from '../components/training/TeamPracticeCard'

const ArenaRoad = lazy(() => import('../components/ArenaRoad'))

const TODAY = new Date().toISOString().split('T')[0]

// Seed = data + hash(user_id). Dzięki temu losowanie jest:
// - deterministyczne dla danego usera w danym dniu (refresh = ten sam set)
// - UNIKALNE per user (różni gracze dostają różne treningi tego samego dnia)
// Przedtem seed był sam dzień → wszyscy widzieli identyczne 3 ćwiczenia.
function hashStr(str) {
  if (!str) return 0
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i)
  }
  return h & 0x7fffffff
}
function getDailySeed(userId) {
  const d = new Date()
  const dateSeed = d.getFullYear() * 10000 + (d.getMonth() + 1) * 100 + d.getDate()
  return (dateSeed ^ hashStr(userId || '')) >>> 0
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
  // Pierwsze 2 dni po rejestracji ZAWSZE = trening (onboarding engagement).
  // Bez tego nowy user mógłby trafić na "off day" zaraz po rejestracji.
  if (profile?.created_at) {
    const created = new Date(profile.created_at)
    const now = new Date()
    const daysSince = Math.floor(
      (Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()) -
       Date.UTC(created.getUTCFullYear(), created.getUTCMonth(), created.getUTCDate())) /
      (1000 * 60 * 60 * 24)
    )
    if (daysSince <= 1) return 'T'
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
  const rand = seededRandom(getDailySeed(profile?.id))

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

  // ── SESJA GŁÓWNA ──
  // Każdy dzień:  1 main + 1 recovery_post (cooldown)
  // W 33% dni:    2 main + 1 recovery_post (3 karty)
  // Main: 66% szans że pierwszy jest shooting. 2PKT × 40/30 wg difficulty.
  // Recovery_post: 1PKT × 11-20 (lekka motywacja do cooldownu, nie main reward).
  const shootingPool    = allTrainings.filter(t => t.category === 'shooting')
  const nonShootingPool = allTrainings.filter(t => mainCats.includes(t.category) && t.category !== 'shooting')
  const mainPool        = allTrainings.filter(t => mainCats.includes(t.category))
  const cooldownPool    = allTrainings.filter(t => t.category === 'recovery_post')

  const isShootingDay = rand() < 0.667
  const hasTwoMains   = rand() < 0.333         // ~33% dni dostaje 2 maina

  function mainPts(t) { return { _pts: 2, _multiplier: (t.difficulty || 1) >= 3 ? 40 : 30 } }

  // 1) Pierwszy main
  if (isShootingDay && shootingPool.length > 0) {
    const t1 = shootingPool[Math.floor(rand() * shootingPool.length)]
    result.push({ ...t1, _slot: 'main', _slotLabel: 'GŁÓWNA', _slotEmoji: '🏀', ...mainPts(t1) })
    // 2) Opcjonalny drugi main (25% szans) — preferuj non-shooting dla różnorodności
    if (hasTwoMains && nonShootingPool.length > 0) {
      const t2 = nonShootingPool[Math.floor(rand() * nonShootingPool.length)]
      result.push({ ...t2, _slot: 'main', _slotLabel: 'GŁÓWNA', _slotEmoji: '🏀', ...mainPts(t2) })
    }
  } else if (mainPool.length > 0) {
    const idx1 = Math.floor(rand() * mainPool.length)
    const t1 = mainPool[idx1]
    result.push({ ...t1, _slot: 'main', _slotLabel: 'GŁÓWNA', _slotEmoji: '🏀', ...mainPts(t1) })
    if (hasTwoMains && mainPool.length > 1) {
      const remaining = mainPool.filter((_, i) => i !== idx1)
      const t2 = remaining[Math.floor(rand() * remaining.length)]
      result.push({ ...t2, _slot: 'main', _slotLabel: 'GŁÓWNA', _slotEmoji: '🏀', ...mainPts(t2) })
    }
  }

  // 3) Cooldown — część sesji głównej. Renderuje się pod tym samym nagłówkiem
  //    co main, ale logicznie wie czym jest (przyda się przy punktach/UI).
  //    Punkty 2pkt × niskim mnożnikiem — niższy reward ale wciąż "główny".
  if (cooldownPool.length > 0 && result.some(r => r._slot === 'main')) {
    const cd = cooldownPool[Math.floor(rand() * cooldownPool.length)]
    result.push({ ...cd, _slot: 'main', _slotLabel: 'GŁÓWNA', _slotEmoji: '🏀', _isCooldown: true, _pts: 2, _multiplier: 20 })
  }

  return result
}

// ── REPORT RATING RING — hexagonal diamond shape ────────────────────────────
// Channel (progress track, background): hexagon, pointy-top, center (105,105)
// points="105,23 180.27,65.47 180.27,144.53 105,184.06 29.73,144.53 29.73,65.47"
// Progress bar polylines are scaled ~1.0125x outward from the same center
// (points="105,22 181.21,64.98 181.21,145.02 105,185.04 28.79,145.02 28.79,64.98",
// strokeWidth 13) so the thicker bar grows outward only, beyond the track.
// Each "half" ≈ 250.5 × 1.0125 ≈ 253.8.
// Left 500 pts fills from top counter-clockwise; right 500 pts fills clockwise.
// Both halves fill simultaneously — at 1000 pts the ring is fully closed.
const HEX_HALF_LEN = 254

// Kolor paska postępu per arena — nadpisuje kolor zależny od wyniku.
// idx 0 = Playground, 1 = Street Court (miedziano-pomarańczowy), 2 = Sól tej Ziemi (leśna zieleń),
// 3 = (placeholder — do ustalenia razem z grafiką arena3frame), 4 = (placeholder), 5 = (placeholder — arena5frame)
const ARENA_RING_COLOR = ['#8899CC', '#D2772E', '#27943F', '#C8A27A', '#7B5CFA', '#A855F7', '#4DA7EA']

// Pasek świeci niezależnie od wyniku (ignoruje próg ARENA_GOLD_THRESHOLD) — idx 6
const ARENA_BAR_ALWAYS_SHIMMER = [false, false, false, false, false, false, true]

// Wynik punktowy dostaje efekt .score-shimmer — domyślnie tak, idx 6 = nie (połysk tylko na pasku)
const ARENA_SCORE_SHIMMER = [true, true, true, true, true, true, false]

// Gradient "galaxy" dla paska postępu (stałe, niezależne od isGoldTier) — idx 4 (fioletowo-granatowy z fioletowym połyskiem)
const ARENA_BAR_GRADIENT = [null, null, null, null, ['#2A1B6B', '#6A4FE0', '#B89CFF', '#6A4FE0', '#2A1B6B'], null, null]

// Szerokość paska postępu (strokeWidth) per arena — domyślnie 13, idx 4 = węższy
const ARENA_BAR_WIDTH = [13, 13, 13, 13, 10, 13, 13]

// Kolor "połysku" (mieszany z barColor przy isGoldTier) — domyślnie biały, idx 3 = złoty
const ARENA_SHIMMER_COLOR = ['#FFFFFF', '#FFFFFF', '#FFFFFF', '#FFD700', '#FFFFFF', '#FFFFFF', '#89CFF0']

// Gradient dla wyniku punktowego (ten sam motyw co pasek postępu) — per arena.
// Środkowy jaśniejszy stop = przesuwający się "połysk" (animacja .score-shimmer)
const ARENA_SCORE_GRADIENT = [
  'linear-gradient(100deg, #8899CC 20%, #E2E8FF 50%, #8899CC 80%)',
  'linear-gradient(100deg, #D2772E 20%, #FFE0B0 50%, #D2772E 80%)',
  'linear-gradient(100deg, #27943F 20%, #7FD494 50%, #27943F 80%)',
  'linear-gradient(100deg, #C8A27A 20%, #FFD700 50%, #C8A27A 80%)',
  'linear-gradient(100deg, #2A1B6B 0%, #6A4FE0 35%, #B89CFF 50%, #6A4FE0 65%, #2A1B6B 100%)',
  'linear-gradient(100deg, #A855F7 20%, #E0BFFF 50%, #A855F7 80%)',
  'linear-gradient(100deg, #C9D6FF 20%, #F4F8FF 50%, #C9D6FF 80%)',
]

// Mieszanie kolorów hex (t=0 → a, t=1 → b) — używane do przejścia paska w złoto od 600 pkt
function mixHex(a, b, t) {
  const pa = parseInt(a.slice(1), 16), pb = parseInt(b.slice(1), 16)
  const ar = (pa >> 16) & 255, ag = (pa >> 8) & 255, ab = pa & 255
  const br = (pb >> 16) & 255, bg = (pb >> 8) & 255, bb = pb & 255
  const r = Math.round(ar + (br - ar) * t)
  const g = Math.round(ag + (bg - ag) * t)
  const b2 = Math.round(ab + (bb - ab) * t)
  return `#${((1 << 24) + (r << 16) + (g << 8) + b2).toString(16).slice(1)}`
}
const GOLD_THRESHOLD = 600
// Próg połysku per arena (nadpisuje GOLD_THRESHOLD) — idx 2 = Sól tej Ziemi
const ARENA_GOLD_THRESHOLD = [GOLD_THRESHOLD, GOLD_THRESHOLD, 400, GOLD_THRESHOLD, GOLD_THRESHOLD, 400, GOLD_THRESHOLD]

// Efekt paska po przekroczeniu progu połysku — 'shimmer' (przesuwający się gradient) lub 'pulse' (pulsująca poświata)
const ARENA_BAR_EFFECT = ['shimmer', 'shimmer', 'shimmer', 'shimmer', 'shimmer', 'shimmer', 'shimmer']

// Skala szerokości hexagonu paska postępu per arena (1 = bez zmian) — idx 2 = Sól tej Ziemi (węższy)
const ARENA_HEX_SCALE_X = [1, 1, 0.93, 0.95, 0.93, 1, 1]

// Przesunięcie czubka górnego hexagonu w górę (px) per arena — idx 3 = lekko wyciągnięty
const ARENA_HEX_TOP_SHIFT = [0, 0, 0, 4, 4, 0, 0]

// DEV: areny dostępne w podglądzie strzałkami (tylko te z gotową grafiką)
const DEV_PREVIEW_LEVELS = [1, 2, 3, 4, 5, 6]

// Skaluje współrzędne X punktów polygon/polyline wokół środka cx (Y bez zmian)
function scalePointsX(points, cx, scaleX) {
  if (scaleX === 1) return points
  return points
    .split(' ')
    .map(pair => {
      const [x, y] = pair.split(',').map(Number)
      return `${(cx + (x - cx) * scaleX).toFixed(2)},${y}`
    })
    .join(' ')
}

// Przesuwa w górę (Y - shift) punkty leżące na czubku (najmniejszy Y) hexagonu
function shiftTopY(points, shift) {
  if (!shift) return points
  const parsed = points.split(' ').map(pair => pair.split(',').map(Number))
  const topY = Math.min(...parsed.map(([, y]) => y))
  return parsed
    .map(([x, y]) => `${x},${(y === topY ? y - shift : y).toFixed(2)}`)
    .join(' ')
}

function ReportRatingRing({ score, daysLeft, loading, arenaLevel = 0, devPreviewLevel, setDevPreviewLevel }) {
  const { t } = useTranslation('home')
  const isLocked = daysLeft > 0
  const fillRatio = isLocked ? 0 : Math.min(score, 1000) / 1000
  const dash = fillRatio * HEX_HALF_LEN

  // DEV (tylko buildy dev — wycinane z produkcji): podgląd ramy strzałkami, niezależnie od profile.arena_level
  const isDev = import.meta.env.DEV
  const previewLevel = isDev ? devPreviewLevel : arenaLevel

  const scoreColor = score >= 750 ? '#00E676' : score >= 500 ? '#7ECBFF' : score >= 250 ? '#5BB8F5' : '#6B5040'
  const color = ARENA_RING_COLOR[previewLevel] ?? scoreColor
  const scoreGradient = ARENA_SCORE_GRADIENT[previewLevel] ?? `linear-gradient(135deg, ${scoreColor}, ${scoreColor})`

  // Pasek dostaje efekt od progu ustalonego per arena (bez zmiany koloru)
  const isGoldTier = !isLocked && (ARENA_BAR_ALWAYS_SHIMMER[previewLevel] || score >= (ARENA_GOLD_THRESHOLD[previewLevel] ?? GOLD_THRESHOLD))
  const barEffect = ARENA_BAR_EFFECT[previewLevel] ?? 'shimmer'
  const useShimmer = isGoldTier && barEffect === 'shimmer'
  const usePulse = isGoldTier && barEffect === 'pulse'
  const barColor = color
  const ringColor = isLocked ? 'rgba(255,255,255,0.10)' : barColor
  const galaxyColors = !isLocked ? ARENA_BAR_GRADIENT[previewLevel] : null
  const barWidth = ARENA_BAR_WIDTH[previewLevel] ?? 13

  // Per-arena szerokość hexagonu (boki bliżej/dalej środka, bez zmiany Y)
  const hexScaleX = ARENA_HEX_SCALE_X[previewLevel] ?? 1
  const topShift = ARENA_HEX_TOP_SHIFT[previewLevel] ?? 0
  const trackPoints = shiftTopY(scalePointsX('105,23 180.27,65.47 180.27,144.53 105,184.06 29.73,144.53 29.73,65.47', 105, hexScaleX), topShift)
  const rightBarPoints = shiftTopY(scalePointsX('105,22 181.21,64.98 181.21,145.02 105,185.04', 105, hexScaleX), topShift)
  const leftBarPoints = shiftTopY(scalePointsX('105,22 28.79,64.98 28.79,145.02 105,185.04', 105, hexScaleX), topShift)

  // Preload arena graphic — sprawdza realne zdekodowanie obrazu (dev server
  // zwraca 200/HTML dla nieistniejących plików, więc samo onError na <image> nie wystarcza)
  const [arenaImgOk, setArenaImgOk] = useState(false)
  useEffect(() => {
    setArenaImgOk(false)
    const img = new Image()
    img.onload  = () => setArenaImgOk(true)
    img.onerror = () => setArenaImgOk(false)
    img.src = `/arenas/arena-${previewLevel}.png`
    return () => { img.onload = null; img.onerror = null }
  }, [previewLevel])

  return (
    <div style={{ position: 'relative', width: 210, height: 210, margin: '0 auto' }}>

      {/* SVG: inner fill + frame + progress */}
      <svg width="210" height="210" viewBox="0 0 210 210"
        style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
        <defs>
          <radialGradient id="ringFillGrad" cx="50%" cy="42%" r="58%">
            <stop offset="0%"   stopColor="rgba(10,6,3,0.82)" />
            <stop offset="100%" stopColor="rgba(3,1,0,0.97)" />
          </radialGradient>
          {useShimmer && (
            <linearGradient id="barShimmerGrad" x1="0" y1="0" x2="1" y2="0">
              <stop offset="0%"   stopColor={barColor} />
              <stop offset="40%"  stopColor={barColor} />
              <stop offset="50%"  stopColor={mixHex(barColor, ARENA_SHIMMER_COLOR[previewLevel] ?? '#FFFFFF', 0.4)} />
              <stop offset="60%"  stopColor={barColor} />
              <stop offset="100%" stopColor={barColor} />
              <animateTransform attributeName="gradientTransform" type="translate"
                from="-1 0" to="1 0" dur="6s" repeatCount="indefinite" />
            </linearGradient>
          )}
          {galaxyColors && (
            <linearGradient id="barGalaxyGrad" x1="0" y1="0" x2="1" y2="0">
              {galaxyColors.map((c, i) => (
                <stop key={i} offset={`${(i / (galaxyColors.length - 1)) * 100}%`} stopColor={c} />
              ))}
              <animateTransform attributeName="gradientTransform" type="translate"
                from="0 0" to="-1 0" dur="8s" repeatCount="indefinite" />
            </linearGradient>
          )}
        </defs>

        {/* Inner glass fill — fallback gdy nie ma grafiki ramy (regularny hexagon, R≈59) */}
        {!arenaImgOk && (
          <polygon
            points="105,46 156.1,75.5 156.1,134.5 105,164 53.9,134.5 53.9,75.5"
            fill="url(#ringFillGrad)"
            stroke="rgba(255,255,255,0.10)"
            strokeWidth="1"
          />
        )}

        {/* Background track — kanał w ramie (boki nieco bliżej siebie, szczyt wyżej) */}
        <polygon
          points={trackPoints}
          fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="11"
          strokeLinejoin="round"
        />

        {/* Right half — top → clockwise → bottom (500 pts) */}
        {!isLocked && (
          <polyline
            points={rightBarPoints}
            fill="none" stroke={galaxyColors ? 'url(#barGalaxyGrad)' : (useShimmer ? 'url(#barShimmerGrad)' : ringColor)} strokeWidth={barWidth}
            strokeDasharray={`${dash} 9999`}
            strokeLinejoin="round" strokeLinecap="round"
            className={usePulse ? 'bar-pulse-glow' : undefined}
            style={{
              '--bar-glow': barColor,
              '--bar-glow-soft': `${barColor}80`,
              filter: `brightness(1.35) drop-shadow(0 0 4px #fff) drop-shadow(0 0 10px ${barColor}) drop-shadow(0 0 24px ${barColor}80)`,
            }}
          />
        )}

        {/* Left half — top → counter-clockwise → bottom (500 pts) */}
        {!isLocked && (
          <polyline
            points={leftBarPoints}
            fill="none" stroke={galaxyColors ? 'url(#barGalaxyGrad)' : (useShimmer ? 'url(#barShimmerGrad)' : ringColor)} strokeWidth={barWidth}
            strokeDasharray={`${dash} 9999`}
            strokeLinejoin="round" strokeLinecap="round"
            className={usePulse ? 'bar-pulse-glow' : undefined}
            style={{
              '--bar-glow': barColor,
              '--bar-glow-soft': `${barColor}80`,
              filter: `brightness(1.35) drop-shadow(0 0 4px #fff) drop-shadow(0 0 10px ${barColor}) drop-shadow(0 0 24px ${barColor}80)`,
            }}
          />
        )}

        {/* Arena frame graphic — metalowa rama hexagonu z pustym środkiem (przezroczystość PNG),
            rysowana NA WIERZCHU paska postępu, żeby pasek "świecił spod ramy" */}
        {arenaImgOk && (
          <image
            href={`/arenas/arena-${previewLevel}.png`}
            x="0" y="0" width="210" height="210"
            preserveAspectRatio="xMidYMid meet"
            onError={() => setArenaImgOk(false)}
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
          <img
            src="/7days.png"
            alt={t('reportAlt')}
            style={{ width: '78%', height: '78%', objectFit: 'contain', userSelect: 'none', pointerEvents: 'none' }}
            draggable={false}
          />
        ) : (
          <>
            <span className={(ARENA_SCORE_SHIMMER[previewLevel] ?? true) ? 'score-shimmer' : undefined} style={{
              fontFamily: 'var(--font-display)', fontWeight: 300, fontSize: 62, lineHeight: 1, letterSpacing: '-1px',
              backgroundImage: scoreGradient,
              WebkitBackgroundClip: 'text', backgroundClip: 'text', color: 'transparent',
              textShadow: `0 0 22px ${color}73`,
            }}>
              {score}
            </span>
            <span style={{ fontFamily: 'var(--font-body)', fontWeight: 600, fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase', color: 'var(--text-dim)', marginTop: 2 }}>
              PKT
            </span>
          </>
        )}
      </div>

      {/* DEV-only: przełączanie podglądu areny strzałkami */}
      {isDev && (
        <>
          <button
            onClick={(e) => { e.stopPropagation(); setDevPreviewLevel(l => { const i = DEV_PREVIEW_LEVELS.indexOf(l); return DEV_PREVIEW_LEVELS[(i + DEV_PREVIEW_LEVELS.length - 1) % DEV_PREVIEW_LEVELS.length] }) }}
            style={{
              position: 'absolute', left: -44, top: '50%', transform: 'translateY(-50%)',
              width: 32, height: 32, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-primary)', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >‹</button>
          <button
            onClick={(e) => { e.stopPropagation(); setDevPreviewLevel(l => { const i = DEV_PREVIEW_LEVELS.indexOf(l); return DEV_PREVIEW_LEVELS[(i + 1) % DEV_PREVIEW_LEVELS.length] }) }}
            style={{
              position: 'absolute', right: -44, top: '50%', transform: 'translateY(-50%)',
              width: 32, height: 32, borderRadius: '50%',
              border: '1px solid rgba(255,255,255,0.15)', background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-primary)', fontSize: 16, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}
          >›</button>
        </>
      )}
    </div>
  )
}

// ── QUOTE PANEL ──────────────────────────────────────────────────────────────
function QuotePanel({ quote, onClose }) {
  const { t } = useTranslation('home')
  if (!quote) return null
  // Bare quote that "hangs" centered over a blurred Home view — no box/frame, no
  // caption. Tap anywhere (or the ✕ at the bottom) closes it.
  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(4,2,0,0.72)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '28px 26px calc(env(safe-area-inset-bottom, 0px) + 26px)',
      }}
    >
      <motion.div
        initial={{ scale: 0.94, opacity: 0, y: 10 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.96, opacity: 0, y: 6 }}
        transition={{ type: 'spring', stiffness: 300, damping: 26 }}
        onClick={e => e.stopPropagation()}
        style={{
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          width: '100%', maxWidth: 440, textAlign: 'center',
        }}
      >
        <p style={{
          fontFamily: 'var(--font-display)', fontStyle: 'italic', fontWeight: 700,
          fontSize: 26, lineHeight: 1.4, color: 'var(--text-primary)',
          marginBottom: 20, letterSpacing: 0.3,
        }}>
          „{quote.text}"
        </p>
        <p style={{
          color: 'var(--orange)', fontFamily: 'var(--font-display)',
          fontWeight: 600, fontSize: 14, letterSpacing: 1,
        }}>
          — {quote.author}
        </p>
      </motion.div>
      <button
        onClick={onClose}
        aria-label={t('quote.close')}
        style={{
          flexShrink: 0, marginTop: 34,
          width: 46, height: 46, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(150,200,255,0.20)',
          color: '#cfe0f2', fontSize: 18, cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          WebkitTapHighlightColor: 'transparent',
        }}
      >✕</button>
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
  const { t } = useTranslation('home')
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
        boxShadow: `0 8px 40px rgba(0,0,0,0.65), 0 0 24px ${color}1D`,
        minWidth: 260, maxWidth: 320,
        cursor: 'pointer',
      }}
      onClick={onClose}
    >
      <img
        src={data.stage.image}
        alt={data.title}
        style={{ width: 54, height: 54, objectFit: 'contain', flexShrink: 0, filter: `drop-shadow(0 0 8px ${color}56)` }}
      />
      <div style={{ minWidth: 0 }}>
        <p style={{ fontSize: 9, letterSpacing: 2.5, color: color, textTransform: 'uppercase', fontWeight: 700, marginBottom: 3 }}>
          {t('achievementToast.newAchievement')}
        </p>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5, lineHeight: 1.1 }}>
          {data.title}
        </p>
        <p style={{ fontSize: 11, color: 'var(--text-secondary)', marginTop: 3, fontWeight: 500 }}>
          {t('achievementToast.unlocked', { label: data.stage.label })}
        </p>
      </div>
    </motion.div>
  )
}

// ── REST DAY CARD ────────────────────────────────────────────────────────────
function RestDayCard() {
  const { t } = useTranslation('home')
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
        {t('restDay.title')}
      </p>
      <p style={{ color: 'var(--text-dim)', fontSize: 13, lineHeight: 1.5 }}>
        {t('restDay.desc')}
      </p>
    </div>
  )
}

// ── XP EVENT: mały toast (bez awansu) ───────────────────────────────────────
function XpReportToast({ data, onClose }) {
  const { t } = useTranslation('home')
  useEffect(() => {
    if (!data) return
    const t = setTimeout(onClose, 5000)
    return () => clearTimeout(t)
  }, [data])  // eslint-disable-line react-hooks/exhaustive-deps

  return createPortal(
    <AnimatePresence>
      {data && (
        <motion.div
          key="xp-toast"
          initial={{ y: -140, opacity: 0 }}
          animate={{ y: 0,    opacity: 1 }}
          exit={{   y: -140, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          onClick={onClose}
          style={{
            position: 'fixed', top: 0, left: 0, right: 0, zIndex: 9999,
            display: 'flex', justifyContent: 'center',
            paddingTop: 'calc(env(safe-area-inset-top, 0px) + 10px)',
            paddingLeft: 16, paddingRight: 16,
          }}
        >
          <div style={{
            width: '100%', maxWidth: 390,
            background: 'rgba(4,12,28,0.96)',
            backdropFilter: 'blur(32px) saturate(1.8)', WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
            border: '1px solid rgba(0,200,255,0.22)', borderTop: '1px solid rgba(0,220,255,0.40)',
            borderRadius: 18, padding: '13px 18px',
            display: 'flex', alignItems: 'center', gap: 14,
            boxShadow: '0 10px 40px rgba(0,0,0,0.65)',
          }}>
            <motion.div
              animate={{ rotate: [0,-12,12,-6,6,0], scale: [1,1.2,1] }}
              transition={{ duration: 0.6, delay: 0.2 }}
              style={{ width: 40, height: 40, borderRadius: 12, flexShrink: 0,
                background: 'linear-gradient(135deg,rgba(0,160,255,.22),rgba(0,80,200,.12))',
                border: '1.5px solid rgba(0,200,255,.28)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}
            >⚡</motion.div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2.5, textTransform: 'uppercase', color: 'rgba(0,200,255,.75)', marginBottom: 2 }}>{t('xpToast.weeklyReport')}</p>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 16, color: 'var(--text-primary)' }}>{t('xpToast.earnedXp')}</p>
            </div>
            <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', stiffness: 500, damping: 22, delay: 0.18 }}
              style={{ textAlign: 'center', flexShrink: 0 }}>
              <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 36, lineHeight: 1,
                color: 'var(--text-primary)', textShadow: '0 0 24px rgba(0,200,255,.70)' }}>+{data.xpGained}</p>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase', color: 'rgba(0,200,255,.65)',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 3 }}>
                <img src="/hoopxp.png" alt="XP" style={{ width: 11, height: 11, objectFit: 'contain' }}/>XP
              </p>
            </motion.div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ── ARENA UP MODAL — pełnoekranowy panel awansu (jak level-up w Clash Royale) ─
// ── ARENA_META ────────────────────────────────────────────────────────────────
// Kolejność: od najniższej (index 0) do najwyższej.
// "Sól tej Ziemi" jest ZAWSZE ostatnia — gdy dodajesz nową arenę, wstawiaj ją
// PRZED ostatnim wpisem, a próg Sól podnieś odpowiednio.
const ARENA_META = [
  {
    name: 'Rozgrzewka',      threshold: 0, noFrame: true,
    bg: 'rgba(30,30,60,0.45)',   glow: '#8899CC',
    badge: ['#AABBD8','#5566AA','#0C0E22'],
    tagline: 'Tu zaczyna się każda legenda.',
    desc: 'Pierwsze kroki. Zbuduj nawyk, zbierz 500 XP i wejdź na prawdziwe boisko.',
  },
  {
    name: 'Street Court',    threshold: 500,
    bg: 'rgba(100,45,0,0.45)',   glow: '#FF8C30',
    badge: ['#FFCC80','#E07020','#180900'],
    tagline: 'Ulica weryfikuje. Ty zdałeś.',
    desc: 'Pokazałeś, że jesteś tu na serio. Czas walczyć o jeszcze więcej.',
  },
  {
    name: 'City Run',        threshold: 1500,
    bg: 'rgba(90,60,0,0.50)',    glow: '#E8B030',
    badge: ['#FFE090','#C88820','#1A1000'],
    tagline: 'Miasto nigdy nie śpi. Ty też nie zwalniasz.',
    desc: 'Twoja gra zaczyna robić wrażenie — miasto Cię zauważyło.',
  },
  {
    name: 'Golden Reign',    threshold: 2700,
    bg: 'rgba(90,70,0,0.50)',    glow: '#FFC940',
    badge: ['#FFF2B0','#C9A227','#241200'],
    tagline: 'Złota era. Rządzisz parkietem.',
    desc: 'Złoty wiek Twojej kariery. Nieliczni docierają tak wysoko.',
  },
  {
    name: 'Ankh Court',      threshold: 3900,
    bg: 'rgba(0,70,65,0.50)',    glow: '#2DD4BF',
    badge: ['#A8FFF0','#1FA89A','#001A18'],
    tagline: 'Starożytna moc, nowoczesna gra.',
    desc: 'Arena dla wybranych. Twoja legenda rośnie z każdym meczem.',
  },
  {
    name: 'Void Gem',        threshold: 5500,
    bg: 'rgba(60,0,90,0.50)',    glow: '#A855F7',
    badge: ['#E0B0FF','#7C3AED','#180029'],
    tagline: 'W pustce świecisz najjaśniej.',
    desc: 'Otoczony pustką, świecisz jak klejnot. Elita elit.',
  },
  {
    // ZAWSZE OSTATNIA — "Seraphim" to aktualny szczyt aren.
    // Gdy dodasz nową arenę, wstaw ją PRZED tym wpisem i podnieś próg poniżej.
    name: 'Seraphim',        threshold: 7500,
    bg: 'rgba(90,80,40,0.50)',   glow: '#FDE68A',
    badge: ['#FFFFFF','#FFD700','#3A2C00'],
    tagline: 'Ostatni stopień. Boska forma.',
    desc: 'Szczyt HoopConnect. Status legendy.',
  },
]
const ARENA_UP_PARTICLES = Array.from({ length: 16 }, (_, i) => ({
  x: Math.cos((i / 16) * Math.PI * 2) * (55 + (i % 4) * 14),
  y: Math.sin((i / 16) * Math.PI * 2) * (55 + (i % 4) * 14),
  delay: i * 0.055,
  size: 3 + (i % 4) * 2.5,
}))
const ARENA_ROMAN = ['', 'I', 'II', 'III', 'IV', 'V', 'VI']
// Iskry wystrzeliwujące z chipa "Osiągnięto" — krótki burst, nie pulsujące kółko
const MILESTONE_SPARKS = Array.from({ length: 10 }, (_, i) => ({
  angle: (i / 10) * Math.PI * 2 + (i % 2) * 0.3,
  dist: 26 + (i % 3) * 10,
  delay: 0.5 + i * 0.03,
  size: 2 + (i % 3) * 1.5,
}))

// Small hex badge used inside the arena modal
function ArenaHexBadge({ idx, meta, size = 140 }) {
  const [imgOk, setImgOk] = useState(true)
  useEffect(() => setImgOk(true), [idx])

  // Etap bez ramki (Rozgrzewka) — wygląd jak w "Droga Aren": przerywany hexagon + 🏀
  if (meta.noFrame) {
    return (
      <div style={{ width: size, height: size, position: 'relative' }}>
        <svg width={size} height={size} viewBox="0 0 90 90">
          <polygon points="45,3 82,24 82,66 45,87 8,66 8,24"
            fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2"
            strokeDasharray="6 6" strokeLinejoin="round" />
        </svg>
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, opacity: 0.5,
        }}>🏀</div>
      </div>
    )
  }

  return imgOk ? (
    <img
      src={`/arenas/arena-${idx}.png`}
      onError={() => setImgOk(false)}
      alt={meta.name}
      style={{ width: size, height: size, objectFit: 'contain',
        filter: `drop-shadow(0 0 30px ${meta.glow}99)` }}
    />
  ) : (
    <svg width={size} height={size} viewBox="0 0 90 90"
      style={{ filter: `drop-shadow(0 0 28px ${meta.glow}90)` }}>
      <defs>
        <linearGradient id={`ahb-g-${idx}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={meta.badge[0]}/>
          <stop offset="55%"  stopColor={meta.badge[1]}/>
          <stop offset="100%" stopColor={meta.badge[2]}/>
        </linearGradient>
      </defs>
      <polygon points="45,3 82,24 82,66 45,87 8,66 8,24"
        fill={`url(#ahb-g-${idx})`} stroke={meta.badge[0]} strokeWidth="1.5" strokeOpacity="0.65"/>
      <polygon points="45,13 72,30 72,60 45,77 18,60 18,30"
        fill="none" stroke={meta.badge[0]} strokeWidth="0.7" strokeOpacity="0.30"/>
      <text x="45" y="53" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize="28" fontWeight="900"
        fontFamily="var(--font-display)" opacity="0.95">{Math.max(1, idx)}</text>
    </svg>
  )
}

function ArenaUpModal({ data, onClose }) {
  const { t } = useTranslation('home')
  const arenaNames = t('arenaUp.arenas', { returnObjects: true }).map(a => a.name)
  const trName = (idx) => arenaNames[idx] ?? ARENA_META[idx]?.name
  // phase 0 = "before": stara arena + pasek wypełniający się do progu
  // phase 1 = "after":  nowa arena + cząsteczki + kontynuuj
  const [phase, setPhase] = useState(0)

  // XP counter dla fazy 0
  const xpMotion = useMotionValue(0)
  const xpDisplay = useTransform(xpMotion, v => Math.round(v))

  useEffect(() => {
    if (!data) return
    setPhase(0)

    const newIdx   = ARENA_META.findIndex(t => t.name === data.arenaName)
    const newMeta  = ARENA_META[Math.max(0, newIdx)] || ARENA_META[1]

    // XP counter: od prevXp do progu nowej areny
    xpMotion.set(data.prevXp ?? 0)
    const ctrl = fmAnimate(xpMotion, newMeta.threshold, { duration: 1.4, delay: 0.5, ease: 'easeOut' })

    // Po ~2.0s (po zakończeniu wypełnienia) → faza 1 (droga), potem faza 2 (reveal)
    const t1 = setTimeout(() => setPhase(1), 2100)
    const t2 = setTimeout(() => setPhase(2), 2100 + 1500)
    return () => { ctrl.stop(); clearTimeout(t1); clearTimeout(t2) }
  }, [data?.arenaName]) // eslint-disable-line react-hooks/exhaustive-deps

  const newIdx   = ARENA_META.findIndex(t => t.name === data?.arenaName)
  const prevIdx  = Math.max(0, ARENA_META.findIndex(t => t.name === data?.prevArenaName))
  const newMeta  = ARENA_META[Math.max(0, newIdx)]  || ARENA_META[1]
  const prevMeta = ARENA_META[prevIdx]               || ARENA_META[0]
  const nextMeta = ARENA_META[newIdx + 1]            || null

  const prevXp    = data?.prevXp ?? 0
  const prevSpan  = Math.max(1, newMeta.threshold - prevMeta.threshold)
  const prevPct   = Math.min(88, Math.max(0, ((prevXp - prevMeta.threshold) / prevSpan) * 100))

  const showXpChip = (data?.xpGained ?? 0) > 0

  return createPortal(
    <AnimatePresence>
      {data && (
        <motion.div
          key="arena-up-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          style={{
            position: 'fixed', inset: 0, zIndex: 10000,
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '0 28px', overflowY: 'auto',
          }}
        >
          {/* Background — crossfade between prev and new arena color */}
          <motion.div
            key="bg-prev"
            style={{ position: 'absolute', inset: 0, zIndex: 0,
              background: `radial-gradient(ellipse 90% 65% at 50% 35%, ${prevMeta.bg}, rgba(3,8,20,0.98) 75%)` }}
            animate={{ opacity: phase === 0 ? 1 : 0 }}
            transition={{ duration: 0.7 }}
          />
          <motion.div
            key="bg-next"
            style={{ position: 'absolute', inset: 0, zIndex: 0,
              background: `radial-gradient(ellipse 90% 65% at 50% 35%, ${newMeta.bg}, rgba(3,8,20,0.98) 75%)` }}
            animate={{ opacity: phase >= 1 ? 1 : 0 }}
            transition={{ duration: 0.7 }}
          />

          {/* Przyciemnienie tła — focus mode, prawie pełna czerń, arena jest jedynym światłem */}
          <div style={{ position: 'absolute', inset: 0, zIndex: 1, background: 'rgba(0,0,0,0.88)', pointerEvents: 'none' }} />

          {/* Particles — burst at phase 2 transition */}
          <AnimatePresence>
            {phase === 2 && (
              <div key="particles" style={{ position: 'absolute', top: '38%', left: '50%', pointerEvents: 'none', zIndex: 1 }}>
                {ARENA_UP_PARTICLES.map((p, i) => (
                  <motion.div key={i}
                    initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                    animate={{ opacity: [0, 1, 0], x: p.x * 1.8, y: p.y * 1.8, scale: [0, 1, 0.3] }}
                    transition={{ duration: 1.3, delay: p.delay * 0.8, ease: 'easeOut' }}
                    style={{
                      position: 'absolute', width: p.size, height: p.size,
                      borderRadius: '50%', background: newMeta.glow,
                      boxShadow: `0 0 ${p.size * 2}px ${newMeta.glow}`,
                      transform: 'translate(-50%,-50%)',
                    }}
                  />
                ))}
              </div>
            )}
          </AnimatePresence>

          {/* ── PHASE 0: stara arena + pasek wypełniający się ─────────────────── */}
          <AnimatePresence mode="wait">
            {phase === 0 && (
              <motion.div key="phase-0"
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20, scale: 0.95 }}
                transition={{ duration: 0.35 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  width: '100%', maxWidth: 320, position: 'relative', zIndex: 2 }}
              >
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 0.6 }}
                  transition={{ delay: 0.1 }}
                  style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3.5,
                    textTransform: 'uppercase', color: prevMeta.glow, marginBottom: 20 }}
                >{t('arenaUp.yourProgress')}</motion.p>

                {/* Stary badge — pulsuje, potem shrinkuje przy exit (pomijamy dla Rozgrzewki — brak ramki) */}
                {!prevMeta.noFrame && (
                  <motion.div style={{ position: 'relative', marginBottom: 22 }}>
                    <ArenaHexBadge idx={prevIdx} meta={{ ...prevMeta, name: trName(prevIdx) }} size={145}/>
                    <motion.div
                      animate={{ scale: [1, 1.5], opacity: [0.4, 0] }}
                      transition={{ duration: 1.0, delay: 0.4, repeat: 1, ease: 'easeOut' }}
                      style={{ position: 'absolute', inset: -10, borderRadius: '50%',
                        border: `2px solid ${prevMeta.glow}`, pointerEvents: 'none' }}
                    />
                  </motion.div>
                )}

                {/* Stara arena name — pomijamy dla Rozgrzewki */}
                {!prevMeta.noFrame && (
                  <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22,
                    letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-primary)',
                    textAlign: 'center', textShadow: `0 0 30px ${prevMeta.glow}60`,
                    marginBottom: 18 }}>{trName(prevIdx)}</p>
                )}

                {/* Pasek XP wypełniający się do progu */}
                <div style={{ width: '100%', marginBottom: 8, marginTop: prevMeta.noFrame ? 8 : 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1,
                      textTransform: 'uppercase', color: prevMeta.noFrame ? '#5BB8F580' : `${prevMeta.glow}80` }}>
                      {prevMeta.noFrame ? '' : trName(prevIdx)}
                    </span>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1,
                      textTransform: 'uppercase', color: `${newMeta.glow}90` }}>
                      {trName(newIdx)} ↑
                    </span>
                  </div>
                  <div style={{ height: 8, borderRadius: 99, background: 'rgba(255,255,255,0.07)',
                    position: 'relative', overflow: 'hidden' }}>
                    {/* Wypełnienie od poprzedniej pozycji do 100% */}
                    <motion.div
                      initial={{ width: `${prevPct}%` }}
                      animate={{ width: '100%' }}
                      transition={{ delay: 0.6, duration: 1.2, ease: 'easeInOut' }}
                      style={{
                        position: 'absolute', top: 0, left: 0, height: '100%', borderRadius: 99,
                        background: prevMeta.noFrame
                          ? 'linear-gradient(90deg, #5BB8F5, #7ECBFF)'
                          : `linear-gradient(90deg, ${prevMeta.badge[1]}, ${newMeta.badge[0]})`,
                        boxShadow: prevMeta.noFrame ? '0 0 14px #5BB8F590' : `0 0 14px ${newMeta.glow}90`,
                      }}
                    />
                  </div>
                  {/* XP counter */}
                  <p style={{ textAlign: 'center', marginTop: 8, fontFamily: 'var(--font-display)',
                    fontWeight: 800, fontSize: 18, color: 'var(--text-primary)',
                    textShadow: `0 0 16px ${newMeta.glow}60`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <motion.span>{xpDisplay}</motion.span>
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.40)',
                      fontWeight: 700 }}>/ {newMeta.threshold}</span>
                    <img src="/hoopxp.png" alt="XP" style={{ width: 14, height: 14, objectFit: 'contain' }}/>
                  </p>
                </div>

                {showXpChip && (
                  <motion.div initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    style={{ padding: '4px 12px', borderRadius: 99, marginTop: 4,
                      background: 'rgba(255,255,255,0.07)', border: '1px solid rgba(255,255,255,0.12)' }}>
                    <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(255,255,255,0.55)' }}>
                      {t('arenaUp.xpFromWeeklyReport', { xp: data.xpGained })}
                    </span>
                  </motion.div>
                )}
              </motion.div>
            )}

            {/* ── PHASE 1: hexagon obraca się i po odwróceniu odkrywa nową arenę ── */}
            {phase === 1 && (
              <motion.div key="phase-flip"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                exit={{ opacity: 0, scale: 0.96 }}
                transition={{ duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  width: '100%', maxWidth: 320, position: 'relative', zIndex: 2 }}
              >
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 0.7 }}
                  style={{ fontSize: 9, fontWeight: 800, letterSpacing: 3.5,
                    textTransform: 'uppercase', color: newMeta.glow, marginBottom: 20 }}
                >{t('arenaUp.promoting')}</motion.p>

                <div style={{ width: 190, height: 190, perspective: 900 }}>
                  <motion.div
                    initial={{ rotateY: 0 }}
                    animate={{ rotateY: 180 }}
                    transition={{ duration: 0.9, delay: 0.25, ease: 'easeInOut' }}
                    style={{ width: '100%', height: '100%', position: 'relative', transformStyle: 'preserve-3d' }}
                  >
                    {/* Przód — stara arena */}
                    <div style={{
                      position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ArenaHexBadge idx={prevIdx} meta={{ ...prevMeta, name: trName(prevIdx) }} size={190}/>
                    </div>
                    {/* Tył — nowa arena (obrócona o 180°, więc po flipie stoi prawidłowo) */}
                    <div style={{
                      position: 'absolute', inset: 0, backfaceVisibility: 'hidden',
                      transform: 'rotateY(180deg)',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <ArenaHexBadge idx={newIdx} meta={{ ...newMeta, name: trName(newIdx) }} size={190}/>
                    </div>
                  </motion.div>
                </div>

                <motion.p
                  initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 1.25 }}
                  style={{ fontSize: 11, fontWeight: 700, color: 'rgba(255,255,255,0.45)',
                    marginTop: 22, textAlign: 'center' }}
                >
                  <span style={{ color: `${prevMeta.glow}90` }}>{trName(prevIdx)}</span>
                  {' → '}
                  <span style={{ color: newMeta.glow }}>{trName(newIdx)}</span>
                </motion.p>
              </motion.div>
            )}

            {/* ── PHASE 2: nowa arena reveal ──────────────────────────────────── */}
            {phase === 2 && (
              <motion.div key="phase-2"
                initial={{ opacity: 0, scale: 0.92, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ type: 'spring', stiffness: 280, damping: 26 }}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                  width: '100%', maxWidth: 320, position: 'relative', zIndex: 2 }}
              >
                <motion.p
                  initial={{ opacity: 0, y: -8 }} animate={{ opacity: 0.8, y: 0 }}
                  transition={{ delay: 0.08 }}
                  style={{ fontSize: 9, fontWeight: 800, letterSpacing: 4,
                    textTransform: 'uppercase', color: newMeta.glow, marginBottom: 20 }}
                >{t('arenaUp.promoted')}</motion.p>

                {/* Nowy badge — wlatuje z dołu/skaluje, większy — dominuje ekran */}
                <motion.div
                  initial={{ scale: 0.3, opacity: 0, y: 30 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  transition={{ type: 'spring', stiffness: 320, damping: 22, delay: 0.10 }}
                  style={{ position: 'relative', marginBottom: 18 }}
                >
                  <ArenaHexBadge idx={newIdx} meta={{ ...newMeta, name: trName(newIdx) }} size={180}/>
                  <motion.div
                    animate={{ scale: [1, 1.7], opacity: [0.5, 0] }}
                    transition={{ duration: 1.2, delay: 0.4, repeat: 2, ease: 'easeOut' }}
                    style={{ position: 'absolute', inset: -12, borderRadius: '50%',
                      border: `2px solid ${newMeta.glow}`, pointerEvents: 'none' }}
                  />
                </motion.div>

                {/* Nowa arena name — emocjonalne powitanie */}
                <motion.p
                  initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.22, duration: 0.4 }}
                  style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 30,
                    letterSpacing: 1.5, textTransform: 'uppercase', color: 'var(--text-primary)',
                    textAlign: 'center', lineHeight: 1.1,
                    textShadow: `0 0 44px ${newMeta.glow}70`, marginBottom: 8 }}
                >{t('arenaUp.welcomeTo')}<br/>{trName(newIdx)}</motion.p>

                {/* Tagline emocjonalny */}
                <motion.p
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                  transition={{ delay: 0.36 }}
                  style={{ fontSize: 13, fontWeight: 600, fontStyle: 'italic',
                    color: 'rgba(255,255,255,0.55)', textAlign: 'center',
                    maxWidth: 260, lineHeight: 1.4, marginBottom: 20 }}
                >{t('arenaUp.notRookie')}</motion.p>

                {/* Milestone chip — polysk + iskry */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: 0.42 }}
                  style={{ position: 'relative', padding: '6px 18px', borderRadius: 10, marginBottom: 24,
                    background: `linear-gradient(135deg, ${newMeta.glow}30, ${newMeta.glow}10)`,
                    border: `1px solid ${newMeta.glow}60`,
                    boxShadow: `0 0 18px ${newMeta.glow}35, inset 0 1px 0 rgba(255,255,255,0.25)`,
                    overflow: 'hidden' }}
                >
                  {/* Połysk — przesuwający się sweep */}
                  <motion.div
                    initial={{ x: '-120%' }}
                    animate={{ x: '220%' }}
                    transition={{ delay: 0.7, duration: 0.9, ease: 'easeInOut' }}
                    style={{ position: 'absolute', top: 0, bottom: 0, width: '40%',
                      background: `linear-gradient(75deg, transparent, ${newMeta.glow}55, transparent)`,
                      pointerEvents: 'none' }}
                  />
                  <span style={{ position: 'relative', fontSize: 11, fontWeight: 800, color: newMeta.glow, letterSpacing: 0.5 }}>
                    {t('arenaUp.achieved', { value: newMeta.threshold === 0 ? t('arenaUp.start') : `${newMeta.threshold} XP` })}
                  </span>
                  {/* Iskry — krótki burst */}
                  {MILESTONE_SPARKS.map((s, i) => (
                    <motion.div key={i}
                      initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                      animate={{ opacity: [0, 1, 0], x: Math.cos(s.angle) * s.dist, y: Math.sin(s.angle) * s.dist, scale: [0, 1, 0.4] }}
                      transition={{ duration: 0.7, delay: s.delay, ease: 'easeOut' }}
                      style={{ position: 'absolute', top: '50%', left: '50%', width: s.size, height: s.size,
                        borderRadius: '50%', background: newMeta.glow,
                        boxShadow: `0 0 ${s.size * 2}px ${newMeta.glow}`,
                        transform: 'translate(-50%,-50%)', pointerEvents: 'none' }}
                    />
                  ))}
                </motion.div>

                {/* Pasek nowej areny (start 0% → następny) */}
                <motion.div
                  initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.50 }}
                  style={{ width: '100%', marginBottom: 30 }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
                      textTransform: 'uppercase', color: `${newMeta.glow}90` }}>{trName(newIdx)}</span>
                    <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.2,
                      textTransform: 'uppercase', color: 'rgba(255,255,255,0.28)' }}>
                      {nextMeta ? t('arenaUp.arenaLabel', { roman: ARENA_ROMAN[newIdx + 1] || newIdx + 1 }) : t('arenaUp.max')}
                    </span>
                  </div>
                  <div style={{ height: 6, borderRadius: 99, background: 'rgba(255,255,255,0.07)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: nextMeta ? '1.5%' : '100%' }}
                      transition={{ delay: 0.70, duration: 0.6 }}
                      style={{ height: '100%', borderRadius: 99,
                        background: `linear-gradient(90deg, ${newMeta.badge[1]}, ${newMeta.badge[0]})`,
                        boxShadow: `0 0 10px ${newMeta.glow}80` }}
                    />
                  </div>
                  <p style={{ textAlign: 'center', fontSize: 10, color: 'rgba(255,255,255,0.30)',
                    marginTop: 6, fontWeight: 700 }}>
                    {newMeta.threshold} / {nextMeta ? nextMeta.threshold : newMeta.threshold} XP
                    {nextMeta && <span style={{ color: 'rgba(255,255,255,0.18)' }}> → {t('arenaUp.arenaLabel', { roman: ARENA_ROMAN[newIdx + 1] || newIdx + 1 })}</span>}
                  </p>
                </motion.div>

                {/* Continue */}
                <motion.button
                  initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.56 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onClose}
                  style={{
                    width: '100%', height: 54, borderRadius: 16,
                    background: `linear-gradient(135deg, ${newMeta.badge[1]}, ${newMeta.badge[0]})`,
                    border: `1px solid ${newMeta.badge[0]}80`,
                    boxShadow: `0 4px 32px ${newMeta.glow}55`,
                    color: 'white', fontFamily: 'var(--font-display)', fontWeight: 900,
                    fontSize: 15, letterSpacing: 2.5, textTransform: 'uppercase', cursor: 'pointer',
                  }}
                >{t('arenaUp.continue')}</motion.button>
                <div style={{ height: 'calc(env(safe-area-inset-bottom, 0px) + 16px)' }} />
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}

// ── DAY DONE MODAL ───────────────────────────────────────────────────────────
function DayDoneModal({ completedCount, onClose }) {
  const { t } = useTranslation('home')
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
          boxShadow: '0 8px 40px rgba(0,0,0,0.70), 0 0 32px rgba(0,230,118,0.11)',
        }}
      >
        <p style={{ fontSize: 9, letterSpacing: 3, color: 'var(--green-shot)', textTransform: 'uppercase', fontWeight: 700, marginBottom: 14 }}>
          {t('dayDone.labelTop')}
        </p>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 30, textTransform: 'uppercase', letterSpacing: 1, color: 'var(--text-primary)', lineHeight: 1.1, marginBottom: 6 }}>
          {t('dayDone.titleBig')}
        </p>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 64, lineHeight: 1, color: 'var(--green-shot)', letterSpacing: '-3px', textShadow: '0 0 24px rgba(0,230,118,0.45)', marginBottom: 4 }}>
          {completedCount}
        </p>
        <p style={{ fontSize: 10, letterSpacing: 2.5, color: 'var(--text-dim)', textTransform: 'uppercase', fontWeight: 600, marginBottom: 28 }}>
          {t('dayDone.sessions')}
        </p>

        {/* Progress bar */}
        <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden', marginBottom: 28 }}>
          <motion.div
            style={{ height: '100%', background: 'var(--green-shot)', borderRadius: 2, originX: 0, boxShadow: '0 0 10px rgba(0,230,118,0.54)' }}
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
          {t('dayDone.next')}
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── MAIN PAGE ────────────────────────────────────────────────────────────────
export default function HomePage() {
  const { t } = useTranslation('home')
  const { profile, refreshProfile, setProfileData } = useAuth()
  // Pierwsze uruchomienie bez miasta w profilu → ustal z lokalizacji (jedna próba na
  // urządzenie; użytkownik może zmienić w Ustawieniach). Fundament pod filtry po mieście.
  useAutoCity(profile, setProfileData)
  const [trainings, setTrainings] = useState([])
  // Trzymamy pełną listę aktywnych treningów (do swap-funkcji "nie mam sprzętu").
  const allActiveTrainingsRef = useRef([])
  const activityLogRef        = useRef(null)
  const [activityLog, setActivityLog] = useState(null)
  const [quote, setQuote] = useState(null)
  const [showQuote, setShowQuote] = useState(false)
  const [loading, setLoading] = useState(true)
  const [dayType, setDayType] = useState('T')
  const [reportScore, setReportScore] = useState(0)
  const [reportLoading, setReportLoading] = useState(true)
  const [daysUntilReport, setDaysUntilReport] = useState(0)  // raport odblokowany od startu (rozgrzewka), bez blokady 7-dniowej
  const [achievementToast, setAchievementToast] = useState(null) // { title, stage }
  const { setSettingsOpen, leagueOpen, setLeagueOpen, setFrameUnlockOpen, frameUnlockData, setNotificationsOpen, setStoryOpen } = useUI()
  const { unreadCount: notifUnreadCount } = useNotifications()
  const { practices: teamPractices } = useTodayTeamPractice()
  const [showSettings, setShowSettings] = useState(false)

  function openSettings() { setShowSettings(true); setSettingsOpen(true) }
  function closeSettings() { setShowSettings(false); setSettingsOpen(false) }
  function closeLeague() { setLeagueOpen(false) }

  // ── Frame notification dot — show if there's a pending frame in UIContext ───
  const hasPendingFrame = !!frameUnlockData

  function openFrameNotif() {
    if (frameUnlockData) setFrameUnlockOpen(true)
  }
  const swipeStartX = useRef(null)
  const swipeStartY = useRef(null)

  function notifyAchievement(data) {
    setAchievementToast(data)
  }
  const [showDayDoneModal, setShowDayDoneModal] = useState(false)
  const [showArenaRoad, setShowArenaRoad] = useState(false)
  const [devArenaUpLevel, setDevArenaUpLevel] = useState(0)
  // DEV: na localhost przełączaj podgląd ramy strzałkami/przyciskiem, niezależnie od profile.arena_level
  const [devPreviewLevel, setDevPreviewLevel] = useState(6)
  const [streakToast,     setStreakToast]     = useState(0)   // >0 = visible, value = new streak
  const [weeklyXpToast,  setWeeklyXpToast]  = useState(null) // { xpGained, arenaUp, arenaName } | null
  // Kolejka: jeśli DayDoneModal jest otwarty gdy chcemy pokazać arenę,
  // zapamiętujemy dane i odpalamy dopiero po jego zamknięciu.
  const pendingArenaToastRef = useRef(null)
  useEffect(() => {
    if (!showDayDoneModal && pendingArenaToastRef.current) {
      setWeeklyXpToast(pendingArenaToastRef.current)
      pendingArenaToastRef.current = null
    }
  }, [showDayDoneModal])

  // ── DEV ONLY: podgląd animacji awansu areny (przycisk na HomePage) ──────────
  function devTriggerArenaUp() {
    const DEV_T = ARENA_META.map(a => a.threshold)
    const DEV_N = ARENA_META.map(a => a.name)
    const prevLevel = devArenaUpLevel
    const nextLevel = prevLevel + 1
    setWeeklyXpToast({
      xpGained:      0,
      prevXp:        DEV_T[prevLevel],
      prevArenaName: DEV_N[prevLevel],
      arenaUp:       true,
      arenaName:     DEV_N[nextLevel],
    })
    setDevArenaUpLevel(nextLevel >= DEV_T.length - 1 ? 0 : nextLevel)
  }

  useEffect(() => { loadData() }, [profile])
  // Ref mirror — pozwala silentSyncLog czytać bieżący activityLog bez
  // stale-closure (useEffect[profile] nie reruns przy każdym setState).
  useEffect(() => { activityLogRef.current = activityLog }, [activityLog])

  // Cross-device sync — dwa mechanizmy:
  //
  // (1) FOCUS/VISIBILITY: cichy fetch activity_log w tle. Stan aktualizuje się
  //     TYLKO gdy trainings_completed/all_done faktycznie się zmieniło.
  //     Brak zmiany = brak re-renderu = brak widocznego "przeładowania".
  //     Debounce 2s zapobiega podwójnemu wołaniu (visibilitychange + focus).
  //
  // (2) SUPABASE REALTIME:
  //     activity_log → silentSyncLog (płynna aktualizacja checkboxów)
  //     points_log   → reconcileReportScore (tylko wynik, bez loadData)
  //     Nigdzie nie wołamy loadData() — quote i trainings nie migają.
  useEffect(() => {
    if (!profile) return

    let lastSyncTs = 0
    async function silentSyncLog() {
      const now = Date.now()
      if (now - lastSyncTs < 2000) return   // debounce: visibilitychange + focus często wołają razem
      lastSyncTs = now
      try {
        const { data: log } = await supabase
          .from('activity_log').select('*')
          .eq('user_id', profile.id).eq('date', TODAY).maybeSingle()
        const prev = activityLogRef.current
        const prevDone = JSON.stringify((prev?.trainings_completed || []).slice().sort())
        const nextDone = JSON.stringify((log?.trainings_completed  || []).slice().sort())
        if (prevDone !== nextDone || prev?.all_done !== log?.all_done) {
          setActivityLog(log)
          setCache(`log:${profile.id}:${TODAY}`, log, 15 * 1000)
        }
      } catch { /* sieć niedostępna — stan zostaje bez zmian */ }
    }

    function onFocus() {
      if (document.visibilityState !== 'visible') return
      silentSyncLog()
    }
    document.addEventListener('visibilitychange', onFocus)
    window.addEventListener('focus', onFocus)
    function onPageShow(e) { if (e.persisted) silentSyncLog() }
    window.addEventListener('pageshow', onPageShow)

    const unsubActivity = onTableChange('activity_log', silentSyncLog)
    const unsubPoints   = onTableChange('points_log',   reconcileReportScore)

    function onActivityLogUpdated(e) {
      if (e.detail) {
        setActivityLog(e.detail)
        setCache(`log:${profile.id}:${TODAY}`, e.detail, 15 * 1000)
      } else {
        silentSyncLog()
      }
    }
    window.addEventListener('hc:activity-log-updated', onActivityLogUpdated)

    return () => {
      document.removeEventListener('visibilitychange', onFocus)
      window.removeEventListener('focus', onFocus)
      window.removeEventListener('pageshow', onPageShow)
      window.removeEventListener('hc:activity-log-updated', onActivityLogUpdated)
      unsubActivity()
      unsubPoints()
    }
  }, [profile])

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
    if (cachedReport != null)  { setReportScore(cachedReport.score); setDaysUntilReport(0); setReportLoading(false) }

    // ── 2. STATIC data z persistent cache (24h TTL) — eliminuje round-trip ──
    // Trainings i quotes zmieniają się rzadko (tylko przy deployu). Cache między
    // sesjami w localStorage → 0 zapytań do Supabase na "ciepłej" wizycie.
    const pcTrainings = pGet('trainings:active')
    const pcQuotes    = pGet('quotes:active')

    // Trainings: jeśli mamy w persistent cache, użyj od razu (skip network).
    let allTrainings = pcTrainings
    if (!allTrainings) {
      // ORDER BY id — DETERMINISTYCZNA kolejność, kluczowa dla seeded picker'a.
      // Bez tego dwa urządzenia tego samego usera mogły dostać różne treningi.
      const res = await supabase.from('trainings').select('*').eq('is_active', true).order('id')
      allTrainings = res.data || []
      if (allTrainings.length) pSet('trainings:active', allTrainings, 24 * 60 * 60 * 1000)
    } else {
      // Stary cache mógł nie mieć stabilnej kolejności — wymuszamy sort tutaj
      allTrainings = [...allTrainings].sort((a, b) => a.id.localeCompare(b.id))
    }
    if (allTrainings.length) {
      allActiveTrainingsRef.current = allTrainings
      const picked = pickDailyTrainings(allTrainings, profile)
      const withSwaps = picked.map(t => {
        try {
          const stored = localStorage.getItem(`hc:swap:${TODAY}:${t.id}`)
          return stored ? JSON.parse(stored) : t
        } catch { return t }
      })
      setCache(`trainings:${TODAY}`, withSwaps, 30 * 60 * 1000)
      setTrainings(withSwaps)
    }
    setLoading(false)

    // log MUSI być fresh (user-state) — quotes mogą być z persistent cache
    const logPromise   = supabase.from('activity_log').select('*').eq('user_id', profile.id).eq('date', TODAY).maybeSingle()
    let quotes = pcQuotes
    const quotesPromise = quotes
      ? Promise.resolve({ data: quotes })
      : supabase.from('quotes').select('*').eq('is_active', true)

    const [{ data: log }, { data: freshQuotes }] = await Promise.all([logPromise, quotesPromise])
    setActivityLog(log)
    setCache(`log:${profile.id}:${TODAY}`, log, 15 * 1000)

    if (!quotes && freshQuotes?.length) {
      pSet('quotes:active', freshQuotes, 24 * 60 * 60 * 1000)
      quotes = freshQuotes
    }
    if (quotes?.length) {
      setQuote(quotes[Math.floor(Math.random() * quotes.length)])
    }

    // ── 3. Weekly report (running total bieżącego tygodnia) ──
    // Kontekst zmiany: poprzednia logika pokazywała score z POPRZEDNIEGO
    // tygodnia (lagger). Powodowała że gracz widzi 0pkt na początku nowego
    // tygodnia mimo że trenuje, oraz nie widzi dziś-poniedziałkowych
    // efektów. Teraz pokazujemy NARASTAJĄCY wynik z bieżącego tygodnia —
    // resetuje się do 0 w pierwszym dniu nowego tygodnia i rośnie wraz z
    // każdym ćwiczeniem.
    //
    // ZMIANA (spec "System XP i Areny" — "Tygodniowy Draft Score resetuje
    // się każdy poniedziałek"): tydzień jest teraz GLOBALNY/kalendarzowy
    // (poniedziałek 00:00 UTC), wspólny dla wszystkich graczy — a nie
    // przesunięty względem daty dołączenia. Dzięki temu nowy gracz od razu
    // nabija punkty w BIEŻĄCYM (choćby częściowym) tygodniu; jego pierwszy
    // raport po prostu pojawi się, gdy ten tydzień się zakończy (czyli w
    // najbliższy poniedziałek — maksymalnie ~7 dni, jak w specyfikacji).
    const now = new Date()
    const createdAt = profile.created_at ? new Date(profile.created_at) : now

    const currentWeek   = calendarWeekNumber(now)
    const joinWeek      = calendarWeekNumber(createdAt)
    const completedWeek = currentWeek - 1

    const weekStart     = startOfCalendarWeek(now)

    // Countdown „pierwszy raport za N dni" usunięty — raport jest odblokowany od
    // startu: od razu pokazujemy rozgrzewkę i liczymy punkty (daysUntilReport=0).
    // `hasFirstReport` zostaje — steruje archiwizacją zakończonego tygodnia niżej.
    const hasFirstReport = currentWeek > joinWeek
    setDaysUntilReport(0)

    // Archiwizacja zakończonego tygodnia (jeśli jeszcze nie zapisana) —
    // tylko dla tygodni OD dołączenia gracza wzwyż (nie cudzych, sprzed jego
    // rejestracji — i tak nie miałby tam żadnych punktów).
    if (hasFirstReport && completedWeek >= joinWeek) {
      const { data: archived } = await supabase
        .from('weekly_reports')
        .select('total_points')
        .eq('user_id', profile.id)
        .eq('week_number', completedWeek)
        .maybeSingle()
      if (!archived) {
        // "Pula treningowa" zakończonego tygodnia = TYLKO punkty z treningu/
        // rzutów (source='training'). Punkty meczowe (source='match') już
        // dały XP od razu (instant, przy zakończeniu meczu) — nie liczymy
        // ich drugi raz w batchu poniedziałkowym.
        const { data: oldPoints } = await supabase
          .from('points_log')
          .select('points')
          .eq('user_id', profile.id)
          .eq('week_number', completedWeek)
          .eq('source', 'training')
        const oldTotal = (oldPoints || []).reduce((s, r) => s + (r.points || 0), 0)
        const xpGained = Math.round(oldTotal * 0.1)

        // Zapamiętaj stan PRZED archiwizacją (trigger zaraz go zmieni)
        const oldArenaLevel = profile.arena_level ?? 0
        const prevXp        = profile.xp ?? 0
        const ARENA_NAMES   = ARENA_META.map(a => a.name)

        await supabase.from('weekly_reports').insert({
          user_id:      profile.id,
          week_number:  completedWeek,
          total_points: oldTotal,
          revealed_at:  new Date().toISOString(),
        })

        // Trigger `award_weekly_xp` już uruchomił się synchronicznie — pobierz
        // zaktualizowany profil i pokaż animację tylko gdy faktycznie przyznano XP.
        if (xpGained > 0) {
          await refreshProfile()
          const { data: fresh } = await supabase
            .from('profiles').select('xp,arena_level').eq('id', profile.id).single()
          const newArenaLevel = fresh?.arena_level ?? oldArenaLevel
          setWeeklyXpToast({
            xpGained,
            prevXp,
            prevArenaName: ARENA_NAMES[oldArenaLevel] ?? null,
            arenaUp:       newArenaLevel > oldArenaLevel,
            arenaName:     ARENA_NAMES[newArenaLevel] ?? null,
          })
        }
      }
    }

    // BIEŻĄCY wynik (Draft Score) = suma punktów od początku TEGO
    // kalendarzowego tygodnia (poniedziałek 00:00 UTC) — ALBO od ostatniego
    // `draft_score_reset_at`, jeśli jest późniejszy (np. awans areny
    // w środku tygodnia zeruje Draft Score od razu, mid-week).
    const weekStartISO  = weekStart.toISOString().slice(0, 10)
    const resetAt       = profile.draft_score_reset_at ? new Date(profile.draft_score_reset_at) : weekStart
    const effectiveFrom = resetAt > weekStart ? resetAt : weekStart
    const effectiveFromISO = effectiveFrom.toISOString().slice(0, 10)
    const { data: pointsData } = await supabase
      .from('points_log')
      .select('points,date,week_number')
      .eq('user_id', profile.id)
      .gte('date', effectiveFromISO)
    const runningTotal = (pointsData || []).reduce((sum, r) => sum + (r.points || 0), 0)
    if (import.meta.env.DEV) {
      console.log('[weekly-report]', { currentWeek, joinWeek, weekStartISO, rows: pointsData })
    }

    setCache(`report:${profile.id}`, { score: runningTotal, daysLeft: 0 }, 60 * 1000)
    setReportScore(runningTotal)

    setReportLoading(false)
  }

  // Single source of truth: pobierz sumę punktów z bieżącego okna 7-dniowego
  // bezpośrednio z DB. Wywoływane po każdym mark/unmark oraz przez Realtime,
  // żeby UI ZAWSZE dopasował się do faktycznego stanu bazy.
  async function reconcileReportScore() {
    if (!profile) return
    // Globalny kalendarzowy tydzień (poniedziałek 00:00 UTC) — patrz `lib/week.js`.
    // Albo `draft_score_reset_at`, jeśli późniejszy (awans areny mid-week).
    const weekStart = startOfCalendarWeek(new Date())
    const resetAt = profile.draft_score_reset_at ? new Date(profile.draft_score_reset_at) : weekStart
    const effectiveFrom = resetAt > weekStart ? resetAt : weekStart
    const effectiveFromISO = effectiveFrom.toISOString().slice(0, 10)
    const { data } = await supabase
      .from('points_log')
      .select('points')
      .eq('user_id', profile.id)
      .gte('date', effectiveFromISO)
    const trueTotal = (data || []).reduce((s, r) => s + (r.points || 0), 0)
    setReportScore(trueTotal)
    setCache(`report:${profile.id}`, { score: trueTotal, daysLeft: 0 }, 60 * 1000)
  }

  function getSwapAlternatives(trainingId) {
    const current = trainings.find(t => t.id === trainingId)
    if (!current || !allActiveTrainingsRef.current) return []
    const shownIds = new Set(trainings.map(t => t.id))
    return allActiveTrainingsRef.current.filter(t =>
      t.category === current.category &&
      t.is_active &&
      !t.requires_equipment &&
      !shownIds.has(t.id)
    )
  }

  function swapTraining(trainingId) {
    const current = trainings.find(t => t.id === trainingId)
    if (!current) return
    const alternatives = getSwapAlternatives(trainingId)
    if (alternatives.length === 0) return  // przycisk i tak ukryty gdy brak
    const fresh = alternatives[Math.floor(Math.random() * alternatives.length)]
    // Zachowujemy metadata sesji (slot, pkt, multiplier) — tylko treść się zmienia.
    const merged = {
      ...fresh,
      _slot: current._slot,
      _slotLabel: current._slotLabel,
      _slotEmoji: current._slotEmoji,
      _pts: current._pts,
      _multiplier: current._multiplier,
      _isCooldown: current._isCooldown,
    }
    setTrainings(prev => prev.map(t => t.id === trainingId ? merged : t))
    try {
      localStorage.setItem(`hc:swap:${TODAY}:${trainingId}`, JSON.stringify(merged))
    } catch { /* localStorage może być pełne lub zablokowane */ }
    bustCache(`trainings:${TODAY}`)
  }

  async function markTrainingDone(trainingId) {
    if (!profile) return

    // Sprawdź lokalny stan — bez czytania z DB
    const currentCompleted = activityLog?.trainings_completed || []
    if (currentCompleted.includes(trainingId)) return

    const newCompleted = [...currentCompleted, trainingId]
    const allDone = newCompleted.length >= trainings.length

    // ── OPTIMISTIC: karta zaznacza się NATYCHMIAST, przed jakimkolwiek request ──
    setActivityLog(prev => ({
      ...(prev || { user_id: profile.id, date: TODAY }),
      trainings_completed: newCompleted,
      all_done: allDone,
    }))
    bustCache(`log:${profile.id}:${TODAY}`)

    // ── DB: upsert logu + fresh profil lecą RÓWNOLEGLE ──
    const [{ data: savedLog }, { data: freshProfile }] = await Promise.all([
      supabase.from('activity_log')
        .upsert(
          { user_id: profile.id, date: TODAY, trainings_completed: newCompleted, all_done: allDone },
          { onConflict: 'user_id,date' }
        )
        .select().single(),
      supabase.from('profiles')
        .select('streak, longest_streak, last_active')
        .eq('id', profile.id)
        .single(),
    ])

    // Synchronizuj z faktycznym stanem z DB (na wypadek rozbieżności)
    if (savedLog) setActivityLog(savedLog)

    // ── Streak ──
    if ((freshProfile?.last_active || '').slice(0, 10) !== TODAY) {
      const newStreak = nextStreakValue(freshProfile?.last_active, freshProfile?.streak)
      const { error: strErr } = await supabase.from('profiles').update({
        streak:         newStreak,
        longest_streak: Math.max(newStreak, freshProfile?.longest_streak || 0),
        last_active:    TODAY,
      }).eq('id', profile.id)
      if (!strErr) { await refreshProfile(); setStreakToast(newStreak) }
    }

    // ── Punkty ──
    const training = trainings.find(t => t.id === trainingId)
    const points = (training?._pts || 1) * (training?._multiplier || 1)
    const weekNumber = calendarWeekNumber(new Date())
    // Supabase queries są lazy — bez .then()/await request NIE LECI.
    // Upsert z ignoreDuplicates: idempotentne wobec UNIQUE (user_id,
    // training_id, date, source) — kliknięcie dwa razy / na dwóch
    // urządzeniach NIE podwaja punktów (DB odrzuca dublet).
    supabase.from('points_log').upsert(
      {
        user_id: profile.id, training_id: trainingId,
        points, week_number: weekNumber, date: TODAY, source: 'training',
      },
      { onConflict: 'user_id,training_id,date,source', ignoreDuplicates: true }
    ).then(({ error }) => {
      if (error) console.error('[points_log upsert]', error)
      // Reconciliation: po zapisie pobierz PRAWDZIWĄ sumę z DB. Single
      // source of truth — uleczalne nawet jeśli optimistic math się rozjedzie
      // (multiplier zmieniony, dublet na innym urządzeniu, drift cache).
      reconcileReportScore()
    })
    // Optimistic update — wynik rośnie natychmiast bez czekania na refresh
    setReportScore(prev => prev + points)
    bustCache(`report:${profile.id}`)

    if (allDone) setShowDayDoneModal(true)
    setTimeout(() => checkAchievements(trainingId, allDone), 0)

    // ── DEV ONLY (buildy dev — wycinane z produkcji): każdy trening wyzwala modal awansu areny ──────
    // Pobiera ŚWIEŻE dane z DB (profile w closure może być stary). Cykl:
    //   0→1→2→3→4→5→0→1→... (Elite wraca do Street Court i pokazuje 0→1)
    // prevXp = próg prevLevel (nie DB xp) → pasek zawsze liczy W GÓRĘ, nie w dół.
    if (import.meta.env.DEV) {
      const DEV_T = ARENA_META.map(a => a.threshold)
      const DEV_N = ARENA_META.map(a => a.name)
      const { data: devFresh } = await supabase
        .from('profiles').select('xp,arena_level').eq('id', profile.id).single()
      const currLevel = devFresh?.arena_level ?? 0
      // Gdy na Elite (lub wyżej) — wróć do Street Court i pokaż awans 0→1
      const prevLevel = currLevel >= DEV_T.length - 1 ? 0 : currLevel
      const nextLevel = prevLevel + 1
      await supabase.from('profiles')
        .update({ xp: DEV_T[nextLevel], arena_level: nextLevel })
        .eq('id', profile.id)
      await refreshProfile()
      const arenaPayload = {
        xpGained:      0,
        prevXp:        DEV_T[prevLevel],   // próg prevLevel → pasek liczy w górę
        prevArenaName: DEV_N[prevLevel],
        arenaUp:       true,
        arenaName:     DEV_N[nextLevel],
      }
      if (allDone) {
        pendingArenaToastRef.current = arenaPayload
      } else {
        setWeeklyXpToast(arenaPayload)
      }
    }
    // ── koniec bloku DEV ──
  }

  async function unmarkTrainingDone(trainingId) {
    if (!profile || !activityLog) return
    const completed = activityLog.trainings_completed || []
    if (!completed.includes(trainingId)) return
    const newCompleted = completed.filter(id => id !== trainingId)

    // ── OPTIMISTIC: cofnij zaznaczenie natychmiast ──
    setActivityLog(prev => ({ ...prev, trainings_completed: newCompleted, all_done: false }))
    bustCache(`log:${profile.id}:${TODAY}`)

    // Optimistic decrement reportScore — żeby cyfra spadała razem z odznaczeniem
    const trainingForPoints = trainings.find(t => t.id === trainingId)
    const undoPoints = (trainingForPoints?._pts || 1) * (trainingForPoints?._multiplier || 1)
    setReportScore(prev => Math.max(0, prev - undoPoints))
    bustCache(`report:${profile.id}`)

    // DB w tle równolegle
    await Promise.all([
      supabase.from('activity_log')
        .update({ trainings_completed: newCompleted, all_done: false })
        .eq('id', activityLog.id),
      supabase.from('points_log')
        .delete()
        .eq('user_id', profile.id)
        .eq('training_id', trainingId)
        .eq('date', TODAY),
      supabase.from('shooting_sessions')
        .delete()
        .eq('user_id', profile.id)
        .eq('training_id', trainingId)
        .eq('session_date', TODAY),
    ])
    // Reconciliation — patrz markTrainingDone.
    reconcileReportScore()

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

    // Cofnij early_bird (i jego punkty) jeśli nie ma już żadnych ukończonych treningów dziś
    if (newCompleted.length === 0) {
      const earlyBirdKey = `early_bird_${TODAY}`
      await Promise.all([
        supabase.from('user_achievements')
          .delete()
          .eq('user_id', profile.id)
          .eq('achievement_id', earlyBirdKey),
        supabase.from('points_log')
          .delete()
          .eq('user_id', profile.id)
          .eq('achievement_id', earlyBirdKey),
      ])
    }
  }

  // ── Sprawdź czy odblokowano nowe osiągnięcie ─────────────────────────────
  async function checkAchievements(completedTrainingId, newAllDone) {
    if (!profile) return

    const weekNumber = calendarWeekNumber(new Date())

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
      const achKey = `${baseId}_${n}`
      await supabase.from('user_achievements').insert({
        user_id: profile.id,
        achievement_id: achKey,
        base_id: baseId,
      })
      const stage = (ach.stages || [])[0]
      notifyAchievement({ title: ach.title, stage })
      if (stage?.medal) await awardMedalPoints(profile.id, stage.medal, weekNumber, achKey)
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
          await awardMedalPoints(profile.id, stage.medal, weekNumber, stageKey)
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
            if (comebackStage?.medal) await awardMedalPoints(profile.id, comebackStage.medal, weekNumber, 'comeback_1')
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
          if (earlyStage?.medal) await awardMedalPoints(profile.id, earlyStage.medal, weekNumber, dateKey)
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
              if (stalStage?.medal) await awardMedalPoints(profile.id, stalStage.medal, weekNumber, dateKey)
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


  // Only the first name in the greeting — a two-part "Imię Nazwisko" shows just "Imię".
  const firstName = profile?.name ? profile.name.trim().split(/\s+/)[0] : ''
  const greeting = firstName ? t('greetingHi', { name: firstName }) : t('greetingDefault')

  const slots = [
    { key: 'morning',  label: t('slots.morning'),  emoji: '🌅' },
    { key: 'main',     label: t('slots.main'),   emoji: '🏀' },
    { key: 'recovery', label: t('slots.recovery'),    emoji: '🧘' },
  ]

  const scoreColor = reportScore >= 750 ? 'var(--green-shot)' : reportScore >= 500 ? 'var(--orange-hot)' : reportScore >= 250 ? 'var(--orange)' : 'var(--text-dim)'
  const scoreLabel = reportScore >= 750 ? t('report.scoreLabels.great') : reportScore >= 500 ? t('report.scoreLabels.good') : reportScore >= 250 ? t('report.scoreLabels.start') : t('report.scoreLabels.training')

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
      {/* Tło fokusowane na hexagonie raportu — 3 niebieskie światła:
          góra-środek (nad hexem), lewo i prawo lekko poniżej środka hexa.
          Daje wrażenie głębi za ringiem na górze strony. */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: -1,
        background: `
          radial-gradient(ellipse 80% 45% at 50% -5%,  rgba(91,184,245,0.22) 0%, transparent 62%),
          radial-gradient(ellipse 55% 45% at -8% 36%, rgba(91,184,245,0.16) 0%, transparent 60%),
          radial-gradient(ellipse 55% 45% at 108% 36%,rgba(91,184,245,0.16) 0%, transparent 60%),
          linear-gradient(170deg, #0C1F38 0%, #091828 42%, #060F1E 100%)
        `,
      }} />
      <SettingsPanel open={showSettings} onClose={closeSettings} />
      <LeagueInfoPanel open={leagueOpen} onClose={closeLeague} />
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
      <AnimatePresence>
        {showArenaRoad && (
          <Suspense fallback={null}>
            <ArenaRoad
              xp={profile?.xp ?? 0}
              onClose={() => setShowArenaRoad(false)}
            />
          </Suspense>
        )}
      </AnimatePresence>
      <StreakToast streak={streakToast} visible={streakToast > 0} onHide={() => setStreakToast(0)} />
      {/* Arena awans → pełnoekranowy modal; samo XP (bez awansu) → mały toast z góry */}
      <XpReportToast  data={weeklyXpToast?.arenaUp ? null : weeklyXpToast} onClose={() => setWeeklyXpToast(null)} />
      <ArenaUpModal   data={weeklyXpToast?.arenaUp ? weeklyXpToast   : null} onClose={() => setWeeklyXpToast(null)} />

      {/* Header — identical structure to StatsPage */}
      <div style={{ padding: 'max(52px, calc(env(safe-area-inset-top) + 20px)) 22px 0' }}>
        {/* (data usunięta — miejsce zarezerwowane na przyszłe saldo punktów) */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <div>
            {/* Name — clickable when frame notification pending */}
            <motion.div
              style={{ display: 'inline-flex', alignItems: 'center', gap: 8,
                cursor: hasPendingFrame ? 'pointer' : 'default' }}
              onClick={hasPendingFrame ? openFrameNotif : undefined}
              whileTap={hasPendingFrame ? { scale: 0.97 } : {}}
            >
              <h1 className="display-title" style={{ fontSize: 38, margin: 0 }}>{greeting}</h1>
              {hasPendingFrame && (
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 500, damping: 18 }}
                  style={{
                    width: 11, height: 11, borderRadius: '50%',
                    background: '#FF3B30',
                    boxShadow: '0 0 8px 3px rgba(255,59,48,0.59)',
                    border: '2px solid rgba(4,8,14,0.90)',
                    flexShrink: 0,
                  }}
                >
                  <motion.div
                    animate={{ opacity: [1, 0.3, 1] }}
                    transition={{ duration: 1.6, repeat: Infinity, ease: 'easeInOut' }}
                    style={{ width: '100%', height: '100%', borderRadius: '50%',
                      background: '#FF3B30' }}
                  />
                </motion.div>
              )}
            </motion.div>
          </div>
          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
            {/* Notifications bell — red dot when any unread */}
            <motion.button
              whileTap={{ scale: 0.82 }}
              onClick={() => setNotificationsOpen(true)}
              style={{
                background: 'none', border: 'none',
                width: 40, height: 40, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                color: 'rgba(200,210,230,0.55)',
                position: 'relative',
              }}
              aria-label={t('notificationsAria')}
            >
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/>
                <path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>
              </svg>
              {notifUnreadCount > 0 && (
                <span style={{
                  position: 'absolute',
                  top: 7, right: 7,
                  width: 10, height: 10, borderRadius: '50%',
                  background: '#FF3B30',
                  boxShadow: '0 0 6px 2px rgba(255,59,48,0.50)',
                  border: '2px solid rgba(4,8,14,0.9)',
                }}/>
              )}
            </motion.button>
            {/* Quote / sparkle */}
            <motion.button whileTap={{ scale: 0.82 }} onClick={() => setShowQuote(true)} style={{
              background: 'none', border: 'none',
              width: 40, height: 40, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(200,210,230,0.55)',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 2 L13.5 10.5 L22 12 L13.5 13.5 L12 22 L10.5 13.5 L2 12 L10.5 10.5 Z"/>
              </svg>
            </motion.button>
            {/* Settings */}
            <motion.button whileTap={{ scale: 0.82 }} onClick={openSettings} style={{
              background: 'none', border: 'none',
              width: 40, height: 40, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'rgba(200,210,230,0.55)',
            }}>
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="3"/>
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/>
              </svg>
            </motion.button>
          </div>
        </div>
      </div>

      {/* Ocena Raportu */}
      <div style={{ padding: '0 22px 4px' }}>
        {/* Label + badge */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <p className="section-label" style={{ marginBottom: 2 }}>{daysUntilReport === 0 ? t('report.draftScore') : t('report.scoutingReport')}</p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18, color: 'var(--text-primary)', letterSpacing: 0.5, textTransform: 'uppercase' }}>
              {t('report.yourProgress')}
            </p>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {!daysUntilReport && !reportLoading && (
              // Tap → re-open the intro story onboarding.
              <button
                onClick={() => setStoryOpen(true)}
                aria-label={scoreLabel}
                style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  padding: '4px 11px',
                  background: `${scoreColor}18`,
                  border: `1px solid ${scoreColor}40`,
                  borderRadius: 'var(--radius-full)',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10,
                  color: scoreColor, letterSpacing: 1.5, textTransform: 'uppercase',
                  cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
                }}>
                {scoreLabel}
                <span aria-hidden="true" style={{
                  display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                  width: 13, height: 13, borderRadius: '50%',
                  border: `1px solid ${scoreColor}`, fontSize: 8.5, lineHeight: 1, fontWeight: 900,
                }}>?</span>
              </button>
            )}
          </div>
        </div>

        <div
          onClick={() => setShowArenaRoad(true)}
          role="button" tabIndex={0}
          style={{ cursor: 'pointer' }}
        >
          <ReportRatingRing
            score={import.meta.env.DEV ? 800 : reportScore}
            daysLeft={daysUntilReport}
            loading={reportLoading}
            arenaLevel={profile?.arena_level ?? 0}
            devPreviewLevel={devPreviewLevel}
            setDevPreviewLevel={setDevPreviewLevel}
          />
        </div>

        {import.meta.env.DEV && (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 12 }}>
            <button onClick={devTriggerArenaUp} className="btn-ghost" style={{ fontSize: 11, padding: '8px 14px' }}>
              {t('report.devShowArenaUp')}
            </button>
            <button
              onClick={() => setDevPreviewLevel(l => l === 0 ? 6 : 0)}
              className="btn-ghost" style={{ fontSize: 11, padding: '8px 14px' }}
            >
              DEV: {devPreviewLevel === 0 ? t('report.devShowFrame') : t('report.devNoFrame')}
            </button>
          </div>
        )}

        {/* Info below ring */}
        <div style={{ textAlign: 'center', marginTop: 16 }}>
          {daysUntilReport > 0 ? (
            <p style={{ color: 'var(--text-dim)', fontSize: 12, lineHeight: 1.6 }}>
              {t('report.firstReportPrefix')}{' '}
              <span style={{ color: 'var(--orange)', fontWeight: 600 }}>{daysUntilReport} {daysUntilReport === 1 ? t('report.dayOne') : t('report.dayMany')}</span>.
              <br />{t('report.trainMore')}
            </p>
          ) : (
            <>
              <div style={{ width: '70%', margin: '0 auto 10px', height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2, overflow: 'hidden' }}>
                <div style={{ height: '100%', background: scoreColor, borderRadius: 2, width: `${progress}%` }} />
              </div>
              <span style={{ color: 'var(--text-secondary)', fontSize: 12, fontWeight: 500 }}>
                {t('report.sessionsCompletedToday', { completed: completed.length, total: trainings.length })}
              </span>
              {activityLog?.all_done && !showDayDoneModal && (
                <div style={{ marginTop: 8 }}><span className="badge badge-green">{t('report.dayCompleted')}</span></div>
              )}
            </>
          )}
        </div>

      </div>


      {/* Separator — horizontal fade gradient (zamiast twardej kreski 1px) */}
      <div style={{
        height: 1,
        margin: '14px 22px',
        background: 'linear-gradient(90deg, transparent 0%, rgba(180,210,255,0.18) 50%, transparent 100%)',
      }} />

      {/* Team practice cards — pokazują się gdy trener zaplanował na dzisiaj */}
      {teamPractices.length > 0 && (
        <div style={{ padding: '4px 22px 0' }}>
          {teamPractices.map(p => (
            <TeamPracticeCard key={p.practice_id} practice={p} />
          ))}
        </div>
      )}

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
                        onSwap={() => swapTraining(t.id)}
                        canSwap={getSwapAlternatives(t.id).length > 0}
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
