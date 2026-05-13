import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCoachAuth } from '../context/CoachAuthContext'

const AGE_CATEGORIES = ['U10','U12','U14','U16','U18','Senior']
const SECTIONS = [
  { value: 'M', label: 'Męska' },
  { value: 'K', label: 'Żeńska' },
  { value: 'Mixed', label: 'Mixed' },
]
const LEVELS = [
  { value: 'amator',      label: 'Amator' },
  { value: 'wojewodzki',  label: 'Wojewódzki' },
  { value: 'centralny',   label: 'Centralny' },
  { value: 'i_liga',      label: 'I liga' },
  { value: 'ekstraklasa', label: 'Ekstraklasa' },
]

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, coachProfile, currentTeam, refreshCoach, refreshTeams, setCurrentTeam, signOut } = useCoachAuth()

  // Coach profile fields
  const [fullName, setFullName] = useState(coachProfile?.full_name || '')
  const [city,     setCity]     = useState(coachProfile?.city || '')
  const [phone,    setPhone]    = useState(coachProfile?.phone || '')
  const [profileSavedAt, setProfileSavedAt] = useState(null)
  const [profileSaving, setProfileSaving]   = useState(false)
  const [profileError, setProfileError]     = useState(null)

  // Team fields (jeśli currentTeam istnieje)
  const [teamName,     setTeamName]     = useState(currentTeam?.name || '')
  const [teamOrg,      setTeamOrg]      = useState(currentTeam?.organization || '')
  const [teamAge,      setTeamAge]      = useState(currentTeam?.age_category || 'U16')
  const [teamSection,  setTeamSection]  = useState(currentTeam?.section || 'M')
  const [teamLevel,    setTeamLevel]    = useState(currentTeam?.level || 'amator')
  const [teamCity,     setTeamCity]     = useState(currentTeam?.city || '')
  const [teamSavedAt,  setTeamSavedAt]  = useState(null)
  const [teamSaving,   setTeamSaving]   = useState(false)
  const [teamError,    setTeamError]    = useState(null)

  // Sync state when currentTeam changes via switcher
  useEffect(() => {
    setTeamName(currentTeam?.name || '')
    setTeamOrg(currentTeam?.organization || '')
    setTeamAge(currentTeam?.age_category || 'U16')
    setTeamSection(currentTeam?.section || 'M')
    setTeamLevel(currentTeam?.level || 'amator')
    setTeamCity(currentTeam?.city || '')
    setTeamError(null); setTeamSavedAt(null)
  }, [currentTeam?.id])

  useEffect(() => {
    setFullName(coachProfile?.full_name || '')
    setCity(coachProfile?.city || '')
    setPhone(coachProfile?.phone || '')
  }, [coachProfile?.id])

  // Password reset
  const [pwState, setPwState] = useState('idle')   // 'idle' | 'sending' | 'sent' | 'error'
  // Archive team
  const [archiving, setArchiving] = useState(false)
  const [confirmArchive, setConfirmArchive] = useState(false)

  async function saveProfile(e) {
    e.preventDefault()
    setProfileError(null); setProfileSaving(true)
    if (!fullName.trim()) { setProfileError('Imię i nazwisko jest wymagane.'); setProfileSaving(false); return }
    const { error } = await supabase.from('coach_profiles').update({
      full_name: fullName.trim(),
      city:      city.trim() || null,
      phone:     phone.trim() || null,
    }).eq('id', user.id)
    setProfileSaving(false)
    if (error) { setProfileError(error.message); return }
    setProfileSavedAt(Date.now())
    refreshCoach()
    setTimeout(() => setProfileSavedAt(null), 2000)
  }

  async function saveTeam(e) {
    e.preventDefault()
    setTeamError(null); setTeamSaving(true)
    if (!teamName.trim()) { setTeamError('Nazwa drużyny jest wymagana.'); setTeamSaving(false); return }
    const { error } = await supabase.from('teams').update({
      name:         teamName.trim(),
      organization: teamOrg.trim() || null,
      age_category: teamAge,
      section:      teamSection,
      level:        teamLevel,
      city:         teamCity.trim() || null,
    }).eq('id', currentTeam.id)
    setTeamSaving(false)
    if (error) { setTeamError(error.message); return }
    setTeamSavedAt(Date.now())
    refreshTeams()
    setTimeout(() => setTeamSavedAt(null), 2000)
  }

  async function handlePasswordReset() {
    setPwState('sending')
    const { error } = await supabase.auth.resetPasswordForEmail(user.email, {
      redirectTo: window.location.origin,
    })
    setPwState(error ? 'error' : 'sent')
    setTimeout(() => setPwState('idle'), 4000)
  }

  async function handleArchiveTeam() {
    setArchiving(true)
    const { error } = await supabase.from('teams')
      .update({ archived_at: new Date().toISOString() })
      .eq('id', currentTeam.id)
    setArchiving(false)
    setConfirmArchive(false)
    if (error) { setTeamError(error.message); return }
    setCurrentTeam(null)
    await refreshTeams()
    navigate('/teams', { replace: true })
  }

  async function handleSignOut() {
    await signOut()
    navigate('/', { replace: true })
  }

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="coach-h1">Ustawienia</h1>
        <p className="coach-subtitle">Konto trenera i drużyna.</p>
      </header>

      {/* ── Twoje dane ───────────────────────────────────────────────── */}
      <div className="coach-card" style={{ marginBottom: 16 }}>
        <h2 className="coach-h2" style={{ marginBottom: 16 }}>Twoje dane</h2>
        <form onSubmit={saveProfile} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
            <div>
              <label className="coach-label">Imię i nazwisko *</label>
              <input className="coach-input" type="text" value={fullName} onChange={e => setFullName(e.target.value)} required/>
            </div>
            <div>
              <label className="coach-label">Email</label>
              <input className="coach-input" type="email" value={user?.email || ''} disabled
                style={{ opacity: 0.6, cursor: 'not-allowed' }}/>
            </div>
            <div>
              <label className="coach-label">Miasto</label>
              <input className="coach-input" type="text" value={city} onChange={e => setCity(e.target.value)}/>
            </div>
            <div>
              <label className="coach-label">Telefon</label>
              <input className="coach-input" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+48 ..."/>
            </div>
          </div>
          {profileError && (
            <div style={{ background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>
              {profileError}
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <button type="submit" className="coach-btn-primary" disabled={profileSaving}>
              {profileSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
            </button>
            {profileSavedAt && <span style={{ fontSize: 12, color: '#3FA86A', fontWeight: 600 }}>✓ Zapisano</span>}
          </div>
        </form>
      </div>

      {/* ── Drużyna ──────────────────────────────────────────────────── */}
      {currentTeam ? (
        <div className="coach-card" style={{ marginBottom: 16 }}>
          <h2 className="coach-h2" style={{ marginBottom: 4 }}>Drużyna — {currentTeam.name}</h2>
          <p className="coach-subtitle" style={{ marginBottom: 16 }}>
            Edytujesz aktualną drużynę. Inne edytujesz po przełączeniu w sidebarze.
          </p>
          <form onSubmit={saveTeam} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
              <div>
                <label className="coach-label">Nazwa *</label>
                <input className="coach-input" type="text" value={teamName} onChange={e => setTeamName(e.target.value)} required/>
              </div>
              <div>
                <label className="coach-label">Organizacja</label>
                <input className="coach-input" type="text" value={teamOrg} onChange={e => setTeamOrg(e.target.value)}/>
              </div>
              <div>
                <label className="coach-label">Kategoria</label>
                <select className="coach-input" value={teamAge} onChange={e => setTeamAge(e.target.value)}>
                  {AGE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <div>
                <label className="coach-label">Sekcja</label>
                <select className="coach-input" value={teamSection} onChange={e => setTeamSection(e.target.value)}>
                  {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <label className="coach-label">Poziom</label>
                <select className="coach-input" value={teamLevel} onChange={e => setTeamLevel(e.target.value)}>
                  {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
              </div>
              <div>
                <label className="coach-label">Miasto</label>
                <input className="coach-input" type="text" value={teamCity} onChange={e => setTeamCity(e.target.value)}/>
              </div>
            </div>
            {teamError && (
              <div style={{ background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>
                {teamError}
              </div>
            )}
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              <button type="submit" className="coach-btn-primary" disabled={teamSaving}>
                {teamSaving ? 'Zapisywanie...' : 'Zapisz zmiany'}
              </button>
              {teamSavedAt && <span style={{ fontSize: 12, color: '#3FA86A', fontWeight: 600 }}>✓ Zapisano</span>}
            </div>
          </form>
        </div>
      ) : (
        <div className="coach-card" style={{ marginBottom: 16 }}>
          <div className="coach-placeholder" style={{ minHeight: 120 }}>
            <div className="coach-placeholder-title">Brak aktywnej drużyny</div>
            <div style={{ marginBottom: 14 }}>Utwórz drużynę żeby zacząć.</div>
            <button onClick={() => navigate('/teams')} className="coach-btn-primary">Wszystkie drużyny</button>
          </div>
        </div>
      )}

      {/* ── Hasło ────────────────────────────────────────────────────── */}
      <div className="coach-card" style={{ marginBottom: 16 }}>
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Hasło</h2>
        <p className="coach-subtitle" style={{ marginBottom: 16 }}>
          Wyślemy link do zresetowania hasła na Twojego maila.
        </p>
        <button onClick={handlePasswordReset} disabled={pwState === 'sending'} className="coach-btn-secondary">
          {pwState === 'sending' ? 'Wysyłanie...' :
           pwState === 'sent'    ? '✓ Sprawdź skrzynkę' :
           pwState === 'error'   ? 'Spróbuj ponownie' :
                                   'Wyślij link do zmiany hasła'}
        </button>
      </div>

      {/* ── Strefa niebezpieczna ─────────────────────────────────────── */}
      {currentTeam && (
        <div className="coach-card" style={{ marginBottom: 16, borderColor: '#FCE5E2' }}>
          <h2 className="coach-h2" style={{ color: '#D85546', marginBottom: 4 }}>Archiwizuj drużynę</h2>
          <p className="coach-subtitle" style={{ marginBottom: 16 }}>
            Drużyna zniknie z listy aktywnych. Zawodnicy zostaną odłączeni, ale ich historia treningowa indywidualna zostaje.
          </p>
          {confirmArchive ? (
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setConfirmArchive(false)} disabled={archiving} className="coach-btn-secondary" style={{ flex: 1 }}>
                Nie archiwizuj
              </button>
              <button onClick={handleArchiveTeam} disabled={archiving} className="coach-btn-primary"
                style={{ flex: 1, background: '#D85546' }}>
                {archiving ? 'Archiwizowanie...' : 'Tak, archiwizuj'}
              </button>
            </div>
          ) : (
            <button onClick={() => setConfirmArchive(true)} className="coach-btn-secondary"
              style={{ borderColor: '#D85546', color: '#D85546' }}>
              Archiwizuj {currentTeam.name}
            </button>
          )}
        </div>
      )}

      {/* ── Wyloguj ──────────────────────────────────────────────────── */}
      <div style={{ padding: '24px 0 16px', textAlign: 'center' }}>
        <button onClick={handleSignOut} style={{
          background: 'none', border: 'none', cursor: 'pointer',
          fontSize: 13, fontWeight: 600, color: '#D85546', padding: '8px 16px',
        }}>
          Wyloguj się
        </button>
      </div>
    </div>
  )
}
