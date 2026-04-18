import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// ── TOKENS: white page · charcoal court · baby-blue accents ──────────────────
const P = {
  // page
  pageBg:     '#F6F9FC',
  white:      '#FFFFFF',
  navy:       '#0F1E30',
  textMid:    '#4E6678',
  textDim:    '#9AB0C0',
  // court
  courtBg:    '#181E2C',
  courtLine:  'rgba(74,158,212,0.40)',
  courtPaint: 'rgba(74,158,212,0.13)',
  // accent
  accent:     '#4A9ED4',
  accentDeep: '#1A6AB0',
  accentGlow: 'rgba(74,158,212,0.18)',
  swapRing:   '#63E2FF',
  // misc
  border:     'rgba(74,158,212,0.20)',
  hoop:       '#D9801A',
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

// Guards near halfcourt (top), bigs near basket (bottom)
const COURT_POS = {
  PG: { x: '26%', y: '12%' },
  SG: { x: '74%', y: '12%' },
  SF: { x: '16%', y: '43%' },
  C:  { x: '50%', y: '73%' },
  PF: { x: '84%', y: '43%' },
}

const SLOT = 88   // all positions equal size

// ── SUPABASE LAYER ────────────────────────────────────────────────────────────
function dbToUi(club) {
  const members = { PG: null, SG: null, SF: null, C: null, PF: null }
  for (const m of club.club_members ?? []) {
    if (m.user_id && m.profiles) {
      const name = m.profiles.name ?? '?'
      members[m.position] = {
        id: m.user_id, name,
        initial: name.trim()[0]?.toUpperCase() ?? '?',
        isOwner: m.user_id === club.owner_id,
      }
    }
  }
  return {
    id: club.id, name: club.name, abbr: club.abbr,
    country: { code: club.country_code, name: club.country_name, flag: club.country_flag },
    ownerId: club.owner_id, members,
  }
}

async function apiFetchClub(userId) {
  const { data: membership } = await supabase
    .from('club_members').select('club_id').eq('user_id', userId).maybeSingle()
  if (!membership) return null
  const { data: club } = await supabase
    .from('clubs')
    .select('id,name,abbr,country_code,country_name,country_flag,owner_id,club_members(position,user_id,profiles(name))')
    .eq('id', membership.club_id).single()
  return club ? dbToUi(club) : null
}

async function apiCreateClub({ name, abbr, country, profile }) {
  const { data: club, error } = await supabase
    .from('clubs')
    .insert({ name, abbr: abbr.toUpperCase(),
      country_code: country.code, country_name: country.name, country_flag: country.flag,
      owner_id: profile.id })
    .select().single()
  if (error) throw error
  await supabase.from('club_members')
    .insert({ club_id: club.id, user_id: profile.id, position: 'PG' })
  return dbToUi({ ...club,
    club_members: [{ position: 'PG', user_id: profile.id, profiles: { name: profile.name } }] })
}

async function apiRemoveMember(clubId, position) {
  const { error } = await supabase.from('club_members')
    .delete().eq('club_id', clubId).eq('position', position)
  if (error) throw error
}

// Swap: delete both slots, reinsert with swapped positions — no RPC needed
async function apiSwapPositions(clubId, posA, posB, idA, idB) {
  const toDelete = [posA, posB].filter((_, i) => [idA, idB][i])
  await Promise.all(toDelete.map((pos) =>
    supabase.from('club_members').delete().eq('club_id', clubId).eq('position', pos)
  ))
  const inserts = []
  if (idA) inserts.push({ club_id: clubId, user_id: idA, position: posB })
  if (idB) inserts.push({ club_id: clubId, user_id: idB, position: posA })
  if (inserts.length) {
    const { error } = await supabase.from('club_members').insert(inserts)
    if (error) throw error
  }
}

// ── COURT SVG ─────────────────────────────────────────────────────────────────
// Half-court: double line at the very top = halfcourt boundary
// Basket at the bottom. All lines in baby blue.
function CourtSVG() {
  const L = P.courtLine
  return (
    <svg viewBox="0 0 360 390" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        <radialGradient id="hoopGlow" cx="50%" cy="100%" r="45%">
          <stop offset="0%"   stopColor="rgba(217,128,26,0.16)"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        <radialGradient id="topFade" cx="50%" cy="0%" r="55%">
          <stop offset="0%"   stopColor="rgba(74,158,212,0.07)"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        <clipPath id="courtClip"><rect width="360" height="390" rx="0"/></clipPath>
      </defs>
      <g clipPath="url(#courtClip)">
        {/* Floor */}
        <rect width="360" height="390" fill={P.courtBg}/>
        <rect width="360" height="390" fill="url(#hoopGlow)"/>
        <rect width="360" height="390" fill="url(#topFade)"/>

        {/* Subtle planks */}
        {[...Array(27)].map((_, i) => (
          <line key={i} x1="0" y1={i*15} x2="360" y2={i*15}
            stroke="rgba(255,255,255,0.012)" strokeWidth="1"/>
        ))}

        {/* Sidelines (partial — only the visible court area) */}
        <line x1="12" y1="24" x2="12"  y2="378" stroke={L} strokeWidth="1.4"/>
        <line x1="348" y1="24" x2="348" y2="378" stroke={L} strokeWidth="1.4"/>
        {/* Baseline */}
        <line x1="12" y1="378" x2="348" y2="378" stroke={L} strokeWidth="1.5"/>

        {/* ── Double halfcourt line (top of card) ── */}
        <line x1="0" y1="14" x2="360" y2="14" stroke={L} strokeWidth="1.6"/>
        <line x1="0" y1="24" x2="360" y2="24" stroke={L} strokeWidth="1.6"/>
        {/* Center jump-circle arc (lower half only, sits between the two lines) */}
        <path d="M 144 19 A 36 36 0 0 0 216 19"
          fill="none" stroke="rgba(74,158,212,0.35)" strokeWidth="1.3"/>

        {/* ── 3-point arc ── */}
        <line x1="14" y1="270" x2="14" y2="378" stroke={L} strokeWidth="1.4"/>
        <line x1="346" y1="270" x2="346" y2="378" stroke={L} strokeWidth="1.4"/>
        <path d="M 14 270 A 210 210 0 0 1 346 270"
          fill="none" stroke={L} strokeWidth="1.4"/>

        {/* ── Key / Paint ── */}
        <rect x="130" y="258" width="100" height="120" fill={P.courtPaint}/>
        <line x1="130" y1="258" x2="130" y2="378" stroke={L} strokeWidth="1.4"/>
        <line x1="230" y1="258" x2="230" y2="378" stroke={L} strokeWidth="1.4"/>
        <line x1="130" y1="258" x2="230" y2="258" stroke={L} strokeWidth="1.4"/>
        {/* FT circle inside */}
        <path d="M 130 258 A 50 50 0 0 1 230 258"
          fill="none" stroke={L} strokeWidth="1.4"/>
        {/* FT circle outside (dashed) */}
        <path d="M 130 258 A 50 50 0 0 0 230 258"
          fill="none" stroke="rgba(74,158,212,0.18)" strokeWidth="1.3" strokeDasharray="5 3"/>
        {/* Hash marks */}
        {[[118,292],[118,323],[230,292],[230,323]].map(([x,y]) => (
          <line key={`h${x}${y}`}
            x1={x < 130 ? x : x} y1={y}
            x2={x < 130 ? 130 : 242} y2={y}
            stroke="rgba(74,158,212,0.28)" strokeWidth="1.2"/>
        ))}

        {/* ── Basket area ── */}
        <path d="M 155 378 A 25 25 0 0 0 205 378"
          fill="none" stroke="rgba(74,158,212,0.25)" strokeWidth="1.3"/>
        {/* Backboard */}
        <line x1="158" y1="360" x2="202" y2="360"
          stroke={P.hoop} strokeWidth="3" strokeLinecap="round"/>
        {/* Hoop */}
        <circle cx="180" cy="369" r="13"
          fill="none" stroke={P.hoop} strokeWidth="2.2"/>
        <circle cx="180" cy="369" r="5" fill="rgba(217,128,26,0.20)"/>
      </g>
    </svg>
  )
}

// ── DIAMOND BADGE ─────────────────────────────────────────────────────────────
function DiamondBadge({ abbr = '?', size = 70 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 90 90"
      style={{ flexShrink: 0, overflow: 'visible',
        filter: 'drop-shadow(0 4px 14px rgba(20,50,100,0.40))' }}>
      <defs>
        <linearGradient id="bdgG" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor="#72C4F8"/>
          <stop offset="45%"  stopColor="#2B72B8"/>
          <stop offset="100%" stopColor="#0C2E56"/>
        </linearGradient>
      </defs>
      <polygon points="45,9 84,33 84,61 45,87 6,61 6,33"  fill="rgba(0,0,0,0.22)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"  fill="url(#bdgG)"/>
      <polygon points="45,6 8,32 45,42"                   fill="rgba(255,255,255,0.28)"/>
      <polygon points="45,6 82,32 45,42"                  fill="rgba(255,255,255,0.12)"/>
      <polygon points="8,32 8,58 45,48 45,42"             fill="rgba(28,100,200,0.60)"/>
      <polygon points="82,32 82,58 45,48 45,42"           fill="rgba(10,50,130,0.75)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
        fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinejoin="round"/>
      <text x="45" y="50" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={abbr.length > 2 ? '20' : '24'} fontWeight="900"
        fontFamily="var(--font-display), Montserrat, 'Arial Black', sans-serif" letterSpacing="1">
        {abbr.toUpperCase()}
      </text>
    </svg>
  )
}

// ── PLAYER SLOT ───────────────────────────────────────────────────────────────
function PlayerSlot({ position, member, onPress, swapMode, isSource, isTarget }) {
  const highlight = isSource ? P.swapRing : isTarget ? 'rgba(99,226,255,0.55)' : null
  const glow = isSource
    ? `drop-shadow(0 0 12px ${P.swapRing})`
    : member
      ? 'drop-shadow(0 5px 14px rgba(0,0,0,0.60))'
      : 'drop-shadow(0 2px 8px rgba(0,0,0,0.35))'

  return (
    <motion.button whileTap={{ scale: 0.88 }} onClick={onPress}
      animate={isSource ? { scale: [1, 1.08, 1] } : { scale: 1 }}
      transition={{ repeat: isSource ? Infinity : 0, duration: 0.85 }}
      style={{ background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>

      <svg width={SLOT} height={SLOT} viewBox="0 0 90 90"
        style={{ overflow: 'visible', filter: glow }}>

        {/* Swap selection ring */}
        {(isSource || isTarget) && (
          <polygon points="45,1 89,28 89,62 45,89 1,62 1,28"
            fill="none" stroke={highlight} strokeWidth={isSource ? 2.2 : 1.5}
            strokeLinejoin="round" strokeDasharray={isSource ? '0' : '6 3'}/>
        )}

        {member ? (
          <>
            <defs>
              <linearGradient id={`mg_${position.key}`} x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%"   stopColor={isSource ? '#1A6090' : '#1A3860'}/>
                <stop offset="100%" stopColor={isSource ? '#0A3C68' : '#081828'}/>
              </linearGradient>
            </defs>
            <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,0.35)"/>
            <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
              fill={`url(#mg_${position.key})`}/>
            <polygon points="45,6 8,32 45,42" fill="rgba(255,255,255,0.18)"/>
            <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
              fill="none"
              stroke={highlight ?? 'rgba(74,158,212,0.65)'}
              strokeWidth="2.2" strokeLinejoin="round"/>
            <text x="45" y="50" textAnchor="middle" dominantBaseline="middle"
              fill="white" fontSize="29" fontWeight="800"
              fontFamily="var(--font-display), Montserrat, sans-serif">
              {member.initial}
            </text>
          </>
        ) : (
          <>
            <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
              fill={swapMode ? 'rgba(99,226,255,0.06)' : 'rgba(255,255,255,0.05)'}
              stroke={swapMode ? 'rgba(99,226,255,0.35)' : 'rgba(74,158,212,0.45)'}
              strokeWidth="1.8" strokeLinejoin="round" strokeDasharray="6 4"/>
            <line x1="45" y1="34" x2="45" y2="56"
              stroke={swapMode ? 'rgba(99,226,255,0.55)' : P.accent}
              strokeWidth="2.8" strokeLinecap="round"/>
            <line x1="34" y1="45" x2="56" y2="45"
              stroke={swapMode ? 'rgba(99,226,255,0.55)' : P.accent}
              strokeWidth="2.8" strokeLinecap="round"/>
          </>
        )}
      </svg>

      <div style={{ textAlign: 'center', marginTop: 1 }}>
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 1.8,
          textTransform: 'uppercase',
          color: isSource ? P.swapRing : 'rgba(74,158,212,0.90)',
          margin: 0 }}>
          {position.key}
        </p>
        {member
          ? <p style={{ fontSize: 10, fontWeight: 600, color: 'rgba(255,255,255,0.88)',
              margin: '1px 0 0', maxWidth: 78,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.name}
            </p>
          : <p style={{ fontSize: 9, color: 'rgba(255,255,255,0.28)', margin: '1px 0 0' }}>
              Zaproś
            </p>
        }
      </div>
    </motion.button>
  )
}

// ── INVITE / MEMBER MODAL ─────────────────────────────────────────────────────
function SlotModal({ club, position, member, onClose, onRemove, removing }) {
  const [copied, setCopied] = useState(false)
  const link = `https://hoopconnect.pl/dolacz/${club.id}?pos=${position.key}`

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{ position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(8,14,28,0.65)',
        backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 32px' }}>
      <motion.div
        initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 50, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, margin: '0 14px',
          background: P.white, borderRadius: 26,
          padding: '22px 22px 20px',
          boxShadow: '0 -2px 60px rgba(15,30,60,0.14), 0 0 0 1px rgba(74,158,212,0.15)' }}>

        <div style={{ width: 34, height: 3.5, background: '#E0EAF2',
          borderRadius: 2, margin: '0 auto 18px' }}/>

        <p style={{ fontSize: 10, letterSpacing: 2, color: P.accent,
          textTransform: 'uppercase', fontWeight: 800, marginBottom: 6 }}>
          {position.key} · {position.label}
        </p>

        {member ? (
          <>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24,
              color: P.navy, marginBottom: 20 }}>
              {member.name}
              {member.isOwner && (
                <span style={{ fontSize: 10, color: P.accent, fontWeight: 700,
                  marginLeft: 10, letterSpacing: 1.5 }}>KAPITAN</span>
              )}
            </p>
            {!member.isOwner && (
              <button onClick={onRemove} disabled={removing}
                style={{ width: '100%', padding: '13px',
                  background: 'rgba(220,38,38,0.06)',
                  border: '1px solid rgba(220,38,38,0.22)',
                  borderRadius: 12, color: removing ? '#C0AABB' : '#E05555',
                  fontFamily: 'var(--font-display)', fontWeight: 700,
                  fontSize: 14, letterSpacing: 1, cursor: removing ? 'default' : 'pointer' }}>
                {removing ? 'Usuwanie…' : 'Usuń z klubu'}
              </button>
            )}
          </>
        ) : (
          <>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22,
              color: P.navy, marginBottom: 16 }}>Zaproś zawodnika</p>
            <div style={{ padding: '10px 12px', background: '#F2F8FD',
              border: '1px solid #D4E8F5', borderRadius: 10,
              marginBottom: 12, fontFamily: 'monospace', fontSize: 11,
              color: P.textMid, wordBreak: 'break-all' }}>{link}</div>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => navigator.clipboard.writeText(link).then(() => {
                setCopied(true); setTimeout(() => setCopied(false), 2500)
              })}
              style={{ width: '100%', padding: '14px',
                background: copied ? 'rgba(5,150,105,0.08)'
                  : `linear-gradient(135deg, ${P.accent}, ${P.accentDeep})`,
                border: copied ? '1px solid rgba(5,150,105,0.30)' : 'none',
                borderRadius: 12, fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: 14, letterSpacing: 1,
                color: copied ? '#059669' : P.white,
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: copied ? 'none' : '0 4px 18px rgba(26,106,176,0.30)' }}>
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
      style={{ position: 'fixed', inset: 0, zIndex: 600,
        background: 'rgba(8,14,28,0.60)',
        backdropFilter: 'blur(22px)', WebkitBackdropFilter: 'blur(22px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 24px' }}>
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{ width: '100%', maxWidth: 420, margin: '0 12px',
          background: P.white, borderRadius: 24,
          maxHeight: '60vh', overflowY: 'auto',
          padding: '18px 0 16px', WebkitOverflowScrolling: 'touch',
          boxShadow: '0 -2px 50px rgba(15,30,60,0.12)' }}>
        <p style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
          color: P.accent, fontWeight: 800, margin: '0 20px 14px', textAlign: 'center' }}>
          Wybierz kraj
        </p>
        {COUNTRIES.map(c => (
          <button key={c.code} onClick={() => { onChange(c); onClose() }}
            style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 20px',
              background: value?.code === c.code ? '#EEF7FF' : 'transparent',
              border: 'none', cursor: 'pointer',
              borderLeft: value?.code === c.code
                ? `3px solid ${P.accent}` : '3px solid transparent' }}>
            <span style={{ fontSize: 22 }}>{c.flag}</span>
            <span style={{ fontSize: 14, fontWeight: 600,
              color: value?.code === c.code ? P.accent : P.textMid }}>{c.name}</span>
            {value?.code === c.code && (
              <span style={{ marginLeft: 'auto', color: P.accent, fontWeight: 700 }}>✓</span>
            )}
          </button>
        ))}
      </motion.div>
    </motion.div>
  )
}

// ── CREATE CLUB ───────────────────────────────────────────────────────────────
function CreateClub({ onCreated, profile }) {
  const [name, setName]       = useState('')
  const [abbr, setAbbr]       = useState('')
  const [country, setCountry] = useState(COUNTRIES[0])
  const [picker, setPicker]   = useState(false)
  const [saving, setSaving]   = useState(false)
  const [err, setErr]         = useState(null)

  const preview = abbr.trim().toUpperCase().slice(0, 3) || '?'
  const valid   = name.trim().length >= 3 && abbr.trim().length >= 2

  async function handleCreate() {
    if (!valid || saving) return
    setSaving(true); setErr(null)
    try {
      const club = await apiCreateClub({ name: name.trim(), abbr, country, profile })
      onCreated(club)
    } catch {
      setErr('Nie udało się. Spróbuj ponownie.')
      setSaving(false)
    }
  }

  return (
    <div style={{ minHeight: '100%', display: 'flex', flexDirection: 'column',
      padding: '44px 20px 40px', background: P.pageBg }}>
      <AnimatePresence>
        {picker && <CountryPicker value={country} onChange={setCountry} onClose={() => setPicker(false)}/>}
      </AnimatePresence>

      <motion.div initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 260, damping: 18 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
        <DiamondBadge abbr={preview} size={90}/>
        <p style={{ fontSize: 9, letterSpacing: 3, color: P.accent, textTransform: 'uppercase',
          fontWeight: 700, marginTop: 12 }}>Podgląd odznaki</p>
      </motion.div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 34,
        color: P.navy, textTransform: 'uppercase', letterSpacing: 0.4,
        lineHeight: 1.1, marginBottom: 6 }}>
        Załóż<br/>Klub
      </h1>
      <p style={{ color: P.textMid, fontSize: 13, marginBottom: 28, lineHeight: 1.55 }}>
        Stwórz drużynę, zaproś znajomych i rywalizujcie razem.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        {[
          { label: 'Nazwa klubu', ph: 'np. Hoopconnect Warsaw', val: name,
            set: e => setName(e.target.value), max: 30, sx: {} },
          { label: 'Skrót (2–3 litery)', ph: 'HCW', val: abbr,
            set: e => setAbbr(e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3)),
            max: 3, sx: { fontSize: 22, fontWeight: 800, letterSpacing: 5,
              fontFamily: 'var(--font-display)' } },
        ].map(f => (
          <div key={f.label}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2,
              textTransform: 'uppercase', color: P.textDim, marginBottom: 6 }}>{f.label}</p>
            <input placeholder={f.ph} value={f.val} onChange={f.set} maxLength={f.max}
              style={{ width: '100%', padding: '13px 14px', fontSize: 15,
                background: P.white, border: `1.5px solid #D4E6F4`,
                borderRadius: 12, color: P.navy, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box', ...f.sx }}/>
          </div>
        ))}
        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', color: P.textDim, marginBottom: 6 }}>Kraj</p>
          <button onClick={() => setPicker(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '13px 14px', background: P.white,
            border: '1.5px solid #D4E6F4', borderRadius: 12,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>
            <span style={{ fontSize: 22 }}>{country.flag}</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: P.navy }}>{country.name}</span>
            <svg style={{ marginLeft: 'auto' }} width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke={P.textDim} strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {err && <p style={{ color: '#E05555', fontSize: 12, marginTop: 12, textAlign: 'center' }}>{err}</p>}

      <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate}
        disabled={!valid || saving}
        style={{ marginTop: 24, width: '100%', padding: '16px',
          background: valid && !saving
            ? `linear-gradient(135deg, ${P.accent}, ${P.accentDeep})` : '#E8EFF5',
          border: 'none', borderRadius: 14,
          fontFamily: 'var(--font-display)', fontWeight: 800,
          fontSize: 15, letterSpacing: 2, textTransform: 'uppercase',
          color: valid && !saving ? P.white : P.textDim,
          cursor: valid && !saving ? 'pointer' : 'default',
          boxShadow: valid && !saving ? '0 6px 24px rgba(26,106,176,0.35)' : 'none',
          transition: 'all 0.2s' }}>
        {saving ? 'Tworzenie…' : 'Utwórz Klub'}
      </motion.button>
    </div>
  )
}

// ── CLUB PANEL ────────────────────────────────────────────────────────────────
function ClubPanel({ club, onUpdate, currentUserId }) {
  const [modal,      setModal]      = useState(null)   // { position, member }
  const [removing,   setRemoving]   = useState(false)
  const [swapMode,   setSwapMode]   = useState(false)
  const [swapSrc,    setSwapSrc]    = useState(null)
  const [swapping,   setSwapping]   = useState(false)
  const [copied,     setCopied]     = useState(false)

  const isOwner     = club.ownerId === currentUserId
  const memberCount = Object.values(club.members).filter(Boolean).length

  async function handleSlot(pos) {
    // ── Swap mode ──
    if (swapMode && isOwner) {
      if (!swapSrc) {
        setSwapSrc(pos.key)
        return
      }
      if (swapSrc === pos.key) { setSwapSrc(null); return }

      setSwapping(true)
      try {
        const mA = club.members[swapSrc]
        const mB = club.members[pos.key]
        await apiSwapPositions(club.id, swapSrc, pos.key, mA?.id ?? null, mB?.id ?? null)
        const updated = await apiFetchClub(currentUserId)
        if (updated) onUpdate(updated)
      } catch (e) { console.error('swap error', e) }
      finally {
        setSwapping(false)
        setSwapSrc(null)
        setSwapMode(false)
      }
      return
    }
    // ── Normal: open modal ──
    setModal({ position: pos, member: club.members[pos.key] })
  }

  async function handleRemove(posKey) {
    setRemoving(true)
    try {
      await apiRemoveMember(club.id, posKey)
      onUpdate({ ...club, members: { ...club.members, [posKey]: null } })
      setModal(null)
    } catch (e) { console.error('remove error', e) }
    finally { setRemoving(false) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%',
      background: P.pageBg, overflowY: 'auto' }}>

      <AnimatePresence>
        {modal && (
          <SlotModal club={club} position={modal.position} member={modal.member}
            removing={removing}
            onClose={() => setModal(null)}
            onRemove={() => handleRemove(modal.position.key)}/>
        )}
      </AnimatePresence>

      {/* ── Header ── */}
      <div style={{ padding: '28px 20px 20px',
        display: 'flex', alignItems: 'flex-start', gap: 16 }}>
        <DiamondBadge abbr={club.abbr} size={62}/>

        <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
          <p style={{ fontSize: 10, color: P.accent, fontWeight: 800,
            letterSpacing: 2, textTransform: 'uppercase', marginBottom: 3 }}>
            {club.country.flag} {club.country.name}
          </p>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 22, textTransform: 'uppercase', color: P.navy,
            letterSpacing: 0.3, lineHeight: 1.1, margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {club.name}
          </h1>
          <p style={{ fontSize: 11.5, color: P.textMid, marginTop: 4 }}>
            {memberCount} z 5 zawodników
          </p>
        </div>

        {/* Owner swap button */}
        {isOwner && (
          <motion.button whileTap={{ scale: 0.88 }}
            onClick={() => { setSwapMode(v => !v); setSwapSrc(null) }}
            style={{ display: 'flex', alignItems: 'center', gap: 5,
              padding: '8px 13px', borderRadius: 99,
              background: swapMode ? 'rgba(99,226,255,0.12)' : 'rgba(74,158,212,0.09)',
              border: swapMode
                ? `1.5px solid ${P.swapRing}`
                : `1.5px solid rgba(74,158,212,0.28)`,
              color: swapMode ? P.swapRing : P.accent,
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
              cursor: 'pointer', flexShrink: 0, marginTop: 4,
              transition: 'all 0.2s' }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
            </svg>
            {swapMode ? 'Anuluj' : 'Przesuń'}
          </motion.button>
        )}
      </div>

      {/* Swap hint */}
      <AnimatePresence>
        {swapMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', padding: '0 20px 14px' }}>
            <p style={{ fontSize: 11.5, fontWeight: 600, textAlign: 'center',
              padding: '9px 16px', borderRadius: 10,
              color: swapping ? P.textMid : P.swapRing,
              background: swapping ? '#F0F4F8' : 'rgba(99,226,255,0.07)',
              border: `1px solid ${swapping ? '#D8E4EE' : 'rgba(99,226,255,0.22)'}` }}>
              {swapping
                ? '⏳ Zapisywanie…'
                : swapSrc
                  ? `Wybierz pozycję docelową dla ${swapSrc}`
                  : 'Kliknij gracza, którego chcesz przenieść'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thin accent divider */}
      <div style={{ height: 1.5, margin: '0 20px 16px',
        background: `linear-gradient(90deg, transparent, ${P.accent}, transparent)`,
        opacity: 0.35 }}/>

      {/* ── Court card ── */}
      <div style={{ padding: '0 16px', flex: 1 }}>
        <div style={{
          position: 'relative',
          borderRadius: 22,
          overflow: 'hidden',
          // Outer glow
          boxShadow:
            `0 0 0 1.5px rgba(74,158,212,0.30),
             0 12px 50px rgba(15,30,60,0.14),
             0 2px 8px rgba(15,30,60,0.08)`,
        }}>
          {/* Top accent bar — baby blue gradient */}
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, zIndex: 10,
            background: `linear-gradient(90deg, transparent 0%, ${P.accent} 30%, ${P.swapRing} 60%, ${P.accent} 80%, transparent 100%)` }}/>

          {/* Court + players */}
          <div style={{ position: 'relative', height: 390 }}>
            <CourtSVG/>
            {POSITIONS.map(pos => (
              <div key={pos.key} style={{
                position: 'absolute',
                left: COURT_POS[pos.key].x, top: COURT_POS[pos.key].y,
                transform: 'translate(-50%, -50%)', zIndex: 3,
              }}>
                <PlayerSlot
                  position={pos}
                  member={club.members[pos.key]}
                  onPress={() => handleSlot(pos)}
                  swapMode={swapMode}
                  isSource={swapSrc === pos.key}
                  isTarget={swapMode && swapSrc && swapSrc !== pos.key}
                />
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Share button ── */}
      <div style={{ padding: '18px 16px 110px' }}>
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => {
            navigator.clipboard.writeText(`https://hoopconnect.pl/klub/${club.id}`)
            setCopied(true); setTimeout(() => setCopied(false), 2500)
          }}
          style={{ width: '100%', padding: '14px',
            background: copied
              ? 'rgba(5,150,105,0.08)'
              : `linear-gradient(135deg, ${P.accent}, ${P.accentDeep})`,
            border: copied ? '1.5px solid rgba(5,150,105,0.35)' : 'none',
            borderRadius: 14, fontFamily: 'var(--font-display)', fontWeight: 800,
            fontSize: 13, letterSpacing: 1.8, textTransform: 'uppercase',
            color: copied ? '#059669' : P.white, cursor: 'pointer',
            boxShadow: copied ? 'none' : '0 5px 22px rgba(26,106,176,0.30)',
            transition: 'all 0.22s' }}>
          {copied ? '✓ Link skopiowany!' : '🔗 Udostępnij klub'}
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

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    setClub(await apiFetchClub(profile.id))
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: P.pageBg }}>
      <div className="spinner"/>
    </div>
  )

  return (
    <div className="page-content" style={{ padding: 0 }}>
      <AnimatePresence mode="wait">
        {!club ? (
          <motion.div key="create"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }} style={{ minHeight: '100%' }}>
            <CreateClub profile={profile} onCreated={setClub}/>
          </motion.div>
        ) : (
          <motion.div key="panel"
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            style={{ minHeight: '100%', display: 'flex', flexDirection: 'column' }}>
            <ClubPanel club={club} onUpdate={setClub} currentUserId={user?.id}/>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
