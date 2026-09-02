import { useState, useEffect, useMemo } from 'react'
import { Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'

// Data i godzina premiery / eventu — odliczanie na landing page po skanie QR
const COUNTDOWN_TARGET = new Date('2026-06-04T16:20:00')

function useCountdown(target) {
  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000)
    return () => clearInterval(id)
  }, [])
  return useMemo(() => {
    const diff = Math.max(0, target.getTime() - now)
    const days  = Math.floor(diff / 86400000)
    const hours = Math.floor((diff % 86400000) / 3600000)
    const mins  = Math.floor((diff % 3600000) / 60000)
    const secs  = Math.floor((diff % 60000) / 1000)
    return { days, hours, mins, secs, finished: diff === 0 }
  }, [now, target])
}

// ── Meteors — padające gwiazdy z trail effect (animata-style, vertical) ────
// Wstrzykuje keyframes raz globalnie; generuje N losowych meteorów które
// lecą z góry ekranu po lekkim ukosie. Każdy meteor = bright dot + trail.
const METEOR_CSS = `
@keyframes meteor-fall {
  0%   { transform: translateY(-15vh); opacity: 0; }
  10%  { opacity: 1; }
  90%  { opacity: 1; }
  100% { transform: translateY(115vh); opacity: 0; }
}
@keyframes star-twinkle {
  0%, 100% { opacity: 0.25; transform: scale(1); }
  50%      { opacity: 1;    transform: scale(1.4); }
}
`

function Meteors({ count = 28 }) {
  // Zafiksowane parametry przez useMemo, żeby nie regenerowały się przy każdym renderze
  const meteors = useMemo(() => {
    return Array.from({ length: count }, () => ({
      left:     Math.random() * 100,           // start x: 0–100%
      duration: 1.4 + Math.random() * 1.6,     // 1.4–3.0s — szybszy "rain"
      delay:    Math.random() * 4,             // 0–4s — gęściej
      size:     1 + Math.random() * 0.8,       // 1–1.8px — cieńsze raindropy
      trail:    35 + Math.random() * 35,       // 35–70px tail
    }))
  }, [count])

  const twinkles = useMemo(() => {
    return Array.from({ length: 18 }, () => ({
      top:      Math.random() * 70,            // 0–70% (sky/upper area)
      left:     Math.random() * 100,
      duration: 1.6 + Math.random() * 2.4,
      delay:    Math.random() * 4,
      size:     1 + Math.random() * 1.2,
    }))
  }, [])

  return (
    <>
      <style>{METEOR_CSS}</style>
      {/* Twinkling background stars */}
      {twinkles.map((t, i) => (
        <div key={`tw${i}`} style={{
          position: 'absolute',
          top: `${t.top}%`, left: `${t.left}%`,
          width: t.size, height: t.size,
          background: '#FFFFFF',
          borderRadius: '50%',
          boxShadow: '0 0 6px 1px rgba(180,220,255,0.7)',
          animation: `star-twinkle ${t.duration}s ease-in-out ${t.delay}s infinite`,
          pointerEvents: 'none',
        }}/>
      ))}
      {/* Crystal blue rain — krople baby-blue, trail rozwija się w górę za nimi */}
      {meteors.map((m, i) => (
        <div key={`mt${i}`} style={{
          position: 'absolute',
          top: 0, left: `${m.left}%`,
          width: m.size, height: m.size,
          background: '#A8D9FB',
          borderRadius: '50%',
          boxShadow: '0 0 5px 1px rgba(127,200,245,0.85), 0 0 12px 2px rgba(91,184,245,0.45)',
          animation: `meteor-fall ${m.duration}s linear ${m.delay}s infinite`,
          pointerEvents: 'none',
          willChange: 'transform, opacity',
        }}>
          {/* Trail — pionowa baby-blue smuga (jak ślad kropli deszczu) */}
          <div style={{
            position: 'absolute',
            bottom: '50%', left: '50%',
            transform: 'translateX(-50%)',
            width: 1, height: m.trail,
            background: 'linear-gradient(0deg, rgba(168,217,251,0.95) 0%, rgba(127,200,245,0.65) 30%, rgba(91,184,245,0.25) 70%, transparent 100%)',
          }}/>
        </div>
      ))}
    </>
  )
}

// Cyfra countdownu — bez ramek, naga liquid-glass typografia
function CountdownDigit({ value, label }) {
  return (
    <div style={{
      flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
    }}>
      <p style={{
        fontFamily: 'var(--font-display)',
        fontSize: 'clamp(34px, 11vw, 44px)',
        fontWeight: 900,
        margin: 0, lineHeight: 1,
        color: '#F0F8FF',
        textShadow: '0 0 24px rgba(140,200,255,0.7), 0 0 48px rgba(91,184,245,0.35)',
        fontVariantNumeric: 'tabular-nums',
        letterSpacing: -1,
      }}>
        {String(value).padStart(2, '0')}
      </p>
      <p style={{
        fontSize: 8, fontWeight: 700,
        margin: 0,
        color: 'rgba(160,210,250,0.55)',
        letterSpacing: 2.5,
        textTransform: 'uppercase',
      }}>{label}</p>
    </div>
  )
}

// Hairline divider z labelem (np. "═══ NAGRODA ═══")
function SectionLabel({ children }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 12,
      width: '100%', maxWidth: 340,
      margin: '0 auto',
    }}>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(90deg, transparent, rgba(150,200,240,0.35))' }}/>
      <p style={{
        fontSize: 8.5, fontWeight: 700,
        margin: 0,
        color: 'rgba(180,220,255,0.55)',
        letterSpacing: 3.5, textTransform: 'uppercase',
      }}>{children}</p>
      <div style={{ flex: 1, height: 1, background: 'linear-gradient(270deg, transparent, rgba(150,200,240,0.35))' }}/>
    </div>
  )
}

// ── Steps accordion — rozwijane kroki z chevron arrow ──────────────────────
function StepsAccordion() {
  const { t } = useTranslation('qrLanding')
  const STEPS = t('steps', { returnObjects: true })
  const [openSet, setOpenSet] = useState(new Set())
  const toggle = (n) => setOpenSet(prev => {
    const next = new Set(prev)
    if (next.has(n)) next.delete(n); else next.add(n)
    return next
  })

  return (
    <div style={{
      width: '100%', maxWidth: 340,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {STEPS.map(s => {
        const open = openSet.has(s.n)
        return (
          <div key={s.n} style={{
            border: '1px solid rgba(140,200,255,0.20)',
            borderTop: '1px solid rgba(180,220,255,0.32)',
            borderRadius: 10,
            background: open
              ? 'linear-gradient(180deg, rgba(91,184,245,0.08), rgba(10,20,40,0.35))'
              : 'rgba(8,16,32,0.30)',
            backdropFilter: 'blur(14px)',
            WebkitBackdropFilter: 'blur(14px)',
            boxShadow: open
              ? '0 0 0 1px rgba(91,184,245,0.18), 0 4px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.06)'
              : '0 2px 12px rgba(0,0,0,0.25), inset 0 1px 0 rgba(255,255,255,0.04)',
            transition: 'all 0.25s ease',
            overflow: 'hidden',
          }}>
            <button
              onClick={() => toggle(s.n)}
              style={{
                width: '100%',
                display: 'flex', alignItems: 'center', gap: 14,
                padding: '12px 14px',
                background: 'none', border: 'none',
                cursor: 'pointer', textAlign: 'left',
                WebkitTapHighlightColor: 'transparent',
              }}>
              <p style={{
                margin: 0,
                fontFamily: 'var(--font-display)',
                fontSize: 18, fontWeight: 900,
                color: '#FFFFFF',
                letterSpacing: 1,
                fontVariantNumeric: 'tabular-nums',
                minWidth: 32,
                textShadow: open
                  ? '0 0 18px rgba(140,200,255,0.95), 0 0 36px rgba(91,184,245,0.6)'
                  : '0 0 14px rgba(140,200,255,0.65), 0 0 28px rgba(91,184,245,0.35)',
                transition: 'text-shadow 0.25s ease',
              }}>{s.n}</p>
              <div style={{
                width: 16, height: 1,
                background: 'linear-gradient(90deg, rgba(180,220,255,0.65), transparent)',
              }}/>
              <p style={{
                margin: 0, flex: 1,
                fontFamily: 'var(--font-display)',
                fontSize: 15, fontWeight: 800,
                color: '#FFFFFF',
                letterSpacing: 0.5,
                textTransform: 'uppercase',
                textShadow: '0 0 12px rgba(140,200,255,0.5)',
              }}>{s.title}</p>
              <motion.div
                animate={{ rotate: open ? 180 : 0 }}
                transition={{ duration: 0.25 }}
                style={{ flexShrink: 0, display: 'flex' }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none"
                  stroke="rgba(180,220,255,0.7)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="6 9 12 15 18 9"/>
                </svg>
              </motion.div>
            </button>
            <AnimatePresence initial={false}>
              {open && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                  style={{ overflow: 'hidden' }}>
                  <p style={{
                    margin: 0,
                    padding: '2px 16px 14px 16px',
                    fontSize: 12, fontWeight: 500,
                    color: 'rgba(200,220,250,0.78)',
                    lineHeight: 1.55,
                    textAlign: 'justify',
                    textJustify: 'inter-word',
                    hyphens: 'auto',
                  }}>{s.body}</p>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )
      })}
    </div>
  )
}

export default function QrLandingPage() {
  const { t } = useTranslation('qrLanding')
  const { days, hours, mins, secs, finished } = useCountdown(COUNTDOWN_TARGET)

  return (
    <div style={{
      minHeight: '100%',
      display: 'flex', flexDirection: 'column',
      padding: '18px 20px 28px',
      position: 'relative',
      overflowX: 'hidden',
      overflowY: 'auto',
      WebkitOverflowScrolling: 'touch',
    }}>
      {/* Background — sky → night gradient */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'linear-gradient(180deg, #FFFFFF 0%, #FFFFFF 28%, #F4FAFF 33%, #C9E4FB 40%, #7AB4E8 50%, #3A75C0 60%, #1B4378 70%, #0B1A38 80%, #04090F 92%)',
      }} />
      {/* Soft sun glow from top */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse 90% 35% at 50% -8%, rgba(255,255,255,0.45) 0%, rgba(180,220,255,0.18) 30%, transparent 60%)',
      }} />
      {/* Starfield — visible only in the dark lower half */}
      <div style={{
        position: 'fixed', left: 0, right: 0, top: '55%', bottom: 0,
        pointerEvents: 'none',
        backgroundImage: 'radial-gradient(circle 1px at 12% 18%, rgba(180,220,255,0.55) 0, transparent 2px), radial-gradient(circle 1px at 78% 32%, rgba(180,220,255,0.42) 0, transparent 2px), radial-gradient(circle 1px at 28% 72%, rgba(180,220,255,0.50) 0, transparent 2px), radial-gradient(circle 1px at 62% 88%, rgba(180,220,255,0.35) 0, transparent 2px), radial-gradient(circle 1px at 92% 64%, rgba(180,220,255,0.45) 0, transparent 2px), radial-gradient(circle 1px at 5% 52%, rgba(180,220,255,0.38) 0, transparent 2px)',
        opacity: 0.7,
      }} />
      {/* Meteors — padają prosto w dół, ograniczone do mobile width (430px) */}
      <div style={{
        position: 'fixed',
        top: 0, bottom: 0,
        left: '50%',
        transform: 'translateX(-50%)',
        width: '100%',
        maxWidth: 430,
        pointerEvents: 'none',
        overflow: 'hidden',
        zIndex: 0,
      }}>
        <Meteors count={32} />
      </div>

      <div style={{
        flex: 1,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'flex-start',
        textAlign: 'center', position: 'relative', zIndex: 1,
        gap: 16,
      }}>
        {/* Header image */}
        <img
          src="/pc.png"
          alt=""
          onError={(e) => { e.currentTarget.style.display = 'none' }}
          style={{
            width: '100%', maxWidth: 360,
            height: 'auto',
            filter: 'drop-shadow(0 12px 36px rgba(91,184,245,0.35))',
          }}
        />

        {/* Headline — POKOLENIE CUDÓW jednym rzędem, lekkie zachodzenie na PNG */}
        <div style={{ marginTop: -32 }}>
          <h1 style={{
            fontFamily: 'var(--font-display)',
            fontWeight: 900,
            fontSize: 'clamp(24px, 7.2vw, 34px)',
            lineHeight: 1.0,
            letterSpacing: 0.5,
            textTransform: 'uppercase',
            color: '#1B3A6B',
            textShadow: '0 1px 0 rgba(255,255,255,0.7), 0 0 14px rgba(255,255,255,0.6)',
            margin: 0,
            whiteSpace: 'nowrap',
          }}>
            {t('headlineLine1')}<br/>
            <span style={{
              background: 'linear-gradient(180deg, #C8F2FF 0%, #5BC9F5 50%, #1E8DD8 100%)',
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
              filter: 'drop-shadow(0 0 16px rgba(91,200,255,0.7)) drop-shadow(0 0 32px rgba(91,184,245,0.4)) drop-shadow(0 3px 14px rgba(0,0,0,0.5))',
            }}>{t('headlineLine2')}</span>
          </h1>
          <p style={{
            fontSize: 10, fontWeight: 600,
            color: 'rgba(180,220,255,0.55)',
            letterSpacing: 4.5,
            textTransform: 'uppercase',
            margin: '14px 0 0',
          }}>
            {t('eventDate')}
          </p>
        </div>

        {/* Countdown — naga typografia, bez ramek */}
        <div style={{
          display: 'flex', width: '100%', maxWidth: 340,
        }}>
          <CountdownDigit value={days}  label={t('countdown.days')}  />
          <div style={{ width: 1, background: 'linear-gradient(180deg, transparent, rgba(150,200,240,0.3), transparent)' }}/>
          <CountdownDigit value={hours} label={t('countdown.hours')} />
          <div style={{ width: 1, background: 'linear-gradient(180deg, transparent, rgba(150,200,240,0.3), transparent)' }}/>
          <CountdownDigit value={mins}  label={t('countdown.mins')}  />
          <div style={{ width: 1, background: 'linear-gradient(180deg, transparent, rgba(150,200,240,0.3), transparent)' }}/>
          <CountdownDigit value={secs}  label={t('countdown.secs')}  />
        </div>

        {/* ── JAK DOŁĄCZYĆ ── rozwijane sekcje ── */}
        <SectionLabel>{t('howToJoinLabel')}</SectionLabel>
        <StepsAccordion />

        {finished && (
          <p style={{
            fontSize: 12, fontWeight: 800,
            color: '#FF5A00',
            letterSpacing: 3, textTransform: 'uppercase',
            margin: 0,
          }}>
            {t('timeHasCome')}
          </p>
        )}

        {/* CTA — niebieski liquid-glass, pulsujący glow */}
        <Link to="/" style={{ textDecoration: 'none', marginTop: 4 }}>
          <motion.div
            whileTap={{ scale: 0.97 }}
            animate={{
              boxShadow: [
                '0 0 0 1px rgba(140,200,255,0.45), 0 0 24px rgba(91,184,245,0.40), inset 0 1px 0 rgba(255,255,255,0.30)',
                '0 0 0 1px rgba(160,210,255,0.65), 0 0 48px rgba(91,184,245,0.70), inset 0 1px 0 rgba(255,255,255,0.40)',
                '0 0 0 1px rgba(140,200,255,0.45), 0 0 24px rgba(91,184,245,0.40), inset 0 1px 0 rgba(255,255,255,0.30)',
              ],
            }}
            transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
            style={{
              background: 'linear-gradient(135deg, #5BB8F5 0%, #2272C3 100%)',
              borderRadius: 10,
              padding: '15px 38px',
              color: '#FFFFFF',
              fontFamily: 'var(--font-display)',
              fontSize: 13, fontWeight: 800,
              letterSpacing: 3,
              textTransform: 'uppercase',
              cursor: 'pointer',
              WebkitTapHighlightColor: 'transparent',
              display: 'inline-block',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
            }}>
            {t('cta')}
          </motion.div>
        </Link>
      </div>

      <p style={{
        textAlign: 'center',
        color: 'rgba(150,200,240,0.30)',
        fontSize: 9, fontWeight: 600,
        letterSpacing: 3, textTransform: 'uppercase',
        margin: '14px 0 0',
        position: 'relative', zIndex: 1,
      }}>
        HoopConnect
      </p>
    </div>
  )
}
