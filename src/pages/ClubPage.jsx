import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import L from 'leaflet'

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

// ── MATCH CONSTANTS ───────────────────────────────────────────────────────────
const MODE_SLOTS = { '2v2': 2, '3v3': 3, '5v5': 5 }
const MODE_LABEL = { '2v2': '2 na 2', '3v3': '3 na 3', '5v5': '5 na 5' }
const MODE_COLOR = { '2v2': '#9050FF', '3v3': '#00CCFF', '5v5': '#FFA820' }

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371, r = Math.PI / 180
  const dLat = (lat2 - lat1) * r
  const dLng = (lng2 - lng1) * r
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * r) * Math.cos(lat2 * r) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

async function reverseGeocode(lat, lng) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&accept-language=pl`,
      { headers: { 'User-Agent': 'HoopConnect/1.0' } }
    )
    const d = await res.json()
    const { road, suburb, quarter, city, town, village } = d.address || {}
    return [road, suburb || quarter || city || town || village].filter(Boolean).join(', ') || 'Lokalizacja'
  } catch { return 'Lokalizacja' }
}

function fmtMatchDate(iso) {
  const d = new Date(iso)
  const days = ['Ndz', 'Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob']
  const months = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru']
  return `${days[d.getDay()]}, ${d.getDate()} ${months[d.getMonth()]}`
}
function fmtMatchTime(iso) {
  const d = new Date(iso)
  return `${d.getHours().toString().padStart(2, '0')}:${d.getMinutes().toString().padStart(2, '0')}`
}
function fmtDist(km) {
  return km < 1 ? `${Math.round(km * 1000)} m` : `${km.toFixed(1)} km`
}

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
  // If user already has a stale club_members row (e.g. from a failed previous
  // attempt), the unique(user_id) constraint blocks the insert — clean it first
  const { data: existing } = await supabase.from('club_members')
    .select('club_id').eq('user_id', profile.id).maybeSingle()
  if (existing) {
    // Also remove the orphaned club if this user is its owner
    const { data: orphan } = await supabase.from('clubs')
      .select('id').eq('id', existing.club_id).eq('owner_id', profile.id).maybeSingle()
    if (orphan) await supabase.from('clubs').delete().eq('id', orphan.id)
    else await supabase.from('club_members').delete().eq('user_id', profile.id)
  }

  const { data: club, error } = await supabase.from('clubs')
    .insert({ name, abbr: abbr.toUpperCase(),
      country_code: country.code, country_name: country.name, country_flag: country.flag,
      owner_id: profile.id }).select().single()
  if (error) throw new Error(`clubs insert: ${error.message}`)

  const { error: memErr } = await supabase.from('club_members')
    .insert({ club_id: club.id, user_id: profile.id, position: 'PG' })
  if (memErr) throw new Error(`members insert: ${memErr.message}`)

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

async function apiSwap(clubId, pA, pB, idA, idB) {
  // Delete by user_id — reliable with unique(club_id, user_id) constraint
  const del = (uid) => supabase.from('club_members').delete()
    .eq('club_id', clubId).eq('user_id', uid)
  const ins = (uid, pos) => supabase.from('club_members').insert(
    { club_id: clubId, user_id: uid, position: pos })

  const { error: e1 } = await del(idA); if (e1) throw new Error(e1.message)
  if (idB) { const { error: e2 } = await del(idB); if (e2) throw new Error(e2.message) }
  const { error: e3 } = await ins(idA, pB); if (e3) throw new Error(e3.message)
  if (idB) { const { error: e4 } = await ins(idB, pA); if (e4) throw new Error(e4.message) }
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

// ── MATCH API ─────────────────────────────────────────────────────────────────
async function apiCreateMatch({ clubId, createdBy, mode, lat, lng, address, scheduledAt, note, creatorProfile }) {
  const { data, error } = await supabase
    .from('club_matches')
    .insert({ club_id: clubId, created_by: createdBy, mode, lat, lng, address, scheduled_at: scheduledAt, note: note || null })
    .select().single()
  if (error) throw error
  // Auto-join creator to home team slot 1
  await supabase.from('match_players').insert({ match_id: data.id, user_id: createdBy, team: 'home', slot: 1 })
  return {
    ...data,
    players: [{ match_id: data.id, user_id: createdBy, team: 'home', slot: 1, joined_at: new Date().toISOString(), profile: creatorProfile || null }],
  }
}

async function apiDeleteMatch(matchId) {
  const { error } = await supabase.from('club_matches').delete().eq('id', matchId)
  if (error) throw error
}

async function apiFetchMatches(userLat, userLng, radiusKm = 25) {
  const { data: matches, error } = await supabase
    .from('club_matches')
    .select('*')
    .neq('status', 'cancelled')
    .order('scheduled_at', { ascending: true })
  if (error) throw error

  const nearby = (matches || []).filter(m => haversineKm(userLat, userLng, m.lat, m.lng) <= radiusKm)
  if (!nearby.length) return []

  const ids = nearby.map(m => m.id)
  const { data: players } = await supabase.from('match_players').select('*').in('match_id', ids)

  const uids = [...new Set((players || []).map(p => p.user_id))]
  let profileRows = []
  if (uids.length) {
    const { data: pd } = await supabase.from('profiles').select('id,name').in('id', uids)
    profileRows = pd || []
  }
  const pm = Object.fromEntries(profileRows.map(p => [p.id, p]))

  // Fetch club names for home team label
  const clubIds = [...new Set(nearby.map(m => m.club_id))]
  const { data: clubRows } = await supabase.from('clubs').select('id,name,abbr,country_flag').in('id', clubIds)
  const cm = Object.fromEntries((clubRows || []).map(c => [c.id, c]))

  return nearby.map(m => ({
    ...m,
    _dist: haversineKm(userLat, userLng, m.lat, m.lng),
    _club: cm[m.club_id] || null,
    players: (players || []).filter(p => p.match_id === m.id).map(p => ({ ...p, profile: pm[p.user_id] || null })),
  }))
}

async function apiJoinMatch(matchId, userId, team, mode) {
  const n = MODE_SLOTS[mode]
  const { data: existing } = await supabase.from('match_players').select('slot').eq('match_id', matchId).eq('team', team)
  const taken = new Set((existing || []).map(p => p.slot))
  const slot = Array.from({ length: n }, (_, i) => i + 1).find(s => !taken.has(s))
  if (!slot) throw new Error('Drużyna jest już pełna')
  const { error } = await supabase.from('match_players').insert({ match_id: matchId, user_id: userId, team, slot })
  if (error) {
    if (error.code === '23505') throw new Error('Już jesteś w tym meczu')
    throw error
  }
  const { count } = await supabase.from('match_players').select('*', { count: 'exact', head: true }).eq('match_id', matchId)
  if ((count || 0) >= n * 2) {
    await supabase.from('club_matches').update({ status: 'full' }).eq('id', matchId)
  }
}

async function apiLeaveMatch(matchId, userId) {
  const { error } = await supabase.from('match_players').delete().eq('match_id', matchId).eq('user_id', userId)
  if (error) throw error
  await supabase.from('club_matches').update({ status: 'open' }).eq('id', matchId)
}

async function apiEnterScore(matchId, scoreHome, scoreAway) {
  const { error } = await supabase
    .from('club_matches')
    .update({ score_home: scoreHome, score_away: scoreAway, status: 'completed' })
    .eq('id', matchId)
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

// ── MATCH CARD ────────────────────────────────────────────────────────────────
function MatchCard({ match, dist, onPress }) {
  const slots = MODE_SLOTS[match.mode]
  const homePlayers = match.players.filter(p => p.team === 'home')
  const awayPlayers = match.players.filter(p => p.team === 'away')
  const color = MODE_COLOR[match.mode]
  const isPast = new Date(match.scheduled_at) < new Date()
  const homeTeamName = match._club?.abbr || match._club?.name || 'Klub'

  return (
    <motion.div whileTap={{ scale: 0.975 }} onClick={onPress}
      style={{
        borderRadius: 16, marginBottom: 10, cursor: 'pointer',
        background: C.surface, border: `1px solid rgba(255,255,255,0.05)`,
        borderLeft: `3px solid ${color}`,
        opacity: isPast && match.status !== 'completed' ? 0.65 : 1,
        overflow: 'hidden',
      }}>
      <div style={{ padding: '12px 14px' }}>
        {/* Top row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div style={{
              padding: '3px 9px', borderRadius: 6,
              background: `${color}18`, border: `1px solid ${color}40`,
              fontSize: 9.5, fontWeight: 800, letterSpacing: 1.5,
              color, textTransform: 'uppercase', fontFamily: 'var(--font-display)',
            }}>{match.mode}</div>
            {match.status === 'completed' && (
              <div style={{ padding: '2px 7px', borderRadius: 6, background: `${C.win}12`,
                border: `1px solid ${C.win}30`, fontSize: 9, fontWeight: 700, color: C.win, letterSpacing: 1 }}>
                ZAKOŃCZONY
              </div>
            )}
            {match.status === 'full' && (
              <div style={{ padding: '2px 7px', borderRadius: 6, background: `${C.loss}12`,
                border: `1px solid ${C.loss}30`, fontSize: 9, fontWeight: 700, color: C.loss, letterSpacing: 1 }}>
                PEŁNY
              </div>
            )}
          </div>
          <span style={{ fontSize: 10, fontWeight: 700, color: C.accent }}>{fmtDist(dist)}</span>
        </div>

        {/* Location row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5 }}>
          <svg width="9" height="12" viewBox="0 0 24 30" fill={C.sub}>
            <path d="M12 0C7.6 0 4 3.6 4 8c0 6 8 22 8 22s8-16 8-22c0-4.4-3.6-8-8-8zm0 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>
          </svg>
          <span style={{ fontSize: 10.5, color: C.text, flex: 1, overflow: 'hidden',
            textOverflow: 'ellipsis', whiteSpace: 'nowrap', lineHeight: 1 }}>
            {match.address || 'Lokalizacja na mapie'}
          </span>
        </div>

        {/* Date row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
          <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke={C.sub} strokeWidth="2" strokeLinecap="round">
            <rect x="3" y="4" width="18" height="18" rx="2"/>
            <line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/>
            <line x1="3" y1="10" x2="21" y2="10"/>
          </svg>
          <span style={{ fontSize: 10.5, color: C.sub }}>
            {fmtMatchDate(match.scheduled_at)} · {fmtMatchTime(match.scheduled_at)}
          </span>
        </div>

        {/* Slots row */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {/* Home team */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
              color: `${C.accent}90` }}>{homeTeamName}</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: slots }).map((_, i) => {
                const filled = homePlayers.some(p => p.slot === i + 1)
                return (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: filled ? C.accent : C.dim,
                    boxShadow: filled ? `0 0 5px ${C.accent}70` : 'none',
                    transition: 'all 0.2s',
                  }}/>
                )
              })}
            </div>
          </div>
          <span style={{ fontSize: 9, fontWeight: 800, color: C.dim, letterSpacing: 1, marginTop: 12 }}>VS</span>
          {/* Away team */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, alignItems: 'flex-start' }}>
            <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase',
              color: `${C.hoop}90` }}>Rywale</span>
            <div style={{ display: 'flex', gap: 4 }}>
              {Array.from({ length: slots }).map((_, i) => {
                const filled = awayPlayers.some(p => p.slot === i + 1)
                return (
                  <div key={i} style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: filled ? C.hoop : C.dim,
                    boxShadow: filled ? `0 0 5px ${C.hoop}70` : 'none',
                    transition: 'all 0.2s',
                  }}/>
                )
              })}
            </div>
          </div>
          <span style={{ fontSize: 9.5, fontWeight: 700, color: C.sub, marginLeft: 'auto', marginTop: 12 }}>
            {homePlayers.length + awayPlayers.length}/{slots * 2}
          </span>
        </div>

        {/* Score */}
        {match.status === 'completed' && match.score_home != null && (
          <div style={{ marginTop: 10, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14 }}>
            <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-display)',
              color: match.score_home > match.score_away ? C.win : C.text,
              textShadow: match.score_home > match.score_away ? `0 0 16px ${C.win}50` : 'none' }}>
              {match.score_home}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.dim }}>:</span>
            <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-display)',
              color: match.score_away > match.score_home ? C.win : C.text,
              textShadow: match.score_away > match.score_home ? `0 0 16px ${C.win}50` : 'none' }}>
              {match.score_away}
            </span>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── MAP PICKER ────────────────────────────────────────────────────────────────
function MapPicker({ center, onPin, existingPin }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  useEffect(() => {
    if (!document.querySelector('#leaflet-css')) {
      const link = document.createElement('link')
      link.id = 'leaflet-css'
      link.rel = 'stylesheet'
      link.href = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css'
      document.head.appendChild(link)
    }
    if (!elRef.current || mapRef.current) return

    const map = L.map(elRef.current, { zoomControl: false, attributionControl: false })
      .setView(center ? [center.lat, center.lng] : [52.0, 20.0], center ? 13 : 6)

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(map)
    L.control.zoom({ position: 'bottomright' }).addTo(map)

    const pinIcon = L.divIcon({
      html: `<div style="width:22px;height:22px;background:linear-gradient(135deg,#00CCFF,#0055AA);border-radius:50%;border:2.5px solid rgba(255,255,255,0.9);box-shadow:0 2px 14px rgba(0,180,255,0.75)"></div>`,
      className: '', iconSize: [22, 22], iconAnchor: [11, 11],
    })

    if (existingPin) {
      markerRef.current = L.marker([existingPin.lat, existingPin.lng], { icon: pinIcon }).addTo(map)
    }

    map.on('click', e => {
      const { lat, lng } = e.latlng
      if (markerRef.current) markerRef.current.setLatLng([lat, lng])
      else markerRef.current = L.marker([lat, lng], { icon: pinIcon }).addTo(map)
      onPin(lat, lng)
    })

    mapRef.current = map
    return () => { map.remove(); mapRef.current = null; markerRef.current = null }
  }, [])

  return <div ref={elRef} style={{ width: '100%', height: '100%' }}/>
}

// ── CREATE MATCH SHEET ────────────────────────────────────────────────────────
function CreateMatchSheet({ club, uid, onClose, onCreated }) {
  const [mode,       setMode]       = useState(null)
  const [pin,        setPin]        = useState(null)
  const [addr,       setAddr]       = useState('')
  const [date,       setDate]       = useState('')
  const [time,       setTime]       = useState('')
  const [note,       setNote]       = useState('')
  const [saving,     setSaving]     = useState(false)
  const [err,        setErr]        = useState(null)
  const [locLoading, setLocLoading] = useState(false)
  const [userLoc,    setUserLoc]    = useState(null)

  useEffect(() => {
    navigator.geolocation?.getCurrentPosition(
      p => setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => {}
    )
  }, [])

  async function handlePin(lat, lng) {
    setPin({ lat, lng })
    setAddr('')
    const a = await reverseGeocode(lat, lng)
    setAddr(a)
  }

  async function useMyLocation() {
    setLocLoading(true)
    navigator.geolocation?.getCurrentPosition(
      async p => {
        const loc = { lat: p.coords.latitude, lng: p.coords.longitude }
        setPin(loc)
        const a = await reverseGeocode(loc.lat, loc.lng)
        setAddr(a)
        setLocLoading(false)
      },
      () => setLocLoading(false)
    )
  }

  const canCreate = !!(mode && pin && date && time)

  async function handleCreate() {
    if (!canCreate || saving) return
    setSaving(true); setErr(null)
    try {
      const match = await apiCreateMatch({
        clubId: club.id, createdBy: uid, mode,
        lat: pin.lat, lng: pin.lng, address: addr || null,
        scheduledAt: new Date(`${date}T${time}`).toISOString(),
        note: note.trim() || null,
      })
      onCreated(match)
      onClose()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(4,8,15,0.88)', backdropFilter: 'blur(10px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        style={{ marginTop: 'auto', width: '100%', maxWidth: 430,
          background: C.bg, borderRadius: '24px 24px 0 0',
          height: '96%', display: 'flex', flexDirection: 'column',
          border: `1px solid ${C.line}`, borderBottom: 'none',
          boxShadow: `0 -16px 60px rgba(0,200,255,0.10)` }}>

        {/* Header */}
        <div style={{ position: 'relative', padding: '16px 20px 14px',
          borderBottom: `1px solid ${C.dim}30`, display: 'flex', alignItems: 'center' }}>
          <div style={{ position: 'absolute', top: 8, left: '50%', transform: 'translateX(-50%)',
            width: 36, height: 4, borderRadius: 2, background: C.dim }}/>
          <p style={{ flex: 1, margin: '6px 0 0', fontSize: 13, fontWeight: 900, letterSpacing: 2.5,
            textTransform: 'uppercase', color: C.text, fontFamily: 'var(--font-display)' }}>
            Nowy mecz
          </p>
          <motion.button whileTap={{ scale: 0.88 }} onClick={onClose}
            style={{ width: 32, height: 32, borderRadius: '50%', border: 'none',
              background: `${C.dim}70`, color: C.sub, cursor: 'pointer',
              display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
            </svg>
          </motion.button>
        </div>

        {/* Scrollable body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '22px 20px 48px' }}>

          {/* Mode selector */}
          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase',
            color: C.dim, margin: '0 0 10px' }}>Tryb gry</p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
            {['2v2', '3v3', '5v5'].map(m => {
              const col = MODE_COLOR[m], active = mode === m
              return (
                <motion.button key={m} whileTap={{ scale: 0.93 }} onClick={() => setMode(m)}
                  style={{ flex: 1, padding: '14px 0', border: 'none', borderRadius: 14, cursor: 'pointer',
                    background: active ? `${col}18` : C.surface,
                    outline: `1.5px solid ${active ? col : `${C.dim}80`}`,
                    boxShadow: active ? `0 4px 18px ${col}28` : 'none', transition: 'all 0.18s' }}>
                  <p style={{ fontSize: 18, fontWeight: 900, letterSpacing: -0.5,
                    color: active ? col : C.sub, margin: 0, fontFamily: 'var(--font-display)' }}>{m}</p>
                  <p style={{ fontSize: 8.5, fontWeight: 700, letterSpacing: 1,
                    color: active ? `${col}90` : C.dim, margin: '3px 0 0', textTransform: 'uppercase' }}>
                    {MODE_LABEL[m]}
                  </p>
                </motion.button>
              )
            })}
          </div>

          {/* Map */}
          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase',
            color: C.dim, margin: '0 0 10px' }}>Lokalizacja</p>
          <div style={{ height: 224, borderRadius: 16, overflow: 'hidden', marginBottom: 10,
            border: `1.5px solid ${pin ? `${C.accentLo}60` : `${C.dim}40`}`, position: 'relative' }}>
            <MapPicker center={userLoc} onPin={handlePin} existingPin={pin}/>
            {!pin && (
              <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center',
                justifyContent: 'center', pointerEvents: 'none', background: 'rgba(4,8,15,0.35)', zIndex: 1000 }}>
                <div style={{ padding: '8px 16px', borderRadius: 10, background: 'rgba(8,17,30,0.85)',
                  border: `1px solid ${C.dim}60` }}>
                  <p style={{ fontSize: 11, color: C.sub, fontWeight: 600, margin: 0 }}>Stuknij na mapie aby wybrać miejsce</p>
                </div>
              </div>
            )}
          </div>

          {/* Address + my location */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 26 }}>
            <p style={{ flex: 1, fontSize: 10.5, margin: 0,
              color: addr ? C.text : C.dim }}>
              {addr ? `📍 ${addr}` : 'Wybierz punkt na mapie'}
            </p>
            <motion.button whileTap={{ scale: 0.93 }} onClick={useMyLocation} disabled={locLoading}
              style={{ padding: '7px 13px', borderRadius: 10, border: 'none', cursor: 'pointer',
                background: `${C.accent}15`, outline: `1px solid ${C.accent}40`,
                color: C.accent, fontSize: 10, fontWeight: 700, whiteSpace: 'nowrap', opacity: locLoading ? 0.5 : 1 }}>
              {locLoading ? '…' : '📍 Moja lokalizacja'}
            </motion.button>
          </div>

          {/* Date + Time */}
          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase',
            color: C.dim, margin: '0 0 10px' }}>Data i godzina</p>
          <div style={{ display: 'flex', gap: 10, marginBottom: 26 }}>
            {[
              { type: 'date', val: date, set: setDate },
              { type: 'time', val: time, set: setTime },
            ].map(({ type, val, set }) => (
              <input key={type} type={type} value={val}
                onChange={e => set(e.target.value)}
                min={type === 'date' ? new Date().toISOString().split('T')[0] : undefined}
                style={{ flex: 1, padding: '12px 10px', borderRadius: 12,
                  background: C.surface, color: C.text, border: 'none',
                  outline: `1px solid ${val ? `${C.accentLo}60` : `${C.dim}60`}`,
                  fontSize: 13, fontWeight: 700, colorScheme: 'dark', boxSizing: 'border-box' }}
              />
            ))}
          </div>

          {/* Note */}
          <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase',
            color: C.dim, margin: '0 0 10px' }}>
            Notatka <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0 }}>(opcjonalnie)</span>
          </p>
          <input type="text" value={note} onChange={e => setNote(e.target.value)} maxLength={120}
            placeholder="np. potrzeba 10 graczy, hala na zewnątrz…"
            style={{ width: '100%', padding: '12px', borderRadius: 12, border: 'none', boxSizing: 'border-box',
              background: C.surface, color: C.text, outline: `1px solid ${C.dim}60`,
              fontSize: 12, marginBottom: 28 }}
          />

          {err && <p style={{ fontSize: 11, color: C.loss, textAlign: 'center', marginBottom: 12 }}>{err}</p>}

          {/* Create button */}
          <motion.button whileTap={{ scale: 0.97 }} onClick={handleCreate}
            disabled={!canCreate || saving}
            style={{ width: '100%', padding: '15px', border: 'none', borderRadius: 16,
              background: canCreate ? `linear-gradient(135deg, ${C.accent}, ${C.accentLo})` : C.dim,
              color: canCreate ? '#000' : C.sub,
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 12, letterSpacing: 2.5, textTransform: 'uppercase',
              cursor: canCreate && !saving ? 'pointer' : 'default',
              boxShadow: canCreate ? `0 6px 28px ${C.accentLo}55` : 'none',
              transition: 'all 0.2s', opacity: saving ? 0.7 : 1 }}>
            {saving ? 'Tworzenie…' : 'Stwórz mecz'}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── MATCH DETAIL SHEET ────────────────────────────────────────────────────────
function MatchDetailSheet({ match, uid, userClubId, onClose, onJoined, onLeft, onDeleted }) {
  const [local,        setLocal]        = useState(match)
  const [joining,      setJoining]      = useState(false)
  const [leaving,      setLeaving]      = useState(false)
  const [confirmLeave, setConfirmLeave] = useState(false)
  const [err,          setErr]          = useState(null)

  const myPlayer = local.players.find(p => p.user_id === uid)
  const n = MODE_SLOTS[local.mode]
  const color = MODE_COLOR[local.mode]
  const isFull = local.status === 'full' || local.status === 'completed'
  const isPast = new Date(local.scheduled_at) < new Date()
  // Drużyna A (home) tylko dla członków klubu tworzącego mecz
  const isHomeClubMember = userClubId === local.club_id
  const homeTeamName = local._club?.name || 'Drużyna A'
  const isCreator = local.created_by === uid

  function getTeamSlots(team) {
    return Array.from({ length: n }, (_, i) => {
      const p = local.players.find(pl => pl.team === team && pl.slot === i + 1)
      return { slot: i + 1, player: p || null }
    })
  }

  function SlotDiamond({ team, player }) {
    const tColor = team === 'home' ? C.accent : C.hoop
    const filled = !!player
    const isMe = player?.user_id === uid
    const initial = player?.profile?.name?.[0]?.toUpperCase() || '?'
    return (
      <div style={{
        width: 46, height: 46,
        clipPath: 'polygon(50% 0%,100% 50%,50% 100%,0% 50%)',
        background: filled
          ? isMe ? `linear-gradient(135deg,${tColor},${tColor}99)` : `${tColor}28`
          : `${C.dim}50`,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {filled
          ? <span style={{ fontSize: 15, fontWeight: 900, fontFamily: 'var(--font-display)',
              color: isMe ? '#000' : tColor, lineHeight: 1 }}>{initial}</span>
          : <span style={{ fontSize: 18, color: `${tColor}40`, lineHeight: 1 }}>+</span>
        }
      </div>
    )
  }

  async function handleJoin(team) {
    if (myPlayer || joining || isFull) return
    setJoining(true); setErr(null)
    try {
      await apiJoinMatch(local.id, uid, team, local.mode)
      const { data } = await supabase.from('match_players').select('*').eq('match_id', local.id)
      const updated = { ...local, players: data || [] }
      if ((data || []).length >= n * 2) updated.status = 'full'
      setLocal(updated); onJoined?.(updated)
    } catch (e) { setErr(e.message) }
    finally { setJoining(false) }
  }

  function requestLeave() {
    if (!myPlayer || leaving) return
    // Jeśli to ostatni gracz i twórca → ostrzeż o usunięciu
    const isLast = local.players.length === 1
    if (isLast && isCreator) { setConfirmLeave(true); return }
    doLeave()
  }

  async function doLeave(deleteMatch = false) {
    setLeaving(true); setErr(null); setConfirmLeave(false)
    try {
      if (deleteMatch && isCreator) {
        await apiDeleteMatch(local.id)
        onDeleted?.(local.id)
        onClose()
        return
      }
      await apiLeaveMatch(local.id, uid)
      const updated = { ...local, status: 'open', players: local.players.filter(p => p.user_id !== uid) }
      setLocal(updated); onLeft?.(updated)
    } catch (e) { setErr(e.message) }
    finally { setLeaving(false) }
  }

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 200,
        background: 'rgba(4,8,15,0.82)', backdropFilter: 'blur(8px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center' }}
      onClick={e => { if (e.target === e.currentTarget) onClose() }}>

      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', stiffness: 300, damping: 32 }}
        style={{ marginTop: 'auto', width: '100%', maxWidth: 430,
          background: C.bg, borderRadius: '24px 24px 0 0',
          border: `1px solid ${C.line}`, borderBottom: 'none',
          maxHeight: '82vh', overflowY: 'auto',
          boxShadow: `0 -14px 52px rgba(0,200,255,0.09)` }}>

        {/* Handle */}
        <div style={{ paddingTop: 12, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 36, height: 4, borderRadius: 2, background: C.dim }}/>
        </div>

        <div style={{ padding: '14px 20px 36px' }}>
          {/* Mode + date */}
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 16 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ padding: '5px 13px', borderRadius: 8, background: `${color}18`,
                border: `1px solid ${color}40`, fontSize: 11, fontWeight: 800,
                color, letterSpacing: 1.5, fontFamily: 'var(--font-display)', textTransform: 'uppercase' }}>
                {local.mode}
              </div>
              {local.status === 'full' && (
                <span style={{ fontSize: 9, fontWeight: 700, color: C.loss, letterSpacing: 1 }}>PEŁNY</span>
              )}
              {isPast && local.status !== 'completed' && (
                <span style={{ fontSize: 9, fontWeight: 700, color: C.dim, letterSpacing: 1 }}>ZAKOŃCZONY</span>
              )}
            </div>
            <div style={{ textAlign: 'right' }}>
              <p style={{ fontSize: 11, fontWeight: 700, color: C.text, margin: 0 }}>
                {fmtMatchDate(local.scheduled_at)}
              </p>
              <p style={{ fontSize: 10, color: C.sub, margin: '2px 0 0' }}>
                {fmtMatchTime(local.scheduled_at)}
              </p>
            </div>
          </div>

          {/* Location */}
          {local.address && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 14,
              padding: '10px 14px', borderRadius: 12, background: C.surface }}>
              <svg width="10" height="13" viewBox="0 0 24 30" fill={C.accent}>
                <path d="M12 0C7.6 0 4 3.6 4 8c0 6 8 22 8 22s8-16 8-22c0-4.4-3.6-8-8-8zm0 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>
              </svg>
              <span style={{ fontSize: 11, color: C.text }}>{local.address}</span>
            </div>
          )}

          {/* Note */}
          {local.note && (
            <div style={{ padding: '9px 13px', borderRadius: 11, background: C.surface, marginBottom: 14 }}>
              <p style={{ fontSize: 10.5, color: C.sub, margin: 0 }}>💬 {local.note}</p>
            </div>
          )}

          {/* Result */}
          {local.status === 'completed' && local.score_home != null && (
            <div style={{ marginBottom: 18, padding: '14px', borderRadius: 14, background: C.surface,
              display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 18 }}>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                  color: `${C.accent}80`, margin: '0 0 4px' }}>Drużyna A</p>
                <span style={{ fontSize: 38, fontWeight: 900, fontFamily: 'var(--font-display)', lineHeight: 1,
                  color: local.score_home > local.score_away ? C.win : C.text,
                  textShadow: local.score_home > local.score_away ? `0 0 20px ${C.win}50` : 'none' }}>
                  {local.score_home}
                </span>
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: C.dim }}>:</span>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                  color: `${C.hoop}80`, margin: '0 0 4px' }}>Drużyna B</p>
                <span style={{ fontSize: 38, fontWeight: 900, fontFamily: 'var(--font-display)', lineHeight: 1,
                  color: local.score_away > local.score_home ? C.win : C.text,
                  textShadow: local.score_away > local.score_home ? `0 0 20px ${C.win}50` : 'none' }}>
                  {local.score_away}
                </span>
              </div>
            </div>
          )}

          {/* Teams grid */}
          <div style={{ display: 'flex', gap: 14, marginBottom: 20 }}>
            {['home', 'away'].map(team => {
              const tColor = team === 'home' ? C.accent : C.hoop
              return (
                <div key={team} style={{ flex: 1 }}>
                  <p style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
                    color: tColor, margin: '0 0 12px', textAlign: 'center' }}>
                    {team === 'home' ? homeTeamName : 'Rywale'}
                  </p>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                    {getTeamSlots(team).map(({ slot, player }) => (
                      <SlotDiamond key={slot} team={team} player={player}/>
                    ))}
                  </div>
                </div>
              )
            })}
          </div>

          {err && <p style={{ fontSize: 11, color: C.loss, textAlign: 'center', marginBottom: 12 }}>{err}</p>}

          {/* Join buttons */}
          {!myPlayer && !isFull && !isPast && (
            <div style={{ display: 'flex', gap: 10 }}>
              {['home', 'away'].map(team => {
                const tColor = team === 'home' ? C.accent : C.hoop
                const teamFull = local.players.filter(p => p.team === team).length >= n
                // Drużyna A (home) — tylko dla członków klubu tworzącego mecz
                const locked = team === 'home' && !isHomeClubMember
                const disabled = joining || teamFull || locked
                return (
                  <motion.button key={team} whileTap={!disabled ? { scale: 0.96 } : {}}
                    onClick={() => !disabled && handleJoin(team)}
                    disabled={disabled}
                    style={{ flex: 1, padding: '13px', border: 'none', borderRadius: 14,
                      cursor: disabled ? 'default' : 'pointer',
                      background: locked ? `${C.dim}20` : teamFull ? `${C.dim}30` : `${tColor}18`,
                      outline: `1.5px solid ${locked || teamFull ? C.dim : tColor}`,
                      color: locked ? C.dim : teamFull ? C.sub : tColor,
                      fontSize: 11, fontWeight: 800, letterSpacing: 1,
                      fontFamily: 'var(--font-display)', transition: 'all 0.18s',
                      opacity: joining ? 0.7 : 1 }}>
                    {locked ? '🔒 Tylko klub' : teamFull ? 'Pełna' : joining ? '…' : `Dołącz — ${team === 'home' ? homeTeamName : 'Rywale'}`}
                  </motion.button>
                )
              })}
            </div>
          )}

          {/* Confirm leave + delete */}
          <AnimatePresence>
            {confirmLeave && (
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
                style={{ marginBottom: 12, padding: '16px', borderRadius: 16,
                  background: `${C.loss}0E`, border: `1px solid ${C.loss}40` }}>
                <p style={{ fontSize: 12, fontWeight: 700, color: C.text, margin: '0 0 6px', textAlign: 'center' }}>
                  Jesteś ostatnią osobą
                </p>
                <p style={{ fontSize: 10.5, color: C.sub, margin: '0 0 14px', textAlign: 'center', lineHeight: 1.5 }}>
                  Jeśli opuścisz, mecz zostanie usunięty. Na pewno?
                </p>
                <div style={{ display: 'flex', gap: 8 }}>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => setConfirmLeave(false)}
                    style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: C.surface, color: C.sub, fontSize: 11, fontWeight: 700 }}>
                    Anuluj
                  </motion.button>
                  <motion.button whileTap={{ scale: 0.96 }} onClick={() => doLeave(true)}
                    style={{ flex: 1, padding: '11px', borderRadius: 12, border: 'none', cursor: 'pointer',
                      background: `${C.loss}18`, outline: `1px solid ${C.loss}50`,
                      color: C.loss, fontSize: 11, fontWeight: 800 }}>
                    Usuń mecz
                  </motion.button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {myPlayer && (
            <div style={{ display: 'flex', gap: 10 }}>
              <div style={{ flex: 1, padding: '13px', borderRadius: 14, textAlign: 'center',
                background: `${myPlayer.team === 'home' ? C.accent : C.hoop}12`,
                border: `1px solid ${myPlayer.team === 'home' ? C.accent : C.hoop}35` }}>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 800,
                  color: myPlayer.team === 'home' ? C.accent : C.hoop }}>
                  {myPlayer.team === 'home' ? homeTeamName : 'Rywale'} ✓
                </p>
              </div>
              {!isPast && (
                <motion.button whileTap={{ scale: 0.95 }} onClick={requestLeave} disabled={leaving}
                  style={{ padding: '13px 18px', borderRadius: 14, border: 'none', cursor: 'pointer',
                    background: `${C.loss}12`, outline: `1px solid ${C.loss}35`,
                    color: C.loss, fontSize: 11, fontWeight: 700, opacity: leaving ? 0.7 : 1 }}>
                  {leaving ? '…' : 'Opuść'}
                </motion.button>
              )}
            </div>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── RESULT SHEET ──────────────────────────────────────────────────────────────
function ResultSheet({ match, onClose, onSaved }) {
  const [scoreHome, setScoreHome] = useState('')
  const [scoreAway, setScoreAway] = useState('')
  const [saving, setSaving]       = useState(false)
  const [err, setErr]             = useState(null)

  const h = parseInt(scoreHome)
  const a = parseInt(scoreAway)
  const canSave = !isNaN(h) && !isNaN(a) && h >= 0 && a >= 0
  const homeWins = canSave && h > a
  const awayWins = canSave && a > h

  async function handleSave() {
    if (!canSave || saving) return
    setSaving(true); setErr(null)
    try {
      await apiEnterScore(match.id, h, a)
      onSaved?.(h, a)
      onClose()
    } catch (e) { setErr(e.message) }
    finally { setSaving(false) }
  }

  return createPortal(
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{ position: 'fixed', inset: 0, zIndex: 300,
        background: 'rgba(4,8,15,0.95)', backdropFilter: 'blur(20px)',
        display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>

      <motion.div initial={{ scale: 0.88, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.88, opacity: 0 }}
        style={{ width: '100%', maxWidth: 360, background: C.surface, borderRadius: 24,
          padding: '32px 24px', border: `1px solid ${C.line}`,
          boxShadow: `0 20px 70px rgba(0,200,255,0.12)` }}>

        <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 3.5, textTransform: 'uppercase',
          color: C.dim, textAlign: 'center', margin: '0 0 4px' }}>Wynik meczu</p>
        <p style={{ fontSize: 12, fontWeight: 600, color: C.sub, textAlign: 'center', margin: '0 0 28px' }}>
          {fmtMatchDate(match.scheduled_at)} · {fmtMatchTime(match.scheduled_at)}
        </p>

        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'center', gap: 12, marginBottom: 28 }}>
          {[
            { val: scoreHome, set: setScoreHome, label: 'Drużyna A', col: C.accent, wins: homeWins },
            { val: scoreAway, set: setScoreAway, label: 'Drużyna B', col: C.hoop,   wins: awayWins },
          ].map(({ val, set, label, col, wins }, idx) => (
            <div key={idx} style={{ flex: 1, textAlign: 'center' }}>
              <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                color: `${col}80`, margin: '0 0 8px' }}>{label}</p>
              <input type="number" min="0" max="999" value={val}
                onChange={e => set(e.target.value)} placeholder="0"
                style={{ width: '100%', padding: '10px 0', textAlign: 'center',
                  fontSize: 48, fontWeight: 900, letterSpacing: -2, lineHeight: 1,
                  background: wins ? `${col}14` : C.bg,
                  border: 'none', outline: `2px solid ${wins ? col : C.dim}`,
                  borderRadius: 16, color: wins ? col : C.text,
                  fontFamily: 'var(--font-display)', boxSizing: 'border-box',
                  textShadow: wins ? `0 0 24px ${col}60` : 'none', transition: 'all 0.2s',
                  colorScheme: 'dark' }}
              />
            </div>
          ))}
          <span style={{ fontSize: 30, fontWeight: 900, color: C.dim, paddingBottom: 10 }}>:</span>
        </div>

        {err && <p style={{ fontSize: 11, color: C.loss, textAlign: 'center', marginBottom: 12 }}>{err}</p>}

        <motion.button whileTap={{ scale: 0.97 }} onClick={handleSave} disabled={!canSave || saving}
          style={{ width: '100%', padding: '15px', border: 'none', borderRadius: 14,
            background: canSave ? `linear-gradient(135deg, ${C.win}, #009955)` : C.dim,
            color: canSave ? '#000' : C.sub,
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 12,
            letterSpacing: 2.5, textTransform: 'uppercase',
            cursor: canSave && !saving ? 'pointer' : 'default',
            boxShadow: canSave ? '0 6px 24px rgba(0,200,130,0.32)' : 'none',
            transition: 'all 0.2s', opacity: saving ? 0.7 : 1, marginBottom: 10 }}>
          {saving ? 'Zapisywanie…' : 'Zatwierdź wynik'}
        </motion.button>

        <motion.button whileTap={{ scale: 0.97 }} onClick={onClose}
          style={{ width: '100%', padding: '12px', border: 'none', borderRadius: 14,
            background: 'transparent', color: C.sub, fontSize: 11, fontWeight: 600, cursor: 'pointer' }}>
          Wpisz później
        </motion.button>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── MATCHES PANEL ─────────────────────────────────────────────────────────────
function MatchesPanel({ club, uid, isActive }) {
  const [locState, setLocState] = useState('idle')
  const [userLoc,  setUserLoc]  = useState(null)
  const [matches,  setMatches]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [sheet,    setSheet]    = useState(null)
  const [active,   setActive]   = useState(null)
  const [pending,  setPending]  = useState(null)
  const RADIUS = 25

  const isMember = Object.values(club.members).some(m => m?.id === uid)

  useEffect(() => {
    if (!navigator.geolocation) { setLocState('denied'); return }
    setLocState('requesting')
    navigator.geolocation.getCurrentPosition(
      pos => { setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude }); setLocState('granted') },
      () => setLocState('denied')
    )
  }, [])

  useEffect(() => {
    if (locState === 'granted' && userLoc) loadMatches()
  }, [locState, userLoc])

  async function loadMatches() {
    setLoading(true)
    try {
      const data = await apiFetchMatches(userLoc.lat, userLoc.lng, RADIUS)
      setMatches(data)
      checkPendingResult(data)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function checkPendingResult(list) {
    const now = new Date()
    for (const m of list) {
      if (m.status === 'completed' || m.status === 'cancelled') continue
      if (new Date(m.scheduled_at) > now) continue
      const mySlot = m.players.find(p => p.user_id === uid)
      if (!mySlot) continue
      const home = m.players.filter(p => p.team === 'home').sort((a, b) => a.slot - b.slot)
      const away = m.players.filter(p => p.team === 'away').sort((a, b) => a.slot - b.slot)
      const ownerInHome = home.some(p => p.user_id === club.ownerId)
      const homeLeadId = (ownerInHome ? home.find(p => p.user_id === club.ownerId) : home[0])?.user_id
      const awayLeadId = away[0]?.user_id
      if (uid === homeLeadId || uid === awayLeadId) { setPending(m); setSheet('result'); break }
    }
  }

  function updateMatch(updated) {
    setMatches(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
  }

  const upcoming = matches.filter(m => m.status !== 'completed' && new Date(m.scheduled_at) > new Date())
  const past     = matches.filter(m => m.status === 'completed' || new Date(m.scheduled_at) <= new Date())

  return (
    <div style={{ padding: '0 16px 110px' }}>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '4px 0 16px' }}>
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.8, textTransform: 'uppercase',
          color: C.dim, margin: 0 }}>Mecze w pobliżu</p>
        <div style={{ padding: '3px 10px', borderRadius: 8,
          background: `${C.accent}10`, border: `1px solid ${C.accent}22` }}>
          <span style={{ fontSize: 9, fontWeight: 700, color: C.accent }}>{RADIUS} km</span>
        </div>
      </div>

      {/* Requesting */}
      {locState === 'requesting' && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 60 }}>
          <div className="spinner"/>
        </div>
      )}

      {/* Denied */}
      {locState === 'denied' && (
        <div style={{ padding: '36px 20px', borderRadius: 20, textAlign: 'center',
          background: C.surface, border: `1px solid ${C.dim}40` }}>
          <div style={{ fontSize: 38, marginBottom: 14 }}>🗺️</div>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>Lokalizacja wyłączona</p>
          <p style={{ fontSize: 10.5, color: C.sub, margin: '0 0 22px', lineHeight: 1.6 }}>
            Zezwól na dostęp do lokalizacji,{'\n'}aby zobaczyć mecze w pobliżu
          </p>
          <motion.button whileTap={{ scale: 0.95 }}
            onClick={() => {
              setLocState('requesting')
              navigator.geolocation?.getCurrentPosition(
                p => { setUserLoc({ lat: p.coords.latitude, lng: p.coords.longitude }); setLocState('granted') },
                () => setLocState('denied')
              )
            }}
            style={{ padding: '11px 26px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: `${C.accent}18`, outline: `1px solid ${C.accent}40`,
              color: C.accent, fontSize: 11, fontWeight: 700 }}>
            Włącz lokalizację
          </motion.button>
        </div>
      )}

      {/* Loading */}
      {loading && locState === 'granted' && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
          <div className="spinner"/>
        </div>
      )}

      {/* Match list */}
      {!loading && locState === 'granted' && (
        <>
          {upcoming.length > 0 && (
            <>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase',
                color: C.dim, margin: '0 0 10px 2px' }}>Nadchodzące</p>
              {upcoming.map(m => (
                <MatchCard key={m.id} match={m} dist={m._dist}
                  onPress={() => { setActive(m); setSheet('detail') }}/>
              ))}
            </>
          )}
          {past.length > 0 && (
            <>
              <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase',
                color: C.dim, margin: '16px 0 10px 2px' }}>Ostatnie</p>
              {past.map(m => (
                <MatchCard key={m.id} match={m} dist={m._dist}
                  onPress={() => { setActive(m); setSheet('detail') }}/>
              ))}
            </>
          )}
          {upcoming.length === 0 && past.length === 0 && (
            <div style={{ padding: '44px 20px', borderRadius: 20, textAlign: 'center',
              background: C.surface, border: `1px solid ${C.dim}40` }}>
              <div style={{ fontSize: 40, marginBottom: 14 }}>🏀</div>
              <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 6px' }}>
                Brak meczów w pobliżu
              </p>
              <p style={{ fontSize: 10.5, color: C.sub, lineHeight: 1.6, margin: 0 }}>
                Brak zaplanowanych meczów{'\n'}w zasięgu {RADIUS} km
              </p>
            </div>
          )}
        </>
      )}

      {/* Create match button — inline at bottom, safe for all screen sizes */}
      {isMember && locState === 'granted' && (
        <motion.button whileTap={{ scale: 0.97 }} onClick={() => setSheet('create')}
          style={{ width: '100%', marginTop: 16, padding: '14px', border: 'none', borderRadius: 16,
            cursor: 'pointer', background: `linear-gradient(135deg, ${C.accent}, ${C.accentLo})`,
            color: '#000', fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
            boxShadow: `0 6px 28px ${C.accentLo}55`,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="3" strokeLinecap="round">
            <line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/>
          </svg>
          Umów mecz
        </motion.button>
      )}

      <AnimatePresence>
        {sheet === 'create' && (
          <CreateMatchSheet key="create" club={club} uid={uid}
            onClose={() => setSheet(null)}
            onCreated={m => setMatches(prev => [{ ...m, _dist: haversineKm(userLoc.lat, userLoc.lng, m.lat, m.lng) }, ...prev])}/>
        )}
        {sheet === 'detail' && active && (
          <MatchDetailSheet key="detail" match={active} uid={uid}
            userClubId={club.id}
            onClose={() => { setSheet(null); setActive(null) }}
            onJoined={updateMatch} onLeft={updateMatch}
            onDeleted={id => { setMatches(prev => prev.filter(m => m.id !== id)); setSheet(null); setActive(null) }}/>
        )}
        {sheet === 'result' && pending && (
          <ResultSheet key="result" match={pending}
            onClose={() => { setSheet(null); setPending(null) }}
            onSaved={(h, a) => updateMatch({ ...pending, status: 'completed', score_home: h, score_away: a })}/>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── PANEL DOTS ────────────────────────────────────────────────────────────────
function PanelDots({ active, onChange }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: 5, paddingBottom: 10 }}>
      {[0, 1, 2].map(i => (
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
  const [panel,    setPanel]    = useState(1) // 0=Mecze 1=Boisko(default) 2=Statystyki
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
    const mA = club.members[pA]
    const mB = club.members[pB]
    try {
      await apiSwap(club.id, pA, pB, mA.id, mB?.id ?? null)
    } catch (e) {
      setSwapError(e.message)
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
    if (dx < -50 && panel < 2) setPanel(p => p + 1)
    if (dx >  50 && panel > 0) setPanel(p => p - 1)
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
          animate={{ x: panel === 0 ? '0%' : panel === 1 ? '-33.333%' : '-66.666%' }}
          transition={{ type: 'spring', stiffness: 320, damping: 32 }}
          style={{ display: 'flex', width: '300%', height: '100%' }}>

          {/* Panel 0 — Mecze */}
          <div style={{ width: '33.333%', height: '100%', overflowY: 'auto' }}>
            <MatchesPanel club={club} uid={uid} isActive={panel === 0}/>
          </div>

          {/* Panel 1 — Boisko */}
          <div style={{ width: '33.333%', height: '100%', overflowY: 'auto' }}>
            <CourtPanel
              club={club} uid={uid} onUpdate={onUpdate}
              onTokenTap={handleTokenTap}
              swapMode={swapMode} setSwapMode={v => { setSwapMode(v); setSwapSrc(null); setSwapError(null) }}
              swapSrc={swapSrc} swapping={swapping} swapError={swapError}/>
          </div>

          {/* Panel 2 — Statystyki */}
          <div style={{ width: '33.333%', height: '100%', overflowY: 'auto' }}>
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
    catch (e) { setErr(e?.message ?? JSON.stringify(e)); setSaving(false) }
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
