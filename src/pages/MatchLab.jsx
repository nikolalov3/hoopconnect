/**
 * MatchLab — DEV-ONLY preview surface for the match card (MatchCard from ClubPage).
 * Route: /matchlab (registered only in dev; never cherry-picked to main).
 * Lets us iterate on the 3v3 (and other modes) card layout/scaling without needing
 * a logged-in session or live match data. NOT for production.
 */
import { useState } from 'react'
import { MatchCard, CreateMatchSheet } from './ClubPage'

const P = (team, slot, name, frame = 'none') => ({
  team, slot, user_id: `${team}-${slot}`,
  profile: { name, equipped_frame: frame },
})

// Full rosters per mode so we can see the tightest layout (all slots filled).
const ROSTERS = {
  '2v2': [P('home', 1, 'Nikola', 'ff'), P('home', 2, 'Adam'), P('away', 1, 'Rafał'), P('away', 2, 'Anna')],
  '3v3': [
    P('home', 1, 'Nikola', 'ff'), P('home', 2, 'Adam'), P('home', 3, 'Marek', 'diamond_s1'),
    P('away', 1, 'Rafał'), P('away', 2, 'Anna'), P('away', 3, 'Dawid'),
  ],
  '5v5': [
    P('home', 1, 'Nikola', 'ff'), P('home', 2, 'Adam'), P('home', 3, 'Marek'), P('home', 4, 'Kuba'), P('home', 5, 'Piotr'),
    P('away', 1, 'Rafał'), P('away', 2, 'Anna'), P('away', 3, 'Dawid'), P('away', 4, 'Ola'), P('away', 5, 'Tomek'),
  ],
}

function mkMatch(mode, over = {}) {
  return {
    id: `lab-${mode}`, mode,
    players: ROSTERS[mode],
    club_id: 'home-club',
    _club: { name: 'LOVE C.', abbr: 'LVC' },
    _awayClub: { name: 'RIVALS', abbr: 'RIV' },
    away_club_id: 'away-club',
    status: 'result_pending',
    scheduled_at: '2026-08-26T19:50:00',
    address: 'Aleja 3 Maja, Stare Miasto',
    lat: 50.06, lng: 19.94,
    _hasTeammate: true,
    ...over,
  }
}

export default function MatchLab() {
  const [mode, setMode] = useState('3v3')
  const [state, setState] = useState('result_pending')
  const [showCreate, setShowCreate] = useState(false)

  const over = state === 'completed'
    ? { status: 'completed', score_home: 21, score_away: 18 }
    : state === 'open'
      ? { status: 'open', players: ROSTERS[mode].slice(0, 2), away_club_id: null, _awayClub: null }
      : { status: 'result_pending' }

  const match = mkMatch(mode, over)

  const chip = (active) => ({
    padding: '6px 12px', borderRadius: 9, cursor: 'pointer', fontSize: 12, fontWeight: 700,
    border: `1px solid ${active ? '#5BB8F5' : 'rgba(120,180,255,0.18)'}`,
    background: active ? 'rgba(91,184,245,0.18)' : 'transparent',
    color: active ? '#dbeeff' : '#8fb', fontFamily: 'inherit',
  })

  return (
    <div style={{ minHeight: '100dvh', background: '#081426', padding: '20px 0 60px', color: '#cfe0f2', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ maxWidth: 430, margin: '0 auto', padding: '0 15px' }}>
        <h1 style={{ fontSize: 14, letterSpacing: 2, textTransform: 'uppercase', opacity: 0.6, margin: '0 0 14px' }}>MatchLab · podgląd karty meczu</h1>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
          {['2v2', '3v3', '5v5'].map(m => <button key={m} style={chip(mode === m)} onClick={() => setMode(m)}>{m}</button>)}
        </div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
          {[['open', 'Otwarty'], ['result_pending', 'Do potwierdzenia'], ['completed', 'Zakończony']]
            .map(([s, label]) => <button key={s} style={chip(state === s)} onClick={() => setState(s)}>{label}</button>)}
        </div>

        <MatchCard match={match} dist={2.0} uid="home-1" myFrame="ff"
          userClubId="home-club" userClubName="LOVE C." onPress={() => {}} />

        <button onClick={() => setShowCreate(true)} style={{
          marginTop: 24, width: '100%', padding: '14px', borderRadius: 12, cursor: 'pointer',
          border: 'none', fontWeight: 800, fontSize: 14, letterSpacing: 1, textTransform: 'uppercase',
          background: 'linear-gradient(90deg, #2b8fff, #1666c8)', color: '#fff', fontFamily: 'inherit',
        }}>+ Umów mecz (panel tworzenia)</button>
      </div>

      {showCreate && (
        <CreateMatchSheet
          club={{ id: 'lab-club', name: 'LOVE C.' }} uid="home-1"
          onClose={() => setShowCreate(false)}
          onCreated={() => setShowCreate(false)} />
      )}
    </div>
  )
}
