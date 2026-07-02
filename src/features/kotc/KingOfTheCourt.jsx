import { useState } from 'react'
import { createSession, recordWin, onCourt, teamById, ranking } from './engine'

// ── King of the Court — UX/UI (lokalny stan, bez bazy — v0) ───────────────────

const NAVY = '#060B16'
const BLUE = '#5BB8F5'
const CARD = 'rgba(255,255,255,0.05)'
const LINE = 'rgba(255,255,255,0.08)'
const TXT = '#EEF4FF'
const MUTED = 'rgba(238,244,255,0.5)'

export default function KingOfTheCourt() {
  const [session, setSession] = useState(null)

  return (
    <div style={{
      position: 'fixed', inset: 0, maxWidth: 460, margin: '0 auto',
      background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(91,184,245,0.12) 0%, transparent 60%), ' + NAVY,
      color: TXT, fontFamily: "'Barlow', sans-serif", display: 'flex', flexDirection: 'column',
      overflowY: 'auto', paddingTop: 'env(safe-area-inset-top, 0px)',
    }}>
      {!session && <Setup onStart={(names) => setSession(createSession(names))} />}
      {session?.phase === 'playing' && (
        <Game session={session} onWin={(id) => setSession((s) => recordWin(s, id))} />
      )}
      {session?.phase === 'finished' && (
        <Results session={session} onReset={() => setSession(null)} />
      )}
    </div>
  )
}

// ── SETUP ─────────────────────────────────────────────────────────────────────
function Setup({ onStart }) {
  const [names, setNames] = useState(['', ''])
  const setName = (i, v) => setNames((n) => n.map((x, idx) => (idx === i ? v : x)))
  const addTeam = () => names.length < 6 && setNames((n) => [...n, ''])
  const removeTeam = (i) => setNames((n) => n.filter((_, idx) => idx !== i))
  const valid = names.filter((n) => n.trim()).length >= 2

  return (
    <div style={{ padding: '28px 22px 40px', flex: 1 }}>
      <div style={{ textAlign: 'center', marginBottom: 6, fontSize: 44 }}>👑</div>
      <h1 style={{
        fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase',
        fontSize: 32, fontWeight: 900, textAlign: 'center', letterSpacing: 0.5, lineHeight: 1,
      }}>King of the Court</h1>
      <p style={{ textAlign: 'center', color: MUTED, fontSize: 14, margin: '8px 0 26px' }}>
        3v3 · wygrany zostaje · król schodzi po 3 · do 90 pkt
      </p>

      <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase', color: BLUE, marginBottom: 10 }}>
        Drużyny ({names.filter((n) => n.trim()).length}/6)
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {names.map((name, i) => (
          <div key={i} style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <span style={{ width: 22, color: MUTED, fontWeight: 700, fontSize: 14, textAlign: 'center' }}>{i + 1}</span>
            <input
              value={name}
              onChange={(e) => setName(i, e.target.value)}
              placeholder={`Drużyna ${i + 1}`}
              style={{
                flex: 1, background: CARD, border: `1px solid ${LINE}`, borderRadius: 12,
                padding: '13px 14px', color: TXT, fontSize: 16, fontFamily: 'inherit', outline: 'none',
              }}
            />
            {names.length > 2 && (
              <button onClick={() => removeTeam(i)} style={{
                background: 'transparent', border: 'none', color: MUTED, fontSize: 20, cursor: 'pointer', width: 32,
              }}>×</button>
            )}
          </div>
        ))}
      </div>

      {names.length < 6 && (
        <button onClick={addTeam} style={{
          marginTop: 12, width: '100%', background: 'transparent', border: `1.5px dashed ${LINE}`,
          borderRadius: 12, padding: '12px', color: BLUE, fontSize: 15, fontWeight: 600, cursor: 'pointer',
          fontFamily: 'inherit',
        }}>+ Dodaj drużynę</button>
      )}

      <button
        disabled={!valid}
        onClick={() => onStart(names)}
        style={{
          marginTop: 26, width: '100%', border: 'none', borderRadius: 14, padding: '16px',
          fontSize: 17, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif",
          textTransform: 'uppercase', letterSpacing: 1, cursor: valid ? 'pointer' : 'not-allowed',
          color: valid ? NAVY : MUTED,
          background: valid ? `linear-gradient(120deg, ${BLUE}, #2272C3)` : CARD,
          boxShadow: valid ? '0 10px 28px rgba(91,184,245,0.35)' : 'none',
        }}
      >Start sesji 🏀</button>
    </div>
  )
}

// ── GAME ──────────────────────────────────────────────────────────────────────
function Game({ session, onWin }) {
  const [aId, bId] = onCourt(session)
  const A = teamById(session, aId)
  const B = teamById(session, bId)
  const kingId = session.king
  const rank = ranking(session)
  const leader = rank[0]
  const nextUp = session.king == null ? session.queue.slice(2) : session.queue.slice(1)

  return (
    <div style={{ padding: '20px 18px 32px', flex: 1 }}>
      {/* progres */}
      <div style={{ textAlign: 'center', marginBottom: 4 }}>
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontWeight: 800, fontSize: 18, letterSpacing: 0.5 }}>
          👑 King of the Court
        </div>
        <div style={{ fontSize: 12, color: MUTED }}>
          Lider: <b style={{ color: BLUE }}>{leader.name}</b> · {leader.score}/{session.cfg.target} pkt
        </div>
      </div>
      <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.08)', margin: '10px 0 22px', overflow: 'hidden' }}>
        <div style={{ width: `${Math.min(100, (leader.score / session.cfg.target) * 100)}%`, height: '100%', background: `linear-gradient(90deg, ${BLUE}, #FFC940)`, transition: 'width .4s' }} />
      </div>

      {/* na boisku */}
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED, textAlign: 'center', marginBottom: 10 }}>Na boisku</div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr auto 1fr', alignItems: 'center', gap: 8, marginBottom: 18 }}>
        <CourtTeam team={A} isKing={kingId === A.id} streak={kingId === A.id ? session.streak : 0} />
        <div style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color: MUTED }}>VS</div>
        <CourtTeam team={B} isKing={kingId === B.id} streak={kingId === B.id ? session.streak : 0} />
      </div>

      {/* przyciski wyniku */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        <WinButton label={A.name} onClick={() => onWin(A.id)} />
        <WinButton label={B.name} onClick={() => onWin(B.id)} />
      </div>

      {/* kolejka */}
      {nextUp.length > 0 && (
        <div style={{ marginTop: 22 }}>
          <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>Kolejka</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {nextUp.map((id, i) => (
              <span key={id} style={{ background: CARD, border: `1px solid ${LINE}`, borderRadius: 999, padding: '6px 12px', fontSize: 13 }}>
                {i + 1}. {teamById(session, id).name}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* tabela */}
      <div style={{ marginTop: 24 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 1.5, textTransform: 'uppercase', color: MUTED, marginBottom: 8 }}>Wyniki</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {rank.map((t, i) => (
            <div key={t.id} style={{
              display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px',
              background: CARD, border: `1px solid ${LINE}`, borderRadius: 10,
            }}>
              <span style={{ width: 18, color: MUTED, fontWeight: 700 }}>{i + 1}</span>
              <span style={{ flex: 1, fontWeight: 600 }}>{t.name}{kingId === t.id ? ' 👑' : ''}</span>
              <span style={{ fontSize: 12, color: MUTED }}>{t.wins}W</span>
              <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 18, color: BLUE, minWidth: 34, textAlign: 'right' }}>{t.score}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function CourtTeam({ team, isKing, streak }) {
  return (
    <div style={{
      textAlign: 'center', padding: '16px 8px', borderRadius: 16,
      background: isKing ? 'rgba(255,201,64,0.10)' : CARD,
      border: `1px solid ${isKing ? 'rgba(255,201,64,0.4)' : LINE}`,
    }}>
      <div style={{ fontSize: 22, height: 26 }}>{isKing ? '👑' : '🏀'}</div>
      <div style={{ fontWeight: 700, fontSize: 16, marginTop: 4, wordBreak: 'break-word' }}>{team.name}</div>
      <div style={{ fontSize: 12, color: MUTED, marginTop: 2 }}>
        {team.score} pkt{isKing && streak > 1 ? ` · seria ${streak}` : ''}
      </div>
    </div>
  )
}

function WinButton({ label, onClick }) {
  return (
    <button onClick={onClick} style={{
      width: '100%', border: `1px solid ${LINE}`, borderRadius: 14, padding: '15px',
      background: CARD, color: TXT, fontSize: 16, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
    }}>✓ Wygrała <b style={{ color: BLUE }}>{label}</b></button>
  )
}

// ── RESULTS ─────────────────────────────────────────────────────────────────
function Results({ session, onReset }) {
  const rank = ranking(session)
  const king = teamById(session, session.sessionWinner)
  return (
    <div style={{ padding: '40px 22px', flex: 1, display: 'flex', flexDirection: 'column' }}>
      <div style={{ textAlign: 'center', fontSize: 60 }}>👑</div>
      <div style={{ textAlign: 'center', fontSize: 12, fontWeight: 700, letterSpacing: 2, textTransform: 'uppercase', color: BLUE }}>Król boiska</div>
      <h1 style={{
        fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase', fontWeight: 900,
        fontSize: 40, textAlign: 'center', lineHeight: 1, margin: '6px 0 4px',
      }}>{king.name}</h1>
      <div style={{ textAlign: 'center', color: MUTED, fontSize: 14, marginBottom: 28 }}>
        {king.score} pkt · {king.wins} zwycięstw · najdłuższa seria {king.bestStreak}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rank.map((t, i) => (
          <div key={t.id} style={{
            display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
            background: i === 0 ? 'rgba(255,201,64,0.10)' : CARD,
            border: `1px solid ${i === 0 ? 'rgba(255,201,64,0.4)' : LINE}`, borderRadius: 12,
          }}>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 900, fontSize: 22, color: MUTED, width: 26 }}>{i + 1}</span>
            <span style={{ flex: 1, fontWeight: 700, fontSize: 16 }}>{t.name}</span>
            <span style={{ fontSize: 12, color: MUTED }}>{t.wins}W</span>
            <span style={{ fontFamily: "'Barlow Condensed', sans-serif", fontWeight: 800, fontSize: 22, color: BLUE, minWidth: 40, textAlign: 'right' }}>{t.score}</span>
          </div>
        ))}
      </div>

      <button onClick={onReset} style={{
        marginTop: 'auto', width: '100%', border: 'none', borderRadius: 14, padding: '16px',
        fontSize: 16, fontWeight: 800, fontFamily: "'Barlow Condensed', sans-serif", textTransform: 'uppercase',
        letterSpacing: 1, cursor: 'pointer', color: NAVY, background: `linear-gradient(120deg, ${BLUE}, #2272C3)`,
        boxShadow: '0 10px 28px rgba(91,184,245,0.35)',
      }}>Nowa sesja</button>
    </div>
  )
}
