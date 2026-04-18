import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// ── DESIGN TOKENS ─────────────────────────────────────────────────────────────
const P = {
  pageBg:     '#111620',
  cardBg:     '#1A1F2E',
  cardBorder: 'rgba(80,145,205,0.18)',
  courtBg:    '#151A26',
  courtLine:  'rgba(88,160,215,0.30)',
  courtPaint: 'rgba(45,95,165,0.20)',
  accent:     '#5BA8D8',
  accentDim:  'rgba(91,168,216,0.50)',
  textPri:    '#D8E8F4',
  textMid:    '#7A96AE',
  textDim:    '#46606E',
  hoopOrange: '#D9801A',
  white:      '#FFFFFF',
  swapRing:   '#63E2FF',
}

// ── CONSTANTS ─────────────────────────────────────────────────────────────────
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
  { key: 'PG', label: 'Rozgrywający' },
  { key: 'SG', label: 'Rzucający'    },
  { key: 'SF', label: 'Skrzydłowy'   },
  { key: 'C',  label: 'Środkowy'     },
  { key: 'PF', label: 'Silny skrzydł.' },
]

const COURT_POS = {
  PG: { x: '26%', y: '11%' },
  SG: { x: '74%', y: '11%' },
  SF: { x: '16%', y: '40%' },
  C:  { x: '50%', y: '72%' },
  PF: { x: '84%', y: '40%' },
}

const SLOT_SIZE = 88

// ── SUPABASE DATA LAYER ───────────────────────────────────────────────────────

/** Map DB rows → UI club object */
function dbToUi(club) {
  const members = { PG: null, SG: null, SF: null, C: null, PF: null }
  for (const m of club.club_members ?? []) {
    if (m.user_id && m.profiles) {
      const name = m.profiles.name ?? '?'
      members[m.position] = {
        id:      m.user_id,
        name,
        initial: name.trim()[0]?.toUpperCase() ?? '?',
        isOwner: m.user_id === club.owner_id,
      }
    }
  }
  return {
    id:      club.id,
    name:    club.name,
    abbr:    club.abbr,
    country: { code: club.country_code, name: club.country_name, flag: club.country_flag },
    ownerId: club.owner_id,
    members,
  }
}

/** Fetch the club that this user belongs to (as owner OR member) */
async function apiFetchClub(userId) {
  const { data: membership } = await supabase
    .from('club_members')
    .select('club_id')
    .eq('user_id', userId)
    .maybeSingle()

  if (!membership) return null

  const { data: club, error } = await supabase
    .from('clubs')
    .select(`
      id, name, abbr,
      country_code, country_name, country_flag,
      owner_id,
      club_members ( position, user_id, profiles ( name ) )
    `)
    .eq('id', membership.club_id)
    .single()

  if (error || !club) return null
  return dbToUi(club)
}

/** Create a new club and place the owner at PG */
async function apiCreateClub({ name, abbr, country, profile }) {
  const { data: club, error: clubErr } = await supabase
    .from('clubs')
    .insert({
      name,
      abbr:         abbr.toUpperCase(),
      country_code: country.code,
      country_name: country.name,
      country_flag: country.flag,
      owner_id:     profile.id,
    })
    .select()
    .single()

  if (clubErr) throw clubErr

  const { error: memberErr } = await supabase
    .from('club_members')
    .insert({ club_id: club.id, user_id: profile.id, position: 'PG' })

  if (memberErr) throw memberErr

  return dbToUi({
    ...club,
    club_members: [{ position: 'PG', user_id: profile.id, profiles: { name: profile.name } }],
  })
}

/** Remove a member from a position slot */
async function apiRemoveMember(clubId, position) {
  const { error } = await supabase
    .from('club_members')
    .delete()
    .eq('club_id', clubId)
    .eq('position', position)

  if (error) throw error
}

/** Swap two positions via atomic RPC (handles UNIQUE constraint safely) */
async function apiSwapPositions(clubId, posA, posB) {
  const { error } = await supabase.rpc('swap_positions', {
    p_club_id: clubId,
    p_pos_a:   posA,
    p_pos_b:   posB,
  })
  if (error) throw error
}

// ── COURT SVG ─────────────────────────────────────────────────────────────────
function CourtBackground() {
  return (
    <svg viewBox="0 0 360 420" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        <radialGradient id="cHoop" cx="50%" cy="98%" r="45%">
          <stop offset="0%"   stopColor="rgba(217,128,26,0.14)"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        <clipPath id="cClip"><rect width="360" height="420" rx="18"/></clipPath>
      </defs>
      <g clipPath="url(#cClip)">
        <rect width="360" height="420" fill={P.courtBg}/>
        <rect width="360" height="420" fill="url(#cHoop)"/>
        {[...Array(29)].map((_, i) => (
          <line key={i} x1="0" y1={i*15} x2="360" y2={i*15}
            stroke="rgba(255,255,255,0.015)" strokeWidth="1"/>
        ))}
        <rect x="12" y="14" width="336" height="392" rx="3"
          fill="none" stroke={P.courtLine} strokeWidth="1.5"/>
        <line x1="12" y1="52" x2="348" y2="52" stroke={P.courtLine} strokeWidth="1.4"/>
        <path d="M 144 52 A 36 36 0 0 0 216 52"
          fill="none" stroke="rgba(88,160,215,0.18)" strokeWidth="1.3"/>
        <line x1="14" y1="296" x2="14" y2="406" stroke={P.courtLine} strokeWidth="1.4"/>
        <line x1="346" y1="296" x2="346" y2="406" stroke={P.courtLine} strokeWidth="1.4"/>
        <path d="M 14 296 A 220 220 0 0 1 346 296"
          fill="none" stroke={P.courtLine} strokeWidth="1.4"/>
        <rect x="130" y="284" width="100" height="122" fill={P.courtPaint}/>
        <line x1="130" y1="284" x2="130" y2="406" stroke={P.courtLine} strokeWidth="1.4"/>
        <line x1="230" y1="284" x2="230" y2="406" stroke={P.courtLine} strokeWidth="1.4"/>
        <line x1="130" y1="284" x2="230" y2="284" stroke={P.courtLine} strokeWidth="1.4"/>
        <path d="M 130 284 A 50 50 0 0 1 230 284"
          fill="none" stroke={P.courtLine} strokeWidth="1.4"/>
        <path d="M 130 284 A 50 50 0 0 0 230 284"
          fill="none" stroke="rgba(88,160,215,0.15)" strokeWidth="1.3" strokeDasharray="5 3"/>
        {[[118,318],[118,349],[230,318],[230,349]].map(([x,y]) => (
          <line key={`${x}${y}`}
            x1={x} y1={y} x2={x < 130 ? 130 : 242} y2={y}
            stroke="rgba(88,160,215,0.25)" strokeWidth="1.2"/>
        ))}
        <path d="M 155 406 A 25 25 0 0 0 205 406"
          fill="none" stroke="rgba(88,160,215,0.22)" strokeWidth="1.3"/>
        <line x1="158" y1="388" x2="202" y2="388"
          stroke={P.hoopOrange} strokeWidth="2.8" strokeLinecap="round"/>
        <circle cx="180" cy="397" r="13" fill="none" stroke={P.hoopOrange} strokeWidth="2.2"/>
        <circle cx="180" cy="397" r="5" fill="rgba(217,128,26,0.18)"/>
      </g>
    </svg>
  )
}

// ── DIAMOND BADGE ─────────────────────────────────────────────────────────────
function DiamondBadge({ abbr = '?', size = 70 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 90 90"
      style={{ flexShrink: 0, overflow: 'visible',
        filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.50))' }}>
      <defs>
        <linearGradient id="bdgG" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor="#6EC0F7"/>
          <stop offset="45%"  stopColor="#2B6CB0"/>
          <stop offset="100%" stopColor="#0E2F58"/>
        </linearGradient>
      </defs>
      <polygon points="45,9 84,33 84,61 45,87 6,61 6,33"  fill="rgba(0,0,0,0.28)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"  fill="url(#bdgG)"/>
      <polygon points="45,6 8,32 45,42"                   fill="rgba(255,255,255,0.28)"/>
      <polygon points="45,6 82,32 45,42"                  fill="rgba(255,255,255,0.12)"/>
      <polygon points="8,32 8,58 45,48 45,42"             fill="rgba(30,100,200,0.65)"/>
      <polygon points="82,32 82,58 45,48 45,42"           fill="rgba(10,55,130,0.80)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
        fill="none" stroke="rgba(255,255,255,0.50)" strokeWidth="1.8" strokeLinejoin="round"/>
      <text x="45" y="50" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={abbr.length > 2 ? '20' : '24'} fontWeight="900"
        fontFamily="var(--font-display), Montserrat, 'Arial Black', sans-serif" letterSpacing="1">
        {abbr.toUpperCase()}
      </text>
    </svg>
  )
}

// ── PLAYER SLOT ───────────────────────────────────────────────────────────────
function PlayerSlot({ position, member, onPress, swapMode, isSwapSource }) {
  const sz = SLOT_SIZE
  const ringColor  = isSwapSource ? P.swapRing : 'rgba(88,160,215,0.60)'
  const glowFilter = isSwapSource
    ? `drop-shadow(0 0 10px ${P.swapRing})`
    : member
      ? 'drop-shadow(0 4px 12px rgba(0,0,0,0.55))'
      : 'drop-shadow(0 2px 6px rgba(0,0,0,0.30))'

  return (
    <motion.button whileTap={{ scale: 0.90 }} onClick={onPress}
      animate={isSwapSource ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ repeat: isSwapSource ? Infinity : 0, duration: 0.9 }}
      style={{ background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
      <svg width={sz} height={sz} viewBox="0 0 90 90"
        style={{ overflow: 'visible', filter: glowFilter }}>
        {swapMode && (
          <polygon points="45,2 88,29 88,61 45,88 2,61 2,29" fill="none"
            stroke={isSwapSource ? P.swapRing : 'rgba(99,226,255,0.22)'}
            strokeWidth={isSwapSource ? '2' : '1'} strokeLinejoin="round"
            strokeDasharray={isSwapSource ? '0' : '5 4'}/>
        )}
        {member ? (
          <>
            <defs>
              <linearGradient id={`sg_${position.key}`} x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%"   stopColor={isSwapSource ? '#1A6090' : '#1C3A60'}/>
                <stop offset="100%" stopColor={isSwapSource ? '#0A3860' : '#0A1A38'}/>
              </linearGradient>
            </defs>
            <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,0.35)"/>
            <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill={`url(#sg_${position.key})`}/>
            <polygon points="45,6 8,32 45,42" fill="rgba(255,255,255,0.18)"/>
            <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
              fill="none" stroke={ringColor} strokeWidth="2" strokeLinejoin="round"/>
            <polygon points="45,2 88,29 88,61 45,88 2,61 2,29"
              fill="none" stroke="rgba(91,168,216,0.18)" strokeWidth="1.2" strokeLinejoin="round"/>
            <text x="45" y="50" textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize="29" fontWeight="800"
              fontFamily="var(--font-display), Montserrat, sans-serif">
              {member.initial}
            </text>
          </>
        ) : (
          <>
            <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
              fill="rgba(255,255,255,0.04)"
              stroke={swapMode ? 'rgba(99,226,255,0.30)' : P.accentDim}
              strokeWidth="1.8" strokeLinejoin="round" strokeDasharray="6 4"/>
            <line x1="45" y1="34" x2="45" y2="56"
              stroke={swapMode ? 'rgba(99,226,255,0.50)' : P.accent}
              strokeWidth="2.8" strokeLinecap="round"/>
            <line x1="34" y1="45" x2="56" y2="45"
              stroke={swapMode ? 'rgba(99,226,255,0.50)' : P.accent}
              strokeWidth="2.8" strokeLinecap="round"/>
          </>
        )}
      </svg>
      <div style={{ textAlign: 'center', marginTop: 1 }}>
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.8, textTransform: 'uppercase',
          color: isSwapSource ? P.swapRing : P.accent, margin: 0 }}>
          {position.key}
        </p>
        {member
          ? <p style={{ fontSize: 10, fontWeight: 600, color: P.textPri,
              margin: '1px 0 0', maxWidth: 78,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.name}
            </p>
          : <p style={{ fontSize: 9, color: P.textDim, margin: '1px 0 0' }}>Zaproś</p>
        }
      </div>
    </motion.button>
  )
}

// ── INVITE / MEMBER MODAL ─────────────────────────────────────────────────────
function InviteModal({ club, position, member, onClose, onRemove, removing }) {
  const [copied, setCopied] = useState(false)
  const link = `https://hoopconnect.pl/dolacz/${club.id}?pos=${position.key}`

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(5,10,20,0.72)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 32px' }}>
      <motion.div
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 50, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, margin: '0 16px',
          background: P.cardBg, borderRadius: 24, padding: '24px 22px 20px',
          border: `1px solid ${P.cardBorder}`,
          boxShadow: '0 -4px 50px rgba(0,0,0,0.70)' }}>

        <div style={{ width: 32, height: 3, background: P.cardBorder,
          borderRadius: 2, margin: '0 auto 20px' }}/>

        <p style={{ fontSize: 10, letterSpacing: 2, color: P.accent,
          textTransform: 'uppercase', fontWeight: 700, marginBottom: 6 }}>
          {position.key} · {position.label}
        </p>

        {member ? (
          <>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 22,
              color: P.textPri, marginBottom: 20 }}>
              {member.name}
              {member.isOwner && (
                <span style={{ fontSize: 11, color: P.accent, fontWeight: 600,
                  marginLeft: 8, letterSpacing: 1 }}>OWNER</span>
              )}
            </p>
            {!member.isOwner && (
              <button onClick={onRemove} disabled={removing}
                style={{ width: '100%', padding: '13px',
                  background: 'rgba(220,38,38,0.10)', border: '1px solid rgba(220,38,38,0.28)',
                  borderRadius: 12, color: removing ? P.textDim : '#F87171',
                  fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                  letterSpacing: 1, cursor: removing ? 'default' : 'pointer' }}>
                {removing ? 'Usuwanie…' : 'Usuń z klubu'}
              </button>
            )}
          </>
        ) : (
          <>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20,
              color: P.textPri, marginBottom: 16 }}>
              Zaproś zawodnika
            </p>
            <div style={{ padding: '10px 12px', background: 'rgba(255,255,255,0.04)',
              border: `1px solid ${P.cardBorder}`, borderRadius: 10, marginBottom: 12,
              fontFamily: 'monospace', fontSize: 11, color: P.textMid, wordBreak: 'break-all' }}>
              {link}
            </div>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => {
                navigator.clipboard.writeText(link).then(() => {
                  setCopied(true); setTimeout(() => setCopied(false), 2500)
                })
              }}
              style={{ width: '100%', padding: '13px',
                background: copied ? 'rgba(5,150,105,0.12)'
                  : `linear-gradient(135deg, ${P.accent}, #1A6AB0)`,
                border: copied ? '1px solid rgba(5,150,105,0.35)' : 'none',
                borderRadius: 12, fontFamily: 'var(--font-display)', fontWeight: 700,
                fontSize: 14, letterSpacing: 1,
                color: copied ? '#34D399' : P.white, cursor: 'pointer', transition: 'all 0.2s' }}>
              {copied ? '✓ Skopiowano!' : '🔗 Kopiuj link'}
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
      style={{ position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(5,10,20,0.72)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 24px' }}>
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 28 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, margin: '0 12px',
          background: P.cardBg, border: `1px solid ${P.cardBorder}`,
          borderRadius: 24, maxHeight: '60vh', overflowY: 'auto',
          padding: '20px 0 16px', WebkitOverflowScrolling: 'touch',
          boxShadow: '0 -4px 40px rgba(0,0,0,0.60)' }}>
        <p style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
          color: P.accent, fontWeight: 700, margin: '0 20px 14px', textAlign: 'center' }}>
          Wybierz kraj
        </p>
        {COUNTRIES.map(c => (
          <button key={c.code} onClick={() => { onChange(c); onClose() }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 20px',
              background: value?.code === c.code ? 'rgba(91,168,216,0.10)' : 'transparent',
              border: 'none', cursor: 'pointer',
              borderLeft: value?.code === c.code
                ? `3px solid ${P.accent}` : '3px solid transparent' }}>
            <span style={{ fontSize: 22 }}>{c.flag}</span>
            <span style={{ fontSize: 14, fontWeight: 600,
              color: value?.code === c.code ? P.accent : P.textMid }}>
              {c.name}
            </span>
            {value?.code === c.code && (
              <span style={{ marginLeft: 'auto', color: P.accent }}>✓</span>
            )}
          </button>
        ))}
      </motion.div>
    </motion.div>
  )
}

// ── CREATION SCREEN ───────────────────────────────────────────────────────────
function CreateClub({ onCreated, profile }) {
  const [name, setName]         = useState('')
  const [abbr, setAbbr]         = useState('')
  const [country, setCountry]   = useState(COUNTRIES[0])
  const [showPicker, setShowPicker] = useState(false)
  const [saving, setSaving]     = useState(false)
  const [error, setError]       = useState(null)

  async function handleCreate() {
    if (!name.trim() || abbr.length < 2 || saving) return
    setSaving(true)
    setError(null)
    try {
      const club = await apiCreateClub({ name: name.trim(), abbr, country, profile })
      onCreated(club)
    } catch (e) {
      setError('Nie udało się utworzyć klubu. Spróbuj ponownie.')
      setSaving(false)
    }
  }

  const preview = abbr.trim().toUpperCase().slice(0, 3) || '?'
  const valid   = name.trim().length >= 3 && abbr.trim().length >= 2

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column',
      padding: '44px 20px 40px', background: P.pageBg }}>
      <AnimatePresence>
        {showPicker && <CountryPicker value={country} onChange={setCountry} onClose={() => setShowPicker(false)}/>}
      </AnimatePresence>

      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
        <DiamondBadge abbr={preview} size={90}/>
        <p style={{ fontSize: 9, letterSpacing: 3, color: P.accent, textTransform: 'uppercase',
          fontWeight: 700, marginTop: 12 }}>Podgląd odznaki</p>
      </motion.div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 34,
        textTransform: 'uppercase', letterSpacing: 0.4, lineHeight: 1.1,
        color: P.textPri, marginBottom: 6 }}>
        Załóż<br/>Klub
      </h1>
      <p style={{ color: P.textMid, fontSize: 13, marginBottom: 28, lineHeight: 1.55 }}>
        Stwórz drużynę, zaproś znajomych i rywalizujcie razem.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[
          { label: 'Nazwa klubu', ph: 'np. Hoopconnect Warsaw', val: name,
            onChange: e => setName(e.target.value), max: 30, extra: {} },
          { label: 'Skrót (2–3 litery)', ph: 'HCW', val: abbr,
            onChange: e => setAbbr(e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3)),
            max: 3, extra: { fontSize: 22, fontWeight: 800, letterSpacing: 5,
              fontFamily: 'var(--font-display)' } },
        ].map(f => (
          <div key={f.label}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2,
              textTransform: 'uppercase', color: P.textDim, marginBottom: 6 }}>{f.label}</p>
            <input placeholder={f.ph} value={f.val} onChange={f.onChange} maxLength={f.max}
              style={{ width: '100%', padding: '13px 14px', fontSize: 15,
                background: P.cardBg, border: `1.5px solid ${P.cardBorder}`,
                borderRadius: 12, color: P.textPri, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box', ...f.extra }}/>
          </div>
        ))}

        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', color: P.textDim, marginBottom: 6 }}>Kraj</p>
          <button onClick={() => setShowPicker(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '13px 14px', background: P.cardBg,
            border: `1.5px solid ${P.cardBorder}`, borderRadius: 12,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
            <span style={{ fontSize: 22 }}>{country.flag}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: P.textPri }}>{country.name}</span>
            <svg style={{ marginLeft: 'auto' }} width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke={P.textDim} strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {error && (
        <p style={{ color: '#F87171', fontSize: 12, marginTop: 12, textAlign: 'center' }}>{error}</p>
      )}

      <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate}
        disabled={!valid || saving}
        style={{ marginTop: 24, width: '100%', padding: '16px',
          background: valid && !saving
            ? `linear-gradient(135deg, ${P.accent}, #1A6AB0)` : P.cardBg,
          border: valid ? 'none' : `1px solid ${P.cardBorder}`,
          borderRadius: 14, fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 15, letterSpacing: 2, textTransform: 'uppercase',
          color: valid && !saving ? P.white : P.textDim,
          cursor: valid && !saving ? 'pointer' : 'default',
          transition: 'all 0.2s',
          boxShadow: valid && !saving ? 'rgba(43,108,176,0.40) 0 6px 24px' : 'none' }}>
        {saving ? 'Tworzenie…' : 'Utwórz Klub'}
      </motion.button>
    </div>
  )
}

// ── CLUB PANEL ────────────────────────────────────────────────────────────────
function ClubPanel({ club, onUpdate, currentUserId }) {
  const [invite,     setInvite]     = useState(null)
  const [removing,   setRemoving]   = useState(false)
  const [swapMode,   setSwapMode]   = useState(false)
  const [swapSource, setSwapSource] = useState(null)
  const [copiedClub, setCopiedClub] = useState(false)
  const [swapping,   setSwapping]   = useState(false)

  const isOwner     = club.ownerId === currentUserId
  const memberCount = Object.values(club.members).filter(Boolean).length

  async function handleSlotPress(position) {
    if (swapMode && isOwner) {
      if (!swapSource) {
        setSwapSource(position.key)
      } else {
        if (swapSource !== position.key) {
          setSwapping(true)
          try {
            await apiSwapPositions(club.id, swapSource, position.key)
            // Reload updated club from DB
            const updated = await apiFetchClub(currentUserId)
            if (updated) onUpdate(updated)
          } catch (e) {
            console.error('swap failed', e)
          } finally {
            setSwapping(false)
          }
        }
        setSwapSource(null)
        setSwapMode(false)
      }
      return
    }
    setInvite({ position, member: club.members[position.key] })
  }

  async function handleRemoveMember(posKey) {
    setRemoving(true)
    try {
      await apiRemoveMember(club.id, posKey)
      onUpdate({
        ...club,
        members: { ...club.members, [posKey]: null },
      })
      setInvite(null)
    } catch (e) {
      console.error('remove failed', e)
    } finally {
      setRemoving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%',
      background: P.pageBg, overflowY: 'auto' }}>

      <AnimatePresence>
        {invite && (
          <InviteModal
            club={club}
            position={invite.position}
            member={invite.member}
            removing={removing}
            onClose={() => setInvite(null)}
            onRemove={() => handleRemoveMember(invite.position.key)}
          />
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div style={{ padding: '22px 16px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
          <DiamondBadge abbr={club.abbr} size={56}/>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20,
              textTransform: 'uppercase', color: P.textPri,
              letterSpacing: 0.4, lineHeight: 1.1, margin: 0,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {club.name}
            </h1>
            <p style={{ fontSize: 12, color: P.textMid, marginTop: 4,
              display: 'flex', alignItems: 'center', gap: 5 }}>
              <span>{club.country.flag}</span>
              <span>{club.country.name}</span>
              <span style={{ color: P.textDim }}>·</span>
              <span>{memberCount}/5 graczy</span>
            </p>
          </div>

          {isOwner && (
            <motion.button whileTap={{ scale: 0.90 }}
              onClick={() => {
                if (swapMode) { setSwapMode(false); setSwapSource(null) }
                else setSwapMode(true)
              }}
              style={{ display: 'flex', alignItems: 'center', gap: 5,
                padding: '7px 12px',
                background: swapMode ? 'rgba(99,226,255,0.12)' : 'rgba(91,168,216,0.10)',
                border: swapMode ? `1px solid ${P.swapRing}` : `1px solid ${P.cardBorder}`,
                borderRadius: 99,
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10,
                letterSpacing: 1.5, textTransform: 'uppercase',
                color: swapMode ? P.swapRing : P.accent,
                cursor: 'pointer', flexShrink: 0, transition: 'all 0.2s' }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
              </svg>
              {swapMode ? 'Anuluj' : 'Przesuń'}
            </motion.button>
          )}
        </div>

        <AnimatePresence>
          {swapMode && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden', marginBottom: 12 }}>
              <p style={{ fontSize: 11, color: swapping ? P.textMid : P.swapRing,
                fontWeight: 600, textAlign: 'center', padding: '8px 16px',
                background: 'rgba(99,226,255,0.07)',
                border: '1px solid rgba(99,226,255,0.20)', borderRadius: 10 }}>
                {swapping
                  ? 'Zapisywanie…'
                  : swapSource
                    ? `Wybierz pozycję docelową dla ${swapSource}`
                    : 'Kliknij gracza, którego chcesz przenieść'}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Court card ── */}
      <div style={{ padding: '0 16px', flex: 1 }}>
        <div style={{ borderRadius: 20, border: `1.5px solid ${P.cardBorder}`,
          boxShadow: '0 8px 40px rgba(0,0,0,0.60)', overflow: 'hidden',
          background: P.courtBg }}>
          <div style={{ padding: '9px 14px',
            borderBottom: `1px solid ${P.cardBorder}`,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            background: 'rgba(255,255,255,0.025)' }}>
            <span style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5,
              textTransform: 'uppercase', color: P.textDim }}>
              Skład drużyny
            </span>
            <span style={{ fontSize: 9, color: P.textDim, fontWeight: 600 }}>
              {memberCount}/5
            </span>
          </div>

          <div style={{ position: 'relative', height: 420, overflow: 'visible' }}>
            <CourtBackground/>
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
                  onPress={() => handleSlotPress(pos)}
                  swapMode={swapMode}
                  isSwapSource={swapSource === pos.key}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Share ── */}
      <div style={{ padding: '16px 16px 110px' }}>
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => {
          navigator.clipboard.writeText(`https://hoopconnect.pl/klub/${club.id}`)
          setCopiedClub(true)
          setTimeout(() => setCopiedClub(false), 2500)
        }} style={{ width: '100%', padding: '14px',
          background: copiedClub ? 'rgba(5,150,105,0.10)'
            : `linear-gradient(135deg, ${P.accent}, #1A6AB0)`,
          border: copiedClub ? '1px solid rgba(5,150,105,0.35)' : 'none',
          borderRadius: 14, fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 13, letterSpacing: 1.5, textTransform: 'uppercase',
          color: copiedClub ? '#34D399' : P.white, cursor: 'pointer',
          boxShadow: copiedClub ? 'none' : 'rgba(43,108,176,0.35) 0 5px 20px',
          transition: 'all 0.22s' }}>
          {copiedClub ? '✓ Link skopiowany!' : '🔗 Udostępnij klub'}
        </motion.button>
      </div>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function ClubPage() {
  const { profile, user } = useAuth()
  const [club, setClub]   = useState(null)
  const [loading, setLoading] = useState(true)

  const loadClub = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    const data = await apiFetchClub(profile.id)
    setClub(data)
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { loadClub() }, [loadClub])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
        height: '100%', background: P.pageBg }}>
        <div className="spinner"/>
      </div>
    )
  }

  return (
    <div className="page-content" style={{ padding: 0 }}>
      <AnimatePresence mode="wait">
        {!club ? (
          <motion.div key="create"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} style={{ minHeight: '100%' }}>
            <CreateClub
              profile={profile}
              onCreated={newClub => setClub(newClub)}
            />
          </motion.div>
        ) : (
          <motion.div key="panel"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            <ClubPanel
              club={club}
              onUpdate={setClub}
              currentUserId={user?.id}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
