import { Link } from 'react-router-dom'

const FEATURES = [
  {
    title: 'Cała drużyna w jednym miejscu',
    body:  'Statystyki, frekwencja, plan tygodnia. Bez Excela, bez WhatsAppa.',
  },
  {
    title: 'Sugeruj treningi indywidualne',
    body:  'Zaznacz kategorie nad którymi zawodnik ma popracować — system sam je serwuje.',
  },
  {
    title: 'Komunikacja z drużyną',
    body:  'Powiadomienie w aplikacji zawodnika trafia natychmiast. Zero papierologii.',
  },
  {
    title: 'Raport tygodniowy zawodnika',
    body:  'Konkret co zawodnik zrobił, czego nie zrobił, gdzie ma luki.',
  },
]

export default function LandingPage() {
  return (
    <div style={{ minHeight: '100vh', background: '#F6F8FB' }}>

      {/* Top bar */}
      <header style={{
        height: 64,
        padding: '0 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: '#FFFFFF',
        borderBottom: '1px solid #E6ECF3',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{
            width: 36, height: 36, borderRadius: 10,
            background: 'linear-gradient(135deg, #5591CD 0%, #1E3A5F 100%)',
            display: 'grid', placeItems: 'center',
            color: '#FFFFFF', fontWeight: 700, fontSize: 16, letterSpacing: '-0.5px',
          }}>HC</div>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700, fontSize: 15, letterSpacing: '-0.3px' }}>HoopConnect</div>
            <div style={{ fontSize: 11, color: '#8A9AB0', fontWeight: 500, textTransform: 'uppercase', letterSpacing: '0.6px' }}>Trener</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <Link to="/login"><button className="coach-btn-ghost">Zaloguj</button></Link>
          <Link to="/register"><button className="coach-btn-primary">Załóż konto</button></Link>
        </div>
      </header>

      {/* Hero */}
      <section style={{
        maxWidth: 1100, margin: '0 auto',
        padding: '80px 32px 60px',
        textAlign: 'center',
      }}>
        <div style={{
          display: 'inline-block',
          padding: '6px 14px',
          borderRadius: 999,
          background: '#E8F1FA',
          color: '#1E3A5F',
          fontSize: 12,
          fontWeight: 600,
          letterSpacing: 0.4,
          textTransform: 'uppercase',
          marginBottom: 24,
        }}>
          Beta · Q3 2026
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 5vw, 56px)',
          fontWeight: 800,
          letterSpacing: '-1.5px',
          lineHeight: 1.05,
          color: '#1A2233',
          margin: '0 0 18px',
        }}>
          Twoja drużyna<br/>
          <span style={{ color: '#5591CD' }}>w kieszeni.</span>
        </h1>

        <p style={{
          fontSize: 'clamp(16px, 1.5vw, 19px)',
          color: '#4D5C73',
          maxWidth: 620,
          margin: '0 auto 36px',
          lineHeight: 1.55,
        }}>
          Statystyki, frekwencja, plan tygodnia, indywidualne sugestie treningowe.
          Wszystko czego potrzebujesz, żeby prowadzić drużynę — bez Excela.
        </p>

        <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
          <Link to="/register">
            <button className="coach-btn-primary" style={{ padding: '14px 28px', fontSize: 15 }}>
              Zacznij za darmo
            </button>
          </Link>
          <Link to="/login">
            <button className="coach-btn-secondary" style={{ padding: '14px 28px', fontSize: 15 }}>
              Mam już konto
            </button>
          </Link>
        </div>
      </section>

      {/* Features grid */}
      <section style={{ maxWidth: 1100, margin: '0 auto', padding: '40px 32px 80px' }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 16,
        }}>
          {FEATURES.map(f => (
            <div key={f.title} className="coach-card">
              <div style={{
                width: 36, height: 36, borderRadius: 10,
                background: '#E8F1FA',
                display: 'grid', placeItems: 'center',
                marginBottom: 14,
              }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#5591CD" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20 6L9 17l-5-5"/>
                </svg>
              </div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: '#1A2233', margin: '0 0 6px' }}>
                {f.title}
              </h3>
              <p style={{ fontSize: 13, color: '#4D5C73', lineHeight: 1.5, margin: 0 }}>
                {f.body}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid #E6ECF3',
        padding: '24px 32px',
        textAlign: 'center',
        fontSize: 13,
        color: '#8A9AB0',
      }}>
        © {new Date().getFullYear()} HoopConnect · Made for ballers, by ballers.
      </footer>
    </div>
  )
}
