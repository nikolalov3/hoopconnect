/**
 * Last-resort UI shown when ErrorBoundary catches an uncaught render error.
 * Used by both PlayerApp and CoachApp via SentryErrorBoundary.
 */
export default function AppErrorFallback({ error, resetError }) {
  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
      background: '#0A0D13',
      color: '#EEF4FF',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>
      <div style={{
        maxWidth: 420,
        textAlign: 'center',
      }}>
        <div style={{
          fontSize: 56,
          marginBottom: 16,
          opacity: 0.6,
        }}>⚠</div>

        <h1 style={{
          fontSize: 22,
          fontWeight: 700,
          margin: '0 0 10px',
          letterSpacing: '-0.3px',
        }}>
          Coś poszło nie tak
        </h1>

        <p style={{
          fontSize: 14,
          color: '#8AAEC8',
          lineHeight: 1.55,
          margin: '0 0 24px',
        }}>
          Aplikacja napotkała nieoczekiwany błąd. Zostaliśmy o nim powiadomieni.
          Spróbuj odświeżyć stronę.
        </p>

        <div style={{ display: 'flex', gap: 10, justifyContent: 'center', flexWrap: 'wrap' }}>
          <button
            onClick={() => { resetError?.(); window.location.reload() }}
            style={{
              padding: '11px 22px',
              borderRadius: 12,
              border: 'none',
              background: 'linear-gradient(135deg, #5BB8F5 0%, #2272C3 100%)',
              color: '#FFFFFF',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Odśwież
          </button>
          <button
            onClick={() => { window.location.href = '/' }}
            style={{
              padding: '11px 22px',
              borderRadius: 12,
              border: '1px solid rgba(120,190,255,0.22)',
              background: 'transparent',
              color: '#EEF4FF',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Na start
          </button>
        </div>

        {import.meta.env.DEV && error && (
          <pre style={{
            marginTop: 24,
            padding: 12,
            background: 'rgba(255,61,61,0.08)',
            border: '1px solid rgba(255,61,61,0.22)',
            borderRadius: 10,
            fontSize: 11,
            textAlign: 'left',
            color: '#FF8888',
            maxHeight: 200,
            overflow: 'auto',
          }}>
            {String(error?.stack || error?.message || error)}
          </pre>
        )}
      </div>
    </div>
  )
}
