import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useNavigate } from 'react-router-dom'
import { useUI } from '../../context/UIContext'
import { useNotifications } from '../../hooks/useNotifications'

/**
 * Bottom-sheet drawer that lists the player's pending in-app notifications.
 * Opened from the bell icon in HomePage header (or anywhere that sets
 * notificationsOpen=true). Currently handles team_invite items with
 * Accept / Postpone actions; future types (coach_message, team_practice)
 * just render with an Ok-style dismiss.
 */
export default function NotificationsSheet() {
  const { notificationsOpen, setNotificationsOpen } = useUI()
  const { items, acceptTeamInvite, markRead } = useNotifications()
  const navigate = useNavigate()

  const close = () => setNotificationsOpen(false)
  const closeAndGoHome = () => { setNotificationsOpen(false); navigate('/') }

  return createPortal(
    <AnimatePresence>
      {notificationsOpen && (
        <>
          {/* backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.18 }}
            onClick={close}
            style={{
              position: 'fixed', inset: 0,
              background: 'rgba(0,0,0,0.55)',
              zIndex: 4000,
              backdropFilter: 'blur(2px)',
              WebkitBackdropFilter: 'blur(2px)',
            }}
          />

          {/* sheet */}
          <motion.div
            key="sheet"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 320 }}
            style={{
              position: 'fixed',
              left: 0, right: 0, bottom: 0,
              maxWidth: 430,
              margin: '0 auto',
              background: 'rgba(8,16,30,0.96)',
              backdropFilter: 'blur(30px) saturate(1.6)',
              WebkitBackdropFilter: 'blur(30px) saturate(1.6)',
              borderTop: '1px solid rgba(120,190,255,0.18)',
              borderRadius: '24px 24px 0 0',
              padding: '12px 18px max(28px, env(safe-area-inset-bottom)) 18px',
              maxHeight: '85vh',
              overflowY: 'auto',
              zIndex: 4001,
              boxShadow: '0 -16px 48px rgba(0,0,0,0.6)',
            }}
          >
            {/* drag handle */}
            <div style={{
              width: 42, height: 4, borderRadius: 2,
              background: 'rgba(180,210,255,0.25)',
              margin: '4px auto 16px',
            }}/>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
              <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.5, margin: 0 }}>
                Powiadomienia
              </h2>
              <button onClick={close} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', fontSize: 22, cursor: 'pointer', padding: 4, lineHeight: 1 }}>×</button>
            </div>

            {items.length === 0 ? (
              <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)', fontSize: 14 }}>
                Nic nowego. Spoko 🏀
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {items.map(n => (
                  <NotificationCard
                    key={n.id}
                    notification={n}
                    onAcceptInvite={acceptTeamInvite}
                    onMarkRead={markRead}
                    onClose={close}
                    onAccepted={closeAndGoHome}
                  />
                ))}
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>,
    document.body
  )
}

function NotificationCard({ notification, onAcceptInvite, onMarkRead, onClose, onAccepted }) {
  const { type, payload } = notification
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [accepted, setAccepted] = useState(null)  // { team_name } if just accepted

  if (type === 'team_invite') {
    const coachLabel = payload?.coach_label
    const orgLine = payload?.organization
    return (
      <div className="card" style={{ padding: 16 }}>
        <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: '#5BB8F5', marginBottom: 6 }}>
          Zaproszenie do drużyny
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 18, color: 'var(--text-primary)', textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: 2 }}>
          {payload?.team_name || 'Drużyna'}
        </div>
        {orgLine && (
          <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginBottom: 6 }}>
            {orgLine}
          </div>
        )}
        <div style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.5, marginTop: 10, marginBottom: 14 }}>
          {coachLabel
            ? <>Trener chce dodać Cię do drużyny jako <strong style={{ color: 'var(--text-primary)' }}>{coachLabel}</strong>.</>
            : <>Trener chce dodać Cię do swojej drużyny.</>
          }{' '}Po akceptacji będzie widział Twoje statystyki treningowe i wysyłał plan tygodnia.
        </div>

        {accepted ? (
          <div style={{
            padding: '12px 14px',
            background: 'rgba(0,230,118,0.10)',
            border: '1px solid rgba(0,230,118,0.30)',
            borderRadius: 12,
            color: '#00E676',
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'center',
          }}>
            ✓ Dołączyłeś do drużyny {accepted.team_name}
          </div>
        ) : (
          <>
            {error && (
              <div style={{ background: 'rgba(255,61,61,0.08)', border: '1px solid rgba(255,61,61,0.22)', color: '#FF6868', padding: '8px 12px', borderRadius: 10, fontSize: 12, marginBottom: 10 }}>
                {error}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                className="btn-ghost"
                onClick={onClose}
                disabled={busy}
                style={{ flex: 1, padding: '11px 14px', fontSize: 13 }}
              >
                Odłóż na później
              </button>
              <button
                className="btn-primary"
                disabled={busy}
                onClick={async () => {
                  setError(null)
                  setBusy(true)
                  try {
                    const result = await onAcceptInvite(payload.invite_id)
                    setAccepted(result)
                    // Briefly show confirmation, then close sheet and bounce to home
                    setTimeout(() => { onAccepted?.() }, 1200)
                  } catch (e) {
                    setError(e?.message || 'Nie udało się zaakceptować.')
                  } finally {
                    setBusy(false)
                  }
                }}
                style={{ flex: 1, padding: '11px 14px', fontSize: 13 }}
              >
                {busy ? '...' : 'Akceptuj'}
              </button>
            </div>
          </>
        )}
      </div>
    )
  }

  // Generic / fallback notification (coach_message, team_practice, future types)
  return (
    <div className="card" style={{ padding: 16 }}>
      <div style={{ fontSize: 14, color: 'var(--text-primary)', marginBottom: 12 }}>
        {payload?.title || payload?.message || 'Powiadomienie'}
      </div>
      <button
        className="btn-ghost"
        onClick={async () => { await onMarkRead(notification.id) }}
        style={{ padding: '8px 14px', fontSize: 12 }}
      >
        OK
      </button>
    </div>
  )
}
