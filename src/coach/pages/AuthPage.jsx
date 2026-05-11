import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useCoachAuth } from '../context/CoachAuthContext'

const errorPL = (msg) => {
  const m = (msg || '').toLowerCase()
  if (m.includes('invalid login credentials')) return 'Niepoprawny email lub hasło.'
  if (m.includes('user already registered')) return 'Konto z tym emailem już istnieje. Zaloguj się.'
  if (m.includes('password should be at least')) return 'Hasło musi mieć minimum 8 znaków.'
  if (m.includes('email rate limit')) return 'Za dużo prób. Spróbuj za chwilę.'
  return msg || 'Coś poszło nie tak. Spróbuj ponownie.'
}

export default function AuthPage({ mode = 'login' }) {
  const navigate = useNavigate()
  const { signIn, signUp } = useCoachAuth()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const isRegister = mode === 'register'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError(null)
    setSubmitting(true)
    try {
      if (isRegister) {
        if (!name.trim()) {
          setError('Podaj imię i nazwisko.')
          setSubmitting(false)
          return
        }
        const { error } = await signUp(email.trim(), password, name.trim())
        if (error) {
          setError(errorPL(error.message))
          setSubmitting(false)
          return
        }
        // After signUp, onAuthStateChange will fire SIGNED_IN and load coach data
        // ProtectedOnboardingRoute / PublicRoute then routes us to /onboarding.
        navigate('/onboarding', { replace: true })
      } else {
        const { error } = await signIn(email.trim(), password)
        if (error) {
          setError(errorPL(error.message))
          setSubmitting(false)
          return
        }
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      setError(errorPL(err?.message))
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
        maxWidth: 420,
        background: '#FFFFFF',
        border: '1px solid #E6ECF3',
        borderRadius: 18,
        padding: '36px 32px',
        boxShadow: '0 4px 12px rgba(20, 35, 60, 0.06)',
      }}>
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
          <img src="/hoop.svg" alt="HoopConnect" style={{ width: 44, height: 44, objectFit: 'contain' }}/>
          <div style={{ lineHeight: 1.1 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1A2233' }}>HoopConnect</div>
            <div style={{ fontSize: 11, color: '#8A9AB0', fontWeight: 500, textTransform: 'uppercase', letterSpacing: 0.6 }}>Trener</div>
          </div>
        </Link>

        <h1 className="coach-h1" style={{ textAlign: 'center', fontSize: 22, marginBottom: 6 }}>
          {isRegister ? 'Załóż konto trenera' : 'Witaj z powrotem'}
        </h1>
        <p className="coach-subtitle" style={{ textAlign: 'center', marginBottom: 28 }}>
          {isRegister
            ? 'Zacznij prowadzić swoją drużynę cyfrowo.'
            : 'Zaloguj się, żeby zarządzać drużyną.'}
        </p>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          {isRegister && (
            <div>
              <label className="coach-label">Imię i nazwisko</label>
              <input
                className="coach-input"
                type="text"
                value={name}
                onChange={e => setName(e.target.value)}
                placeholder="Jan Kowalski"
                autoComplete="name"
                required
              />
            </div>
          )}

          <div>
            <label className="coach-label">Email</label>
            <input
              className="coach-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="trener@klub.pl"
              autoComplete="email"
              required
            />
          </div>

          <div>
            <label className="coach-label">Hasło</label>
            <input
              className="coach-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder={isRegister ? 'Min. 8 znaków' : '••••••••'}
              autoComplete={isRegister ? 'new-password' : 'current-password'}
              minLength={isRegister ? 8 : undefined}
              required
            />
          </div>

          {error && (
            <div style={{
              background: '#FCE5E2',
              border: '1px solid #F4B5AB',
              color: '#A1372A',
              padding: '10px 12px',
              borderRadius: 10,
              fontSize: 13,
            }}>{error}</div>
          )}

          <button
            type="submit"
            className="coach-btn-primary"
            disabled={submitting}
            style={{ marginTop: 6, padding: '12px 18px', fontSize: 14, opacity: submitting ? 0.6 : 1 }}
          >
            {submitting ? '...' : (isRegister ? 'Załóż konto' : 'Zaloguj się')}
          </button>
        </form>

        <div style={{
          marginTop: 24,
          paddingTop: 20,
          borderTop: '1px solid #E6ECF3',
          textAlign: 'center',
          fontSize: 13,
          color: '#4D5C73',
        }}>
          {isRegister ? (
            <>Masz już konto? <Link to="/login" style={{ fontWeight: 600 }}>Zaloguj się</Link></>
          ) : (
            <>Nie masz konta? <Link to="/register" style={{ fontWeight: 600 }}>Załóż za darmo</Link></>
          )}
        </div>
      </div>
    </div>
  )
}
