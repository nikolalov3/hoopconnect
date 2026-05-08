import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'

const DAYS_PL = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd']
const MONTHS_PL = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru']
const WEEKS = 14  // ~3.5 miesiące

export default function ActivityCalendar({ userId }) {
  const [logs, setLogs] = useState(null)  // null = loading

  useEffect(() => {
    if (!userId) return
    const start = new Date()
    start.setDate(start.getDate() - WEEKS * 7 + 1)
    supabase
      .from('activity_log')
      .select('date, trainings_completed, all_done')
      .eq('user_id', userId)
      .gte('date', start.toISOString().split('T')[0])
      .then(({ data }) => setLogs(data || []))
  }, [userId])

  // date → level (0=brak, 1=część, 2=wszystko)
  const actMap = useMemo(() => {
    if (!logs) return {}
    const m = {}
    logs.forEach(l => {
      m[l.date] = l.all_done ? 2 : (l.trainings_completed?.length > 0 ? 1 : 0)
    })
    return m
  }, [logs])

  // Build grid: array of WEEKS columns, each column = 7 days (Mon→Sun)
  const { grid, monthLabels } = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Find most recent Monday
    const dayOfWeek = today.getDay() // 0=Sun
    const daysToMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1
    const lastMonday = new Date(today)
    lastMonday.setDate(today.getDate() - daysToMonday)

    // Start = WEEKS-1 Mondays ago
    const startMonday = new Date(lastMonday)
    startMonday.setDate(lastMonday.getDate() - (WEEKS - 1) * 7)

    const grid = []          // [col][row] = { date, level, isFuture }
    const monthLabels = []   // { col, label }
    let lastMonth = -1

    for (let w = 0; w < WEEKS; w++) {
      const col = []
      for (let d = 0; d < 7; d++) {
        const day = new Date(startMonday)
        day.setDate(startMonday.getDate() + w * 7 + d)
        const dateStr = day.toISOString().split('T')[0]
        const isFuture = day > today
        col.push({ dateStr, level: actMap[dateStr] ?? -1, isFuture })

        // Month label on first day of month
        if (d === 0 && day.getMonth() !== lastMonth) {
          monthLabels.push({ col: w, label: MONTHS_PL[day.getMonth()] })
          lastMonth = day.getMonth()
        }
      }
      grid.push(col)
    }
    return { grid, monthLabels }
  }, [actMap])

  const cellColor = (level, isFuture) => {
    if (isFuture || level < 0) return 'rgba(255,255,255,0.05)'
    if (level === 2) return 'rgba(0,230,118,0.65)'
    if (level === 1) return 'rgba(91,184,245,0.45)'
    return 'rgba(255,255,255,0.07)'
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <p className="section-label">Aktywność</p>
        {/* Legenda */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {[
            { color: 'rgba(0,230,118,0.65)',   label: 'Wszystko' },
            { color: 'rgba(91,184,245,0.45)',  label: 'Część' },
            { color: 'rgba(255,255,255,0.07)', label: 'Brak' },
          ].map(({ color, label }) => (
            <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: 2, background: color }} />
              <span style={{ fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Month labels row */}
      <div style={{ display: 'flex', gap: 3, marginBottom: 4, paddingLeft: 22 }}>
        {Array.from({ length: WEEKS }).map((_, w) => {
          const ml = monthLabels.find(m => m.col === w)
          return (
            <div key={w} style={{ width: 14, flexShrink: 0, fontSize: 9, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: 0.3 }}>
              {ml ? ml.label : ''}
            </div>
          )
        })}
      </div>

      {/* Grid */}
      <div style={{ display: 'flex', gap: 3 }}>

        {/* Day labels */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginRight: 4 }}>
          {DAYS_PL.map((d, i) => (
            <div key={d} style={{
              height: 14, fontSize: 8, color: 'var(--text-dim)',
              fontWeight: 600, letterSpacing: 0.3,
              display: 'flex', alignItems: 'center',
              opacity: [1, 3, 5].includes(i) ? 1 : 0,  // show Mon, Wed, Fri only
            }}>
              {d}
            </div>
          ))}
        </div>

        {/* Cells */}
        {logs === null ? (
          // Loading skeleton
          Array.from({ length: WEEKS }).map((_, w) => (
            <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {Array.from({ length: 7 }).map((_, d) => (
                <div key={d} style={{ width: 14, height: 14, borderRadius: 3, background: 'rgba(255,255,255,0.04)' }} />
              ))}
            </div>
          ))
        ) : (
          grid.map((col, w) => (
            <div key={w} style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
              {col.map(({ dateStr, level, isFuture }) => (
                <div
                  key={dateStr}
                  title={dateStr}
                  style={{
                    width: 14, height: 14, borderRadius: 3,
                    background: cellColor(level, isFuture),
                    transition: 'background 0.2s',
                    flexShrink: 0,
                  }}
                />
              ))}
            </div>
          ))
        )}
      </div>

      {/* Total stats summary */}
      {logs && logs.length > 0 && (() => {
        const done = logs.filter(l => l.all_done).length
        const partial = logs.filter(l => !l.all_done && l.trainings_completed?.length > 0).length
        return (
          <div style={{ display: 'flex', gap: 16, marginTop: 12 }}>
            {[
              { v: done,    label: 'pełnych dni',    color: 'var(--green-shot)' },
              { v: partial, label: 'częściowych',    color: 'var(--orange)' },
              { v: done + partial, label: 'łącznie aktywnych', color: 'var(--text-secondary)' },
            ].map(({ v, label, color }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'baseline', gap: 5 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color }}>{v}</span>
                <span style={{ fontSize: 10, color: 'var(--text-dim)', fontWeight: 600, letterSpacing: 0.5 }}>{label}</span>
              </div>
            ))}
          </div>
        )
      })()}
    </div>
  )
}
