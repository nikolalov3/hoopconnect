import { lazy, Suspense, useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { AuthProvider, useAuth } from './context/AuthContext'
import { UIProvider } from './context/UIContext'
import BottomNav from './components/ui/BottomNav'

// Lazy-loaded pages — each page loads as a separate JS chunk
const AuthPage        = lazy(() => import('./pages/AuthPage'))
const OnboardingPage  = lazy(() => import('./pages/OnboardingPage'))
const HomePage        = lazy(() => import('./pages/HomePage'))
const ShootingPage    = lazy(() => import('./pages/ShootingPage'))
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
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const path = location.pathname
  const isTabRoute  = TAB_PATHS.has(path)
  const inShooting  = path.startsWith('/shooting')
  const inOnboarding = path === '/onboarding'
  const showNav     = !inShooting && !inOnboarding

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

  if (loading) {
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

  if (profile && !profile.onboarding_done && path !== '/onboarding') {
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
                  // visibility:hidden keeps component mounted + scroll position intact
                  // Only the active tab is interactive and visible
                  visibility: (isTabRoute && path === tabPath) ? 'visible' : 'hidden',
                  pointerEvents: (isTabRoute && path === tabPath) ? 'auto' : 'none',
                  display: 'flex', flexDirection: 'column', overflow: 'hidden',
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
                <Route path="/onboarding"   element={<OnboardingPage />} />
              </Routes>
            </AnimatePresence>
          )}

        </div>

      </Suspense>

      {showNav && <BottomNav />}
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
