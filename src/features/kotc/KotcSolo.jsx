import { useState, useEffect, useCallback, useRef } from 'react'
import HexAvatar from '../../components/ui/HexAvatar'
import { MatchCard, MatchPlayerSheet } from '../../pages/ClubPage'
import { supabase } from '../../lib/supabase'
import * as api from './api'
import KotcActiveSessions from './KotcActiveSessions'

// ── King of the Court — TRYB SOLO (realny, na Supabase) ──────────────────────
// create/join kodem → lobby (realtime) → host start → reveal → live (głosują
// neutralni, cooldown 3 min, punktacja momentum) → koniec + MVP. Wygląd bez zmian.

const NAVY = '#060B16', BLUE = '#5BB8F5', TXT = '#EEF4FF', MUTED = 'rgba(238,244,255,0.5)'
const DIM = 'rgba(238,244,255,0.34)', GOLD = '#FFC940'
const GRAD = `linear-gradient(120deg, ${BLUE}, #2272C3)`
const glass = { background: 'rgba(255,255,255,0.06)', backdropFilter: 'blur(22px) saturate(1.4)', WebkitBackdropFilter: 'blur(22px) saturate(1.4)', border: '1px solid rgba(255,255,255,0.14)', boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.20), 0 8px 30px rgba(0,0,0,0.22)' }
const shell = { position: 'fixed', inset: 0, maxWidth: 430, margin: '0 auto', background: `radial-gradient(ellipse 120% 68% at 50% -10%, rgba(91,184,245,0.16) 0%, transparent 60%), radial-gradient(ellipse 90% 50% at 100% 96%, rgba(34,86,150,0.14) 0%, transparent 55%), linear-gradient(170deg, #14243E 0%, #0B172A 52%, #060E1A 100%)`, color: TXT, fontFamily: "'Barlow', sans-serif", display: 'flex', flexDirection: 'column', overflowY: 'auto', paddingTop: 'env(safe-area-inset-top, 0px)', zIndex: 9000 }
const h1 = { fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontWeight: 900, letterSpacing: 0.5 }
const btnPrimary = { border: '1px solid rgba(255,255,255,0.22)', borderRadius: 14, padding: '15px', fontSize: 16, fontWeight: 800, color: NAVY, background: GRAD, cursor: 'pointer', fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', letterSpacing: 1, boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.35), 0 5px 16px rgba(34,114,195,0.20)' }
const btnGhost = { ...glass, borderRadius: 14, padding: '14px', fontSize: 15, fontWeight: 700, color: TXT, cursor: 'pointer', fontFamily: 'inherit' }

const COLORS = [
  { id: 'blue',   name: 'Blue',   ini: 'B', light: '#BFDBFE', base: '#3B82F6', dark: '#1E3A8A' },
  { id: 'green',  name: 'Green',  ini: 'G', light: '#BBF7D0', base: '#22C55E', dark: '#166534' },
  { id: 'red',    name: 'Red',    ini: 'R', light: '#FECACA', base: '#F43F5E', dark: '#9F1239' },
  { id: 'orange', name: 'Orange', ini: 'O', light: '#FED7AA', base: '#F97316', dark: '#9A3412' },
  { id: 'purple', name: 'Purple', ini: 'P', light: '#E9D5FF', base: '#A855F7', dark: '#6B21A8' },
  { id: 'yellow', name: 'Yellow', ini: 'Y', light: '#FEF08A', base: '#EAB308', dark: '#854D0E' },
]
const COL = Object.fromEntries(COLORS.map(c => [c.id, c]))
const CD = 180  // cooldown sekundy (fallback)

// Realny stan sesji → kształt, którego używają widoki.
function mapState(st, me, revealed) {
  const session = st?.session
  const status = session?.status
  const phase = !session ? 'home' : status === 'finished' ? 'end' : status === 'live' ? (revealed ? 'live' : 'reveal') : 'lobby'
  const teams = {}, order = []
  ;[...(st?.teams || [])].sort((a, b) => (a.queue_pos ?? 0) - (b.queue_pos ?? 0)).forEach(t => {
    const c = COL[t.color] || COLORS[0]
    teams[t.id] = { id: t.id, name: c.name, ini: c.ini, light: c.light, base: c.base, dark: c.dark, score: t.score, wins: t.wins, best: t.best_streak, players: (st.teamsById?.[t.id]?.players || []).map(p => ({ id: p.user_id, name: p.name, frame: p.frame })) }
    order.push(t.id)
  })
  const g = st?.currentGame
  const myRow = (st?.players || []).find(p => p.user_id === me)
  const myTeam = myRow?.session_team_id || null
  const neutralCount = g ? (st.players || []).filter(p => p.session_team_id && p.session_team_id !== g.team_a && p.session_team_id !== g.team_b).length : 0
  return {
    phase, code: session?.code, session, me,
    players: (st?.players || []).map(p => ({ id: p.user_id, name: p.name, frame: p.frame })),
    teams, order, king: session?.king_team_id, streak: session?.streak || 0,
    game: g ? { a: g.team_a, b: g.team_b, id: g.id } : null,
    votes: st?.votes || [], myTeam, neutralCount,
    isHost: session && session.host_id === me,
  }
}

// ── main ─────────────────────────────────────────────────────────────────────
export default function KotcSolo({ onClose, initialSessionId = null }) {
  const [sessionId, setSessionId] = useState(initialSessionId)
  const [st, setSt] = useState(null)
  const [me, setMe] = useState(null)
  const [revealed, setRevealed] = useState(true)   // true = wejście prosto w live pomija reveal
  const [preview, setPreview] = useState(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const prevStatus = useRef(null)
  const seq = useRef(0)   // odrzucaj spóźnione odpowiedzi — starszy fetch nie nadpisze nowszego stanu

  useEffect(() => { supabase.auth.getUser().then(({ data }) => setMe(data.user?.id)) }, [])

  const load = useCallback(() => {
    if (!sessionId) return
    const my = ++seq.current
    api.getSessionState(sessionId)
      .then(d => { if (my === seq.current) setSt(d) })
      .catch(() => { if (my === seq.current) { setSt(null); setSessionId(null) } })
  }, [sessionId])

  useEffect(() => {
    if (!sessionId) { setSt(null); return }
    load()
    const unsub = api.subscribeSession(sessionId, load)
    return unsub
  }, [sessionId, load])

  // reveal tylko przy przejściu lobby→live (nie przy wejściu prosto w live)
  useEffect(() => {
    const cur = st?.session?.status
    if (prevStatus.current === 'lobby' && cur === 'live') setRevealed(false)
    prevStatus.current = cur
  }, [st?.session?.status])

  const s = mapState(st, me, revealed)

  const run = (fn) => async (...a) => { setBusy(true); setErr(''); try { await fn(...a) } catch (e) { setErr(e.message || 'Błąd') } finally { setBusy(false) } }
  const create = run(async (confirmVotes = 2) => { const sess = await api.createSession({ confirmVotes }); setRevealed(true); setSessionId(sess.id) })
  const join = run(async (code) => { const sess = await api.joinByCode(code); setRevealed(true); setSessionId(sess.id) })
  const start = run(async () => { await api.startSession(sessionId); load() })
  const leave = run(async () => { await api.leaveSession(sessionId); setSessionId(null) })
  const abandon = run(async () => { await api.abandonSession(sessionId); setSessionId(null) })
  const vote = async (teamId) => { setErr(''); try { await api.castVote(s.game.id, teamId) } catch (e) { setErr(e.message) } finally { load() } }
  const mvp = run(async (userId) => { await api.voteMvp(sessionId, userId) })
  const openCard = (userId, name, frame) => setPreview({ userId, name, frame })
  const reset = () => { setSessionId(null); setSt(null); setRevealed(true) }

  return (
    <div style={shell}>
      <style>{`
.kotc-ring{position:absolute;inset:0;border-radius:14px;padding:3px;pointer-events:none;background-size:200% 100%;-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;animation:kotcShimmer 4.5s linear infinite}
.kotc-ring.silver{background:linear-gradient(115deg,#3d4652 0%,#8fa0b6 28%,#f6f9ff 50%,#8fa0b6 72%,#3d4652 100%)}
.kotc-ring.gold{background:linear-gradient(115deg,#5c4310 0%,#caa64c 28%,#fff2c8 50%,#caa64c 72%,#5c4310 100%)}
@keyframes kotcShimmer{0%{background-position:0% 0}100%{background-position:-200% 0}}
`}</style>
      <Header onClose={onClose} />
      <div style={{ padding: '16px 20px 40px', flex: 1 }}>
        {err && <ErrBox msg={err} />}
        {/* Powrót do trwającej sesji: sessionId już jest, stan dopiero się ładuje —
            bez tego strażnika przez chwilę mignąłby ekran tworzenia sesji. */}
        {sessionId && !st && <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '80px 0' }}>Wracam do sesji…</div>}
        {s.phase === 'home' && !sessionId && <Home onCreate={create} onJoin={join} onOpen={(id) => { setRevealed(true); setSessionId(id) }} busy={busy} />}
        {s.phase === 'lobby' && <Lobby s={s} onStart={start} onLeave={leave} onAbandon={abandon} busy={busy} onCard={openCard} />}
        {s.phase === 'reveal' && <Reveal s={s} onGo={() => setRevealed(true)} onCard={openCard} />}
        {s.phase === 'live' && <Live s={s} onVote={vote} onCard={openCard} onAbandon={abandon} onLeave={leave} />}
        {s.phase === 'end' && <End s={s} onMvp={mvp} onReset={reset} onCard={openCard} />}
      </div>
      {preview && (
        <MatchPlayerSheet
          player={{ user_id: preview.userId, profile: { name: preview.name, equipped_frame: preview.frame } }}
          onClose={() => setPreview(null)} />
      )}
    </div>
  )
}

function ErrBox({ msg }) {
  return <div style={{ background: 'rgba(233,107,107,0.12)', border: '1px solid rgba(233,107,107,0.4)', color: '#F3A6A6', borderRadius: 10, padding: '10px 12px', fontSize: 13, marginBottom: 14 }}>{msg}</div>
}

function Header({ onClose }) {
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: 48, padding: '12px 16px 4px', flexShrink: 0 }}>
      <img src="/kotklogo.png" alt="King of the Court" style={{ height: 46, objectFit: 'contain', filter: 'drop-shadow(0 5px 16px rgba(240,190,60,0.30))' }} />
      {onClose && (
        <button onClick={onClose} aria-label="Zamknij" style={{ position: 'absolute', right: 16, top: 10, width: 40, height: 40, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(10,20,38,0.6)', border: '1px solid rgba(150,200,255,0.2)', color: '#cfe0f2', fontSize: 17, cursor: 'pointer' }}>✕</button>
      )}
    </div>
  )
}

function Home({ onCreate, onJoin, onOpen, busy }) {
  const [code, setCode] = useState('')
  const [conf, setConf] = useState(2)
  const stepBtn = { width: 34, height: 34, borderRadius: 10, border: '1px solid rgba(255,255,255,0.16)', background: 'rgba(255,255,255,0.06)', color: TXT, fontSize: 20, fontWeight: 700, cursor: 'pointer', lineHeight: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'inherit' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '72vh' }}>
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <img src="/kotklogo.png" alt="" style={{ height: 108, objectFit: 'contain', filter: 'drop-shadow(0 10px 26px rgba(240,190,60,0.30))' }} />
        <h1 style={{ ...h1, fontSize: 30, margin: '16px 0 0' }}>King of the Court</h1>
        <p style={{ color: MUTED, fontSize: 13.5, margin: '12px 0 0', maxWidth: 320 }}>Pickup 3v3 · wchodzisz <b style={{ color: TXT }}>solo</b> · wygrany zostaje · do 67 pkt</p>
      </div>
      <input value={code} onChange={e => setCode(e.target.value.toUpperCase())} placeholder="KOD SESJI" maxLength={6}
        style={{ width: '100%', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.14)', borderRadius: 12, padding: '13px', color: TXT, fontFamily: "'Barlow Condensed', sans-serif", fontSize: 22, letterSpacing: 6, textAlign: 'center', textTransform: 'uppercase', outline: 'none', marginBottom: 10 }} />
      <button style={{ ...btnGhost, width: '100%', opacity: (busy || code.length < 4) ? 0.5 : 1 }} disabled={busy || code.length < 4} onClick={() => onJoin(code)}>Dołącz kodem</button>

      {/* Aktywne sesje globalnie — dołączasz jednym tapnięciem, bez kodu */}
      <div style={{ marginTop: 14 }}>
        <KotcActiveSessions onJoin={onJoin} onOpen={onOpen} />
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '18px 0 12px' }}>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
        <span style={{ fontSize: 11, color: DIM, letterSpacing: 1, textTransform: 'uppercase' }}>albo utwórz</span>
        <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.10)' }} />
      </div>
      <div style={{ ...glass, borderRadius: 12, padding: '11px 14px', marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>Potwierdzenia wyniku</div>
          <div style={{ fontSize: 11, color: MUTED }}>Ilu z czekającej drużyny musi potwierdzić gierkę</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0 }}>
          <button style={stepBtn} onClick={() => setConf(c => Math.max(1, c - 1))}>−</button>
          <span style={{ ...h1, fontSize: 22, minWidth: 18, textAlign: 'center', color: BLUE }}>{conf}</span>
          <button style={stepBtn} onClick={() => setConf(c => Math.min(5, c + 1))}>+</button>
        </div>
      </div>
      <button style={{ ...btnPrimary, width: '100%', opacity: busy ? 0.6 : 1 }} disabled={busy} onClick={() => onCreate(conf)}>Utwórz sesję</button>
    </div>
  )
}

function Lobby({ s, onStart, onLeave, onAbandon, busy, onCard }) {
  const n = s.players.length
  const enough = n >= 9 && n % 3 === 0
  return (
    <div>
      <div style={{ textAlign: 'center', margin: '6px 0 22px' }}>
        <div style={{ fontSize: 12, color: MUTED, letterSpacing: 1, textTransform: 'uppercase' }}>Kod sesji</div>
        <div style={{ ...h1, fontSize: 46, color: BLUE, letterSpacing: 8 }}>{s.code}</div>
        <div style={{ display: 'inline-flex', gap: 5, alignItems: 'center', marginTop: 9, padding: '4px 11px', borderRadius: 999, background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11, color: MUTED }}>
          <b style={{ color: BLUE }}>{s.session.confirm_votes}</b> potwierdzeń czekających zamyka gierkę
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: BLUE }}>{n} graczy w lobby</span>
        <span style={{ fontSize: 12, color: MUTED }}>min 9 · po 3</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginBottom: 16 }}>
        {s.players.map(p => (
          <button key={p.id} onClick={() => onCard(p.id, p.name, p.frame)} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', ...glass, borderRadius: 12, color: TXT, cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
            <HexAvatar name={p.name} variant={p.frame} size={28} noAnim />
            <span style={{ fontSize: 13, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.name}</span>
          </button>
        ))}
      </div>
      {s.isHost
        ? <button style={{ ...btnPrimary, width: '100%', opacity: (enough && !busy) ? 1 : 0.5 }} disabled={!enough || busy} onClick={onStart}>
            {enough ? 'Losuj drużyny i zacznij 🏀' : `Potrzeba ${n < 9 ? 9 - n : (3 - n % 3)} graczy więcej`}
          </button>
        : <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, padding: '10px 0' }}>Czekaj aż host wystartuje…</div>}
      <button onClick={s.isHost ? onAbandon : onLeave} style={{ background: 'none', border: 'none', color: DIM, fontSize: 12, cursor: 'pointer', display: 'block', margin: '14px auto 0', fontFamily: 'inherit' }}>
        {s.isHost ? 'Zakończ sesję' : 'Wyjdź z lobby'}
      </button>
    </div>
  )
}

function Reveal({ s, onGo, onCard }) {
  return (
    <div>
      <div style={{ textAlign: 'center', margin: '4px 0 18px' }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED }}>Wylosowane drużyny</div>
        <div style={{ ...h1, fontSize: 24, marginTop: 4 }}>Sprawdź swój skład</div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {s.order.map(id => {
          const t = s.teams[id]
          return (
            <div key={id} style={{ position: 'relative', overflow: 'hidden', borderRadius: 14, padding: '16px 14px', border: `1px solid ${t.base}`, background: `linear-gradient(115deg, ${t.base}cc 0%, ${t.dark}f2 100%)` }}>
              <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', textAlign: 'center', ...h1, fontSize: 60, color: '#fff', opacity: 0.1, letterSpacing: 2, whiteSpace: 'nowrap', pointerEvents: 'none', lineHeight: 1 }}>{t.name}</span>
              <div style={{ position: 'relative', zIndex: 1, display: 'flex', gap: 16, justifyContent: 'center' }}>
                {t.players.map(p => (
                  <button key={p.id} onClick={() => onCard(p.id, p.name, p.frame)} title={p.name}
                    style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5 }}>
                    <HexAvatar name={p.name} variant={p.frame} size={48} noAnim />
                    <span style={{ fontSize: 11, color: 'rgba(255,255,255,0.9)', fontWeight: 600 }}>{p.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )
        })}
      </div>
      <button style={{ ...btnPrimary, width: '100%', marginTop: 18 }} onClick={onGo}>Zaczynamy 🏀</button>
    </div>
  )
}

const rankedIds = (s) => [...s.order].sort((a, b) => s.teams[b].score - s.teams[a].score || s.teams[b].wins - s.teams[a].wins)

function TeamStandRow({ t, place, s, final, onCard }) {
  const isKing = !final && t.id === s.king
  const top = final && place === 0
  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 14, padding: '14px 16px', border: `1px solid ${(isKing || top) ? 'rgba(255,201,64,0.7)' : t.base}`, background: `linear-gradient(115deg, ${t.base}cc 0%, ${t.dark}f2 100%)`, boxShadow: `0 4px 18px ${t.base}22` }}>
      <span aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, top: '50%', transform: 'translateY(-50%)', textAlign: 'center', ...h1, fontSize: 60, color: '#fff', opacity: 0.1, letterSpacing: 2, whiteSpace: 'nowrap', pointerEvents: 'none', lineHeight: 1 }}>{t.name}</span>
      {place <= 2 && <div className={`kotc-ring ${place === 0 ? 'gold' : 'silver'}`} style={{ animationDelay: `${-place * 1.6}s`, animationDirection: place % 2 ? 'reverse' : 'normal' }} />}
      <div style={{ position: 'relative', zIndex: 1, display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ ...h1, fontSize: 52, lineHeight: 1, color: top ? GOLD : 'rgba(255,255,255,0.92)', minWidth: 34, textAlign: 'center' }}>{place + 1}</span>
        <div style={{ flex: 1, display: 'flex', gap: 14, justifyContent: 'center' }}>
          {t.players.map(p => (
            <button key={p.id} onClick={() => onCard(p.id, p.name, p.frame)} title={p.name}
              style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', lineHeight: 0 }}>
              <HexAvatar name={p.name} variant={p.frame} size={52} noAnim />
            </button>
          ))}
        </div>
        <div style={{ textAlign: 'right', minWidth: 38 }}>
          <div style={{ ...h1, fontSize: 25, lineHeight: 1, color: top ? GOLD : '#fff' }}>{t.score}</div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 3 }}>{t.wins}W{isKing ? ' 👑' : ''}</div>
        </div>
      </div>
    </div>
  )
}

// Odliczanie cooldownu — tyka co sekundę TYLKO tutaj (nie cały panel) i gaśnie przy zerze.
function Cooldown({ until }) {
  const [secs, setSecs] = useState(() => Math.max(0, Math.ceil((until - Date.now()) / 1000)))
  useEffect(() => {
    const tick = () => Math.max(0, Math.ceil((until - Date.now()) / 1000))
    setSecs(tick())
    const i = setInterval(() => { const n = tick(); setSecs(n); if (n <= 0) clearInterval(i) }, 1000)
    return () => clearInterval(i)
  }, [until])
  return <div style={{ textAlign: 'center', fontSize: 12.5, color: '#E5A93C', padding: '8px 0' }}>🔒 Głosowanie za {Math.floor(secs / 60)}:{String(secs % 60).padStart(2, '0')}</div>
}

function Live({ s, onVote, onCard, onAbandon, onLeave }) {
  const rk = rankedIds(s)
  const g = s.game
  const a = g && s.teams[g.a], b = g && s.teams[g.b]

  const neutral = s.myTeam && g && s.myTeam !== g.a && s.myTeam !== g.b
  const playing = s.myTeam && g && (s.myTeam === g.a || s.myTeam === g.b)
  const cdEnd = new Date(s.session.last_confirmed_at).getTime() + (s.session.vote_cooldown_sec || CD) * 1000
  // Jedno przełączenie locked→unlocked dokładnie w chwili końca cooldownu — panel NIE
  // re-renderuje się co sekundę; samo odliczanie tyka osobno w <Cooldown/>.
  const [locked, setLocked] = useState(() => Date.now() < cdEnd)
  useEffect(() => {
    const ms = cdEnd - Date.now()
    if (ms <= 0) { setLocked(false); return }
    setLocked(true)
    const t = setTimeout(() => setLocked(false), ms)
    return () => clearTimeout(t)
  }, [cdEnd])
  const needed = Math.max(1, Math.min(s.session.confirm_votes ?? 2, s.neutralCount))
  const votesFor = (id) => s.votes.filter(v => v.voted_team_id === id).length
  const myVote = s.votes.find(v => v.voter_id === s.me)?.voted_team_id
  const myFrame = s.players.find(p => p.id === s.me)?.frame || 'none'

  const fakeMatch = g && {
    id: g.id, mode: '3v3', status: 'open', walkover: null, scheduled_at: new Date().toISOString(),
    club_id: g.a, away_club_id: g.b, score_home: null, score_away: null,
    _club: { name: a.name }, _awayClub: { name: b.name }, _hasTeammate: false,
    players: [
      ...a.players.map((p, i) => ({ user_id: p.id, team: 'home', slot: i + 1, profile: { name: p.name, equipped_frame: p.frame } })),
      ...b.players.map((p, i) => ({ user_id: p.id, team: 'away', slot: i + 1, profile: { name: p.name, equipped_frame: p.frame } })),
    ],
  }

  const voteBtn = (t) => (
    <button onClick={() => onVote(t.id)} disabled={!neutral || locked}
      style={{ flex: 1, padding: '11px', borderRadius: 12, fontWeight: 700, fontSize: 14, cursor: (neutral && !locked) ? 'pointer' : 'default',
        border: `1.5px solid ${myVote === t.id ? BLUE : 'rgba(255,255,255,0.12)'}`, background: myVote === t.id ? 'rgba(91,184,245,0.16)' : 'rgba(255,255,255,0.05)',
        color: TXT, fontFamily: 'inherit', opacity: (neutral && !locked) ? 1 : 0.5, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
      <span style={{ width: 11, height: 11, borderRadius: 3, background: t.base }} />{t.name}
      <span style={{ ...h1, fontSize: 15, color: BLUE }}>{votesFor(t.id)}<span style={{ color: MUTED, fontSize: 11 }}>/{needed}</span></span>
    </button>
  )

  return (
    <div>
      {g ? (
        <>
          <MatchCard match={fakeMatch} dist={0.4} uid={s.me} myFrame={myFrame} userClubId={g.a} userClubName={a.name} onPress={() => {}} kotc homeColor={a.base} awayColor={b.base} onPlayer={(mp) => onCard(mp.user_id, mp.profile?.name, mp.profile?.equipped_frame)} />
          <div style={{ marginTop: 4 }}>
            {playing
              ? <div style={{ textAlign: 'center', fontSize: 12.5, color: MUTED, padding: '8px 0' }}>Jesteś na boisku — wynik potwierdza drużyna czekająca ({votesFor(g.a)}·{votesFor(g.b)}/{needed})</div>
              : neutral
                ? (locked
                    ? <Cooldown until={cdEnd} />
                    : <div style={{ display: 'flex', gap: 10 }}>{voteBtn(a)}{voteBtn(b)}</div>)
                : <div style={{ textAlign: 'center', fontSize: 12.5, color: DIM, padding: '8px 0' }}>Podgląd sesji</div>}
          </div>
        </>
      ) : <div style={{ textAlign: 'center', color: MUTED, padding: '30px 0' }}>Czekam na kolejną gierkę…</div>}

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED, margin: '18px 0 10px' }}>Tabela</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rk.map((id, i) => <TeamStandRow key={id} t={s.teams[id]} place={i} s={s} onCard={onCard} />)}
      </div>
      <button onClick={s.isHost ? onAbandon : onLeave} style={{ background: 'none', border: 'none', color: DIM, fontSize: 12, cursor: 'pointer', display: 'block', margin: '18px auto 0', fontFamily: 'inherit' }}>
        {s.isHost ? 'Zakończ sesję' : 'Wyjdź z sesji'}
      </button>
    </div>
  )
}

function End({ s, onMvp, onReset, onCard }) {
  const rk = rankedIds(s)
  const champ = s.teams[rk[0]]
  const [voted, setVoted] = useState(null)
  const players = []; s.order.forEach(id => s.teams[id].players.forEach(p => players.push({ ...p, team: s.teams[id] })))
  return (
    <div>
      <div style={{ ...glass, borderRadius: 20, padding: '24px 18px', textAlign: 'center', border: '1px solid rgba(255,201,64,0.34)', background: 'radial-gradient(120% 100% at 50% 0, rgba(255,201,64,0.13), transparent 68%), rgba(255,255,255,0.05)' }}>
        <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: GOLD }}>🏆 Mistrz sesji</div>
        <div style={{ ...h1, fontSize: 36, color: GOLD, margin: '8px 0 0' }}>{champ?.name}</div>
        <div style={{ ...h1, fontSize: 14, color: MUTED, marginTop: 8, letterSpacing: 1 }}>{champ?.score} pkt · {champ?.wins} wygranych</div>
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED, margin: '22px 0 10px' }}>Klasyfikacja końcowa</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rk.map((id, i) => <TeamStandRow key={id} t={s.teams[id]} place={i} s={s} final onCard={onCard} />)}
      </div>

      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED, margin: '22px 0 10px' }}>MVP sesji · 1 głos</div>
      {voted ? (
        <div style={{ ...glass, borderRadius: 18, padding: 20, textAlign: 'center' }}>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 10 }}><HexAvatar name={voted.name} variant={voted.frame} size={64} /></div>
          <div style={{ color: MUTED, fontSize: 13 }}>Zagłosowano na <b style={{ color: TXT }}>{voted.name}</b></div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
          {players.map(p => (
            <button key={p.id} onClick={() => { onMvp(p.id); setVoted(p) }} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: 10, borderRadius: 12, textAlign: 'left', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)', color: TXT, cursor: 'pointer', fontFamily: 'inherit' }}>
              <HexAvatar name={p.name} variant={p.frame} size={26} noAnim />
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 13, fontWeight: 700 }}>{p.name}</div>
                <div style={{ fontSize: 11, color: MUTED }}>{p.team.name}</div>
              </div>
            </button>
          ))}
        </div>
      )}

      <button style={{ ...btnGhost, width: '100%', marginTop: 18 }} onClick={onReset}>Nowa sesja</button>
    </div>
  )
}
