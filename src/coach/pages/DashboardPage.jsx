export default function DashboardPage() {
  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="coach-h1">Pulpit</h1>
        <p className="coach-subtitle">Przegląd Twojej drużyny.</p>
      </header>

      {/* Top stats placeholder */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14,
        marginBottom: 24,
      }}>
        {[
          { label: 'Zawodnicy',          value: '—' },
          { label: 'Średnio treningów / tydz.',    value: '—' },
          { label: 'Frekwencja drużyny',  value: '—' },
          { label: 'Najsłabszy obszar',   value: '—' },
        ].map(stat => (
          <div key={stat.label} className="coach-card">
            <div style={{ fontSize: 12, color: '#8A9AB0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 8 }}>
              {stat.label}
            </div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#1A2233', letterSpacing: -0.5 }}>
              {stat.value}
            </div>
          </div>
        ))}
      </div>

      {/* Activity chart placeholder */}
      <div className="coach-card" style={{ marginBottom: 16 }}>
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Aktywność drużyny</h2>
        <p className="coach-subtitle" style={{ marginBottom: 16 }}>Ostatnie 30 dni</p>
        <div className="coach-placeholder" style={{ minHeight: 220 }}>
          <div className="coach-placeholder-title">Wykres aktywności</div>
          <div>Pojawi się gdy podłączysz pierwszych zawodników</div>
        </div>
      </div>

      {/* Alerts placeholder */}
      <div className="coach-card">
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Alerty</h2>
        <p className="coach-subtitle" style={{ marginBottom: 16 }}>Co warto sprawdzić</p>
        <div className="coach-placeholder" style={{ minHeight: 120 }}>
          <div>Brak alertów. System automatycznie podpowie ważne rzeczy.</div>
        </div>
      </div>
    </div>
  )
}
