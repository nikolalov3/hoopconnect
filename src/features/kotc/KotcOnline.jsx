import { useState, useEffect, useCallback } from 'react'
import * as api from './api'

// ── King of the Court — wersja online (Supabase, multiplayer) ─────────────────
const NAVY = '#060B16', BLUE = '#5BB8F5', CARD = 'rgba(255,255,255,0.05)'
const LINE = 'rgba(255,255,255,0.08)', TXT = '#EEF4FF', MUTED = 'rgba(238,244,255,0.5)'
const GRAD = `linear-gradient(120deg, ${BLUE}, #2272C3)`

const shell = {
  position: 'fixed', inset: 0, maxWidth: 460, margin: '0 auto',
  background: `radial-gradient(ellipse 80% 50% at 50% 0%, rgba(91,184,245,0.12) 0%, transparent 60%), ${NAVY}`,
  color: TXT, fontFamily: "'Barlow', sans-serif", display: 'flex', flexDirection: 'column',
  overflowY: 'auto', paddingTop: 'env(safe-area-inset-top, 0px)',
}
const h1 = { fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontWeight: 900, letterSpacing: 0.5 }
const btnPrimary = { border: 'none', borderRadius: 14, padding: '15px', fontSize: 16, fontWeight: 800, color: NAVY,
  background: GRAD, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: 1, boxShadow: '0 10px 26px rgba(91,184,245,0.32)' }
const btnGhost = { border: `1px solid ${LINE}`, borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 700, color: TXT, background: CARD, cursor: 'pointer', fontFamily: 'inherit' }

export default function KotcOnline({ onClose, initialSessionId = null }) {
  const [view, setView] = useState('home')   // home | create | join
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [err, setErr] = useState('')

  if (sessionId) return <Session sessionId={sessionId} onExit={() => { setSessionId(null); setView('home') }} onClose={onClose} />

  return (
    <div style={shell}>
      <Header title="King of the Court" onClose={onClose} />
      <div style={{ padding: '24px 22px', flex: 1 }}>
        {err && <ErrBox msg={err} />}
        {view === 'home' && (
          <>
            <img src="/kotklogo.png" alt="" style={{ width: 110, height: 110, objectFit: 'contain', display: 'block', margin: '10px auto 18px', filter: 'drop-shadow(0 6px 20px rgba(91,184,245,0.35))' }} />
            <p style={{ textAlign: 'center', color: MUTED, fontSize: 14, marginBottom: 26 }}>
              Pickup 3v3 · 4-6 drużyn · wygrany zostaje · do 90 pkt
            </p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              <button style={btnPrimary} onClick={() => setView('create')}>👑 Utwórz sesję</button>
              <button style={btnGhost} onClick={() => setView('join')}>Dołącz kodem</button>
            </div>
          </>
        )}
        {view === 'create' && <Create onErr={setErr} onCreated={setSessionId} onBack={() => setView('home')} />}
        {view === 'join' && <Join onErr={setErr} onJoined={setSessionId} onBack={() => setView('home')} />}
      </div>
    </div>
  )
}

// ── CREATE ────────────────────────────────────────────────────────────────────
function Create({ onErr, onCreated, onBack }) {
  const [busy, setBusy] = useState(false)
  const go = async () => {
    setBusy(true); onErr('')
    try { const s = await api.createSession(); onCreated(s.id) }
    catch (e) { onErr(e.message || 'Nie udało się utworzyć sesji') }
    finally { setBusy(false) }
  }
  return (
    <div>
      <h2 style={{ ...h1, fontSize: 24, marginBottom: 8 }}>Nowa sesja</h2>
      <p style={{ color: MUTED, fontSize: 14, marginBottom: 20 }}>
        Utworzysz sesję i dostaniesz <b>kod</b>. Drużyny (4-6) dołączają tym kodem. Ty startujesz grę.
      </p>
      <button style={{ ...btnPrimary, width: '100%', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={go}>
        {busy ? 'Tworzę…' : 'Utwórz sesję 🏀'}
      </button>
      <button style={{ ...btnGhost, width: '100%', marginTop: 10 }} onClick={onBack}>Wróć</button>
    </div>
  )
}

// ── JOIN ──────────────────────────────────────────────────────────────────────
function Join({ onErr, onJoined, onBack }) {
  const [code, setCode] = useState('')
  const [teams, setTeams] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => { api.getMyTeams().then(setTeams).catch(() => setTeams([])) }, [])

  const join = async (teamId) => {
    setBusy(true); onErr('')
    try { const row = await api.joinByCode(code, teamId); onJoined(row.session_id) }
    catch (e) { onErr(e.message || 'Nie udało się dołączyć') }
    finally { setBusy(false) }
  }
  return (
    <div>
      <h2 style={{ ...h1, fontSize: 24, marginBottom: 8 }}>Dołącz do sesji</h2>
      <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="KOD SESJI" maxLength={6}
        style={{ width: '100%', background: CARD, border: `1px solid ${LINE}`, borderRadius: 12, padding: '14px', color: TXT, fontSize: 22, fontFamily: "'Barlow Condensed', sans-serif", letterSpacing: 4, textAlign: 'center', outline: 'none', textTransform: 'uppercase' }} />
      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: BLUE, margin: '20px 0 10px' }}>Wejdź jako drużyna</div>
      {teams === null && <div style={{ color: MUTED, fontSize: 14 }}>Ładuję drużyny…</div>}
      {teams?.length === 0 && <div style={{ color: MUTED, fontSize: 14 }}>Nie masz drużyny z min. 3 graczami. Załóż drużynę i dodaj skład.</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {(teams || []).map(t => {
          const ok = t.roster >= 3
          return (
            <button key={t.id} disabled={!ok || busy || code.length < 4} onClick={() => join(t.id)}
              style={{ ...btnGhost, textAlign: 'left', display: 'flex', justifyContent: 'space-between', alignItems: 'center', opacity: (ok && code.length >= 4) ? 1 : 0.45 }}>
              <span style={{ fontWeight: 700 }}>{t.name}</span>
              <span style={{ fontSize: 12, color: ok ? BLUE : '#E5A93C' }}>{t.roster} {ok ? 'graczy ✓' : 'graczy (min 3)'}</span>
            </button>
          )
        })}
      </div>
      <button style={{ ...btnGhost, width: '100%', marginTop: 14 }} onClick={onBack}>Wróć</button>
    </div>
  )
}

// ── SESSION (lobby / live / finished) ─────────────────────────────────────────
function Session({ sessionId, onExit, onClose }) {
  const [state, setState] = useState(null)
  const [me, setMe] = useState(null)
  const load = useCallback(() => api.getSessionState(sessionId).then(setState).catch(() => {}), [sessionId])
  useEffect(() => { load(); const unsub = api.subscribeSession(sessionId, load); return unsub }, [sessionId, load])
  useEffect(() => { import('../../lib/supabase').then(({ supabase }) => supabase.auth.getUser().then(({ data }) => setMe(data.user?.id))) }, [])

  if (!state?.session) return <div style={shell}><Header title="King of the Court" onClose={onClose} /><div style={{ padding: 24, color: MUTED }}>Ładuję sesję…</div></div>
  const s = state.session
  const isHost = me && s.host_id === me
  if (s.status === 'finished') return <Finished state={state} onExit={onExit} onClose={onClose} />
  if (s.status === 'live') return <Live state={state} me={me} reload={load} onClose={onClose} />
  return <Lobby state={state} isHost={isHost} reload={load} onExit={onExit} onClose={onClose} />
}

function Lobby({ state, isHost, reload, onExit, onClose }) {
  const s = state.session
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const start = async () => {
    setBusy(true); setErr('')
    try { await api.startSession(s.id); reload() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }
  const enough = state.teams.length >= s.min_teams
  return (
    <div style={shell}>
      <Header title="Lobby" onClose={onClose} />
      <div style={{ padding: '20px 22px', flex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 20 }}>
          <div style={{ fontSize: 12, color: MUTED, letterSpacing: 1, textTransform: 'uppercase' }}>Kod sesji</div>
          <div style={{ ...h1, fontSize: 46, color: BLUE, letterSpacing: 8 }}>{s.code}</div>
          <div style={{ fontSize: 13, color: MUTED }}>Podaj kod drużynom, żeby dołączyły</div>
        </div>
        {err && <ErrBox msg={err} />}
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: BLUE, marginBottom: 10 }}>
          Drużyny ({state.teams.length}/{s.max_teams}) · min {s.min_teams}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {state.teams.map((t, i) => (
            <div key={t.team_id} style={{ ...btnGhost, display: 'flex', gap: 10, alignItems: 'center', cursor: 'default' }}>
              <span style={{ color: MUTED, width: 18 }}>{i + 1}</span><b>{t.teams?.name || 'Drużyna'}</b>
            </div>
          ))}
          {state.teams.length === 0 && <div style={{ color: MUTED, fontSize: 14 }}>Czekamy aż drużyny dołączą kodem…</div>}
        </div>
        {isHost && (
          <button style={{ ...btnPrimary, width: '100%', marginTop: 22, opacity: (enough && !busy) ? 1 : 0.5 }}
            disabled={!enough || busy} onClick={start}>
            {enough ? 'Start sesji 🏀' : `Potrzeba min. ${s.min_teams} drużyn`}
          </button>
        )}
        {!isHost && <div style={{ textAlign: 'center', color: MUTED, marginTop: 22, fontSize: 14 }}>Czekaj aż host wystartuje…</div>}
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
  const votesFor = (teamId) => state.votes.filter(v => v.voted_team_id === teamId).length
  const ranked = [...state.teams].sort((a, b) => b.score - a.score || b.wins - a.wins)
  const leader = ranked[0]

  const vote = async (teamId) => {
    setBusy(true); setErr('')
    try { await api.castVote(g.id, teamId); reload() }
    catch (e) { setErr(e.message) } finally { setBusy(false) }
  }

  return (
    <div style={shell}>
      <Header title="King of the Court" onClose={onClose} />
      <div style={{ padding: '16px 18px', flex: 1 }}>
        <div style={{ textAlign: 'center', fontSize: 12, color: MUTED }}>
          Lider: <b style={{ color: BLUE }}>{t(leader?.team_id)?.name}</b> · {leader?.score}/{s.target} pkt
        </div>
        <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', margin: '10px 0 20px', overflow: 'hidden' }}>
          <div style={{ width: `${Math.min(100, (leader?.score / s.target) * 100)}%`, height: '100%', background: `linear-gradient(90deg, ${BLUE}, #FFC940)` }} />
        </div>

        {err && <ErrBox msg={err} />}

        {g ? (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED, textAlign: 'center', marginBottom: 12 }}>Na boisku · kto wygrał?</div>
            {[g.team_a, g.team_b].map(id => {
              const isKing = s.king_team_id === id
              const vf = votesFor(id)
              const mine = myVote === id
              return (
                <button key={id} disabled={busy || locked} onClick={() => vote(id)}
                  style={{ width: '100%', marginBottom: 10, textAlign: 'left', borderRadius: 14, padding: '14px 16px',
                    border: `1.5px solid ${mine ? BLUE : LINE}`, background: mine ? 'rgba(91,184,245,0.12)' : CARD,
                    color: TXT, cursor: (busy || locked) ? 'default' : 'pointer', opacity: locked ? 0.6 : 1,
                    display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{isKing ? '👑' : '🏀'}</span>
                  <b style={{ flex: 1 }}>{t(id)?.name}{isKing && s.streak > 1 ? ` · seria ${s.streak}` : ''}</b>
                  <span style={{ fontSize: 13, color: vf >= s.confirm_votes ? BLUE : MUTED }}>{vf}/{s.confirm_votes} 🗳️</span>
                </button>
              )
            })}
            {locked && (
              <div style={{ textAlign: 'center', color: '#E5A93C', fontSize: 13, marginTop: 4 }}>
                ⏱️ Głosowanie odblokuje się za {Math.floor(secsLeft / 60)}:{String(secsLeft % 60).padStart(2, '0')}
              </div>
            )}
            {myVote && !locked && <div style={{ textAlign: 'center', color: MUTED, fontSize: 12, marginTop: 4 }}>Zagłosowałeś. Trzeba {s.confirm_votes} głosów, by potwierdzić.</div>}
          </>
        ) : <div style={{ color: MUTED, textAlign: 'center' }}>Czekam na kolejną gierkę…</div>}

        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED, margin: '22px 0 8px' }}>Tabela</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {ranked.map((tm, i) => (
            <div key={tm.team_id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: CARD, border: `1px solid ${LINE}`, borderRadius: 10 }}>
              <span style={{ width: 16, color: MUTED, fontWeight: 700 }}>{i + 1}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{t(tm.team_id)?.name}{s.king_team_id === tm.team_id ? ' 👑' : ''}</span>
              <span style={{ fontSize: 12, color: MUTED }}>{tm.wins}W</span>
              <span style={{ ...h1, fontSize: 18, color: BLUE, minWidth: 34, textAlign: 'right' }}>{tm.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function Finished({ state, onExit, onClose }) {
  const t = (id) => state.teamsById[id]
  const ranked = [...state.teams].sort((a, b) => b.score - a.score || b.wins - a.wins)
  const king = t(state.session.winner_team_id) || ranked[0] && t(ranked[0].team_id)
  return (
    <div style={shell}>
      <Header title="Wyniki" onClose={onClose} />
      <div style={{ padding: '30px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
        <img src="/kotklogo.png" alt="" style={{ width: 130, height: 130, objectFit: 'contain', margin: '0 auto', filter: 'drop-shadow(0 8px 26px rgba(91,184,245,0.4))' }} />
        <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: BLUE }}>King of the Court</div>
        <h1 style={{ ...h1, fontSize: 38, textAlign: 'center', margin: '6px 0 24px' }}>{king?.name || '—'}</h1>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {ranked.map((tm, i) => (
            <div key={tm.team_id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
              background: i === 0 ? 'rgba(255,201,64,0.10)' : CARD, border: `1px solid ${i === 0 ? 'rgba(255,201,64,0.4)' : LINE}`, borderRadius: 12 }}>
              <span style={{ ...h1, fontSize: 20, color: MUTED, width: 24 }}>{i + 1}</span>
              <span style={{ flex: 1, fontWeight: 700 }}>{t(tm.team_id)?.name}</span>
              <span style={{ fontSize: 12, color: MUTED }}>{tm.wins}W</span>
              <span style={{ ...h1, fontSize: 20, color: BLUE, minWidth: 40, textAlign: 'right' }}>{tm.score}</span>
            </div>
          ))}
        </div>
        <button style={{ ...btnPrimary, width: '100%', marginTop: 'auto' }} onClick={onExit}>Zamknij</button>
      </div>
    </div>
  )
}

// ── helpers ───────────────────────────────────────────────────────────────────
function Header({ title, onClose }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px 18px', borderBottom: `1px solid ${LINE}`, flexShrink: 0 }}>
      {onClose && <button onClick={onClose} style={{ position: 'absolute', left: 16, top: '50%', transform: 'translateY(-50%)', background: 'transparent', border: 'none', color: TXT, fontSize: 22, cursor: 'pointer' }}>←</button>}
      <div style={{ ...h1, fontSize: 20 }}>{title}</div>
    </div>
  )
}
function ErrBox({ msg }) {
  return <div style={{ background: 'rgba(233,107,107,0.12)', border: '1px solid rgba(233,107,107,0.4)', color: '#F3A6A6', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{msg}</div>
}
