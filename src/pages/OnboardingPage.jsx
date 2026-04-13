import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const DAYS_OPTIONS = [
  { value: 3, label: '3 DNI', sub: 'Lekki start · 3 treningi + 4 odpoczynek', color: '#00E676' },
  { value: 4, label: '4 DNI', sub: 'Zbalansowany · Polecany dla początkujących', color: '#7ECBFF' },
  { value: 5, label: '5 DNI', sub: 'Intensywny · Dla zaawansowanych', color: '#5BB8F5' },
  { value: 6, label: '6 DNI', sub: 'Pro · Tylko jeśli śpisz 9h i dobrze jesz', color: '#FF3D3D' },
]

const STEP_COUNT = 3

export default function OnboardingPage() {
  const { user, setProfileData } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [name, setName] = useState('')
  const [age, setAge] = useState(16)
  const [trainingDays, setTrainingDays] = useState(4)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  async function handleFinish() {
    if (!name.trim()) { setError('Wpisz swoje imię'); return }
    if (!user?.id) { setError('Brak sesji — odśwież stronę'); return }
    setSaving(true)
    setError('')

    const profileData = {
      name: name.trim(),
      age,
      training_days: trainingDays,
      onboarding_done: true,
      schedule_type: trainingDays <= 3 ? 'light' : trainingDays <= 4 ? 'balanced' : 'intense',
    }

    try {
      // Próbuj UPDATE najpierw (działa zawsze jeśli wiersz istnieje)
      const { data: updated, error: updateErr } = await supabase
        .from('profiles')
        .update(profileData)
        .eq('id', user.id)
        .select('id')

      if (updateErr) throw updateErr

      // Jeśli UPDATE nie trafił w żaden wiersz — trigger nie stworzył profilu, rób INSERT
      if (!updated || updated.length === 0) {
        const { error: insertErr } = await supabase
          .from('profiles')
          .insert({ id: user.id, username: user.email, ...profileData })
        if (insertErr) throw insertErr
      }

      setProfileData({ ...profileData })
      navigate('/', { replace: true })
    } catch(e) {
      setError('Błąd zapisu: ' + e.message)
      setSaving(false)
    }
  }

  const canNext = step === 0 ? name.trim().length >= 2 : true

  return (
    <div style={{
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '0 0 40px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(91,184,245,0.22) 0%, transparent 60%)',
      }} />

      {/* Progress dots */}
      <div style={{ display: 'flex', justifyContent: 'center', gap: 8, padding: '32px 0 0' }}>
        {Array.from({ length: STEP_COUNT }).map((_, i) => (
          <div key={i} style={{
            width: i === step ? 28 : 8, height: 8,
            borderRadius: 4,
            background: i <= step ? 'var(--orange)' : 'rgba(255,255,255,0.12)',
            transition: 'all 0.3s ease',
            boxShadow: i === step ? '0 0 12px rgba(91,184,245,0.65)' : 'none',
          }} />
        ))}
      </div>

      <AnimatePresence mode="wait">

        {/* STEP 0 — Imię */}
        {step === 0 && (
          <motion.div key="step0"
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            style={{ flex: 1, padding: '40px 26px 0', display: 'flex', flexDirection: 'column' }}
          >
            <p className="section-label" style={{ marginBottom: 8 }}>Krok 1 z {STEP_COUNT}</p>
            <h1 className="display-title" style={{ fontSize: 42, marginBottom: 8 }}>
              Jak masz<br />na imię?
            </h1>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 32, letterSpacing: 0.3 }}>
              Trenerzy NBA znają imię każdego zawodnika. Zacznijmy tak samo.
            </p>

            <input
              className="input-field"
              type="text"
              placeholder="Twoje imię..."
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
              maxLength={30}
              style={{ fontSize: 20, padding: '18px 16px', letterSpacing: 0.5 }}
            />

            {name.trim().length >= 2 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
                style={{
                  marginTop: 20,
                  padding: '16px 20px',
                  background: 'rgba(91,184,245,0.10)',
                  border: '1px solid rgba(91,184,245,0.25)',
                  borderRadius: 'var(--radius)',
                  boxShadow: '0 4px 20px rgba(91,184,245,0.12)',
                }}
              >
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: 'var(--orange)' }}>
                  Cześć, {name.trim()}! 🏀
                </p>
                <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginTop: 4 }}>
                  Dobra decyzja że tu jesteś. Zaczynamy.
                </p>
              </motion.div>
            )}
          </motion.div>
        )}

        {/* STEP 1 — Wiek */}
        {step === 1 && (
          <motion.div key="step1"
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            style={{ flex: 1, padding: '40px 26px 0', display: 'flex', flexDirection: 'column' }}
          >
            <p className="section-label" style={{ marginBottom: 8 }}>Krok 2 z {STEP_COUNT}</p>
            <h1 className="display-title" style={{ fontSize: 42, marginBottom: 8 }}>
              Ile masz<br />lat?
            </h1>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 32 }}>
              Wiek decyduje o intensywności i rodzaju treningów. Mamy specjalny program dla każdego etapu.
            </p>

            {/* Age picker */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 24,
              padding: '32px 0',
            }}>
              <button onClick={() => setAge(a => Math.max(12, a - 1))} style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'rgba(12,8,4,0.65)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--text-primary)', fontSize: 24, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.40)',
              }}>−</button>

              <div style={{ textAlign: 'center' }}>
                <motion.p key={age}
                  initial={{ scale: 1.3, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  style={{
                    fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 80,
                    color: 'var(--orange)', lineHeight: 1, letterSpacing: -2,
                    textShadow: '0 0 30px rgba(91,184,245,0.50)',
                  }}
                >{age}</motion.p>
                <p style={{ color: 'var(--text-dim)', fontSize: 10, letterSpacing: 2, textTransform: 'uppercase', fontWeight: 600 }}>LAT</p>
              </div>

              <button onClick={() => setAge(a => Math.min(22, a + 1))} style={{
                width: 52, height: 52, borderRadius: '50%',
                background: 'rgba(12,8,4,0.65)',
                backdropFilter: 'blur(20px)',
                WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: 'var(--text-primary)', fontSize: 24, cursor: 'pointer',
                boxShadow: '0 4px 16px rgba(0,0,0,0.40)',
              }}>+</button>
            </div>

            {/* Age info card */}
            <div style={{
              padding: '16px 20px',
              background: 'rgba(12,8,4,0.60)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(255,255,255,0.10)',
              borderTop: '1px solid rgba(255,255,255,0.17)',
              borderRadius: 'var(--radius)',
              boxShadow: '0 8px 24px rgba(0,0,0,0.40)',
            }}>
              <p style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: 0.5, textTransform: 'uppercase', marginBottom: 6 }}>
                {age <= 14 ? '🌱 Faza fundamentów' : age <= 16 ? '⚡ Faza rozwoju' : age <= 18 ? '🔥 Faza intensyfikacji' : '🏆 Faza zaawansowana'}
              </p>
              <p style={{ color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.5 }}>
                {age <= 14
                  ? 'Skupiamy się na technice i zabawie. Priorytet: fundamenty i miłość do gry.'
                  : age <= 16
                  ? 'Czas na budowanie silnika. Technika + atletyzm + zaczątki taktyki.'
                  : age <= 18
                  ? 'Okno rekrutacji uczelnianych otwarte. Intensywność rośnie, regeneracja kluczowa.'
                  : 'Poważny program. Trenujesz jak zawodowiec — z zawodową dyscypliną.'}
              </p>
            </div>
          </motion.div>
        )}

        {/* STEP 2 — Dni treningowe */}
        {step === 2 && (
          <motion.div key="step2"
            initial={{ opacity: 0, x: 40 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -40 }}
            style={{ flex: 1, padding: '40px 26px 0', display: 'flex', flexDirection: 'column' }}
          >
            <p className="section-label" style={{ marginBottom: 8 }}>Krok 3 z {STEP_COUNT}</p>
            <h1 className="display-title" style={{ fontSize: 42, marginBottom: 8 }}>
              Ile dni<br />w tygodniu?
            </h1>
            <p style={{ color: 'var(--text-dim)', fontSize: 13, marginBottom: 24 }}>
              Więcej nie zawsze lepiej. Regeneracja to część treningu — bez niej nie rośniesz.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {DAYS_OPTIONS.map(opt => (
                <motion.button key={opt.value} whileTap={{ scale: 0.98 }}
                  onClick={() => setTrainingDays(opt.value)}
                  style={{
                    padding: '16px 20px',
                    background: trainingDays === opt.value
                      ? `rgba(${opt.value >= 6 ? '255,61,61' : opt.value >= 5 ? '255,85,0' : opt.value >= 4 ? '255,122,0' : '0,230,118'},0.12)`
                      : 'rgba(12,8,4,0.60)',
                    backdropFilter: 'blur(20px)',
                    WebkitBackdropFilter: 'blur(20px)',
                    border: trainingDays === opt.value
                      ? `1px solid ${opt.color}55`
                      : '1px solid rgba(255,255,255,0.09)',
                    borderTop: trainingDays === opt.value
                      ? `1px solid ${opt.color}80`
                      : '1px solid rgba(255,255,255,0.15)',
                    borderRadius: 'var(--radius)',
                    cursor: 'pointer',
                    textAlign: 'left',
                    display: 'flex', alignItems: 'center', gap: 16,
                    boxShadow: trainingDays === opt.value
                      ? `0 8px 24px rgba(0,0,0,0.40), 0 0 20px ${opt.color}20`
                      : '0 4px 16px rgba(0,0,0,0.35)',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{
                    width: 44, height: 44, borderRadius: '50%', flexShrink: 0,
                    background: trainingDays === opt.value ? opt.color + '25' : 'rgba(255,255,255,0.05)',
                    border: `1px solid ${trainingDays === opt.value ? opt.color + '60' : 'rgba(255,255,255,0.10)'}`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 18,
                    color: trainingDays === opt.value ? opt.color : 'var(--text-dim)',
                  }}>{opt.value}</div>
                  <div>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
                      color: trainingDays === opt.value ? opt.color : 'var(--text-primary)',
                      textTransform: 'uppercase', letterSpacing: 1, marginBottom: 2,
                    }}>{opt.label}</p>
                    <p style={{ color: 'var(--text-dim)', fontSize: 12 }}>{opt.sub}</p>
                  </div>
                  {trainingDays === opt.value && (
                    <div style={{ marginLeft: 'auto', color: opt.color }}>
                      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                        <path d="M20 6L9 17l-5-5"/>
                      </svg>
                    </div>
                  )}
                </motion.button>
              ))}
            </div>

            {error && (
              <p style={{ color: 'var(--red-shot)', fontSize: 13, marginTop: 14, textAlign: 'center' }}>{error}</p>
            )}
          </motion.div>
        )}

      </AnimatePresence>

      {/* Navigation buttons */}
      <div style={{ padding: '24px 26px 0', display: 'flex', gap: 12, marginTop: 'auto' }}>
        {step > 0 && (
          <button onClick={() => setStep(s => s - 1)} className="btn-ghost" style={{
            width: 52, height: 52, padding: 0, borderRadius: 'var(--radius-sm)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, flexShrink: 0,
          }}>←</button>
        )}

        {step < STEP_COUNT - 1 ? (
          <button
            onClick={() => canNext && setStep(s => s + 1)}
            className="btn-primary"
            style={{ opacity: canNext ? 1 : 0.4, flex: 1 }}
          >
            DALEJ →
          </button>
        ) : (
          <button
            onClick={handleFinish}
            className="btn-primary"
            disabled={saving}
            style={{ flex: 1, opacity: saving ? 0.6 : 1 }}
          >
            {saving ? '...' : `ZACZYNAMY, ${name.trim().toUpperCase()}! 🏀`}
          </button>
        )}
      </div>
    </div>
  )
}
