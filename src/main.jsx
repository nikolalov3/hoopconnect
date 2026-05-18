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

// Build-version cache bust:
// iOS Safari (zwłaszcza w trybie „Add to Home Screen") agresywnie cache'uje
// bundle. Bez tego użytkownik mógł chodzić po dniach na starym JS-ie i widzieć
// niespójny stan z DB. __BUILD_ID__ jest wstrzykiwane przez Vite (define) na
// build time — przy każdym deployu jest inne, więc client wykrywa zmianę,
// czyści localStorage cache apki i przeładowuje stronę.
try {
  const BUILD_ID = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'
  const stored = localStorage.getItem('hc_build_id')
  if (stored && stored !== BUILD_ID) {
    localStorage.setItem('hc_build_id', BUILD_ID)
    // Wyczyść persistent cache (trainings/quotes/catalog mogą się zmienić w deployu)
    Object.keys(localStorage)
      .filter(k => k.startsWith('hc:pc:'))
      .forEach(k => localStorage.removeItem(k))
    // Soft reload — pobierze świeży index.html i nowe bundle'e
    if (!sessionStorage.getItem('hc_build_reloaded')) {
      sessionStorage.setItem('hc_build_reloaded', '1')
      window.location.reload()
    }
  } else {
    localStorage.setItem('hc_build_id', BUILD_ID)
    sessionStorage.removeItem('hc_build_reloaded')
  }
} catch { /* localStorage może być zablokowany */ }

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
