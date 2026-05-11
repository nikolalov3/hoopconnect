import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { CoachAuthProvider, useCoachAuth } from './context/CoachAuthContext'
import './coach.css'

// Lazy-loaded pages
const LandingPage      = lazy(() => import('./pages/LandingPage'))
const AuthPage         = lazy(() => import('./pages/AuthPage'))
const OnboardingPage   = lazy(() => import('./pages/OnboardingPage'))
const DashboardPage    = lazy(() => import('./pages/DashboardPage'))
const TeamPage         = lazy(() => import('./pages/TeamPage'))
const PlayerPage       = lazy(() => import('./pages/PlayerPage'))
const SchedulePage     = lazy(() => import('./pages/SchedulePage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
const TeamsHubPage     = lazy(() => import('./pages/TeamsHubPage'))
const SettingsPage     = lazy(() => import('./pages/SettingsPage'))

const CoachShell = lazy(() => import('./layout/CoachShell'))

function PageLoader() {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: '60vh',
    }}>
      <div className="spinner" />
    </div>
  )
}

/** Redirect rules:
 *   - not logged in     → /login
 *   - logged in, no profile  → /login (shouldn't happen, but defensive)
 *   - logged in, no teams    → /onboarding (force them to create one)
 *   - logged in, has teams   → children
 */
function ProtectedRoute({ children }) {
  const { user, coachProfile, teams, loading, profileReady } = useCoachAuth()
  const location = useLocation()

  if (loading || !profileReady) {
    return <PageLoader />
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (!coachProfile) {
    // Account exists but no coach_profiles row — send back to login to retry
    return <Navigate to="/login" replace />
  }
  if (teams.length === 0 && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }
  return children
}

/** When already logged in and visiting / or /login or /register → go to dashboard */
function PublicRoute({ children }) {
  const { user, coachProfile, teams, profileReady, loading } = useCoachAuth()
  if (loading || !profileReady) return <PageLoader />
  if (user && coachProfile) {
    if (teams.length === 0) return <Navigate to="/onboarding" replace />
    return <Navigate to="/dashboard" replace />
  }
  return children
}

function AppRoutes() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* Public */}
        <Route path="/"          element={<PublicRoute><LandingPage /></PublicRoute>} />
        <Route path="/login"     element={<PublicRoute><AuthPage mode="login" /></PublicRoute>} />
        <Route path="/register"  element={<PublicRoute><AuthPage mode="register" /></PublicRoute>} />

        {/* Onboarding (logged in but no teams) */}
        <Route path="/onboarding" element={
          <ProtectedOnboardingRoute><OnboardingPage /></ProtectedOnboardingRoute>
        }/>

        {/* Protected (panel) */}
        <Route element={<ProtectedRoute><CoachShell /></ProtectedRoute>}>
          <Route path="/dashboard"        element={<DashboardPage />} />
          <Route path="/team"             element={<TeamPage />} />
          <Route path="/team/:playerId"   element={<PlayerPage />} />
          <Route path="/schedule"         element={<SchedulePage />} />
          <Route path="/notifications"    element={<NotificationsPage />} />
          <Route path="/teams"            element={<TeamsHubPage />} />
          <Route path="/settings"         element={<SettingsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  )
}

/** Onboarding has its own gate — must be logged in but allowed with zero teams */
function ProtectedOnboardingRoute({ children }) {
  const { user, coachProfile, profileReady, loading } = useCoachAuth()
  if (loading || !profileReady) return <PageLoader />
  if (!user || !coachProfile) return <Navigate to="/login" replace />
  return children
}

export default function CoachApp() {
  useEffect(() => {
    document.documentElement.classList.add('coach-panel-root')
    document.body.classList.add('coach-panel')
    const prevTitle = document.title
    document.title = 'Panel Trenera | HoopConnect'
    return () => {
      document.documentElement.classList.remove('coach-panel-root')
      document.body.classList.remove('coach-panel')
      document.title = prevTitle
    }
  }, [])

  return (
    <BrowserRouter>
      <CoachAuthProvider>
        <AppRoutes />
      </CoachAuthProvider>
    </BrowserRouter>
  )
}
