export default function SettingsPage() {
  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="coach-h1">Ustawienia</h1>
        <p className="coach-subtitle">Konto trenera i drużyna.</p>
      </header>

      {/* Coach profile */}
      <div className="coach-card" style={{ marginBottom: 16 }}>
        <h2 className="coach-h2" style={{ marginBottom: 16 }}>Twoje dane</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div>
            <label className="coach-label">Imię i nazwisko</label>
            <input className="coach-input" type="text" placeholder="Jan Kowalski" />
          </div>
          <div>
            <label className="coach-label">Email</label>
            <input className="coach-input" type="email" placeholder="trener@klub.pl" />
          </div>
          <div>
            <label className="coach-label">Miasto</label>
            <input className="coach-input" type="text" placeholder="Warszawa" />
          </div>
          <div>
            <label className="coach-label">Telefon</label>
            <input className="coach-input" type="tel" placeholder="+48 ..." />
          </div>
        </div>
      </div>

      {/* Team */}
      <div className="coach-card" style={{ marginBottom: 16 }}>
        <h2 className="coach-h2" style={{ marginBottom: 16 }}>Drużyna</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          <div>
            <label className="coach-label">Nazwa drużyny</label>
            <input className="coach-input" type="text" placeholder="UKS Polonia U16" />
          </div>
          <div>
            <label className="coach-label">Organizacja</label>
            <input className="coach-input" type="text" placeholder="UKS Polonia Warszawa" />
          </div>
          <div>
            <label className="coach-label">Kategoria wiekowa</label>
            <select className="coach-input">
              <option>U10</option><option>U12</option><option>U14</option>
              <option>U16</option><option>U18</option><option>Senior</option>
            </select>
          </div>
          <div>
            <label className="coach-label">Sekcja</label>
            <select className="coach-input">
              <option>Męska</option><option>Żeńska</option><option>Mixed</option>
            </select>
          </div>
          <div>
            <label className="coach-label">Poziom</label>
            <select className="coach-input">
              <option>Amator</option><option>Wojewódzki</option><option>Centralny</option>
              <option>I liga</option><option>Ekstraklasa</option>
            </select>
          </div>
        </div>
        <div style={{ marginTop: 18 }}>
          <button className="coach-btn-primary">Zapisz zmiany</button>
        </div>
      </div>

      {/* Danger zone */}
      <div className="coach-card" style={{ borderColor: '#FCE5E2' }}>
        <h2 className="coach-h2" style={{ color: '#D85546', marginBottom: 4 }}>Strefa niebezpieczna</h2>
        <p className="coach-subtitle" style={{ marginBottom: 16 }}>Operacje nieodwracalne.</p>
        <button className="coach-btn-secondary" style={{ borderColor: '#D85546', color: '#D85546' }}>
          Usuń konto trenera
        </button>
      </div>
    </div>
  )
}
