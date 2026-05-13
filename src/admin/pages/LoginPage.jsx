import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAdminAuth, ADMIN_EMAIL } from '../context/AdminAuthContext'

export default function LoginPage() {
  const navigate = useNavigate()
  const { signIn } = useAdminAuth()
  const [email, setEmail] = useState(ADMIN_EMAIL)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)

  const submit = async (e) => {
    e.preventDefault()
    setError(null); setSubmitting(true)
    const { error } = await signIn(email.trim(), password)
    setSubmitting(false)
    if (error) {
      setError('Niepoprawne dane logowania.')
      return
    }
    if (email.trim().toLowerCase() !== ADMIN_EMAIL) {
      setError('Tylko konto administratora ma dostęp.')
      return
    }
    navigate('/', { replace: true })
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#F2F4F8',
      display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
    }}>
      <div style={{
        width: '100%', maxWidth: 380,
        background: '#FFFFFF', border: '1px solid #E6ECF3',
        borderRadius: 18, padding: '36px 32px',
        boxShadow: '0 4px 12px rgba(20,35,60,0.06)',
      }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginBottom: 24 }}>
          <img src="/hoop.svg" alt="" style={{ width: 44, height: 44 }}/>
          <div style={{ textAlign: 'center', lineHeight: 1.2 }}>
            <div style={{ fontWeight: 700, fontSize: 16, color: '#1A2233' }}>HoopConnect</div>
            <div style={{ fontSize: 11, color: '#8A9AB0', fontWeight: 600, textTransform: 'uppercase', letterSpacing: 0.8 }}>
              Admin
            </div>
          </div>
        </div>

        <h1 style={{ fontSize: 18, fontWeight: 700, textAlign: 'center', color: '#1A2233', margin: '0 0 4px' }}>
          🔒 Strefa prywatna
        </h1>
        <p style={{ fontSize: 13, color: '#8A9AB0', textAlign: 'center', marginBottom: 24 }}>
          Tylko administrator ma dostęp.
        </p>

        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div>
            <label className="admin-label">Email</label>
            <input
              className="admin-input"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </div>
          <div>
            <label className="admin-label">Hasło</label>
            <input
              className="admin-input"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              autoComplete="current-password"
              autoFocus
              required
            />
          </div>

          {error && (
            <div style={{
              background: '#FCE5E2', border: '1px solid #F4B5AB', color: '#A1372A',
              padding: '10px 12px', borderRadius: 10, fontSize: 13,
            }}>{error}</div>
          )}

          <button type="submit" className="admin-btn-primary" disabled={submitting}>
            {submitting ? 'Logowanie...' : 'Zaloguj'}
          </button>
        </form>
      </div>
    </div>
  )
}
