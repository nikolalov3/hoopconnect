import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ARENAS, arenaLevelForXp, arenaProgress } from '../lib/arenas'

// ── Hex badge areny (grafika PNG /arenas/arena-N.png z fallbackiem SVG) ─────────
function ArenaBadge({ idx, arena, size = 150, locked }) {
  const [imgOk, setImgOk] = useState(true)
  useEffect(() => setImgOk(true), [idx])
  const b = arena.badge || ['#AABBD8', '#5566AA', '#0C0E22']
  const inner = imgOk ? (
    <img
      src={`/arenas/arena-${idx}.png`}
      onError={() => setImgOk(false)}
      alt={arena.name}
      style={{ width: size, height: size, objectFit: 'contain' }}
    />
  ) : (
    <svg width={size} height={size} viewBox="0 0 90 90">
      <defs>
        <linearGradient id={`ar-g-${idx}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={b[0]} />
          <stop offset="55%" stopColor={b[1]} />
          <stop offset="100%" stopColor={b[2]} />
        </linearGradient>
      </defs>
      <polygon points="45,3 82,24 82,66 45,87 8,66 8,24"
        fill={`url(#ar-g-${idx})`} stroke={b[0]} strokeWidth="1.5" strokeOpacity="0.6" />
      <text x="45" y="54" textAnchor="middle" dominantBaseline="middle"
        fill="white" fontSize="30" fontWeight="900"
        fontFamily="var(--font-display)" opacity="0.95">{idx}</text>
    </svg>
  )
  return (
    <div style={{
      width: size, height: size, position: 'relative',
      filter: locked
        ? 'grayscale(1) brightness(0.5)'
        : `drop-shadow(0 0 22px ${arena.glow}88)`,
      transition: 'filter .3s',
    }}>
      {inner}
      {locked && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex',
          alignItems: 'center', justifyContent: 'center', fontSize: size * 0.32,
        }}>🔒</div>
      )}
    </div>
  )
}

// ── Placeholder dla etapu bez ramki (idx 0 — "Rozgrzewka", 0-500 XP) ────────
function NoFrameNode({ size = 150, glow }) {
  return (
    <div style={{ width: size, height: size, position: 'relative' }}>
      <svg width={size} height={size} viewBox="0 0 90 90">
        <polygon points="45,3 82,24 82,66 45,87 8,66 8,24"
          fill="none" stroke="rgba(255,255,255,0.18)" strokeWidth="2"
          strokeDasharray="6 6" strokeLinejoin="round" />
      </svg>
      <div style={{
        position: 'absolute', inset: 0, display: 'flex',
        alignItems: 'center', justifyContent: 'center', fontSize: size * 0.34, opacity: 0.5,
      }}>🏀</div>
    </div>
  )
}

export default function ArenaRoad({ xp = 0, onClose }) {
  const currentIdx = arenaLevelForXp(xp)
  const prog = arenaProgress(xp)
  const currentRef = useRef(null)

  // przewiń do aktualnej areny po wejściu
  useEffect(() => {
    const t = setTimeout(() => {
      currentRef.current?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    }, 250)
    return () => clearTimeout(t)
  }, [])

  // od najwyższej (góra) do najniższej (dół) — jak Clash Royale (scrollujesz w górę po wyższe)
  const ordered = ARENAS.map((a, i) => ({ ...a, idx: i })).reverse()

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      style={{
        position: 'fixed', top: 0, bottom: 0, left: 0, right: 0,
        maxWidth: 430, margin: '0 auto', zIndex: 9000,
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(91,184,245,0.10) 0%, transparent 60%), #060B16',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* HEADER */}
      <div style={{
        position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center',
        padding: '16px 18px', borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        {onClose && (
          <button onClick={onClose} style={{
            position: 'absolute', left: 18, top: '50%', transform: 'translateY(-50%)',
            width: 36, height: 36, border: 'none', background: 'transparent',
            color: 'var(--text-primary)', cursor: 'pointer',
            fontSize: 20, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>←</button>
        )}
        <div style={{ textAlign: 'center' }}>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-primary)', lineHeight: 1,
          }}>Droga Aren</div>
          <div style={{ fontSize: 12, color: 'rgba(238,244,255,0.45)', marginTop: 2,
            display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
            {xp}<img src="/hoopxp.png" alt="XP" style={{ width: 12, height: 12, objectFit: 'contain' }}/> · {ARENAS[currentIdx]?.name}
          </div>
        </div>
      </div>

      {/* DROGA — scroll */}
      <div className="hide-scrollbar" style={{ flex: 1, overflowY: 'auto', padding: '36px 24px 60px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          {ordered.map((a, n) => {
            const isLocked = a.secret || xp < a.threshold
            const isCurrent = a.idx === currentIdx
            const isLast = n === ordered.length - 1
            return (
              <div key={a.idx} ref={isCurrent ? currentRef : null}
                style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* HEXAGON */}
                {a.noFrame ? (
                  <NoFrameNode size={150} glow={a.glow} />
                ) : (
                  <ArenaBadge idx={a.idx} arena={a} size={150} locked={isLocked} />
                )}

                {/* OPIS POD HEXAGONEM */}
                <div style={{ textAlign: 'center', maxWidth: 320, marginTop: 14, opacity: a.secret ? 0.55 : 1 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginBottom: 4 }}>
                    <span style={{
                      fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800,
                      textTransform: 'uppercase', letterSpacing: 0.3,
                      color: a.secret ? 'rgba(238,244,255,0.4)' : 'var(--text-primary)',
                    }}>{a.secret ? 'SECRET' : a.name}</span>
                    {isCurrent && (
                      <span style={{
                        fontSize: 9, fontWeight: 700, letterSpacing: 1, textTransform: 'uppercase',
                        padding: '2px 7px', borderRadius: 999, background: `${a.glow}33`, color: a.glow,
                      }}>tu jesteś</span>
                    )}
                  </div>

                  {a.secret ? (
                    <div style={{ fontSize: 12, color: 'rgba(238,244,255,0.35)' }}>
                      Odblokujesz po {a.threshold} XP — wkrótce odkryjesz co dalej
                    </div>
                  ) : (
                    <>
                      <div style={{ fontSize: 12, color: 'rgba(238,244,255,0.5)' }}>
                        {a.threshold === 0 ? 'Start' : `${a.threshold} XP`}{a.tagline ? ` · ${a.tagline}` : ''}
                      </div>
                      {a.desc && (
                        <div style={{ fontSize: 11, color: 'rgba(238,244,255,0.35)', marginTop: 4, marginBottom: isCurrent ? 8 : 0 }}>
                          {a.desc}
                        </div>
                      )}
                      {isCurrent && prog.next && (
                        <div style={{ marginTop: 4 }}>
                          <div style={{ height: 8, borderRadius: 999, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
                            <div style={{
                              width: `${prog.pct}%`, height: '100%', borderRadius: 999,
                              background: `linear-gradient(90deg, ${a.glow}, ${ARENAS[prog.next].glow})`,
                              transition: 'width .6s',
                            }} />
                          </div>
                          <div style={{ fontSize: 10.5, color: 'rgba(238,244,255,0.4)', marginTop: 4 }}>
                            Jeszcze {prog.toNext} XP do: {ARENAS[prog.next].name}
                          </div>
                        </div>
                      )}
                    </>
                  )}
                </div>

                {/* ŁĄCZNIK (kropki) — nie po ostatnim */}
                {!isLast && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '22px 0' }}>
                    {[0, 1, 2].map(d => (
                      <div key={d} style={{
                        width: 6, height: 6, borderRadius: 999,
                        background: 'rgba(255,255,255,0.15)',
                      }} />
                    ))}
                  </div>
                )}
              </div>
            )
          })}

          {/* TWARDY STOP — więcej wkrótce */}
          <div style={{
            marginTop: 24, textAlign: 'center', color: 'rgba(238,244,255,0.3)',
            fontSize: 12, fontFamily: 'var(--font-display)', textTransform: 'uppercase', letterSpacing: 2,
          }}>
            ✦ Więcej aren wkrótce ✦
          </div>
        </div>
      </div>
    </motion.div>
  )
}
