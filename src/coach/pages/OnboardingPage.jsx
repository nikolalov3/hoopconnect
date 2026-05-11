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

export default function OnboardingPage() {
  const navigate = useNavigate()
  const { user, refreshTeams, setCurrentTeam } = useCoachAuth()

  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const [form, setForm] = useState({
    name: '',
    organization: '',
    age_category: 'U16',
    section: 'M',
    level: 'amator',
    city: '',
  })

  const set = (key, value) => setForm(prev => ({ ...prev, [key]: value }))

  const next = () => {
    setError(null)
    if (step === 1 && !form.name.trim()) {
      setError('Podaj nazwę drużyny.')
      return
    }
    setStep(s => s + 1)
  }
  const back = () => { setError(null); setStep(s => Math.max(1, s - 1)) }

  const handleCreate = async () => {
    setError(null)
    setSubmitting(true)
    try {
      const { data, error } = await supabase
        .from('teams')
        .insert({
          coach_id: user.id,
          name: form.name.trim(),
          organization: form.organization.trim() || null,
          age_category: form.age_category,
          section: form.section,
          level: form.level,
          city: form.city.trim() || null,
        })
        .select()
        .single()

      if (error) {
        setError(error.message)
        setSubmitting(false)
        return
      }

      await refreshTeams()
      setCurrentTeam(data.id)
      navigate('/dashboard', { replace: true })
    } catch (err) {
      setError(err?.message || 'Nie udało się utworzyć drużyny.')
      setSubmitting(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh',
      background: '#F6F8FB',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: 24,
    }}>
      <div style={{
        width: '100%',
        maxWidth: 520,
        background: '#FFFFFF',
        border: '1px solid #E6ECF3',
        borderRadius: 18,
        padding: '36px 32px',
        boxShadow: '0 4px 12px rgba(20, 35, 60, 0.06)',
      }}>
        {/* Progress */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 24 }}>
          {[1,2,3,4].map(n => (
            <div key={n} style={{
              flex: 1, height: 4, borderRadius: 99,
              background: n <= step ? '#5591CD' : '#E6ECF3',
              transition: 'background 0.2s',
            }}/>
          ))}
        </div>

        <p style={{ fontSize: 12, color: '#8A9AB0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: 4 }}>
          Krok {step} z 4
        </p>

        {step === 1 && (
          <>
            <h1 className="coach-h1" style={{ marginBottom: 6 }}>Twoja drużyna</h1>
            <p className="coach-subtitle" style={{ marginBottom: 24 }}>Jak ją nazywasz?</p>

            <div style={{ marginBottom: 14 }}>
              <label className="coach-label">Nazwa drużyny *</label>
              <input
                className="coach-input"
                type="text"
                value={form.name}
                onChange={e => set('name', e.target.value)}
                placeholder="np. UKS Polonia U16"
                autoFocus
              />
            </div>
            <div>
              <label className="coach-label">Organizacja / klub macierzysty</label>
              <input
                className="coach-input"
                type="text"
                value={form.organization}
                onChange={e => set('organization', e.target.value)}
                placeholder="np. UKS Polonia Warszawa"
              />
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h1 className="coach-h1" style={{ marginBottom: 6 }}>Kategoria</h1>
            <p className="coach-subtitle" style={{ marginBottom: 24 }}>Wiek i sekcja zawodników.</p>

            <div style={{ marginBottom: 18 }}>
              <label className="coach-label">Kategoria wiekowa</label>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {AGE_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => set('age_category', cat)}
                    className={form.age_category === cat ? 'coach-btn-primary' : 'coach-btn-secondary'}
                    style={{ padding: '8px 16px', fontSize: 14 }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="coach-label">Sekcja</label>
              <div style={{ display: 'flex', gap: 8 }}>
                {SECTIONS.map(s => (
                  <button
                    key={s.value}
                    type="button"
                    onClick={() => set('section', s.value)}
                    className={form.section === s.value ? 'coach-btn-primary' : 'coach-btn-secondary'}
                    style={{ padding: '8px 16px', fontSize: 14, flex: 1 }}
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

        {step === 3 && (
          <>
            <h1 className="coach-h1" style={{ marginBottom: 6 }}>Poziom rozgrywek</h1>
            <p className="coach-subtitle" style={{ marginBottom: 24 }}>Na jakim poziomie gracie?</p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {LEVELS.map(l => (
                <button
                  key={l.value}
                  type="button"
                  onClick={() => set('level', l.value)}
                  className={form.level === l.value ? 'coach-btn-primary' : 'coach-btn-secondary'}
                  style={{ padding: '12px 16px', fontSize: 14, justifyContent: 'flex-start', textAlign: 'left' }}
                >
                  {l.label}
                </button>
              ))}
            </div>
          </>
        )}

        {step === 4 && (
          <>
            <h1 className="coach-h1" style={{ marginBottom: 6 }}>Miasto</h1>
            <p className="coach-subtitle" style={{ marginBottom: 24 }}>Gdzie gracie? Opcjonalne.</p>

            <div>
              <label className="coach-label">Miasto</label>
              <input
                className="coach-input"
                type="text"
                value={form.city}
                onChange={e => set('city', e.target.value)}
                placeholder="np. Warszawa"
                autoFocus
              />
            </div>

            <div style={{ marginTop: 24, padding: 16, background: '#F6F8FB', borderRadius: 12, fontSize: 13, color: '#4D5C73' }}>
              <div style={{ fontWeight: 600, color: '#1A2233', marginBottom: 8 }}>Podsumowanie:</div>
              <div><strong>{form.name}</strong>{form.organization && ` · ${form.organization}`}</div>
              <div>{form.age_category} · {SECTIONS.find(s => s.value === form.section)?.label} · {LEVELS.find(l => l.value === form.level)?.label}</div>
              {form.city && <div>{form.city}</div>}
            </div>
          </>
        )}

        {error && (
          <div style={{
            marginTop: 16,
            background: '#FCE5E2',
            border: '1px solid #F4B5AB',
            color: '#A1372A',
            padding: '10px 12px',
            borderRadius: 10,
            fontSize: 13,
          }}>{error}</div>
        )}

        {/* Nav */}
        <div style={{ display: 'flex', gap: 10, marginTop: 28 }}>
          {step > 1 && (
            <button onClick={back} className="coach-btn-secondary" style={{ flex: 1 }}>
              Wstecz
            </button>
          )}
          {step < 4 && (
            <button onClick={next} className="coach-btn-primary" style={{ flex: 1 }}>
              Dalej
            </button>
          )}
          {step === 4 && (
            <button
              onClick={handleCreate}
              className="coach-btn-primary"
              disabled={submitting}
              style={{ flex: 1, opacity: submitting ? 0.6 : 1 }}
            >
              {submitting ? 'Tworzenie...' : 'Utwórz drużynę'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
