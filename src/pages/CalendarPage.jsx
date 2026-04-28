import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'

const MONTHS_PL = [
  'Styczeń','Luty','Marzec','Kwiecień','Maj','Czerwiec',
  'Lipiec','Sierpień','Wrzesień','Październik','Listopad','Grudzień',
]
const DAYS_PL = ['Pn','Wt','Śr','Cz','Pt','Sb','Nd']

const HEX_CLIP = 'polygon(50% 0%, 100% 25%, 100% 75%, 50% 100%, 0% 75%, 0% 25%)'

// ── Single hex day cell ───────────────────────────────────────────────────────
function HexDay({ day, level, isToday, isEmpty }) {
  if (isEmpty) {
    return <div style={{ width: 40, height: 46 }} />
  }

  const silver  = level === 2
  const partial = level === 1

  const innerBg = silver
    ? 'linear-gradient(135deg, #4a5a6f 0%, #9ab4c8 38%, #daeeff 52%, #a8c2d6 64%, #4e6070 100%)'
    : partial
      ? 'rgba(91,184,245,0.28)'
      : level === -1
        ? 'rgba(255,255,255,0.03)'
        : 'rgba(255,255,255,0.07)'

  const textColor = silver
    ? '#ffffff'
    : partial
      ? '#5BB8F5'
      : 'rgba(255,255,255,0.30)'

  return (
    <div style={{ position: 'relative', width: 40, height: 46, flexShrink: 0 }}>

      {/* Outer glow ring for silver — pulses via animation */}
      {silver && (
        <div
          className="hex-glow-ring"
          style={{
            position: 'absolute',
            inset: -3,
            clipPath: HEX_CLIP,
            background: 'linear-gradient(135deg, rgba(200,230,255,0.85), rgba(255,255,255,0.25), rgba(170,210,250,0.90))',
          }}
        />
      )}

      {/* Partial outer ring */}
      {partial && (
        <div style={{
          position: 'absolute',
          inset: -1,
          clipPath: HEX_CLIP,
          background: 'rgba(91,184,245,0.22)',
        }} />
      )}

      {/* Main hex body */}
      <div
        className={silver ? 'hex-sweep' : undefined}
        style={{
          position: 'absolute',
          inset: silver ? 2 : partial ? 1 : 0,
          clipPath: HEX_CLIP,
          background: innerBg,
          backgroundSize: silver ? '300% 300%' : undefined,
        }}
      />

      {/* Today highlight — blue outline */}
      {isToday && (
        <div style={{
          position: 'absolute',
          inset: -2,
          clipPath: HEX_CLIP,
          background: 'transparent',
          outline: 'none',
          boxShadow: 'none',
          border: 'none',
        }}>
          <div style={{
            position: 'absolute', inset: 0,
            clipPath: HEX_CLIP,
            background: 'rgba(91,184,245,0.30)',
            border: '1.5px solid #5BB8F5',
          }} />
        </div>
      )}

      {/* Day number */}
      <div style={{
        position: 'absolute', inset: 0, zIndex: 2,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: 'var(--font-display)',
        fontWeight: silver ? 800 : 600,
        fontSize: 11,
        color: textColor,
        letterSpacing: 0.2,
        textShadow: silver ? '0 1px 4px rgba(0,0,0,0.5)' : 'none',
      }}>
        {day}
      </div>
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────
export default function CalendarPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()

  const now = new Date()
  const todayStr = now.toISOString().split('T')[0]

  const [year,  setYear]  = useState(now.getFullYear())
  const [month, setMonth] = useState(now.getMonth())   // 0-based
  const [logs,  setLogs]  = useState(null)              // null = loading

  // Fetch logs for displayed month
  useEffect(() => {
    if (!profile) return
    const firstDay = new Date(year, month, 1).toISOString().split('T')[0]
    const lastDay  = new Date(year, month + 1, 0).toISOString().split('T')[0]
    setLogs(null)
    supabase
      .from('activity_log')
      .select('date, trainings_completed, all_done')
      .eq('user_id', profile.id)
      .gte('date', firstDay)
      .lte('date', lastDay)
      .then(({ data }) => setLogs(data || []))
  }, [profile, year, month])

  const actMap = useMemo(() => {
    if (!logs) return {}
    const m = {}
    logs.forEach(l => {
      m[l.date] = l.all_done ? 2 : (l.trainings_completed?.length > 0 ? 1 : 0)
    })
    return m
  }, [logs])

  // Build weeks array for this month
  const { weeks, doneDays, partialDays } = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate()
    const firstDow    = (new Date(year, month, 1).getDay() + 6) % 7  // Mon=0

    const cells = []
    for (let i = 0; i < firstDow; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const isFuture = dateStr > todayStr
      const level = isFuture ? -1 : (actMap[dateStr] ?? 0)
      cells.push({ day: d, dateStr, level, isToday: dateStr === todayStr })
    }
    while (cells.length % 7 !== 0) cells.push(null)

    const weeks = []
    for (let i = 0; i < cells.length; i += 7) weeks.push(cells.slice(i, i + 7))

    const vals = Object.values(actMap)
    return {
      weeks,
      doneDays:    vals.filter(v => v === 2).length,
      partialDays: vals.filter(v => v === 1).length,
    }
  }, [actMap, year, month, todayStr])

  function prevMonth() {
    if (month === 0) { setYear(y => y - 1); setMonth(11) }
    else setMonth(m => m - 1)
  }
  function nextMonth() {
    const isCurrent = year === now.getFullYear() && month === now.getMonth()
    if (isCurrent) return
    if (month === 11) { setYear(y => y + 1); setMonth(0) }
    else setMonth(m => m + 1)
  }
  const isCurrent = year === now.getFullYear() && month === now.getMonth()

  return (
    <>
      {/* ── CSS animations ── */}
      <style>{`
        @keyframes hexGlowPulse {
          0%, 100% { opacity: 0.50; transform: scale(1.00); }
          50%       { opacity: 1.00; transform: scale(1.06); }
        }
        @keyframes hexSweep {
          0%   { background-position:   0%   0%; }
          50%  { background-position: 100% 100%; }
          100% { background-position:   0%   0%; }
        }
        .hex-glow-ring { animation: hexGlowPulse 2.4s ease-in-out infinite; }
        .hex-sweep     { animation: hexSweep     3.2s ease-in-out infinite; }
      `}</style>

      <div className="page-content" style={{ padding: '0 20px', paddingBottom: 40 }}>

        {/* ── HEADER ── */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, paddingTop: 52, paddingBottom: 28 }}>
          <motion.button
            whileTap={{ scale: 0.86 }}
            onClick={() => navigate('/stats')}
            style={{
              width: 40, height: 40, borderRadius: '50%', flexShrink: 0,
              background: 'rgba(255,255,255,0.07)',
              border: '1px solid rgba(255,255,255,0.12)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-primary)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </motion.button>
          <div>
            <p className="section-label" style={{ marginBottom: 2 }}>Historia aktywności</p>
            <h1 className="display-title" style={{ fontSize: 30, lineHeight: 1 }}>Kalendarz</h1>
          </div>
        </div>

        {/* ── MONTH NAVIGATOR ── */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20,
          background: 'rgba(6,14,30,0.52)',
          backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid rgba(120,190,255,0.09)',
          borderTop: '1px solid rgba(160,210,255,0.15)',
          borderRadius: 99, padding: '10px 18px',
        }}>
          <motion.button whileTap={{ scale: 0.82 }} onClick={prevMonth}
            style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M15 18l-6-6 6-6"/>
            </svg>
          </motion.button>
          <p style={{
            fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 18,
            color: 'var(--text-primary)', letterSpacing: 1, textTransform: 'uppercase',
          }}>
            {MONTHS_PL[month]} {year}
          </p>
          <motion.button
            whileTap={isCurrent ? {} : { scale: 0.82 }}
            onClick={nextMonth}
            style={{
              background: 'none', border: 'none',
              cursor: isCurrent ? 'default' : 'pointer',
              opacity: isCurrent ? 0.18 : 1, padding: 4, display: 'flex',
            }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
              stroke="var(--text-secondary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 18l6-6-6-6"/>
            </svg>
          </motion.button>
        </div>

        {/* ── DAY LABELS ── */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)',
          marginBottom: 10, paddingLeft: 2, paddingRight: 2,
        }}>
          {DAYS_PL.map(d => (
            <div key={d} style={{
              textAlign: 'center', fontSize: 9, fontWeight: 700,
              letterSpacing: 1, textTransform: 'uppercase',
              color: 'var(--text-dim)',
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* ── HEX GRID ── */}
        <div style={{
          background: 'rgba(6,14,30,0.52)',
          backdropFilter: 'blur(24px)', WebkitBackdropFilter: 'blur(24px)',
          border: '1px solid rgba(120,190,255,0.09)',
          borderTop: '1px solid rgba(160,210,255,0.15)',
          borderRadius: 22,
          padding: '18px 10px 22px',
          display: 'flex', flexDirection: 'column', gap: 6,
        }}>
          {logs === null
            ? Array.from({ length: 5 }).map((_, wi) => (
                <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {Array.from({ length: 7 }).map((_, di) => (
                    <div key={di} style={{ display: 'flex', justifyContent: 'center' }}>
                      <div style={{
                        width: 40, height: 46,
                        clipPath: HEX_CLIP,
                        background: 'rgba(255,255,255,0.04)',
                      }} />
                    </div>
                  ))}
                </div>
              ))
            : weeks.map((week, wi) => (
                <div key={wi} style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
                  {week.map((cell, di) => (
                    <div key={di} style={{ display: 'flex', justifyContent: 'center' }}>
                      <HexDay
                        day={cell?.day}
                        level={cell?.level ?? -2}
                        isToday={cell?.isToday ?? false}
                        isEmpty={!cell}
                      />
                    </div>
                  ))}
                </div>
              ))
          }
        </div>

        {/* ── LEGEND ── */}
        <div style={{
          display: 'flex', gap: 14, marginTop: 16,
          justifyContent: 'center', flexWrap: 'wrap',
        }}>
          {[
            { bg: 'linear-gradient(135deg, #4a5a6f, #9ab4c8, #daeeff)', label: 'Wszystko' },
            { bg: 'rgba(91,184,245,0.28)', label: 'Częściowo' },
            { bg: 'rgba(255,255,255,0.07)', label: 'Brak' },
          ].map(({ bg, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 14, height: 16, clipPath: HEX_CLIP, background: bg, flexShrink: 0 }} />
              <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: 0.5 }}>
                {label}
              </span>
            </div>
          ))}
        </div>

        {/* ── MONTH SUMMARY ── */}
        {logs && (
          <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
            {[
              { v: doneDays,               label: 'pełnych',    color: '#b8d0e8' },
              { v: partialDays,            label: 'częściowych', color: '#5BB8F5' },
              { v: doneDays + partialDays, label: 'aktywnych',   color: 'var(--text-secondary)' },
            ].map(({ v, label, color }) => (
              <div key={label} style={{
                flex: 1, textAlign: 'center',
                background: 'rgba(6,14,30,0.52)',
                backdropFilter: 'blur(16px)', WebkitBackdropFilter: 'blur(16px)',
                border: '1px solid rgba(120,190,255,0.09)',
                borderTop: '1px solid rgba(160,210,255,0.14)',
                borderRadius: 14, padding: '14px 8px',
              }}>
                <p style={{
                  fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 30,
                  color, lineHeight: 1,
                  textShadow: `0 0 16px ${color}55`,
                }}>{v}</p>
                <p style={{
                  fontSize: 9, color: 'var(--text-dim)', fontWeight: 600,
                  letterSpacing: 0.8, marginTop: 5, textTransform: 'uppercase',
                }}>{label}</p>
              </div>
            ))}
          </div>
        )}

      </div>
    </>
  )
}
