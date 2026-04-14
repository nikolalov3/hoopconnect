import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'

function InitialsAvatar({ name, size = 64 }) {
  const initials = name
    ? name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2)
    : '?'
  return (
    <div style={{
      width: size, height: size, borderRadius: '50%',
      background: 'linear-gradient(135deg, #5BB8F5 0%, #2272C3 100%)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      boxShadow: '0 4px 20px rgba(91,184,245,0.40)',
      flexShrink: 0,
    }}>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 900,
        fontSize: size * 0.38, color: '#fff', letterSpacing: 1,
      }}>{initials}</span>
    </div>
  )
}

function SettingsRow({ icon, label, sublabel, onPress, danger, rightElement }) {
  return (
    <button
      onClick={onPress}
      style={{
        width: '100%', display: 'flex', alignItems: 'center', gap: 14,
        background: 'none', border: 'none', cursor: onPress ? 'pointer' : 'default',
        padding: '13px 0', textAlign: 'left',
        borderBottom: '1px solid rgba(0,0,0,0.06)',
      }}
    >
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: danger ? 'rgba(255,61,61,0.10)' : 'rgba(91,184,245,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
      }}>
        {icon}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
          color: danger ? '#D94040' : '#1A1A2E', letterSpacing: 0.2,
          margin: 0,
        }}>{label}</p>
        {sublabel && (
          <p style={{
            fontSize: 11, color: '#7A8093', margin: '2px 0 0',
            fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>{sublabel}</p>
        )}
      </div>
      {rightElement}
      {onPress && !rightElement && (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
          stroke={danger ? '#D94040' : '#AABACE'} strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round">
          <polyline points="9 18 15 12 9 6" />
        </svg>
      )}
    </button>
  )
}

function SectionLabel({ children }) {
  return (
    <p style={{
      fontSize: 10, fontWeight: 700, letterSpacing: 2.5,
      textTransform: 'uppercase', color: '#AABACE',
      marginTop: 24, marginBottom: 2, padding: '0 2px',
    }}>{children}</p>
  )
}

export default function SettingsPanel({ open, onClose }) {
  const { profile, user, signOut } = useAuth()

  async function handleSignOut() {
    onClose()
    await signOut()
  }

  const trainingDaysLabel = {
    3: '3 dni / tydzień',
    4: '4 dni / tydzień',
    5: '5 dni / tydzień',
    6: '6 dni / tydzień',
  }[profile?.training_days] || '—'

  const dobLabel = (() => {
    if (!profile?.birth_date) return null
    const d = new Date(profile.birth_date)
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })
  })()

  const memberSince = (() => {
    if (!profile?.created_at) return null
    const d = new Date(profile.created_at)
    return d.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
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
            transition={{ duration: 0.22 }}
            onClick={onClose}
            style={{
              position: 'fixed', inset: 0, zIndex: 400,
              background: 'rgba(10,6,3,0.45)',
              backdropFilter: 'blur(4px)',
              WebkitBackdropFilter: 'blur(4px)',
            }}
          />

          {/* Drawer */}
          <motion.div
            key="settings-drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', stiffness: 340, damping: 34 }}
            style={{
              position: 'fixed', top: 0, left: 0, bottom: 0,
              width: 'min(82vw, 340px)',
              zIndex: 401,
              background: 'rgba(246,249,254,0.97)',
              backdropFilter: 'blur(40px) saturate(1.8)',
              WebkitBackdropFilter: 'blur(40px) saturate(1.8)',
              borderRight: '1px solid rgba(91,184,245,0.18)',
              boxShadow: '4px 0 48px rgba(0,0,0,0.20)',
              display: 'flex', flexDirection: 'column',
              overflowY: 'auto',
            }}
          >
            {/* Top safe-area spacer + handle bar */}
            <div style={{ paddingTop: 'env(safe-area-inset-top, 20px)' }} />

            {/* Header bar */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              padding: '20px 22px 4px',
            }}>
              <p style={{
                fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20,
                textTransform: 'uppercase', letterSpacing: 1.5, color: '#1A1A2E',
              }}>Ustawienia</p>
              <button
                onClick={onClose}
                style={{
                  width: 34, height: 34, borderRadius: '50%',
                  background: 'rgba(0,0,0,0.06)', border: 'none', cursor: 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke="#1A1A2E" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18"/>
                  <line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>

            {/* Profile card */}
            <div style={{ padding: '20px 22px 0' }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 16,
                padding: '18px 16px',
                background: 'rgba(91,184,245,0.09)',
                borderRadius: 16,
                border: '1px solid rgba(91,184,245,0.18)',
              }}>
                <InitialsAvatar name={profile?.name} size={56} />
                <div style={{ minWidth: 0 }}>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17,
                    color: '#1A1A2E', letterSpacing: 0.3, margin: 0,
                    overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {profile?.name || 'Gracz'}
                  </p>
                  <p style={{
                    fontSize: 11, color: '#7A8093', fontWeight: 500,
                    marginTop: 3, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                  }}>
                    {user?.email}
                  </p>
                  {memberSince && (
                    <p style={{ fontSize: 10, color: '#AABACE', marginTop: 4, fontWeight: 500 }}>
                      Grasz od {memberSince}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* Content */}
            <div style={{ padding: '4px 22px 40px', flex: 1 }}>

              <SectionLabel>Profil</SectionLabel>
              <SettingsRow
                icon="🏀"
                label="Plan treningów"
                sublabel={trainingDaysLabel}
              />
              {dobLabel && (
                <SettingsRow
                  icon="🎂"
                  label="Data urodzenia"
                  sublabel={dobLabel}
                />
              )}
              <SettingsRow
                icon="🏆"
                label="Seria"
                sublabel={`${profile?.streak || 0} dni z rzędu`}
              />

              <SectionLabel>Aplikacja</SectionLabel>
              <SettingsRow
                icon="📊"
                label="Wersja"
                sublabel="HoopConnect Beta"
                rightElement={
                  <span style={{
                    fontSize: 10, fontWeight: 700, letterSpacing: 1,
                    color: '#5BB8F5', background: 'rgba(91,184,245,0.12)',
                    padding: '3px 8px', borderRadius: 6,
                  }}>BETA</span>
                }
              />

              <SectionLabel>Konto</SectionLabel>
              <SettingsRow
                icon="🚪"
                label="Wyloguj się"
                danger
                onPress={handleSignOut}
              />

            </div>

            {/* Bottom branding */}
            <div style={{
              padding: '0 22px 32px',
              textAlign: 'center',
            }}>
              <p style={{
                fontSize: 9, letterSpacing: 2.5, textTransform: 'uppercase',
                color: '#C8D6E5', fontWeight: 600,
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
