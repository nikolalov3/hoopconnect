import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

// ── INITIALS AVATAR ──────────────────────────────────────────────────────────
function InitialsAvatar({ name, size = 52 }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #5BB8F5 0%, #1B3A6B 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 3px 14px rgba(91,184,245,0.35)',
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: size * 0.36, color: '#fff', letterSpacing: 0.5,
      }}>{initials}</span>
    </div>
  )
}

// ── STAT BUBBLE ───────────────────────────────────────────────────────────────
function StatBubble({ icon, value, label, navy }) {
  return (
    <div style={{
      flex: 1,
      padding: '14px 10px 12px',
      borderRadius: 18,
      background: navy
        ? 'linear-gradient(145deg, #1B3A6B, #0D2247)'
        : 'linear-gradient(145deg, #5BB8F5, #3A9EE0)',
      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
      boxShadow: navy
        ? '0 4px 14px rgba(13,34,71,0.35)'
        : '0 4px 14px rgba(91,184,245,0.30)',
    }}>
      <span style={{ fontSize: 20 }}>{icon}</span>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
        color: '#fff', lineHeight: 1, letterSpacing: -0.5,
      }}>{value}</span>
      <span style={{
        fontSize: 9, fontWeight: 600, letterSpacing: 1.5,
        textTransform: 'uppercase', color: 'rgba(255,255,255,0.65)',
      }}>{label}</span>
    </div>
  )
}

// ── ACTION BUBBLE ─────────────────────────────────────────────────────────────
function ActionBubble({ icon, label, sublabel, onClick, variant = 'blue', disabled }) {
  const styles = {
    blue: {
      bg: 'linear-gradient(145deg, #5BB8F5, #3A9EE0)',
      shadow: '0 4px 16px rgba(91,184,245,0.30)',
      labelColor: '#fff',
      subColor: 'rgba(255,255,255,0.72)',
    },
    navy: {
      bg: 'linear-gradient(145deg, #1B3A6B, #0D2247)',
      shadow: '0 4px 16px rgba(13,34,71,0.35)',
      labelColor: '#fff',
      subColor: 'rgba(255,255,255,0.60)',
    },
    red: {
      bg: 'linear-gradient(145deg, #C0392B, #922B21)',
      shadow: '0 4px 14px rgba(192,57,43,0.30)',
      labelColor: '#fff',
      subColor: 'rgba(255,255,255,0.70)',
    },
    green: {
      bg: 'linear-gradient(145deg, #27AE60, #1E8449)',
      shadow: '0 4px 14px rgba(39,174,96,0.28)',
      labelColor: '#fff',
      subColor: 'rgba(255,255,255,0.70)',
    },
  }
  const s = styles[variant] || styles.blue

  return (
    <button
      onClick={onClick}
      disabled={disabled}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        padding: '14px 16px',
        background: s.bg,
        borderRadius: 16,
        border: 'none',
        cursor: disabled ? 'default' : 'pointer',
        opacity: disabled ? 0.55 : 1,
        boxShadow: s.shadow,
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <span style={{ fontSize: 22, flexShrink: 0 }}>{icon}</span>
      <div style={{ minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
          color: s.labelColor, letterSpacing: 0.3, margin: 0, lineHeight: 1.2,
        }}>{label}</p>
        {sublabel && (
          <p style={{
            fontSize: 11, color: s.subColor, margin: '3px 0 0',
            fontWeight: 500,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{sublabel}</p>
        )}
      </div>
    </button>
  )
}

// ── SECTION LABEL ─────────────────────────────────────────────────────────────
function Section({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 2.5,
      textTransform: 'uppercase', color: '#A0AFC0',
      margin: '22px 0 10px',
    }}>{children}</p>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function SettingsPanel({ open, onClose }) {
  const { profile, user, signOut } = useAuth()
  const [resendState, setResendState] = useState('idle') // idle | sending | sent | error

  const emailConfirmed = !!user?.email_confirmed_at

  async function handleResendConfirmation() {
    setResendState('sending')
    try {
      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: user.email,
      })
      setResendState(error ? 'error' : 'sent')
    } catch {
      setResendState('error')
    }
  }

  async function handleSignOut() {
    onClose()
    await signOut()
  }

  const trainingDaysLabel = {
    3: '3 dni / tyg.',
    4: '4 dni / tyg.',
    5: '5 dni / tyg.',
    6: '6 dni / tyg.',
  }[profile?.training_days] || '—'

  const memberSince = (() => {
    if (!profile?.created_at) return null
    return new Date(profile.created_at).toLocaleDateString('pl-PL', { month: 'short', year: 'numeric' })
  })()

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="settings-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.20 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 400,
              background: 'rgba(6,3,1,0.50)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />

          {/* Drawer */}
          <motion.div
            key="settings-drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 320, damping: 32 }}
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0,
              width: 'min(80vw, 320px)',
              zIndex: 401,
              background: '#F0F5FC',
              borderRight: '1px solid rgba(91,184,245,0.15)',
              boxShadow: '6px 0 40px rgba(0,0,0,0.22)',
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            {/* Safe area top */}
            <div style={{ height: 'max(env(safe-area-inset-top), 16px)' }} />

            {/* ── Header ── */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '12px 18px 8px',
            }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
                textTransform: 'uppercase', letterSpacing: 2, color: '#1A2840',
              }}>Ustawienia</p>
              <button
                onClick={onClose}
                style={{
                  width: 32, height: 32, borderRadius: '50%',
                  background: 'rgba(27,58,107,0.10)', border: 'none',
                  cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                  stroke="#1A2840" strokeWidth="2.8" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* ── Profile card ── */}
            <div style={{ padding: '6px 18px 0' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px 14px',
                background: 'linear-gradient(135deg, #1B3A6B 0%, #0D2247 100%)',
                borderRadius: 18,
                boxShadow: '0 4px 18px rgba(13,34,71,0.28)',
              }}>
                <InitialsAvatar name={profile?.name} size={48} />
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontWeight: 600, fontSize: 15,
                    color: '#fff', margin: 0, letterSpacing: 0.2,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {profile?.name || 'Gracz'}
                  </p>
                  <p style={{
                    fontSize: 11, color: 'rgba(255,255,255,0.55)', fontWeight: 400,
                    margin: '3px 0 0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {user?.email}
                  </p>
                  {memberSince && (
                    <p style={{
                      fontSize: 9, color: 'rgba(91,184,245,0.75)', margin: '4px 0 0',
                      fontWeight: 600, letterSpacing: 1,
                    }}>
                      BETA · od {memberSince}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* ── Stats bubbles ── */}
            <div style={{ padding: '0 18px' }}>
              <Section>Twój progres</Section>
              <div style={{ display: 'flex', gap: 10 }}>
                <StatBubble icon="🔥" value={profile?.streak || 0} label="seria" />
                <StatBubble icon="🏀" value={trainingDaysLabel} label="plan" navy />
                <StatBubble icon="🏆" value={profile?.longest_streak || 0} label="rekord" />
              </div>
            </div>

            {/* ── Email confirmation ── */}
            <div style={{ padding: '0 18px' }}>
              <Section>Konto</Section>
              <div style={{
                borderRadius: 16,
                background: emailConfirmed
                  ? 'linear-gradient(145deg, #27AE60, #1E8449)'
                  : 'linear-gradient(145deg, #2C3E6B, #1A2840)',
                padding: '14px 16px',
                boxShadow: emailConfirmed
                  ? '0 4px 14px rgba(39,174,96,0.28)'
                  : '0 4px 14px rgba(27,40,64,0.35)',
                marginBottom: 10,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 20 }}>{emailConfirmed ? '✅' : '📧'}</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
                      color: '#fff', margin: 0, letterSpacing: 0.2,
                    }}>
                      {emailConfirmed ? 'Email potwierdzony' : 'Potwierdź email'}
                    </p>
                    <p style={{
                      fontSize: 10, color: 'rgba(255,255,255,0.60)',
                      margin: '3px 0 0', fontWeight: 400,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {user?.email}
                    </p>
                  </div>
                </div>

                {!emailConfirmed && (
                  <button
                    onClick={handleResendConfirmation}
                    disabled={resendState === 'sending' || resendState === 'sent'}
                    style={{
                      marginTop: 12, width: '100%', padding: '10px',
                      background: resendState === 'sent'
                        ? 'rgba(39,174,96,0.25)'
                        : 'rgba(91,184,245,0.20)',
                      border: resendState === 'sent'
                        ? '1px solid rgba(39,174,96,0.50)'
                        : '1px solid rgba(91,184,245,0.35)',
                      borderRadius: 10,
                      fontFamily: 'var(--font-display)', fontWeight: 700,
                      fontSize: 12, letterSpacing: 1.5, textTransform: 'uppercase',
                      color: resendState === 'sent' ? '#27AE60' : '#5BB8F5',
                      cursor: resendState === 'sending' || resendState === 'sent' ? 'default' : 'pointer',
                      opacity: resendState === 'sending' ? 0.6 : 1,
                      WebkitTapHighlightColor: 'transparent',
                    }}
                  >
                    {resendState === 'sending' && '…'}
                    {resendState === 'sent' && '✓ Wysłano — sprawdź skrzynkę'}
                    {resendState === 'error' && 'Błąd — spróbuj ponownie'}
                    {resendState === 'idle' && 'Wyślij ponownie'}
                  </button>
                )}
              </div>
            </div>

            {/* ── Actions ── */}
            <div style={{ padding: '0 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <ActionBubble
                icon="🚪"
                label="Wyloguj się"
                sublabel="Wróć do ekranu logowania"
                onClick={handleSignOut}
                variant="red"
              />
            </div>

            {/* Bottom spacer + branding */}
            <div style={{
              marginTop: 'auto', padding: '24px 18px',
              paddingBottom: 'max(env(safe-area-inset-bottom), 24px)',
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase',
                color: '#B0C2D8', fontWeight: 600,
              }}>
                HoopConnect · Dla koszykarzy
              </p>
            </div>

          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
