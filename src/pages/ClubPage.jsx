import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'

// ─────────────────────────────────────────────────────────────────────────────
//  DESIGN TOKENS
//  Page: soft blue-white gradient  |  Court: deep navy + spotlight
//  Each position has its own identity color — NBA-card style
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  pageBg1:  '#E8F3FC',
  pageBg2:  '#F2F8FE',
  pageBg3:  '#FFFFFF',
  court:    '#0F1720',
  line:     'rgba(110,188,240,0.36)',
  paint:    'rgba(58,130,210,0.14)',
  accent:   '#3EA8E4',
  accentHi: '#72CAFF',
  accentLo: '#1A72C0',
  navy:     '#0B1928',
  text:     '#1A3048',
  sub:      '#5A7890',
  dim:      '#9AB4C6',
  card:     '#FFFFFF',
  hoop:     '#E08020',
  swap:     '#40DEFF',
}

// Position-specific identity colors (NBA card vibes)
const POS = {
  PG: { hi: '#5B90FF', lo: '#162A6A', glow: 'rgba(91,144,255,0.50)',  label: 'Rozgrywający'    },
  SG: { hi: '#38D490', lo: '#0A4030', glow: 'rgba(56,212,144,0.50)',  label: 'Rzucający'       },
  SF: { hi: '#FF8C38', lo: '#5A2210', glow: 'rgba(255,140,56,0.50)',  label: 'Skrzydłowy'      },
  C:  { hi: '#B05BFF', lo: '#2C1060', glow: 'rgba(176,91,255,0.50)',  label: 'Środkowy'        },
  PF: { hi: '#FF5B7A', lo: '#5A1228', glow: 'rgba(255,91,122,0.50)',  label: 'Silny skrzydł.'  },
}

const POSITIONS = Object.entries(POS).map(([key, v]) => ({ key, ...v }))

// Court positions (% inside the SVG overlay)
const SPOT = {
  PG: { x: '27%', y: '14%' },
  SG: { x: '73%', y: '14%' },
  SF: { x: '13%', y: '47%' },
  C:  { x: '50%', y: '72%' },
  PF: { x: '87%', y: '47%' },
}

// ── COUNTRIES ─────────────────────────────────────────────────────────────────
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
  const { data: ms } = await supabase.from('club_members')
    .select('club_id').eq('user_id', uid).maybeSingle()
  if (!ms) return null
  const { data: club } = await supabase.from('clubs')
    .select('id,name,abbr,country_code,country_name,country_flag,owner_id,club_members(position,user_id,profiles(name))')
    .eq('id', ms.club_id).single()
  return club ? dbToUi(club) : null
}

async function apiCreate({ name, abbr, country, profile }) {
  const { data: club, error } = await supabase.from('clubs')
    .insert({
      name, abbr: abbr.toUpperCase(),
      country_code: country.code, country_name: country.name, country_flag: country.flag,
      owner_id: profile.id,
    }).select().single()
  if (error) throw error
  await supabase.from('club_members')
    .insert({ club_id: club.id, user_id: profile.id, position: 'PG' })
  return dbToUi({
    ...club,
    club_members: [{ position: 'PG', user_id: profile.id, profiles: { name: profile.name } }],
  })
}

async function apiRemove(clubId, pos) {
  const { error } = await supabase.from('club_members')
    .delete().eq('club_id', clubId).eq('position', pos)
  if (error) throw error
}

async function apiSwap(clubId, pA, pB, idA, idB) {
  const dels = []
  if (idA) dels.push(supabase.from('club_members').delete().eq('club_id', clubId).eq('position', pA))
  if (idB) dels.push(supabase.from('club_members').delete().eq('club_id', clubId).eq('position', pB))
  await Promise.all(dels)
  const ins = []
  if (idA) ins.push({ club_id: clubId, user_id: idA, position: pB })
  if (idB) ins.push({ club_id: clubId, user_id: idB, position: pA })
  if (ins.length) {
    const { error } = await supabase.from('club_members').insert(ins)
    if (error) throw error
  }
}

// ── COURT SVG ─────────────────────────────────────────────────────────────────
function Court() {
  const L = C.line
  return (
    <svg viewBox="0 0 360 380" preserveAspectRatio="xMidYMid slice"
      style={{ position: 'absolute', inset: 0, width: '100%', height: '100%' }}>
      <defs>
        {/* Floor depth */}
        <linearGradient id="floorG" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor="#1B2840"/>
          <stop offset="100%" stopColor="#0C1320"/>
        </linearGradient>
        {/* Spotlight from halfcourt */}
        <radialGradient id="spotG" cx="50%" cy="5%" r="70%">
          <stop offset="0%"   stopColor="rgba(72,152,228,0.15)"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        {/* Basket glow */}
        <radialGradient id="hoopG" cx="50%" cy="100%" r="45%">
          <stop offset="0%"   stopColor="rgba(224,128,32,0.20)"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        {/* Paint glow */}
        <radialGradient id="paintG" cx="50%" cy="90%" r="30%">
          <stop offset="0%"   stopColor="rgba(58,130,210,0.12)"/>
          <stop offset="100%" stopColor="transparent"/>
        </radialGradient>
        <clipPath id="courtClip"><rect width="360" height="380" rx="20"/></clipPath>
      </defs>
      <g clipPath="url(#courtClip)">
        {/* Base floor */}
        <rect width="360" height="380" fill="url(#floorG)"/>
        <rect width="360" height="380" fill="url(#spotG)"/>
        <rect width="360" height="380" fill="url(#hoopG)"/>
        <rect width="360" height="380" fill="url(#paintG)"/>

        {/* Subtle wood planks */}
        {[...Array(25)].map((_, i) => (
          <line key={i} x1="0" y1={i * 16 + 8} x2="360" y2={i * 16 + 8}
            stroke="rgba(255,255,255,0.012)" strokeWidth="1"/>
        ))}

        {/* ── Double halfcourt line ── */}
        <line x1="0"   y1="13"  x2="360" y2="13"  stroke={L} strokeWidth="1.6"/>
        <line x1="0"   y1="22"  x2="360" y2="22"  stroke={L} strokeWidth="1.6"/>
        {/* Jump-circle arc (lower half between the two lines) */}
        <path d="M 144 17.5 A 36 36 0 0 0 216 17.5"
          fill="none" stroke="rgba(110,188,240,0.25)" strokeWidth="1.4"/>

        {/* Sidelines */}
        <line x1="14"  y1="22"  x2="14"  y2="372" stroke={L} strokeWidth="1.4"/>
        <line x1="346" y1="22"  x2="346" y2="372" stroke={L} strokeWidth="1.4"/>
        {/* Baseline */}
        <line x1="14"  y1="372" x2="346" y2="372" stroke={L} strokeWidth="1.5"/>

        {/* ── 3-point arc ── */}
        <line x1="14"  y1="264" x2="14"  y2="372" stroke={L} strokeWidth="1.4"/>
        <line x1="346" y1="264" x2="346" y2="372" stroke={L} strokeWidth="1.4"/>
        <path d="M 14 264 A 210 210 0 0 1 346 264"
          fill="none" stroke={L} strokeWidth="1.4"/>

        {/* ── Key / Paint ── */}
        <rect x="130" y="252" width="100" height="120" fill={C.paint}/>
        <line x1="130" y1="252" x2="130" y2="372" stroke={L} strokeWidth="1.4"/>
        <line x1="230" y1="252" x2="230" y2="372" stroke={L} strokeWidth="1.4"/>
        <line x1="130" y1="252" x2="230" y2="252" stroke={L} strokeWidth="1.4"/>
        {/* FT circle — solid top half */}
        <path d="M 130 252 A 50 50 0 0 1 230 252"
          fill="none" stroke={L} strokeWidth="1.4"/>
        {/* FT circle — dashed bottom half */}
        <path d="M 130 252 A 50 50 0 0 0 230 252"
          fill="none" stroke="rgba(110,188,240,0.20)" strokeWidth="1.3" strokeDasharray="5 3"/>
        {/* Hash marks */}
        {[[118,288,130],[118,318,130],[230,288,242],[230,318,242]].map(([x, y, x2]) => (
          <line key={`h${x}${y}`} x1={x} y1={y} x2={x2} y2={y}
            stroke="rgba(110,188,240,0.22)" strokeWidth="1.2"/>
        ))}

        {/* ── Restricted area arc ── */}
        <path d="M 154 372 A 26 26 0 0 0 206 372"
          fill="none" stroke="rgba(110,188,240,0.24)" strokeWidth="1.3"/>

        {/* ── Backboard + hoop ── */}
        <rect x="157" y="355" width="46" height="4" rx="1.5" fill={C.hoop} opacity="0.92"/>
        <circle cx="180" cy="366" r="14" fill="none" stroke={C.hoop} strokeWidth="2.5"/>
        {/* Net fill hint */}
        <circle cx="180" cy="366" r="7" fill="rgba(224,128,32,0.15)"/>
      </g>
    </svg>
  )
}

// ── DIAMOND BADGE ─────────────────────────────────────────────────────────────
function Badge({ abbr = '?', size = 70 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 90 90"
      style={{ flexShrink: 0, overflow: 'visible',
        filter: 'drop-shadow(0 8px 20px rgba(10,40,100,0.50))' }}>
      <defs>
        <linearGradient id="bdg" x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor="#82D2FF"/>
          <stop offset="40%"  stopColor="#2A7CC8"/>
          <stop offset="100%" stopColor="#081E42"/>
        </linearGradient>
      </defs>
      <polygon points="45,9 84,33 84,61 45,87 6,61 6,33"  fill="rgba(0,0,0,0.28)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"  fill="url(#bdg)"/>
      <polygon points="45,6 8,32 45,42"                   fill="rgba(255,255,255,0.32)"/>
      <polygon points="45,6 82,32 45,42"                  fill="rgba(255,255,255,0.14)"/>
      <polygon points="8,32 8,58 45,48 45,42"             fill="rgba(20,90,200,0.55)"/>
      <polygon points="82,32 82,58 45,48 45,42"           fill="rgba(6,38,120,0.72)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
        fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.8" strokeLinejoin="round"/>
      <text x="45" y="51" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize={abbr.length > 2 ? '20' : '24'} fontWeight="900"
        fontFamily="var(--font-display),Montserrat,'Arial Black',sans-serif" letterSpacing="1">
        {abbr.toUpperCase()}
      </text>
    </svg>
  )
}

// ── PLAYER TOKEN ──────────────────────────────────────────────────────────────
const SZ = 84

function Token({ posKey, member, onPress, swapMode, isSrc, isTgt }) {
  const pos  = POS[posKey]
  const filled = !!member
  const hi   = isSrc ? C.swap : pos.hi
  const lo   = isSrc ? '#083858' : pos.lo
  const glowColor = isSrc ? 'rgba(64,222,255,0.60)' : pos.glow

  return (
    <motion.button
      whileTap={{ scale: 0.86 }}
      onClick={onPress}
      animate={isSrc ? { scale: [1, 1.06, 1] } : { scale: 1 }}
      transition={{ repeat: isSrc ? Infinity : 0, duration: 0.85, ease: 'easeInOut' }}
      style={{
        background: 'none', border: 'none', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4,
        WebkitTapHighlightColor: 'transparent',
      }}
    >
      <div style={{ position: 'relative', width: SZ, height: SZ }}>
        {/* Glow bloom */}
        {filled && (
          <div style={{
            position: 'absolute',
            top: '10%', left: '5%', width: '90%', height: '80%',
            borderRadius: '50%',
            background: `radial-gradient(ellipse, ${glowColor} 0%, transparent 70%)`,
            filter: 'blur(10px)',
            pointerEvents: 'none',
          }}/>
        )}

        <svg width={SZ} height={SZ} viewBox="0 0 90 90"
          style={{
            overflow: 'visible', position: 'relative', zIndex: 1,
            filter: filled
              ? `drop-shadow(0 6px 16px ${glowColor.replace('0.50', '0.70')})`
              : 'drop-shadow(0 3px 8px rgba(0,0,0,0.45))',
          }}>
          <defs>
            {filled && (
              <linearGradient id={`tg_${posKey}`} x1="20%" y1="0%" x2="80%" y2="100%">
                <stop offset="0%"   stopColor={hi} stopOpacity="0.75"/>
                <stop offset="100%" stopColor={lo}/>
              </linearGradient>
            )}
          </defs>

          {/* Swap target ring */}
          {isTgt && (
            <polygon points="45,0 90,27 90,63 45,90 0,63 0,27"
              fill={`${C.swap}08`}
              stroke={`${C.swap}50`} strokeWidth="1.5"
              strokeLinejoin="round" strokeDasharray="7 4"/>
          )}
          {/* Swap source ring */}
          {isSrc && (
            <polygon points="45,0 90,27 90,63 45,90 0,63 0,27"
              fill="none" stroke={C.swap} strokeWidth="2.4" strokeLinejoin="round"/>
          )}

          {filled ? (
            <>
              {/* Drop shadow facet */}
              <polygon points="45,9 84,33 84,61 45,87 6,61 6,33"
                fill="rgba(0,0,0,0.45)"/>
              {/* Main body */}
              <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
                fill={`url(#tg_${posKey})`}/>
              {/* Highlight facets */}
              <polygon points="45,6 8,32 45,42"
                fill="rgba(255,255,255,0.22)"/>
              <polygon points="45,6 82,32 45,42"
                fill="rgba(255,255,255,0.10)"/>
              {/* Shadow side facets */}
              <polygon points="8,32 8,58 45,48 45,42"
                fill={`${hi}22`}/>
              <polygon points="82,32 82,58 45,48 45,42"
                fill="rgba(0,0,0,0.35)"/>
              {/* Border */}
              <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
                fill="none"
                stroke={isSrc ? C.swap : `${hi}CC`}
                strokeWidth="2.2" strokeLinejoin="round"/>
              {/* Outer shimmer */}
              <polygon points="45,3 86,30 86,60 45,87 4,60 4,30"
                fill="none" stroke={`${hi}20`}
                strokeWidth="1" strokeLinejoin="round"/>
              {/* Initial letter */}
              <text x="45" y="50" textAnchor="middle" dominantBaseline="middle"
                fill="white" fontSize="32" fontWeight="900"
                fontFamily="var(--font-display),Montserrat,sans-serif">
                {member.initial}
              </text>
            </>
          ) : (
            <>
              {/* Empty slot */}
              <polygon points="45,6 82,32 82,58 45,84 8,58 8,32"
                fill={swapMode ? 'rgba(64,222,255,0.05)' : 'rgba(62,168,228,0.05)'}
                stroke={swapMode ? `rgba(64,222,255,0.38)` : `rgba(110,188,240,0.38)`}
                strokeWidth="1.8" strokeLinejoin="round"
                strokeDasharray={swapMode ? '6 3' : 'none'}/>
              {/* + sign */}
              <line x1="45" y1="34" x2="45" y2="56"
                stroke={swapMode ? 'rgba(64,222,255,0.55)' : 'rgba(110,188,240,0.55)'}
                strokeWidth="2.4" strokeLinecap="round"/>
              <line x1="34" y1="45" x2="56" y2="45"
                stroke={swapMode ? 'rgba(64,222,255,0.55)' : 'rgba(110,188,240,0.55)'}
                strokeWidth="2.4" strokeLinecap="round"/>
            </>
          )}
        </svg>
      </div>

      {/* Labels */}
      <div style={{ textAlign: 'center', lineHeight: 1 }}>
        <p style={{
          fontSize: 9, fontWeight: 800, letterSpacing: 2.2,
          textTransform: 'uppercase', margin: 0,
          color: isSrc ? C.swap : filled ? `${hi}EE` : 'rgba(110,175,215,0.75)',
        }}>
          {posKey}
        </p>
        {filled
          ? <p style={{
              fontSize: 10, fontWeight: 600, margin: '2px 0 0',
              color: 'rgba(210,232,252,0.88)',
              maxWidth: 78, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>
              {member.name}
            </p>
          : <p style={{ fontSize: 9, margin: '2px 0 0', color: 'rgba(100,155,195,0.45)' }}>
              Zaproś
            </p>
        }
      </div>
    </motion.button>
  )
}

// ── SLOT MODAL ────────────────────────────────────────────────────────────────
function SlotModal({ club, posKey, member, onClose, onRemove, removing }) {
  const pos  = POS[posKey]
  const [copied, setCopied] = useState(false)
  const link = `https://hoopconnect.pl/dolacz/${club.id}?pos=${posKey}`

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500, display: 'flex',
        alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 28px',
        background: 'rgba(5,12,28,0.65)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
      }}>
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 380, damping: 32 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, margin: '0 14px',
          background: C.card, borderRadius: 28, padding: '20px 22px 24px',
          boxShadow: '0 -4px 80px rgba(10,25,60,0.20), 0 0 0 1px rgba(62,168,228,0.12)',
        }}>

        {/* Drag pill */}
        <div style={{ width: 36, height: 4, background: '#DDE8F0',
          borderRadius: 2, margin: '0 auto 18px' }}/>

        {/* Position badge */}
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '5px 14px', borderRadius: 99,
          background: `${pos.hi}18`, border: `1px solid ${pos.hi}40`, marginBottom: 14,
        }}>
          <span style={{
            width: 8, height: 8, borderRadius: '50%',
            background: pos.hi, boxShadow: `0 0 6px ${pos.glow}`,
          }}/>
          <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2,
            color: pos.hi, textTransform: 'uppercase' }}>{posKey}</span>
          <span style={{ fontSize: 10, fontWeight: 600, color: C.sub, letterSpacing: 0.4 }}>
            {pos.label}
          </span>
        </div>

        {member ? (
          <>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 26, color: C.navy, marginBottom: 18, letterSpacing: -0.4, lineHeight: 1,
            }}>
              {member.name}
              {member.isOwner && (
                <span style={{ fontSize: 9, fontWeight: 700, color: C.accent,
                  marginLeft: 10, letterSpacing: 1.5, verticalAlign: 'middle' }}>
                  KAPITAN
                </span>
              )}
            </p>
            {!member.isOwner && (
              <motion.button whileTap={{ scale: 0.96 }} onClick={onRemove} disabled={removing}
                style={{
                  width: '100%', padding: '14px',
                  background: removing ? '#F5F5F5' : 'rgba(210,32,32,0.07)',
                  border: removing ? '1px solid #E0E0E0' : '1.5px solid rgba(210,32,32,0.22)',
                  borderRadius: 14, color: removing ? '#B0B0B0' : '#CC2828',
                  fontFamily: 'var(--font-display)', fontWeight: 800,
                  fontSize: 14, letterSpacing: 1, cursor: removing ? 'default' : 'pointer',
                  transition: 'all 0.2s',
                }}>
                {removing ? 'Usuwanie…' : 'Usuń z klubu'}
              </motion.button>
            )}
          </>
        ) : (
          <>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 24, color: C.navy, marginBottom: 14 }}>
              Zaproś zawodnika
            </p>
            <div style={{
              padding: '11px 14px', background: '#F3F8FD',
              border: '1px solid #D0E8F5', borderRadius: 12, marginBottom: 14,
              fontFamily: 'monospace', fontSize: 11, color: C.sub,
              wordBreak: 'break-all', lineHeight: 1.5,
            }}>
              {link}
            </div>
            <motion.button whileTap={{ scale: 0.97 }}
              onClick={() => navigator.clipboard.writeText(link)
                .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })}
              style={{
                width: '100%', padding: '15px',
                background: copied
                  ? 'rgba(5,150,105,0.09)'
                  : `linear-gradient(135deg, ${C.accent}, ${C.accentLo})`,
                border: copied ? '1.5px solid rgba(5,150,105,0.28)' : 'none',
                borderRadius: 14,
                fontFamily: 'var(--font-display)', fontWeight: 800,
                fontSize: 14, letterSpacing: 1,
                color: copied ? '#059669' : C.card,
                cursor: 'pointer', transition: 'all 0.2s',
                boxShadow: copied ? 'none' : '0 6px 22px rgba(26,114,192,0.36)',
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
        background: 'rgba(5,12,28,0.65)',
        backdropFilter: 'blur(28px)', WebkitBackdropFilter: 'blur(28px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '0 0 24px',
      }}>
      <motion.div
        initial={{ y: 60, opacity: 0 }} animate={{ y: 0, opacity: 1 }}
        exit={{ y: 60, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 340, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420, margin: '0 12px',
          background: C.card, borderRadius: 26,
          maxHeight: '62vh', overflowY: 'auto', padding: '18px 0 16px',
          boxShadow: '0 -2px 60px rgba(10,25,60,0.16)',
        }}>
        <p style={{
          fontSize: 10, letterSpacing: 2.5, textTransform: 'uppercase',
          color: C.accent, fontWeight: 800, margin: '0 20px 14px', textAlign: 'center',
        }}>
          Wybierz kraj
        </p>
        {COUNTRIES.map(c => (
          <button key={c.code} onClick={() => { onChange(c); onClose() }}
            style={{
              width: '100%', display: 'flex', alignItems: 'center', gap: 14,
              padding: '12px 20px',
              background: value?.code === c.code ? '#EDF5FD' : 'transparent',
              border: 'none', cursor: 'pointer',
              borderLeft: value?.code === c.code ? `3px solid ${C.accent}` : '3px solid transparent',
            }}>
            <span style={{ fontSize: 22 }}>{c.flag}</span>
            <span style={{ fontSize: 14, fontWeight: 600,
              color: value?.code === c.code ? C.accent : C.sub }}>
              {c.name}
            </span>
            {value?.code === c.code && (
              <span style={{ marginLeft: 'auto', color: C.accent, fontWeight: 800 }}>✓</span>
            )}
          </button>
        ))}
      </motion.div>
    </motion.div>
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
      minHeight: '100%',
      background: `linear-gradient(160deg, ${C.pageBg1} 0%, ${C.pageBg3} 100%)`,
      display: 'flex', flexDirection: 'column', padding: '44px 20px 40px',
    }}>
      <AnimatePresence>
        {picker && <CountryPicker value={ctry} onChange={setCtry} onClose={() => setPicker(false)}/>}
      </AnimatePresence>

      <motion.div
        initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        transition={{ type: 'spring', stiffness: 280, damping: 18 }}
        style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginBottom: 32 }}>
        <Badge abbr={preview} size={96}/>
        <p style={{ fontSize: 9, letterSpacing: 3, color: C.accent,
          textTransform: 'uppercase', fontWeight: 700, marginTop: 12 }}>
          Podgląd odznaki
        </p>
      </motion.div>

      <h1 style={{
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 36,
        color: C.navy, textTransform: 'uppercase', letterSpacing: -0.3,
        lineHeight: 1.05, marginBottom: 6,
      }}>
        Załóż<br/>Klub
      </h1>
      <p style={{ color: C.sub, fontSize: 13, marginBottom: 28, lineHeight: 1.6 }}>
        Stwórz drużynę, zaproś znajomych i rywalizujcie.
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {[
          {
            lbl: 'Nazwa klubu', ph: 'np. Warsaw Ballers', val: name,
            set: e => setName(e.target.value), max: 30, sx: {},
          },
          {
            lbl: 'Skrót (2–3 litery)', ph: 'WBL', val: abbr,
            set: e => setAbbr(e.target.value.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 3)),
            max: 3,
            sx: { fontSize: 22, fontWeight: 900, letterSpacing: 6,
              fontFamily: 'var(--font-display)', textAlign: 'center' },
          },
        ].map(f => (
          <div key={f.lbl}>
            <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2,
              textTransform: 'uppercase', color: C.dim, marginBottom: 6 }}>
              {f.lbl}
            </p>
            <input placeholder={f.ph} value={f.val} onChange={f.set} maxLength={f.max}
              style={{
                width: '100%', padding: '14px 16px', fontSize: 15,
                background: C.card, border: '1.5px solid #D2E8F5',
                borderRadius: 14, color: C.navy, outline: 'none',
                fontFamily: 'inherit', boxSizing: 'border-box', ...f.sx,
              }}/>
          </div>
        ))}

        <div>
          <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 2,
            textTransform: 'uppercase', color: C.dim, marginBottom: 6 }}>
            Kraj
          </p>
          <button onClick={() => setPicker(true)} style={{
            width: '100%', display: 'flex', alignItems: 'center', gap: 12,
            padding: '14px 16px', background: C.card,
            border: '1.5px solid #D2E8F5', borderRadius: 14,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          }}>
            <span style={{ fontSize: 22 }}>{ctry.flag}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: C.navy }}>{ctry.name}</span>
            <svg style={{ marginLeft: 'auto' }} width="16" height="16" viewBox="0 0 24 24"
              fill="none" stroke={C.dim} strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {err && (
        <p style={{ color: '#CC2828', fontSize: 12, marginTop: 10, textAlign: 'center' }}>
          {err}
        </p>
      )}

      <motion.button whileTap={{ scale: 0.97 }} onClick={submit} disabled={!valid || saving}
        style={{
          marginTop: 26, width: '100%', padding: '17px',
          background: valid && !saving
            ? `linear-gradient(135deg, ${C.accentHi} 0%, ${C.accent} 50%, ${C.accentLo} 100%)`
            : '#E8F0F7',
          border: 'none', borderRadius: 16,
          fontFamily: 'var(--font-display)', fontWeight: 900,
          fontSize: 15, letterSpacing: 2.5, textTransform: 'uppercase',
          color: valid && !saving ? C.card : C.dim,
          cursor: valid && !saving ? 'pointer' : 'default',
          boxShadow: valid && !saving ? '0 8px 28px rgba(26,114,192,0.40)' : 'none',
          transition: 'all 0.2s',
        }}>
        {saving ? 'Tworzenie…' : 'Utwórz Klub'}
      </motion.button>
    </div>
  )
}

// ── SQUAD LIST ────────────────────────────────────────────────────────────────
// Card-based roster list below the court
function SquadList({ club, uid, onSlotPress }) {
  const isOwner = club.ownerId === uid
  return (
    <div style={{ padding: '16px 16px 0' }}>
      <p style={{
        fontSize: 9, fontWeight: 800, letterSpacing: 2.8,
        textTransform: 'uppercase', color: C.dim, margin: '0 0 10px 2px',
      }}>
        Skład
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {POSITIONS.map(pos => {
          const m = club.members[pos.key]
          return (
            <motion.button
              key={pos.key}
              whileTap={{ scale: 0.985 }}
              onClick={() => onSlotPress(pos.key)}
              style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '11px 14px',
                background: C.card,
                border: `1px solid ${m ? `${pos.hi}28` : '#EAF2FA'}`,
                borderRadius: 14,
                cursor: 'pointer', textAlign: 'left',
                boxShadow: m
                  ? `0 2px 12px ${pos.glow.replace('0.50', '0.10')}, 0 1px 3px rgba(10,25,60,0.06)`
                  : '0 1px 3px rgba(10,25,60,0.05)',
                transition: 'all 0.18s',
                WebkitTapHighlightColor: 'transparent',
              }}>
              {/* Position pill */}
              <div style={{
                width: 38, height: 38, borderRadius: 10, flexShrink: 0,
                background: m ? `${pos.hi}18` : '#F0F6FC',
                border: `1.5px solid ${m ? `${pos.hi}40` : '#DDE8F5'}`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                {m ? (
                  <span style={{
                    fontSize: 15, fontWeight: 900,
                    fontFamily: 'var(--font-display)',
                    color: pos.hi,
                    textShadow: `0 0 8px ${pos.glow}`,
                  }}>
                    {m.initial}
                  </span>
                ) : (
                  <span style={{ fontSize: 10, fontWeight: 800, color: C.dim,
                    letterSpacing: 0.5 }}>
                    {pos.key}
                  </span>
                )}
              </div>

              {/* Name and position */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{
                  fontSize: 13, fontWeight: m ? 700 : 500,
                  color: m ? C.navy : C.dim,
                  margin: 0, letterSpacing: m ? -0.1 : 0,
                  overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                }}>
                  {m ? m.name : 'Wolne miejsce'}
                  {m?.isOwner && (
                    <span style={{ fontSize: 8, fontWeight: 700, color: C.accent,
                      marginLeft: 8, letterSpacing: 1.2, verticalAlign: 'middle' }}>
                      KAPITAN
                    </span>
                  )}
                </p>
                <p style={{ fontSize: 10, color: C.dim, margin: '1px 0 0',
                  fontWeight: 500 }}>
                  {pos.label}
                </p>
              </div>

              {/* Action icon */}
              {isOwner && (
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                  stroke={m ? C.dim : C.accent} strokeWidth="2" strokeLinecap="round"
                  style={{ flexShrink: 0 }}>
                  {m
                    ? <><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></>
                    : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></>
                  }
                </svg>
              )}
            </motion.button>
          )
        })}
      </div>
    </div>
  )
}

// ── CLUB PANEL ────────────────────────────────────────────────────────────────
function ClubPanel({ club, onUpdate, uid }) {
  const [modal,    setModal]    = useState(null)
  const [removing, setRemoving] = useState(false)
  const [swapMode, setSwapMode] = useState(false)
  const [swapSrc,  setSwapSrc]  = useState(null)
  const [swapping, setSwapping] = useState(false)
  const [copied,   setCopied]   = useState(false)

  const isOwner = club.ownerId === uid
  const filled  = Object.values(club.members).filter(Boolean).length

  function openModal(posKey) {
    setModal({ posKey, member: club.members[posKey] })
  }

  async function handleCourtSlot(posKey) {
    if (swapMode && isOwner) {
      if (!swapSrc) { setSwapSrc(posKey); return }
      if (swapSrc === posKey) { setSwapSrc(null); return }
      setSwapping(true)
      try {
        const mA = club.members[swapSrc], mB = club.members[posKey]
        await apiSwap(club.id, swapSrc, posKey, mA?.id ?? null, mB?.id ?? null)
        const up = await apiFetch(uid); if (up) onUpdate(up)
      } catch (e) { console.error(e) }
      finally { setSwapping(false); setSwapSrc(null); setSwapMode(false) }
      return
    }
    openModal(posKey)
  }

  async function handleRemove(posKey) {
    setRemoving(true)
    try {
      await apiRemove(club.id, posKey)
      onUpdate({ ...club, members: { ...club.members, [posKey]: null } })
      setModal(null)
    } catch (e) { console.error(e) }
    finally { setRemoving(false) }
  }

  return (
    <div style={{
      minHeight: '100%', overflowY: 'auto',
      background: `linear-gradient(180deg, ${C.pageBg1} 0%, ${C.pageBg2} 40%, ${C.pageBg3} 100%)`,
    }}>
      <AnimatePresence>
        {modal && (
          <SlotModal
            club={club} posKey={modal.posKey} member={modal.member}
            removing={removing} onClose={() => setModal(null)}
            onRemove={() => handleRemove(modal.posKey)}/>
        )}
      </AnimatePresence>

      {/* ── HEADER ── */}
      <div style={{ padding: '30px 20px 18px', display: 'flex', gap: 16, alignItems: 'flex-start' }}>
        <Badge abbr={club.abbr} size={64}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          {/* Country */}
          <p style={{
            fontSize: 9.5, color: C.accent, fontWeight: 800,
            letterSpacing: 2.4, textTransform: 'uppercase', margin: '0 0 4px',
          }}>
            {club.country.flag}&nbsp;{club.country.name}
          </p>
          {/* Club name */}
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 22, color: C.navy, letterSpacing: -0.4, lineHeight: 1,
            margin: '0 0 8px',
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {club.name}
          </h1>
          {/* Roster dots */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ display: 'flex', gap: 4 }}>
              {[...Array(5)].map((_, i) => (
                <div key={i} style={{
                  width: 7, height: 7, borderRadius: '50%',
                  background: i < filled ? C.accent : '#CBE0EF',
                  boxShadow: i < filled ? `0 0 5px ${C.accentHi}80` : 'none',
                  transition: 'all 0.3s',
                }}/>
              ))}
            </div>
            <p style={{ fontSize: 10.5, color: C.sub, fontWeight: 600, margin: 0 }}>
              {filled}/5 graczy
            </p>
          </div>
        </div>

        {/* Swap toggle — owner only */}
        {isOwner && (
          <motion.button whileTap={{ scale: 0.88 }}
            onClick={() => { setSwapMode(v => !v); setSwapSrc(null) }}
            style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: 5,
              padding: '8px 13px', borderRadius: 99,
              background: swapMode ? `${C.swap}1A` : `${C.accent}14`,
              border: `1.5px solid ${swapMode ? C.swap : `${C.accent}40`}`,
              color: swapMode ? C.swap : C.accent,
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 9.5, letterSpacing: 1.8, textTransform: 'uppercase',
              cursor: 'pointer', transition: 'all 0.2s',
            }}>
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <path d="M7 16V4m0 0L3 8m4-4l4 4M17 8v12m0 0l4-4m-4 4l-4-4"/>
            </svg>
            {swapMode ? 'Anuluj' : 'Przesuń'}
          </motion.button>
        )}
      </div>

      {/* Swap hint banner */}
      <AnimatePresence>
        {swapMode && (
          <motion.div
            initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            style={{ overflow: 'hidden', padding: '0 16px 14px' }}>
            <div style={{
              padding: '9px 16px', borderRadius: 12, textAlign: 'center',
              background: swapping ? '#F4F8FC' : `${C.swap}0C`,
              border: `1px solid ${swapping ? '#D8E8F0' : `${C.swap}30`}`,
            }}>
              <p style={{ fontSize: 11.5, fontWeight: 600, margin: 0,
                color: swapping ? C.sub : C.swap }}>
                {swapping ? '⏳ Zapisywanie…'
                  : swapSrc ? `Wybierz pozycję docelową dla ${swapSrc}`
                  : 'Kliknij gracza, którego chcesz przenieść'}
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── COURT CARD ── */}
      <div style={{ padding: '0 16px' }}>
        <div style={{
          position: 'relative',
          borderRadius: 22,
          overflow: 'hidden',
          boxShadow: [
            `0 0 0 1px ${C.accent}28`,
            '0 2px 4px rgba(10,25,60,0.06)',
            '0 10px 28px rgba(10,25,60,0.14)',
            '0 28px 64px rgba(10,25,60,0.18)',
          ].join(', '),
        }}>
          {/* Gradient top accent line */}
          <div style={{
            position: 'absolute', top: 0, left: 0, right: 0, height: 2.5, zIndex: 10,
            background: `linear-gradient(90deg,
              transparent 0%, ${C.accent} 25%,
              ${C.accentHi} 50%, ${C.accent} 75%, transparent 100%)`,
          }}/>

          {/* Court area */}
          <div style={{ position: 'relative', height: 380 }}>
            <Court/>
            {POSITIONS.map(pos => (
              <div key={pos.key} style={{
                position: 'absolute',
                left: SPOT[pos.key].x, top: SPOT[pos.key].y,
                transform: 'translate(-50%, -50%)', zIndex: 3,
              }}>
                <Token
                  posKey={pos.key}
                  member={club.members[pos.key]}
                  onPress={() => handleCourtSlot(pos.key)}
                  swapMode={swapMode}
                  isSrc={swapSrc === pos.key}
                  isTgt={swapMode && !!swapSrc && swapSrc !== pos.key}/>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── SQUAD LIST ── */}
      <div style={{ marginTop: 20 }}>
        <SquadList club={club} uid={uid} onSlotPress={openModal}/>
      </div>

      {/* ── SHARE ── */}
      <div style={{ padding: '18px 16px 110px' }}>
        <motion.button whileTap={{ scale: 0.97 }}
          onClick={() => {
            navigator.clipboard.writeText(`https://hoopconnect.pl/klub/${club.id}`)
            setCopied(true); setTimeout(() => setCopied(false), 2500)
          }}
          style={{
            width: '100%', padding: '15px',
            background: copied
              ? 'rgba(5,150,105,0.09)'
              : `linear-gradient(135deg, ${C.accentHi} 0%, ${C.accent} 50%, ${C.accentLo} 100%)`,
            border: copied ? '1.5px solid rgba(5,150,105,0.28)' : 'none',
            borderRadius: 16,
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 12.5, letterSpacing: 2, textTransform: 'uppercase',
            color: copied ? '#059669' : C.card,
            cursor: 'pointer',
            boxShadow: copied ? 'none' : '0 6px 24px rgba(26,114,192,0.36)',
            transition: 'all 0.22s',
          }}>
          {copied ? '✓ Link skopiowany!' : '🔗 Udostępnij klub'}
        </motion.button>
      </div>
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
    <div style={{
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      height: '100%', background: C.pageBg2,
    }}>
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
            <ClubPanel club={club} onUpdate={setClub} uid={user?.id}/>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
