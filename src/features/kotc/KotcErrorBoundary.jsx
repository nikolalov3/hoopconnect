import { Component } from 'react'

// Lokalny boundary dla King of the Court. Bez niego każdy błąd renderowania w
// KotC bąbelkuje do root-fallbacku Sentry i UBIJA CAŁĄ APKĘ ("coś poszło nie
// tak"). Tu crash jest ZAMKNIĘTY w nakładce KotC: reszta apki żyje, a my
// pokazujemy realną treść błędu (żeby dało się go namierzyć) + „Zamknij".
export default class KotcErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null } }
  static getDerivedStateFromError(error) { return { error } }
  componentDidCatch(error, info) { console.error('[KotC crash]', error, info?.componentStack) }

  render() {
    if (!this.state.error) return this.props.children
    const msg = String(this.state.error?.message || this.state.error)
    return (
      <div style={{
        position: 'fixed', inset: 0, zIndex: 9000, maxWidth: 430, margin: '0 auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        gap: 16, padding: 28, textAlign: 'center',
        background: 'linear-gradient(170deg, #14243E 0%, #0B172A 52%, #060E1A 100%)',
        color: '#EEF4FF', fontFamily: "'Barlow', sans-serif",
      }}>
        <div style={{ fontSize: 20, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Coś padło w King of the Court
        </div>
        <div style={{ fontSize: 12.5, color: 'rgba(238,244,255,0.6)', maxWidth: 340, wordBreak: 'break-word', lineHeight: 1.5 }}>
          {msg}
        </div>
        <button
          onClick={() => { this.setState({ error: null }); this.props.onClose?.() }}
          style={{
            padding: '13px 24px', borderRadius: 12, border: '1px solid rgba(255,255,255,0.22)',
            background: 'linear-gradient(120deg, #5BB8F5, #2272C3)', color: '#060B16',
            fontWeight: 800, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif",
            textTransform: 'uppercase', letterSpacing: 1,
          }}>
          Zamknij
        </button>
      </div>
    )
  }
}
