import { lazy, Suspense, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import './coach.css'

// Lazy-loaded pages
const LandingPage      = lazy(() => import('./pages/LandingPage'))
const AuthPage         = lazy(() => import('./pages/AuthPage'))
const DashboardPage    = lazy(() => import('./pages/DashboardPage'))
const TeamPage         = lazy(() => import('./pages/TeamPage'))
const PlayerPage       = lazy(() => import('./pages/PlayerPage'))
const SchedulePage     = lazy(() => import('./pages/SchedulePage'))
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'))
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

export default function CoachApp() {
  // Apply coach-panel class to <html> and <body> for global style overrides.
  // The player app's index.css clamps #root to max-width:430px and locks overflow,
  // which breaks the desktop layout — these classes opt out of those rules.
  // Also swap the browser-tab title so the trener.* tab is distinguishable from
  // the main app (index.html ships a single hard-coded <title>).
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
      <Suspense fallback={<PageLoader />}>
        <Routes>
          {/* Public */}
          <Route path="/"          element={<LandingPage />} />
          <Route path="/login"     element={<AuthPage mode="login" />} />
          <Route path="/register"  element={<AuthPage mode="register" />} />

          {/* Protected (panel) — wrapped in CoachShell with sidebar */}
          <Route element={<CoachShell />}>
            <Route path="/dashboard"        element={<DashboardPage />} />
            <Route path="/team"             element={<TeamPage />} />
            <Route path="/team/:playerId"   element={<PlayerPage />} />
            <Route path="/schedule"         element={<SchedulePage />} />
            <Route path="/notifications"    element={<NotificationsPage />} />
            <Route path="/settings"         element={<SettingsPage />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  )
}
