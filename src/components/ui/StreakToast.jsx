import { useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { createPortal } from 'react-dom'

/**
 * Animated top-of-screen banner shown when streak is extended.
 * Tap to dismiss early; auto-hides after 2.8 s.
 */
export default function StreakToast({ streak, visible, onHide }) {
  useEffect(() => {
    if (!visible) return
    const t = setTimeout(onHide, 2800)
    return () => clearTimeout(t)
  }, [visible])

  return createPortal(
    <AnimatePresence>
      {visible && (
        <motion.div
          key="streak-toast"
          initial={{ y: -140, opacity: 0 }}
          animate={{ y: 0,    opacity: 1 }}
          exit={{   y: -140, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
          onClick={onHide}
          style={{
            position: 'fixed',
            top: 0, left: 0, right: 0,
            zIndex: 9999,
            display: 'flex',
            justifyContent: 'center',
            paddingTop:   'calc(env(safe-area-inset-top, 0px) + 10px)',
            paddingLeft:  16,
            paddingRight: 16,
          }}
        >
          <div style={{
            width: '100%',
            maxWidth: 390,
            background: 'rgba(6,14,30,0.93)',
            backdropFilter: 'blur(32px) saturate(1.8)',
            WebkitBackdropFilter: 'blur(32px) saturate(1.8)',
            border: '1px solid rgba(255,140,30,0.25)',
            borderTop: '1px solid rgba(255,165,50,0.42)',
            borderRadius: 18,
            padding: '13px 18px',
            display: 'flex',
            alignItems: 'center',
            gap: 14,
            boxShadow: '0 10px 36px rgba(0,0,0,0.60), 0 0 0 1px rgba(255,110,20,0.10)',
          }}>

            {/* Animated fire */}
            <motion.span
              animate={{ rotate: [0, -14, 14, -8, 8, 0], scale: [1, 1.15, 1] }}
              transition={{ duration: 0.55, delay: 0.18, ease: 'easeInOut' }}
              style={{ fontSize: 32, flexShrink: 0, lineHeight: 1 }}
            >🔥</motion.span>

            {/* Labels */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontFamily: 'var(--font-body)', fontSize: 9, fontWeight: 700,
                letterSpacing: 2.5, textTransform: 'uppercase',
                color: 'rgba(255,145,35,0.82)', marginBottom: 2,
              }}>Seria przedłużona</p>
              <p style={{
                fontFamily: 'var(--font-display)', fontWeight: 900,
                fontSize: 18, color: 'var(--text-primary)', letterSpacing: 0.3,
              }}>
                {streak} {streak === 1 ? 'dzień' : 'dni'} z rzędu
              </p>
            </div>

            {/* Big number */}
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 40, lineHeight: 1,
              color: 'var(--orange)',
              textShadow: '0 0 22px rgba(255,120,30,0.75)',
            }}>{streak}</p>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
