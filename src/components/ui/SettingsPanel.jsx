import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const SCHEDULES = {
  3: ['T','O','T','O','T','R','O'],
  4: ['T','T','O','T','T','R','O'],
  5: ['T','T','R','T','T','T','O'],
  6: ['T','T','T','R','T','T','T'],
}
const DAY_LABELS = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd']

function InitialsAvatar({ name, size = 44 }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%', flexShrink: 0,
      background: 'linear-gradient(135deg, #5BB8F5, #1B3A6B)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 800,
        fontSize: size * 0.36, color: '#fff', letterSpacing: 0.5,
      }}>{initials}</span>
    </div>
  )
}

function Tile({ icon, label, sublabel, onClick, right, danger }) {
  return (
    <button
      onClick={onClick}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 12,
        padding: '13px 14px',
        background: '#fff',
        border: '1px solid #EDF1F7',
        borderRadius: 10,
        cursor: onClick ? 'pointer' : 'default',
        textAlign: 'left',
        WebkitTapHighlightColor: 'transparent',
        boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
      }}
    >
      {icon && (
        <span style={{
          width: 34, height: 34, borderRadius: 10, flexShrink: 0,
          background: danger ? 'rgba(220,53,69,0.08)' : '#EEF5FD',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 16,
        }}>{icon}</span>

      )}
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontSize: 14, fontWeight: 600,
          color: danger ? '#C0392B' : '#1A2840',
          margin: 0, lineHeight: 1.25,
        }}>{label}</p>
        {sublabel && (
          <p style={{
            fontSize: 11, color: '#8A9BB0', margin: '2px 0 0', fontWeight: 400,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{sublabel}</p>
        )}
      </div>
      {right && <div style={{ flexShrink: 0 }}>{right}</div>}
      {onClick && !right && (
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke={danger ? '#C0392B' : '#C0CEDE'} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6"/>
        </svg>
      )}
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 2,
      textTransform: 'uppercase', color: '#A0B0C8',
      margin: '20px 0 8px',
    }}>{children}</p>
  )
}

export default function SettingsPanel({ open, onClose }) {
  const { profile, user, signOut } = useAuth()
  const [resendState, setResendState] = useState('idle')

  const emailConfirmed = !!user?.email_confirmed_at
  const schedule = SCHEDULES[profile?.training_days] || SCHEDULES[4]

  async function handleResend() {
    setResendState('sending')
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email })
      setResendState(error ? 'error' : 'sent')
    } catch {
      setResendState('error')
    }
  }

  async function handleSignOut() {
    onClose()
    await signOut()
  }

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
    : null

  return (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="sp-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 400,
              background: 'rgba(4,8,16,0.55)',
              backdropFilter: 'blur(6px)',
              WebkitBackdropFilter: 'blur(6px)',
            }}
          />

          {/* Drawer */}
          <motion.div
            key="sp-drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 300, damping: 30 }}
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0,
              width: 'min(82vw, 310px)',
              zIndex: 401,
              background: '#F4F7FB',
              boxShadow: '8px 0 32px rgba(0,0,0,0.18)',
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
              WebkitOverflowScrolling: 'touch',
            }}
          >
            <div style={{ height: 'max(env(safe-area-inset-top), 14px)' }} />

            {/* Header */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '10px 18px 0',
            }}>
              <p style={{
                fontSize: 11, fontWeight: 700, letterSpacing: 2.5,
                textTransform: 'uppercase', color: '#A0B0C8', margin: 0,
              }}>Ustawienia</p>
              <button
                onClick={onClose}
                style={{
                  width: 30, height: 30, borderRadius: '50%',
                  background: '#E8EDF5', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="#4A5568" strokeWidth="2.8" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Profile */}
            <div style={{ padding: '14px 18px 0' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '14px',
                background: '#fff',
                borderRadius: 12,
                border: '1px solid #EDF1F7',
                boxShadow: '0 1px 6px rgba(0,0,0,0.05)',
              }}>
                <InitialsAvatar name={profile?.name} size={44} />
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontSize: 15, fontWeight: 600, color: '#1A2840',
                    margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {profile?.name || 'Gracz'}
                  </p>
                  <p style={{
                    fontSize: 11, color: '#8A9BB0', fontWeight: 400,
                    margin: '2px 0 0',
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {user?.email}
                  </p>
                  {memberSince && (
                    <p style={{
                      fontSize: 10, color: '#5BB8F5', fontWeight: 600,
                      letterSpacing: 0.5, margin: '4px 0 0',
                    }}>
                      Beta · {memberSince}
                    </p>
                  )}
                </div>
              </div>

            </div>

            {/* Weekly schedule bar — floats on panel bg */}
            <div style={{ padding: '12px 18px 0' }}>
              <p style={{
                fontSize: 9, fontWeight: 700, letterSpacing: 2,
                textTransform: 'uppercase', color: '#A0B0C8',
                margin: '0 0 8px',
              }}>Plan tygodnia</p>
              <div style={{ display: 'flex', gap: 5 }}>
                {schedule.map((type, i) => {
                  const isTraining = type === 'T'
                  const isRecovery = type === 'R'
                  return (
                    <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                      <div style={{
                        width: '100%', height: 30,
                        borderRadius: 8,
                        background: isTraining ? '#1B3A6B' : isRecovery ? '#5BB8F5' : '#DDE4EF',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        boxShadow: isTraining
                          ? '0 2px 6px rgba(27,58,107,0.28)'
                          : isRecovery
                          ? '0 2px 6px rgba(91,184,245,0.25)'
                          : 'none',
                      }}>
                        {isTraining && (
                          <svg width="8" height="8" viewBox="0 0 24 24" fill="none"
                            stroke="#fff" strokeWidth="2.8" strokeLinecap="round">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        )}
                        {isRecovery && (
                          <span style={{ fontSize: 10, lineHeight: 1 }}>🧘</span>
                        )}
                      </div>
                      <span style={{
                        fontSize: 8, fontWeight: 700, letterSpacing: 0.3,
                        textTransform: 'uppercase',
                        color: isTraining ? '#1B3A6B' : isRecovery ? '#5BB8F5' : '#B8C5D4',
                      }}>
                        {DAY_LABELS[i]}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Settings tiles */}
            <div style={{ padding: '0 18px', flex: 1 }}>

              <SectionLabel>Konto</SectionLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

                {/* Email confirmation */}
                <Tile
                  icon={emailConfirmed ? '✅' : '📧'}
                  label={emailConfirmed ? 'Email potwierdzony' : 'Email niepotwierdzony'}
                  sublabel={user?.email}
                  right={emailConfirmed ? null : (
                    <button
                      onClick={handleResend}
                      disabled={resendState === 'sending' || resendState === 'sent'}
                      style={{
                        padding: '6px 10px',
                        background: resendState === 'sent' ? 'rgba(39,174,96,0.10)' : '#EEF5FD',
                        border: resendState === 'sent' ? '1px solid rgba(39,174,96,0.30)' : '1px solid #D0E4F7',
                        borderRadius: 8,
                        fontSize: 11, fontWeight: 700, letterSpacing: 0.5,
                        color: resendState === 'sent' ? '#27AE60' : '#1B3A6B',
                        cursor: resendState === 'sending' || resendState === 'sent' ? 'default' : 'pointer',
                        opacity: resendState === 'sending' ? 0.6 : 1,
                        whiteSpace: 'nowrap',
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {resendState === 'sent' ? '✓ Wysłano' : resendState === 'sending' ? '…' : 'Wyślij'}
                    </button>
                  )}
                />

                <Tile
                  icon="📱"
                  label="Wersja"
                  sublabel="HoopConnect Beta"
                  right={
                    <span style={{
                      fontSize: 9, fontWeight: 700, letterSpacing: 1,
                      color: '#5BB8F5', background: '#EEF8FF',
                      padding: '3px 8px', borderRadius: 6,
                      border: '1px solid #C8E8FF',
                    }}>BETA</span>
                  }
                />

                <Tile
                  icon="🚪"
                  label="Wyloguj się"
                  sublabel="Wróć do ekranu logowania"
                  onClick={handleSignOut}
                  danger
                />
              </div>

              <SectionLabel>Społeczność</SectionLabel>
              <a
                href="https://discord.gg/wZrDcRea"
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  display: 'flex', alignItems: 'center', gap: 12,
                  padding: '13px 14px',
                  background: '#fff',
                  border: '1px solid #EDF1F7',
                  borderRadius: 10,
                  textDecoration: 'none',
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{
                  width: 34, height: 34, borderRadius: 10, flexShrink: 0,
                  background: 'rgba(88,101,242,0.10)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <svg width="17" height="17" viewBox="0 0 24 24" fill="#5865F2">
                    <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
                  </svg>
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{
                    fontSize: 14, fontWeight: 600, color: '#1A2840',
                    margin: 0, lineHeight: 1.25,
                  }}>Dołącz na Discord</p>
                  <p style={{
                    fontSize: 11, color: '#8A9BB0', margin: '2px 0 0', fontWeight: 400,
                  }}>Społeczność HoopConnect</p>
                </div>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#C0CEDE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="9 18 15 12 9 6"/>
                </svg>
              </a>

            </div>

            {/* Bottom */}
            <div style={{
              padding: '20px 18px',
              paddingBottom: 'max(env(safe-area-inset-bottom), 20px)',
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
                color: '#C0CEDE', fontWeight: 600,
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
