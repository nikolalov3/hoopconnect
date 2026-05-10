import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { SpeedInsights } from '@vercel/speed-insights/react'
import './index.css'

// Subdomain-based app split:
//   trener.hoopconnect.pl → CoachApp  (light theme, sidebar, B2B panel for coaches)
//   hoopconnect.pl        → App        (existing player app)
const isCoachSubdomain =
  typeof window !== 'undefined' &&
  window.location.hostname.startsWith('trener.')

const root = createRoot(document.getElementById('root'))

if (isCoachSubdomain) {
  import('./coach/CoachApp.jsx').then(({ default: CoachApp }) => {
    root.render(
      <StrictMode>
        <CoachApp />
        <SpeedInsights />
      </StrictMode>,
    )
  })
} else {
  import('./App.jsx').then(({ default: App }) => {
    root.render(
      <StrictMode>
        <App />
        <SpeedInsights />
      </StrictMode>,
    )
  })
}
