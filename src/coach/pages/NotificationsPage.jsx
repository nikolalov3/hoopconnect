export default function NotificationsPage() {
  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="coach-h1">Powiadomienia</h1>
        <p className="coach-subtitle">Wyślij wiadomość do całej drużyny lub wybranych zawodników.</p>
      </header>

      <div className="coach-card" style={{ marginBottom: 16 }}>
        <h2 className="coach-h2" style={{ marginBottom: 16 }}>Nowe powiadomienie</h2>

        <div style={{ marginBottom: 14 }}>
          <label className="coach-label">Odbiorcy</label>
          <select className="coach-input" defaultValue="all">
            <option value="all">Cała drużyna</option>
            <option value="custom">Wybrani zawodnicy...</option>
          </select>
        </div>

        <div style={{ marginBottom: 14 }}>
          <label className="coach-label">Tytuł</label>
          <input className="coach-input" type="text" placeholder="np. Trening odwołany" />
        </div>

        <div style={{ marginBottom: 18 }}>
          <label className="coach-label">Treść</label>
          <textarea
            className="coach-input"
            rows="4"
            placeholder="Treść powiadomienia..."
            style={{ resize: 'vertical', fontFamily: 'inherit' }}
          />
        </div>

        <button className="coach-btn-primary">Wyślij</button>
      </div>

      <div className="coach-card">
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Historia</h2>
        <p className="coach-subtitle" style={{ marginBottom: 16 }}>Wysłane powiadomienia</p>
        <div className="coach-placeholder" style={{ minHeight: 120 }}>
          <div>Brak wysłanych powiadomień.</div>
        </div>
      </div>
    </div>
  )
}
