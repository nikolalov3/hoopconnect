import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import { UIProvider, useUI } from './context/UIContext'
import BottomNav from './components/ui/BottomNav'
import LeaderboardDrawer from './components/ui/LeaderboardDrawer'
import FrameUnlockPanel from './components/ui/FrameUnlockPanel'

// ── Frame reward configs ──────────────────────────────────────────────────────
const SEASON_1_END  = new Date('2026-08-24T00:00:00')
const DIAMOND_MIN   = 850   // weekly_points threshold for Diamond tier

const EARLY_ACCESS_CUTOFF = new Date('2026-06-01T00:00:00')
const EARLY_ACCESS_SHOW   = new Date('2026-06-01T00:00:00') // show from this date

const FRAMES = {
  early_access: {
    id:          'early_access',
    path:        '/earlyaccess.png',
    label:       'Early Access',
    rarity:      'rare',
    sublabel:    'Dostęp przed premierą · Sezon 1',
    description: 'Za dołączenie do HoopConnect przed startem pierwszego sezonu. Jesteś częścią historii.',
  },
  diamond_s1: {
    id:          'diamond_s1',
    path:        '/ramkas1diax.png',
    label:       'Diament · Sezon 1',
    rarity:      'legendary',
    sublabel:    'Koniec Sezonu 1 · 24.08.2026',
    description: 'Nagroda za osiągnięcie rangi Diament w pierwszym sezonie HoopConnect. Tylko dla elity.',
  },
}

// Lazy-loaded pages — each page loads as a separate JS chunk
const AuthPage        = lazy(() => import('./pages/AuthPage'))
const OnboardingPage  = lazy(() => import('./pages/OnboardingPage'))
const HomePage        = lazy(() => import('./pages/HomePage'))
const ShootingPage    = lazy(() => import('./pages/ShootingPage'))
const CalendarPage    = lazy(() => import('./pages/CalendarPage'))
const StatsPage       = lazy(() => import('./pages/StatsPage'))
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'))
const RecoveryPage    = lazy(() => import('./pages/RecoveryPage'))
const ClubPage        = lazy(() => import('./pages/ClubPage'))
const JoinClubPage    = lazy(() => import('./pages/JoinClubPage'))

// All main tab routes — rendered always (keep-alive), just CSS show/hide
const TAB_ROUTES = [
  { path: '/',             Component: HomePage },
  { path: '/stats',        Component: StatsPage },
  { path: '/achievements', Component: AchievementsPage },
  { path: '/recovery',     Component: RecoveryPage },
  { path: '/club',         Component: ClubPage },
]
const TAB_PATHS = new Set(TAB_ROUTES.map(r => r.path))

// Minimal spinner shown while a lazy chunk is downloading
function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%',
    }}>
      <div className="spinner" />
    </div>
  )
}

function AppShell() {
  const { user, profile, loading, profileReady } = useAuth()
  const { leaderboardOpen, frameUnlockOpen, setFrameUnlockOpen, frameUnlockData, setFrameUnlockData } = useUI()
  const location = useLocation()

  // ── Frame reward — load pending frame into UIContext (shows red dot) ─────────
  // Panel opens only when user taps the notification dot (in HomePage header).
  // Priority: Early Access (from June 1) → Diamond S1 (from Aug 24).
  useEffect(() => {
    if (!profile || !user) return
    const now = new Date()

    // 1. Early Access — registered before June 1 → show red dot immediately
    const seenEA = `hc_frame_seen_early_access_${user.id}`
    if (!localStorage.getItem(seenEA)) {
      const reg = profile.registration_date ? new Date(profile.registration_date) : null
      if (reg && reg < EARLY_ACCESS_CUTOFF) {
        setFrameUnlockData(FRAMES.early_access)
        return
      }
    }

    // 2. Diamond S1 — Diamond tier, notification shown from Aug 24
    if (now >= SEASON_1_END) {
      const seenD = `hc_frame_seen_diamond_s1_${user.id}`
      if (!localStorage.getItem(seenD)) {
        if ((profile.weekly_points || 0) >= DIAMOND_MIN) {
          setFrameUnlockData(FRAMES.diamond_s1)
        }
      }
    }
  }, [profile?.id]) // run once when profile loads
  const path = location.pathname
  const isTabRoute  = TAB_PATHS.has(path)
  const inShooting   = path.startsWith('/shooting')
  const inOnboarding = path === '/onboarding'
  const inCalendar   = path === '/calendar'
  const showNav      = !inShooting && !inOnboarding && !inCalendar

  // Lazy-mount: a tab mounts on first visit, then stays mounted forever (keep-alive).
  // Switching tabs = instant CSS visibility swap, zero re-fetch, zero remount.
  const [mounted, setMounted] = useState(() => new Set(['/']))
  useEffect(() => {
    if (TAB_PATHS.has(path)) {
      setMounted(prev => {
        if (prev.has(path)) return prev          // already mounted — no re-render
        return new Set([...prev, path])
      })
    }
  }, [path])

  // Czekaj na inicjalny loading sesji LUB pierwszy fetch profilu (tylko raz, nie przy token refresh)
  if (loading || !profileReady) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%',
      }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />

  // Brak profilu lub onboarding nieukończony → zawsze kieruj na onboarding
  if ((!profile || !profile.onboarding_done) && path !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="app-shell">
      <Suspense fallback={<PageLoader />}>

        {/* ── Keep-alive tab container ─────────────────────────────────────── */}
        <div style={{ flex: 1, position: 'relative', overflow: 'hidden' }}>

          {TAB_ROUTES.map(({ path: tabPath, Component }) =>
            mounted.has(tabPath) && (
              <div
                key={tabPath}
                style={{
                  position: 'absolute', inset: 0,
                  // opacity:0 hides everything (incl. backdrop-filter compositing) without
                  // changing DOM layout position — so Framer Motion sees no position delta
                  // and doesn't fire layout/spring animations on tab switch.
                  // translateX changed positions → triggered layout animations (pill slide,
                  // panel slider, training cards wipe-in). opacity doesn't.
                  opacity: (isTabRoute && path === tabPath) ? 1 : 0,
                  pointerEvents: (isTabRoute && path === tabPath) ? 'auto' : 'none',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
                  transition: 'none',  // instant — no fade animation
                }}
              >
                <Component />
              </div>
            )
          )}

          {/* ── Non-tab pages (shooting session, onboarding) ── */}
          {!isTabRoute && (
            <AnimatePresence mode="wait" initial={false}>
              <Routes location={location} key={location.pathname}>
                <Route path="/shooting/:id" element={<ShootingPage />} />
                <Route path="/calendar"     element={<CalendarPage />} />
                <Route path="/onboarding"   element={<OnboardingPage />} />
              </Routes>
            </AnimatePresence>
          )}

        </div>

      </Suspense>

      {isTabRoute && <LeaderboardDrawer />}
      {showNav && <BottomNav />}

      {/* ── Frame unlock panel — global overlay, highest z-index ── */}
      <FrameUnlockPanel
        open={frameUnlockOpen}
        frameData={frameUnlockData}
        onClose={() => { setFrameUnlockOpen(false); setFrameUnlockData(null) }}
      />
    </div>
  )
}

function AuthRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) {
    const returnTo = localStorage.getItem('hc_returnTo')
    if (returnTo) {
      localStorage.removeItem('hc_returnTo')
      return <Navigate to={returnTo} replace />
    }
    return <Navigate to="/" replace />
  }
  return (
    <Suspense fallback={<PageLoader />}>
      <AuthPage />
    </Suspense>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UIProvider>
          <Routes>
            <Route path="/auth"            element={<AuthRoute />} />
            <Route path="/dolacz/:clubId"  element={
              <Suspense fallback={<PageLoader />}>
                <JoinClubPage />
              </Suspense>
            } />
            <Route path="/*"               element={<AppShell />} />
          </Routes>
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
