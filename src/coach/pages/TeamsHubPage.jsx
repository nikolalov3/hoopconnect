import { useState } from 'react'
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
  { value: 'amator', label: 'Amator' },
  { value: 'wojewodzki', label: 'Wojewódzki' },
  { value: 'centralny', label: 'Centralny' },
  { value: 'i_liga', label: 'I liga' },
  { value: 'ekstraklasa', label: 'Ekstraklasa' },
]
const sectionLabel = (s) => SECTIONS.find(x => x.value === s)?.label || s
const levelLabel = (l) => LEVELS.find(x => x.value === l)?.label || l

export default function TeamsHubPage() {
  const navigate = useNavigate()
  const { user, teams, currentTeamId, setCurrentTeam, refreshTeams } = useCoachAuth()
  const [showCreate, setShowCreate] = useState(false)

  const handleSwitch = (teamId) => {
    setCurrentTeam(teamId)
    navigate('/dashboard')
  }

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 24, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="coach-h1">Wszystkie drużyny</h1>
          <p className="coach-subtitle">Twoje drużyny — wybierz aktywną lub utwórz nową.</p>
        </div>
        <button className="coach-btn-primary" onClick={() => setShowCreate(true)}>+ Nowa drużyna</button>
      </header>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 }}>
        {teams.map(t => (
          <button
            key={t.id}
            onClick={() => handleSwitch(t.id)}
            className="coach-card"
            style={{
              textAlign: 'left',
              border: t.id === currentTeamId ? '2px solid #5591CD' : '1px solid #E6ECF3',
              cursor: 'pointer',
              transition: 'border-color 0.15s, transform 0.1s',
              background: '#FFFFFF',
              padding: 18,
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 11,
                background: t.primary_color || '#5591CD',
                color: '#FFFFFF', fontWeight: 700, fontSize: 18,
                display: 'grid', placeItems: 'center',
              }}>{t.name.charAt(0).toUpperCase()}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 15, fontWeight: 700, color: '#1A2233', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.name}</div>
                {t.organization && <div style={{ fontSize: 12, color: '#8A9AB0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.organization}</div>}
              </div>
              {t.id === currentTeamId && (
                <div style={{ fontSize: 10, fontWeight: 700, color: '#5591CD', background: '#E8F1FA', padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: 0.5 }}>Aktywna</div>
              )}
            </div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              <Badge>{t.age_category}</Badge>
              <Badge>{sectionLabel(t.section)}</Badge>
              {t.level && <Badge>{levelLabel(t.level)}</Badge>}
              {t.city && <Badge>{t.city}</Badge>}
            </div>
          </button>
        ))}
      </div>

      {showCreate && (
        <CreateTeamModal
          coachId={user.id}
          onClose={() => setShowCreate(false)}
          onCreated={async (newId) => {
            await refreshTeams()
            setCurrentTeam(newId)
            setShowCreate(false)
            navigate('/dashboard')
          }}
        />
      )}
    </div>
  )
}

function Badge({ children }) {
  return (
    <span style={{
      fontSize: 11, color: '#4D5C73', background: '#F6F8FB',
      border: '1px solid #E6ECF3', padding: '3px 9px', borderRadius: 99,
      fontWeight: 500,
    }}>{children}</span>
  )
}

function CreateTeamModal({ coachId, onClose, onCreated }) {
  const [form, setForm] = useState({
    name: '', organization: '', age_category: 'U16', section: 'M', level: 'amator', city: '',
  })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const set = (k, v) => setForm(p => ({ ...p, [k]: v }))

  const submit = async (e) => {
    e.preventDefault()
    setError(null)
    if (!form.name.trim()) { setError('Podaj nazwę drużyny.'); return }
    setSubmitting(true)
    const { data, error } = await supabase.from('teams').insert({
      coach_id: coachId,
      name: form.name.trim(),
      organization: form.organization.trim() || null,
      age_category: form.age_category,
      section: form.section,
      level: form.level,
      city: form.city.trim() || null,
    }).select().single()
    if (error) { setError(error.message); setSubmitting(false); return }
    onCreated(data.id)
  }

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'rgba(20, 35, 60, 0.4)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 20, zIndex: 200,
    }} onClick={onClose}>
      <div onClick={e => e.stopPropagation()} style={{
        background: '#FFFFFF',
        width: '100%', maxWidth: 480,
        borderRadius: 18,
        padding: 28,
        maxHeight: '90vh',
        overflowY: 'auto',
      }}>
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Nowa drużyna</h2>
        <p className="coach-subtitle" style={{ marginBottom: 20 }}>Dodaj kolejną drużynę do swojego konta.</p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="coach-label">Nazwa drużyny *</label>
            <input className="coach-input" type="text" value={form.name} onChange={e => set('name', e.target.value)} autoFocus required />
          </div>
          <div>
            <label className="coach-label">Organizacja</label>
            <input className="coach-input" type="text" value={form.organization} onChange={e => set('organization', e.target.value)} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label className="coach-label">Kategoria</label>
              <select className="coach-input" value={form.age_category} onChange={e => set('age_category', e.target.value)}>
                {AGE_CATEGORIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="coach-label">Sekcja</label>
              <select className="coach-input" value={form.section} onChange={e => set('section', e.target.value)}>
                {SECTIONS.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
            </div>
          </div>
          <div>
            <label className="coach-label">Poziom</label>
            <select className="coach-input" value={form.level} onChange={e => set('level', e.target.value)}>
              {LEVELS.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
          </div>
          <div>
            <label className="coach-label">Miasto</label>
            <input className="coach-input" type="text" value={form.city} onChange={e => set('city', e.target.value)} />
          </div>

          {error && <div style={{ background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A', padding: '10px 12px', borderRadius: 10, fontSize: 13 }}>{error}</div>}

          <div style={{ display: 'flex', gap: 10, marginTop: 10 }}>
            <button type="button" onClick={onClose} className="coach-btn-secondary" style={{ flex: 1 }}>Anuluj</button>
            <button type="submit" className="coach-btn-primary" disabled={submitting} style={{ flex: 1, opacity: submitting ? 0.6 : 1 }}>
              {submitting ? 'Tworzenie...' : 'Utwórz'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
