import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence, useDragControls, useMotionValue, useTransform, animate } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { creditRestDayStreak } from '../lib/streak'
import { checkTeamWinAchievements } from '../lib/achievements'
import { calendarWeekNumber } from '../lib/week'
import { shareMatchCard, doShare } from '../lib/shareCard'
import HexAvatar, { HexFrameOnly } from '../components/ui/HexAvatar'
import { ARENAS as ARENA_THEMES } from '../lib/arenas'
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
  PG: { x: '22%', y: '15%' },
  SG: { x: '78%', y: '15%' },
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
const MODE_GAP   = { '2v2': 45, '3v3': 75, '5v5': 75 }  // min between match start times

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

// `flagFile` → matches /public/flags/<name>.png (English country name, lowercase, hyphenated)
const COUNTRIES = [
  { code: 'PL', name: 'Polska',          flag: '🇵🇱', flagFile: 'poland'         },
  { code: 'US', name: 'USA',             flag: '🇺🇸', flagFile: 'united-states'  },
  { code: 'DE', name: 'Niemcy',          flag: '🇩🇪', flagFile: 'germany'        },
  { code: 'FR', name: 'Francja',         flag: '🇫🇷', flagFile: 'france'         },
  { code: 'ES', name: 'Hiszpania',       flag: '🇪🇸', flagFile: 'spain'          },
  { code: 'IT', name: 'Włochy',          flag: '🇮🇹', flagFile: 'italy'          },
  { code: 'GB', name: 'Wielka Brytania', flag: '🇬🇧', flagFile: 'united-kingdom' },
  { code: 'PT', name: 'Portugalia',      flag: '🇵🇹', flagFile: 'portugal'       },
  { code: 'BR', name: 'Brazylia',        flag: '🇧🇷', flagFile: 'brazil'         },
  { code: 'NG', name: 'Nigeria',         flag: '🇳🇬', flagFile: 'nigeria'        },
  { code: 'LT', name: 'Litwa',           flag: '🇱🇹', flagFile: 'lithuania'      },
  { code: 'RS', name: 'Serbia',          flag: '🇷🇸', flagFile: 'serbia'         },
  { code: 'HR', name: 'Chorwacja',       flag: '🇭🇷', flagFile: 'croatia'        },
  { code: 'GR', name: 'Grecja',          flag: '🇬🇷', flagFile: 'greece'         },
  { code: 'AU', name: 'Australia',       flag: '🇦🇺', flagFile: 'australia'      },
  { code: 'CA', name: 'Kanada',          flag: '🇨🇦', flagFile: 'canada'         },
]

// ── ARENA / XP LADDER ─────────────────────────────────────────────────────────
// ── ARENAS ────────────────────────────────────────────────────────────────────
// Zsynchronizowane z ARENA_META w HomePage.jsx.
// "Sól tej Ziemi" ZAWSZE ostatnia — nowe areny wstawiaj przed nią.
const ARENAS = [
  { level: 0, name: 'Playground',    threshold: 0 },
  { level: 1, name: 'Street Court',  threshold: 500 },
  { level: 2, name: 'Sól tej Ziemi', threshold: 1500 },
]

function arenaProgress(xp = 0, level = 0) {
  const current = ARENAS[level] ?? ARENAS[0]
  const next = ARENAS[level + 1] ?? null
  if (!next) return { current, next: null, pct: 1 }
  const span = next.threshold - current.threshold
  const pct = span > 0 ? Math.min(1, Math.max(0, (xp - current.threshold) / span)) : 1
  return { current, next, pct }
}

// Per-arena color theme — drives the glow / accents / progress bar / buttons
// shown on the player's profile card, sourced from lib/arenas.js (badge gradient
// + glow color, the same palette used by Droga Aren).
function getArenaTheme(level = 0) {
  const a = ARENA_THEMES[level] ?? ARENA_THEMES[0]
  const [hi, mid, lo] = a.badge || ['#AABBD8', '#5566AA', '#0C0E22']
  return { glow: a.glow, hi, mid, lo, name: a.name }
}

// Small arena badge icon — current arena, shown in place of the old text pill.
// Falls back to a flat hex with the arena's gradient if the PNG is missing
// (e.g. level 0 "Rozgrzewka", which has no badge artwork yet).
function ArenaMiniBadge({ level = 0, theme, size = 30 }) {
  const [imgOk, setImgOk] = useState(true)
  useEffect(() => setImgOk(true), [level])
  return (
    <div style={{ width: size, height: size, position: 'relative', flexShrink: 0,
      filter: `drop-shadow(0 0 8px ${theme.glow}90)` }}>
      {imgOk && level > 0 ? (
        <img src={`/arenas/arena-${level}.png`} onError={() => setImgOk(false)} alt={theme.name}
          style={{ width: size, height: size, objectFit: 'contain' }}/>
      ) : (
        <svg width={size} height={size} viewBox="0 0 90 90">
          <defs>
            <linearGradient id={`pmb-${level}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={theme.hi}/>
              <stop offset="55%" stopColor={theme.mid}/>
              <stop offset="100%" stopColor={theme.lo}/>
            </linearGradient>
          </defs>
          <polygon points="45,3 82,24 82,66 45,87 8,66 8,24"
            fill={`url(#pmb-${level})`} stroke={theme.hi} strokeWidth="2" strokeOpacity="0.6"/>
        </svg>
      )}
    </div>
  )
}

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
        frame: r.profiles?.equipped_frame || 'none',
      }
    }
  }
  return {
    id: club.id, name: club.name, abbr: club.abbr,
    country: { code: club.country_code, name: club.country_name, flag: club.country_flag },
    ownerId: club.owner_id, members: m,
    joinCode: club.join_code ?? null,
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
      .select('id,name,abbr,country_code,country_name,country_flag,owner_id,join_code')
      .eq('id', clubId).single(),
    supabase.from('club_members')
      .select('position,user_id,joined_at')
      .eq('club_id', clubId),
  ])
  if (!club) return null

  // 3. Fetch profiles for all member user_ids in one query
  const userIds = (members ?? []).map(m => m.user_id).filter(Boolean)
  const { data: profiles } = userIds.length
    ? await supabase.from('profiles').select('id,name,equipped_frame').in('id', userIds)
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

  // Generate unique 5-char join code (retry on collision)
  let joinCode = null
  for (let attempt = 0; attempt < 5; attempt++) {
    const candidate = genJoinCode()
    const { data: exists } = await supabase.from('clubs')
      .select('id').eq('join_code', candidate).maybeSingle()
    if (!exists) { joinCode = candidate; break }
  }

  const { data: club, error } = await supabase.from('clubs')
    .insert({ name, abbr: abbr.toUpperCase(),
      country_code: country.code, country_name: country.name, country_flag: country.flag,
      owner_id: profile.id, join_code: joinCode }).select().single()
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

// ── JOIN-CODE helpers ─────────────────────────────────────────────────────────
// 5-char code from unambiguous chars (no 0/O, 1/I/L)
function genJoinCode() {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'
  return Array.from({ length: 5 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

async function apiFetchByCode(code) {
  const { data: club } = await supabase.from('clubs')
    .select('id,name,abbr,country_code,country_name,country_flag,join_code')
    .eq('join_code', code.toUpperCase().trim())
    .maybeSingle()
  if (!club) return null
  const { data: members } = await supabase.from('club_members')
    .select('position,user_id').eq('club_id', club.id)
  return { club, members: members ?? [] }
}

async function apiJoinByCode({ code, userId, position }) {
  const result = await apiFetchByCode(code)
  if (!result) throw new Error('Nie znaleziono klubu z tym kodem.')
  const { club, members } = result
  if (members.length >= 5)              throw new Error('Klub jest pełny.')
  if (members.some(m => m.user_id === userId))  throw new Error('Już jesteś w tym klubie.')
  if (members.some(m => m.position === position)) throw new Error('Ta pozycja jest zajęta.')
  const { error } = await supabase.from('club_members')
    .insert({ club_id: club.id, user_id: userId, position })
  if (error) throw new Error(error.message)
  return club.id
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

async function apiCancelMatch(matchId) {
  const { error } = await supabase.from('club_matches')
    .update({ status: 'cancelled' }).eq('id', matchId)
  if (error) throw error
}

async function apiFetchMatches(userLat, userLng, radiusKm = 25, myClubMemberIds = [], myClubId = null) {
  // Window: -7 dni do +60 dni od dziś. Stare mecze są bezużyteczne na liście,
  // a bez okna przy 5k userów łatwo o tabelę z dziesiątkami tysięcy wierszy.
  const now = new Date()
  const from = new Date(now.getTime() - 7  * 86400000).toISOString()
  const to   = new Date(now.getTime() + 60 * 86400000).toISOString()

  const { data: matches, error } = await supabase
    .from('club_matches')
    .select('*')
    .neq('status', 'cancelled')
    .gte('scheduled_at', from)
    .lte('scheduled_at', to)
    .order('scheduled_at', { ascending: true })
    .limit(500)  // hard cap — jeśli kiedyś przekroczymy, dodamy paginację
  if (error) throw error

  // Always include own club's matches + matches within radius
  const visible = (matches || []).filter(m =>
    (myClubId && (m.club_id === myClubId || m.away_club_id === myClubId)) ||
    haversineKm(userLat, userLng, m.lat, m.lng) <= radiusKm
  )
  if (!visible.length) return []

  const ids = visible.map(m => m.id)
  const { data: players } = await supabase.from('match_players').select('*').in('match_id', ids)

  const uids = [...new Set((players || []).map(p => p.user_id))]
  const allClubIds = [...new Set([
    ...visible.map(m => m.club_id),
    ...visible.filter(m => m.away_club_id).map(m => m.away_club_id),
  ].filter(Boolean))]

  // profiles + clubs are independent — fetch in parallel
  const [profileRows, clubRows] = await Promise.all([
    uids.length
      ? supabase.from('profiles').select('id,name,equipped_frame').in('id', uids).then(r => r.data || [])
      : Promise.resolve([]),
    allClubIds.length
      ? supabase.from('clubs').select('id,name,abbr,country_flag').in('id', allClubIds).then(r => r.data || [])
      : Promise.resolve([]),
  ])
  const pm = Object.fromEntries(profileRows.map(p => [p.id, p]))
  const cm = Object.fromEntries(clubRows.map(c => [c.id, c]))

  return visible.map(m => {
    const matchPlayers = (players || []).filter(p => p.match_id === m.id).map(p => ({ ...p, profile: pm[p.user_id] || null }))
    const hasTeammate = myClubMemberIds.length > 0 && matchPlayers.some(p => myClubMemberIds.includes(p.user_id))
    return {
      ...m,
      _dist: haversineKm(userLat, userLng, m.lat, m.lng),
      _club: cm[m.club_id] || null,
      _awayClub: m.away_club_id ? (cm[m.away_club_id] || null) : null,
      players: matchPlayers,
      _hasTeammate: hasTeammate,
    }
  })
}

async function apiJoinMatch(matchId, userId, team, mode) {
  const n = MODE_SLOTS[mode]

  if (team === 'away') {
    // Enforce away-club exclusivity — only one club can occupy the away slots
    const [{ data: matchRow }, { data: membership }] = await Promise.all([
      supabase.from('club_matches').select('away_club_id').eq('id', matchId).single(),
      supabase.from('club_members').select('club_id').eq('user_id', userId).maybeSingle(),
    ])
    const userClubId = membership?.club_id || null
    if (matchRow?.away_club_id && matchRow.away_club_id !== userClubId) {
      throw new Error('Drużyna away jest już zajęta przez inny klub')
    }
    // First away player — claim the slot for their club
    if (!matchRow?.away_club_id && userClubId) {
      await supabase.from('club_matches').update({ away_club_id: userClubId }).eq('id', matchId)
    }
  }

  const { data: existing } = await supabase.from('match_players').select('slot').eq('match_id', matchId).eq('team', team)
  const taken = new Set((existing || []).map(p => p.slot))
  const slot = Array.from({ length: n }, (_, i) => i + 1).find(s => !taken.has(s))
  if (!slot) throw new Error('Drużyna jest już pełna')

  const { error } = await supabase.from('match_players').insert({ match_id: matchId, user_id: userId, team, slot })
  if (error) {
    if (error.code === '23505') throw new Error('Ten slot właśnie zajął ktoś inny — odśwież i spróbuj ponownie')
    throw error
  }
  const { count } = await supabase.from('match_players').select('*', { count: 'exact', head: true }).eq('match_id', matchId)
  if ((count || 0) >= n * 2) {
    await supabase.from('club_matches').update({ status: 'full' }).eq('id', matchId)
  }
}

async function apiLeaveMatch(matchId, userId) {
  // First check which team the player was on
  const { data: myRow } = await supabase.from('match_players')
    .select('team').eq('match_id', matchId).eq('user_id', userId).maybeSingle()

  const { error } = await supabase.from('match_players').delete().eq('match_id', matchId).eq('user_id', userId)
  if (error) throw error

  // If the player was on away team, check if anyone else remains away
  const updates = { status: 'open' }
  if (myRow?.team === 'away') {
    const { data: remaining } = await supabase.from('match_players')
      .select('id').eq('match_id', matchId).eq('team', 'away')
    if (!remaining || remaining.length === 0) {
      updates.away_club_id = null  // Release away club claim — new club can now take over
    }
  }
  await supabase.from('club_matches').update(updates).eq('id', matchId)
}

// Home captain submits score — if no away players: auto-complete, else: pending confirmation
async function apiSubmitHomeScore(matchId, scoreHome, scoreAway, autoComplete = false) {
  const update = autoComplete
    ? { score_home: scoreHome, score_away: scoreAway, status: 'completed' }
    : { score_home: scoreHome, score_away: scoreAway, status: 'result_pending',
        result_submitted_at: new Date().toISOString() }
  const { error } = await supabase.from('club_matches').update(update).eq('id', matchId)
  if (error) throw error
  if (autoComplete) await awardMatchPoints(matchId)
}

// Check team win achievements for each player.
// Punkty meczowe (XP + Draft Score, 35/50 wygrana vs 15/20 przegrana) są
// teraz przyznawane server-side przez trigger `trg_award_match_xp` na
// `club_matches` (after update → status='completed') — patrz migracja
// 20260613_three_counters_system.sql. Front nie wstawia już punktów ręcznie.
async function awardMatchPoints(matchId) {
  const { data: players } = await supabase
    .from('match_players')
    .select('user_id, profiles(created_at)')
    .eq('match_id', matchId)
  if (!players || players.length === 0) return
  // Globalny kalendarzowy tydzień (poniedziałek 00:00 UTC, wspólny dla
  // wszystkich graczy) — patrz `lib/week.js`.
  const weekNumber = calendarWeekNumber(new Date())
  Promise.all(players.map(p => checkTeamWinAchievements(p.user_id, weekNumber))).catch(() => {})
}

// Away captain confirms home's submitted score
async function apiConfirmAwayScore(matchId) {
  const { error } = await supabase.from('club_matches')
    .update({ status: 'completed' }).eq('id', matchId)
  if (error) throw error
  await awardMatchPoints(matchId)
}

// Away captain disputes — scores don't match
async function apiDisputeScore(matchId) {
  const { error } = await supabase.from('club_matches')
    .update({ status: 'disputed' }).eq('id', matchId)
  if (error) throw error
}

// Mark walkover: 'home_cancelled' (creator cancels < 2h) or 'away_noshow'
async function apiMarkWalkover(matchId, side) {
  const { error } = await supabase.from('club_matches')
    .update({ status: 'completed', walkover: side }).eq('id', matchId)
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
// `theme` lets the same hex-crystal crest be recolored — e.g. blue (default) for the
// home side and red for the away side in head-to-head match cards, so the duel reads
// at a glance without relying on text.
const BADGE_THEMES = {
  blue: { id: 'bdgG-blue', hi: '#66CCFF', mid: '#1A78D0', lo: '#061640',
          glow: 'rgba(0,160,255,0.55)', edgeA: 'rgba(0,80,200,.55)', edgeB: 'rgba(0,20,90,.70)' },
  red:  { id: 'bdgG-red',  hi: '#FF8A8A', mid: '#D5303F', lo: '#3D0612',
          glow: 'rgba(255,70,90,0.50)',  edgeA: 'rgba(200,30,50,.55)', edgeB: 'rgba(90,5,20,.70)' },
}

function Badge({ abbr = '?', size = 64, theme = 'blue' }) {
  const t = BADGE_THEMES[theme] || BADGE_THEMES.blue
  return (
    <svg width={size} height={size} viewBox="0 0 90 90"
      style={{ flexShrink: 0, overflow: 'visible',
        filter: `drop-shadow(0 8px 22px ${t.glow})` }}>
      <defs>
        <linearGradient id={t.id} x1="20%" y1="0%" x2="80%" y2="100%">
          <stop offset="0%"   stopColor={t.hi}/>
          <stop offset="45%"  stopColor={t.mid}/>
          <stop offset="100%" stopColor={t.lo}/>
        </linearGradient>
      </defs>
      <polygon points="45,9 84,33 84,61 45,87 6,61 6,33" fill="rgba(0,0,0,.35)"/>
      <polygon points="45,6 82,32 82,58 45,84 8,58 8,32" fill={`url(#${t.id})`}/>
      <polygon points="45,6 8,32 45,42"  fill="rgba(255,255,255,.30)"/>
      <polygon points="45,6 82,32 45,42" fill="rgba(255,255,255,.13)"/>
      <polygon points="8,32 8,58 45,48 45,42"  fill={t.edgeA}/>
      <polygon points="82,32 82,58 45,48 45,42" fill={t.edgeB}/>
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

// Team-side accent colors for head-to-head match cards — blue for home (left), red for
// away (right), mirroring the artwork's own blue↔red split so the duel reads instantly.
const TEAM_BLUE = '#4FA8FF'
const TEAM_RED  = '#FF5468'

// ── HEX ROSTER SLOT (mini) — filled = joined silhouette glow, empty = dashed outline ──
// Both states carry a translucent dark backing so they stay crisp over the bright,
// busy match artwork regardless of which side of the blue/red split they sit on.
function HexSlot({ filled, color, size = 22 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 40 40" style={{ flexShrink: 0, overflow: 'visible' }}>
      <polygon points="20,2 36,11 36,29 20,38 4,29 4,11" fill="rgba(4,10,22,0.40)"/>
      {filled ? (
        <>
          <polygon points="20,2 36,11 36,29 20,38 4,29 4,11"
            fill={`${color}30`} stroke={color} strokeWidth="1.6"
            style={{ filter: `drop-shadow(0 0 4px ${color}80)` }}/>
          <circle cx="20" cy="15.4" r="4.4" fill={color}/>
          <path d="M11.2 31c0-6 3.9-9.4 8.8-9.4s8.8 3.4 8.8 9.4" fill={color}/>
        </>
      ) : (
        <polygon points="20,2 36,11 36,29 20,38 4,29 4,11"
          fill="none" stroke={`${color}70`} strokeWidth="1.4" strokeDasharray="3.2 2.6"/>
      )}
    </svg>
  )
}

// ── PLAYER TOKEN ──────────────────────────────────────────────────────────────
const TK = 78  // token size px

function Token({ posKey, member, onPress, swapMode, isSrc, isTgt }) {
  const { profile, user } = useAuth()
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
        {/* Glow bloom — a perfectly round radial fade well inside the box, blurred,
            so the falloff completes before any container edge (no hard clipped ring) */}
        {member && (
          <div style={{
            position: 'absolute', inset: '-18%',
            background: `radial-gradient(circle at 50% 50%, ${isSrc ? 'rgba(0,221,255,0.46)' : pos.glow.replace(/[\d.]+\)$/, '0.40)')} 0%, ${isSrc ? 'rgba(0,221,255,0.16)' : pos.glow.replace(/[\d.]+\)$/, '0.14)')} 36%, transparent 68%)`,
            filter: 'blur(16px)', pointerEvents: 'none',
          }}/>
        )}
        {/* Sci-fi frame overlay — only for filled slots */}
        {member && !isSrc && !isTgt && (
          <HexFrameOnly size={TK} variant={(member.id === user?.id ? profile?.equipped_frame : member.frame) || 'none'} />
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
  const dragControls = useDragControls()
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
        // Swipe-to-dismiss — only the handle below starts the drag (dragListener=false),
        // so normal scrolling inside the sheet's content keeps working untouched.
        drag="y"
        dragControls={dragControls}
        dragListener={false}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0, bottom: 0.62 }}
        onDragEnd={(e, info) => {
          if (info.offset.y > 110 || info.velocity.y > 700) onClose()
        }}
        className="hide-scrollbar"
        style={{
          width: '100%', maxWidth: 420, margin: '0 0',
          background: '#07101E',
          borderRadius: '24px 24px 0 0',
          border: '1px solid rgba(0,200,255,0.10)',
          borderBottom: 'none',
          padding: '20px 22px 40px',
          boxShadow: '0 -6px 60px rgba(0,0,0,0.60)',
          maxHeight: '88vh', overflowY: 'auto', overscrollBehavior: 'contain',
        }}>
        {/* Drag handle — grab here and pull down to dismiss, like a native iOS sheet */}
        <div
          onPointerDown={e => dragControls.start(e)}
          style={{
            width: 46, height: 5, borderRadius: 3, margin: '0 auto 20px',
            background: 'linear-gradient(90deg, rgba(120,190,255,0.18), rgba(140,205,255,0.55), rgba(120,190,255,0.18))',
            boxShadow: '0 0 12px rgba(90,180,255,0.28)',
            cursor: 'grab', touchAction: 'none',
          }}/>
        {children}
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── EMPTY SLOT SHEET ──────────────────────────────────────────────────────────
function EmptySlotSheet({ club, posKey, onClose }) {
  const pos  = POS[posKey]
  const [mode,   setMode]   = useState('link') // 'link' | 'code'
  const [copied, setCopied] = useState(false)

  const link = `https://hoopconnect.pl/dolacz/${club.id}?pos=${posKey}`
  const code = club.joinCode ?? null

  function copyText(text) {
    navigator.clipboard.writeText(text)
      .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2500) })
  }

  const TABS = [
    { key: 'link', label: 'LINK' },
    { key: 'code', label: 'KOD KLUBU' },
  ]

  return (
    <Sheet onClose={onClose}>
      {/* Position badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        padding: '5px 14px', borderRadius: 99,
        background: `${pos.hi}18`, border: `1px solid ${pos.hi}40`, marginBottom: 16,
      }}>
        <span style={{ width: 7, height: 7, borderRadius: '50%', background: pos.hi,
          boxShadow: `0 0 5px ${pos.glow}` }}/>
        <span style={{ fontSize: 10, fontWeight: 800, letterSpacing: 2,
          color: pos.hi, textTransform: 'uppercase' }}>{posKey}</span>
        <span style={{ fontSize: 10, fontWeight: 600, color: C.sub }}>{pos.label}</span>
      </div>

      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 24,
        color: C.text, marginBottom: 18, letterSpacing: -0.3 }}>
        Zaproś zawodnika
      </p>

      {/* Tab switcher — same style as Boisko/Mecze/Statystyki */}
      <div style={{
        display: 'flex', gap: 4, padding: '4px',
        background: 'rgba(0,0,0,0.35)',
        border: '1px solid rgba(0,200,255,0.10)',
        borderRadius: 12, marginBottom: 18,
      }}>
        {TABS.map(t => (
          <button key={t.key} onClick={() => { setMode(t.key); setCopied(false) }}
            style={{
              flex: 1, padding: '9px 4px', border: 'none', borderRadius: 9,
              fontFamily: 'var(--font-display)', fontWeight: 800,
              fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase',
              cursor: 'pointer', transition: 'all 0.17s',
              background: mode === t.key
                ? `linear-gradient(135deg, ${C.accent}28, ${C.accentLo}18)`
                : 'transparent',
              color: mode === t.key ? C.accent : C.sub,
              borderBottom: mode === t.key
                ? `1.5px solid ${C.accent}70` : '1.5px solid transparent',
            }}>
            {t.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {mode === 'link' ? (
          <motion.div key="link"
            initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -8 }} transition={{ duration: 0.15 }}>
            <div style={{ padding: '11px 14px', background: '#0A1626',
              border: '1px solid rgba(0,200,255,0.14)', borderRadius: 12, marginBottom: 14,
              fontFamily: 'monospace', fontSize: 11, color: C.sub,
              wordBreak: 'break-all', lineHeight: 1.5 }}>
              {link}
            </div>
            <motion.button whileTap={{ scale: 0.97 }} onClick={() => copyText(link)}
              style={{
                width: '100%', padding: '15px', borderRadius: 14,
                fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, letterSpacing: 1,
                cursor: 'pointer', transition: 'all 0.2s',
                background: copied ? 'rgba(0,200,130,0.10)' : `linear-gradient(135deg, ${C.accent}, ${C.accentLo})`,
                border: copied ? '1.5px solid rgba(0,200,130,0.30)' : 'none',
                color: copied ? C.win : '#fff',
                boxShadow: copied ? 'none' : `0 6px 22px ${C.accentLo}60`,
              }}>
              {copied ? '✓ Skopiowano!' : '🔗 Kopiuj link zaproszenia'}
            </motion.button>
          </motion.div>
        ) : (
          <motion.div key="code"
            initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 8 }} transition={{ duration: 0.15 }}>
            {code ? (
              <>
                <p style={{ fontSize: 11, color: C.sub, marginBottom: 12, lineHeight: 1.6 }}>
                  Podaj ten kod znajomemu — wpisze go w zakładce Klub, żeby dołączyć.
                </p>
                {/* Big code display */}
                <div style={{
                  textAlign: 'center', padding: '22px 16px',
                  background: '#0A1626',
                  border: `1px solid ${C.accent}22`,
                  borderTop: `1px solid ${C.accent}44`,
                  borderRadius: 16, marginBottom: 14,
                }}>
                  <p style={{ fontSize: 8, letterSpacing: 3, fontWeight: 700,
                    color: `${C.accent}55`, textTransform: 'uppercase', marginBottom: 10 }}>
                    Kod klubu
                  </p>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontSize: 42, fontWeight: 900,
                    letterSpacing: 14, color: C.accent,
                    textShadow: `0 0 28px ${C.accent}4D`,
                    margin: 0,
                  }}>
                    {code}
                  </p>
                </div>
                <motion.button whileTap={{ scale: 0.97 }} onClick={() => copyText(code)}
                  style={{
                    width: '100%', padding: '15px', borderRadius: 14,
                    fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 14, letterSpacing: 1,
                    cursor: 'pointer', transition: 'all 0.2s',
                    background: copied ? 'rgba(0,200,130,0.10)' : `linear-gradient(135deg, ${C.accent}, ${C.accentLo})`,
                    border: copied ? '1.5px solid rgba(0,200,130,0.30)' : 'none',
                    color: copied ? C.win : '#fff',
                    boxShadow: copied ? 'none' : `0 6px 22px ${C.accentLo}60`,
                  }}>
                  {copied ? '✓ Skopiowano!' : '📋 Kopiuj kod'}
                </motion.button>
              </>
            ) : (
              <p style={{ fontSize: 12, color: C.sub, textAlign: 'center', padding: '20px 0' }}>
                Kod klubu niedostępny — odśwież aplikację.
              </p>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </Sheet>
  )
}

// ── PLAYER PROFILE SHEET ──────────────────────────────────────────────────────
function destructiveBtnStyle(disabled) {
  return {
    width: '100%', padding: '14px',
    background: disabled ? `${C.dim}40` : 'rgba(255,60,80,0.08)',
    border: `1.5px solid ${disabled ? C.dim : 'rgba(255,60,80,0.28)'}`,
    borderRadius: 14, color: disabled ? C.sub : C.loss,
    fontFamily: 'var(--font-display)', fontWeight: 800,
    fontSize: 14, letterSpacing: 1, cursor: disabled ? 'default' : 'pointer',
    transition: 'all 0.2s',
  }
}

// Subtle glass tile for the "quick stats" trio — calm, identity-first, no percentages
function StatTile({ label, value }) {
  return (
    <div style={{
      flex: 1, padding: '14px 8px', borderRadius: 16, textAlign: 'center',
      background: 'linear-gradient(180deg, rgba(40,55,85,0.34) 0%, rgba(22,32,52,0.28) 100%)',
      backdropFilter: 'blur(24px) saturate(1.4)',
      WebkitBackdropFilter: 'blur(24px) saturate(1.4)',
      boxShadow: [
        'inset 0 1px 0 rgba(200,225,255,0.08)',
        'inset 0 -1px 0 rgba(0,0,0,0.16)',
        '0 1px 6px rgba(0,0,0,0.16)',
      ].join(', '),
    }}>
      <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 22,
        letterSpacing: -0.5, color: C.text, margin: 0, lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 1.8,
        textTransform: 'uppercase', color: C.sub, margin: '6px 0 0' }}>{label}</p>
    </div>
  )
}

// Club strip — identity row beneath the player's name; tap → read-only club preview
function ClubStrip({ club, role, onPress, accent = C.accent }) {
  return (
    <motion.button whileTap={{ scale: 0.97 }} onClick={onPress}
      style={{
        display: 'flex', alignItems: 'center', gap: 11, width: '100%',
        padding: '10px 14px 10px 10px', borderRadius: 16, marginTop: 18,
        background: 'linear-gradient(180deg, rgba(40,55,85,0.32) 0%, rgba(22,32,52,0.26) 100%)',
        border: '1px solid rgba(0,200,255,0.10)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        cursor: 'pointer', WebkitTapHighlightColor: 'transparent', textAlign: 'left',
      }}>
      <Badge abbr={club.abbr} size={38}/>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 13.5,
          color: C.text, margin: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {club.name}
        </p>
        <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1, color: accent, margin: '2px 0 0' }}>
          {role}
        </p>
      </div>
      <svg width="9" height="14" viewBox="0 0 9 14" fill="none">
        <path d="M1.5 1.5L7 7l-5.5 5.5" stroke={C.sub} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
      </svg>
    </motion.button>
  )
}

// Secondary glass action row — used for "soon" management shortcuts (UI scaffolding only)
function ActionRow({ label, icon, soon, onClick, accent }) {
  return (
    <motion.button whileTap={soon ? {} : { scale: 0.97 }} onClick={soon ? undefined : onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: 12, width: '100%',
        padding: '13px 14px', borderRadius: 14, marginBottom: 8,
        background: 'rgba(255,255,255,0.03)',
        border: `1px solid ${accent ? `${accent}22` : 'rgba(255,255,255,0.06)'}`,
        cursor: soon ? 'default' : 'pointer', WebkitTapHighlightColor: 'transparent', textAlign: 'left',
        opacity: soon ? 0.55 : 1,
      }}>
      <span style={{ fontSize: 15, lineHeight: 1 }}>{icon}</span>
      <span style={{ flex: 1, fontSize: 12.5, fontWeight: 700, color: C.text }}>{label}</span>
      {soon ? (
        <span style={{ fontSize: 8, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
          color: C.sub, padding: '3px 8px', borderRadius: 99, border: `1px solid ${C.dim}` }}>
          Wkrótce
        </span>
      ) : (
        <svg width="8" height="13" viewBox="0 0 8 13" fill="none">
          <path d="M1 1l5.5 5.5L1 12" stroke={accent || C.sub} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      )}
    </motion.button>
  )
}

// ── XP bar with number count-up animation (used in PlayerProfileSheet) ──────
// Mounts fresh every time `xp` changes (key prop on parent), so on profile
// open the bar fills from 0 and the number counts up from 0 to the current XP.
function XpProgressBar({ xp, pct, nextArena, accentLo, accentHi, accent, sub, tappable }) {
  const motionXp = useMotionValue(0)
  const displayXp = useTransform(motionXp, v => Math.round(v))
  useEffect(() => {
    const controls = animate(motionXp, xp, { duration: 0.85, ease: 'easeOut' })
    return controls.stop
  }, [xp])  // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ margin: '26px 0 0' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
        <span style={{ fontSize: 10, fontWeight: 700, color: sub }}>
          {nextArena
            ? <>Następna arena: <b style={{ color: 'var(--text-primary)', fontWeight: 800 }}>{nextArena.name}</b></>
            : 'Najwyższa arena'}
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ fontSize: 11, fontWeight: 800, color: accent, fontFamily: 'var(--font-display)', display: 'inline-flex', alignItems: 'center', gap: 3 }}>
            <motion.span>{displayXp}</motion.span>
            {nextArena ? ` / ${nextArena.threshold}` : ''}
            <img src="/hoopxp.png" alt="XP" style={{ width: 13, height: 13, objectFit: 'contain' }}/>
          </span>
          {tappable && (
            <span style={{ fontSize: 11, color: `${accent}80`, lineHeight: 1 }}>›</span>
          )}
        </span>
      </div>

      {/* Track */}
      <div style={{ position: 'relative', height: 9, borderRadius: 99, background: 'rgba(255,255,255,0.06)' }}>
        {/* Fill */}
        <motion.div
          key={xp}
          initial={{ width: 0 }}
          animate={{ width: `${Math.round(pct * 100)}%` }}
          transition={{ duration: 0.85, ease: 'easeOut' }}
          style={{
            position: 'absolute', inset: 0, borderRadius: 99,
            background: `linear-gradient(90deg, ${accentLo}, ${accentHi})`,
            boxShadow: `0 0 12px ${accent}80`,
            overflow: 'visible',
          }}
        >
          {/* Glowing endpoint dot */}
          <motion.div
            initial={{ opacity: 0, scale: 0.5 }}
            animate={{ opacity: [0, 1, 0.7], scale: [0.5, 1.4, 1] }}
            transition={{ duration: 0.55, delay: 0.78, ease: 'easeOut' }}
            style={{
              position: 'absolute', right: -5, top: '50%', transform: 'translateY(-50%)',
              width: 13, height: 13, borderRadius: '50%',
              background: accentHi,
              boxShadow: `0 0 10px ${accent}, 0 0 22px ${accent}80`,
            }}
          />
        </motion.div>
      </div>
    </div>
  )
}

// ── ARENA ROAD SHEET — podgląd postępu aren (jak Trophy Road w Clash Royale) ─
// Zsynchronizowane z ARENAS — jeden wpis na arenę, ta sama kolejność.
const ARENA_ROAD_THEMES = [
  { glow: '#8899CC', hi: '#AABBD8', mid: '#5566AA', lo: '#0C0E22' }, // Playground
  { glow: '#FF8C30', hi: '#FFCC80', mid: '#E07020', lo: '#180900' }, // Street Court
  { glow: '#E8B030', hi: '#FFE090', mid: '#C88820', lo: '#1A1000' }, // Sól tej Ziemi
]
function ArenaRoadSheet({ xp, arenaLevel, onClose }) {
  const currLevel = arenaLevel ?? 0
  const currXp    = xp ?? 0

  return (
    <Sheet onClose={onClose}>
      <p style={{
        fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20,
        letterSpacing: 1.5, textTransform: 'uppercase', color: C.text,
        marginBottom: 6,
      }}>Droga Aren</p>
      <p style={{ fontSize: 11, color: C.sub, marginBottom: 28, fontWeight: 600 }}>
        Twój postęp w systemie aren HoopConnect
      </p>

      {/* Road — arenas from bottom (highest) to top (lowest) */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {[...ARENAS].reverse().map((arena, reversedIdx) => {
          const idx       = ARENAS.length - 1 - reversedIdx
          const theme     = ARENA_ROAD_THEMES[idx]
          const isCurrent = idx === currLevel
          const isPast    = idx < currLevel
          const isLocked  = idx > currLevel
          const nextArena = ARENAS[idx + 1]
          const span      = nextArena ? nextArena.threshold - arena.threshold : 1
          const filled    = isCurrent ? Math.min(1, (currXp - arena.threshold) / span) : 0

          return (
            <div key={arena.level} style={{ display: 'flex', gap: 14, alignItems: 'stretch' }}>
              {/* Connector road */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 28, flexShrink: 0 }}>
                {/* Line above badge (not on last/top element) */}
                <div style={{
                  width: 3, flex: '0 0 18px',
                  background: reversedIdx === 0
                    ? 'transparent'
                    : isLocked && !isCurrent
                      ? 'rgba(255,255,255,0.07)'
                      : `linear-gradient(to bottom, ${theme.hi}40, ${theme.hi}90)`,
                  borderRadius: 3,
                }}/>
                {/* Badge */}
                <div style={{ flexShrink: 0 }}>
                  <svg width={28} height={28} viewBox="0 0 90 90"
                    style={{
                      filter: isCurrent
                        ? `drop-shadow(0 0 10px ${theme.glow})`
                        : isPast ? 'none' : 'none',
                      opacity: isLocked ? 0.32 : 1,
                    }}>
                    <defs>
                      <linearGradient id={`road-g-${idx}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%"   stopColor={isPast ? '#4a5568' : theme.hi}/>
                        <stop offset="100%" stopColor={isPast ? '#2d3748' : theme.lo}/>
                      </linearGradient>
                    </defs>
                    <polygon points="45,4 80,24 80,66 45,86 10,66 10,24"
                      fill={`url(#road-g-${idx})`}
                      stroke={isPast ? 'rgba(255,255,255,0.15)' : theme.hi}
                      strokeWidth="2" strokeOpacity={isPast ? 0.3 : 0.65}/>
                    {isPast ? (
                      <text x="45" y="52" textAnchor="middle" dominantBaseline="middle"
                        fill="rgba(255,255,255,0.55)" fontSize="30">✓</text>
                    ) : isLocked ? (
                      <text x="45" y="52" textAnchor="middle" dominantBaseline="middle"
                        fill="rgba(255,255,255,0.4)" fontSize="26">🔒</text>
                    ) : (
                      <text x="45" y="52" textAnchor="middle" dominantBaseline="middle"
                        fill="white" fontSize="24" fontWeight="900"
                        fontFamily="var(--font-display)">{idx}</text>
                    )}
                  </svg>
                </div>
                {/* Line below badge */}
                <div style={{
                  width: 3, flex: 1, minHeight: 18,
                  background: isPast
                    ? `linear-gradient(to bottom, ${theme.hi}80, ${ARENA_ROAD_THEMES[Math.max(0,idx-1)]?.hi ?? theme.hi}50)`
                    : 'rgba(255,255,255,0.07)',
                  borderRadius: 3,
                }}/>
              </div>

              {/* Arena info */}
              <div style={{ flex: 1, paddingBottom: 22, paddingTop: 2 }}>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: isCurrent ? 6 : 3 }}>
                  <p style={{
                    fontFamily: 'var(--font-display)', fontWeight: 900,
                    fontSize: isCurrent ? 17 : 14,
                    color: isLocked ? 'rgba(255,255,255,0.30)'
                         : isPast   ? 'rgba(255,255,255,0.50)'
                         : C.text,
                    textTransform: 'uppercase', letterSpacing: 0.8,
                    textShadow: isCurrent ? `0 0 20px ${theme.glow}80` : 'none',
                  }}>{arena.name}</p>
                  {isCurrent && (
                    <span style={{
                      fontSize: 8, fontWeight: 800, letterSpacing: 2, textTransform: 'uppercase',
                      color: theme.glow, padding: '2px 7px', borderRadius: 99,
                      background: `${theme.glow}18`, border: `1px solid ${theme.glow}40`,
                    }}>TU JESTEŚ</span>
                  )}
                </div>
                <p style={{ fontSize: 11, color: isLocked ? 'rgba(255,255,255,0.22)' : C.sub,
                  fontWeight: 600, marginBottom: isCurrent ? 8 : 0 }}>
                  {arena.threshold === 0 ? 'Start' : `${arena.threshold} XP`}
                  {nextArena && !isLocked && !isPast ? ` → ${nextArena.threshold} XP` : ''}
                </p>
                {isCurrent && nextArena && (
                  <>
                    <div style={{ height: 5, borderRadius: 99, background: 'rgba(255,255,255,0.07)', marginBottom: 4 }}>
                      <motion.div
                        initial={{ width: 0 }} animate={{ width: `${Math.round(filled * 100)}%` }}
                        transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
                        style={{
                          height: '100%', borderRadius: 99,
                          background: `linear-gradient(90deg, ${theme.mid}, ${theme.hi})`,
                          boxShadow: `0 0 8px ${theme.glow}70`,
                        }}
                      />
                    </div>
                    <p style={{ fontSize: 10, color: C.sub, fontWeight: 700 }}>
                      {currXp} / {nextArena.threshold} XP
                    </p>
                  </>
                )}
                {isCurrent && !nextArena && (
                  <p style={{ fontSize: 11, color: theme.glow, fontWeight: 800 }}>MAX — Legendarny status 👑</p>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}

// Loads the extended profile row + aggregate identity stats for the player shown in the sheet.
function usePlayerProfileData(memberId) {
  const [profile, setProfile] = useState(null)
  const [stats,   setStats]   = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!memberId) return
    let cancelled = false
    setLoading(true)
    setProfile(null)
    setStats(null)

    Promise.all([
      supabase.from('profiles').select('xp,arena_level,country,background,username,equipped_frame').eq('id', memberId).single(),
      supabase.from('shooting_sessions').select('shot_type,made,attempted').eq('user_id', memberId),
      supabase.from('activity_log').select('trainings_completed').eq('user_id', memberId),
      supabase.from('match_players').select('match_id,team').eq('user_id', memberId),
    ]).then(async ([profileRes, sessionsRes, logsRes, mpRes]) => {
      if (cancelled) return

      const byType = {}
      ;(sessionsRes.data || []).forEach(s => {
        if (!byType[s.shot_type]) byType[s.shot_type] = { made: 0, attempted: 0 }
        byType[s.shot_type].made      += s.made
        byType[s.shot_type].attempted += s.attempted
      })
      const pctOf = t => byType[t]?.attempted ? Math.round((byType[t].made / byType[t].attempted) * 100) : 0
      const trainings = (logsRes.data || []).reduce((a, l) => a + (l.trainings_completed || []).length, 0)

      // Wins: join this player's match participations with completed club_matches results
      const mpRows = mpRes.data || []
      const matchIds = mpRows.map(r => r.match_id)
      let wins = 0
      if (matchIds.length) {
        const { data: matches } = await supabase.from('club_matches')
          .select('id,score_home,score_away,walkover,status')
          .in('id', matchIds).eq('status', 'completed')
        const teamByMatch = {}
        mpRows.forEach(r => { teamByMatch[r.match_id] = r.team })
        ;(matches || []).forEach(m => {
          const team = teamByMatch[m.id]
          if (!team) return
          if (m.walkover) {
            const won = (m.walkover === 'away_noshow' && team === 'home') || (m.walkover === 'home_cancelled' && team === 'away')
            if (won) wins++
          } else if (m.score_home != null && m.score_away != null) {
            const ps = team === 'home' ? m.score_home : m.score_away
            const os = team === 'home' ? m.score_away : m.score_home
            if (ps > os) wins++
          }
        })
      }

      if (cancelled) return
      setProfile(profileRes.data || null)
      setStats({
        pct3: pctOf('3pt'), made3: byType['3pt']?.made || 0, att3: byType['3pt']?.attempted || 0,
        pct2: pctOf('2pt'), made2: byType['2pt']?.made || 0, att2: byType['2pt']?.attempted || 0,
        pctFt: pctOf('ft'), madeFt: byType.ft?.made || 0,    attFt: byType.ft?.attempted || 0,
        trainings,
        matches: mpRows.length,
        wins,
      })
      setLoading(false)
    })

    return () => { cancelled = true }
  }, [memberId])

  return { profile, stats, loading }
}

function PlayerProfileSheet({ club, posKey, member, isOwner, isSelf, onClose, onRemove, onLeave, removing, onOpenClub }) {
  const { profile: myProfile } = useAuth()
  const { profile, stats, loading } = usePlayerProfileData(member.id)
  const country = COUNTRIES.find(c => c.code === profile?.country) || null
  const { next: nextArena, pct } = arenaProgress(profile?.xp, profile?.arena_level)
  const theme = getArenaTheme(profile?.arena_level ?? 0)
  // Prefer the freshly-fetched DB row (always current) over the AuthContext snapshot,
  // so a just-changed equipped frame shows immediately when opening your own profile.
  const frameVariant = profile?.equipped_frame || myProfile?.equipped_frame || member.frame || 'none'
  const [flagOk, setFlagOk] = useState(true)
  const [showArenaRoad, setShowArenaRoad] = useState(false)
  useEffect(() => { setFlagOk(true) }, [country?.flagFile])
  const role = member.isOwner ? 'Kapitan' : 'Zawodnik'
  const showDanger = isSelf || (isOwner && !member.isOwner)

  return (
    <Sheet onClose={onClose}>
      <div style={{ position: 'relative' }}>
        {/* ── Full-bleed cover artwork — sits BEHIND every section, not just the header.
               Stretched via top/bottom to the wrapper's full content height (incl. the
               sheet's own bleed margins), then faded into the base navy as it descends
               so every panel below stays readable while the flag still shows through. ── */}
        <div style={{
          position: 'absolute', top: -20, left: -22, right: -22, bottom: -40,
          zIndex: 0, overflow: 'hidden', borderRadius: '24px 24px 0 0', pointerEvents: 'none',
          background: 'linear-gradient(170deg, rgba(20,40,75,0.45), #07101E 70%)',
        }}>
          {country && country.flagFile && flagOk && (
            <img
              src={`/flags/${country.flagFile}.png`}
              alt=""
              onError={() => setFlagOk(false)}
              style={{
                position: 'absolute', top: 0, left: 0, right: 0, height: 620,
                width: '100%', objectFit: 'cover', objectPosition: 'center top',
              }}
            />
          )}
          {/* Fade: vivid up top, dissolving into the base navy well before the
              progress bar section so it always sits on solid dark navy ── */}
          <div style={{
            position: 'absolute', inset: 0,
            background: 'linear-gradient(180deg, rgba(7,16,30,0.10) 0%, rgba(7,16,30,0.50) 18%, rgba(7,16,30,0.85) 32%, #07101E 46%)',
          }}/>
        </div>

        {/* ── Foreground content — everything renders above the backdrop ──────── */}
        <div style={{ position: 'relative', zIndex: 1 }}>

      {/* ── SECTION 2 — Identity ──────────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', marginTop: 6 }}>
        <div style={{ position: 'relative' }}>
          {/* Ambient glow ring — colored by the player's current arena */}
          <div style={{
            position: 'absolute', inset: -10, borderRadius: '50%',
            background: `radial-gradient(circle, ${theme.glow}30, transparent 70%)`,
            pointerEvents: 'none',
          }}/>
          <HexAvatar name={member.name} size={104} variant={frameVariant}/>
        </div>

        <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 26,
          color: C.text, letterSpacing: -0.4, margin: '16px 0 0', textAlign: 'center',
          maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {member.name}
        </p>
        {country && (
          <p style={{ fontSize: 12, fontWeight: 600, color: C.sub, margin: '5px 0 0' }}>
            {country.flag} {country.name}
          </p>
        )}
      </div>

      {/* ── SECTION 3 — Progression: arena badge + XP bar (tap → Droga Aren) ── */}
      <div
        role="button" tabIndex={0}
        onClick={() => setShowArenaRoad(true)}
        style={{ cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
          display: 'flex', alignItems: 'center', gap: 12 }}
      >
        <ArenaMiniBadge level={profile?.arena_level ?? 0} theme={theme} size={44}/>
        <div style={{ flex: 1 }}>
          <XpProgressBar
            xp={profile?.xp ?? 0}
            pct={pct}
            nextArena={nextArena}
            accentLo={theme.mid}
            accentHi={theme.hi}
            accent={theme.glow}
            sub={C.sub}
            tappable
          />
        </div>
      </div>
      <AnimatePresence>
        {showArenaRoad && (
          <ArenaRoadSheet
            xp={profile?.xp ?? 0}
            arenaLevel={profile?.arena_level ?? 0}
            onClose={() => setShowArenaRoad(false)}
          />
        )}
      </AnimatePresence>

      {/* ── SECTION 4 — Quick stats (identity-level only, no percentages) ─────── */}
      <div style={{ display: 'flex', gap: 8, margin: '24px 0 26px' }}>
        <StatTile label="Mecze"    value={loading ? '—' : stats.matches}/>
        <StatTile label="Wygrane"  value={loading ? '—' : stats.wins}/>
        <StatTile label="Treningi" value={loading ? '—' : stats.trainings}/>
      </div>

      {/* ── SECTION 5 — Trophy showcase ────────────────────────────────────────── */}
      <div style={{ marginBottom: 26 }}>
        <p style={{ fontSize: 9.5, fontWeight: 800, letterSpacing: 2.4,
          textTransform: 'uppercase', color: C.sub, margin: '0 0 10px' }}>Gablota</p>
        <div style={{ display: 'flex', gap: 8 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{
              flex: 1, aspectRatio: '1', borderRadius: 14,
              background: 'rgba(0,200,255,0.04)',
              border: '1.5px dashed rgba(0,200,255,0.16)',
            }}/>
          ))}
        </div>
      </div>

      {/* ── SECTION 6 — Club strip (tap → read-only club preview) ─────────────── */}
      <ClubStrip club={club} role={role} onPress={onOpenClub} accent={theme.glow}/>

      {/* ── SECTION 7 — Actions ────────────────────────────────────────────────── */}
      <div style={{ marginTop: 22 }}>
        {isSelf && (
          <>
            <ActionRow icon="👤" label="Zarządzaj profilem"      soon accent={theme.glow}/>
            <ActionRow icon="🏆" label="Edytuj gablotę"          soon accent={theme.glow}/>
            <ActionRow icon="📊" label="Zobacz pełne statystyki" soon accent={theme.glow}/>
          </>
        )}

        {showDanger && (
          <div style={{ marginTop: isSelf ? 14 : 0 }}>
            <p style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 2.4,
              textTransform: 'uppercase', color: `${C.loss}90`, margin: '0 0 8px' }}>
              Strefa zagrożenia
            </p>
            {isSelf ? (
              <motion.button whileTap={{ scale: 0.96 }} onClick={onLeave} disabled={removing}
                style={destructiveBtnStyle(removing)}>
                {member.isOwner
                  ? (removing ? 'Rozwiązywanie…' : '🗑 Rozwiąż klub')
                  : (removing ? 'Opuszczanie…'   : '🚪 Opuść klub')}
              </motion.button>
            ) : (
              <motion.button whileTap={{ scale: 0.96 }} onClick={onRemove} disabled={removing}
                style={destructiveBtnStyle(removing)}>
                {removing ? 'Usuwanie…' : '✕ Usuń z klubu'}
              </motion.button>
            )}
          </div>
        )}
      </div>
        </div>
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
            { lbl: 'Nazwa klubu', val: name, set: e => setName(e.target.value), max: 21, sx: {} },
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
// 0–12 chars → 26px, 13–17 → 22px, 18–21 → 18px
function clubNameSize(name) {
  const n = name.length
  if (n <= 12) return 26
  if (n <= 17) return 22
  return 18
}

function ClubHeader({ club, isOwner, onEditPress }) {
  const filled = Object.values(club.members).filter(Boolean).length
  return (
    <div style={{ padding: 'max(52px, calc(env(safe-area-inset-top) + 20px)) 22px 12px', display: 'flex', alignItems: 'center', gap: 16 }}>

      <Badge abbr={club.abbr} size={58}/>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Country — section-label style from app */}
        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
          letterSpacing: 2.5, textTransform: 'uppercase',
          color: 'var(--text-dim)', marginBottom: 3,
        }}>
          {club.country.flag}&nbsp;{club.country.name}
        </p>

        {/* Club name — display-title style, always uppercase */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: clubNameSize(club.name), lineHeight: 1, letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: 'var(--text-primary)', margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            flex: 1, minWidth: 0,
            transition: 'font-size 0.2s ease',
          }}>
            {club.name.toUpperCase()}
          </h1>
          {isOwner && (
            <motion.button whileTap={{ scale: 0.88 }} onClick={onEditPress}
              style={{
                flexShrink: 0, width: 32, height: 32, borderRadius: 10,
                background: 'rgba(6,18,38,0.65)',
                backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
                border: '1px solid rgba(120,190,255,0.14)',
                borderTop: '1px solid rgba(160,210,255,0.18)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                cursor: 'pointer',
                boxShadow: '0 2px 8px rgba(0,0,0,0.30)',
              }}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none"
                stroke="rgba(160,210,255,0.70)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
              </svg>
            </motion.button>
          )}
        </div>

        {/* Member dots + count */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 7 }}>
          <div style={{ display: 'flex', gap: 4 }}>
            {[...Array(5)].map((_, i) => (
              <div key={i} style={{
                width: 6, height: 6, borderRadius: '50%',
                background: i < filled ? 'var(--orange)' : 'var(--text-dim)',
                opacity: i < filled ? 1 : 0.35,
                boxShadow: i < filled ? '0 0 5px rgba(91,184,245,0.63)' : 'none',
                transition: 'all 0.3s',
              }}/>
            ))}
          </div>
          <p style={{
            fontFamily: 'var(--font-body)', fontSize: 10, fontWeight: 600,
            letterSpacing: 1.5, textTransform: 'uppercase',
            color: 'var(--text-dim)', margin: 0,
          }}>
            {filled}/5 graczy
          </p>
        </div>

        {/* Join code chip */}
        {club.joinCode && (
          <JoinCodeChip code={club.joinCode}/>
        )}
      </div>
    </div>
  )
}

// ── MATCH CARD ────────────────────────────────────────────────────────────────
// Aesthetic divider between "my matches" and other nearby matches.
function SectionDivider() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '4px 2px 14px' }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(120,180,255,0.18))' }}/>
      <span style={{ fontSize: 8.5, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase', color: C.dim }}>
        Inne mecze
      </span>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, rgba(120,180,255,0.18), transparent)' }}/>
    </div>
  )
}

// Roster — wraps to a 2-on-top/3-on-bottom layout for 5v5, single row otherwise.
// Player hexagons are the focal point now (no club crest), so they're sized up.
function RosterGrid({ players, slots, color, size = 32 }) {
  const rows = slots === 5 ? [2, 3] : [slots]
  let slot = 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, alignItems: 'center' }}>
      {rows.map((count, ri) => (
        <div key={ri} style={{ display: 'flex', gap: 10, justifyContent: 'center', alignItems: 'center', height: size }}>
          {Array.from({ length: count }).map(() => {
            slot += 1
            const s = slot
            const p = players.find(pl => pl.slot === s)
            return p
              ? <HexAvatar key={s} name={p.profile?.name} size={size} variant={p.profile?.equipped_frame || 'none'} noAnim/>
              : <HexSlot key={s} filled={false} color={color} size={size * 0.76}/>
          })}
        </div>
      ))}
    </div>
  )
}

function MatchCard({ match, dist, uid, onPress }) {
  const slots = MODE_SLOTS[match.mode]
  const homePlayers = match.players.filter(p => p.team === 'home')
  const awayPlayers = match.players.filter(p => p.team === 'away')
  const color = MODE_COLOR[match.mode]
  const isPast = new Date(match.scheduled_at) < new Date()
  const homeTeamName = match._club?.name || match._club?.abbr || 'Klub'
  const awayTeamName = match._awayClub?.name || match._awayClub?.abbr || (match.away_club_id ? 'Rywale' : 'Otwarte')
  const hasTeammate = !!match._hasTeammate
  // Match where the current user has already joined — strongest highlight
  const isParticipating = uid && match.players.some(p => p.user_id === uid)
  const totalJoined = homePlayers.length + awayPlayers.length

  const frameGlow = isParticipating
    ? `0 0 34px rgba(0,210,255,0.22), inset 0 1px 0 rgba(255,255,255,0.10)`
    : hasTeammate
      ? `0 0 24px rgba(0,210,255,0.14), inset 0 1px 0 rgba(255,255,255,0.08)`
      : '0 10px 30px rgba(0,8,24,0.45), inset 0 1px 0 rgba(255,255,255,0.07)'
  const frameBorder = isParticipating
    ? '1.4px solid rgba(0,221,255,0.55)'
    : hasTeammate
      ? '1.4px solid rgba(0,200,255,0.34)'
      : '1px solid rgba(120,180,255,0.14)'

  return (
    <motion.div whileTap={{ scale: 0.975 }} onClick={onPress}
      style={{
        position: 'relative', borderRadius: 20, marginBottom: 12, cursor: 'pointer',
        overflow: 'hidden', isolation: 'isolate',
        border: frameBorder,
        boxShadow: frameGlow,
        opacity: isPast && match.status !== 'completed' ? 0.62 : 1,
        background: 'linear-gradient(165deg, rgba(28,48,78,0.50) 0%, rgba(6,14,26,0.72) 100%)',
        backdropFilter: 'blur(20px) saturate(160%)',
        WebkitBackdropFilter: 'blur(20px) saturate(160%)',
      }}>

      {/* Liquid-glass sheen — soft mode-colored bloom in the top corner + a thin
          diagonal highlight, standing in for the removed matchbg.png artwork. */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', inset: 0,
          background: `radial-gradient(ellipse 70% 50% at 18% -8%, ${color}26, transparent 60%)` }}/>
        <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 1,
          background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.20), transparent)' }}/>
      </div>

      <div style={{ position: 'relative', zIndex: 1, padding: '11px 15px 13px' }}>
        {/* Top row — mode / status badges + distance */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12, gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
            <div style={{
              padding: '3px 10px', borderRadius: 7,
              background: `${color}1c`,
              fontSize: 9.5, fontWeight: 800, letterSpacing: 1.6,
              color, textTransform: 'uppercase', fontFamily: 'var(--font-display)',
            }}>{match.mode}</div>
            {isParticipating && (
              <div style={{
                padding: '3px 9px', borderRadius: 6,
                background: `${C.accent}22`, border: `1px solid ${C.accent}55`,
                fontSize: 9, fontWeight: 800, letterSpacing: 1,
                color: C.accentHi, textTransform: 'uppercase', fontFamily: 'var(--font-display)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accentHi, boxShadow: `0 0 5px ${C.accentHi}` }}/>
                Grasz
              </div>
            )}
            {!isParticipating && hasTeammate && (
              <div style={{
                padding: '3px 9px', borderRadius: 6,
                background: `${C.accent}18`, border: `1px solid ${C.accent}40`,
                fontSize: 9, fontWeight: 800, letterSpacing: 1,
                color: C.accent, textTransform: 'uppercase', fontFamily: 'var(--font-display)',
                display: 'flex', alignItems: 'center', gap: 4,
              }}>
                <div style={{ width: 5, height: 5, borderRadius: '50%', background: C.accent, boxShadow: `0 0 4px ${C.accent}` }}/>
                Twój team
              </div>
            )}
            {match.status === 'completed' && (
              <div style={{ padding: '2px 7px', borderRadius: 6, background: `${C.win}12`,
                border: `1px solid ${C.win}30`, fontSize: 9, fontWeight: 700, color: C.win, letterSpacing: 1 }}>
                {match.walkover ? 'WALKOWER' : 'ZAKOŃCZONY'}
              </div>
            )}
            {match.status === 'result_pending' && (
              <div style={{ padding: '2px 7px', borderRadius: 6, background: `${C.hoop}12`,
                border: `1px solid ${C.hoop}35`, fontSize: 9, fontWeight: 700, color: C.hoop, letterSpacing: 1 }}>
                CZEKA NA POTWIERDZENIE
              </div>
            )}
            {match.status === 'disputed' && (
              <div style={{ padding: '2px 7px', borderRadius: 6, background: `${C.loss}12`,
                border: `1px solid ${C.loss}35`, fontSize: 9, fontWeight: 700, color: C.loss, letterSpacing: 1 }}>
                ⚠ SPÓR O WYNIK
              </div>
            )}
            {match.status === 'full' && (
              <div style={{ padding: '2px 7px', borderRadius: 6, background: `${C.loss}12`,
                border: `1px solid ${C.loss}30`, fontSize: 9, fontWeight: 700, color: C.loss, letterSpacing: 1 }}>
                PEŁNY
              </div>
            )}
          </div>
          <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 10, fontWeight: 700, color: C.accent, flexShrink: 0 }}>
            <svg width="8" height="11" viewBox="0 0 24 30" fill={C.accent}>
              <path d="M12 0C7.6 0 4 3.6 4 8c0 6 8 22 8 22s8-16 8-22c0-4.4-3.6-8-8-8zm0 12a4 4 0 1 1 0-8 4 4 0 0 1 0 8z"/>
            </svg>
            {fmtDist(dist)}
          </span>
        </div>

        {/* ── Center duel: team names on their own row, roster hexagons + "VS"
              divider on the next — keeps VS vertically centered against the
              hexagon rows regardless of label height. ──────── */}
        <div style={{ marginBottom: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4, marginBottom: 9 }}>
            <span style={{
              flex: 1, minWidth: 0, textAlign: 'center',
              fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: C.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{homeTeamName}</span>
            <span style={{
              flex: 1, minWidth: 0, textAlign: 'center',
              fontSize: 9, fontWeight: 800, letterSpacing: 1, textTransform: 'uppercase', color: C.text,
              overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
            }}>{awayTeamName}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 4 }}>
            <div style={{ display: 'flex', justifyContent: 'center', flex: 1, minWidth: 0 }}>
              <RosterGrid players={homePlayers} slots={slots} color={TEAM_BLUE} size={58}/>
            </div>
            <span style={{
              fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 900, letterSpacing: 2,
              color: 'rgba(160,200,255,0.35)', flexShrink: 0,
            }}>VS</span>
            <div style={{ display: 'flex', justifyContent: 'center', flex: 1, minWidth: 0 }}>
              <RosterGrid players={awayPlayers} slots={slots} color={TEAM_RED} size={58}/>
            </div>
          </div>
        </div>

        {/* Score */}
        {match.status === 'completed' && match.score_home != null && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 14, marginBottom: 14 }}>
            <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-display)',
              color: match.score_home > match.score_away ? C.win : C.text,
              textShadow: match.score_home > match.score_away ? `0 0 16px ${C.win}48` : 'none' }}>
              {match.score_home}
            </span>
            <span style={{ fontSize: 13, fontWeight: 700, color: C.dim }}>:</span>
            <span style={{ fontSize: 26, fontWeight: 900, lineHeight: 1, fontFamily: 'var(--font-display)',
              color: match.score_away > match.score_home ? C.win : C.text,
              textShadow: match.score_away > match.score_home ? `0 0 16px ${C.win}48` : 'none' }}>
              {match.score_away}
            </span>
          </div>
        )}

        {/* Date/time + location — centered, no box, date on top (primary) */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, textAlign: 'center' }}>
          <span style={{
            fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, letterSpacing: 0.5,
            color: C.text, lineHeight: 1.3,
          }}>
            {fmtMatchDate(match.scheduled_at)} · {fmtMatchTime(match.scheduled_at)}
          </span>
          <span style={{
            fontSize: 11.5, color: 'rgba(224,238,255,0.62)', lineHeight: 1.3,
            maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
          }}>
            {match.address || 'Lokalizacja na mapie'}
          </span>
        </div>

        {/* CTA bar — only when the match still has open slots; once both teams are
            full there's nothing to join, so the bar is dropped entirely (tapping
            the card still opens details). */}
        {totalJoined < slots * 2 && (
          <div style={{
            marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '11px 15px', borderRadius: 13,
            background: `linear-gradient(90deg, ${C.accent}20, ${C.accent}0a)`,
            border: `1px solid ${C.accent}40`,
            boxShadow: `inset 0 1px 0 rgba(255,255,255,0.06), 0 0 18px ${C.accent}14`,
          }}>
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 10.5, letterSpacing: 1.8,
              textTransform: 'uppercase', color: C.accentHi,
            }}>
              {isParticipating ? 'Twój mecz · szczegóły' : 'Dołącz do meczu'}
            </span>
            <svg width="7" height="12" viewBox="0 0 12 20" fill="none" stroke={C.accentHi} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 2l8 8-8 8"/>
            </svg>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ── MAP PICKER ────────────────────────────────────────────────────────────────
function MapPicker({ center, onPin, existingPin, flyTo }) {
  const elRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)

  // Initialise map once
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

  // Fly to location when flyTo prop changes (e.g. "Moja lokalizacja" button)
  useEffect(() => {
    if (!flyTo || !mapRef.current) return
    const pinIcon = L.divIcon({
      html: `<div style="width:22px;height:22px;background:linear-gradient(135deg,#00CCFF,#0055AA);border-radius:50%;border:2.5px solid rgba(255,255,255,0.9);box-shadow:0 2px 14px rgba(0,180,255,0.75)"></div>`,
      className: '', iconSize: [22, 22], iconAnchor: [11, 11],
    })
    mapRef.current.flyTo([flyTo.lat, flyTo.lng], 15, { animate: true, duration: 0.8 })
    if (markerRef.current) markerRef.current.setLatLng([flyTo.lat, flyTo.lng])
    else markerRef.current = L.marker([flyTo.lat, flyTo.lng], { icon: pinIcon }).addTo(mapRef.current)
  }, [flyTo])

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
  const [flyTo,      setFlyTo]      = useState(null)

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
        // Trigger map flyTo — ts ensures the effect fires even if coords unchanged
        setFlyTo({ ...loc, ts: Date.now() })
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
      const scheduledAt = new Date(`${date}T${time}`)

      // ── Validate daily limit + time gap ────────────────────────────────────
      // Fetch match_player rows for this user, then join to club_matches directly
      // (Supabase embedded-resource filters don't filter parent rows — query the
      //  parent table directly to avoid silently broken date filtering)
      const dayStart = new Date(`${date}T00:00:00`).toISOString()
      const dayEnd   = new Date(`${date}T23:59:59`).toISOString()
      const { data: myPlayerRows } = await supabase
        .from('match_players').select('match_id').eq('user_id', uid)
      const myMatchIds = (myPlayerRows || []).map(r => r.match_id)

      let validToday = []
      if (myMatchIds.length) {
        const { data: todayMatches } = await supabase
          .from('club_matches')
          .select('id,scheduled_at,mode')
          .in('id', myMatchIds)
          .gte('scheduled_at', dayStart)
          .lte('scheduled_at', dayEnd)
          .neq('status', 'cancelled')
        validToday = todayMatches || []
      }

      if (validToday.length >= 3) {
        setErr('Możesz zagrać maksymalnie 3 mecze dziennie.')
        setSaving(false); return
      }

      const gapMs = (MODE_GAP[mode] || 75) * 60 * 1000
      const conflict = validToday.find(r => {
        const other = new Date(r.scheduled_at).getTime()
        return Math.abs(scheduledAt.getTime() - other) < gapMs
      })
      if (conflict) {
        setErr(`Za mała przerwa między meczami. Odstęp musi wynosić co najmniej ${MODE_GAP[mode] || 75} minut.`)
        setSaving(false); return
      }
      // ───────────────────────────────────────────────────────────────────────

      const match = await apiCreateMatch({
        clubId: club.id, createdBy: uid, mode,
        lat: pin.lat, lng: pin.lng, address: addr || null,
        scheduledAt: scheduledAt.toISOString(),
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
            <MapPicker center={userLoc} onPin={handlePin} existingPin={pin} flyTo={flyTo}/>
            {/* Dark overlay — pointer-events:none keeps map fully interactive */}
            <div style={{
              position: 'absolute', inset: 0, zIndex: 500,
              background: 'rgba(4,9,20,0.45)',
              pointerEvents: 'none',
            }} />
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
function MatchDetailSheet({ match, uid, userClubId, userClubName, onClose, onJoined, onLeft, onDeleted }) {
  const { profile, refreshProfile, setProfileData } = useAuth()
  const [local,         setLocal]         = useState(match)
  const [joining,       setJoining]       = useState(false)
  const [leaving,       setLeaving]       = useState(false)
  const [confirmLeave,  setConfirmLeave]  = useState(false)
  const [confirmDelete,  setConfirmDelete]  = useState(false)
  const [twoHourWarn,    setTwoHourWarn]    = useState(false)
  const [deleting,       setDeleting]       = useState(false)
  const [noShowSaving,   setNoShowSaving]   = useState(false)
  const [err,           setErr]           = useState(null)

  const myPlayer = local.players.find(p => p.user_id === uid)
  const n = MODE_SLOTS[local.mode]
  const color = MODE_COLOR[local.mode]
  const isFull = local.status === 'full' || local.status === 'completed'
  const isPast = new Date(local.scheduled_at) < new Date()
  // Drużyna A (home) tylko dla członków klubu tworzącego mecz
  const isHomeClubMember = userClubId === local.club_id
  // Away team is locked for 3rd clubs: once a club claims it, only their members can join
  const isAwayLocked = !!(local.away_club_id && local.away_club_id !== userClubId)
  const homeTeamName = local._club?.name || 'Drużyna A'
  // If away is claimed by our club → show our name; if by another → show their name; if free → invite
  const awayIsFree = !local.away_club_id
  const awayDisplayName = local._awayClub?.name
    || (local.away_club_id === userClubId ? userClubName : null)
    || (awayIsFree ? 'Dołącz' : 'Rywale')
  const awayTeamName = awayDisplayName
  const isCreator = local.created_by === uid
  const awayHasPlayers = local.players.some(p => p.team === 'away')
  // Creator can delete if no enemy joined, cancel if they did
  const canCreatorRemove = isCreator && !isPast && local.status !== 'completed'

  // < 2h before start AND away joined → warn about L first
  const twoHoursMs = 2 * 60 * 60 * 1000
  const isUnder2h  = awayHasPlayers && !isPast &&
    (new Date(local.scheduled_at).getTime() - Date.now() < twoHoursMs)

  async function handleCreatorRemove() {
    if (isUnder2h && !twoHourWarn) { setTwoHourWarn(true); return }
    setDeleting(true); setErr(null)
    try {
      if (awayHasPlayers) {
        if (isUnder2h) {
          await apiMarkWalkover(local.id, 'home_cancelled')
        } else {
          await apiCancelMatch(local.id)
        }
      } else {
        await apiDeleteMatch(local.id)
      }
      onDeleted?.(local.id)
    } catch (e) { setErr(e.message); setDeleting(false) }
  }

  async function handleNoShow() {
    setNoShowSaving(true); setErr(null)
    try {
      await apiMarkWalkover(local.id, 'away_noshow')
      setLocal(prev => ({ ...prev, status:'completed', walkover:'away_noshow' }))
      onLeft?.({ ...local, status:'completed', walkover:'away_noshow' })
    } catch(e) { setErr(e.message) } finally { setNoShowSaving(false) }
  }

  function getTeamSlots(team) {
    return Array.from({ length: n }, (_, i) => {
      const p = local.players.find(pl => pl.team === team && pl.slot === i + 1)
      return { slot: i + 1, player: p || null }
    })
  }

  // HEX clipPath calibrated to HexFrameOnly's SVG coordinate system:
  // viewBox "-16 -16 122 122", AVATAR polygon "45,6 82,32 82,58 45,84 8,58 8,32" in 90×90 space.
  // Each point: (coord + 16) / 122 → percent of rendered size.
  // Top 18%, right 80%, bottom 82%, left 20% — matches frame PNG exactly.
  const HEX = 'polygon(50% 18%, 80% 39%, 80% 61%, 50% 82%, 20% 61%, 20% 39%)'

  function PlayerSlot({ team, player, canJoin }) {
    const SZ = n >= 5 ? 44 : 50
    const tColor = team === 'home' ? C.accent : C.hoop
    const filled = !!player
    const isMe = player?.user_id === uid
    const initial = player?.profile?.name?.[0]?.toUpperCase() || '?'
    return (
      <div style={{ position: 'relative', width: SZ, height: SZ, flexShrink: 0 }}>
        {/* Pulse ring — only for users who can actually join this team */}
        {!filled && canJoin && (
          <motion.div
            animate={{ scale: [1, 1.28, 1], opacity: [0, 0.38, 0] }}
            transition={{ duration: 2.6, repeat: Infinity, ease: 'easeInOut', delay: Math.random() * 1.2 }}
            style={{
              position: 'absolute', inset: -5,
              clipPath: HEX,
              background: `${tColor}20`,
              pointerEvents: 'none',
            }}
          />
        )}
        {/* Me — gentle glow behind hex */}
        {isMe && (
          <div style={{
            position: 'absolute', inset: -2,
            clipPath: HEX,
            background: `linear-gradient(135deg, ${tColor}38, ${tColor}18)`,
          }}/>
        )}
        {/* Hex body — inset: 0 so it aligns perfectly with HexFrameOnly */}
        <div style={{
          position: 'absolute', inset: 0,
          clipPath: HEX,
          background: filled
            ? isMe
              ? `linear-gradient(145deg, ${tColor}E8, ${tColor}90)`
              : `linear-gradient(145deg, ${tColor}26, ${tColor}10)`
            : `linear-gradient(145deg, rgba(12,22,40,0.85), rgba(5,10,22,0.92))`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          {filled
            ? <span style={{
                fontSize: n >= 5 ? 12 : 14, fontWeight: 900,
                fontFamily: 'var(--font-display)',
                color: isMe ? '#000' : tColor, lineHeight: 1,
              }}>{initial}</span>
            : <span style={{
                fontSize: 14, lineHeight: 1, fontWeight: 300,
                color: `${tColor}25`,
              }}>+</span>
          }
        </div>
        {/* Frame overlay — sits at inset:0, same reference box as hex body */}
        {filled && <HexFrameOnly size={SZ} variant={(isMe ? profile?.equipped_frame : player?.profile?.equipped_frame) || 'none'} />}
      </div>
    )
  }

  async function handleJoin(team) {
    if (myPlayer || joining || isFull) return
    setJoining(true); setErr(null)
    try {
      // Demo match — simulate join without DB call
      if (local._isDemo) {
        const fakePlayer = {
          match_id: local.id, user_id: uid, team, slot: 1,
          profile: { id: uid, name: profile?.name || 'Ty', equipped_frame: profile?.equipped_frame || 'none' },
        }
        const updated = { ...local, players: [fakePlayer] }
        setLocal(updated)
        onJoined?.(updated, true)
        return
      }

      await apiJoinMatch(local.id, uid, team, local.mode)
      const { data } = await supabase.from('match_players').select('*').eq('match_id', local.id)
      const userIds = [...new Set((data || []).map(p => p.user_id))]
      const { data: profiles } = userIds.length
        ? await supabase.from('profiles').select('id,name,equipped_frame').in('id', userIds)
        : { data: [] }
      const pm = Object.fromEntries((profiles || []).map(pr => [pr.id, pr]))
      const playersWithProfiles = (data || []).map(p => ({ ...p, profile: pm[p.user_id] || null }))
      const updated = { ...local, players: playersWithProfiles }
      if ((data || []).length >= n * 2) updated.status = 'full'
      setLocal(updated); onJoined?.(updated, true)

      // Dzień odpoczynku ('O') — dołączenie do meczu zalicza serię
      await creditRestDayStreak(profile, setProfileData)
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
      // Demo match — simulate leave without DB call
      if (local._isDemo) {
        const updated = { ...local, status: 'open', players: [] }
        setLocal(updated); onLeft?.(updated)
        return
      }
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
        className="hide-scrollbar"
        style={{ marginTop: 'auto', width: '100%', maxWidth: 430,
          background: 'rgba(4,10,22,0.92)',
          backdropFilter: 'blur(48px) saturate(1.9)',
          WebkitBackdropFilter: 'blur(48px) saturate(1.9)',
          borderRadius: '28px 28px 0 0',
          borderTop: '0.5px solid rgba(0,210,255,0.30)',
          borderLeft: '0.5px solid rgba(0,210,255,0.12)',
          borderRight: '0.5px solid rgba(0,210,255,0.12)',
          maxHeight: '91vh', overflowY: 'auto',
          boxShadow: '0 -24px 80px rgba(0,160,255,0.14), inset 0 1px 0 rgba(0,210,255,0.18)' }}>

        {/* Handle */}
        <div style={{ paddingTop: 14, display: 'flex', justifyContent: 'center' }}>
          <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(0,210,255,0.18)' }}/>
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
                  textShadow: local.score_home > local.score_away ? `0 0 20px ${C.win}48` : 'none' }}>
                  {local.score_home}
                </span>
              </div>
              <span style={{ fontSize: 22, fontWeight: 900, color: C.dim }}>:</span>
              <div style={{ textAlign: 'center' }}>
                <p style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
                  color: `${C.hoop}80`, margin: '0 0 4px' }}>Drużyna B</p>
                <span style={{ fontSize: 38, fontWeight: 900, fontFamily: 'var(--font-display)', lineHeight: 1,
                  color: local.score_away > local.score_home ? C.win : C.text,
                  textShadow: local.score_away > local.score_home ? `0 0 20px ${C.win}48` : 'none' }}>
                  {local.score_away}
                </span>
              </div>
            </div>
          )}

          {/* Teams — stacked rows, players horizontal */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 0, marginBottom: 20 }}>
            {['home', 'away'].map((team, ti) => {
              const tColor = team === 'home' ? C.accent : C.hoop
              const isFreeAway = team === 'away' && awayIsFree
              const teamName = team === 'home' ? homeTeamName : awayTeamName
              const slots = getTeamSlots(team)
              const filledCount = slots.filter(s => s.player).length
              return (
                <div key={team}>
                  {/* VS divider between teams */}
                  {ti === 1 && (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '10px 0' }}>
                      <div style={{ flex: 1, height: '0.5px', background: `linear-gradient(to right, transparent, ${C.accent}30)` }}/>
                      <motion.div
                        animate={{ opacity: [0.5, 1, 0.5] }}
                        transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                        style={{
                          fontSize: 9, fontWeight: 900, letterSpacing: 3,
                          fontFamily: 'var(--font-display)',
                          color: 'rgba(80,130,180,0.65)',
                          padding: '3px 10px',
                          background: 'rgba(0,180,255,0.06)',
                          borderRadius: 6,
                          border: '0.5px solid rgba(0,180,255,0.12)',
                        }}>VS</motion.div>
                      <div style={{ flex: 1, height: '0.5px', background: `linear-gradient(to left, transparent, ${C.hoop}30)` }}/>
                    </div>
                  )}

                  {/* Team card — full width, horizontal players */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 14,
                    padding: '16px 18px',
                    background: isFreeAway
                      ? 'linear-gradient(135deg, rgba(255,140,0,0.06) 0%, rgba(255,100,0,0.03) 100%)'
                      : team === 'home'
                        ? 'linear-gradient(135deg, rgba(0,204,255,0.07) 0%, rgba(0,120,200,0.03) 100%)'
                        : 'rgba(255,168,32,0.04)',
                    border: isFreeAway
                      ? '0.5px dashed rgba(255,168,32,0.30)'
                      : `0.5px solid ${tColor}20`,
                    borderRadius: 20,
                    boxShadow: `inset 0 1px 0 ${tColor}0C, 0 2px 12px rgba(0,0,0,0.18)`,
                  }}>
                    {/* Left: team info */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <p style={{
                        fontFamily: 'var(--font-display)', fontWeight: 800,
                        fontSize: 13, letterSpacing: 0.4,
                        textTransform: 'uppercase',
                        color: isFreeAway ? `rgba(255,168,32,0.55)` : tColor,
                        margin: '0 0 4px',
                        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      }}>
                        {teamName}
                      </p>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        {/* Fill dots */}
                        {Array.from({ length: n }).map((_, i) => (
                          <div key={i} style={{
                            width: 5, height: 5, borderRadius: '50%',
                            background: i < filledCount ? tColor : 'rgba(255,255,255,0.08)',
                            boxShadow: i < filledCount ? `0 0 5px ${tColor}60` : 'none',
                            transition: 'all 0.3s',
                          }}/>
                        ))}
                        <span style={{ fontSize: 9, color: 'rgba(100,140,180,0.60)', fontWeight: 600, marginLeft: 2 }}>
                          {filledCount}/{n}
                        </span>
                      </div>
                    </div>

                    {/* Right: player slots horizontal */}
                    {(() => {
                      const teamFull = slots.filter(s => s.player).length >= n
                      const locked = (team === 'home' && !isHomeClubMember) || (team === 'away' && isAwayLocked)
                      const canJoinTeam = !myPlayer && !isFull && !isPast && !!userClubId && !teamFull && !locked
                      return (
                    <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: n >= 5 ? 'wrap' : 'nowrap', justifyContent: 'flex-end', maxWidth: n >= 5 ? 148 : 'none' }}>
                      {slots.map(({ slot, player }) => (
                        <PlayerSlot key={slot} team={team} player={player} canJoin={canJoinTeam} />
                      ))}
                    </div>
                      )
                    })()}
                  </div>
                </div>
              )
            })}
          </div>

          {err && <p style={{ fontSize: 11, color: C.loss, textAlign: 'center', marginBottom: 12 }}>{err}</p>}

          {/* No club warning */}
          {!myPlayer && !isFull && !isPast && !userClubId && (
            <div style={{ padding: '13px 16px', borderRadius: 14, marginBottom: 10,
              background: 'rgba(255,168,32,0.08)', border: '0.5px solid rgba(255,168,32,0.28)',
              textAlign: 'center' }}>
              <p style={{ margin: 0, fontSize: 12, color: C.hoop, fontWeight: 600, lineHeight: 1.5 }}>
                Dołącz do klubu, żeby zagrać w meczu
              </p>
            </div>
          )}

          {/* Join buttons */}
          {!myPlayer && !isFull && !isPast && userClubId && (() => {
            // Which teams can I still join?
            const joinable = ['home', 'away'].filter(team => {
              const teamFull = local.players.filter(p => p.team === team).length >= n
              const locked = (team === 'home' && !isHomeClubMember) || (team === 'away' && isAwayLocked)
              return !teamFull && !locked
            })
            return (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {['home', 'away'].map(team => {
                  const tColor = team === 'home' ? C.accent : C.hoop
                  const teamFull = local.players.filter(p => p.team === team).length >= n
                  const locked = (team === 'home' && !isHomeClubMember) || (team === 'away' && isAwayLocked)
                  const disabled = joining || teamFull || locked
                  const isOpenAway = team === 'away' && awayIsFree && !teamFull && !locked
                  const isActive = !disabled
                  const lockedLabel = team === 'home'
                    ? '🔒 Tylko Twój klub'
                    : `🔒 ${local._awayClub?.abbr || local._awayClub?.name || 'Inny klub'}`

                  // Hide fully locked teams if there's at least one joinable
                  if (locked && joinable.length > 0) return null

                  return (
                    <motion.button key={team}
                      whileTap={isActive ? { scale: 0.98 } : {}}
                      onClick={() => isActive && handleJoin(team)}
                      disabled={disabled}
                      style={{
                        width: '100%', padding: '16px', border: 'none',
                        borderRadius: 18, cursor: disabled ? 'default' : 'pointer',
                        fontFamily: 'var(--font-display)',
                        fontSize: 13, fontWeight: 800, letterSpacing: 1,
                        textTransform: 'uppercase',
                        transition: 'all 0.2s',
                        opacity: joining ? 0.65 : 1,
                        ...(teamFull ? {
                          background: 'rgba(14,24,42,0.60)',
                          border: '0.5px solid rgba(255,255,255,0.06)',
                          color: 'rgba(80,110,140,0.55)',
                        } : isOpenAway ? {
                          background: 'linear-gradient(145deg, rgba(255,150,20,0.28) 0%, rgba(255,100,0,0.16) 100%)',
                          border: '0.5px solid rgba(255,168,32,0.50)',
                          boxShadow: '0 6px 28px rgba(255,140,0,0.22), inset 0 1px 0 rgba(255,200,80,0.25)',
                          color: C.hoop,
                        } : isActive ? {
                          background: `linear-gradient(145deg, ${tColor}28 0%, ${tColor}14 100%)`,
                          border: `0.5px solid ${tColor}50`,
                          boxShadow: `0 6px 28px ${tColor}18, inset 0 1px 0 ${tColor}22`,
                          color: tColor,
                        } : {
                          background: 'rgba(14,24,42,0.60)',
                          border: '0.5px solid rgba(255,255,255,0.06)',
                          color: 'rgba(80,110,140,0.55)',
                        }),
                      }}>
                      {joining ? '…'
                        : teamFull ? `${team === 'home' ? homeTeamName : awayTeamName} — Pełna`
                        : `Dołącz — ${team === 'home' ? homeTeamName : awayTeamName}`}
                    </motion.button>
                  )
                })}
              </div>
            )
          })()}

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
                  {myPlayer.team === 'home' ? homeTeamName : awayTeamName} ✓
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

          {/* No-show button — for home captain on past unresolved matches */}
          {isCreator && isPast && local.status !== 'completed' && local.status !== 'cancelled' && awayHasPlayers && (
            <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }}
              style={{ marginTop:10, padding:'12px 14px', borderRadius:12,
                background:`${C.loss}08`, border:`1px solid ${C.loss}25` }}>
              <p style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.70)',
                margin:'0 0 4px' }}>Rywale nie stawili się?</p>
              <p style={{ fontSize:10, color:C.sub, margin:'0 0 12px', lineHeight:1.5 }}>
                Walkower — rywale otrzymują L, Ty nie otrzymujesz W.
              </p>
              <motion.button whileTap={{ scale:0.97 }} onClick={handleNoShow}
                disabled={noShowSaving}
                style={{ width:'100%', padding:'11px', border:'none', borderRadius:8,
                  background:`${C.loss}18`, outline:`1px solid ${C.loss}40`,
                  color:C.loss, fontSize:11, fontWeight:800, cursor:'pointer',
                  opacity: noShowSaving ? 0.7 : 1,
                  WebkitTapHighlightColor:'transparent' }}>
                {noShowSaving ? '…' : 'Oznacz niestawienie — walkower'}
              </motion.button>
            </motion.div>
          )}

          {/* Creator: delete (no enemy) or cancel (enemy joined) */}
          {canCreatorRemove && (
            <AnimatePresence>
              {!confirmDelete && !twoHourWarn && (
                <motion.button
                  key="del-trigger"
                  initial={{ opacity:0 }} animate={{ opacity:1 }}
                  whileTap={{ scale:0.97 }}
                  onClick={() => setConfirmDelete(true)}
                  style={{ width:'100%', marginTop:10, padding:'11px',
                    borderRadius:12, border:'none', cursor:'pointer',
                    background:'transparent',
                    outline:`1px solid ${C.loss}30`,
                    color:`${C.loss}88`, fontSize:10.5, fontWeight:700,
                    letterSpacing:0.5, WebkitTapHighlightColor:'transparent' }}>
                  {awayHasPlayers ? 'Anuluj mecz' : 'Usuń spotkanie'}
                </motion.button>
              )}

              {/* 2h warning step */}
              {twoHourWarn && (
                <motion.div key="two-hour-warn"
                  initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                  style={{ marginTop:10, padding:'14px', borderRadius:14,
                    background:`${C.loss}0E`, border:`1px solid ${C.loss}50` }}>
                  <p style={{ fontSize:12, fontWeight:800, color:C.loss,
                    margin:'0 0 6px', textAlign:'center' }}>⚠ Anulowanie &lt; 2h od meczu</p>
                  <p style={{ fontSize:10.5, color:C.sub, margin:'0 0 14px',
                    textAlign:'center', lineHeight:1.55 }}>
                    Anulowanie tak blisko startu skutkuje <strong style={{color:C.loss}}>przegraną (L)</strong> dla Twojej drużyny. Rywale zostaną powiadomieni.
                  </p>
                  {err && <p style={{ fontSize:10, color:C.loss, textAlign:'center', margin:'0 0 10px' }}>{err}</p>}
                  <div style={{ display:'flex', gap:8 }}>
                    <motion.button whileTap={{ scale:0.96 }}
                      onClick={() => { setTwoHourWarn(false); setConfirmDelete(false) }}
                      style={{ flex:1, padding:'11px', borderRadius:10, border:'none',
                        cursor:'pointer', background:C.surface,
                        color:C.sub, fontSize:11, fontWeight:700 }}>
                      Wróć
                    </motion.button>
                    <motion.button whileTap={{ scale:0.96 }}
                      onClick={handleCreatorRemove} disabled={deleting}
                      style={{ flex:1, padding:'11px', borderRadius:10, border:'none',
                        cursor:'pointer', background:`${C.loss}18`,
                        outline:`1px solid ${C.loss}50`,
                        color:C.loss, fontSize:11, fontWeight:800,
                        opacity: deleting ? 0.7 : 1 }}>
                      {deleting ? '…' : 'Anuluj mimo to (L)'}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {confirmDelete && !twoHourWarn && (
                <motion.div
                  key="del-confirm"
                  initial={{ opacity:0, y:6 }} animate={{ opacity:1, y:0 }}
                  style={{ marginTop:10, padding:'14px', borderRadius:14,
                    background:`${C.loss}0C`, border:`1px solid ${C.loss}35` }}>
                  <p style={{ fontSize:11.5, fontWeight:700, color:C.text,
                    margin:'0 0 4px', textAlign:'center' }}>
                    {awayHasPlayers ? 'Anulować mecz?' : 'Usunąć spotkanie?'}
                  </p>
                  <p style={{ fontSize:10, color:C.sub, margin:'0 0 14px',
                    textAlign:'center', lineHeight:1.5 }}>
                    {awayHasPlayers
                      ? 'Rywale zostaną powiadomieni. Brak W/L dla obu drużyn.'
                      : 'Spotkanie zostanie trwale usunięte.'}
                  </p>
                  {err && <p style={{ fontSize:10, color:C.loss, textAlign:'center',
                    margin:'0 0 10px' }}>{err}</p>}
                  <div style={{ display:'flex', gap:8 }}>
                    <motion.button whileTap={{ scale:0.96 }}
                      onClick={() => setConfirmDelete(false)}
                      style={{ flex:1, padding:'11px', borderRadius:10, border:'none',
                        cursor:'pointer', background:C.surface,
                        color:C.sub, fontSize:11, fontWeight:700 }}>
                      Wróć
                    </motion.button>
                    <motion.button whileTap={{ scale:0.96 }}
                      onClick={handleCreatorRemove} disabled={deleting}
                      style={{ flex:1, padding:'11px', borderRadius:10, border:'none',
                        cursor:'pointer', background:`${C.loss}18`,
                        outline:`1px solid ${C.loss}50`,
                        color:C.loss, fontSize:11, fontWeight:800,
                        opacity: deleting ? 0.7 : 1 }}>
                      {deleting ? '…' : awayHasPlayers ? 'Anuluj mecz' : 'Usuń'}
                    </motion.button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          )}
        </div>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── RESULT SHEET ──────────────────────────────────────────────────────────────
// role: 'home' | 'home_only' | 'away_confirm' | 'disputed_home' | 'disputed_away'
function ResultSheet({ match, role = 'home', onClose, onUpdate }) {
  const hasAway  = match.players.some(p => p.team === 'away')
  const homeClub = match._club?.name      || 'Drużyna A'
  const awayClub = match._awayClub?.name  || 'Drużyna B'

  const hoursLeft = match.result_submitted_at
    ? Math.max(0, Math.floor(
        (new Date(match.result_submitted_at).getTime() + 24*3600*1000 - Date.now()) / 3600000))
    : null

  // ── shared primitives ──────────────────────────────────────────────────────
  function ScoreInputs({ sh, sa, setSh, setSa }) {
    const h = parseInt(sh), a = parseInt(sa)
    const hW = !isNaN(h) && !isNaN(a) && h > a
    const aW = !isNaN(h) && !isNaN(a) && a > h
    return (
      <div style={{ display:'flex', alignItems:'flex-end', justifyContent:'center',
        gap:12, marginBottom:20 }}>
        {[{v:sh,sv:setSh,lbl:homeClub,col:C.accent,w:hW},
          {v:sa,sv:setSa,lbl:awayClub,col:C.hoop,  w:aW}].map(({v,sv,lbl,col,w},i) => (
          <div key={i} style={{ flex:1, textAlign:'center' }}>
            <p style={{ fontSize:9, fontWeight:700, letterSpacing:1.5, textTransform:'uppercase',
              color:`${col}80`, margin:'0 0 8px',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{lbl}</p>
            <input type="number" min="0" max="999" value={v}
              onChange={e => sv(e.target.value)} placeholder="0"
              style={{ width:'100%', padding:'10px 0', textAlign:'center',
                fontSize:46, fontWeight:900, letterSpacing:-2, lineHeight:1,
                background: w ? `${col}14` : C.bg, border:'none',
                outline:`2px solid ${w ? col : C.dim}`, borderRadius:14,
                color: w ? col : C.text, fontFamily:'var(--font-display)',
                boxSizing:'border-box', colorScheme:'dark',
                textShadow: w ? `0 0 24px ${col}56` : 'none', transition:'all 0.2s' }}/>
          </div>
        ))}
        <span style={{ fontSize:28, fontWeight:900, color:C.dim, paddingBottom:10 }}>:</span>
      </div>
    )
  }

  function PrimaryBtn({ active, saving, onClick, label, color = C.win }) {
    return (
      <motion.button whileTap={{ scale:0.97 }} onClick={onClick}
        disabled={!active || saving}
        style={{ width:'100%', padding:'15px', border:'none', borderRadius:0,
          borderTop:`2px solid ${active ? color : C.dim}`,
          background: active ? `linear-gradient(135deg,${color},${color}BB)` : C.dim,
          color: active ? '#000' : C.sub, fontFamily:'var(--font-display)',
          fontWeight:900, fontSize:12, letterSpacing:2.5, textTransform:'uppercase',
          cursor: active && !saving ? 'pointer' : 'default',
          boxShadow: active ? `0 -4px 20px ${color}28` : 'none',
          opacity: saving ? 0.7 : 1, marginBottom:10,
          WebkitTapHighlightColor:'transparent' }}>
        {saving ? '…' : label}
      </motion.button>
    )
  }

  function SecBtn({ onClick, label }) {
    return (
      <motion.button whileTap={{ scale:0.97 }} onClick={onClick}
        style={{ width:'100%', padding:'12px', border:'none', borderRadius:0,
          outline:'1px solid rgba(255,255,255,0.07)',
          background:'transparent', color:C.sub, fontSize:11, fontWeight:500,
          cursor:'pointer', WebkitTapHighlightColor:'transparent', marginBottom:8 }}>
        {label}
      </motion.button>
    )
  }

  // ── HOME entry ──────────────────────────────────────────────────────────────
  function HomeEntry() {
    const [sh, setSh] = useState('')
    const [sa, setSa] = useState('')
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState(null)
    const h = parseInt(sh), a = parseInt(sa)
    const ok = !isNaN(h) && !isNaN(a) && h >= 0 && a >= 0
    const autoConfirm = !hasAway || role === 'home_only'

    async function submit() {
      if (!ok || saving) return
      setSaving(true); setErr(null)
      try {
        await apiSubmitHomeScore(match.id, h, a, autoConfirm)
        onUpdate?.({ score_home:h, score_away:a,
          status: autoConfirm ? 'completed' : 'result_pending',
          result_submitted_at: new Date().toISOString() })
        onClose()
      } catch(e) { setErr(e.message) } finally { setSaving(false) }
    }

    return (
      <>
        <p style={{ fontSize:9.5, fontWeight:800, letterSpacing:3.5, textTransform:'uppercase',
          color:C.dim, textAlign:'center', margin:'0 0 4px' }}>Wpisz wynik</p>
        <p style={{ fontSize:11.5, fontWeight:600, color:C.sub, textAlign:'center', margin:'0 0 6px' }}>
          {fmtMatchDate(match.scheduled_at)} · {fmtMatchTime(match.scheduled_at)}
        </p>
        {!autoConfirm && (
          <p style={{ fontSize:10, color:`${C.hoop}88`, textAlign:'center', margin:'0 0 22px', lineHeight:1.5 }}>
            Kapitan rywali potwierdzi wynik · limit <strong style={{color:C.hoop}}>24h</strong>
          </p>
        )}
        {autoConfirm && (
          <p style={{ fontSize:10, color:`${C.win}77`, textAlign:'center', margin:'0 0 22px' }}>
            Brak drużyny przeciwnej — wynik zostanie zatwierdzony od razu.
          </p>
        )}
        <ScoreInputs sh={sh} sa={sa} setSh={setSh} setSa={setSa}/>
        {err && <p style={{ fontSize:11, color:C.loss, textAlign:'center', margin:'0 0 10px' }}>{err}</p>}
        <PrimaryBtn active={ok} saving={saving} onClick={submit}
          label={autoConfirm ? 'Zatwierdź wynik' : 'Zatwierdź i wyślij rywalom'}/>
        <SecBtn onClick={onClose} label="Wpisz później"/>
      </>
    )
  }

  // ── AWAY confirmation ───────────────────────────────────────────────────────
  function AwayConfirm() {
    const [mode, setMode]   = useState('confirm')
    const [sh, setSh]       = useState(String(match.score_home ?? ''))
    const [sa, setSa]       = useState(String(match.score_away ?? ''))
    const [saving, setSaving] = useState(false)
    const [err, setErr]     = useState(null)
    const h = parseInt(sh), a = parseInt(sa)
    const ok = !isNaN(h) && !isNaN(a) && h >= 0 && a >= 0

    async function confirm() {
      setSaving(true); setErr(null)
      try {
        await apiConfirmAwayScore(match.id)
        onUpdate?.({ status:'completed' })
        onClose()
      } catch(e) { setErr(e.message) } finally { setSaving(false) }
    }

    async function submitDispute() {
      if (!ok || saving) return
      setSaving(true); setErr(null)
      try {
        if (h === match.score_home && a === match.score_away) {
          await apiConfirmAwayScore(match.id)
          onUpdate?.({ status:'completed' })
        } else {
          await apiDisputeScore(match.id)
          onUpdate?.({ status:'disputed' })
        }
        onClose()
      } catch(e) { setErr(e.message) } finally { setSaving(false) }
    }

    return (
      <>
        <p style={{ fontSize:9.5, fontWeight:800, letterSpacing:3.5, textTransform:'uppercase',
          color:C.hoop, textAlign:'center', margin:'0 0 4px' }}>Potwierdź wynik</p>
        <p style={{ fontSize:11.5, fontWeight:600, color:C.sub, textAlign:'center', margin:'0 0 18px' }}>
          {fmtMatchDate(match.scheduled_at)} · {fmtMatchTime(match.scheduled_at)}
        </p>

        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:14,
          padding:'14px 20px', marginBottom:18,
          background:`${C.accent}0A`, border:`1px solid ${C.accent}25`,
          borderTop:`1px solid ${C.accent}45`, borderRadius:14 }}>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:8.5, color:`${C.accent}77`, fontWeight:700, letterSpacing:1.5,
              textTransform:'uppercase', margin:'0 0 4px',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              maxWidth:100 }}>{homeClub}</p>
            <span style={{ fontSize:42, fontWeight:900, color:C.text,
              fontFamily:'var(--font-display)' }}>{match.score_home ?? '–'}</span>
          </div>
          <span style={{ fontSize:24, fontWeight:900, color:C.dim }}>:</span>
          <div style={{ textAlign:'center' }}>
            <p style={{ fontSize:8.5, color:`${C.hoop}77`, fontWeight:700, letterSpacing:1.5,
              textTransform:'uppercase', margin:'0 0 4px',
              overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
              maxWidth:100 }}>{awayClub}</p>
            <span style={{ fontSize:42, fontWeight:900, color:C.text,
              fontFamily:'var(--font-display)' }}>{match.score_away ?? '–'}</span>
          </div>
        </div>

        {hoursLeft !== null && (
          <p style={{ fontSize:10, color:C.dim, textAlign:'center', margin:'0 0 16px' }}>
            Brak potwierdzenia → wynik zatwierdzi się za <strong style={{color:'rgba(255,255,255,0.55)'}}>{hoursLeft}h</strong>
          </p>
        )}

        {mode === 'confirm' && (
          <>
            {err && <p style={{ fontSize:11, color:C.loss, textAlign:'center', margin:'0 0 10px' }}>{err}</p>}
            <PrimaryBtn active saving={saving} onClick={confirm} label="Potwierdzam wynik ✓" color={C.win}/>
            <SecBtn onClick={() => setMode('dispute')} label="Inny wynik"/>
            <SecBtn onClick={onClose} label="Wpisz później"/>
          </>
        )}

        {mode === 'dispute' && (
          <>
            <p style={{ fontSize:10.5, color:C.sub, textAlign:'center', margin:'0 0 14px' }}>
              Wpisz wynik według Ciebie:
            </p>
            <ScoreInputs sh={sh} sa={sa} setSh={setSh} setSa={setSa}/>
            {err && <p style={{ fontSize:11, color:C.loss, textAlign:'center', margin:'0 0 10px' }}>{err}</p>}
            <PrimaryBtn active={ok} saving={saving} onClick={submitDispute} label="Zatwierdź"/>
            <SecBtn onClick={() => setMode('confirm')} label="← Wróć"/>
          </>
        )}
      </>
    )
  }

  // ── DISPUTED ────────────────────────────────────────────────────────────────
  function Disputed() {
    const [saving, setSaving] = useState(false)
    const [err, setErr] = useState(null)
    const isHome = role === 'disputed_home'

    async function confirmHomeScore() {
      setSaving(true); setErr(null)
      try {
        await apiConfirmAwayScore(match.id)
        onUpdate?.({ status:'completed' })
        onClose()
      } catch(e) { setErr(e.message) } finally { setSaving(false) }
    }

    return (
      <>
        <p style={{ fontSize:9.5, fontWeight:800, letterSpacing:3, textTransform:'uppercase',
          color:C.loss, textAlign:'center', margin:'0 0 6px' }}>⚠ Niezgodny wynik</p>
        <p style={{ fontSize:11, color:C.sub, textAlign:'center', margin:'0 0 18px', lineHeight:1.6 }}>
          {isHome
            ? 'Kapitan rywali wpisał inny wynik. Skontaktujcie się bezpośrednio.'
            : 'Twój wynik różni się od zgłoszonego. Skontaktujcie się z gospodarzami.'}
        </p>
        <div style={{ display:'flex', justifyContent:'center', alignItems:'center', gap:14,
          padding:'12px 20px', marginBottom:14,
          background:'rgba(255,255,255,0.03)', border:'1px solid rgba(255,255,255,0.08)',
          borderRadius:12 }}>
          <span style={{ fontSize:36, fontWeight:900, color:C.text,
            fontFamily:'var(--font-display)' }}>{match.score_home}</span>
          <span style={{ fontSize:20, fontWeight:900, color:C.dim }}>:</span>
          <span style={{ fontSize:36, fontWeight:900, color:C.text,
            fontFamily:'var(--font-display)' }}>{match.score_away}</span>
        </div>
        <p style={{ fontSize:9.5, color:C.dim, textAlign:'center', margin:'0 0 18px', letterSpacing:1 }}>
          WYNIK ZGŁOSZONY PRZEZ {homeClub.toUpperCase()}
        </p>
        {err && <p style={{ fontSize:11, color:C.loss, textAlign:'center', margin:'0 0 10px' }}>{err}</p>}
        {!isHome && (
          <PrimaryBtn active saving={saving} onClick={confirmHomeScore}
            label={`Potwierdzam ${match.score_home}:${match.score_away}`} color={C.win}/>
        )}
        {isHome && (
          <p style={{ fontSize:10, color:C.dim, textAlign:'center', margin:'0 0 16px', lineHeight:1.55 }}>
            Twój wynik zostanie zatwierdzony automatycznie jeśli rywale nie zareagują w ciągu 24h.
          </p>
        )}
        <SecBtn onClick={onClose} label="Zamknij"/>
      </>
    )
  }

  return createPortal(
    <motion.div initial={{ opacity:0 }} animate={{ opacity:1 }} exit={{ opacity:0 }}
      style={{ position:'fixed', inset:0, zIndex:300,
        background:'rgba(4,8,15,0.97)', backdropFilter:'blur(20px)',
        WebkitBackdropFilter:'blur(20px)',
        overflowY:'auto', WebkitOverflowScrolling:'touch',
        paddingTop:'max(env(safe-area-inset-top,0px),28px)',
        paddingBottom:'max(env(safe-area-inset-bottom,0px),28px)',
        paddingLeft:24, paddingRight:24,
        display:'flex', flexDirection:'column', alignItems:'center' }}>
      <div style={{ width:'100%', maxWidth:360, margin:'auto',
        background:C.surface, borderRadius:20, padding:'28px 22px',
        border:`1px solid ${C.line}`,
        boxShadow:'0 20px 70px rgba(0,180,255,0.10)' }}>
        {(role === 'home' || role === 'home_only') && <HomeEntry/>}
        {role === 'away_confirm'                   && <AwayConfirm/>}
        {(role === 'disputed_home' || role === 'disputed_away') && <Disputed/>}
      </div>
    </motion.div>,
    document.body
  )
}

// ── JOIN SUCCESS MODAL ────────────────────────────────────────────────────────
function JoinSuccessModal({ match, uid, clubName, playerName, onClose }) {
  const [sharing, setSharing] = useState(false)
  const color = MODE_COLOR[match.mode] || C.accent
  const modeLabels = { '2v2': '2 na 2', '3v3': '3 na 3', '5v5': '5 na 5' }
  const myPlayer = match.players?.find(p => p.user_id === uid)
  // Always show the user's own club name regardless of which team slot they joined
  const teamLabel = myPlayer?.team === 'home' ? (match._club?.name || 'Drużyna A') : (clubName || 'Twój klub')

  async function handleShare() {
    setSharing(true)
    try {
      const blob = await shareMatchCard({ match, clubName, playerName })
      await doShare(blob, 'hoopconnect-mecz.png')
    } catch (e) { console.error(e) }
    finally { setSharing(false) }
  }

  return createPortal(
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(2,5,14,0.94)', backdropFilter: 'blur(32px)', WebkitBackdropFilter: 'blur(32px)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: 24,
      }}>
      <motion.div
        initial={{ scale: 0.82, opacity: 0, y: 40 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.82, opacity: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 24 }}
        style={{
          position: 'relative',
          width: '100%', maxWidth: 380,
          background: C.surface, borderRadius: 28, padding: '38px 24px 28px',
          border: `1.5px solid ${color}40`,
          boxShadow: `0 28px 80px rgba(0,0,0,0.65), 0 0 0 1px ${color}20, 0 0 60px ${color}12`,
          textAlign: 'center', overflow: 'hidden',
        }}>

        {/* Glow ring behind the icon */}
        <div style={{
          position: 'absolute', width: 120, height: 120,
          background: `radial-gradient(circle, ${color}35 0%, transparent 70%)`,
          left: '50%', transform: 'translateX(-50%)', top: 10, borderRadius: '50%',
          pointerEvents: 'none',
        }}/>

        {/* Animated ball */}
        <motion.div
          initial={{ scale: 0, rotate: -30 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 350, damping: 18, delay: 0.08 }}
          style={{ fontSize: 66, lineHeight: 1, marginBottom: 18, position: 'relative', zIndex: 1 }}>
          🏀
        </motion.div>

        <motion.p
          initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16 }}
          style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 38,
            color: C.text, letterSpacing: 0.5, textTransform: 'uppercase',
            margin: '0 0 4px', lineHeight: 1,
          }}>
          Jesteś w grze!
        </motion.p>

        <motion.p
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.24 }}
          style={{ fontSize: 12, color: C.sub, margin: '0 0 22px', lineHeight: 1.5 }}>
          Dołączyłeś do meczu jako{' '}
          <span style={{ color, fontWeight: 700 }}>{teamLabel}</span>
        </motion.p>

        {/* Match details */}
        <motion.div
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.30 }}
          style={{
            padding: '14px 16px', borderRadius: 16,
            background: `${color}10`, border: `1px solid ${color}28`,
            marginBottom: 20, textAlign: 'left',
          }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
            <div style={{
              padding: '3px 10px', borderRadius: 6, background: `${color}18`,
              border: `1px solid ${color}40`, fontSize: 10, fontWeight: 800,
              color, letterSpacing: 1.5, fontFamily: 'var(--font-display)', textTransform: 'uppercase',
            }}>{match.mode}</div>
            <span style={{ fontSize: 10.5, color: C.sub }}>
              {fmtMatchDate(match.scheduled_at)} · {fmtMatchTime(match.scheduled_at)}
            </span>
          </div>
          {match.address && (
            <p style={{ fontSize: 10.5, color: C.text, margin: 0, lineHeight: 1.4 }}>
              📍 {match.address}
            </p>
          )}
          {match.note && (
            <p style={{ fontSize: 10, color: C.sub, margin: '6px 0 0' }}>
              💬 {match.note}
            </p>
          )}
        </motion.div>

        {/* Share button */}
        <motion.button
          whileTap={{ scale: 0.97 }} onClick={handleShare} disabled={sharing}
          initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.38 }}
          style={{
            width: '100%', padding: '15px', border: 'none', borderRadius: 14, marginBottom: 10,
            background: sharing ? C.dim : `linear-gradient(135deg, ${color}, ${color}BB)`,
            color: match.mode === '5v5' ? '#000' : '#fff',
            fontFamily: 'var(--font-display)', fontWeight: 900,
            fontSize: 12, letterSpacing: 2, textTransform: 'uppercase',
            cursor: sharing ? 'default' : 'pointer',
            boxShadow: sharing ? 'none' : `0 6px 26px ${color}45`,
            transition: 'all 0.2s', opacity: sharing ? 0.7 : 1,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 9,
          }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor"
            strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/>
            <polyline points="16 6 12 2 8 6"/>
            <line x1="12" y1="2" x2="12" y2="15"/>
          </svg>
          {sharing ? 'Generowanie…' : 'Zaproś znajomych'}
        </motion.button>

        <motion.button
          whileTap={{ scale: 0.97 }} onClick={onClose}
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ delay: 0.44 }}
          style={{
            width: '100%', padding: '12px', border: 'none', borderRadius: 14,
            background: 'transparent', color: C.sub, fontSize: 11, fontWeight: 600,
            cursor: 'pointer',
          }}>
          Zamknij
        </motion.button>
      </motion.div>
    </motion.div>,
    document.body
  )
}

// ── MATCHES PANEL ─────────────────────────────────────────────────────────────
// Build a demo match near the user for UI simulation
function createDemoMatch(userLoc) {
  return {
    id: '__demo__',
    club_id: '__demo_club__',
    created_by: '__demo_user__',
    mode: '3v3',
    lat: userLoc.lat + 0.0012,
    lng: userLoc.lng + 0.0008,
    address: 'Hala Sportowa "Arena", ul. Koszykowa 15',
    scheduled_at: new Date(Date.now() + 1.5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'open',
    note: 'Potrzeba graczy! Hala z klimatyzacją 🏀',
    score_home: null, score_away: null,
    _dist: 0.15,
    _club: { id: '__demo_club__', name: 'Demo FC', abbr: 'DFC', country_flag: '🇵🇱' },
    players: [],
    _hasTeammate: false,
    _isDemo: true,
  }
}

// 5v5 demo — showcases the 2-on-top/3-on-bottom roster hexagon layout, with a
// couple of filled slots (incl. an equipped frame) on each side.
function createDemoMatch5v5(userLoc) {
  return {
    id: '__demo5v5__',
    club_id: '__demo_club__',
    away_club_id: '__demo_club_away__',
    created_by: '__demo_user__',
    mode: '5v5',
    lat: userLoc.lat + 0.0009,
    lng: userLoc.lng - 0.0011,
    address: 'Orlik, ul. Sportowa 8',
    scheduled_at: new Date(Date.now() + 2.5 * 24 * 60 * 60 * 1000).toISOString(),
    status: 'open',
    note: 'Pełna piątka — dołącz!',
    score_home: null, score_away: null,
    _dist: 0.34,
    _club: { id: '__demo_club__', name: 'Demo FC', abbr: 'DFC', country_flag: '🇵🇱' },
    _awayClub: { id: '__demo_club_away__', name: 'Rival United', abbr: 'RIV', country_flag: '🇩🇪' },
    players: [
      { match_id: '__demo5v5__', user_id: '__d1__', team: 'home', slot: 1, profile: { id: '__d1__', name: 'Kacper', equipped_frame: 'default' } },
      { match_id: '__demo5v5__', user_id: '__d2__', team: 'home', slot: 2, profile: { id: '__d2__', name: 'Bartek', equipped_frame: 'default' } },
      { match_id: '__demo5v5__', user_id: '__d3__', team: 'home', slot: 3, profile: { id: '__d3__', name: 'Olek', equipped_frame: 'default' } },
      { match_id: '__demo5v5__', user_id: '__d4__', team: 'away', slot: 1, profile: { id: '__d4__', name: 'Marek', equipped_frame: 'default' } },
      { match_id: '__demo5v5__', user_id: '__d5__', team: 'away', slot: 2, profile: { id: '__d5__', name: 'Tomek', equipped_frame: 'default' } },
    ],
    _hasTeammate: false,
    _isDemo: true,
  }
}

async function forwardGeocode(city) {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(city)}&format=json&limit=1`,
      { headers: { 'User-Agent': 'HoopConnect/1.0' } }
    )
    const d = await res.json()
    if (d && d[0]) return { lat: parseFloat(d[0].lat), lng: parseFloat(d[0].lon) }
  } catch { /* ignore */ }
  return null
}

function MatchesPanel({ club, uid, isActive }) {
  const { profile } = useAuth()
  const [locState, setLocState] = useState('idle')
  const [locError,  setLocError]  = useState(null)   // 'permission' | 'unavailable' | null
  const [userLoc,  setUserLoc]  = useState(null)
  const [cityFallback, setCityFallback] = useState(false)
  const [matches,  setMatches]  = useState([])
  const [loading,  setLoading]  = useState(false)
  const [sheet,    setSheet]    = useState(null)
  const [active,   setActive]   = useState(null)
  const [pending,     setPending]     = useState(null)
  const [pendingRole, setPendingRole] = useState('home')
  const [joinedMatch, setJoinedMatch] = useState(null)
  const [autoCancelNotif, setAutoCancelNotif] = useState(false)
  const RADIUS_OPTIONS = [5, 10, 25]
  const [radius, setRadius] = useState(25)
  const MODE_OPTIONS = ['Wszystkie', '2v2', '3v3', '5v5']
  const [modeFilter, setModeFilter] = useState('Wszystkie')

  const isMember = Object.values(club.members).some(m => m?.id === uid)

  // Club member IDs (excluding self) — used for teammate detection
  const myMemberIds = Object.values(club.members)
    .filter(Boolean)
    .map(m => m.id)
    .filter(id => id !== uid)

  // Ref always holds current real match IDs for the Realtime handler
  const matchIdsRef = useRef([])
  useEffect(() => {
    matchIdsRef.current = matches.filter(m => !m._isDemo).map(m => m.id)
  }, [matches])

  // Clear notification when user opens Mecze tab + persist to DB (cross-device)
  useEffect(() => {
    if (!isActive || !uid) return
    localStorage.removeItem(`hcNewTeamMatch_${uid}`)
    supabase.from('profiles')
      .update({ last_matches_seen_at: new Date().toISOString() })
      .eq('id', uid)
      .then(() => {})
  }, [isActive, uid])

  // Supabase Realtime — live slot updates while tab is active
  useEffect(() => {
    if (!isActive) return

    const channel = supabase
      .channel(`match-players-${uid}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'match_players',
      }, async payload => {
        const changedId = payload.new?.match_id || payload.old?.match_id
        if (!changedId || !matchIdsRef.current.includes(changedId)) return

        // Fetch updated players for this match
        const { data: players } = await supabase
          .from('match_players').select('*').eq('match_id', changedId)

        const uids = [...new Set((players || []).map(p => p.user_id))]
        let pm = {}
        if (uids.length) {
          const { data: pd } = await supabase.from('profiles').select('id,name').in('id', uids)
          pm = Object.fromEntries((pd || []).map(p => [p.id, p]))
        }
        const updatedPlayers = (players || []).map(p => ({ ...p, profile: pm[p.user_id] || null }))

        setMatches(prev => prev.map(m => {
          if (m.id !== changedId) return m
          const filled = updatedPlayers.length
          const cap = (MODE_SLOTS[m.mode] || 0) * 2
          return {
            ...m,
            players: updatedPlayers,
            status: filled >= cap ? 'full' : 'open',
          }
        }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [isActive, uid])

  async function tryCity() {
    const city = profile?.city
    if (!city) return false
    const coords = await forwardGeocode(city)
    if (!coords) return false
    setUserLoc(coords)
    setCityFallback(true)
    setLocState('granted')
    return true
  }

  function requestGeo() {
    if (!navigator.geolocation) {
      setLocError('permission')
      setCityFallback(false)
      tryCity().then(ok => { if (!ok) setLocState('denied') })
      return
    }
    setLocState('requesting')
    setLocError(null)
    navigator.geolocation.getCurrentPosition(
      pos => {
        setCityFallback(false)
        setUserLoc({ lat: pos.coords.latitude, lng: pos.coords.longitude })
        setLocState('granted')
      },
      async err => {
        // err.code: 1=PERMISSION_DENIED, 2=POSITION_UNAVAILABLE, 3=TIMEOUT
        setLocError(err.code === 1 ? 'permission' : 'unavailable')
        const ok = await tryCity()
        if (!ok) setLocState('denied')
      },
      { timeout: 10000, maximumAge: 60000 }
    )
  }

  useEffect(() => { requestGeo() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (locState === 'granted' && userLoc) loadMatches()
  }, [locState, userLoc, radius])

  async function loadMatches() {
    setLoading(true)
    try {
      const data = await apiFetchMatches(userLoc.lat, userLoc.lng, radius, myMemberIds, club.id)

      // ── Auto-cancel matches starting in <5min with no away players ───────────
      const now = new Date()
      const fiveMin = 5 * 60 * 1000
      let autoCancelledMine = 0
      const autoCancel = data.filter(m => {
        if (m.status !== 'pending' && m.status !== 'full') return false
        const startsIn = new Date(m.scheduled_at).getTime() - now.getTime()
        // Only cancel matches that haven't started yet (startsIn >= 0) and are within 5min window
        if (startsIn < 0 || startsIn > fiveMin) return false
        return m.players.filter(p => p.team === 'away').length === 0
      })
      await Promise.all(autoCancel.map(m =>
        supabase.from('club_matches').update({ status: 'cancelled' }).eq('id', m.id)
      ))
      autoCancelledMine = autoCancel.filter(m => m.created_by === uid).length
      if (autoCancelledMine > 0) setAutoCancelNotif(true)

      // Remove auto-cancelled from the list
      const cancelledIds = new Set(autoCancel.map(m => m.id))
      const filtered = data.filter(m => !cancelledIds.has(m.id))
      // ─────────────────────────────────────────────────────────────────────────

      // Demo match only in development — for testing the join flow
      const demoList = import.meta.env.DEV ? [createDemoMatch(userLoc), createDemoMatch5v5(userLoc)] : []
      const allMatches = [...demoList, ...filtered]
      setMatches(allMatches)
      checkPendingResult(filtered)
      // If there are team matches and user isn't on the tab — set notification flag
      const hasTeam = filtered.some(m => m._hasTeammate)
      if (hasTeam && !isActive) {
        localStorage.setItem(`hcNewTeamMatch_${uid}`, '1')
      }
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }

  function checkPendingResult(list) {
    const now = new Date()
    for (const m of list) {
      if (m.status === 'completed' || m.status === 'cancelled') continue
      const snoozeKey = `hc_result_snooze_${m.id}_${uid}`
      if (localStorage.getItem(snoozeKey)) continue

      const home = m.players.filter(p => p.team === 'home').sort((a,b) => a.slot - b.slot)
      const away = m.players.filter(p => p.team === 'away').sort((a,b) => a.slot - b.slot)
      const ownerInHome = home.some(p => p.user_id === club.ownerId)
      const homeLeadId = (ownerInHome ? home.find(p => p.user_id === club.ownerId) : home[0])?.user_id
      const awayLeadId  = away[0]?.user_id

      // result_pending → away captain needs to confirm
      if (m.status === 'result_pending' && uid === awayLeadId) {
        // 24h auto-confirm if deadline passed
        if (m.result_submitted_at) {
          const deadline = new Date(m.result_submitted_at).getTime() + 24*3600*1000
          if (Date.now() > deadline) {
            apiConfirmAwayScore(m.id).catch(() => {})
            continue
          }
        }
        setPending(m); setPendingRole('away_confirm'); setSheet('result'); break
      }

      // disputed → both captains see dispute panel
      if (m.status === 'disputed') {
        if (uid !== homeLeadId && uid !== awayLeadId) continue
        setPending(m)
        setPendingRole(uid === homeLeadId ? 'disputed_home' : 'disputed_away')
        setSheet('result'); break
      }

      // standard: match time passed → home captain enters score
      if (new Date(m.scheduled_at) > now) continue
      if (uid !== homeLeadId) continue
      const hasAway = away.length > 0
      setPending(m)
      setPendingRole(hasAway ? 'home' : 'home_only')
      setSheet('result'); break
    }
  }

  function updateMatch(updated) {
    setMatches(prev => prev.map(m => m.id === updated.id ? { ...m, ...updated } : m))
  }

  // Sort: team matches (hasTeammate) first, then by date
  function sortByTeam(arr) {
    return [...arr].sort((a, b) => {
      if (a._hasTeammate && !b._hasTeammate) return -1
      if (!a._hasTeammate && b._hasTeammate) return 1
      return 0
    })
  }

  const modeFiltered = modeFilter === 'Wszystkie' ? matches : matches.filter(m => m.mode === modeFilter)

  const upcoming = sortByTeam(
    modeFiltered.filter(m => m.status !== 'completed' && new Date(m.scheduled_at) > new Date())
  )
  const past = sortByTeam(
    modeFiltered.filter(m => m.status === 'completed' || new Date(m.scheduled_at) <= new Date())
  )

  return (
    <div style={{ padding: '0 16px var(--nav-h)' }}>

      {/* Header */}
      <div style={{ padding: '4px 0 16px' }}>
        <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.8, textTransform: 'uppercase',
          color: C.dim, margin: '0 0 10px' }}>
          {cityFallback && profile?.city
            ? `Mecze w pobliżu · ${profile.city}`
            : 'Mecze w pobliżu'}
        </p>
        {/* Radius filter — pills, reloads the list on change */}
        <div style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
          {RADIUS_OPTIONS.map(km => (
            <button key={km} onClick={() => setRadius(km)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 9, cursor: 'pointer',
                fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: 0.5,
                border: radius === km ? `1px solid ${C.accent}70` : '1px solid rgba(120,180,255,0.14)',
                background: radius === km ? `${C.accent}1c` : 'rgba(255,255,255,0.03)',
                color: radius === km ? C.accentHi : C.sub,
                transition: 'all 0.15s ease',
              }}>
              {km} km
            </button>
          ))}
        </div>

        {/* Mode filter — pills, client-side filter (no reload) */}
        <div style={{ display: 'flex', gap: 6 }}>
          {MODE_OPTIONS.map(opt => (
            <button key={opt} onClick={() => setModeFilter(opt)}
              style={{
                flex: 1, padding: '7px 0', borderRadius: 9, cursor: 'pointer',
                fontSize: 11, fontWeight: 800, fontFamily: 'var(--font-display)', letterSpacing: 0.5,
                border: modeFilter === opt ? `1px solid ${C.accent}70` : '1px solid rgba(120,180,255,0.14)',
                background: modeFilter === opt ? `${C.accent}1c` : 'rgba(255,255,255,0.03)',
                color: modeFilter === opt ? C.accentHi : C.sub,
                transition: 'all 0.15s ease',
              }}>
              {opt}
            </button>
          ))}
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
          {/* SVG pin icon */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 14 }}>
            <svg width="38" height="38" viewBox="0 0 24 24" fill="none"
              stroke={C.accent} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              style={{ opacity: 0.7 }}>
              <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/>
              <circle cx="12" cy="10" r="3"/>
            </svg>
          </div>
          <p style={{ fontSize: 13, fontWeight: 700, color: C.text, margin: '0 0 8px' }}>
            {locError === 'permission' ? 'Brak dostępu do lokalizacji' : 'Nie można ustalić lokalizacji'}
          </p>
          <p style={{ fontSize: 10.5, color: C.sub, margin: '0 0 22px', lineHeight: 1.6 }}>
            {locError === 'permission'
              ? 'Zezwól tej stronie na dostęp\ndo lokalizacji w ustawieniach przeglądarki'
              : 'Sprawdź czy GPS jest włączony\ni spróbuj ponownie'}
          </p>
          <motion.button whileTap={{ scale: 0.95 }}
            onClick={requestGeo}
            style={{ padding: '11px 26px', borderRadius: 12, border: 'none', cursor: 'pointer',
              background: `${C.accent}18`, outline: `1px solid ${C.accent}40`,
              color: C.accent, fontSize: 11, fontWeight: 700 }}>
            {locError === 'permission' ? 'Spróbuj ponownie' : 'Włącz lokalizację'}
          </motion.button>
        </div>
      )}

      {/* Loading */}
      {loading && locState === 'granted' && (
        <div style={{ display: 'flex', justifyContent: 'center', paddingTop: 40 }}>
          <div className="spinner"/>
        </div>
      )}

      {/* Auto-cancel notification */}
      <AnimatePresence>
        {autoCancelNotif && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.3 }}
            style={{
              marginBottom: 14, padding: '14px 16px',
              background: 'rgba(255,100,60,0.10)',
              border: '1px solid rgba(255,100,60,0.25)',
              borderTop: '1px solid rgba(255,100,60,0.40)',
              display: 'flex', alignItems: 'flex-start', gap: 12,
            }}
          >
            <span style={{ fontSize: 18, lineHeight: 1 }}>⚠️</span>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: 12.5, fontWeight: 700, color: 'rgba(255,255,255,0.88)', margin: '0 0 4px' }}>
                Mecz odwołany automatycznie
              </p>
              <p style={{ fontSize: 11, color: 'rgba(255,255,255,0.45)', margin: 0, lineHeight: 1.5 }}>
                Nikt nie dołączył do Twojego meczu 5 minut przed startem. Spróbuj zaplanować kolejny!
              </p>
            </div>
            <button
              onClick={() => setAutoCancelNotif(false)}
              style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.30)',
                cursor: 'pointer', fontSize: 18, lineHeight: 1, padding: 0, flexShrink: 0 }}
            >×</button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Match list */}
      {!loading && locState === 'granted' && (
        <>
          {upcoming.length > 0 && (() => {
            const mine = upcoming.filter(m => m._hasTeammate)
            const others = upcoming.filter(m => !m._hasTeammate)
            return (
              <>
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase',
                  color: C.dim, margin: '0 0 10px 2px' }}>Nadchodzące</p>
                {mine.map(m => (
                  <MatchCard key={m.id} match={m} dist={m._dist} uid={uid}
                    onPress={() => { setActive(m); setSheet('detail') }}/>
                ))}
                {mine.length > 0 && others.length > 0 && <SectionDivider/>}
                {others.map(m => (
                  <MatchCard key={m.id} match={m} dist={m._dist} uid={uid}
                    onPress={() => { setActive(m); setSheet('detail') }}/>
                ))}
              </>
            )
          })()}
          {past.length > 0 && (() => {
            const mine = past.filter(m => m._hasTeammate)
            const others = past.filter(m => !m._hasTeammate)
            return (
              <>
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.5, textTransform: 'uppercase',
                  color: C.dim, margin: '16px 0 10px 2px' }}>Ostatnie</p>
                {mine.map(m => (
                  <MatchCard key={m.id} match={m} dist={m._dist} uid={uid}
                    onPress={() => { setActive(m); setSheet('detail') }}/>
                ))}
                {mine.length > 0 && others.length > 0 && <SectionDivider/>}
                {others.map(m => (
                  <MatchCard key={m.id} match={m} dist={m._dist} uid={uid}
                    onPress={() => { setActive(m); setSheet('detail') }}/>
                ))}
              </>
            )
          })()}
          {upcoming.length === 0 && past.length === 0 && (
            <div style={{ padding: '48px 24px', textAlign: 'center',
              border: `1px solid rgba(255,255,255,0.06)`,
              borderTop: `1px solid rgba(255,255,255,0.10)` }}>
              <img src="/brokelogo.png" alt=""
                style={{ width: 52, height: 52, opacity: 0.55, marginBottom: 16,
                  filter: 'grayscale(0.3)' }}/>
              <p style={{ fontSize: 13, fontWeight: 700,
                color: 'rgba(255,255,255,0.70)', margin: '0 0 6px', letterSpacing: 0.2 }}>
                Brak meczów w pobliżu
              </p>
              <p style={{ fontSize: 10.5, color: 'rgba(255,255,255,0.28)',
                lineHeight: 1.65, margin: 0 }}>
                Żaden klub nie zaplanował meczu{'\n'}w zasięgu {radius} km. Możesz zmienić zasięg powyżej.
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
            userClubId={club.id} userClubName={club.name}
            onClose={() => { setSheet(null); setActive(null) }}
            onJoined={(updated, showModal) => {
              updateMatch(updated)
              if (showModal) {
                setJoinedMatch(updated)
                setSheet('joinSuccess')
                setActive(null)
              }
            }}
            onLeft={updateMatch}
            onDeleted={id => { setMatches(prev => prev.filter(m => m.id !== id)); setSheet(null); setActive(null) }}/>
        )}
        {sheet === 'result' && pending && (
          <ResultSheet key="result" match={pending} role={pendingRole}
            onClose={() => {
              if (uid) localStorage.setItem(`hc_result_snooze_${pending.id}_${uid}`, '1')
              setSheet(null); setPending(null)
            }}
            onUpdate={upd => {
              if (uid) localStorage.removeItem(`hc_result_snooze_${pending.id}_${uid}`)
              updateMatch({ ...pending, ...upd })
            }}/>
        )}
        {sheet === 'joinSuccess' && joinedMatch && (
          <JoinSuccessModal key="joinSuccess"
            match={joinedMatch} uid={uid}
            clubName={club.name}
            playerName={profile?.name || ''}
            onClose={() => { setSheet(null); setJoinedMatch(null) }}/>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── PANEL DOTS ────────────────────────────────────────────────────────────────
const PANEL_LABELS = ['Mecze', 'Boisko', 'Statystyki']

function PanelDots({ active, onChange }) {
  return (
    <div style={{ padding: '0 22px 12px' }}>
      {/* Liquid-glass segmented control — same pattern as StatsPage filter */}
      <div style={{
        display: 'flex',
        background: 'rgba(6,14,30,0.52)',
        backdropFilter: 'blur(24px) saturate(1.7)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.7)',
        border: '1px solid rgba(120,190,255,0.09)',
        borderTop: '1px solid rgba(160,210,255,0.15)',
        borderRadius: 99,
        padding: 3,
        boxShadow: '0 4px 18px rgba(0,0,0,0.30), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}>
        {PANEL_LABELS.map((label, i) => (
          <motion.button key={i} onClick={() => onChange(i)}
            whileTap={{ scale: 0.94 }}
            style={{
              position: 'relative', flex: 1,
              padding: '11px 0', borderRadius: 99,
              border: 'none', cursor: 'pointer',
              background: 'transparent',
              fontFamily: 'var(--font-body)', fontSize: 9.5,
              fontWeight: active === i ? 700 : 500,
              letterSpacing: 1.2, textTransform: 'uppercase',
              color: active === i ? 'var(--text-primary)' : 'var(--text-dim)',
              transition: 'color 0.18s',
              zIndex: 1,
            }}>
            {/* Sliding active pill */}
            {active === i && (
              <motion.div
                layoutId="club-panel-pill"
                transition={{ type: 'spring', stiffness: 420, damping: 34 }}
                style={{
                  position: 'absolute', inset: 0, borderRadius: 99, zIndex: -1,
                  background: 'linear-gradient(145deg, rgba(40,130,220,0.90), rgba(16,90,180,0.95))',
                  boxShadow: '0 2px 14px rgba(91,184,245,0.28), inset 0 1px 0 rgba(180,230,255,0.18)',
                }}
              />
            )}
            {label}
          </motion.button>
        ))}
      </div>
    </div>
  )
}

// ── STATS PANEL ───────────────────────────────────────────────────────────────
function StatsPanel({ club }) {
  const [completed, setCompleted] = useState([])
  const [upcoming,  setUpcoming]  = useState([])
  const [loading,   setLoading]   = useState(true)

  useEffect(() => {
    if (!club?.id) return
    async function load() {
      setLoading(true)
      const now = new Date().toISOString()
      const [{ data: comp }, { data: up }, { data: compAway }] = await Promise.all([
        supabase.from('club_matches')
          .select('id,score_home,score_away,scheduled_at,mode,walkover,club_id,away_club_id')
          .eq('club_id', club.id)
          .eq('status', 'completed')
          .order('scheduled_at', { ascending: false })
          .limit(8),
        supabase.from('club_matches')
          .select('id,scheduled_at,mode,club_id,away_club_id,status')
          .eq('club_id', club.id)
          .in('status', ['pending', 'full'])
          .gt('scheduled_at', now)
          .order('scheduled_at', { ascending: true })
          .limit(5),
        supabase.from('club_matches')
          .select('id,score_home,score_away,scheduled_at,mode,walkover,club_id,away_club_id')
          .eq('away_club_id', club.id)
          .eq('status', 'completed')
          .order('scheduled_at', { ascending: false })
          .limit(8),
      ])

      const all = [...(comp || []), ...(compAway || [])]
        .sort((a, b) => new Date(b.scheduled_at) - new Date(a.scheduled_at))
      setCompleted(all)
      setUpcoming(up || [])
      setLoading(false)
    }
    load()
  }, [club?.id])

  // W/L: from club's perspective
  let wins = 0, losses = 0
  completed.forEach(m => {
    if (m.walkover) {
      if (m.walkover === 'away_noshow' && m.club_id === club.id) wins++
      else if (m.walkover === 'home_cancelled' && m.club_id === club.id) losses++
      else if (m.walkover === 'away_noshow' && m.away_club_id === club.id) losses++
      else if (m.walkover === 'home_cancelled' && m.away_club_id === club.id) wins++
      return
    }
    if (m.score_home == null || m.score_away == null) return
    const isHome = m.club_id === club.id
    const clubScore = isHome ? m.score_home : m.score_away
    const oppScore  = isHome ? m.score_away : m.score_home
    if (clubScore > oppScore) wins++
    else if (clubScore < oppScore) losses++
  })
  const total = wins + losses
  const rate  = total > 0 ? Math.round(wins / total * 100) : 0

  function fmtDate(iso) {
    const d = new Date(iso)
    return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })
  }
  function fmtMode(m) {
    return m === '3x3' ? '3×3' : m === '5x5' ? '5×5' : m || ''
  }

  return (
    <div style={{ padding: '0 16px var(--nav-h)' }}>
      {/* W / L / Rate cards */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        {[
          { val: loading ? '–' : wins,       lbl: 'Wygrane',   col: C.win    },
          { val: loading ? '–' : losses,     lbl: 'Przegrane', col: C.loss   },
          { val: loading ? '–' : `${rate}%`, lbl: 'Win rate',  col: C.accent },
        ].map(({ val, lbl, col }) => (
          <div key={lbl} style={{
            flex: 1, padding: '16px 10px', borderRadius: 16, textAlign: 'center',
            background: C.surface, border: '1px solid rgba(255,255,255,0.05)',
          }}>
            <p style={{ fontSize: 34, fontWeight: 900, letterSpacing: -1, lineHeight: 1,
              color: col, textShadow: `0 0 20px ${col}48`, margin: 0 }}>{val}</p>
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
            {loading ? '–' : `${wins} / ${total} meczów`}
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
      <div style={{ borderRadius: 14, background: C.surface,
        border: '1px solid rgba(255,255,255,0.05)', marginBottom: 18, overflow: 'hidden' }}>
        {!loading && upcoming.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: C.sub, fontWeight: 500 }}>Brak zaplanowanych meczów</p>
          </div>
        ) : upcoming.map((m, i) => (
          <div key={m.id} style={{
            padding: '12px 16px',
            borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: C.text }}>{fmtDate(m.scheduled_at)}</span>
            <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1.5,
              textTransform: 'uppercase', color: C.sub }}>{fmtMode(m.mode)}</span>
            <span style={{ fontSize: 10, color: m.status === 'full' ? C.win : C.sub,
              fontWeight: 600 }}>{m.status === 'full' ? 'Komplet' : 'Otwarte'}</span>
          </div>
        ))}
      </div>

      {/* Recent */}
      <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2.8,
        textTransform: 'uppercase', color: C.dim, margin: '0 0 10px 2px' }}>
        Ostatnie mecze
      </p>
      <div style={{ borderRadius: 14, background: C.surface,
        border: '1px solid rgba(255,255,255,0.05)', overflow: 'hidden' }}>
        {!loading && completed.length === 0 ? (
          <div style={{ padding: '20px 16px', textAlign: 'center' }}>
            <p style={{ fontSize: 11, color: C.sub, fontWeight: 500 }}>Brak rozegranych meczów</p>
          </div>
        ) : completed.slice(0, 8).map((m, i) => {
          const isHome   = m.club_id === club.id
          let result = '–', resultColor = C.sub
          if (m.walkover) {
            const won = (m.walkover === 'away_noshow' && isHome) || (m.walkover === 'home_cancelled' && !isHome)
            result = won ? 'W' : 'L'
            resultColor = won ? C.win : C.loss
          } else if (m.score_home != null && m.score_away != null) {
            const cs = isHome ? m.score_home : m.score_away
            const os = isHome ? m.score_away : m.score_home
            result = cs > os ? 'W' : cs < os ? 'L' : 'R'
            resultColor = cs > os ? C.win : cs < os ? C.loss : C.sub
          }
          const sh = isHome ? m.score_home : m.score_away
          const sa = isHome ? m.score_away : m.score_home
          return (
            <div key={m.id} style={{
              padding: '12px 16px',
              borderTop: i > 0 ? '1px solid rgba(255,255,255,0.05)' : 'none',
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: C.text, minWidth: 52 }}>
                {fmtDate(m.scheduled_at)}
              </span>
              <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 1,
                textTransform: 'uppercase', color: C.sub }}>{fmtMode(m.mode)}</span>
              <span style={{ fontSize: 13, fontWeight: 900, color: C.text, minWidth: 48, textAlign: 'center',
                fontFamily: 'var(--font-display)' }}>
                {m.walkover ? 'WO' : (sh != null ? `${sh}:${sa}` : '–:–')}
              </span>
              <span style={{ fontSize: 13, fontWeight: 900, color: resultColor,
                textShadow: `0 0 12px ${resultColor}56`, minWidth: 16, textAlign: 'right',
                fontFamily: 'var(--font-display)' }}>
                {result}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ── READ-ONLY COURT (used inside the club preview — no taps, no swap FAB) ─────
function MiniCourt({ club }) {
  return (
    <div style={{ padding: '0 22px 0', position: 'relative' }}>
      <svg width="0" height="0" aria-hidden="true"
        style={{ position: 'absolute', pointerEvents: 'none', overflow: 'hidden' }}>
        <defs>
          <clipPath id="courtClipPreview" clipPathUnits="objectBoundingBox">
            <path d="M0.070,0 L0.930,0 Q0.930,0.059 1,0.059 L1,0.941 Q0.930,0.941 0.930,1 L0.070,1 Q0.070,0.941 0,0.941 L0,0.059 Q0.070,0.059 0,0 Z"/>
          </clipPath>
        </defs>
      </svg>
      <div style={{ position: 'relative', width: '100%', aspectRatio: '343 / 410' }}>
        <div style={{ position: 'absolute', inset: 0, clipPath: 'url(#courtClipPreview)', overflow: 'hidden' }}>
          <Court/>
          {POSITIONS.map(posKey => (
            <div key={posKey} style={{
              position: 'absolute', left: SPOT[posKey].x, top: SPOT[posKey].y,
              transform: 'translate(-50%, -50%)', zIndex: 3, pointerEvents: 'none',
            }}>
              <Token posKey={posKey} member={club.members[posKey]} onPress={() => {}}
                swapMode={false} isSrc={false} isTgt={false}/>
            </div>
          ))}
        </div>
        <svg style={{ position: 'absolute', inset: 0, width: '100%', height: '100%',
          pointerEvents: 'none', zIndex: 10, overflow: 'visible' }}
          viewBox="0 0 343 410" preserveAspectRatio="none">
          <defs>
            <filter id="neonGPrev" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3"  result="b1"/>
              <feGaussianBlur stdDeviation="10" result="b2"/>
              <feMerge><feMergeNode in="b2"/><feMergeNode in="b1"/><feMergeNode in="SourceGraphic"/></feMerge>
            </filter>
          </defs>
          <path d={COURT_PATH} fill="none" stroke="rgba(0,200,255,0.13)" strokeWidth="7" filter="url(#neonGPrev)"/>
          <path d={COURT_PATH} fill="none" stroke="rgba(0,220,255,0.42)" strokeWidth="1.4"/>
        </svg>
      </div>
    </div>
  )
}

// ── CLUB PREVIEW SHEET — read-only "view from outside": court, stats, recent matches ──
function ClubPreviewSheet({ club, onClose }) {
  return (
    <Sheet onClose={onClose}>
      {/* Header — badge, name, read-only notice */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18 }}>
        <Badge abbr={club.abbr} size={54}/>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 20,
            color: C.text, letterSpacing: -0.3, margin: 0,
            overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {club.name}
          </p>
          <p style={{ fontSize: 9.5, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase',
            color: C.sub, margin: '3px 0 0' }}>
            {club.country?.flag ? `${club.country.flag} ` : ''}Podgląd klubu
          </p>
        </div>
        <span style={{
          fontSize: 8, fontWeight: 800, letterSpacing: 1.5, textTransform: 'uppercase',
          color: C.accent, padding: '5px 10px', borderRadius: 99,
          background: `${C.accent}14`, border: `1px solid ${C.accent}38`,
        }}>
          Tylko podgląd
        </span>
      </div>

      {/* Read-only court — squad as currently set up, nothing tappable */}
      <MiniCourt club={club}/>

      {/* Club stats + recent results (mirrors the in-club Statystyki tab) */}
      <div style={{ marginTop: 18 }}>
        <StatsPanel club={club}/>
      </div>
    </Sheet>
  )
}

// ── COURT PANEL ───────────────────────────────────────────────────────────────
function CourtPanel({ club, uid, onUpdate, onTokenTap, swapMode, setSwapMode, swapSrc, swapping, swapError }) {
  const isOwner = club.ownerId === uid

  return (
    <div style={{ padding: '0 0 var(--nav-h)' }}>
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
      <div style={{ padding: '16px 22px 0', position: 'relative' }}>

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

    </div>
  )
}

// ── CLUB VIEW (panel switcher) ────────────────────────────────────────────────
function ClubView({ club, onUpdate, uid }) {
  const [panel,    setPanel]    = useState(1) // 0=Mecze 1=Boisko(default) 2=Statystyki
  const [sheet,    setSheet]    = useState(null) // 'empty'|'player'|'edit'|null
  const [sheetPos, setSheetPos] = useState(null)
  const [clubPreviewOpen, setClubPreviewOpen] = useState(false)
  const [swapMode,  setSwapMode]  = useState(false)
  const [swapSrc,   setSwapSrc]   = useState(null)
  const [swapping,  setSwapping]  = useState(false)
  const [swapError, setSwapError] = useState(null)
  const [removing, setRemoving] = useState(false)

  // ── Touch swipe (direction-aware — won't steal vertical scroll) ──────────────
  const touchRef = useRef(null)
  function handleTouchStart(e) {
    touchRef.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, locked: null }
  }
  function handleTouchMove(e) {
    const t = touchRef.current
    if (!t) return
    const dx = e.touches[0].clientX - t.x
    const dy = e.touches[0].clientY - t.y
    if (t.locked === null) {
      if (Math.abs(dy) > Math.abs(dx) + 4) { t.locked = 'y'; return }   // clearly vertical → let scroll
      if (Math.abs(dx) > Math.abs(dy) + 4) { t.locked = 'x' }           // clearly horizontal → capture
    }
    if (t.locked === 'x') e.preventDefault()  // block scroll while swiping panels
  }
  function handleTouchEnd(e) {
    const t = touchRef.current
    touchRef.current = null
    if (!t || t.locked !== 'x') return
    const dx = e.changedTouches[0].clientX - t.x
    if (dx < -50 && panel < 2) setPanel(p => p + 1)
    if (dx >  50 && panel > 0) setPanel(p => p - 1)
  }

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
    if (!member) setSheet('empty')
    else         setSheet('profile')
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

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column',
      overflow: 'hidden', background: 'transparent' }}>

      {/* ── Fixed header — stays put while panels slide ── */}
      <ClubHeader club={club} isOwner={isOwner} onEditPress={() => setSheet('edit')}/>
      <PanelDots active={panel} onChange={setPanel}/>

      {/* ── Sliding content area only ── */}
      <div
        style={{ flex: 1, overflow: 'hidden', position: 'relative' }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        <motion.div
          initial={false}
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
        {sheet === 'profile' && sheetPos && club.members[sheetPos] && (
          <PlayerProfileSheet
            key="player"
            club={club} posKey={sheetPos}
            member={club.members[sheetPos]}
            isOwner={isOwner}
            isSelf={club.members[sheetPos].id === uid}
            removing={removing}
            onClose={closeSheet}
            onRemove={() => handleRemove(sheetPos)}
            onLeave={handleLeave}
            onOpenClub={() => setClubPreviewOpen(true)}/>
        )}
        {sheet === 'edit' && (
          <EditClubSheet
            key="edit"
            club={club}
            onClose={closeSheet}
            onSaved={updated => { onUpdate(updated); setSheet(null) }}/>
        )}
      </AnimatePresence>

      {/* Read-only club preview — stacks above the profile sheet */}
      <AnimatePresence>
        {clubPreviewOpen && (
          <ClubPreviewSheet key="club-preview" club={club} onClose={() => setClubPreviewOpen(false)}/>
        )}
      </AnimatePresence>
    </div>
  )
}

// ── JOIN CODE CHIP (in ClubHeader) ────────────────────────────────────────────
function JoinCodeChip({ code }) {
  const [copied, setCopied] = useState(false)
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={() => navigator.clipboard.writeText(code)
        .then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) })}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        marginTop: 9, padding: '5px 12px 5px 8px',
        background: copied ? 'rgba(0,200,130,0.08)' : 'rgba(0,200,255,0.06)',
        border: `1px solid ${copied ? 'rgba(0,200,130,0.30)' : 'rgba(0,200,255,0.18)'}`,
        borderTop: `1px solid ${copied ? 'rgba(0,200,130,0.45)' : 'rgba(0,200,255,0.32)'}`,
        borderRadius: 8, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        transition: 'all 0.2s',
      }}>
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none"
        stroke={copied ? '#00E890' : C.accent} strokeWidth="2.2"
        strokeLinecap="round" strokeLinejoin="round">
        {copied
          ? <polyline points="20 6 9 17 4 12"/>
          : <><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></>
        }
      </svg>
      <span style={{
        fontFamily: 'var(--font-display)', fontWeight: 900, letterSpacing: 3,
        fontSize: 13, color: copied ? '#00E890' : C.accent,
      }}>
        {copied ? 'SKOPIOWANO' : code}
      </span>
      {!copied && (
        <span style={{ fontSize: 8, color: `${C.accent}55`, letterSpacing: 1,
          fontWeight: 700, textTransform: 'uppercase' }}>kod</span>
      )}
    </motion.button>
  )
}

// ── NO-CLUB SCREEN — welcome + create + join by code ─────────────────────────
function NoClubScreen({ onCreated, profile }) {
  const { user } = useAuth()
  const [view, setView] = useState('welcome') // 'welcome' | 'create'

  // ── join-by-code state (inline in welcome view) ───────────────────────────
  const [codeInput,   setCodeInput]   = useState('')
  const [codeResult,  setCodeResult]  = useState(null)  // { club, members }
  const [codeLoading, setCodeLoading] = useState(false)
  const [codeErr,     setCodeErr]     = useState(null)
  const [selPos,      setSelPos]      = useState(null)
  const [joining,     setJoining]     = useState(false)

  // Auto-lookup when code reaches 5 chars
  useEffect(() => {
    const raw = codeInput.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 5)
    if (raw.length < 5) { setCodeResult(null); setCodeErr(null); setSelPos(null); return }
    setCodeLoading(true); setCodeErr(null); setCodeResult(null); setSelPos(null)
    apiFetchByCode(raw).then(r => {
      setCodeLoading(false)
      if (!r) { setCodeErr('Nie znaleziono klubu z tym kodem.'); return }
      setCodeResult(r)
    })
  }, [codeInput])

  async function handleJoin() {
    if (!selPos || !codeResult || joining) return
    setJoining(true); setCodeErr(null)
    try {
      const raw = codeInput.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 5)
      await apiJoinByCode({ code: raw, userId: user.id, position: selPos })
      // Reload club
      const apiFetchResult = await apiFetch(user.id)  // reuse existing fetch
      onCreated(apiFetchResult)
    } catch (e) {
      setCodeErr(e?.message ?? 'Błąd dołączania.')
      setJoining(false)
    }
  }

  const codeRaw = codeInput.replace(/[^A-Z0-9]/gi, '').toUpperCase().slice(0, 5)

  const STEPS = [
    {
      num: '01',
      accent: C.accent,
      title: 'Utwórz klub',
      body: 'Nadaj nazwę, skrót i kraj. Klub otrzymuje unikalny 5-znakowy kod — wyślij go znajomym, by dołączyli.',
    },
    {
      num: '02',
      accent: C.hoop,
      title: 'Organizuj mecze',
      body: 'Twórz spotkania 2v2, 3v3 lub 5v5 w swojej okolicy. Inne kluby odpowiadają na wyzwanie i zajmują wolne miejsca.',
    },
    {
      num: '03',
      accent: '#FFD166',
      title: 'Rywalizuj w lidze',
      body: 'Mecze i aktywność przekładają się na punkty ligowe. Ranking tygodniowy resetuje się w każdy poniedziałek o 00:00.',
    },
  ]

  if (view === 'create') {
    return <CreateClubForm onCreated={onCreated} profile={profile} onBack={() => setView('welcome')}/>
  }

  return (
    <div className="page-content" style={{ padding: 'max(52px, calc(env(safe-area-inset-top) + 20px)) 22px 48px', overflowY: 'auto' }}>

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35 }}
        style={{ textAlign: 'center', marginBottom: 36 }}>

        {/* App logo */}
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
          <img src="/hoop.svg" alt="HoopConnect"
            style={{ width: 48, height: 48, opacity: 0.92,
              filter: 'drop-shadow(0 4px 14px rgba(91,184,245,0.45))' }}/>
        </div>

        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 900,
          fontSize: 34, textTransform: 'uppercase', letterSpacing: 1,
          color: 'var(--text-primary)', margin: '0 0 8px', lineHeight: 1,
        }}>
          Graj z innymi
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-dim)', lineHeight: 1.6, margin: 0 }}>
          Dołącz do klubu i rozgrywaj mecze z graczami w pobliżu
        </p>
      </motion.div>

      {/* ── Step cards — minimal ────────────────────────────────────────── */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 1, marginBottom: 32,
        border: '1px solid rgba(255,255,255,0.06)',
        borderTop: '1px solid rgba(255,255,255,0.10)', borderRadius: 14, overflow: 'hidden' }}>
        {STEPS.map((s, i) => (
          <motion.div key={s.num}
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            transition={{ delay: 0.06 + i * 0.05, duration: 0.28 }}
            style={{
              display: 'flex', alignItems: 'flex-start', gap: 16,
              padding: '16px 18px',
              background: i % 2 === 0 ? 'rgba(6,14,30,0.60)' : 'rgba(4,10,22,0.50)',
              borderBottom: i < 2 ? '1px solid rgba(255,255,255,0.05)' : 'none',
            }}>
            {/* Step number */}
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 900,
              fontSize: 11, letterSpacing: 1, flexShrink: 0, marginTop: 1,
              color: `${s.accent}60`,
            }}>{s.num}</span>
            {/* Text */}
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{
                fontSize: 13, fontWeight: 700, letterSpacing: 0.2,
                color: 'rgba(255,255,255,0.90)', margin: '0 0 4px',
                fontFamily: 'var(--font-display)',
              }}>{s.title}</p>
              <p style={{
                fontSize: 11.5, color: 'rgba(255,255,255,0.38)',
                lineHeight: 1.6, margin: 0,
              }}>{s.body}</p>
            </div>
            {/* Accent dot */}
            <div style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0,
              marginTop: 5, background: s.accent, opacity: 0.5,
              boxShadow: `0 0 5px ${s.accent}` }}/>
          </motion.div>
        ))}
      </div>

      {/* ── Primary CTA ────────────────────────────────────────────────── */}
      <motion.button
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.24, duration: 0.28 }}
        whileTap={{ scale: 0.97 }}
        onClick={() => setView('create')}
        className="btn-primary"
        style={{ marginBottom: 28 }}>
        Załóż Klub
      </motion.button>

      {/* ── Join-by-code section ────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }}
        transition={{ delay: 0.30, duration: 0.28 }}>

        {/* Divider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }}/>
          <span style={{ fontSize: 9.5, fontWeight: 600, letterSpacing: 1.5,
            color: 'rgba(255,255,255,0.22)', textTransform: 'uppercase' }}>
            mam kod klubu
          </span>
          <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.07)' }}/>
        </div>

        {/* Code input — compact, monospace */}
        <div style={{ position: 'relative', marginBottom: 10 }}>
          <input
            placeholder="XXXXX"
            value={codeInput}
            maxLength={5}
            onChange={e => setCodeInput(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0,5))}
            style={{
              width: '100%', padding: '11px 40px 11px 16px',
              background: 'rgba(6,12,24,0.70)',
              border: `1px solid ${codeErr ? 'rgba(255,80,80,0.35)' : codeResult ? 'rgba(0,200,130,0.35)' : 'rgba(255,255,255,0.09)'}`,
              borderRadius: 10, boxSizing: 'border-box',
              color: codeErr ? '#FF8080' : codeResult ? '#00E890' : 'rgba(255,255,255,0.75)',
              outline: 'none', fontFamily: 'monospace', fontWeight: 600,
              fontSize: 14, letterSpacing: 6,
              transition: 'border-color 0.18s, color 0.18s',
            }}
          />
          {codeLoading && (
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <div className="spinner" style={{ width: 14, height: 14 }}/>
            </div>
          )}
          {codeResult && !codeLoading && (
            <div style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
                stroke="#00E890" strokeWidth="2.5" strokeLinecap="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
          )}
        </div>

        {/* Error */}
        {codeErr && (
          <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
            style={{ fontSize: 12, color: 'var(--red-shot)', textAlign: 'center',
              marginBottom: 12 }}>
            {codeErr}
          </motion.p>
        )}

        {/* Club preview after valid code */}
        <AnimatePresence>
          {codeResult && (
            <motion.div
              initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.25 }}>

              {/* Club card */}
              <div style={{
                padding: '14px', marginBottom: 12,
                background: 'rgba(6,14,30,0.55)',
                border: '1px solid rgba(0,200,130,0.22)',
                borderTop: '1px solid rgba(0,200,130,0.38)',
                borderRadius: 14,
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <Badge abbr={codeResult.club.abbr} size={44}/>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <p style={{ fontSize: 9, color: 'var(--text-dim)', letterSpacing: 2,
                      textTransform: 'uppercase', fontWeight: 700, marginBottom: 2 }}>
                      {codeResult.club.country_flag}&nbsp;{codeResult.club.country_name}
                    </p>
                    <p style={{ fontFamily: 'var(--font-display)', fontWeight: 900,
                      fontSize: 18, color: 'var(--text-primary)', margin: 0,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textTransform: 'uppercase' }}>
                      {codeResult.club.name}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right', flexShrink: 0 }}>
                    <p style={{ fontSize: 9, color: '#00E890', letterSpacing: 1,
                      fontWeight: 700, textTransform: 'uppercase', marginBottom: 1 }}>Znaleziono</p>
                    <p style={{ fontSize: 11, color: 'var(--text-dim)', margin: 0 }}>
                      {codeResult.members.length}/5 graczy
                    </p>
                  </div>
                </div>

                {/* Position picker */}
                <p style={{ fontSize: 9, fontWeight: 800, letterSpacing: 2,
                  color: 'var(--text-dim)', textTransform: 'uppercase', marginBottom: 8 }}>
                  Wybierz pozycję
                </p>
                <div style={{ display: 'flex', gap: 6 }}>
                  {POSITIONS.map(pos => {
                    const taken  = codeResult.members.some(m => m.position === pos)
                    const active = selPos === pos
                    const col    = POS[pos].hi
                    return (
                      <motion.button key={pos}
                        whileTap={taken ? {} : { scale: 0.93 }}
                        onClick={() => !taken && setSelPos(pos)}
                        style={{
                          flex: 1, padding: '8px 2px', borderRadius: 8,
                          fontFamily: 'var(--font-display)', fontWeight: 900,
                          fontSize: 10, letterSpacing: 0.5,
                          border: active ? `1.5px solid ${col}70` : taken
                            ? '1px solid rgba(255,255,255,0.05)'
                            : '1px solid rgba(120,190,255,0.12)',
                          background: active ? `${col}18` : taken
                            ? 'rgba(255,255,255,0.03)' : 'rgba(6,14,30,0.5)',
                          color: active ? col : taken
                            ? 'rgba(255,255,255,0.20)' : 'var(--text-secondary)',
                          cursor: taken ? 'not-allowed' : 'pointer',
                          transition: 'all 0.15s',
                        }}>
                        {pos}
                        {taken && (
                          <div style={{ fontSize: 6, color: 'rgba(255,255,255,0.20)',
                            marginTop: 2, letterSpacing: 0.5 }}>ZAJĘTE</div>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </div>

              {codeErr && (
                <p style={{ fontSize: 12, color: 'var(--red-shot)', textAlign: 'center',
                  marginBottom: 8 }}>{codeErr}</p>
              )}

              <motion.button
                whileTap={{ scale: 0.97 }} onClick={handleJoin}
                disabled={!selPos || joining}
                className="btn-primary"
                style={{ opacity: selPos && !joining ? 1 : 0.35 }}>
                {joining ? 'Dołączanie…' : selPos ? `Dołącz jako ${selPos}` : 'Wybierz pozycję'}
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>

      </motion.div>
    </div>
  )
}

// ── CREATE CLUB ───────────────────────────────────────────────────────────────
function CreateClubForm({ onCreated, profile, onBack }) {
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

  const fieldStyle = (filled) => ({
    width: '100%', padding: '15px 16px', fontSize: 15,
    background: 'rgba(6,14,30,0.52)',
    backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
    border: `1px solid ${filled ? 'rgba(91,184,245,0.40)' : 'rgba(120,190,255,0.09)'}`,
    borderTop: `1px solid ${filled ? 'rgba(91,184,245,0.55)' : 'rgba(160,210,255,0.16)'}`,
    borderRadius: 'var(--radius-sm)',
    color: 'var(--text-primary)', outline: 'none',
    fontFamily: 'var(--font-body)', fontWeight: 500,
    boxSizing: 'border-box',
    boxShadow: '0 4px 20px rgba(0,0,0,0.25)',
    transition: 'border-color 0.2s',
  })

  return (
    <div className="page-content" style={{ padding: 'max(52px, calc(env(safe-area-inset-top) + 20px)) 22px 40px' }}>
      <AnimatePresence>
        {picker && <CountryPicker value={ctry} onChange={c => { setCtry(c); setPicker(false) }} onClose={() => setPicker(false)}/>}
      </AnimatePresence>

      {/* Back button */}
      {onBack && (
        <button onClick={onBack} style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'transparent', border: 'none', cursor: 'pointer',
          color: 'var(--text-dim)', fontSize: 12, fontWeight: 600,
          letterSpacing: 1, marginBottom: 24, padding: 0,
          WebkitTapHighlightColor: 'transparent',
        }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="2.2" strokeLinecap="round">
            <polyline points="15 18 9 12 15 6"/>
          </svg>
          Wróć
        </button>
      )}

      {/* Header row — badge + title side by side */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 20, marginBottom: 28 }}>
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 280, damping: 18 }}
          style={{ flexShrink: 0 }}>
          <Badge abbr={preview} size={80}/>
        </motion.div>
        <div>
          <p className="section-label" style={{ marginBottom: 4 }}>Nowy klub</p>
          <h1 style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 42,
            color: 'var(--text-primary)', textTransform: 'uppercase',
            letterSpacing: -0.5, lineHeight: 0.95,
          }}>
            Załóż<br/>Klub
          </h1>
        </div>
      </div>

      <p style={{ color: 'var(--text-secondary)', fontSize: 13, marginBottom: 28, lineHeight: 1.65 }}>
        Stwórz drużynę, zaproś znajomych i rywalizujcie razem.
      </p>

      {/* Fields */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

        {/* Nazwa */}
        <div>
          <p className="section-label" style={{ marginBottom: 8 }}>Nazwa klubu</p>
          <input
            placeholder="np. Warsaw Ballers"
            value={name} onChange={e => setName(e.target.value)} maxLength={21}
            style={fieldStyle(name.length > 0)}
          />
        </div>

        {/* Skrót */}
        <div>
          <p className="section-label" style={{ marginBottom: 8 }}>Skrót (2–3 litery)</p>
          <input
            placeholder="WBL"
            value={abbr}
            onChange={e => setAbbr(e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,3))}
            maxLength={3}
            style={{
              ...fieldStyle(abbr.length > 0),
              fontSize: 22, fontWeight: 900, letterSpacing: 8,
              fontFamily: 'var(--font-display)', textAlign: 'center',
            }}
          />
        </div>

        {/* Kraj */}
        <div>
          <p className="section-label" style={{ marginBottom: 8 }}>Kraj</p>
          <button onClick={() => setPicker(true)} style={{
            ...fieldStyle(true),
            display: 'flex', alignItems: 'center', gap: 12,
            cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
            textAlign: 'left',
          }}>
            <span style={{ fontSize: 22, lineHeight: 1 }}>{ctry.flag}</span>
            <span style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>{ctry.name}</span>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-dim)" strokeWidth="2" strokeLinecap="round">
              <polyline points="6 9 12 15 18 9"/>
            </svg>
          </button>
        </div>
      </div>

      {err && (
        <p style={{ color: 'var(--red-shot)', fontSize: 12, marginTop: 12, textAlign: 'center' }}>{err}</p>
      )}

      <motion.button
        whileTap={{ scale: 0.97 }} onClick={submit} disabled={!valid || saving}
        className="btn-primary"
        style={{
          marginTop: 28,
          opacity: valid && !saving ? 1 : 0.35,
          cursor: valid && !saving ? 'pointer' : 'default',
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
      {!club
        ? <NoClubScreen profile={profile} onCreated={setClub}/>
        : <ClubView club={club} onUpdate={c => { setClub(c) }} uid={user?.id}/>
      }
    </div>
  )
}
