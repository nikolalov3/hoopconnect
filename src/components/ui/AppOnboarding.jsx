/**
 * AppOnboarding: IG-story-style intro shown once on the first Home visit.
 * Slides: trainings → arenas → clubs & matches (XP) → King of the Court → start.
 * Dopamine-y framer-motion visuals (staggered checks, count-ups, pops, bounce).
 */
import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
import HexAvatar from './HexAvatar'
import { ARENAS } from '../../lib/arenas'

const BLUE = '#5BB8F5'
const GREEN = '#00E676'

// Count 0 → `to` with an ease-out, restarts whenever it (re)mounts (per slide).
function CountUp({ to, dur = 1000, delay = 0 }) {
  const [n, setN] = useState(0)
  useEffect(() => {
    let raf, start
    const timer = setTimeout(() => {
      const tick = (t) => {
        if (start == null) start = t
        const p = Math.min(1, (t - start) / dur)
        setN(Math.round(to * (1 - Math.pow(1 - p, 3))))
        if (p < 1) raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    }, delay * 1000)
    return () => { clearTimeout(timer); if (raf) cancelAnimationFrame(raf) }
  }, [to, dur, delay])
  return <>{n}</>
}

const BADGE_THEME = {
  blue: { text: BLUE, bg: 'rgba(91,184,245,0.14)', border: 'rgba(120,190,245,0.55)', glow: 'rgba(91,184,245,0.20)' },
  gold: { text: '#FFC24D', bg: 'rgba(255,180,40,0.13)', border: 'rgba(255,198,90,0.55)', glow: 'rgba(240,190,60,0.20)' },
}

// One shared stat pill so every slide's badge reads identically (klub = reference).
function StatBadge({ theme = 'blue', icon = 'xp', children }) {
  const c = BADGE_THEME[theme]
  return (
    <div style={{ position: 'relative', overflow: 'hidden', display: 'flex', alignItems: 'center', gap: 10, padding: '11px 20px', borderRadius: 18,
      background: c.bg, border: `1px solid ${c.border}`, backdropFilter: 'blur(4px)', boxShadow: `0 8px 24px ${c.glow}` }}>
      {icon === 'xp' && <>
        <img src="/hoopxp.png" alt="" aria-hidden="true" style={{ position: 'absolute', right: -14, bottom: -18, width: 74, height: 74, opacity: 0.14, transform: 'rotate(-10deg)', pointerEvents: 'none' }}/>
        <img src="/hoopxp.png" alt="" style={{ position: 'relative', width: 26, height: 26 }}/>
      </>}
      {icon === 'fire' && <span style={{ position: 'relative', fontSize: 16 }}>🔥</span>}
      <span style={{ position: 'relative', color: c.text, fontWeight: 800, fontFamily: 'var(--font-display)', fontSize: 16 }}>{children}</span>
    </div>
  )
}

// Triple right-chevron that shimmers rightward — the "enter" affordance on the last slide.
function TripleChevron() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3 }}>
      {[0, 1, 2].map(k => (
        <motion.svg key={k} width="15" height="20" viewBox="0 0 15 20" fill="none"
          animate={{ opacity: [0.3, 1, 0.3], x: [0, 3, 0] }}
          transition={{ repeat: Infinity, duration: 1.3, delay: k * 0.16, ease: 'easeInOut' }}>
          <path d="M3 3 L11 10 L3 17" stroke="currentColor" strokeWidth="3.2" strokeLinecap="round" strokeLinejoin="round"/>
        </motion.svg>
      ))}
    </span>
  )
}

function TreningVisual() {
  const { t } = useTranslation('appStory')
  const rows = [t('trening.row1'), t('trening.row2'), t('trening.row3')]
  const base = 0.15, step = 0.42
  return (
    <div style={{ width: 284 }}>
      {rows.map((r, idx) => {
        const d = base + idx * step
        return (
          <motion.div key={idx}
            initial={{ opacity: 0, x: -22 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: d, type: 'spring', stiffness: 300, damping: 24 }}
            style={{ display: 'flex', alignItems: 'center', gap: 13, padding: '13px 15px', marginBottom: 11, borderRadius: 14, position: 'relative', overflow: 'hidden',
              background: 'linear-gradient(180deg, rgba(255,255,255,0.07), rgba(255,255,255,0.03))', border: '1px solid rgba(150,200,255,0.14)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.06)' }}>
            {/* light sweep as the row checks off */}
            <motion.div initial={{ x: '-110%' }} animate={{ x: '130%' }} transition={{ delay: d + 0.3, duration: 0.7, ease: 'easeInOut' }}
              style={{ position: 'absolute', inset: 0, background: 'linear-gradient(90deg, transparent, rgba(91,184,245,0.24), transparent)', pointerEvents: 'none' }}/>
            {/* checkbox: pops in empty, fills green, tick strokes itself in */}
            <motion.div initial={{ scale: 0, backgroundColor: 'rgba(0,230,118,0)' }} animate={{ scale: 1, backgroundColor: 'rgba(0,230,118,0.2)' }}
              transition={{ scale: { delay: d + 0.22, type: 'spring', stiffness: 500, damping: 15 }, backgroundColor: { delay: d + 0.4, duration: 0.3 } }}
              style={{ width: 28, height: 28, borderRadius: '50%', flexShrink: 0, border: `1.5px solid ${GREEN}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative' }}>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={GREEN} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
                <motion.polyline points="20 6 9 17 4 12" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ delay: d + 0.4, duration: 0.32, ease: 'easeOut' }}/>
              </svg>
            </motion.div>
            <span style={{ color: '#EAF2FF', fontSize: 14.5, fontWeight: 600, position: 'relative' }}>{r}</span>
            <motion.span initial={{ opacity: 0, scale: 0.5, y: 6 }} animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ delay: d + 0.5, type: 'spring', stiffness: 520, damping: 14 }}
              style={{ marginLeft: 'auto', color: BLUE, fontSize: 13, fontWeight: 800, fontFamily: 'var(--font-display)', position: 'relative' }}>+10 XP</motion.span>
          </motion.div>
        )
      })}
      {/* running daily total — sits lower, breathing room */}
      <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: base + 0.35, duration: 0.4 }}
        style={{ display: 'flex', justifyContent: 'center', marginTop: 22 }}>
        <StatBadge theme="blue" icon="xp">+<CountUp to={30} dur={1200} delay={base + 0.4}/> {t('trening.xpToday')}</StatBadge>
      </motion.div>
    </div>
  )
}

function ArenyVisual() {
  // Mirrors the in-app arena road: a vertical stack of arena hexagons linked by
  // 3-dot connectors, climbing bottom → top, then a glassy star sweeps L → R.
  const ROAD = [1, 2, 3]                                    // Street Court → City Run → Golden Reign
  const items = ROAD.map(i => ({ idx: i, ...ARENAS[i] })).reverse()   // highest first (top)
  const n = items.length
  const base = 0.2, step = 0.5
  const reach = base + (n - 1) * step + 0.5
  return (
    <div style={{ position: 'relative', width: 178, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      {/* glassy white star — one smooth sweep L → R across the summit */}
      <motion.div
        initial={{ x: -50, opacity: 0 }}
        animate={{ x: 224, opacity: [0, 1, 1, 0] }}
        transition={{ delay: reach + 0.2, duration: 1.15, ease: 'easeInOut', times: [0, 0.14, 0.82, 1] }}
        style={{ position: 'absolute', left: 0, top: 6, width: 0, height: 0, pointerEvents: 'none', zIndex: 4 }}>
        <div style={{ position: 'absolute', right: 4, top: -1.5, width: 78, height: 3, borderRadius: 3,
          background: 'linear-gradient(90deg, transparent, rgba(214,236,255,0.92))', filter: 'blur(0.4px)' }}/>
        <div style={{ position: 'absolute', right: -3, top: -4, width: 9, height: 9, borderRadius: '50%', background: '#fff',
          boxShadow: '0 0 10px 3px rgba(255,255,255,0.95), 0 0 24px 9px rgba(180,220,255,0.55)' }}/>
      </motion.div>

      {items.map((a, i) => {
        const isTop = i === 0
        const sz = isTop ? 76 : 60
        const d = base + (n - 1 - i) * step                // bottom arena climbs in first
        return (
          <div key={a.idx} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            {/* 3-dot connector between arenas (app arena-road style) */}
            {i > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d + 0.18, duration: 0.3 }}
                style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '8px 0' }}>
                {[0, 1, 2].map(dot => <div key={dot} style={{ width: 5, height: 5, borderRadius: 999, background: 'rgba(255,255,255,0.18)' }}/>)}
              </motion.div>
            )}
            {/* arena hexagon */}
            <motion.div
              initial={{ opacity: 0, y: 16, scale: 0.55 }} animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ delay: d, type: 'spring', stiffness: 300, damping: 18 }}
              style={{ width: sz, height: sz, filter: `drop-shadow(0 6px 18px ${a.glow}${isTop ? 'aa' : '44'})` }}>
              <img src={`/arenas/arena-${a.idx}.png`} alt="" style={{ width: '100%', height: '100%', objectFit: 'contain', opacity: isTop ? 1 : 0.88 }}/>
            </motion.div>
            {/* name + XP threshold */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: d + 0.12, duration: 0.3 }}
              style={{ textAlign: 'center', marginTop: 3 }}>
              <div style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: isTop ? 14 : 12, textTransform: 'uppercase', letterSpacing: 0.3,
                color: isTop ? '#EAF2FF' : 'rgba(234,242,255,0.6)' }}>{a.name}</div>
              <div style={{ fontSize: 10.5, fontWeight: 700, color: a.glow, opacity: 0.9 }}>{a.threshold} XP</div>
            </motion.div>
          </div>
        )
      })}
    </div>
  )
}

// Mini half-court echoing the club court (hoop + paint at the bottom, halfcourt line up top).
function MiniCourt() {
  const L = 'rgba(0,210,255,0.34)'
  return (
    <svg viewBox="0 0 220 248" width="220" height="248" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="obFloor" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#13203A"/><stop offset="60%" stopColor="#0C1824"/><stop offset="100%" stopColor="#080F1A"/>
        </linearGradient>
        <radialGradient id="obHoopG" cx="50%" cy="102%" r="46%">
          <stop offset="0%" stopColor="rgba(255,168,24,0.17)"/><stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        <radialGradient id="obTopG" cx="50%" cy="2%" r="55%">
          <stop offset="0%" stopColor="rgba(0,150,255,0.12)"/><stop offset="100%" stopColor="transparent"/>
        </radialGradient>
      </defs>
      <rect x="0" y="0" width="220" height="248" rx="18" fill="url(#obFloor)"/>
      <rect x="0" y="0" width="220" height="248" rx="18" fill="url(#obTopG)"/>
      <rect x="0" y="0" width="220" height="248" rx="18" fill="url(#obHoopG)"/>
      <g stroke={L} strokeWidth="1.3" fill="none" strokeLinecap="round">
        <rect x="8" y="6" width="204" height="236" rx="4"/>
        {/* halfcourt line + center arc up top */}
        <line x1="8" y1="6" x2="212" y2="6"/>
        <path d="M 88 6 A 22 22 0 0 1 132 6"/>
        {/* 3pt: sidelines up from baseline, arc bulging toward the top */}
        <line x1="8" y1="150" x2="8" y2="242"/>
        <line x1="212" y1="150" x2="212" y2="242"/>
        <path d="M 8 150 A 128 128 0 0 1 212 150"/>
        {/* paint + free-throw arc */}
        <rect x="78" y="150" width="64" height="92" fill="rgba(0,110,255,0.10)"/>
        <path d="M 78 150 A 32 32 0 0 1 142 150"/>
      </g>
      {/* hoop + backboard at the baseline */}
      <circle cx="110" cy="228" r="8.5" fill="none" stroke="#FFA820" strokeWidth="2.2"/>
      <circle cx="110" cy="228" r="3.6" fill="rgba(255,168,32,0.16)"/>
      <rect x="94" y="240" width="32" height="3.4" rx="1.4" fill="#FFA820" opacity="0.9"/>
    </svg>
  )
}

function KlubVisual() {
  const { t } = useTranslation('appStory')
  const players = ['N', 'K', 'M', 'A', 'D']
  const HEX = 62
  // Container 260×330; court box at left 20, top 6 (220×248).
  // Phase 0: an overlapping huddle (they're "together").  Phase 1: full 2-2-1 on the court.
  // courtPos = top-left; centers are symmetric about the container midline (x=130).
  const rowPos   = [{ x: 23, y: 115 }, { x: 61, y: 115 }, { x: 99, y: 115 }, { x: 137, y: 115 }, { x: 175, y: 115 }]
  const courtPos = [{ x: 41, y: 19 }, { x: 157, y: 19 }, { x: 32, y: 94 }, { x: 166, y: 94 }, { x: 99, y: 159 }]
  const [onCourt, setOnCourt] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setOnCourt(true), 1250)
    return () => clearTimeout(t)
  }, [])
  return (
    <div style={{ position: 'relative', width: 260, height: 330 }}>
      {/* court slides up + fades in behind the players */}
      <motion.div
        initial={{ opacity: 0, y: 34, scale: 0.9 }}
        animate={{ opacity: onCourt ? 1 : 0, y: onCourt ? 0 : 34, scale: onCourt ? 1 : 0.9 }}
        transition={{ type: 'spring', stiffness: 90, damping: 16 }}
        style={{ position: 'absolute', left: 20, top: 6, filter: 'drop-shadow(0 14px 30px rgba(0,120,220,0.28))' }}>
        <MiniCourt/>
      </motion.div>

      {/* players: pop into a row, then glide to their spots */}
      {players.map((p, idx) => {
        const pos = onCourt ? courtPos[idx] : rowPos[idx]
        return (
          <motion.div key={idx}
            initial={{ scale: 0, x: rowPos[idx].x, y: rowPos[idx].y }}
            animate={{ scale: 1, x: pos.x, y: pos.y }}
            transition={{
              scale: { delay: 0.1 + idx * 0.12, type: 'spring', stiffness: 420, damping: 15 },
              x: { type: 'spring', stiffness: 120, damping: 18 },
              y: { type: 'spring', stiffness: 120, damping: 18 },
            }}
            style={{ position: 'absolute', left: 0, top: 0, zIndex: onCourt ? 5 : 10 - idx }}>
            <HexAvatar name={p} size={HEX} variant="none" noAnim/>
          </motion.div>
        )
      })}

      {/* +50 XP badge pops once the squad has settled */}
      <motion.div
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: onCourt ? 1 : 0, opacity: onCourt ? 1 : 0 }}
        transition={{ delay: onCourt ? 0.75 : 0, type: 'spring', stiffness: 420, damping: 13 }}
        style={{ position: 'absolute', left: 0, right: 0, bottom: 2, display: 'flex', justifyContent: 'center', zIndex: 20 }}>
        <StatBadge theme="blue" icon="xp">+<CountUp to={50} dur={800}/> {t('klub.xpPerMatch')}</StatBadge>
      </motion.div>
    </div>
  )
}

function KotcVisual() {
  const { t } = useTranslation('appStory')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 18 }}>
      <motion.img src="/kotklogo.png" alt=""
        initial={{ scale: 0, opacity: 0 }}
        animate={{ scale: 1, opacity: 1, y: [0, -9, 0] }}
        transition={{ scale: { type: 'spring', stiffness: 260, damping: 14 }, opacity: { duration: 0.4 },
          y: { repeat: Infinity, duration: 2.4, ease: 'easeInOut', delay: 0.5 } }}
        style={{ width: 158, height: 158, objectFit: 'contain', filter: 'drop-shadow(0 12px 30px rgba(240,190,60,0.42))' }}/>
      <motion.div initial={{ opacity: 0, y: 10, scale: 0.8 }} animate={{ opacity: 1, y: 0, scale: 1 }}
        transition={{ delay: 0.5, type: 'spring', stiffness: 420, damping: 14 }}>
        <StatBadge theme="gold" icon="fire">{t('kotc.streak')}: <CountUp to={3} dur={700}/></StatBadge>
      </motion.div>
    </div>
  )
}

// HoopConnect brand crest — faceted blue diamond/hexagon (mirrors AuthPage logo).
function DiamondLogo({ size = 140 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 90 90" fill="none" style={{ display: 'block' }}>
      <defs>
        <linearGradient id="obDia" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%" stopColor="#C8ECFF"/><stop offset="30%" stopColor="#5BB8F5"/><stop offset="65%" stopColor="#2272C3"/><stop offset="100%" stopColor="#0D4A8A"/>
        </linearGradient>
        <linearGradient id="obTopF" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="rgba(255,255,255,0.70)"/><stop offset="100%" stopColor="rgba(120,200,255,0.20)"/>
        </linearGradient>
        <linearGradient id="obLF" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(40,130,220,0.90)"/><stop offset="100%" stopColor="rgba(91,184,245,0.60)"/>
        </linearGradient>
        <linearGradient id="obRF" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="rgba(91,184,245,0.60)"/><stop offset="100%" stopColor="rgba(14,70,150,0.95)"/>
        </linearGradient>
        <clipPath id="obDiaClip"><polygon points="45,6 82,32 82,58 45,84 8,58 8,32"/></clipPath>
      </defs>
      <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(20,80,180,0.40)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill="url(#obDia)"/>
      <polygon points="45,6 8,32 45,42" fill="url(#obTopF)"/>
      <polygon points="45,6 82,32 45,42" fill="rgba(255,255,255,0.18)"/>
      <polygon points="45,84 8,58 45,48" fill="rgba(14,60,140,0.55)"/>
      <polygon points="45,84 82,58 45,48" fill="rgba(14,50,120,0.75)"/>
      <polygon points="8,32 8,58 45,48 45,42" fill="url(#obLF)"/>
      <polygon points="82,32 82,58 45,48 45,42" fill="url(#obRF)"/>
      <g clipPath="url(#obDiaClip)" stroke="rgba(255,255,255,0.26)" strokeWidth="1" fill="none">
        <line x1="21" y1="0" x2="21" y2="90"/><line x1="33" y1="0" x2="33" y2="90"/><line x1="45" y1="0" x2="45" y2="90"/><line x1="57" y1="0" x2="57" y2="90"/><line x1="69" y1="0" x2="69" y2="90"/>
        <line x1="0" y1="32" x2="90" y2="32"/><line x1="0" y1="42" x2="90" y2="42"/><line x1="0" y1="48" x2="90" y2="48"/><line x1="0" y1="58" x2="90" y2="58"/>
      </g>
      <g stroke="rgba(255,255,255,0.42)" strokeWidth="1.2" fill="none" strokeLinejoin="round">
        <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"/>
        <line x1="8" y1="32" x2="45" y2="42"/><line x1="82" y1="32" x2="45" y2="42"/><line x1="45" y1="42" x2="45" y2="48"/><line x1="8" y1="58" x2="45" y2="48"/><line x1="82" y1="58" x2="45" y2="48"/>
      </g>
    </svg>
  )
}

function StartVisual() {
  const FLIP_DELAY = 0.5, FLIP_DUR = 1.2
  const swapT = FLIP_DELAY + FLIP_DUR * 0.5   // edge-on moment
  const endT = FLIP_DELAY + FLIP_DUR
  const SZ = 158
  return (
    <div style={{ position: 'relative', width: 210, height: 210, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      {/* ambient rotating aurora */}
      <motion.div animate={{ rotate: 360 }} transition={{ repeat: Infinity, duration: 16, ease: 'linear' }}
        style={{ position: 'absolute', width: 200, height: 200, borderRadius: '50%',
          background: 'conic-gradient(from 0deg, rgba(91,184,245,0), rgba(91,184,245,0.22), rgba(255,255,255,0), rgba(240,138,34,0.18), rgba(91,184,245,0))',
          filter: 'blur(26px)', pointerEvents: 'none' }}/>

      {/* ground shadow under the ball */}
      <motion.div initial={{ opacity: 0, scaleX: 0.4 }} animate={{ opacity: 1, scaleX: 1 }} transition={{ delay: endT, duration: 0.5 }}
        style={{ position: 'absolute', bottom: 26, width: 118, height: 18, borderRadius: '50%',
          background: 'radial-gradient(ellipse, rgba(0,0,0,0.5), transparent 70%)', filter: 'blur(4px)', pointerEvents: 'none' }}/>

      {/* flipping medallion: logo → basketball */}
      <div style={{ perspective: 1000 }}>
        <motion.div
          initial={{ rotateY: 0, scale: 0.82, opacity: 0 }}
          animate={{ rotateY: 180, scale: 1, opacity: 1, y: [0, 0, -8, 0] }}
          transition={{
            rotateY: { delay: FLIP_DELAY, duration: FLIP_DUR, ease: [0.7, 0, 0.3, 1] },
            scale:   { type: 'spring', stiffness: 220, damping: 15 },
            opacity: { duration: 0.4 },
            y:       { delay: endT, duration: 0.6, times: [0, 0.35, 0.6, 1], ease: 'easeOut' },
          }}
          style={{ position: 'relative', width: SZ, height: SZ, transformStyle: 'preserve-3d' }}>
          {/* front face: logo */}
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ filter: 'drop-shadow(0 10px 26px rgba(40,120,220,0.5))' }}><DiamondLogo size={SZ}/></div>
          </div>
          {/* back face: basketball (pre-rotated so it lands upright) */}
          <div style={{ position: 'absolute', inset: 0, backfaceVisibility: 'hidden', transform: 'rotateY(180deg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ fontSize: SZ, lineHeight: 1, filter: 'drop-shadow(0 12px 26px rgba(210,90,20,0.5))' }}>🏀</div>
          </div>
        </motion.div>
      </div>

      {/* white flash at the edge-on swap */}
      <motion.div initial={{ opacity: 0, scale: 0.4 }} animate={{ opacity: [0, 0.9, 0], scale: [0.4, 1.1, 1.5] }}
        transition={{ delay: swapT - 0.12, duration: 0.5, ease: 'easeOut', times: [0, 0.4, 1] }}
        style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(255,255,255,0.95), rgba(150,210,255,0.4) 40%, transparent 70%)', pointerEvents: 'none' }}/>

      {/* shockwave ring */}
      <motion.div initial={{ opacity: 0, scale: 0.3 }} animate={{ opacity: [0, 0.7, 0], scale: [0.3, 1.0, 1.7] }}
        transition={{ delay: swapT, duration: 0.7, ease: 'easeOut', times: [0, 0.3, 1] }}
        style={{ position: 'absolute', width: 150, height: 150, borderRadius: '50%', border: '2px solid rgba(140,205,255,0.7)', pointerEvents: 'none' }}/>

      {/* particle burst */}
      {[...Array(10)].map((_, idx) => (
        <motion.div key={idx} initial={{ scale: 0, x: 0, y: 0, opacity: 0 }}
          animate={{ scale: [0, 1, 0.4], x: Math.cos(idx / 10 * 6.283) * 108, y: Math.sin(idx / 10 * 6.283) * 108, opacity: [0, 1, 0] }}
          transition={{ delay: swapT, duration: 0.8, ease: 'easeOut' }}
          style={{ position: 'absolute', width: 9, height: 9, borderRadius: '50%', background: idx % 2 ? BLUE : '#F08A22', pointerEvents: 'none' }}/>
      ))}
    </div>
  )
}

const SLIDES = [
  { key: 'trening', Visual: TreningVisual },
  { key: 'areny',   Visual: ArenyVisual },
  { key: 'klub',    Visual: KlubVisual },
  { key: 'kotc',    Visual: KotcVisual },
  { key: 'start',   Visual: StartVisual },
]

export default function AppOnboarding({ onDone }) {
  const { t } = useTranslation('appStory')
  // Dev: /onbstory?s=N jumps straight to a slide (defaults to 0 in production).
  const [i, setI] = useState(() => {
    try {
      const p = Number(new URLSearchParams(window.location.search).get('s'))
      return Number.isInteger(p) && p >= 0 && p < SLIDES.length ? p : 0
    } catch { return 0 }
  })
  const last = i === SLIDES.length - 1
  const s = SLIDES[i]
  const Visual = s.Visual
  const goNext = () => { if (i < SLIDES.length - 1) setI(i + 1) }
  const goPrev = () => { if (i > 0) setI(i - 1) }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9600, display: 'flex', flexDirection: 'column',
      background: 'radial-gradient(ellipse 90% 55% at 50% 12%, rgba(91,184,245,0.18), transparent 60%), linear-gradient(170deg, #0C1F38 0%, #091828 45%, #060F1E 100%)',
      padding: 'calc(env(safe-area-inset-top, 0px) + 16px) 22px calc(env(safe-area-inset-bottom, 0px) + 22px)',
    }}>
      {/* progress bars (visual only — taps pass through to the zones below) */}
      <div style={{ display: 'flex', gap: 6, pointerEvents: 'none' }}>
        {SLIDES.map((_, idx) => (
          <div key={idx} style={{ flex: 1, height: 3, borderRadius: 2, background: idx <= i ? BLUE : 'rgba(255,255,255,0.15)', transition: 'background .3s' }}/>
        ))}
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', marginTop: 18 }}>
        <AnimatePresence mode="wait">
          <motion.div key={s.key}
            initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -14 }} transition={{ duration: 0.3 }}
            style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            {/* visual fills the upper region so the slide isn't a tiny centred cluster */}
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 300 }}>
              <div style={{ transform: 'scale(1.14)', transformOrigin: 'center' }}><Visual/></div>
            </div>
            {/* copy sits lower with breathing room */}
            <div style={{ textAlign: 'center', maxWidth: 360, margin: '0 auto', paddingBottom: 'clamp(14px, 4.5vh, 52px)' }}>
              {t(`${s.key}.eyebrow`, { defaultValue: '' }) && (
                <p style={{ margin: '0 0 8px', fontFamily: 'var(--font-display)', fontWeight: 700,
                  fontSize: 'clamp(11px, 3.2vw, 13px)', letterSpacing: 2, textTransform: 'uppercase', color: '#FFC24D' }}>
                  {t(`${s.key}.eyebrow`)}
                </p>
              )}
              <h1 className="display-title" style={{ fontSize: 'clamp(30px, 8.5vw, 38px)', marginBottom: 14, lineHeight: 1.08 }}>{t(`${s.key}.title`)}</h1>
              <p style={{ color: 'rgba(238,244,255,0.72)', fontSize: 'clamp(15.5px, 4.3vw, 18px)', lineHeight: 1.6, margin: 0 }}>{t(`${s.key}.text`)}</p>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* IG-story tap zones: left half = back, right half = next (above the slide, below the enter button) */}
      <div style={{ position: 'absolute', inset: 0, display: 'flex', zIndex: 8 }}>
        <div style={{ flex: 1 }} onClick={goPrev} aria-label={t('skip')}/>
        <div style={{ flex: 1 }} onClick={goNext} aria-label={t('next')}/>
      </div>

      {/* enter button — last slide only, a triple right-chevron */}
      {last && (
        <div style={{ position: 'relative', zIndex: 10, display: 'flex' }}>
          <motion.button whileTap={{ scale: 0.97 }} onClick={onDone} className="btn-primary"
            style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 54 }} aria-label={t('enter')}>
            <TripleChevron/>
          </motion.button>
        </div>
      )}
    </div>
  )
}
