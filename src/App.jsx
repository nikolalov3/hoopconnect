import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
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

const pageVariants = {
  initial: { opacity: 0, y: 14, scale: 0.985 },
  animate: { opacity: 1, y: 0,  scale: 1 },
  exit:    { opacity: 0, y: -8, scale: 0.99 },
}
const pageTransition = { duration: 0.28, ease: [0.25, 0.46, 0.45, 0.94] }

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

function Tab({ children, fast }) {
  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      transition={fast ? { duration: 0.15, ease: [0.25, 0.46, 0.45, 0.94] } : pageTransition}
      style={{ height: '100%', display: 'flex', flexDirection: 'column' }}
    >
      {children}
    </motion.div>
  )
}

function AppShell() {
  const { user, profile, loading } = useAuth()
  const location = useLocation()
  const inShooting = location.pathname.startsWith('/shooting')

  if (loading) {
    return (
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', flexDirection: 'column', gap: 16,
      }}>
        <div className="spinner" />
      </div>
    )
  }

  if (!user) return <Navigate to="/auth" replace />

  if (profile && !profile.onboarding_done && location.pathname !== '/onboarding') {
    return <Navigate to="/onboarding" replace />
  }

  return (
    <div className="app-shell">
      <Suspense fallback={<PageLoader />}>
        <AnimatePresence mode="wait" initial={false}>
          <Routes location={location} key={location.pathname}>
            <Route path="/"             element={<Tab><HomePage /></Tab>} />
            <Route path="/shooting/:id" element={<ShootingPage />} />
            <Route path="/stats"        element={<Tab><StatsPage /></Tab>} />
            <Route path="/achievements" element={<Tab><AchievementsPage /></Tab>} />
            <Route path="/recovery"     element={<Tab fast><RecoveryPage /></Tab>} />
            <Route path="/onboarding"   element={<OnboardingPage />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
      {!inShooting && location.pathname !== '/onboarding' && <BottomNav />}
    </div>
  )
}

function AuthRoute() {
  const { user, loading } = useAuth()
  if (loading) return null
  if (user) return <Navigate to="/" replace />
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
            <Route path="/auth" element={<AuthRoute />} />
            <Route path="/*"    element={<AppShell />} />
          </Routes>
        </UIProvider>
      </AuthProvider>
    </BrowserRouter>
  )
}
