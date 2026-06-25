/**
 * FrameUnlockPanel
 * ─────────────────
 * Animated full-screen panel shown when a player earns a new frame.
 * Uses createPortal → renders to document.body, bypasses app-shell overflow:hidden.
 *
 * frameData: { id, path, label, rarity, description }
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

// ── colours ──────────────────────────────────────────────────────────────────
const GOLD  = '#FFD166'
const GOLDD = '#CC8800'
const GLOW  = 'rgba(255,209,102,0.55)'

// ── stable sparkle positions — tighter orbit for mobile ──────────────────────
const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * 360 + (i % 2 === 0 ? 8 : -8)
  const dist  = 80 + (i % 4) * 14   // reduced: was 115 + (i%4)*22
  const rad   = (angle * Math.PI) / 180
  return {
    x:     Math.cos(rad) * dist,
    y:     Math.sin(rad) * dist,
    size:  3 + (i % 4),
    delay: 0.5 + (i % 6) * 0.06,
    dur:   0.55 + (i % 3) * 0.15,
  }
})

// ── hex preview with frame ────────────────────────────────────────────────────
function PreviewHex({ initial, framePath, size = 150 }) {
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox="-16 -16 122 122"
        style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="fuAv" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%"   stopColor="#7BC8F8"/>
            <stop offset="40%"  stopColor="#5BB8F5"/>
            <stop offset="100%" stopColor="#1B3A6B"/>
          </linearGradient>
          <filter id="fuGf" x="-120%" y="-120%" width="340%" height="340%">
            <feGaussianBlur stdDeviation="5"/>
          </filter>
        </defs>
        {/* ambient glow */}
        <polygon points="45,-6 93,22 93,68 45,96 -3,68 -3,22"
          fill="none" stroke={GLOW} strokeWidth="18" filter="url(#fuGf)">
          <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.2s" repeatCount="indefinite"/>
        </polygon>
        {/* shadow */}
        <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,0.30)"/>
        {/* body */}
        <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill="url(#fuAv)"/>
        <polygon points="45,6 8,32 45,42"  fill="rgba(255,255,255,0.28)"/>
        <polygon points="45,6 82,32 45,42" fill="rgba(255,255,255,0.13)"/>
        <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
          fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.5" strokeLinejoin="round"/>
        <text x="45" y="49" textAnchor="middle" dominantBaseline="middle"
          fill="white" fontSize="30" fontWeight="800"
          fontFamily="'Barlow Condensed', Barlow, sans-serif">
          {initial}
        </text>
        {/* frame overlay */}
        <image href={framePath} x="-16" y="-16" width="122" height="122"
          preserveAspectRatio="xMidYMid meet"/>
      </svg>
    </div>
  )
}

// ── main ─────────────────────────────────────────────────────────────────────
export default function FrameUnlockPanel({ open, onClose, frameData }) {
  const { t } = useTranslation('frames')
  const { profile, user } = useAuth()
  const [phase, setPhase] = useState(0)

  const RARITY = {
    legendary: { label: t('rarity.legendary'), color: '#FFD166', glow: 'rgba(255,209,102,0.50)' },
    rare:      { label: t('rarity.rare'),       color: '#B9F2FF', glow: 'rgba(185,242,255,0.40)' },
    common:    { label: t('rarity.common'),     color: '#A0B0C8', glow: 'rgba(160,176,200,0.35)' },
  }

  const initial = profile?.name ? profile.name.trim()[0].toUpperCase() : '?'
  const rarity  = RARITY[frameData?.rarity] || RARITY.legendary

  useEffect(() => {
    if (!open) { setPhase(0); return }
    setPhase(1)
    const t = setTimeout(() => setPhase(2), 850)
    return () => clearTimeout(t)
  }, [open])

  function handleClose() {
    if (user && frameData?.id) {
      localStorage.setItem(`hc_frame_seen_${frameData.id}_${user.id}`, '1')
    }
    onClose()
  }

  async function handleEquip() {
    if (user && frameData?.id) {
      await supabase
        .from('profiles')
        .update({ equipped_frame: frameData.id })
        .eq('id', user.id)
    }
    handleClose()
  }

  if (!frameData) return null

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="fu-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.28 }}
          onClick={handleClose}
          style={{
            // fully opaque — prevents any content bleed-through
            position: 'fixed', inset: 0, zIndex: 9999,
            background: '#02040A',
            // scroll wrapper — avoids flex-center + overflow bug
            overflowY: 'auto',
            overflowX: 'hidden',
            WebkitOverflowScrolling: 'touch',
            // safe-area-aware padding (max → always at least 32px)
            paddingTop:    'max(env(safe-area-inset-top, 0px), 32px)',
            paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 40px)',
            paddingLeft: 28, paddingRight: 28,
            // center content vertically when shorter than viewport
            display: 'flex', flexDirection: 'column', alignItems: 'center',
          }}
        >
          {/* radial glow — fixed so it stays centered while scrolling */}
          <motion.div
            initial={{ opacity: 0, scale: 0.3 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.75, ease: 'easeOut' }}
            style={{
              position: 'fixed',
              width: 420, height: 420,
              top: '50%', left: '50%',
              transform: 'translate(-50%, -50%)',
              borderRadius: '50%',
              background: `radial-gradient(circle, ${GLOW} 0%, rgba(255,155,0,0.10) 45%, transparent 70%)`,
              pointerEvents: 'none',
              zIndex: 0,
            }}
          />

          {/* content — margin:auto centers it when content < viewport height */}
          <div onClick={e => e.stopPropagation()}
            style={{
              position: 'relative', zIndex: 1,
              width: '100%', maxWidth: 360,
              margin: 'auto',
              display: 'flex', flexDirection: 'column', alignItems: 'center',
            }}>

            {/* top label */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : 10 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              style={{
                fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
                color: 'rgba(255,209,102,0.65)', fontWeight: 700, marginBottom: 30,
              }}
            >
              {frameData.sublabel || t('newFrame')}
            </motion.p>

            {/* hex + sparks + rings */}
            <div style={{ position: 'relative', marginBottom: 34 }}>

              {/* sparkle particles */}
              {phase >= 1 && SPARKS.map((s, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], x: s.x, y: s.y, scale: [0, 1.3, 0] }}
                  transition={{ delay: s.delay, duration: s.dur, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', top: '50%', left: '50%',
                    width: s.size, height: s.size, borderRadius: '50%',
                    background: i % 3 === 0 ? GOLD : i % 3 === 1 ? '#fff' : '#FFBB40',
                    boxShadow: `0 0 ${s.size * 2}px ${GOLD}`,
                    marginLeft: -s.size / 2, marginTop: -s.size / 2,
                    pointerEvents: 'none',
                  }}
                />
              ))}

              {/* expanding hex rings */}
              {[0, 1].map(n => (
                <motion.div key={n}
                  initial={{ scale: 0.4, opacity: 0 }}
                  animate={phase >= 1
                    ? { scale: [0.7, 1.7 + n * 0.6], opacity: [0.65, 0] }
                    : {}}
                  transition={{ delay: 0.38 + n * 0.2, duration: 0.9, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    inset: -20 - n * 10,
                    clipPath: 'polygon(50% 0%, 93.3% 25%, 93.3% 75%, 50% 100%, 6.7% 75%, 6.7% 25%)',
                    border: `2px solid ${GOLD}`,
                    pointerEvents: 'none',
                  }}
                />
              ))}

              {/* hex avatar */}
              <motion.div
                initial={{ y: -160, opacity: 0, scale: 0.65 }}
                animate={{ y: phase >= 1 ? 0 : -160, opacity: phase >= 1 ? 1 : 0, scale: phase >= 1 ? 1 : 0.65 }}
                transition={{ delay: 0.18, type: 'spring', stiffness: 210, damping: 17 }}
              >
                <PreviewHex initial={initial} framePath={frameData.path} size={150}/>
              </motion.div>
            </div>

            {/* unlock label */}
            <motion.p
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 14 }}
              transition={{ delay: 0, duration: 0.4 }}
              style={{
                fontSize: 11, letterSpacing: 4, textTransform: 'uppercase',
                color: GOLD, fontWeight: 800, marginBottom: 8,
              }}
            >
              {t('unlocked')}
            </motion.p>

            {/* frame name */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 10 }}
              transition={{ delay: 0.08, duration: 0.38 }}
              style={{
                fontFamily: 'var(--font-display)', fontWeight: 900,
                fontSize: 32, textTransform: 'uppercase', letterSpacing: 1,
                color: '#fff', textAlign: 'center', lineHeight: 1.0,
                marginBottom: 10,
                textShadow: `0 0 36px ${GOLD}4D`,
              }}
            >
              {frameData.label}
            </motion.h2>

            {/* rarity badge */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: phase >= 2 ? 1 : 0, scale: phase >= 2 ? 1 : 0.8 }}
              transition={{ delay: 0.16, duration: 0.32 }}
              style={{
                padding: '4px 14px', borderRadius: 99,
                background: rarity.glow,
                border: `1px solid ${rarity.color}44`,
                borderTop: `1px solid ${rarity.color}88`,
                marginBottom: 14,
              }}
            >
              <span style={{ fontSize: 9, letterSpacing: 2.5, fontWeight: 800,
                color: rarity.color, textTransform: 'uppercase' }}>
                {rarity.label}
              </span>
            </motion.div>

            {/* description */}
            {frameData.description && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: phase >= 2 ? 1 : 0 }}
                transition={{ delay: 0.24, duration: 0.38 }}
                style={{
                  fontSize: 12.5, color: 'rgba(255,255,255,0.52)',
                  textAlign: 'center', lineHeight: 1.65,
                  marginBottom: 30, maxWidth: 270,
                }}
              >
                {frameData.description}
              </motion.p>
            )}

            {/* buttons */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 12 }}
              transition={{ delay: 0.34, duration: 0.38 }}
              style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <motion.button whileTap={{ scale: 0.97 }} onClick={handleEquip}
                style={{
                  width: '100%', padding: '15px',
                  background: `linear-gradient(135deg, ${GOLD} 0%, ${GOLDD} 100%)`,
                  border: 'none',
                  borderTop: `2px solid ${GOLD}`,
                  borderRadius: 0,
                  fontFamily: 'var(--font-display)', fontWeight: 900,
                  fontSize: 12.5, letterSpacing: 3, textTransform: 'uppercase',
                  color: '#1A0E00', cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  boxShadow: `0 -4px 24px ${GOLD}30`,
                }}
              >
                {t('thanks')}
              </motion.button>

              <motion.button whileTap={{ scale: 0.97 }} onClick={handleClose}
                style={{
                  width: '100%', padding: '13px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderTop: '1px solid rgba(255,255,255,0.14)',
                  borderRadius: 0,
                  fontSize: 11.5, fontWeight: 500,
                  color: 'rgba(255,255,255,0.28)', cursor: 'pointer',
                  WebkitTapHighlightColor: 'transparent',
                  letterSpacing: 0.5,
                }}
              >
                {t('close')}
              </motion.button>
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  )
}
