export default function LibraryPage() {
  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="coach-h1">Biblioteka ćwiczeń</h1>
        <p className="coach-subtitle">Gotowe ćwiczenia i drille do treningów drużyny.</p>
      </header>

      <div className="coach-card">
        <div className="coach-placeholder" style={{ minHeight: 280, textAlign: 'center' }}>
          <div style={{
            width: 56, height: 56, borderRadius: 16, margin: '0 auto 16px',
            display: 'grid', placeItems: 'center', background: '#EAF1FA', color: '#2563EB',
          }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>
              <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/>
            </svg>
          </div>
          <div className="coach-placeholder-title">Dostępne wkrótce</div>
          <div style={{ maxWidth: 420, margin: '0 auto', lineHeight: 1.55 }}>
            Zbiór gotowych ćwiczeń i drilli, które wpniesz w plan tygodnia jednym kliknięciem.
            Pracujemy nad tym — pojawi się w kolejnej aktualizacji.
          </div>
        </div>
      </div>
    </div>
  )
}
