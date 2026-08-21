import * as Sentry from '@sentry/react'

let initialized = false

/**
 * Initializes Sentry once per page load.
 *
 * No-op when VITE_SENTRY_DSN is missing (local dev without DSN, or when
 * we haven't set up the project yet). Safe to call from both PlayerApp
 * and CoachApp entrypoints — second call is ignored.
 *
 * @param {object}   opts
 * @param {'player' | 'coach'} opts.app  which subdomain we're rendering
 */
export function initSentry({ app }) {
  if (initialized) return
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn) return

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,            // 'production' | 'development'
    release: import.meta.env.VITE_RELEASE || undefined,

    // Free tier: 10k spans/month — keep traces sparse
    tracesSampleRate: 0.1,

    // Free tier: 50 replays/month — disable until we need it for a bug hunt
    replaysSessionSampleRate: 0,
    replaysOnErrorSampleRate: 0,

    integrations: [
      Sentry.browserTracingIntegration(),
    ],

    // Tag every event with which app produced it
    initialScope: { tags: { app } },

    // Don't spam Sentry with noisy known errors
    ignoreErrors: [
      'ResizeObserver loop limit exceeded',
      'ResizeObserver loop completed with undelivered notifications',
      // Auth flow cancellations / aborts
      'AbortError',
      'NetworkError when attempting to fetch resource',
    ],

    beforeSend(event) {
      // In dev mode we want to see issues in console, not Sentry
      if (import.meta.env.DEV) return null
      return event
    },
  })

  initialized = true
}

/**
 * Attach (or detach) the currently logged-in user to Sentry events.
 * Call from AuthContext when user changes.
 */
export function setSentryUser(user) {
  if (!initialized) return
  if (user) {
    Sentry.setUser({ id: user.id, email: user.email })
  } else {
    Sentry.setUser(null)
  }
}

/** Re-export the React ErrorBoundary — wrap each app's root with it. */
export const SentryErrorBoundary = Sentry.ErrorBoundary
