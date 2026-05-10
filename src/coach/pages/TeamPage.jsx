export default function TeamPage() {
  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="coach-h1">Drużyna</h1>
          <p className="coach-subtitle">Lista Twoich zawodników.</p>
        </div>
        <button className="coach-btn-primary">+ Dodaj zawodnika</button>
      </header>

      <div className="coach-card">
        <div className="coach-placeholder" style={{ minHeight: 280 }}>
          <div className="coach-placeholder-title">Brak zawodników</div>
          <div style={{ marginBottom: 18 }}>Wyślij zaproszenie e-mailowe — zawodnik zaakceptuje je w aplikacji.</div>
          <button className="coach-btn-primary">Dodaj pierwszego zawodnika</button>
        </div>
      </div>
    </div>
  )
}
