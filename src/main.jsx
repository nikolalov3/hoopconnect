import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import { initSentry, SentryErrorBoundary } from './lib/sentry'
import AppErrorFallback from './components/ui/AppErrorFallback'

// Subdomain-based app split:
//   trener.hoopconnect.pl → CoachApp  (light theme, sidebar, B2B panel for coaches)
//   hoopconnect.pl        → App        (existing player app)
const isCoachSubdomain =
  typeof window !== 'undefined' &&
  window.location.hostname.startsWith('trener.')

// Initialize Sentry before anything renders so it captures early errors too.
// No-op if VITE_SENTRY_DSN is not set (current default).
initSentry({ app: isCoachSubdomain ? 'coach' : 'player' })

const root = createRoot(document.getElementById('root'))

const fallback = ({ error, resetError }) => (
  <AppErrorFallback error={error} resetError={resetError} />
)

if (isCoachSubdomain) {
  import('./coach/CoachApp.jsx').then(({ default: CoachApp }) => {
    root.render(
      <StrictMode>
        <SentryErrorBoundary fallback={fallback} showDialog={false}>
          <CoachApp />
        </SentryErrorBoundary>
        <SpeedInsights />
      </StrictMode>,
    )
  })
} else {
  import('./App.jsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <SentryErrorBoundary fallback={fallback} showDialog={false}>
          <App />
        </SentryErrorBoundary>
        <SpeedInsights />
      </StrictMode>,
    )
  })
}
