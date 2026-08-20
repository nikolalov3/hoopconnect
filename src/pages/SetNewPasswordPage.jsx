import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// Ekran pokazywany, gdy user wejdzie z linku "reset hasła" (event PASSWORD_RECOVERY).
// Sesja jest już aktywna (recovery), więc wystarczy updateUser({ password }).
export default function SetNewPasswordPage() {
  const { t } = useTranslation('auth')
  const { clearRecovery } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [state, setState] = useState('idle') // idle | saving | saved

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    if (password.length < 6) { setError(t('errors.passwordTooShort')); return }
    if (password !== confirm) { setError(t('errors.passwordsDontMatch')); return }

    setState('saving')
    try {
      const { error } = await supabase.auth.updateUser({ password })
      if (error) { setError(t('errors.newPasswordGeneric')); setState('idle'); return }
      setState('saved')
      // Wyczyść token z URL (żeby odświeżenie nie odpaliło znów recovery) i wpuść do apki.
      try { window.history.replaceState(null, '', window.location.pathname) } catch { /* noop */ }
      setTimeout(() => clearRecovery(), 1100)
    } catch {
      setError(t('errors.newPasswordGeneric'))
      setState('idle')
    }
  }

  return (
    <div style={{
      height: '100%', display: 'flex', flexDirection: 'column',
      justifyContent: 'center', padding: '48px 26px 36px',
      position: 'relative', overflowY: 'auto', WebkitOverflowScrolling: 'touch',
    }}>
      {/* Background glow — jak na ekranie logowania */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 70% 50% at 50% -5%, rgba(91,184,245,0.28) 0%, transparent 60%)',
      }} />

      <div style={{ textAlign: 'center', marginBottom: 26 }}>
        <div style={{ fontSize: 44, marginBottom: 8 }}>🔒</div>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 26,
          letterSpacing: 0.5, textTransform: 'uppercase', color: 'var(--text-primary)',
        }}>{t('newPassword.title')}</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 13, marginTop: 8, lineHeight: 1.4 }}>
          {t('newPassword.subtitle')}
        </p>
      </div>

      <AnimatePresence mode="wait">
        {state === 'saved' ? (
          <motion.div
            key="saved"
            initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }}
            style={{
              padding: '16px 18px', textAlign: 'center',
              background: 'rgba(0,230,118,0.08)', border: '1px solid rgba(0,230,118,0.25)',
              borderRadius: 'var(--radius-sm)', color: 'var(--green-shot)',
              fontSize: 15, fontWeight: 600,
            }}
          >
            {t('newPassword.saved')}
          </motion.div>
        ) : (
          <motion.form
            key="form"
            initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
            onSubmit={handleSubmit}
            style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
          >
            <input
              className="input-field" type="password" placeholder={t('newPassword.placeholder')}
              value={password} onChange={e => setPassword(e.target.value)}
              required autoComplete="new-password" minLength={6} autoFocus
            />
            <input
              className="input-field" type="password" placeholder={t('newPassword.confirm')}
              value={confirm} onChange={e => setConfirm(e.target.value)}
              required autoComplete="new-password" minLength={6}
            />

            <AnimatePresence mode="wait">
              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                  style={{
                    padding: '10px 14px', background: 'rgba(255,61,61,0.10)',
                    border: '1px solid rgba(255,61,61,0.25)', borderRadius: 'var(--radius-xs)',
                    color: 'var(--red-shot)', fontSize: 13, fontWeight: 500, textAlign: 'center',
                  }}
                >{error}</motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit" className="btn-primary" disabled={state === 'saving'}
              style={{ marginTop: 6, opacity: state === 'saving' ? 0.6 : 1 }}
            >
              {state === 'saving' ? t('newPassword.saving') : t('newPassword.save')}
            </button>
          </motion.form>
        )}
      </AnimatePresence>
    </div>
  )
}
