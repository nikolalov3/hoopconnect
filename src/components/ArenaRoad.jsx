import { useState, useEffect, useRef } from 'react'
import { motion } from 'framer-motion'
import { ARENAS, arenaLevelForXp, arenaProgress } from '../lib/arenas'

// ── Hex badge areny (grafika PNG /arenas/arena-N.png z fallbackiem SVG) ─────────
function ArenaBadge({ idx, arena, size = 96, locked }) {
  const [imgOk, setImgOk] = useState(true)
  useEffect(() => setImgOk(true), [idx])
  const b = arena.badge || ['#AABBD8', '#5566AA', '#0C0E22']
  const inner = imgOk ? (
    <img
      src={`/arenas/arena-${idx + 1}.png`}
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
        fontFamily="var(--font-display)" opacity="0.95">{idx + 1}</text>
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
        position: 'fixed', inset: 0, zIndex: 400,
        background: 'radial-gradient(ellipse 80% 50% at 50% 0%, rgba(91,184,245,0.10) 0%, transparent 60%), #060B16',
        display: 'flex', flexDirection: 'column',
        paddingTop: 'env(safe-area-inset-top, 0px)',
      }}
    >
      {/* HEADER */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '16px 18px',
        borderBottom: '1px solid rgba(255,255,255,0.06)', flexShrink: 0,
      }}>
        {onClose && (
          <button onClick={onClose} style={{
            width: 36, height: 36, borderRadius: 12, border: '1px solid rgba(255,255,255,0.12)',
            background: 'rgba(255,255,255,0.05)', color: 'var(--text-primary)', cursor: 'pointer',
            fontSize: 18, display: 'flex', alignItems: 'center', justifyContent: 'center',
          }}>←</button>
        )}
        <div>
          <div style={{
            fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 800,
            textTransform: 'uppercase', letterSpacing: 0.5, color: 'var(--text-primary)', lineHeight: 1,
          }}>Droga Aren</div>
          <div style={{ fontSize: 12, color: 'rgba(238,244,255,0.45)', marginTop: 2 }}>
            {xp} XP · {ARENAS[currentIdx]?.name}
          </div>
        </div>
      </div>

      {/* DROGA — scroll */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '28px 18px 60px' }}>
        <div style={{ maxWidth: 460, margin: '0 auto', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0 }}>
          {ordered.map((a, n) => {
            const isLocked = a.secret || xp < a.threshold
            const isCurrent = a.idx === currentIdx
            const isLast = n === ordered.length - 1
            return (
              <div key={a.idx} ref={isCurrent ? currentRef : null}
                style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

                {/* KAFELEK ARENY */}
                <div style={{
                  width: '100%', maxWidth: 420,
                  background: isCurrent ? `linear-gradient(135deg, ${a.glow}22, rgba(255,255,255,0.03))` : 'rgba(255,255,255,0.035)',
                  border: isCurrent ? `1.5px solid ${a.glow}88` : '1px solid rgba(255,255,255,0.08)',
                  borderRadius: 20, padding: '18px 20px',
                  display: 'flex', alignItems: 'center', gap: 16,
                  boxShadow: isCurrent ? `0 8px 32px ${a.glow}33` : '0 4px 16px rgba(0,0,0,0.4)',
                  opacity: a.secret ? 0.55 : 1,
                }}>
                  <ArenaBadge idx={a.idx} arena={a} size={72} locked={isLocked} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 3 }}>
                      <span style={{
                        fontFamily: 'var(--font-display)', fontSize: 19, fontWeight: 800,
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
                        <div style={{ fontSize: 12, color: 'rgba(238,244,255,0.5)', marginBottom: isCurrent ? 8 : 0 }}>
                          {a.threshold === 0 ? 'Start' : `${a.threshold} XP`}{a.tagline ? ` · ${a.tagline}` : ''}
                        </div>
                        {isCurrent && prog.next && (
                          <div>
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
                </div>

                {/* ŁĄCZNIK (kropki) — nie po ostatnim */}
                {!isLast && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 5, padding: '10px 0' }}>
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
