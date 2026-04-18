import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'

// ── DESIGN TOKENS (coolors.co palette: white · baby-blue · steel · silver) ───
const P = {
  pageBg:       '#ECF3FB',   // page wash
  cardBg:       '#FFFFFF',
  cardBorder:   '#C6DDEF',
  courtFloor:   '#F2EDE0',   // warm hardwood
  courtFloor2:  '#EBE4D0',
  courtLine:    'rgba(42,88,150,0.38)',
  courtPaint:   'rgba(60,115,185,0.13)',
  accentBlue:   '#2B6CB0',   // primary action
  accentLight:  '#63A4D8',   // lighter accent
  babyBlue:     '#BDD8EF',   // borders / dividers
  navy:         '#152D45',   // headings
  textMid:      '#3E5A72',   // body
  textLight:    '#7E96AA',   // captions / dim
  silver:       '#B8C8D6',   // inactive / disabled
  orangeHoop:   '#E07D18',   // basket
  white:        '#FFFFFF',
  shadow:       'rgba(30,70,120,0.10)',
  shadowDeep:   'rgba(20,50,100,0.18)',
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'hc_club_v1'

const COUNTRIES = [
  { code: 'PL', name: 'Polska',           flag: '🇵🇱' },
  { code: 'US', name: 'USA',              flag: '🇺🇸' },
  { code: 'DE', name: 'Niemcy',           flag: '🇩🇪' },
  { code: 'FR', name: 'Francja',          flag: '🇫🇷' },
  { code: 'ES', name: 'Hiszpania',        flag: '🇪🇸' },
  { code: 'IT', name: 'Włochy',           flag: '🇮🇹' },
  { code: 'GB', name: 'Wielka Brytania',  flag: '🇬🇧' },
  { code: 'PT', name: 'Portugalia',       flag: '🇵🇹' },
  { code: 'BR', name: 'Brazylia',         flag: '🇧🇷' },
  { code: 'NG', name: 'Nigeria',          flag: '🇳🇬' },
  { code: 'LT', name: 'Litwa',            flag: '🇱🇹' },
  { code: 'RS', name: 'Serbia',           flag: '🇷🇸' },
  { code: 'HR', name: 'Chorwacja',        flag: '🇭🇷' },
  { code: 'GR', name: 'Grecja',           flag: '🇬🇷' },
  { code: 'AU', name: 'Australia',        flag: '🇦🇺' },
  { code: 'CA', name: 'Kanada',           flag: '🇨🇦' },
]

const POSITIONS = [
  { key: 'PG', label: 'Rozgrywający',    row: 0 },
  { key: 'SG', label: 'Rzucający',       row: 0 },
  { key: 'SF', label: 'Skrzydłowy',      row: 1 },
  { key: 'C',  label: 'Środkowy',        row: 1, isCenter: true },
  { key: 'PF', label: 'Silny skrzydł.',  row: 1 },
]

// Players are placed as % of the 420px court container
// Basket at the bottom → guards top, forwards mid, center near key
const COURT_POS = {
  PG: { x: '26%', y: '11%' },
  SG: { x: '74%', y: '11%' },
  SF: { x: '16%', y: '40%' },
  C:  { x: '50%', y: '72%' },
  PF: { x: '84%', y: '40%' },
}

function loadClub() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) } catch { return null }
}
function saveClub(data) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data))
}

// ── COURT SVG (warm hardwood floor, blue lines, orange hoop) ─────────────────
function CourtBackground() {
  return (
    <svg
      viewBox="0 0 360 420"
      preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}
    >
      <defs>
        <linearGradient id="cFloor" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%"   stopColor={P.courtFloor} />
          <stop offset="100%" stopColor={P.courtFloor2} />
        </linearGradient>
        {/* warm glow near basket */}
        <radialGradient id="cHoopGlow" cx="50%" cy="98%" r="45%">
          <stop offset="0%"   stopColor="rgba(224,125,24,0.12)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        {/* faint blue tint near halfcourt */}
        <radialGradient id="cTopGlow" cx="50%" cy="5%" r="50%">
          <stop offset="0%"   stopColor="rgba(42,88,150,0.06)" />
          <stop offset="100%" stopColor="transparent" />
        </radialGradient>
        <clipPath id="cClip">
          <rect width="360" height="420" rx="16" />
        </clipPath>
      </defs>

      <g clipPath="url(#cClip)">
        {/* Floor */}
        <rect width="360" height="420" fill="url(#cFloor)" />
        <rect width="360" height="420" fill="url(#cHoopGlow)" />
        <rect width="360" height="420" fill="url(#cTopGlow)" />

        {/* Hardwood planks */}
        {[...Array(29)].map((_, i) => (
          <line key={i} x1="0" y1={i * 15} x2="360" y2={i * 15}
            stroke="rgba(160,120,50,0.065)" strokeWidth="1" />
        ))}

        {/* ── Court boundary ── */}
        <rect x="12" y="14" width="336" height="392" rx="3"
          fill="none" stroke={P.courtLine} strokeWidth="1.6" />

        {/* ── Halfcourt line ── */}
        <line x1="12" y1="52" x2="348" y2="52"
          stroke={P.courtLine} strokeWidth="1.5" />
        {/* Centre circle partial (lower half visible) */}
        <path d="M 144 52 A 36 36 0 0 0 216 52"
          fill="none" stroke="rgba(42,88,150,0.22)" strokeWidth="1.4" />

        {/* ── 3-point arc ── */}
        <line x1="14" y1="296" x2="14" y2="406"
          stroke={P.courtLine} strokeWidth="1.5" />
        <line x1="346" y1="296" x2="346" y2="406"
          stroke={P.courtLine} strokeWidth="1.5" />
        {/* Arc peaks off-screen at top — clipped naturally by court boundary */}
        <path d="M 14 296 A 220 220 0 0 1 346 296"
          fill="none" stroke={P.courtLine} strokeWidth="1.5" />

        {/* ── Key / Paint ── */}
        <rect x="130" y="284" width="100" height="122"
          fill={P.courtPaint} />
        <line x1="130" y1="284" x2="130" y2="406"
          stroke={P.courtLine} strokeWidth="1.5" />
        <line x1="230" y1="284" x2="230" y2="406"
          stroke={P.courtLine} strokeWidth="1.5" />
        {/* Free throw line */}
        <line x1="130" y1="284" x2="230" y2="284"
          stroke={P.courtLine} strokeWidth="1.5" />

        {/* FT circle — inside key */}
        <path d="M 130 284 A 50 50 0 0 1 230 284"
          fill="none" stroke={P.courtLine} strokeWidth="1.5" />
        {/* FT circle — outside key (dashed) */}
        <path d="M 130 284 A 50 50 0 0 0 230 284"
          fill="none" stroke="rgba(42,88,150,0.22)" strokeWidth="1.4"
          strokeDasharray="5 3" />

        {/* Lane hash marks */}
        <line x1="118" y1="318" x2="130" y2="318"
          stroke="rgba(42,88,150,0.30)" strokeWidth="1.2" />
        <line x1="230" y1="318" x2="242" y2="318"
          stroke="rgba(42,88,150,0.30)" strokeWidth="1.2" />
        <line x1="118" y1="349" x2="130" y2="349"
          stroke="rgba(42,88,150,0.30)" strokeWidth="1.2" />
        <line x1="230" y1="349" x2="242" y2="349"
          stroke="rgba(42,88,150,0.30)" strokeWidth="1.2" />

        {/* ── Basket area ── */}
        {/* Restricted area arc */}
        <path d="M 155 406 A 25 25 0 0 0 205 406"
          fill="none" stroke="rgba(42,88,150,0.28)" strokeWidth="1.4" />
        {/* Backboard */}
        <line x1="158" y1="388" x2="202" y2="388"
          stroke={P.orangeHoop} strokeWidth="2.8" strokeLinecap="round" />
        {/* Hoop */}
        <circle cx="180" cy="397" r="13"
          fill="none" stroke={P.orangeHoop} strokeWidth="2.2" />
        <circle cx="180" cy="397" r="5"
          fill="rgba(224,125,24,0.20)" />
      </g>
    </svg>
  )
}

// ── DIAMOND BADGE ─────────────────────────────────────────────────────────────
function DiamondBadge({ abbr = '?', size = 70 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 90 90"
      style={{ flexShrink: 0, overflow: 'visible',
        filter: `drop-shadow(0 3px 10px ${P.shadowDeep})` }}>
      <defs>
        <linearGradient id="bdgG" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor="#6EC0F7" />
          <stop offset="45%"  stopColor="#2B6CB0" />
          <stop offset="100%" stopColor="#0E2F58" />
        </linearGradient>
      </defs>
      <polygon points="45,9 84,33 84,61 45,87 6,61 6,33"  fill="rgba(0,0,0,0.18)" />
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"  fill="url(#bdgG)" />
      <polygon points="45,6 8,32 45,42"                   fill="rgba(255,255,255,0.30)" />
      <polygon points="45,6 82,32 45,42"                  fill="rgba(255,255,255,0.13)" />
      <polygon points="8,32 8,58 45,48 45,42"             fill="rgba(30,100,200,0.65)" />
      <polygon points="82,32 82,58 45,48 45,42"           fill="rgba(10,55,130,0.80)" />
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
        fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinejoin="round" />
      <text x="45" y="50" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={abbr.length > 2 ? '20' : '24'} fontWeight="900"
        fontFamily="var(--font-display), Montserrat, 'Arial Black', sans-serif"
        letterSpacing="1">
        {abbr.toUpperCase()}
      </text>
    </svg>
  )
}

// ── PLAYER SLOT ───────────────────────────────────────────────────────────────
function PlayerSlot({ position, member, size = 90, onPress }) {
  if (member) {
    return (
      <motion.button whileTap={{ scale: 0.92 }} onClick={onPress}
        style={{ background: 'none', border: 'none', cursor: 'pointer',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
        <svg width={size} height={size} viewBox="0 0 90 90"
          style={{ overflow: 'visible',
            filter: `drop-shadow(0 5px 14px rgba(20,60,120,0.32))` }}>
          <defs>
            <linearGradient id={`sg_${position.key}`} x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%"   stopColor="#1E4E8C" />
              <stop offset="100%" stopColor="#0A2048" />
            </linearGradient>
          </defs>
          <polygon points="45,9 84,33 84,61 45,87 6,61 6,33"  fill="rgba(0,0,0,0.22)" />
          <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"  fill={`url(#sg_${position.key})`} />
          <polygon points="45,6 8,32 45,42"                   fill="rgba(255,255,255,0.22)" />
          <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
            fill="none" stroke="rgba(99,164,216,0.70)" strokeWidth="2.2" strokeLinejoin="round" />
          {/* Outer glow ring */}
          <polygon points="45,2 88,29 88,61 45,88 2,61 2,29"
            fill="none" stroke="rgba(99,164,216,0.20)" strokeWidth="1.2" strokeLinejoin="round" />
          <text x="45" y="50" textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize="30" fontWeight="800"
            fontFamily="var(--font-display), Montserrat, sans-serif">
            {member.initial}
          </text>
        </svg>
        <div style={{ textAlign: 'center', marginTop: 1 }}>
          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.8,
            textTransform: 'uppercase', color: P.accentBlue, margin: 0 }}>
            {position.key}
          </p>
          <p style={{ fontSize: 10, fontWeight: 600, color: P.navy,
            margin: '1px 0 0', maxWidth: 76,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {member.name}
          </p>
        </div>
      </motion.button>
    )
  }

  return (
    <motion.button whileTap={{ scale: 0.91 }} onClick={onPress}
      style={{ background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={size} height={size} viewBox="0 0 90 90"
        style={{ overflow: 'visible',
          filter: 'drop-shadow(0 3px 8px rgba(20,60,120,0.12))' }}>
        <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
          fill="rgba(255,255,255,0.72)"
          stroke={P.accentLight} strokeWidth="1.8" strokeLinejoin="round"
          strokeDasharray="6 4" />
        {/* Plus icon */}
        <line x1="45" y1="34" x2="45" y2="56"
          stroke={P.accentBlue} strokeWidth="2.8" strokeLinecap="round" />
        <line x1="34" y1="45" x2="56" y2="45"
          stroke={P.accentBlue} strokeWidth="2.8" strokeLinecap="round" />
      </svg>
      <div style={{ textAlign: 'center', marginTop: 1 }}>
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.8,
          textTransform: 'uppercase', color: P.accentBlue, margin: 0 }}>
          {position.key}
        </p>
        <p style={{ fontSize: 9, color: P.textLight, margin: '1px 0 0' }}>
          Zaproś
        </p>
      </div>
    </motion.button>
  )
}

// ── INVITE MODAL ──────────────────────────────────────────────────────────────
function InviteModal({ club, position, member, onClose, onRemove }) {
  const [copied, setCopied] = useState(false)
  const link = `https://hoopconnect.pl/dolacz/${club.id}?pos=${position.key}`

  function copyLink() {
    navigator.clipboard.writeText(link).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2500)
    })
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(10,25,50,0.55)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 32px',
      }}>
      <motion.div
        initial={{ opacity: 0, y: 50 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 50 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, margin: '0 16px',
          background: P.white,
          borderRadius: 24,
          padding: '24px 24px 20px',
          boxShadow: `0 -4px 50px ${P.shadowDeep}`,
          border: `1px solid ${P.babyBlue}`,
        }}>
        <div style={{ width: 36, height: 3, background: P.babyBlue, borderRadius: 2, margin: '0 auto 20px' }} />

        {member ? (
          <>
            <p style={{ fontSize: 11, letterSpacing: 2, color: P.accentBlue, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
              Zawodnik · {position.key}
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: P.navy, marginBottom: 4 }}>
              {member.name}
            </p>
            <p style={{ fontSize: 12, color: P.textLight, marginBottom: 24 }}>{position.label}</p>
            <button onClick={onRemove} style={{
              width: '100%', padding: '13px',
              background: 'rgba(220,38,38,0.07)', border: '1px solid rgba(220,38,38,0.28)',
              borderRadius: 12, color: '#DC2626', fontFamily: 'var(--font-display)',
              fontWeight: 700, fontSize: 14, letterSpacing: 1, cursor: 'pointer',
            }}>
              Usuń z klubu
            </button>
          </>
        ) : (
          <>
            <p style={{ fontSize: 11, letterSpacing: 2, color: P.accentBlue, textTransform: 'uppercase', fontWeight: 700, marginBottom: 8 }}>
              Zaproś zawodnika
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22, color: P.navy, marginBottom: 4 }}>
              Pozycja: {position.key}
            </p>
            <p style={{ fontSize: 12, color: P.textLight, marginBottom: 20 }}>{position.label}</p>

            <div style={{
              padding: '11px 13px', background: '#F5F8FC',
              border: `1px solid ${P.babyBlue}`, borderRadius: 10,
              marginBottom: 12, fontFamily: 'monospace', fontSize: 11,
              color: P.textMid, wordBreak: 'break-all',
            }}>
              {link}
            </div>

            <motion.button whileTap={{ scale: 0.97 }} onClick={copyLink} style={{
              width: '100%', padding: '14px',
              background: copied
                ? 'rgba(5,150,105,0.08)'
                : `linear-gradient(135deg, ${P.accentBlue}, #1A4F8A)`,
              border: copied ? '1px solid rgba(5,150,105,0.35)' : 'none',
              borderRadius: 12,
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, letterSpacing: 1,
              color: copied ? '#059669' : P.white,
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
              {copied ? '✓ Skopiowano!' : '🔗 Kopiuj link zaproszenia'}
            </motion.button>
          </>
        )}
      </motion.div>
    </motion.div>
  )
}

// ── COUNTRY PICKER ────────────────────────────────────────────────────────────
function CountryPicker({ value, onChange, onClose }) {
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(10,25,50,0.55)',
        backdropFilter: 'blur(18px)', WebkitBackdropFilter: 'blur(18px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 24px',
      }}>
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, margin: '0 12px',
          background: P.white,
          border: `1px solid ${P.babyBlue}`,
          borderRadius: 24,
          maxHeight: '60vh', overflowY: 'auto',
          padding: '20px 0 16px',
          WebkitOverflowScrolling: 'touch',
          boxShadow: `0 -4px 40px ${P.shadow}`,
        }}>
        <p style={{ fontSize: 11, letterSpacing: 2.5, textTransform: 'uppercase', color: P.accentBlue, fontWeight: 700, margin: '0 20px 16px', textAlign: 'center' }}>
          Wybierz kraj
        </p>
        {COUNTRIES.map(c => (
          <button key={c.code} onClick={() => { onChange(c); onClose() }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '13px 20px',
              background: value?.code === c.code ? '#EDF5FC' : 'transparent',
              border: 'none', cursor: 'pointer',
              borderLeft: value?.code === c.code
                ? `3px solid ${P.accentBlue}`
                : '3px solid transparent',
            }}>
            <span style={{ fontSize: 24 }}>{c.flag}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: value?.code === c.code ? P.accentBlue : P.textMid }}>
              {c.name}
            </span>
            {value?.code === c.code && (
              <span style={{ marginLeft: 'auto', color: P.accentBlue, fontSize: 14 }}>✓</span>
            )}
          </button>
        ))}
      </motion.div>
    </motion.div>
  )
}

// ── CREATION SCREEN ───────────────────────────────────────────────────────────
function CreateClub({ onCreated, ownerName, ownerInitial }) {
  const [name, setName]         = useState('')
  const [abbr, setAbbr]         = useState('')
  const [country, setCountry]   = useState(COUNTRIES[0])
  const [showPicker, setShowPicker] = useState(false)

  function handleCreate() {
    if (!name.trim() || abbr.length < 2) return
    const club = {
      id: Math.random().toString(36).slice(2, 10),
      name: name.trim(),
      abbr: abbr.toUpperCase().slice(0, 3),
      country,
      createdAt: new Date().toISOString(),
      members: {
        PG: { name: ownerName, initial: ownerInitial, isOwner: true },
        SG: null, SF: null, C: null, PF: null,
      },
    }
    saveClub(club)
    onCreated(club)
  }

  const preview = abbr.trim().toUpperCase().slice(0, 3) || '?'
  const valid   = name.trim().length >= 3 && abbr.trim().length >= 2

  return (
    <div style={{
      minHeight: '100%', display: 'flex', flexDirection: 'column',
      padding: '44px 22px 40px',
      background: `linear-gradient(160deg, #E8F2FC 0%, ${P.pageBg} 50%, #F4F9FD 100%)`,
    }}>
      <AnimatePresence>
        {showPicker && <CountryPicker value={country} onChange={setCountry} onClose={() => setShowPicker(false)} />}
      </AnimatePresence>

      {/* Badge preview */}
      <motion.div
        initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 28 }}>
        <DiamondBadge abbr={preview} size={92} />
        <p style={{ fontSize: 9, letterSpacing: 3, color: P.accentBlue, textTransform: 'uppercase', fontWeight: 700, marginTop: 12 }}>
          Podgląd odznaki
        </p>
      </motion.div>

      {/* Title */}
      <h1 style={{
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 34,
        textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 1.1,
        color: P.navy, marginBottom: 6,
      }}>
        Załóż<br/>Klub
      </h1>
      <p style={{ color: P.textMid, fontSize: 13, marginBottom: 28, lineHeight: 1.55 }}>
        Stwórz drużynę, zaproś znajomych<br/>i rywalizujcie razem.
      </p>

      {/* Form card */}
      <div style={{
        background: P.white, borderRadius: 18,
        border: `1px solid ${P.cardBorder}`,
        boxShadow: `0 4px 24px ${P.shadow}`,
        padding: '20px 18px',
        display: 'flex', flexDirection: 'column', gap: 18,
      }}>
        {/* Club name */}
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: P.textLight, marginBottom: 6 }}>
            Nazwa klubu
          </p>
          <input
            placeholder="np. Hoopconnect Warsaw"
            value={name}
            onChange={e => setName(e.target.value)}
            maxLength={30}
            style={{
              width: '100%', padding: '12px 14px', fontSize: 15,
              background: '#F5F9FD', border: `1.5px solid ${P.babyBlue}`,
              borderRadius: 11, color: P.navy, outline: 'none',
              fontFamily: 'inherit', boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Abbreviation */}
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: P.textLight, marginBottom: 6 }}>
            Skrót (2–3 litery)
          </p>
          <input
            placeholder="HCW"
            value={abbr}
            onChange={e => setAbbr(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3))}
            maxLength={3}
            style={{
              width: '100%', padding: '12px 14px', fontSize: 22,
              fontWeight: 800, letterSpacing: 6, textTransform: 'uppercase',
              fontFamily: 'var(--font-display)',
              background: '#F5F9FD', border: `1.5px solid ${P.babyBlue}`,
              borderRadius: 11, color: P.navy, outline: 'none',
              boxSizing: 'border-box',
            }}
          />
        </div>

        {/* Country */}
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: P.textLight, marginBottom: 6 }}>
            Kraj
          </p>
          <button onClick={() => setShowPicker(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '12px 14px',
            background: '#F5F9FD', border: `1.5px solid ${P.babyBlue}`,
            borderRadius: 11, cursor: 'pointer',
            WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ fontSize: 22 }}>{country.flag}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: P.navy }}>{country.name}</span>
            <svg style={{ marginLeft: 'auto' }} width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke={P.silver} strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {/* Create button */}
      <motion.button
        whileTap={{ scale: 0.97 }}
        onClick={handleCreate}
        disabled={!valid}
        style={{
          marginTop: 22,
          width: '100%', padding: '16px',
          background: valid
            ? `linear-gradient(135deg, ${P.accentLight}, ${P.accentBlue})`
            : '#E0E8F0',
          border: 'none',
          borderRadius: 14,
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 15,
          letterSpacing: 2, textTransform: 'uppercase',
          color: valid ? P.white : P.silver,
          cursor: valid ? 'pointer' : 'default',
          transition: 'all 0.2s',
          boxShadow: valid ? `0 6px 24px rgba(43,108,176,0.35)` : 'none',
        }}
      >
        Utwórz Klub
      </motion.button>
    </div>
  )
}

// ── CLUB PANEL ────────────────────────────────────────────────────────────────
function ClubPanel({ club, onUpdate }) {
  const [invite, setInvite]         = useState(null)
  const [copiedClub, setCopiedClub] = useState(false)

  function handleSlotPress(position) {
    setInvite({ position, member: club.members[position.key] })
  }
  function handleRemoveMember(posKey) {
    const updated = { ...club, members: { ...club.members, [posKey]: null } }
    saveClub(updated)
    onUpdate(updated)
    setInvite(null)
  }
  function copyClubLink() {
    navigator.clipboard.writeText(`https://hoopconnect.pl/klub/${club.id}`)
    setCopiedClub(true)
    setTimeout(() => setCopiedClub(false), 2500)
  }

  const memberCount = Object.values(club.members).filter(Boolean).length
  const isFull      = memberCount === 5

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minHeight: '100%',
      background: `linear-gradient(160deg, #E4EFF9 0%, ${P.pageBg} 45%, #F0F6FC 100%)`,
      overflowY: 'auto',
    }}>
      <AnimatePresence>
        {invite && (
          <InviteModal
            club={club}
            position={invite.position}
            member={invite.member}
            onClose={() => setInvite(null)}
            onRemove={() => handleRemoveMember(invite.position.key)}
          />
        )}
      </AnimatePresence>

      {/* ── Header card ── */}
      <div style={{ padding: '22px 16px 0' }}>
        <div style={{
          background: P.white, borderRadius: 20,
          border: `1px solid ${P.cardBorder}`,
          boxShadow: `0 4px 20px ${P.shadow}`,
          padding: '18px 18px 16px',
          marginBottom: 12,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
            <DiamondBadge abbr={club.abbr} size={60} />
            <div style={{ flex: 1, minWidth: 0 }}>
              {/* Country pill */}
              <div style={{
                display: 'inline-flex', alignItems: 'center', gap: 5,
                padding: '3px 10px', borderRadius: 99,
                background: '#EDF5FC', border: `1px solid ${P.babyBlue}`,
                marginBottom: 5,
              }}>
                <span style={{ fontSize: 13 }}>{club.country.flag}</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2,
                  textTransform: 'uppercase', color: P.accentBlue }}>
                  {club.country.name}
                </span>
              </div>
              <h1 style={{
                fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20,
                textTransform: 'uppercase', color: P.navy,
                letterSpacing: 0.4, lineHeight: 1.1, margin: 0,
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>{club.name}</h1>
            </div>
          </div>

          {/* Stats row */}
          <div style={{ display: 'flex', gap: 8 }}>
            {[
              { label: 'Skrót',    val: club.abbr,            icon: '🔷' },
              { label: 'Skład',    val: `${memberCount} / 5`, icon: '👥' },
              { label: 'Status',   val: isFull ? 'Pełny' : 'Rekrutacja',
                accent: isFull ? '#059669' : P.accentBlue,    icon: isFull ? '✅' : '🔍' },
            ].map(s => (
              <div key={s.label} style={{
                flex: 1, padding: '9px 8px',
                background: '#F5F9FD',
                border: `1px solid ${P.cardBorder}`,
                borderRadius: 11, textAlign: 'center',
              }}>
                <p style={{ fontSize: 13, marginBottom: 2 }}>{s.icon}</p>
                <p style={{ fontSize: 7.5, letterSpacing: 1.4, textTransform: 'uppercase',
                  color: P.textLight, marginBottom: 3 }}>{s.label}</p>
                <p style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 800,
                  color: s.accent || P.navy, margin: 0 }}>{s.val}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Court card (framed) ── */}
      <div style={{ padding: '0 16px', flex: 1 }}>
        <div style={{
          background: P.white,
          borderRadius: 22,
          border: `2px solid ${P.cardBorder}`,
          boxShadow: `0 6px 32px ${P.shadowDeep}, 0 1px 4px ${P.shadow}`,
          overflow: 'hidden',
          // Top label bar
        }}>
          {/* Court label */}
          <div style={{
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 16px 10px',
            borderBottom: `1px solid ${P.cardBorder}`,
            background: '#F5F9FD',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {/* Mini court icon */}
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke={P.accentBlue} strokeWidth="2" strokeLinecap="round">
                <rect x="2" y="3" width="20" height="18" rx="2"/>
                <line x1="12" y1="3" x2="12" y2="21"/>
                <circle cx="12" cy="12" r="3"/>
              </svg>
              <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2.5,
                textTransform: 'uppercase', color: P.accentBlue }}>
                Skład drużyny
              </span>
            </div>
            <span style={{ fontSize: 10, color: P.textLight, fontWeight: 600 }}>
              {memberCount}/5 graczy
            </span>
          </div>

          {/* Court + players */}
          <div style={{ position: 'relative', height: 420, overflow: 'visible' }}>
            <CourtBackground />

            {POSITIONS.map(pos => (
              <div key={pos.key} style={{
                position: 'absolute',
                left: COURT_POS[pos.key].x,
                top: COURT_POS[pos.key].y,
                transform: 'translate(-50%, -50%)',
                zIndex: 3,
              }}>
                <PlayerSlot
                  position={pos}
                  member={club.members[pos.key]}
                  size={pos.isCenter ? 104 : 88}
                  onPress={() => handleSlotPress(pos)}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Share bar ── */}
      <div style={{ padding: '16px 16px 110px' }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={copyClubLink} style={{
          width: '100%', padding: '14px',
          background: copiedClub
            ? 'rgba(5,150,105,0.08)'
            : `linear-gradient(135deg, ${P.accentLight}, ${P.accentBlue})`,
          border: copiedClub ? '1.5px solid rgba(5,150,105,0.40)' : 'none',
          borderRadius: 14,
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13,
          letterSpacing: 1.5, textTransform: 'uppercase',
          color: copiedClub ? '#059669' : P.white,
          cursor: 'pointer',
          boxShadow: copiedClub ? 'none' : `0 5px 20px rgba(43,108,176,0.32)`,
          transition: 'all 0.22s',
        }}>
          {copiedClub ? '✓ Link skopiowany!' : '🔗 Udostępnij klub'}
        </motion.button>
      </div>
    </div>
  )
}

// ── MAIN PAGE ──────────────────────────────────────────────────────────────────
export default function ClubPage() {
  const { profile } = useAuth()
  const [club, setClub] = useState(() => loadClub())

  const ownerName    = profile?.name || 'Ty'
  const ownerInitial = ownerName.trim()[0]?.toUpperCase() || 'T'

  return (
    <div className="page-content" style={{ padding: 0 }}>
      <AnimatePresence mode="wait">
        {!club ? (
          <motion.div key="create"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            style={{ minHeight: '100%' }}>
            <CreateClub onCreated={setClub} ownerName={ownerName} ownerInitial={ownerInitial} />
          </motion.div>
        ) : (
          <motion.div key="panel"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            <ClubPanel club={club} onUpdate={setClub} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
