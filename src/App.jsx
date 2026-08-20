import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { AuthProvider, useAuth } from './context/AuthContext'
import { UIProvider, useUI } from './context/UIContext'
import { NotificationsProvider } from './context/NotificationsContext'
import BottomNav from './components/ui/BottomNav'
import LeaderboardDrawer from './components/ui/LeaderboardDrawer'
import FrameUnlockPanel from './components/ui/FrameUnlockPanel'
import NotificationsSheet from './components/ui/NotificationsSheet'
import { FRAME_CATALOG, frameSeenKey } from './lib/frames'

// ── Frame reward configs ──────────────────────────────────────────────────────
const SEASON_1_END = new Date('2026-08-24T00:00:00')
const DIAMOND_MIN  = 820   // weekly avg threshold for Diamond tier

// Lazy-loaded pages — each page loads as a separate JS chunk
// AuthPage is the GUARANTEED first screen for every logged-out visitor, so it is
// imported statically (part of the initial graph, no lazy chunk hop before the LCP).
import AuthPage from './pages/AuthPage'
const SetNewPasswordPage = lazy(() => import('./pages/SetNewPasswordPage'))
const OnboardingPage  = lazy(() => import('./pages/OnboardingPage'))
const HomePage        = lazy(() => import('./pages/HomePage'))
const ShootingPage    = lazy(() => import('./pages/ShootingPage'))
const CalendarPage    = lazy(() => import('./pages/CalendarPage'))
const StatsPage       = lazy(() => import('./pages/StatsPage'))
const AchievementsPage = lazy(() => import('./pages/AchievementsPage'))
const RecoveryPage    = lazy(() => import('./pages/RecoveryPage'))
const ClubPage        = lazy(() => import('./pages/ClubPage'))
const JoinClubPage    = lazy(() => import('./pages/JoinClubPage'))
const CardLab         = lazy(() => import('./pages/CardLab'))
const QrLandingPage   = lazy(() => import('./pages/QrLandingPage'))
const ArenaRoad       = lazy(() => import('./components/ArenaRoad'))
const KingOfTheCourt  = lazy(() => import('./features/kotc/KingOfTheCourt'))
const KotcOnline      = lazy(() => import('./features/kotc/KotcOnline'))
const AppOnboarding   = lazy(() => import('./components/ui/AppOnboarding'))

// Wrapper trasy /arena — XP z profilu, powrót przyciskiem wstecz
function ArenaRoadRoute() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  return <ArenaRoad xp={profile?.xp || 0} onClose={() => navigate(-1)} />
}

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
  const { t } = useTranslation('frames')
  const { user, profile, loading, profileReady, recovery } = useAuth()
  const { leaderboardOpen, frameUnlockOpen, setFrameUnlockOpen, frameUnlockData, setFrameUnlockData, storyOpen, setStoryOpen, navHidden } = useUI()
  const location = useLocation()

  // ── Story onboarding ─────────────────────────────────────────────────────────
  // Auto-opens once right after registration (OnboardingPage sets `hc_story_pending`
  // on finish); can also be re-opened on demand from the report badge (setStoryOpen).
  useEffect(() => {
    if (profile?.onboarding_done && localStorage.getItem('hc_story_pending')) {
      setStoryOpen(true)
    }
  }, [profile?.onboarding_done, location.pathname])

  // Dane dla FrameUnlockPanel — budowane z FRAME_CATALOG (lib/frames.js),
  // tylko tłumaczenia dociągane tutaj (t() nie działa poza komponentem).
  const FRAMES = Object.fromEntries(FRAME_CATALOG.map(f => [f.id, {
    id: f.id, path: f.path, rarity: f.rarity,
    label: t(`${f.i18nKey}.label`), sublabel: t(`${f.i18nKey}.sublabel`), description: t(`${f.i18nKey}.description`),
  }]))

  // ── Frame reward — load pending frame into UIContext (shows red dot) ─────────
  // Panel opens only when user taps the notification dot (in HomePage header).
  // Priority: Early Access (every new user, immediately) → Diamond S1 (from Aug 24).
  useEffect(() => {
    if (!profile || !user) return
    const now = new Date()

    // 1. Early Access — every registered user gets it immediately on first login.
    //    Once they open the panel (FrameUnlockPanel.onClose → localStorage mark),
    //    the dot disappears permanently.
    const seenEA = frameSeenKey('early_access', user.id)
    if (!localStorage.getItem(seenEA)) {
      setFrameUnlockData(FRAMES.early_access)
      return
    }

    // 2. Diamond S1 — shown from Aug 24 to players who reached Diamond avg
    if (now >= SEASON_1_END) {
      const seenD = frameSeenKey('diamond_s1', user.id)
      if (!localStorage.getItem(seenD)) {
        if ((profile.weekly_points || 0) >= DIAMOND_MIN) {
          setFrameUnlockData(FRAMES.diamond_s1)
        }
      }
    }

    // 3. autoGrantSilent frames (np. Friends & Family) — przyznawane ręcznie
    //    w bazie, bez ekranu unlock. Mark "seen" jak tylko raz zaobserwujemy
    //    equipped_frame === id, żeby zostały wybieralne w Ustawieniach na stałe,
    //    nawet po przełączeniu na inną ramkę. Nowa ramka z autoGrantSilent:true
    //    w katalogu dostaje to za darmo, bez zmian w tym pliku.
    for (const f of FRAME_CATALOG) {
      if (!f.autoGrantSilent) continue
      const seenKey = frameSeenKey(f.id, user.id)
      if (profile.equipped_frame === f.id && !localStorage.getItem(seenKey)) {
        localStorage.setItem(seenKey, '1')
      }
    }
  }, [profile?.id, profile?.equipped_frame]) // run once when profile loads + when frame changes
  const path = location.pathname
  const isTabRoute  = TAB_PATHS.has(path)
  const inShooting   = path.startsWith('/shooting')
  const inOnboarding = path === '/onboarding'
  const inCalendar   = path === '/calendar'
  const inArena      = path === '/arena'
  const showNav      = !inShooting && !inOnboarding && !inCalendar && !inArena && !navHidden

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

  // Reset hasła z maila → ekran ustawienia nowego hasła (ma pierwszeństwo nad resztą).
  if (recovery) {
    return (
      <Suspense fallback={<PageLoader />}>
        <SetNewPasswordPage />
      </Suspense>
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
                <Route path="/arena"        element={<ArenaRoadRoute />} />
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

      {/* ── In-app notifications sheet (team invites etc) ── */}
      <NotificationsSheet />

      {/* ── Story onboarding — first run after signup, or re-opened from the report badge ── */}
      {storyOpen && (
        <Suspense fallback={null}>
          <AppOnboarding onDone={() => { localStorage.removeItem('hc_story_pending'); setStoryOpen(false) }} />
        </Suspense>
      )}
    </div>
  )
}

function AuthRoute() {
  const { user, loading } = useAuth()
  // Optimistic paint: AuthPage is a static, network-free shell — render it
  // immediately instead of blanking while the session probe resolves. Only once
  // the probe confirms a logged-in user do we redirect away.
  if (!loading && user) {
    const returnTo = localStorage.getItem('hc_returnTo')
    if (returnTo) {
      localStorage.removeItem('hc_returnTo')
      return <Navigate to={returnTo} replace />
    }
    return <Navigate to="/" replace />
  }
  return <AuthPage />
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <UIProvider>
          <NotificationsProvider>
          <Routes>
            <Route path="/auth"            element={<AuthRoute />} />
            <Route path="/qrhc"            element={
              <Suspense fallback={<PageLoader />}>
                <QrLandingPage />
              </Suspense>
            } />
            <Route path="/dolacz/:clubId"  element={
              <Suspense fallback={<PageLoader />}>
                <JoinClubPage />
              </Suspense>
            } />
            <Route path="/kotc"            element={
              <Suspense fallback={<PageLoader />}>
                <KingOfTheCourt />
              </Suspense>
            } />
            <Route path="/kotc-live"       element={
              <Suspense fallback={<PageLoader />}>
                <KotcOnline />
              </Suspense>
            } />
            <Route path="/cardlab"         element={
              <Suspense fallback={<PageLoader />}>
                <CardLab />
              </Suspense>
            } />
            <Route path="/onboardlab"      element={
              <Suspense fallback={<PageLoader />}>
                <OnboardingPage />
              </Suspense>
            } />
            <Route path="/kotclab"         element={
              <Suspense fallback={<PageLoader />}>
                <KotcOnline onClose={() => { window.location.href = '/' }} />
              </Suspense>
            } />
            <Route path="/arenalab"        element={
              <Suspense fallback={<PageLoader />}>
                <ArenaRoad xp={2500} onClose={() => { window.location.href = '/' }} />
              </Suspense>
            } />
            <Route path="/*"               element={<AppShell />} />
          </Routes>
          </NotificationsProvider>
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
