import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'
import { initSentry, SentryErrorBoundary } from './lib/sentry'
import AppErrorFallback from './components/ui/AppErrorFallback'

// Subdomain-based app split:
//   trener.hoopconnect.pl → CoachApp  (light theme, sidebar, B2B panel for coaches)
//   gu.hoopconnect.pl     → AdminApp  (admin tools: contracts, invoices, history)
//   hoopconnect.pl        → App        (existing player app)
const hostname = (typeof window !== 'undefined' && window.location.hostname) || ''
const isCoachSubdomain = hostname.startsWith('trener.')
const isAdminSubdomain = hostname.startsWith('gu.')

initSentry({
  app: isAdminSubdomain ? 'admin' : isCoachSubdomain ? 'coach' : 'player',
})

const root = createRoot(document.getElementById('root'))

const fallback = ({ error, resetError }) => (
  <AppErrorFallback error={error} resetError={resetError} />
)

if (isAdminSubdomain) {
  import('./admin/AdminApp.jsx').then(({ default: AdminApp }) => {
    root.render(
      <StrictMode>
        <SentryErrorBoundary fallback={fallback} showDialog={false}>
          <AdminApp />
        </SentryErrorBoundary>
        <SpeedInsights />
      </StrictMode>,
    )
  })
} else if (isCoachSubdomain) {
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
