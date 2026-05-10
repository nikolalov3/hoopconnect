import { Link, useParams } from 'react-router-dom'

export default function PlayerPage() {
  const { playerId } = useParams()

  return (
    <div>
      <Link to="/team" className="coach-btn-ghost" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 16, padding: '6px 10px' }}>
        ← Wróć do drużyny
      </Link>

      <header style={{ marginBottom: 24 }}>
        <h1 className="coach-h1">Profil zawodnika</h1>
        <p className="coach-subtitle">ID: {playerId}</p>
      </header>

      {/* Header card */}
      <div className="coach-card" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div style={{
            width: 64, height: 64, borderRadius: 16,
            background: '#E8F1FA',
            display: 'grid', placeItems: 'center',
            fontSize: 22, fontWeight: 700, color: '#1E3A5F',
          }}>—</div>
          <div style={{ flex: 1, minWidth: 200 }}>
            <div style={{ fontSize: 20, fontWeight: 700, color: '#1A2233' }}>Imię Nazwisko</div>
            <div style={{ fontSize: 13, color: '#8A9AB0', marginTop: 2 }}>— lat</div>
          </div>
          <div>
            <label className="coach-label" style={{ fontSize: 11 }}>Numer</label>
            <input className="coach-input" type="number" min="0" max="99" style={{ width: 80, textAlign: 'center' }} placeholder="—" />
          </div>
        </div>
      </div>

      {/* Weekly report */}
      <div className="coach-card" style={{ marginBottom: 16 }}>
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Raport tygodniowy</h2>
        <p className="coach-subtitle" style={{ marginBottom: 16 }}>Ostatnie 7 dni</p>
        <div className="coach-placeholder" style={{ minHeight: 100 }}>
          <div>Format raportu zaprojektujemy w następnym kroku.</div>
        </div>
      </div>

      {/* Category breakdown */}
      <div className="coach-card" style={{ marginBottom: 16 }}>
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Rozkład kategorii treningowych</h2>
        <p className="coach-subtitle" style={{ marginBottom: 16 }}>Ostatnie 30 dni</p>
        <div className="coach-placeholder" style={{ minHeight: 200 }}>
          <div>Wykres pojawi się gdy zawodnik wykona pierwsze treningi.</div>
        </div>
      </div>

      {/* Boost categories */}
      <div className="coach-card" style={{ marginBottom: 16 }}>
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Sugeruj częściej</h2>
        <p className="coach-subtitle" style={{ marginBottom: 16 }}>Wybierz kategorie nad którymi zawodnik ma popracować — system sam je częściej zaserwuje.</p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {['Strzały','Drybling','Atletyzm','Siła','IQ','Kondycja','Regeneracja'].map(cat => (
            <button key={cat} className="coach-btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Coach notes */}
      <div className="coach-card">
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Notatki prywatne</h2>
        <p className="coach-subtitle" style={{ marginBottom: 16 }}>Widoczne tylko dla Ciebie.</p>
        <textarea
          className="coach-input"
          rows="3"
          placeholder="Dodaj notatkę o zawodniku..."
          style={{ resize: 'vertical', fontFamily: 'inherit' }}
        />
      </div>
    </div>
  )
}
