import { useState, useRef, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

const SCHEDULES = {
  3: ['T','O','T','O','T','R','O'],
  4: ['T','T','O','T','T','R','O'],
  5: ['T','T','R','T','T','T','O'],
  6: ['T','T','T','R','T','T','T'],
}
const DAY_SHORT = ['Nd','Pon','Wt','Śr','Czw','Pt','Sob'] // index = getDay()

const REST_WARNINGS = [
  'Nie zajeżdżaj się — zostaw jeden dzień dla bliskich i regeneracji.',
  'Nie zajeżdżaj się — ciało też potrzebuje dnia dla siebie.',
]

// ── INITIALS AVATAR ──────────────────────────────────────────────────────────
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

// ── SECTION LABEL ─────────────────────────────────────────────────────────────
function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 2,
      textTransform: 'uppercase', color: '#A0B0C8',
      margin: '20px 0 8px',
    }}>{children}</p>
  )
}

// ── 7-DAY TRAINING PICKER ─────────────────────────────────────────────────────
function WeekPicker({ trainingDays }) {
  // Build 7 real calendar days starting from today
  const days = useMemo(() => {
    const today = new Date()
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(today)
      d.setDate(today.getDate() + i)
      return d
    })
  }, [])

  // Initialise selected from profile schedule mapped to actual weekdays
  const schedule = SCHEDULES[trainingDays] || SCHEDULES[4]
  const initSelected = useMemo(() => {
    return new Set(
      days
        .map((d, i) => {
          const dow = d.getDay()          // 0=Sun
          const idx = dow === 0 ? 6 : dow - 1  // Mon=0…Sun=6
          return schedule[idx] === 'T' ? i : null
        })
        .filter(i => i !== null)
    )
  }, [])

  const [selected, setSelected] = useState(initSelected)
  const [showWarn, setShowWarn] = useState(false)
  const warnVariant = useRef(Math.random() < 0.5 ? 0 : 1).current

  function toggle(i) {
    setShowWarn(false)
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(i)) {
        next.delete(i)
      } else {
        if (next.size >= 6) {
          setShowWarn(true)
          return prev
        }
        next.add(i)
      }
      return next
    })
  }

  const todayDate = days[0]

  return (
    <div>
      <div style={{ display: 'flex', gap: 5 }}>
        {days.map((d, i) => {
          const isToday = i === 0
          const isSel = selected.has(i)
          const dayLabel = DAY_SHORT[d.getDay()]
          const dateNum = d.getDate()

          return (
            <button
              key={i}
              onClick={() => toggle(i)}
              style={{
                flex: 1,
                display: 'flex', flexDirection: 'column',
                alignItems: 'center', justifyContent: 'center',
                gap: 4,
                padding: '10px 0 8px',
                borderRadius: 10,
                border: isToday
                  ? `2px solid ${isSel ? '#E8600A' : '#FF8C42'}`
                  : '2px solid transparent',
                background: isSel
                  ? (isToday ? '#E8600A' : '#1B3A6B')
                  : (isToday ? 'rgba(255,140,66,0.10)' : '#DDE4EF'),
                cursor: 'pointer',
                WebkitTapHighlightColor: 'transparent',
                boxShadow: isSel
                  ? (isToday
                    ? '0 3px 10px rgba(232,96,10,0.35)'
                    : '0 3px 10px rgba(27,58,107,0.28)')
                  : 'none',
                transition: 'background 0.15s, box-shadow 0.15s',
              }}
            >
              <span style={{
                fontSize: 8, fontWeight: 700, letterSpacing: 0.5,
                textTransform: 'uppercase',
                color: isSel ? 'rgba(255,255,255,0.75)' : (isToday ? '#FF8C42' : '#B8C5D4'),
                lineHeight: 1,
              }}>
                {dayLabel}
              </span>
              <span style={{
                fontSize: 15, fontWeight: 700, lineHeight: 1,
                color: isSel ? '#fff' : (isToday ? '#E8600A' : '#4A5568'),
              }}>
                {dateNum}
              </span>
            </button>
          )
        })}
      </div>

      <AnimatePresence>
        {showWarn && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            style={{
              fontSize: 10, color: '#E8600A', fontWeight: 600,
              marginTop: 8, lineHeight: 1.4, textAlign: 'center',
            }}
          >
            {REST_WARNINGS[warnVariant]}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── MAIN COMPONENT ────────────────────────────────────────────────────────────
export default function SettingsPanel({ open, onClose }) {
  const { profile, user, signOut } = useAuth()
  const [resendState, setResendState] = useState('idle')

  const emailConfirmed = !!user?.email_confirmed_at

  async function handleResend() {
    setResendState('sending')
    try {
      const { error } = await supabase.auth.resend({ type: 'signup', email: user.email })
      setResendState(error ? 'error' : 'sent')
    } catch (_e) {
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

          {/* Clip wrapper */}
          <div style={{
            position: 'fixed',
            top: 20, bottom: 20,
            left: 'max(0px, calc((100vw - 430px) / 2))',
            width: 'min(calc(min(100vw, 430px) * 0.78), 300px)',
            zIndex: 401,
            overflow: 'hidden',
            borderRadius: '0 16px 16px 0',
            pointerEvents: 'none',
          }}>
            <motion.div
              key="sp-drawer"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%' }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              style={{
                position: 'absolute', inset: 0,
                background: '#F4F7FB',
                boxShadow: '8px 0 40px rgba(0,0,0,0.22)',
                display: 'flex', flexDirection: 'column',
                overflowY: 'auto',
                WebkitOverflowScrolling: 'touch',
                pointerEvents: 'all',
              }}
            >
              <div style={{ height: 16 }} />

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

              {/* Profile card */}
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
                      fontSize: 11, color: '#8A9BB0', fontWeight: 400, margin: '2px 0 0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>
                      {user?.email}
                    </p>
                    {memberSince && (
                      <p style={{ fontSize: 10, color: '#5BB8F5', fontWeight: 600, letterSpacing: 0.5, margin: '4px 0 0' }}>
                        Beta · {memberSince}
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* 7-day week picker */}
              <div style={{ padding: '12px 18px 0' }}>
                <p style={{
                  fontSize: 9, fontWeight: 700, letterSpacing: 2,
                  textTransform: 'uppercase', color: '#A0B0C8', margin: '0 0 8px',
                }}>Plan tygodnia</p>
                <WeekPicker trainingDays={profile?.training_days} />
              </div>

              {/* Konto */}
              <div style={{ padding: '0 18px', flex: 1 }}>
                <SectionLabel>Konto</SectionLabel>
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px',
                  background: '#fff',
                  border: '1px solid #EDF1F7',
                  borderRadius: 10,
                  boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
                }}>
                  <span style={{ fontSize: 14, flexShrink: 0 }}>
                    {emailConfirmed ? '✅' : '📧'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{
                      fontSize: 12, fontWeight: 600,
                      color: emailConfirmed ? '#27AE60' : '#1A2840', margin: 0,
                    }}>
                      {emailConfirmed ? 'Email potwierdzony' : 'Email niepotwierdzony'}
                    </p>
                    <p style={{
                      fontSize: 10, color: '#8A9BB0', margin: '1px 0 0',
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                    }}>{user?.email}</p>
                  </div>
                  {!emailConfirmed && (
                    <button
                      onClick={handleResend}
                      disabled={resendState === 'sending' || resendState === 'sent'}
                      style={{
                        padding: '5px 9px',
                        background: resendState === 'sent' ? 'rgba(39,174,96,0.10)' : '#EEF5FD',
                        border: resendState === 'sent' ? '1px solid rgba(39,174,96,0.30)' : '1px solid #D0E4F7',
                        borderRadius: 7,
                        fontSize: 10, fontWeight: 700, letterSpacing: 0.5,
                        color: resendState === 'sent' ? '#27AE60' : '#1B3A6B',
                        cursor: resendState === 'sending' || resendState === 'sent' ? 'default' : 'pointer',
                        opacity: resendState === 'sending' ? 0.6 : 1,
                        whiteSpace: 'nowrap', flexShrink: 0,
                        WebkitTapHighlightColor: 'transparent',
                      }}
                    >
                      {resendState === 'sent' ? '✓ Wysłano' : resendState === 'sending' ? '…' : 'Wyślij'}
                    </button>
                  )}
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
                    <p style={{ fontSize: 14, fontWeight: 600, color: '#1A2840', margin: 0, lineHeight: 1.25 }}>
                      Dołącz na Discord
                    </p>
                    <p style={{ fontSize: 11, color: '#8A9BB0', margin: '2px 0 0', fontWeight: 400 }}>
                      Społeczność HoopConnect
                    </p>
                  </div>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                    stroke="#C0CEDE" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="9 18 15 12 9 6"/>
                  </svg>
                </a>
              </div>

              {/* Bottom */}
              <div style={{
                padding: '16px 18px 20px', textAlign: 'center',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10,
              }}>
                <button
                  onClick={handleSignOut}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: 12, fontWeight: 600, color: '#C0392B', letterSpacing: 0.3,
                    WebkitTapHighlightColor: 'transparent', padding: '4px 8px',
                  }}
                >
                  Wyloguj się
                </button>
                <p style={{
                  fontSize: 9, letterSpacing: 2, textTransform: 'uppercase',
                  color: '#C0CEDE', fontWeight: 600, margin: 0,
                }}>
                  HoopConnect · Beta
                </p>
              </div>

            </motion.div>
          </div>
        </>
      )}
    </AnimatePresence>
  )
}
