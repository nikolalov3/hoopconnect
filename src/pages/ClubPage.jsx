import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
//  DESIGN TOKENS — dark neon sports theme
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg:       '#04080F',
  surface:  '#08111E',
  line:     'rgba(0,210,255,0.36)',
  paint:    'rgba(0,110,255,0.11)',
  accent:   '#00CCFF',
  accentHi: '#55EEFF',
  accentLo: '#0088CC',
  text:     '#E0EEFF',
  sub:      '#2A5070',
  dim:      '#172840',
  hoop:     '#FFA820',
  swap:     '#00DDFF',
  win:      '#00E890',
  loss:     '#FF5060',
}

// Per-position identity colors
const POS = {
  PG: { hi: '#4A80FF', lo: '#0A2070', glow: 'rgba(74,128,255,0.55)',  label: 'Rozgrywający'   },
  SG: { hi: '#00C880', lo: '#003828', glow: 'rgba(0,200,128,0.55)',   label: 'Rzucający'      },
  SF: { hi: '#FF8830', lo: '#501C04', glow: 'rgba(255,136,48,0.55)',  label: 'Skrzydłowy'     },
  C:  { hi: '#9050FF', lo: '#200850', glow: 'rgba(144,80,255,0.55)',  label: 'Środkowy'       },
  PF: { hi: '#FF4070', lo: '#500820', glow: 'rgba(255,64,112,0.55)',  label: 'Silny skrzydł.' },
}
const POSITIONS = Object.keys(POS)

// Court token positions (% of 343×410 court card)
const SPOT = {
  PG: { x: '22%', y: '12%' },
  SG: { x: '78%', y: '12%' },
  SF: { x: '17%', y: '47%' },
  C:  { x: '50%', y: '71%' },
  PF: { x: '83%', y: '47%' },
}

// Concave-corner path for 343×410, r=24
const COURT_PATH = 'M24,0 L319,0 Q319,24 343,24 L343,386 Q319,386 319,410 L24,410 Q24,386 0,386 L0,24 Q24,24 24,0 Z'

const COUNTRIES = [
  { code: 'PL', name: 'Polska',          flag: '🇵🇱' },
  { code: 'US', name: 'USA',             flag: '🇺🇸' },
  { code: 'DE', name: 'Niemcy',          flag: '🇩🇪' },
  { code: 'FR', name: 'Francja',         flag: '🇫🇷' },
  { code: 'ES', name: 'Hiszpania',       flag: '🇪🇸' },
  { code: 'IT', name: 'Włochy',          flag: '🇮🇹' },
  { code: 'GB', name: 'Wielka Brytania', flag: '🇬🇧' },
  { code: 'PT', name: 'Portugalia',      flag: '🇵🇹' },
  { code: 'BR', name: 'Brazylia',        flag: '🇧🇷' },
  { code: 'NG', name: 'Nigeria',         flag: '🇳🇬' },
  { code: 'LT', name: 'Litwa',           flag: '🇱🇹' },
  { code: 'RS', name: 'Serbia',          flag: '🇷🇸' },
  { code: 'HR', name: 'Chorwacja',       flag: '🇭🇷' },
  { code: 'GR', name: 'Grecja',          flag: '🇬🇷' },
  { code: 'AU', name: 'Australia',       flag: '🇦🇺' },
  { code: 'CA', name: 'Kanada',          flag: '🇨🇦' },
]

// ── DB LAYER ──────────────────────────────────────────────────────────────────
function dbToUi(club) {
  const m = { PG: null, SG: null, SF: null, C: null, PF: null }
  for (const r of club.club_members ?? []) {
    if (r.user_id && r.profiles) {
      const n = r.profiles.name ?? '?'
      m[r.position] = {
        id: r.user_id, name: n,
        initial: n.trim()[0]?.toUpperCase() ?? '?',
        isOwner: r.user_id === club.owner_id,
        joinedAt: r.joined_at,
      }
    }
  }
  return {
    id: club.id, name: club.name, abbr: club.abbr,
    country: { code: club.country_code, name: club.country_name, flag: club.country_flag },
    ownerId: club.owner_id, members: m,
  }
}

async function apiFetch(uid) {
  // 1. Find which club the user belongs to
  const { data: ms } = await supabase.from('club_members')
    .select('club_id').eq('user_id', uid).maybeSingle()
  if (!ms) return null

  const clubId = ms.club_id

  // 2. Fetch club row + all members (no nested profiles — avoids FK requirement)
  const [{ data: club }, { data: members }] = await Promise.all([
    supabase.from('clubs')
      .select('id,name,abbr,country_code,country_name,country_flag,owner_id')
      .eq('id', clubId).single(),
    supabase.from('club_members')
      .select('position,user_id,joined_at')
      .eq('club_id', clubId),
  ])
  if (!club) return null

  // 3. Fetch profiles for all member user_ids in one query
  const userIds = (members ?? []).map(m => m.user_id).filter(Boolean)
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id,name').in('id', userIds)
    : { data: [] }

  const profileMap = {}
  for (const p of profiles ?? []) profileMap[p.id] = p

  // 4. Stitch together in the shape dbToUi expects
  const full = {
    ...club,
    club_members: (members ?? []).map(m => ({
      ...m,
      profiles: profileMap[m.user_id] ?? { name: '?' },
    })),
  }
  return dbToUi(full)
}

async function apiCreate({ name, abbr, country, profile }) {
  const { data: club, error } = await supabase.from('clubs')
    .insert({ name, abbr: abbr.toUpperCase(),
      country_code: country.code, country_name: country.name, country_flag: country.flag,
      owner_id: profile.id }).select().single()
  if (error) throw error

  const { error: memErr } = await supabase.from('club_members')
    .insert({ club_id: club.id, user_id: profile.id, position: 'PG' })
  if (memErr) throw memErr

  // Re-fetch real state; if that somehow fails, fall back to local construction
  const ui = await apiFetch(profile.id)
  return ui ?? dbToUi({
    ...club,
    club_members: [{ position: 'PG', user_id: profile.id,
      joined_at: new Date().toISOString(), profiles: { name: profile.name } }],
  })
}

async function apiRemove(clubId, pos) {
  const { error } = await supabase.from('club_members')
    .delete().eq('club_id', clubId).eq('position', pos)
  if (error) throw error
}

async function apiSwap(clubId, pA, pB) {
  // Diagnostic: read what's actually stored before calling RPC
  const { data: rows, error: selErr } = await supabase
    .from('club_members')
    .select('position, user_id, club_id')
    .eq('club_id', clubId)

  if (selErr) throw new Error(`SELECT failed: ${selErr.message}`)
  if (!rows || rows.length === 0) {
    throw new Error(`club_members pusty dla club_id=${clubId}`)
  }
  const found = rows.find(r => r.position === pA)
  if (!found) {
    const positions = rows.map(r => r.position).join(', ')
    throw new Error(`Brak pozycji "${pA}" w DB — dostępne: [${positions}]`)
  }

  const { error } = await supabase.rpc('move_member', {
    p_club_id:  clubId,
    p_from_pos: pA,
    p_to_pos:   pB,
  })
  if (error) throw error
}

async function apiLeave(clubId, userId) {
  const { error } = await supabase.from('club_members')
    .delete().eq('club_id', clubId).eq('user_id', userId)
  if (error) throw error
}

async function apiDisband(clubId) {
  const { error } = await supabase.from('clubs').delete().eq('id', clubId)
  if (error) throw error
}

async function apiUpdateClub(clubId, { name, abbr, country }) {
  const { error } = await supabase.from('clubs').update({
    name, abbr: abbr.toUpperCase(),
    country_code: country.code, country_name: country.name, country_flag: country.flag,
  }).eq('id', clubId)
  if (error) throw error
}

// ── COURT SVG ─────────────────────────────────────────────────────────────────
function Court() {
  return (
    <svg viewBox="0 0 343 410" style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        <linearGradient id="floorG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#13203A"/>
          <stop offset="55%"  stopColor="#0C1824"/>
          <stop offset="100%" stopColor="#080F1A"/>
        </linearGradient>
        <radialGradient id="spotG" cx="50%" cy="2%" r="55%">
          <stop offset="0%"   stopColor="rgba(0,150,255,0.12)"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        <radialGradient id="hoopG" cx="50%" cy="108%" r="48%">
          <stop offset="0%"   stopColor="rgba(255,168,24,0.17)"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        <radialGradient id="paintG" cx="50%" cy="95%" r="32%">
          <stop offset="0%"   stopColor="rgba(0,100,255,0.10)"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
      </defs>

      {/* Floor */}
      <rect width="343" height="410" fill="url(#floorG)"/>
      <rect width="343" height="410" fill="url(#spotG)"/>
      <rect width="343" height="410" fill="url(#hoopG)"/>
      <rect width="343" height="410" fill="url(#paintG)"/>

      {/* Wood planks */}
      {Array.from({ length: 26 }, (_, i) => (
        <line key={i} x1="0" y1={i * 16 + 8} x2="343" y2={i * 16 + 8}
          stroke="rgba(255,255,255,0.011)" strokeWidth="1"/>
      ))}

      {/* ── Halfcourt flush to top ── */}
      <line x1="0" y1="1" x2="343" y2="1" stroke={C.line} strokeWidth="1.5"/>
      <path d="M 137 1 A 36 36 0 0 0 206 1" fill="none" stroke="rgba(0,210,255,0.20)" strokeWidth="1.3"/>

      {/* Court boundary */}
      <g stroke={C.line} strokeWidth="1.4" fill="none" strokeLinecap="round">
        <line x1="12" y1="1"   x2="12"  y2="398"/>
        <line x1="331" y1="1"  x2="331" y2="398"/>
        <line x1="12" y1="398" x2="331" y2="398"/>

        {/* 3pt */}
        <line x1="12"  y1="272" x2="12"  y2="398"/>
        <line x1="331" y1="272" x2="331" y2="398"/>
        <path d="M 12 272 A 204 204 0 0 1 331 272"/>

        {/* Paint */}
        <rect x="122" y="260" width="99" height="138" fill={C.paint}
          stroke="rgba(0,210,255,0.35)" strokeWidth="1.4"/>
        <path d="M 122 260 A 49 49 0 0 1 221 260"/>
        <path d="M 122 260 A 49 49 0 0 0 221 260"
          stroke="rgba(0,210,255,0.16)" strokeDasharray="5 3"/>

        {/* Hash marks */}
        <line x1="110" y1="295" x2="122" y2="295" stroke="rgba(0,210,255,0.20)" strokeWidth="1.2"/>
        <line x1="110" y1="327" x2="122" y2="327" stroke="rgba(0,210,255,0.20)" strokeWidth="1.2"/>
        <line x1="221" y1="295" x2="233" y2="295" stroke="rgba(0,210,255,0.20)" strokeWidth="1.2"/>
        <line x1="221" y1="327" x2="233" y2="327" stroke="rgba(0,210,255,0.20)" strokeWidth="1.2"/>

        {/* Restricted area */}
        <path d="M 146 398 A 25 25 0 0 0 197 398" stroke="rgba(0,210,255,0.18)"/>
      </g>

      {/* Hoop: ring above, backboard at baseline */}
      <circle cx="171.5" cy="377" r="13" fill="none" stroke={C.hoop} strokeWidth="2.5"/>
      <circle cx="171.5" cy="377" r="5.5" fill="rgba(255,168,32,0.14)"/>
      <line x1="171.5" y1="390" x2="171.5" y2="393" stroke={C.hoop} strokeWidth="1.5" opacity=".50"/>
      <rect x="150" y="393" width="43" height="4" rx="1.5" fill={C.hoop} opacity=".90"/>
    </svg>
  )
}

// ── DIAMOND BADGE ─────────────────────────────────────────────────────────────
function Badge({ abbr = '?', size = 64 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 90 90"
      style={{ flexShrink: 0, overflow: 'visible',
        filter: 'drop-shadow(0 8px 22px rgba(0,160,255,0.55))' }}>
      <defs>
        <linearGradient id="bdgG" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor="#66CCFF"/>
          <stop offset="45%"  stopColor="#1A78D0"/>
          <stop offset="100%" stopColor="#061640"/>
        </linearGradient>
      </defs>
      <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,.35)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill="url(#bdgG)"/>
      <polygon points="45,6 8,32 45,42"  fill="rgba(255,255,255,.30)"/>
      <polygon points="45,6 82,32 45,42" fill="rgba(255,255,255,.13)"/>
      <polygon points="8,32 8,58 45,48 45,42"  fill="rgba(0,80,200,.55)"/>
      <polygon points="82,32 82,58 45,48 45,42" fill="rgba(0,20,90,.70)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
        fill="none" stroke="rgba(255,255,255,.55)" strokeWidth="1.8" strokeLinejoin="round"/>
      <text x="45" y="51" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={abbr.length > 2 ? '20' : '23'} fontWeight="900"
        fontFamily="var(--font-display),Montserrat,sans-serif" letterSpacing="1">
        {abbr.toUpperCase()}
      </text>
    </svg>
  )
}

// ── PLAYER TOKEN ──────────────────────────────────────────────────────────────
const TK = 78  // token size px

function Token({ posKey, member, onPress, swapMode, isSrc, isTgt }) {
  const pos = POS[posKey]
  const hi  = isSrc ? C.swap : pos.hi
  const lo  = isSrc ? '#083858' : pos.lo

  return (
    <motion.button
      whileTap={{ scale: 0.86 }}
      onClick={onPress}
      animate={isSrc ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ repeat: isSrc ? Infinity : 0, duration: 0.85, ease: 'easeInOut' }}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ position: 'relative', width: TK, height: TK }}>
        {/* Glow bloom */}
        {member && (
          <div style={{
            position: 'absolute', top: '10%', left: '5%', width: '90%', height: '80%',
            borderRadius: '50%',
            background: `radial-gradient(ellipse, ${isSrc ? 'rgba(0,221,255,0.60)' : pos.glow} 0%, transparent 70%)`,
            filter: 'blur(12px)', pointerEvents: 'none',
          }}/>
        )}
        <svg width={TK} height={TK} viewBox="0 0 90 90"
          style={{
            overflow: 'visible', position: 'relative', zIndex: 1,
            filter: member
              ? `drop-shadow(0 5px 16px ${isSrc ? 'rgba(0,221,255,0.80)' : pos.glow.replace('0.55', '0.75')})`
              : 'none',
          }}>
          <defs>
            {member && (
              <linearGradient id={`tg_${posKey}`} x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%"   stopColor={hi} stopOpacity="0.80"/>
                <stop offset="100%" stopColor={lo}/>
              </linearGradient>
            )}
          </defs>

          {/* Swap rings */}
          {isTgt && (
            <polygon points="45,0 90,27 90,63 45,90 0,63 0,27"
              fill={`${C.swap}06`} stroke={`${C.swap}48`} strokeWidth="1.5"
              strokeLinejoin="round" strokeDasharray="7 4"/>
          )}
          {isSrc && (
            <polygon points="45,0 90,27 90,63 45,90 0,63 0,27"
              fill="none" stroke={C.swap} strokeWidth="2.2" strokeLinejoin="round"/>
          )}

          {member ? (
            <>
              <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,.42)"/>
              <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill={`url(#tg_${posKey})`}/>
              <polygon points="45,6 8,32 45,42"  fill="rgba(255,255,255,.22)"/>
              <polygon points="45,6 82,32 45,42" fill="rgba(255,255,255,.10)"/>
              <polygon points="8,32 8,58 45,48 45,42"  fill={`${hi}20`}/>
              <polygon points="82,32 82,58 45,48 45,42" fill="rgba(0,0,0,.35)"/>
              <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
                fill="none" stroke={isSrc ? C.swap : `${hi}CC`}
                strokeWidth="2.2" strokeLinejoin="round"/>
              <polygon points="45,3 86,30 86,60 45,87 4,60 4,30"
                fill="none" stroke={`${hi}18`} strokeWidth="1" strokeLinejoin="round"/>
              <text x="45" y="50" textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="31" fontWeight="900"
                fontFamily="var(--font-display),Montserrat,sans-serif">
                {member.initial}
              </text>
            </>
          ) : (
            <>
              <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
                fill={swapMode ? `${C.swap}06` : 'rgba(0,200,255,0.05)'}
                stroke={swapMode ? `${C.swap}38` : 'rgba(0,200,255,0.34)'}
                strokeWidth="1.8" strokeLinejoin="round"/>
              <line x1="45" y1="34" x2="45" y2="56"
                stroke={swapMode ? `${C.swap}50` : 'rgba(0,200,255,0.48)'}
                strokeWidth="2.4" strokeLinecap="round"/>
              <line x1="34" y1="45" x2="56" y2="45"
                stroke={swapMode ? `${C.swap}50` : 'rgba(0,200,255,0.48)'}
                strokeWidth="2.4" strokeLinecap="round"/>
            </>
          )}
        </svg>
      </div>

      {/* Labels */}
      <div style={{ textAlign: 'center', lineHeight: 1 }}>
        <p style={{
          fontSize: 8.5, fontWeight: 800, letterSpacing: 2.2,
          textTransform: 'uppercase', margin: 0,
          color: isSrc ? C.swap : member ? `${hi}EE` : 'rgba(0,180,220,0.55)',
        }}>
          {posKey}
        </p>
        {member
          ? <p style={{ fontSize: 9.5, fontWeight: 600, margin: '2px 0 0',
              color: 'rgba(200,228,255,0.85)', maxWidth: 76,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {member.name}
            </p>
          : <p style={{ fontSize: 8.5, margin: '2px 0 0',
              color: 'rgba(0,160,200,0.40)' }}>Zaproś</p>
        }
      </div>
    </motion.button>
  )
}

// ── BOTTOM SHEET BASE ─────────────────────────────────────────────────────────
// Rendered via portal → document.body so it escapes any Framer Motion
// stacking context (opacity animation creates isolated stacking context)
// and always sits above the bottom nav regardless of z-index.
function Sheet({ onClose, children }) {
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9000,
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        background: 'rgba(2,6,16,0.70)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      }}>
      <motion.div
        initial={{ y: 80, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 80, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, margin: '0 0',
          background: '#07101E',
          borderRadius: '24px 24px 0 0',
          border: '1px solid rgba(0,200,255,0.10)',
          borderBottom: 'none',
          padding: '20px 22px 40px',
          boxShadow: '0 -6px 60px rgba(0,0,0,0.60)',
        }}>
        {/* Drag pill */}
        <div style={{ width: 36, height: 4, background: '#1A3050',
          borderRadius: 2, margin: '0 auto 20px' }}/>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── EMPTY SLOT SHEET ──────────────────────────────────────────────────────────
function EmptySlotSheet({ club, posKey, onClose }) {
  const pos = POS[posKey]
  const [copied, setCopied] = useState(false)
  const link = `https://hoopconnect.pl/dolacz/${club.id}?pos=${posKey}`

  return (
    <Sheet onClose={onClose}>
      {/* Position badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '5px 14px', borderRadius: 99,
        background: `${pos.hi}18`, border: `1px solid ${pos.hi}40`, marginBottom: 16,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: pos.hi,
          boxShadow: `0 0 6px ${pos.glow}` }}/>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2,
          color: pos.hi, textTransform: 'uppercase' }}>{posKey}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.sub }}>{pos.label}</span>
      </div>

      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24,
        color: C.text, marginBottom: 14, letterSpacing: -0.3 }}>
        Zaproś zawodnika
      </p>
      <div style={{ padding: '11px 14px', background: '#0A1626',
        border: '1px solid rgba(0,200,255,0.14)', borderRadius: 12, marginBottom: 14,
        fontFamily: 'monospace', fontSize: 11, color: C.sub,
        wordBreak: 'break-all', lineHeight: 1.5 }}>
        {link}
      </div>
      <motion.button whileTap={{ scale: 0.97 }}
        onClick={() => navigator.clipboard.writeText(link)
          .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })}
        style={{
          width: '100%', padding: '15px', borderRadius: 14, border: 'none',
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, letterSpacing: 1,
          cursor: 'pointer', transition: 'all 0.2s',
          background: copied ? 'rgba(0,200,130,0.10)' : `linear-gradient(135deg, ${C.accent}, ${C.accentLo})`,
          border: copied ? '1.5px solid rgba(0,200,130,0.30)' : 'none',
          color: copied ? C.win : '#fff',
          boxShadow: copied ? 'none' : `0 6px 22px ${C.accentLo}60`,
        }}>
        {copied ? '✓ Skopiowano!' : '🔗 Kopiuj link zaproszenia'}
      </motion.button>
    </Sheet>
  )
}

// ── PLAYER PROFILE SHEET ──────────────────────────────────────────────────────
function PlayerSheet({ club, posKey, member, isOwner, isSelf, onClose, onRemove, onLeave, removing }) {
  const pos = POS[posKey]
  const joinedDate = member?.joinedAt
    ? new Date(member.joinedAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })
    : null

  return (
    <Sheet onClose={onClose}>
      {/* Position badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '5px 14px', borderRadius: 99,
        background: `${pos.hi}18`, border: `1px solid ${pos.hi}40`, marginBottom: 16,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: pos.hi,
          boxShadow: `0 0 6px ${pos.glow}` }}/>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2,
          color: pos.hi, textTransform: 'uppercase' }}>{posKey}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.sub }}>{pos.label}</span>
      </div>

      {/* Avatar + name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
        <svg width="64" height="64" viewBox="0 0 90 90"
          style={{ flexShrink: 0, overflow: 'visible',
            filter: `drop-shadow(0 6px 18px ${pos.glow.replace('0.55', '0.80')})` }}>
          <defs>
            <linearGradient id="sheetTg" x1="20%" y1="0%" x2="80%" y2="100%">
              <stop offset="0%"   stopColor={pos.hi} stopOpacity="0.80"/>
              <stop offset="100%" stopColor={pos.lo}/>
            </linearGradient>
          </defs>
          <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,.42)"/>
          <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill="url(#sheetTg)"/>
          <polygon points="45,6 8,32 45,42"  fill="rgba(255,255,255,.22)"/>
          <polygon points="45,6 82,32 45,42" fill="rgba(255,255,255,.10)"/>
          <polygon points="8,32 8,58 45,48 45,42"  fill={`${pos.hi}20`}/>
          <polygon points="82,32 82,58 45,48 45,42" fill="rgba(0,0,0,.35)"/>
          <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
            fill="none" stroke={`${pos.hi}CC`} strokeWidth="2.2" strokeLinejoin="round"/>
          <text x="45" y="50" textAnchor="middle" dominantBaseline="middle"
            fill="white" fontSize="31" fontWeight="900"
            fontFamily="var(--font-display),Montserrat,sans-serif">
            {member.initial}
          </text>
        </svg>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 22, color: C.text, letterSpacing: -0.3, lineHeight: 1.1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {member.name}
            {member.isOwner && (
              <span style={{ fontSize: 8, fontWeight: 700, color: C.accent,
                marginLeft: 9, letterSpacing: 1.5, verticalAlign: 'middle' }}>
                KAPITAN
              </span>
            )}
          </p>
          {joinedDate && (
            <p style={{ fontSize: 10, color: C.sub, marginTop: 4, fontWeight: 500 }}>
              W klubie od {joinedDate}
            </p>
          )}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {isSelf && (
          <>
            {member.isOwner ? (
              /* Owner: disband */
              <motion.button whileTap={{ scale: 0.96 }} onClick={onLeave} disabled={removing}
                style={{
                  width: '100%', padding: '14px',
                  background: removing ? `${C.dim}40` : 'rgba(255,60,80,0.08)',
                  border: `1.5px solid ${removing ? C.dim : 'rgba(255,60,80,0.28)'}`,
                  borderRadius: 14, color: removing ? C.sub : C.loss,
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 14, letterSpacing: 1, cursor: removing ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                }}>
                {removing ? 'Rozwiązywanie…' : '🗑 Rozwiąż klub'}
              </motion.button>
            ) : (
              /* Member: leave */
              <motion.button whileTap={{ scale: 0.96 }} onClick={onLeave} disabled={removing}
                style={{
                  width: '100%', padding: '14px',
                  background: removing ? `${C.dim}40` : 'rgba(255,60,80,0.08)',
                  border: `1.5px solid ${removing ? C.dim : 'rgba(255,60,80,0.28)'}`,
                  borderRadius: 14, color: removing ? C.sub : C.loss,
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 14, letterSpacing: 1, cursor: removing ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                }}>
                {removing ? 'Opuszczanie…' : '🚪 Opuść klub'}
              </motion.button>
            )}
          </>
        )}
        {!isSelf && isOwner && !member.isOwner && (
          <motion.button whileTap={{ scale: 0.96 }} onClick={onRemove} disabled={removing}
            style={{
              width: '100%', padding: '14px',
              background: removing ? `${C.dim}40` : 'rgba(255,60,80,0.08)',
              border: `1.5px solid ${removing ? C.dim : 'rgba(255,60,80,0.28)'}`,
              borderRadius: 14, color: removing ? C.sub : C.loss,
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 14, letterSpacing: 1, cursor: removing ? 'default' : 'pointer',
              transition: 'all 0.2s',
            }}>
            {removing ? 'Usuwanie…' : '✕ Usuń z klubu'}
          </motion.button>
        )}
      </div>
    </Sheet>
  )
}

// ── EDIT CLUB SHEET ───────────────────────────────────────────────────────────
function EditClubSheet({ club, onClose, onSaved }) {
  const [name,   setName]   = useState(club.name)
  const [abbr,   setAbbr]   = useState(club.abbr)
  const [ctry,   setCtry]   = useState(club.country)
  const [picker, setPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)

  const valid = name.trim().length >= 3 && abbr.trim().length >= 2

  async function save() {
    if (!valid || saving) return
    setSaving(true); setErr(null)
    try {
      await apiUpdateClub(club.id, { name: name.trim(), abbr, country: ctry })
      onSaved({ ...club, name: name.trim(), abbr: abbr.toUpperCase(), country: ctry })
    } catch { setErr('Nie udało się zapisać.'); setSaving(false) }
  }

  return (
    <>
      <AnimatePresence>
        {picker && <CountryPicker value={ctry} onChange={c => { setCtry(c); setPicker(false) }} onClose={() => setPicker(false)}/>}
      </AnimatePresence>
      <Sheet onClose={onClose}>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900,
          fontSize: 22, color: C.text, marginBottom: 18, letterSpacing: -0.3 }}>
          Edytuj klub
        </p>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {[
            { lbl: 'Nazwa klubu', val: name, set: e => setName(e.target.value), max: 30, sx: {} },
            { lbl: 'Skrót', val: abbr,
              set: e => setAbbr(e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3)),
              max: 3, sx: { fontSize: 20, fontWeight: 900, letterSpacing: 5, textAlign: 'center',
                fontFamily: 'var(--font-display)' } },
          ].map(f => (
            <div key={f.lbl}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2,
                textTransform: 'uppercase', color: C.sub, marginBottom: 6 }}>{f.lbl}</p>
              <input value={f.val} onChange={f.set} maxLength={f.max}
                style={{
                  width: '100%', padding: '13px 15px', fontSize: 14,
                  background: '#0A1626', border: '1.5px solid rgba(0,200,255,0.14)',
                  borderRadius: 13, color: C.text, outline: 'none',
                  fontFamily: 'inherit', boxSizing: 'border-box', ...f.sx,
                }}/>
            </div>
          ))}
          <div>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2,
              textTransform: 'uppercase', color: C.sub, marginBottom: 6 }}>Kraj</p>
            <button onClick={() => setPicker(true)} style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 10,
              padding: '13px 15px', background: '#0A1626',
              border: '1.5px solid rgba(0,200,255,0.14)', borderRadius: 13,
              cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            }}>
              <span style={{ fontSize: 20 }}>{ctry.flag}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.text }}>{ctry.name}</span>
              <svg style={{ marginLeft: 'auto' }} width="15" height="15" viewBox="0 0 24 24"
                fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round">
                <polyline points="6 9 12 15 18 9"/>
              </svg>
            </button>
          </div>
        </div>

        {err && <p style={{ color: C.loss, fontSize: 12, marginTop: 10, textAlign: 'center' }}>{err}</p>}

        <motion.button whileTap={{ scale: 0.97 }} onClick={save} disabled={!valid || saving}
          style={{
            marginTop: 16, width: '100%', padding: '15px', border: 'none', borderRadius: 14,
            background: valid && !saving
              ? `linear-gradient(135deg, ${C.accentHi}, ${C.accentLo})`
              : `${C.dim}60`,
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 14, letterSpacing: 2,
            textTransform: 'uppercase', color: valid && !saving ? '#fff' : C.sub,
            cursor: valid && !saving ? 'pointer' : 'default', transition: 'all 0.2s',
            boxShadow: valid && !saving ? `0 6px 22px ${C.accentLo}50` : 'none',
          }}>
          {saving ? 'Zapisywanie…' : 'Zapisz zmiany'}
        </motion.button>
      </Sheet>
    </>
  )
}

// ── COUNTRY PICKER ────────────────────────────────────────────────────────────
function CountryPicker({ value, onChange, onClose }) {
  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 9100,
        background: 'rgba(2,6,16,0.75)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
      }}>
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, margin: 0,
          background: '#07101E', borderRadius: '24px 24px 0 0',
          maxHeight: '60vh', overflowY: 'auto', padding: '18px 0 32px',
          border: '1px solid rgba(0,200,255,0.10)', borderBottom: 'none',
        }}>
        <p style={{ fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
          color: C.accent, fontWeight: 800, margin: '0 20px 14px', textAlign: 'center' }}>
          Wybierz kraj
        </p>
        {COUNTRIES.map(c => (
          <button key={c.code} onClick={() => onChange(c)}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 20px', background: 'transparent', border: 'none',
              cursor: 'pointer',
              borderLeft: value?.code === c.code
                ? `3px solid ${C.accent}` : '3px solid transparent',
              backgroundColor: value?.code === c.code ? `${C.accent}10` : 'transparent',
            }}>
            <span style={{ fontSize: 22 }}>{c.flag}</span>
            <span style={{ fontSize: 14, fontWeight: 600,
              color: value?.code === c.code ? C.accent : C.sub }}>{c.name}</span>
            {value?.code === c.code && (
              <span style={{ marginLeft: 'auto', color: C.accent, fontWeight: 800 }}>✓</span>
            )}
          </button>
        ))}
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── SHARED HEADER ─────────────────────────────────────────────────────────────
function ClubHeader({ club, isOwner, onEditPress }) {
  const filled = Object.values(club.members).filter(Boolean).length
  return (
    <div style={{ padding: '28px 20px 14px', display: 'flex', gap: 14, alignItems: 'flex-start' }}>
      <Badge abbr={club.abbr} size={62}/>
      <div style={{ flex: 1, minWidth: 0, paddingTop: 2 }}>
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5,
          textTransform: 'uppercase', color: C.accent, marginBottom: 4 }}>
          {club.country.flag}&nbsp;{club.country.name}
        </p>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
          <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 21, color: C.text, letterSpacing: -0.4, lineHeight: 1,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', margin: 0,
            flex: 1, minWidth: 0 }}>
            {club.name}
          </h1>
          {isOwner && (
            <motion.button whileTap={{ scale: 0.88 }} onClick={onEditPress}
              style={{
                flexShrink: 0, width: 28, height: 28, borderRadius: 9,
                background: 'rgba(0,200,255,0.08)',
                border: '1px solid rgba(0,200,255,0.22)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
              }}>
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke={C.accent}
                strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </motion.button>
          )}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i < filled ? C.accent : C.dim,
                boxShadow: i < filled ? `0 0 5px ${C.accentHi}80` : 'none',
                transition: 'all 0.3s',
              }}/>
            ))}
          </div>
          <p style={{ fontSize: 10, color: C.sub, fontWeight: 600, margin: 0 }}>
            {filled}/5 graczy
          </p>
        </div>
      </div>
    </div>
  )
}

// ── PANEL DOTS ────────────────────────────────────────────────────────────────
function PanelDots({ active, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 5, paddingBottom: 10 }}>
      {[0, 1].map(i => (
        <motion.div key={i} onClick={() => onChange(i)}
          animate={{ width: active === i ? 18 : 6 }}
          style={{
            height: 6, borderRadius: 3, cursor: 'pointer',
            background: active === i ? C.accent : C.dim,
            boxShadow: active === i ? `0 0 6px ${C.accent}80` : 'none',
          }}/>
      ))}
    </div>
  )
}

// ── STATS PANEL ───────────────────────────────────────────────────────────────
function StatsPanel({ club }) {
  // Matches table not implemented yet — empty state
  const wins = 0, losses = 0
  const total = wins + losses
  const rate = total > 0 ? Math.round(wins / total * 100) : 0

  return (
    <div style={{ padding: '0 16px 110px' }}>
      {/* W / L / Rate cards */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[
          { val: wins,   lbl: 'Wygrane',   col: C.win  },
          { val: losses, lbl: 'Przegrane', col: C.loss },
          { val: `${rate}%`, lbl: 'Win rate',   col: C.accent },
        ].map(({ val, lbl, col }) => (
          <div key={lbl} style={{
            flex: 1, padding: '16px 10px', borderRadius: 16, textAlign: 'center',
            background: C.surface, border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <p style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1, lineHeight: 1,
              color: col, textShadow: `0 0 20px ${col}50`, margin: 0 }}>{val}</p>
            <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1.5,
              textTransform: 'uppercase', color: `${col}70`, marginTop: 5 }}>{lbl}</p>
          </div>
        ))}
      </div>

      {/* Win rate bar */}
      <div style={{ padding: '14px 16px', borderRadius: 14,
        background: C.surface, border: '1px solid rgba(255,255,255,0.05)', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
            textTransform: 'uppercase', color: C.sub }}>Skuteczność</span>
          <span style={{ fontSize: 11, fontWeight: 800, color: C.accent }}>
            {wins} / {total} meczów
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: C.dim, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }} animate={{ width: `${total > 0 ? rate : 0}%` }}
            transition={{ duration: 0.6, ease: 'easeOut' }}
            style={{ height: '100%', borderRadius: 3,
              background: `linear-gradient(90deg, ${C.accentLo}, ${C.win})` }}/>
        </div>
      </div>

      {/* Upcoming */}
      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.8,
        textTransform: 'uppercase', color: C.dim, margin: '0 0 10px 2px' }}>
        Nadchodzące mecze
      </p>
      <div style={{ padding: '20px 16px', borderRadius: 14,
        background: C.surface, border: '1px solid rgba(255,255,255,0.05)',
        marginBottom: 18, textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: C.sub, fontWeight: 500 }}>
          Brak zaplanowanych meczów
        </p>
        <p style={{ fontSize: 9, color: C.dim, marginTop: 4 }}>
          System meczów — wkrótce
        </p>
      </div>

      {/* Recent */}
      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.8,
        textTransform: 'uppercase', color: C.dim, margin: '0 0 10px 2px' }}>
        Ostatnie mecze
      </p>
      <div style={{ padding: '20px 16px', borderRadius: 14,
        background: C.surface, border: '1px solid rgba(255,255,255,0.05)',
        textAlign: 'center' }}>
        <p style={{ fontSize: 11, color: C.sub, fontWeight: 500 }}>
          Brak rozegranych meczów
        </p>
        <p style={{ fontSize: 9, color: C.dim, marginTop: 4 }}>
          Historia meczów pojawi się tutaj
        </p>
      </div>
    </div>
  )
}

// ── COURT PANEL ───────────────────────────────────────────────────────────────
function CourtPanel({ club, uid, onUpdate, onTokenTap, swapMode, setSwapMode, swapSrc, swapping, swapError }) {
  const [copied, setCopied] = useState(false)
  const isOwner = club.ownerId === uid

  return (
    <div style={{ padding: '0 0 110px' }}>
      {/* Swap hint / error */}
      <AnimatePresence>
        {swapMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', padding: '0 16px 10px' }}>
            <div style={{
              padding: '9px 16px', borderRadius: 12, textAlign: 'center',
              background: swapError ? 'rgba(255,60,80,0.08)'
                : swapping ? `${C.dim}30` : `${C.swap}0C`,
              border: `1px solid ${swapError ? 'rgba(255,60,80,0.35)'
                : swapping ? C.dim : `${C.swap}30`}`,
            }}>
              <p style={{ fontSize: 11, fontWeight: 600, margin: 0,
                color: swapError ? C.loss : swapping ? C.sub : C.swap,
                wordBreak: 'break-all' }}>
                {swapError      ? `❌ ${swapError}`
                  : swapping    ? '⏳ Zapisywanie…'
                  : swapSrc     ? `Wybierz pozycję docelową dla ${swapSrc}`
                  : 'Kliknij gracza, którego chcesz przenieść'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Court card */}
      <div style={{ padding: '0 16px', position: 'relative' }}>

        {/* Responsive clip-path defs — objectBoundingBox scales with the element */}
        <svg width="0" height="0" aria-hidden="true"
          style={{ position: 'absolute', pointerEvents: 'none', overflow: 'hidden' }}>
          <defs>
            <clipPath id="courtClip" clipPathUnits="objectBoundingBox">
              {/* M24,0…Z normalised to 0-1 space: x/343, y/410 */}
              <path d="M0.070,0 L0.930,0 Q0.930,0.059 1,0.059 L1,0.941 Q0.930,0.941 0.930,1 L0.070,1 Q0.070,0.941 0,0.941 L0,0.059 Q0.070,0.059 0.070,0 Z"/>
            </clipPath>
          </defs>
        </svg>

        {/* Responsive court wrapper — always fills available width, keeps 343:410 ratio */}
        <div style={{ position: 'relative', width: '100%', aspectRatio: '343 / 410' }}>

          {/* Clipped court card — fills wrapper */}
          <div style={{
            position: 'absolute', inset: 0,
            clipPath: 'url(#courtClip)',
            overflow: 'hidden',
          }}>
            <Court/>
            {/* Tokens */}
            {POSITIONS.map(posKey => (
              <div key={posKey} style={{
                position: 'absolute',
                left: SPOT[posKey].x, top: SPOT[posKey].y,
                transform: 'translate(-50%, -50%)', zIndex: 3,
              }}>
                <Token
                  posKey={posKey}
                  member={club.members[posKey]}
                  onPress={() => onTokenTap(posKey)}
                  swapMode={swapMode}
                  isSrc={swapSrc === posKey}
                  isTgt={swapMode && !!swapSrc && swapSrc !== posKey}/>
              </div>
            ))}
          </div>

          {/* Neon glow border SVG — outside clip so glow can bleed */}
          <svg style={{
            position: 'absolute', inset: 0,
            width: '100%', height: '100%',
            pointerEvents: 'none', zIndex: 10, overflow: 'visible',
          }} viewBox="0 0 343 410" preserveAspectRatio="none">
            <defs>
              <filter id="neonG" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3"  result="b1"/>
                <feGaussianBlur stdDeviation="10" result="b2"/>
                <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <filter id="softG" x="-10%" y="-10%" width="120%" height="120%">
                <feGaussianBlur stdDeviation="1.8" result="b"/>
                <feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
              </filter>
              <linearGradient id="topStripe" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%"   stopColor="transparent"/>
                <stop offset="30%"  stopColor="#0099EE"/>
                <stop offset="50%"  stopColor="#55EEFF"/>
                <stop offset="70%"  stopColor="#0099EE"/>
                <stop offset="100%" stopColor="transparent"/>
              </linearGradient>
            </defs>
            {/* Halo glow */}
            <path d={COURT_PATH} fill="none" stroke="rgba(0,200,255,0.13)" strokeWidth="7" filter="url(#neonG)"/>
            {/* Sharp border */}
            <path d={COURT_PATH} fill="none" stroke="rgba(0,220,255,0.50)" strokeWidth="1.4" filter="url(#softG)"/>
            {/* Top accent stripe */}
            <line x1="24" y1="0.8" x2="319" y2="0.8" stroke="url(#topStripe)" strokeWidth="2"/>
            {/* Corner tick marks */}
            <line x1="5"   y1="5"   x2="17"  y2="17"  stroke="rgba(0,240,255,0.25)" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="338" y1="5"   x2="326" y2="17"  stroke="rgba(0,240,255,0.25)" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="5"   y1="405" x2="17"  y2="393" stroke="rgba(0,240,255,0.25)" strokeWidth="1.2" strokeLinecap="round"/>
            <line x1="338" y1="405" x2="326" y2="393" stroke="rgba(0,240,255,0.25)" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>

          {/* Swap FAB — percentage-positioned so it scales with the court */}
          {isOwner && (
            <motion.button
              whileTap={{ scale: 0.84 }}
              onClick={() => { setSwapMode(v => !v) }}
              style={{
                position: 'absolute', bottom: '3.5%', right: '6%', zIndex: 20,
                width: 36, height: 36, borderRadius: '50%',
                background: swapMode ? `${C.swap}18` : 'rgba(0,220,255,0.10)',
                border: `1.5px solid ${swapMode ? C.swap : 'rgba(0,220,255,0.36)'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer', color: swapMode ? C.swap : C.accent,
                backdropFilter: 'blur(10px)',
                boxShadow: swapMode
                  ? `0 4px 16px ${C.swap}40`
                  : '0 4px 14px rgba(0,180,255,0.15)',
                transition: 'all 0.2s',
              }}>
              {swapMode
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                : <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/></svg>
              }
            </motion.button>
          )}
        </div>
      </div>

      {/* Share */}
      <div style={{ padding: '14px 16px 0' }}>
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => {
            navigator.clipboard.writeText(`https://hoopconnect.pl/klub/${club.id}`)
            setCopied(true); setTimeout(() => setCopied(false), 2500)
          }}
          style={{
            width: '100%', padding: '14px', border: 'none', borderRadius: 16,
            background: copied
              ? 'rgba(0,200,130,0.10)'
              : `linear-gradient(135deg, ${C.accent}, ${C.accentLo})`,
            border: copied ? '1.5px solid rgba(0,200,130,0.28)' : 'none',
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 11.5, letterSpacing: 2.5, textTransform: 'uppercase',
            color: copied ? C.win : '#fff', cursor: 'pointer',
            boxShadow: copied ? 'none' : `0 5px 24px ${C.accentLo}60`,
            transition: 'all 0.22s',
          }}>
          {copied ? '✓ Link skopiowany!' : '🔗 Udostępnij klub'}
        </motion.button>
      </div>
    </div>
  )
}

// ── CLUB VIEW (panel switcher) ────────────────────────────────────────────────
function ClubView({ club, onUpdate, uid }) {
  const [panel,    setPanel]    = useState(0)
  const [sheet,    setSheet]    = useState(null) // 'empty'|'player'|'edit'|null
  const [sheetPos, setSheetPos] = useState(null)
  const [swapMode,  setSwapMode]  = useState(false)
  const [swapSrc,   setSwapSrc]   = useState(null)
  const [swapping,  setSwapping]  = useState(false)
  const [swapError, setSwapError] = useState(null)
  const [removing, setRemoving] = useState(false)
  const touchStart = useRef(null)

  const isOwner = club.ownerId === uid

  function handleTokenTap(posKey) {
    if (swapMode && isOwner) {
      if (!swapSrc) {
        // Can only select a filled position as move source
        if (!club.members[posKey]) return
        setSwapSrc(posKey)
        return
      }
      // Tap same source → deselect
      if (swapSrc === posKey) { setSwapSrc(null); return }
      // Tap any other position → execute move
      doSwap(swapSrc, posKey)
      return
    }
    const member = club.members[posKey]
    setSheetPos(posKey)
    if (!member)                setSheet('empty')
    else if (member.id === uid) setSheet('player-self')
    else                        setSheet('player-other')
  }

  async function doSwap(pA, pB) {
    setSwapping(true)
    setSwapError(null)
    try {
      await apiSwap(club.id, pA, pB)
    } catch (e) {
      const msg = e?.message ?? JSON.stringify(e)
      setSwapError(msg)
      console.error('swap error:', e)
      // Keep swap mode open so user can see the error
      setSwapping(false)
      setSwapSrc(null)
      return
    }
    const up = await apiFetch(uid)
    if (up) onUpdate(up)
    setSwapping(false)
    setSwapSrc(null)
    setSwapMode(false)
  }

  async function handleRemove(posKey) {
    setRemoving(true)
    try {
      await apiRemove(club.id, posKey)
      onUpdate({ ...club, members: { ...club.members, [posKey]: null } })
      setSheet(null)
    } catch (e) { console.error(e) }
    finally { setRemoving(false) }
  }

  async function handleLeave() {
    setRemoving(true)
    try {
      if (isOwner) await apiDisband(club.id)
      else         await apiLeave(club.id, uid)
      onUpdate(null)
    } catch (e) { console.error(e) }
    finally { setRemoving(false) }
  }

  function closeSheet() {
    if (!removing) setSheet(null)
  }

  // Touch-based swipe detection
  function onTouchStart(e) { touchStart.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touchStart.current === null) return
    const dx = e.changedTouches[0].clientX - touchStart.current
    if (dx < -50 && panel === 0) setPanel(1)
    if (dx >  50 && panel === 1) setPanel(0)
    touchStart.current = null
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: C.bg }}
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>

      {/* ── Fixed header — stays put while panels slide ── */}
      <ClubHeader club={club} isOwner={isOwner} onEditPress={() => setSheet('edit')}/>
      <PanelDots active={panel} onChange={setPanel}/>

      {/* ── Sliding content area only ── */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <motion.div
          animate={{ x: panel === 0 ? 0 : '-50%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          style={{ display: 'flex', width: '200%', height: '100%' }}>

          {/* Panel 0 — Court */}
          <div style={{ width: '50%', height: '100%', overflowY: 'auto' }}>
            <CourtPanel
              club={club} uid={uid} onUpdate={onUpdate}
              onTokenTap={handleTokenTap}
              swapMode={swapMode} setSwapMode={v => { setSwapMode(v); setSwapSrc(null); setSwapError(null) }}
              swapSrc={swapSrc} swapping={swapping} swapError={swapError}/>
          </div>

          {/* Panel 1 — Stats */}
          <div style={{ width: '50%', height: '100%', overflowY: 'auto' }}>
            <StatsPanel club={club}/>
          </div>
        </motion.div>
      </div>

      {/* Sheets */}
      <AnimatePresence>
        {sheet === 'empty' && sheetPos && (
          <EmptySlotSheet
            key="empty"
            club={club} posKey={sheetPos}
            onClose={closeSheet}/>
        )}
        {(sheet === 'player-self' || sheet === 'player-other') && sheetPos && club.members[sheetPos] && (
          <PlayerSheet
            key="player"
            club={club} posKey={sheetPos}
            member={club.members[sheetPos]}
            isOwner={isOwner}
            isSelf={sheet === 'player-self'}
            removing={removing}
            onClose={closeSheet}
            onRemove={() => handleRemove(sheetPos)}
            onLeave={handleLeave}/>
        )}
        {sheet === 'edit' && (
          <EditClubSheet
            key="edit"
            club={club}
            onClose={closeSheet}
            onSaved={updated => { onUpdate(updated); setSheet(null) }}/>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── CREATE CLUB ───────────────────────────────────────────────────────────────
function CreateClub({ onCreated, profile }) {
  const [name,   setName]   = useState('')
  const [abbr,   setAbbr]   = useState('')
  const [ctry,   setCtry]   = useState(COUNTRIES[0])
  const [picker, setPicker] = useState(false)
  const [saving, setSaving] = useState(false)
  const [err,    setErr]    = useState(null)

  const preview = abbr.trim().toUpperCase().slice(0, 3) || '?'
  const valid   = name.trim().length >= 3 && abbr.trim().length >= 2

  async function submit() {
    if (!valid || saving) return
    setSaving(true); setErr(null)
    try { onCreated(await apiCreate({ name: name.trim(), abbr, country: ctry, profile })) }
    catch { setErr('Nie udało się. Spróbuj ponownie.'); setSaving(false) }
  }

  return (
    <div style={{
      minHeight: '100%', background: C.bg,
      display: 'flex', flexDirection: 'column', padding: '44px 20px 40px',
    }}>
      <AnimatePresence>
        {picker && <CountryPicker value={ctry} onChange={c => { setCtry(c); setPicker(false) }} onClose={() => setPicker(false)}/>}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 18 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 30 }}>
        <Badge abbr={preview} size={96}/>
        <p style={{ fontSize: 9, letterSpacing: 3, color: C.accent,
          textTransform: 'uppercase', fontWeight: 700, marginTop: 12 }}>
          Podgląd odznaki
        </p>
      </motion.div>

      <h1 style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 36,
        color: C.text, textTransform: 'uppercase', letterSpacing: -0.3,
        lineHeight: 1.05, marginBottom: 6 }}>
        Załóż<br/>Klub
      </h1>
      <p style={{ color: C.sub, fontSize: 13, marginBottom: 26, lineHeight: 1.6 }}>
        Stwórz drużynę, zaproś znajomych i rywalizujcie.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          { lbl: 'Nazwa klubu', ph: 'np. Warsaw Ballers', val: name,
            set: e => setName(e.target.value), max: 30, sx: {} },
          { lbl: 'Skrót (2–3 litery)', ph: 'WBL', val: abbr,
            set: e => setAbbr(e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3)),
            max: 3, sx: { fontSize: 20, fontWeight: 900, letterSpacing: 6,
              fontFamily: 'var(--font-display)', textAlign: 'center' } },
        ].map(f => (
          <div key={f.lbl}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2,
              textTransform: 'uppercase', color: C.sub, marginBottom: 6 }}>{f.lbl}</p>
            <input placeholder={f.ph} value={f.val} onChange={f.set} maxLength={f.max}
              style={{
                width: '100%', padding: '14px 16px', fontSize: 15,
                background: C.surface, border: '1.5px solid rgba(0,200,255,0.14)',
                borderRadius: 14, color: C.text, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box', ...f.sx,
              }}/>
          </div>
        ))}

        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', color: C.sub, marginBottom: 6 }}>Kraj</p>
          <button onClick={() => setPicker(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', background: C.surface,
            border: '1.5px solid rgba(0,200,255,0.14)', borderRadius: 14,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ fontSize: 22 }}>{ctry.flag}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.text }}>{ctry.name}</span>
            <svg style={{ marginLeft: 'auto' }} width="15" height="15" viewBox="0 0 24 24"
              fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {err && <p style={{ color: C.loss, fontSize: 12, marginTop: 10, textAlign: 'center' }}>{err}</p>}

      <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={!valid || saving}
        style={{
          marginTop: 24, width: '100%', padding: '16px', border: 'none', borderRadius: 16,
          background: valid && !saving
            ? `linear-gradient(135deg, ${C.accentHi}, ${C.accent}, ${C.accentLo})`
            : `${C.dim}60`,
          fontFamily: 'var(--font-display)', fontWeight: 900,
          fontSize: 14, letterSpacing: 2.5, textTransform: 'uppercase',
          color: valid && !saving ? '#fff' : C.sub,
          cursor: valid && !saving ? 'pointer' : 'default',
          boxShadow: valid && !saving ? `0 8px 28px ${C.accentLo}50` : 'none',
          transition: 'all 0.2s',
        }}>
        {saving ? 'Tworzenie…' : 'Utwórz Klub'}
      </motion.button>
    </div>
  )
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
export default function ClubPage() {
  const { profile, user } = useAuth()
  const [club,    setClub]    = useState(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    if (!profile?.id) return
    setLoading(true)
    setClub(await apiFetch(profile.id))
    setLoading(false)
  }, [profile?.id])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: C.bg }}>
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
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{ height: '100%' }}>
            <ClubView club={club} onUpdate={c => { setClub(c) }} uid={user?.id}/>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
