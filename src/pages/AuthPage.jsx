import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { motion, AnimatePresence } from 'framer-motion'

export default function AuthPage() {
  const { signIn, signUp } = useAuth()
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [loading, setLoading] = useState(false)

  function switchMode(m) {
    setMode(m)
    setError('')
    setSuccess('')
    setConfirmPassword('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setSuccess('')

    if (mode === 'register' && password !== confirmPassword) {
      setError('Hasła nie są identyczne.')
      return
    }
    if (mode === 'register' && password.length < 6) {
      setError('Hasło musi mieć co najmniej 6 znaków.')
      return
    }

    setLoading(true)
    try {
      if (mode === 'login') {
        const { error } = await signIn(email, password)
        if (error) setError('Błędny email lub hasło.')
      } else {
        const { error } = await signUp(email, password)
        if (error) setError(error.message)
        else setSuccess('Sprawdź skrzynkę email i potwierdź rejestrację!')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100%',
      display: 'flex',
      flexDirection: 'column',
      padding: '48px 26px 36px',
      position: 'relative',
      overflow: 'hidden',
    }}>
      {/* Background glow */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(91,184,245,0.28) 0%, transparent 60%)',
      }} />

      {/* Logo */}
      <div style={{ textAlign: 'center', marginBottom: 44 }}>
        <motion.div
          initial={{ scale: 0.8, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
          style={{ margin: '0 auto 20px', width: 90, height: 90 }}
        >
          <svg width="90" height="90" viewBox="0 0 90 90" fill="none" xmlns="http://www.w3.org/2000/svg">
            <defs>
              {/* Main diamond gradient */}
              <linearGradient id="diaGrad" x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%"   stopColor="#C8ECFF" />
                <stop offset="30%"  stopColor="#5BB8F5" />
                <stop offset="65%"  stopColor="#2272C3" />
                <stop offset="100%" stopColor="#0D4A8A" />
              </linearGradient>
              {/* Top facet lighter */}
              <linearGradient id="topFacet" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%"   stopColor="rgba(255,255,255,0.70)" />
                <stop offset="100%" stopColor="rgba(120,200,255,0.20)" />
              </linearGradient>
              {/* Side facets */}
              <linearGradient id="leftFacet" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="rgba(40,130,220,0.90)" />
                <stop offset="100%" stopColor="rgba(91,184,245,0.60)" />
              </linearGradient>
              <linearGradient id="rightFacet" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="rgba(91,184,245,0.60)" />
                <stop offset="100%" stopColor="rgba(14,70,150,0.95)" />
              </linearGradient>
              {/* Clip to diamond shape */}
              <clipPath id="diamondClip">
                <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" />
              </clipPath>
            </defs>

            {/* Outer glow drop shadow */}
            <polygon points="45,9 84,33 84,61 45,87 6,61 6,33"
              fill="rgba(20,80,180,0.40)" />

            {/* Main diamond body */}
            <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
              fill="url(#diaGrad)" />

            {/* Top-left facet */}
            <polygon points="45,6 8,32 45,42"
              fill="url(#topFacet)" />
            {/* Top-right facet */}
            <polygon points="45,6 82,32 45,42"
              fill="rgba(255,255,255,0.18)" />
            {/* Bottom-left facet */}
            <polygon points="45,84 8,58 45,48"
              fill="rgba(14,60,140,0.55)" />
            {/* Bottom-right facet */}
            <polygon points="45,84 82,58 45,48"
              fill="rgba(14,50,120,0.75)" />
            {/* Left side facet */}
            <polygon points="8,32 8,58 45,48 45,42"
              fill="url(#leftFacet)" />
            {/* Right side facet */}
            <polygon points="82,32 82,58 45,48 45,42"
              fill="url(#rightFacet)" />

            {/* Cage / grid lines clipped to diamond */}
            <g clipPath="url(#diamondClip)" stroke="rgba(255,255,255,0.28)" strokeWidth="1" fill="none">
              {/* Vertical lines */}
              <line x1="21" y1="0"  x2="21" y2="90" />
              <line x1="33" y1="0"  x2="33" y2="90" />
              <line x1="45" y1="0"  x2="45" y2="90" />
              <line x1="57" y1="0"  x2="57" y2="90" />
              <line x1="69" y1="0"  x2="69" y2="90" />
              {/* Horizontal lines */}
              <line x1="0"  y1="23" x2="90" y2="23" />
              <line x1="0"  y1="32" x2="90" y2="32" />
              <line x1="0"  y1="42" x2="90" y2="42" />
              <line x1="0"  y1="48" x2="90" y2="48" />
              <line x1="0"  y1="58" x2="90" y2="58" />
              <line x1="0"  y1="67" x2="90" y2="67" />
            </g>

            {/* Facet edge lines */}
            <g stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" fill="none" strokeLinejoin="round">
              <line x1="45" y1="6"  x2="8"  y2="32" />
              <line x1="45" y1="6"  x2="82" y2="32" />
              <line x1="8"  y1="32" x2="45" y2="42" />
              <line x1="82" y1="32" x2="45" y2="42" />
              <line x1="45" y1="42" x2="45" y2="48" />
              <line x1="8"  y1="58" x2="45" y2="48" />
              <line x1="82" y1="58" x2="45" y2="48" />
              <line x1="8"  y1="32" x2="8"  y2="58" />
              <line x1="82" y1="32" x2="82" y2="58" />
              <line x1="8"  y1="58" x2="45" y2="84" />
              <line x1="82" y1="58" x2="45" y2="84" />
            </g>

            {/* Diamond outline */}
            <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
              fill="none" stroke="rgba(255,255,255,0.50)" strokeWidth="1.5" strokeLinejoin="round" />

            {/* Top shine */}
            <polygon points="45,6 8,32 45,42"
              fill="rgba(255,255,255,0.12)" />
          </svg>
        </motion.div>

        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontWeight: 900,
          fontSize: 48,
          letterSpacing: 1,
          textTransform: 'uppercase',
          lineHeight: 0.95,
          color: 'var(--text-primary)',
        }}>
          Hoop<span style={{ color: 'var(--orange)', textShadow: '0 0 24px rgba(91,184,245,0.55)' }}>Connect</span>
        </h1>
        <p style={{
          color: 'var(--text-dim)',
          fontSize: 10,
          fontWeight: 600,
          marginTop: 10,
          letterSpacing: 3.5,
          textTransform: 'uppercase',
        }}>
          To jest twój czas
        </p>
      </div>

      {/* Mode toggle */}
      <div style={{
        display: 'flex',
        background: 'rgba(10,6,3,0.65)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        border: '1px solid rgba(255,255,255,0.12)',
        borderTop: '1px solid rgba(255,255,255,0.20)',
        borderRadius: 'var(--radius-sm)',
        padding: 4,
        marginBottom: 20,
        boxShadow: '0 8px 28px rgba(0,0,0,0.40), inset 0 1px 0 rgba(255,255,255,0.07)',
      }}>
        {['login', 'register'].map(m => (
          <button
            key={m}
            onClick={() => switchMode(m)}
            style={{
              flex: 1, padding: '12px',
              background: mode === m
                ? 'linear-gradient(135deg, var(--orange), var(--orange-dim))'
                : 'transparent',
              color: mode === m ? '#fff' : 'var(--text-dim)',
              border: 'none', borderRadius: 10, cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 700,
              fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase',
              transition: 'all 0.2s',
              boxShadow: mode === m ? '0 4px 16px rgba(91,184,245,0.40), inset 0 1px 0 rgba(180,230,255,0.20)' : 'none',
            }}
          >
            {m === 'login' ? 'Zaloguj' : 'Rejestracja'}
          </button>
        ))}
      </div>

      {/* Form */}
      <AnimatePresence mode="wait">
        <motion.form
          key={mode}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.18 }}
          onSubmit={handleSubmit}
          style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
        >
          <input
            className="input-field"
            type="email"
            placeholder="Email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
          <input
            className="input-field"
            type="password"
            placeholder="Hasło"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
            minLength={6}
          />

          {mode === 'register' && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
            >
              <input
                className="input-field"
                type="password"
                placeholder="Powtórz hasło"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                required
                autoComplete="new-password"
                minLength={6}
              />
            </motion.div>
          )}

          <AnimatePresence mode="wait">
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  padding: '10px 14px',
                  background: 'rgba(255,61,61,0.10)',
                  border: '1px solid rgba(255,61,61,0.25)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--red-shot)', fontSize: 13, fontWeight: 500, textAlign: 'center',
                }}
              >
                {error}
              </motion.div>
            )}
            {success && (
              <motion.div
                initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                style={{
                  padding: '12px 14px',
                  background: 'rgba(0,230,118,0.08)',
                  border: '1px solid rgba(0,230,118,0.25)',
                  borderRadius: 'var(--radius-xs)',
                  color: 'var(--green-shot)', fontSize: 13, fontWeight: 500, textAlign: 'center',
                }}
              >
                ✓ {success}
              </motion.div>
            )}
          </AnimatePresence>

          <button
            type="submit"
            className="btn-primary"
            disabled={loading}
            style={{ marginTop: 6, opacity: loading ? 0.6 : 1 }}
          >
            {loading ? '…' : mode === 'login' ? 'Zaloguj się' : 'Załóż konto'}
          </button>
        </motion.form>
      </AnimatePresence>

      {/* Footer */}
      <p style={{
        textAlign: 'center',
        color: 'var(--text-dim)',
        fontSize: 10,
        letterSpacing: 2,
        textTransform: 'uppercase',
        marginTop: 'auto',
        paddingTop: 32,
      }}>
        HoopConnect · Dla koszykarzy
      </p>
    </div>
  )
}
