/**
 * FrameUnlockPanel
 * ─────────────────
 * Animated full-screen panel shown when a player earns a new frame.
 * Used for: Season-1 Diamond reward (auto-triggered 24.08.2026)
 *            + dev preview (league button in HomePage)
 *
 * frameData: { id, path, label, rarity, description }
 */
import { useEffect, useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../context/AuthContext'
import { supabase } from '../../lib/supabase'

// ── colours ──────────────────────────────────────────────────────────────────
const GOLD  = '#FFD166'
const GOLDD = '#CC8800'
const GLOW  = 'rgba(255,209,102,0.55)'

// ── rarity label map ─────────────────────────────────────────────────────────
const RARITY = {
  legendary: { label: 'LEGENDARNA', color: '#FFD166', glow: 'rgba(255,209,102,0.60)' },
  rare:      { label: 'RZADKA',     color: '#B9F2FF', glow: 'rgba(185,242,255,0.55)' },
  common:    { label: 'ZWYKŁA',     color: '#A0B0C8', glow: 'rgba(160,176,200,0.40)' },
}

// ── random sparkle positions (stable between renders) ────────────────────────
const SPARKS = Array.from({ length: 18 }, (_, i) => {
  const angle = (i / 18) * 360 + (Math.random() * 20 - 10)
  const dist  = 110 + Math.random() * 80
  const rad   = (angle * Math.PI) / 180
  return {
    x: Math.cos(rad) * dist,
    y: Math.sin(rad) * dist,
    size: 3 + Math.random() * 5,
    delay: 0.55 + Math.random() * 0.35,
    dur: 0.6 + Math.random() * 0.4,
  }
})

// ── hex avatar preview with frame ────────────────────────────────────────────
function PreviewHex({ initial, framePath, size = 140 }) {
  const HEX = '45,6 82,32 82,58 45,84 8,58 8,32'
  return (
    <div style={{ position: 'relative', width: size, height: size }}>
      <svg width={size} height={size} viewBox="-16 -16 122 122"
        style={{ overflow: 'visible' }}>
        <defs>
          <linearGradient id="fuAv" x1="20%" y1="0%" x2="80%" y2="100%">
            <stop offset="0%"   stopColor="#7BC8F8" />
            <stop offset="40%"  stopColor="#5BB8F5" />
            <stop offset="100%" stopColor="#1B3A6B" />
          </linearGradient>
          <filter id="fuGf" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="5" />
          </filter>
        </defs>
        {/* ambient glow */}
        <polygon points="45,-6 93,22 93,68 45,96 -3,68 -3,22"
          fill="none" stroke={GLOW} strokeWidth="18" filter="url(#fuGf)">
          <animate attributeName="opacity" values="0.4;0.9;0.4" dur="2.2s" repeatCount="indefinite"/>
        </polygon>
        {/* body */}
        <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,0.30)"/>
        <polygon points={HEX} fill="url(#fuAv)"/>
        <polygon points="45,6 8,32 45,42"  fill="rgba(255,255,255,0.28)"/>
        <polygon points="45,6 82,32 45,42" fill="rgba(255,255,255,0.13)"/>
        <polygon points={HEX} fill="none" stroke="rgba(255,255,255,0.45)"
          strokeWidth="1.5" strokeLinejoin="round"/>
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

// ── main component ────────────────────────────────────────────────────────────
export default function FrameUnlockPanel({ open, onClose, frameData }) {
  const { profile, user } = useAuth()
  const [phase, setPhase] = useState(0)  // 0=hidden 1=in 2=full

  const initial = profile?.name ? profile.name.trim()[0].toUpperCase() : '?'
  const rarity  = RARITY[frameData?.rarity] || RARITY.legendary

  // Drive animation phases
  useEffect(() => {
    if (!open) { setPhase(0); return }
    setPhase(1)
    const t = setTimeout(() => setPhase(2), 900)
    return () => clearTimeout(t)
  }, [open])

  // Mark as seen so it never auto-shows again
  function handleClose() {
    if (user && frameData?.id) {
      localStorage.setItem(`hc_frame_seen_${frameData.id}_${user.id}`, '1')
    }
    onClose()
  }

  async function handleEquip() {
    // TODO: write equipped_frame to profiles once DB column exists
    // await supabase.from('profiles').update({ equipped_frame: frameData.id }).eq('id', user.id)
    handleClose()
  }

  if (!frameData) return null

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          key="frame-unlock-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.3 }}
          onClick={handleClose}
          style={{
            position: 'fixed', inset: 0, zIndex: 900,
            background: 'rgba(2,4,10,0.96)',
            display: 'flex', flexDirection: 'column',
            alignItems: 'center', justifyContent: 'center',
            padding: '0 28px',
            paddingTop:    'env(safe-area-inset-top, 0px)',
            paddingBottom: 'env(safe-area-inset-bottom, 0px)',
            overflow: 'hidden',
          }}
        >
          {/* ── radial background glow ── */}
          <motion.div
            initial={{ opacity: 0, scale: 0.4 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              position: 'absolute',
              width: 480, height: 480, borderRadius: '50%',
              background: `radial-gradient(circle, ${GLOW} 0%, rgba(255,160,0,0.15) 40%, transparent 70%)`,
              pointerEvents: 'none',
            }}
          />

          {/* ── click-trap so inner clicks don't bubble to backdrop ── */}
          <div onClick={e => e.stopPropagation()}
            style={{ position: 'relative', width: '100%', maxWidth: 380,
              display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

            {/* ── season label ── */}
            <motion.p
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: phase >= 1 ? 1 : 0, y: phase >= 1 ? 0 : 10 }}
              transition={{ delay: 0.15, duration: 0.4 }}
              style={{
                fontSize: 10, letterSpacing: 3, textTransform: 'uppercase',
                color: 'rgba(255,209,102,0.70)', fontWeight: 700,
                marginBottom: 28,
              }}
            >
              Koniec Sezonu 1 · 24.08.2026
            </motion.p>

            {/* ── hex + sparks ── */}
            <div style={{ position: 'relative', marginBottom: 32 }}>

              {/* sparkle particles */}
              {phase >= 1 && SPARKS.map((s, i) => (
                <motion.div key={i}
                  initial={{ opacity: 0, x: 0, y: 0, scale: 0 }}
                  animate={{ opacity: [0, 1, 0], x: s.x, y: s.y, scale: [0, 1.2, 0] }}
                  transition={{ delay: s.delay, duration: s.dur, ease: 'easeOut' }}
                  style={{
                    position: 'absolute',
                    top: '50%', left: '50%',
                    width: s.size, height: s.size, borderRadius: '50%',
                    background: i % 3 === 0 ? GOLD : i % 3 === 1 ? '#fff' : 'rgba(255,200,80,0.80)',
                    boxShadow: `0 0 ${s.size * 2}px ${GOLD}`,
                    marginLeft: -s.size / 2, marginTop: -s.size / 2,
                    pointerEvents: 'none',
                  }}
                />
              ))}

              {/* outer glow rings */}
              {[1, 2].map(n => (
                <motion.div key={n}
                  initial={{ scale: 0.3, opacity: 0 }}
                  animate={phase >= 1
                    ? { scale: [0.6, 1.6, 2.4], opacity: [0.7, 0.3, 0] }
                    : { scale: 0.3, opacity: 0 }}
                  transition={{ delay: 0.4 + n * 0.18, duration: 1.0, ease: 'easeOut' }}
                  style={{
                    position: 'absolute', inset: -24,
                    borderRadius: 4,
                    border: `2px solid ${GOLD}`,
                    pointerEvents: 'none',
                    clipPath: 'polygon(50% 0%, 93% 25% ,93% 75%, 50% 100%, 7% 75%, 7% 25%)',
                  }}
                />
              ))}

              {/* hex avatar with new frame */}
              <motion.div
                initial={{ y: -140, opacity: 0, scale: 0.7 }}
                animate={{
                  y: phase >= 1 ? 0 : -140,
                  opacity: phase >= 1 ? 1 : 0,
                  scale: phase >= 1 ? 1 : 0.7,
                }}
                transition={{ delay: 0.2, type: 'spring', stiffness: 220, damping: 18 }}
              >
                <PreviewHex initial={initial} framePath={frameData.path} size={150} />
              </motion.div>
            </div>

            {/* ── NOWA RAMKA title ── */}
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 16 }}
              transition={{ delay: 0, duration: 0.45 }}
              style={{
                fontSize: 11, letterSpacing: 4, textTransform: 'uppercase',
                color: GOLD, fontWeight: 800, marginBottom: 8,
              }}
            >
              ✦ Nowa ramka odblokowana ✦
            </motion.p>

            {/* ── frame name ── */}
            <motion.h2
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 10 }}
              transition={{ delay: 0.1, duration: 0.4 }}
              style={{
                fontFamily: 'var(--font-display)', fontWeight: 900,
                fontSize: 34, textTransform: 'uppercase', letterSpacing: 1,
                color: '#fff', textAlign: 'center', lineHeight: 1.0,
                marginBottom: 12,
                textShadow: `0 0 32px ${GOLD}60`,
              }}
            >
              {frameData.label}
            </motion.h2>

            {/* ── rarity badge ── */}
            <motion.div
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: phase >= 2 ? 1 : 0, scale: phase >= 2 ? 1 : 0.8 }}
              transition={{ delay: 0.18, duration: 0.35 }}
              style={{
                padding: '4px 14px',
                background: `${rarity.glow}`,
                border: `1px solid ${rarity.color}55`,
                borderTop: `1px solid ${rarity.color}99`,
                borderRadius: 99,
                marginBottom: 16,
              }}
            >
              <span style={{
                fontSize: 9, letterSpacing: 2.5, fontWeight: 800,
                color: rarity.color, textTransform: 'uppercase',
              }}>{rarity.label}</span>
            </motion.div>

            {/* ── description ── */}
            {frameData.description && (
              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: phase >= 2 ? 1 : 0 }}
                transition={{ delay: 0.28, duration: 0.4 }}
                style={{
                  fontSize: 12.5, color: 'rgba(255,255,255,0.55)',
                  textAlign: 'center', lineHeight: 1.65,
                  marginBottom: 32, maxWidth: 280,
                }}
              >
                {frameData.description}
              </motion.p>
            )}

            {/* ── buttons ── */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: phase >= 2 ? 1 : 0, y: phase >= 2 ? 0 : 12 }}
              transition={{ delay: 0.38, duration: 0.4 }}
              style={{ width: '100%', display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleEquip}
                style={{
                  width: '100%', padding: '16px',
                  background: `linear-gradient(135deg, ${GOLD}DD, ${GOLDD}CC)`,
                  border: `1px solid ${GOLD}88`,
                  borderTop: `1px solid ${GOLD}`,
                  borderRadius: 14,
                  fontFamily: 'var(--font-display)', fontWeight: 900,
                  fontSize: 14, letterSpacing: 2, textTransform: 'uppercase',
                  color: '#1A0E00', cursor: 'pointer',
                  boxShadow: `0 6px 28px ${GOLD}40, 0 0 60px ${GOLD}18`,
                }}
              >
                Załóż teraz
              </motion.button>

              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={handleClose}
                style={{
                  width: '100%', padding: '13px',
                  background: 'transparent',
                  border: '1px solid rgba(255,255,255,0.12)',
                  borderRadius: 14,
                  fontSize: 12, fontWeight: 600, color: 'rgba(255,255,255,0.38)',
                  cursor: 'pointer', letterSpacing: 0.5,
                }}
              >
                Może później
              </motion.button>
            </motion.div>

          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
