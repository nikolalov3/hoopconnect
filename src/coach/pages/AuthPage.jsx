import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'

export default function AuthPage({ mode = 'login' }) {
  const navigate = useNavigate()
  const [email, setEmail]       = useState('')
  const [password, setPassword] = useState('')
  const [name, setName]         = useState('')
  const [submitting, setSubmitting] = useState(false)

  const isRegister = mode === 'register'

  const handleSubmit = async (e) => {
    e.preventDefault()
    setSubmitting(true)
    // TODO: integrate with Supabase coach auth + create coach_profiles row
    setTimeout(() => {
      setSubmitting(false)
      navigate('/dashboard')
    }, 600)
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
        {/* Logo */}
        <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center', marginBottom: 24 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 11,
            background: 'linear-gradient(135deg, #5591CD 0%, #1E3A5F 100%)',
            display: 'grid', placeItems: 'center',
            color: '#FFFFFF', fontWeight: 700, fontSize: 17,
          }}>HC</div>
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
              minLength={isRegister ? 8 : undefined}
              required
            />
          </div>

          <button
            type="submit"
            className="coach-btn-primary"
            disabled={submitting}
            style={{ marginTop: 6, padding: '12px 18px', fontSize: 14 }}
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
