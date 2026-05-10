const DAYS = ['Pon','Wt','Śr','Czw','Pt','Sob','Nd']

export default function SchedulePage() {
  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="coach-h1">Plan tygodnia</h1>
          <p className="coach-subtitle">Treningi drużynowe pojawią się w aplikacji zawodników.</p>
        </div>
        <button className="coach-btn-primary">+ Dodaj trening</button>
      </header>

      <div className="coach-card" style={{ padding: 0 }}>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          borderBottom: '1px solid #E6ECF3',
        }}>
          {DAYS.map((d, i) => (
            <div key={d} style={{
              padding: '14px 12px',
              textAlign: 'center',
              fontSize: 12,
              fontWeight: 600,
              color: '#4D5C73',
              textTransform: 'uppercase',
              letterSpacing: 0.6,
              borderRight: i < 6 ? '1px solid #E6ECF3' : 'none',
            }}>
              {d}
            </div>
          ))}
        </div>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(7, 1fr)',
          minHeight: 360,
        }}>
          {DAYS.map((d, i) => (
            <div key={d} style={{
              padding: 12,
              borderRight: i < 6 ? '1px solid #E6ECF3' : 'none',
              fontSize: 12,
              color: '#8A9AB0',
              textAlign: 'center',
            }}>
              —
            </div>
          ))}
        </div>
      </div>

      <p style={{ fontSize: 13, color: '#8A9AB0', marginTop: 14, textAlign: 'center' }}>
        Każdy zawodnik z drużyny zobaczy zaplanowane treningi w głównej sesji aplikacji.
      </p>
    </div>
  )
}
