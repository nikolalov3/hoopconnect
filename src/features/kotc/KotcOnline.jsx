import { useState, useEffect, useCallback } from 'react'
import * as api from './api'

// ── King of the Court — wersja online (Supabase, multiplayer, KLUBY) ──────────
const NAVY = '#060B16', BLUE = '#5BB8F5', CARD = 'rgba(255,255,255,0.05)'
const LINE = 'rgba(255,255,255,0.08)', TXT = '#EEF4FF', MUTED = 'rgba(238,244,255,0.5)'
const GRAD = `linear-gradient(120deg, ${BLUE}, #2272C3)`
// Apple-ish liquid glass 2026: translucent + blur + subtle top highlight
const glass = {
  background: 'rgba(255,255,255,0.06)',
  backdropFilter: 'blur(22px) saturate(1.4)', WebkitBackdropFilter: 'blur(22px) saturate(1.4)',
  border: '1px solid rgba(255,255,255,0.14)',
  boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20), 0 8px 30px rgba(0,0,0,0.22)',
}

const shell = {
  position: 'fixed', inset: 0, maxWidth: 430, margin: '0 auto',
  // KotC ma własny klimat — jasna, szaro-biała poświata (pod srebrno-złote logo), nie niebieska.
  background: `radial-gradient(ellipse 120% 72% at 50% -12%, rgba(250,252,255,0.44) 0%, rgba(216,225,240,0.13) 30%, transparent 60%), radial-gradient(ellipse 95% 55% at 8% 90%, rgba(205,215,230,0.14) 0%, transparent 55%), radial-gradient(ellipse 95% 55% at 102% 60%, rgba(222,230,244,0.14) 0%, transparent 54%), linear-gradient(170deg, #3A404B 0%, #30353F 48%, #262B34 100%)`,
  color: TXT, fontFamily: "'Barlow', sans-serif", display: 'flex', flexDirection: 'column',
  overflowY: 'auto', paddingTop: 'env(safe-area-inset-top, 0px)', zIndex: 9000,
}
const h1 = { fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontWeight: 900, letterSpacing: 0.5 }
const btnPrimary = { border: '1px solid rgba(255,255,255,0.22)', borderRadius: 14, padding: '15px', fontSize: 16, fontWeight: 800, color: NAVY, background: GRAD, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: 1, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 5px 16px rgba(34,114,195,0.20)' }
const btnGhost = { ...glass, borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 700, color: TXT, cursor: 'pointer', fontFamily: 'inherit' }

// hexagon klubu ze skrótem
function HexBadge({ abbr, size = 30 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 90 90" style={{ flexShrink: 0 }}>
      <defs>
        <linearGradient id="kotc-hex" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#C8ECFF" /><stop offset="45%" stopColor="#5BB8F5" /><stop offset="100%" stopColor="#0D4A8A" />
        </linearGradient>
      </defs>
      <polygon points="45,3 82,24 82,66 45,87 8,66 8,24" fill="url(#kotc-hex)" stroke="rgba(255,255,255,0.25)" strokeWidth="1.5" />
      <text x="45" y="53" textAnchor="middle" dominantBaseline="middle" fill="#fff" fontSize="30" fontWeight="900" fontFamily="'Barlow Condensed', sans-serif">{abbr || '?'}</text>
    </svg>
  )
}

const introSeen = () => { try { return localStorage.getItem('hc_kotc_intro_seen') === '1' } catch { return false } }
const markIntroSeen = () => { try { localStorage.setItem('hc_kotc_intro_seen', '1') } catch {} }

export default function KotcOnline({ onClose, initialSessionId = null }) {
  // Dev: /kotclab?kv=create wchodzi od razu w widok (na produkcji brak param → 'home').
  const [view, setView] = useState(() => {
    try { const v = new URLSearchParams(window.location.search).get('kv'); return ['create', 'join'].includes(v) ? v : 'home' } catch { return 'home' }
  })
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [err, setErr] = useState('')

  if (sessionId) return <Session sessionId={sessionId} onExit={() => { setSessionId(null); setView('home') }} onClose={onClose} />

  return (
    <div style={shell}>
      <Header onClose={onClose} showLogo={view === 'join'} />
      <div style={{ padding: '24px 22px', flex: 1 }}>
        {err && <ErrBox msg={err} />}
        {view === 'home' && (
          <>
            <img src="/kotklogo.png" alt="" style={{ width: 118, height: 118, objectFit: 'contain', display: 'block', margin: '36px auto 16px', filter: 'drop-shadow(0 8px 22px rgba(91,184,245,0.22))' }} />
            <h1 style={{ ...h1, fontSize: 30, textAlign: 'center', lineHeight: 1 }}>King of the Court</h1>
            <p style={{ textAlign: 'center', color: MUTED, fontSize: 13.5, margin: '12px 0 36px' }}>Pickup 3v3 · 4-6 klubów · wygrany zostaje · do 90 pkt</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button style={btnPrimary} onClick={() => setView(introSeen() ? 'create' : 'intro')}>Utwórz sesję</button>
              <button style={btnGhost} onClick={() => setView('join')}>Dołącz kodem</button>
            </div>
          </>
        )}
        {view === 'create' && <Create onErr={setErr} onCreated={setSessionId} />}
        {view === 'join' && <Join onErr={setErr} onJoined={setSessionId} />}
      </div>
      {view === 'intro' && <KotcIntro onDone={() => { markIntroSeen(); setView('create') }} onSkip={() => { markIntroSeen(); setView('create') }} />}
    </div>
  )
}

function Create({ onErr, onCreated }) {
  const [busy, setBusy] = useState(false)
  const [votes, setVotes] = useState(3)
  const rec = votes >= 2 && votes <= 3
  const go = async () => {
    setBusy(true); onErr('')
    try { const s = await api.createSession({ confirmVotes: votes, minTeams: votes < 6 ? 2 : 4 }); onCreated(s.id) }
    catch (e) { onErr(e.message || 'Nie udało się utworzyć sesji') } finally { setBusy(false) }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* logo + tytuł — wyśrodkowane w górnej przestrzeni */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: 24 }}>
        <img src="/kotklogo.png" alt="King of the Court"
          style={{ height: 96, objectFit: 'contain', filter: 'drop-shadow(0 10px 26px rgba(240,190,60,0.32))', marginBottom: 18 }} />
        <h2 style={{ ...h1, fontSize: 26, marginBottom: 8, textAlign: 'center' }}>Nowa sesja</h2>
        <p style={{ color: MUTED, fontSize: 14, textAlign: 'center', maxWidth: 330 }}>Dostaniesz <b>kod</b>. Kluby dołączają nim do gry, a Ty startujesz sesję.</p>
      </div>
      {/* panel wyboru tuż nad przyciskiem — naturalny dolny blok */}
      <div style={{ ...glass, borderRadius: 20, padding: '24px 22px 20px', width: '100%', marginBottom: 14 }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: MUTED, textAlign: 'center' }}>Ile osób musi potwierdzić wynik</div>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'center', gap: 9, margin: '10px 0 8px' }}>
          <span style={{ fontFamily: "'Manrope', sans-serif", fontWeight: 800, fontSize: 58, lineHeight: 1, color: BLUE, textShadow: '0 2px 12px rgba(91,184,245,0.22)' }}>{votes}</span>
          {rec && <span style={{ fontSize: 11, fontWeight: 900, letterSpacing: 1, textTransform: 'uppercase', color: '#00E676' }}>polecane</span>}
        </div>
        <input type="range" min={1} max={6} value={votes} onChange={e => setVotes(+e.target.value)}
          style={{ width: '100%', accentColor: BLUE, height: 26, cursor: 'pointer' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: MUTED, marginTop: 8 }}>
          <span>1 · szybko</span><span>6 · wolno</span>
        </div>
        <div style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, color: 'rgba(0,230,118,0.85)', marginTop: 10 }}>Polecane: 2–3 osoby</div>
      </div>
      <button style={{ ...btnPrimary, width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, opacity: busy ? 0.6 : 1, marginBottom: 'env(safe-area-inset-bottom, 0px)' }} disabled={busy} onClick={go}>
        {busy ? 'Tworzę…' : <TripleChevron />}
      </button>
    </div>
  )
}

function Join({ onErr, onJoined }) {
  const [code, setCode] = useState('')
  const [clubs, setClubs] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.getMyClubs().then(setClubs).catch(() => setClubs([])) }, [])

  const join = async (clubId) => {
    setBusy(true); onErr('')
    try { const row = await api.joinByCode(code, clubId); onJoined(row.session_id) }
    catch (e) { onErr(e.message || 'Nie udało się dołączyć') } finally { setBusy(false) }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100%' }}>
      {/* tytuł wyśrodkowany w górnej przestrzeni */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', minHeight: 24 }}>
        <h2 style={{ ...h1, fontSize: 26, marginBottom: 8 }}>Dołącz do sesji</h2>
        <p style={{ color: MUTED, fontSize: 14, maxWidth: 320 }}>Wpisz kod od hosta i wybierz swój klub.</p>
      </div>
      {/* kod + wybór klubu — na dole */}
      <div style={{ marginBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="KOD SESJI" maxLength={6}
          style={{ width: '100%', background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px', color: TXT, fontSize: 22, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 4, textAlign: 'center', outline: 'none', textTransform: 'uppercase' }} />
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: BLUE, margin: '18px 0 10px' }}>Wejdź jako klub</div>
        {clubs === null && <div style={{ color: MUTED, fontSize: 14 }}>Ładuję kluby…</div>}
        {clubs?.length === 0 && <div style={{ color: MUTED, fontSize: 14 }}>Nie masz klubu z min. 3 graczami. Uzupełnij skład klubu w zakładce Klub.</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {(clubs || []).map(c => {
            const ok = c.roster >= 3
            return (
              <button key={c.id} disabled={!ok || busy || code.length < 4} onClick={() => join(c.id)}
                style={{ ...btnGhost, textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center', opacity: (ok && code.length >= 4) ? 1 : 0.45 }}>
                <HexBadge abbr={c.abbr} size={30} />
                <span style={{ flex: 1, fontWeight: 700 }}>{c.name}</span>
                <span style={{ fontSize: 12, color: ok ? BLUE : '#E5A93C' }}>{c.roster} {ok ? 'graczy ✓' : '(min 3)'}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Session({ sessionId, onExit, onClose }) {
  const [state, setState] = useState(null)
  const [me, setMe] = useState(null)
  const load = useCallback(() => api.getSessionState(sessionId).then(setState).catch(() => {}), [sessionId])
  useEffect(() => { load(); const unsub = api.subscribeSession(sessionId, load); return unsub }, [sessionId, load])
  useEffect(() => { import('../../lib/supabase').then(({ supabase }) => supabase.auth.getUser().then(({ data }) => setMe(data.user?.id))) }, [])

  if (!state?.session) return <div style={shell}><Header showLogo onClose={onClose} /><div style={{ padding: 24, color: MUTED }}>Ładuję sesję…</div></div>
  const s = state.session
  const isHost = me && s.host_id === me
  if (s.status === 'finished') return <Finished state={state} onExit={onExit} onClose={onClose} />
  if (s.status === 'live') return <Live state={state} me={me} reload={load} onClose={onClose} />
  return <Lobby state={state} isHost={isHost} reload={load} onClose={onClose} />
}

function Lobby({ state, isHost, reload, onClose }) {
  const s = state.session
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const start = async () => {
    setBusy(true); setErr('')
    try { await api.startSession(s.id); reload() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const enough = state.teams.length >= s.min_teams
  return (
    <div style={shell}>
      <Header showLogo onClose={onClose} />
      <div style={{ padding: '20px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: MUTED, letterSpacing: 1, textTransform: 'uppercase' }}>Kod sesji</div>
          <div style={{ ...h1, fontSize: 46, color: BLUE, letterSpacing: 8 }}>{s.code}</div>
          <div style={{ fontSize: 13, color: MUTED }}>Podaj kod klubom, żeby dołączyły</div>
        </div>
        {err && <ErrBox msg={err} />}
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: BLUE, marginBottom: 10 }}>
          Kluby ({state.teams.length}/{s.max_teams}) · min {s.min_teams}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {state.teams.map((t) => (
            <div key={t.team_id} style={{ ...btnGhost, display: 'flex', gap: 10, alignItems: 'center', cursor: 'default' }}>
              <HexBadge abbr={t.clubs?.abbr} size={28} /><b>{t.clubs?.name || 'Klub'}</b>
            </div>
          ))}
          {state.teams.length === 0 && <div style={{ color: MUTED, fontSize: 14 }}>Czekamy aż kluby dołączą kodem…</div>}
        </div>
        {isHost && (
          <button style={{ ...btnPrimary, width: '100%', marginTop: 'auto', marginBottom: 'env(safe-area-inset-bottom, 0px)', opacity: (enough && !busy) ? 1 : 0.5 }} disabled={!enough || busy} onClick={start}>
            {enough ? 'Start sesji 🏀' : `Potrzeba min. ${s.min_teams} klubów`}
          </button>
        )}
        {!isHost && <div style={{ textAlign: 'center', color: MUTED, marginTop: 'auto', paddingTop: 22, fontSize: 14 }}>Czekaj aż host wystartuje…</div>}
      </div>
    </div>
  )
}

function Live({ state, me, reload, onClose }) {
  const s = state.session
  const g = state.currentGame
  const t = (id) => state.teamsById[id]
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const [now, setNow] = useState(Date.now())
  useEffect(() => { const i = setInterval(() => setNow(Date.now()), 1000); return () => clearInterval(i) }, [])

  const cooldownEnd = s.last_confirmed_at ? new Date(s.last_confirmed_at).getTime() + s.vote_cooldown_sec * 1000 : 0
  const locked = now < cooldownEnd
  const secsLeft = Math.max(0, Math.ceil((cooldownEnd - now) / 1000))
  const myVote = state.votes.find(v => v.voter_id === me)?.voted_team_id
  const votesFor = (id) => state.votes.filter(v => v.voted_team_id === id).length
  const ranked = [...state.teams].sort((a, b) => b.score - a.score || b.wins - a.wins)
  const leader = ranked[0]

  const vote = async (id) => {
    setBusy(true); setErr('')
    try { await api.castVote(g.id, id); reload() } catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <div style={shell}>
      <Header showLogo onClose={onClose} />
      <div style={{ padding: '16px 18px', flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
          <span style={{ fontSize: 12.5, color: MUTED }}>👑 Lider: <b style={{ color: TXT }}>{t(leader?.team_id)?.name}</b></span>
          <span style={{ ...h1, fontSize: 15, color: BLUE }}>{leader?.score}<span style={{ color: MUTED, fontSize: 12, fontWeight: 400 }}> / {s.target}</span></span>
        </div>
        <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)', overflow: 'hidden', marginBottom: 20 }}>
          <div style={{ width: `${Math.min(100, (leader?.score / s.target) * 100)}%`, height: '100%', borderRadius: 999, background: GRAD, boxShadow: '0 0 14px rgba(91,184,245,0.45)', transition: 'width .4s' }} />
        </div>
        {err && <ErrBox msg={err} />}
        {g ? (
          <>
            <div style={{ ...glass, borderRadius: 18, padding: '16px' }}>
              <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: MUTED, textAlign: 'center', marginBottom: 14 }}>Kto wygrał gierkę?</div>
              {[g.team_a, g.team_b].map((id, idx) => {
                const isKing = s.king_team_id === id
                const vf = votesFor(id)
                const mine = myVote === id
                const pct = Math.min(100, (vf / s.confirm_votes) * 100)
                return (
                  <button key={id} disabled={busy || locked} onClick={() => vote(id)}
                    style={{ width: '100%', marginBottom: idx === 0 ? 10 : 0, textAlign: 'left', borderRadius: 14, padding: '12px 14px',
                      border: `1.5px solid ${mine ? BLUE : 'rgba(255,255,255,0.10)'}`,
                      background: mine ? 'rgba(91,184,245,0.14)' : 'rgba(255,255,255,0.04)',
                      color: TXT, cursor: (busy || locked) ? 'default' : 'pointer', opacity: locked ? 0.55 : 1, fontFamily: 'inherit' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <HexBadge abbr={t(id)?.abbr} size={36} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 16 }}>{t(id)?.name}{isKing ? ' 👑' : ''}</div>
                        {isKing && s.streak > 1 && <div style={{ fontSize: 11, color: BLUE }}>seria {s.streak}</div>}
                      </div>
                      <div style={{ ...h1, fontSize: 20, color: vf >= s.confirm_votes ? BLUE : TXT }}>{vf}<span style={{ color: MUTED, fontSize: 13 }}>/{s.confirm_votes}</span></div>
                    </div>
                    <div style={{ height: 4, borderRadius: 999, background: 'rgba(255,255,255,0.09)', marginTop: 10, overflow: 'hidden' }}>
                      <div style={{ width: `${pct}%`, height: '100%', background: GRAD, transition: 'width .3s' }} />
                    </div>
                  </button>
                )
              })}
              <div style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>
                {locked
                  ? <span style={{ color: '#E5A93C' }}>🔒 Za chwilę można głosować ({Math.floor(secsLeft / 60)}:{String(secsLeft % 60).padStart(2, '0')})</span>
                  : myVote
                    ? <span style={{ color: MUTED }}>Zagłosowałeś ✓ — czekamy na {s.confirm_votes} głosów</span>
                    : <span style={{ color: MUTED }}>Tapnij klub, który wygrał</span>}
              </div>
            </div>
          </>
        ) : <div style={{ color: MUTED, textAlign: 'center' }}>Czekam na kolejną gierkę…</div>}

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED, margin: '22px 0 10px' }}>Tabela</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {ranked.map((tm, i) => {
            const isKing = s.king_team_id === tm.team_id
            return (
              <div key={tm.team_id} style={{ display: 'flex', alignItems: 'center', gap: 11, padding: '11px 13px', ...glass,
                borderRadius: 13, border: `1px solid ${isKing ? 'rgba(255,201,64,0.4)' : 'rgba(255,255,255,0.12)'}`,
                background: isKing ? 'rgba(255,201,64,0.08)' : 'rgba(255,255,255,0.05)' }}>
                <span style={{ ...h1, width: 16, color: MUTED, fontSize: 16 }}>{i + 1}</span>
                <HexBadge abbr={t(tm.team_id)?.abbr} size={26} />
                <span style={{ flex: 1, fontWeight: 600 }}>{t(tm.team_id)?.name}{isKing ? ' 👑' : ''}</span>
                <span style={{ fontSize: 12, color: MUTED }}>{tm.wins}W</span>
                <span style={{ ...h1, fontSize: 19, color: BLUE, minWidth: 34, textAlign: 'right' }}>{tm.score}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function Finished({ state, onExit, onClose }) {
  const t = (id) => state.teamsById[id]
  const ranked = [...state.teams].sort((a, b) => b.score - a.score || b.wins - a.wins)
  const king = t(state.session.winner_team_id) || (ranked[0] && t(ranked[0].team_id))
  return (
    <div style={shell}>
      <Header showLogo onClose={onClose} />
      <div style={{ padding: '30px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <img src="/kotklogo.png" alt="" style={{ width: 130, height: 130, objectFit: 'contain', margin: '0 auto', filter: 'drop-shadow(0 8px 26px rgba(91,184,245,0.4))' }} />
        <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: BLUE }}>King of the Court</div>
        <h1 style={{ ...h1, fontSize: 36, textAlign: 'center', margin: '6px 0 24px' }}>{king?.name || '—'}</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranked.map((tm, i) => (
            <div key={tm.team_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 14px',
              background: i === 0 ? 'rgba(255,201,64,0.10)' : CARD, border: `1px solid ${i === 0 ? 'rgba(255,201,64,0.4)' : LINE}`, borderRadius: 12 }}>
              <span style={{ ...h1, fontSize: 20, color: MUTED, width: 20 }}>{i + 1}</span>
              <HexBadge abbr={t(tm.team_id)?.abbr} size={30} />
              <span style={{ flex: 1, fontWeight: 700 }}>{t(tm.team_id)?.name}</span>
              <span style={{ fontSize: 12, color: MUTED }}>{tm.wins}W</span>
              <span style={{ ...h1, fontSize: 20, color: BLUE, minWidth: 38, textAlign: 'right' }}>{tm.score}</span>
            </div>
          ))}
        </div>
        <button style={{ ...btnPrimary, width: '100%', marginTop: 'auto' }} onClick={onExit}>Zamknij</button>
      </div>
    </div>
  )
}

// ── Onboarding (stories) — pokazane przed utworzeniem sesji ───────────────────
const INTRO_SLIDES = [
  { img: '/kotklogo.png', title: 'King of the Court', text: 'Turniej pickup 3v3. Kluby dołączają kodem — od 4 do 6 drużyn. Gracie o punkty, XP i koronę.' },
  { icon: '🔄', title: 'Wygrany zostaje', text: 'Wygrany zostaje na boisku, przegrany schodzi. Po 3 wygranych z rzędu król oddaje koronę. Pierwszy klub do 90 pkt wygrywa sesję.' },
  { icon: '🗳️', title: 'Kto wygrał? Wy decydujecie', text: 'Po każdej gierce gracze zatwierdzają, kto wygrał. Host ustala, ile osób musi kliknąć potwierdzenie — dopiero wtedy wynik liczy się oficjalnie. Zero sędziego, decyduje boisko.' },
  { icon: '🔥', title: 'Grasz = zgarniasz', text: 'Każda gierka to XP na konto. Weźmiesz sesję → grubszy bonus i korona 👑. Na koniec pełna tabela — widać kto rządził boiskiem. Flex w pełni zasłużony.' },
]
function KotcIntro({ onDone, onSkip }) {
  const [i, setI] = useState(0)
  const last = i === INTRO_SLIDES.length - 1
  const s = INTRO_SLIDES[i]
  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(3,6,12,0.72)', display: 'flex', flexDirection: 'column', overflowY: 'auto', WebkitOverflowScrolling: 'touch', padding: 20, zIndex: 9500 }}>
      <div style={{ width: '100%', maxWidth: 360, margin: 'auto', background: 'rgba(14,22,38,0.66)', backdropFilter: 'blur(28px) saturate(1.5)', WebkitBackdropFilter: 'blur(28px) saturate(1.5)', border: '1px solid rgba(255,255,255,0.16)', borderRadius: 26, padding: '14px 18px 22px', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.22), 0 24px 70px rgba(0,0,0,0.55)' }}>
        <div style={{ display: 'flex', gap: 5, marginBottom: 12 }}>
          {INTRO_SLIDES.map((_, idx) => (
            <div key={idx} style={{ flex: 1, height: 3, borderRadius: 2, background: idx <= i ? BLUE : 'rgba(255,255,255,0.15)', transition: 'background .2s' }} />
          ))}
        </div>
        <div style={{ textAlign: 'right', marginBottom: 2 }}>
          <button onClick={onSkip} style={{ background: 'transparent', border: 'none', color: MUTED, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Pomiń</button>
        </div>
        <div style={{ textAlign: 'center', minHeight: 210, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          {s.img
            ? <img src={s.img} alt="" style={{ width: 96, height: 96, objectFit: 'contain', marginBottom: 16, filter: 'drop-shadow(0 8px 20px rgba(91,184,245,0.28))' }} />
            : <div style={{ ...glass, width: 88, height: 88, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 40, marginBottom: 16 }}>{s.icon}</div>}
          <h3 style={{ ...h1, fontSize: 25, marginBottom: 12 }}>{s.title}</h3>
          <p style={{ color: 'rgba(238,244,255,0.66)', fontSize: 15, lineHeight: 1.6, maxWidth: 300 }}>{s.text}</p>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
          {i > 0 && <button onClick={() => setI(i - 1)} style={{ ...btnGhost, flex: '0 0 auto', padding: '13px 18px' }}>←</button>}
          <button onClick={() => (last ? onDone() : setI(i + 1))} style={{ ...btnPrimary, flex: 1 }}>{last ? 'Zaczynamy 🏀' : 'Dalej'}</button>
        </div>
      </div>
    </div>
  )
}

function Header({ onClose, showLogo }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
      minHeight: 48, padding: '12px 16px 4px', flexShrink: 0 }}>
      {showLogo && (
        <img src="/kotklogo.png" alt="King of the Court"
          style={{ height: 58, objectFit: 'contain', filter: 'drop-shadow(0 6px 18px rgba(240,190,60,0.32))' }} />
      )}
      {onClose && (
        // Ten sam X co w reszcie apki (ProfileOverlay / Ustawienia).
        <button onClick={onClose} aria-label="Zamknij"
          style={{ position: 'absolute', right: 16, top: 14,
            width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(10,20,38,0.6)', border: '1px solid rgba(150,200,255,0.2)',
            backdropFilter: 'blur(8px)', WebkitBackdropFilter: 'blur(8px)',
            color: '#cfe0f2', fontSize: 17, cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }}>✕</button>
      )}
    </div>
  )
}

// Trzy strzałki „dalej" — sportowe CTA (jaśniejsza ostatnia = kierunek naprzód).
function TripleChevron() {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 1 }}>
      {[0, 1, 2].map(k => (
        <svg key={k} width="17" height="24" viewBox="0 0 17 24" fill="none" style={{ opacity: 0.5 + k * 0.25 }}>
          <path d="M5 5 L12 12 L5 19" stroke="currentColor" strokeWidth="3.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      ))}
    </span>
  )
}
function ErrBox({ msg }) {
  return <div style={{ background: 'rgba(233,107,107,0.12)', border: '1px solid rgba(233,107,107,0.4)', color: '#F3A6A6', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{msg}</div>
}
