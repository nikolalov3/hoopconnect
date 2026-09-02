import { useState, useEffect, useMemo } from 'react'
import { supabase } from '../../lib/supabase'
import { useCoachAuth } from '../context/CoachAuthContext'
import PracticeFormModal, { PRACTICE_CATEGORIES } from '../components/PracticeFormModal'
import {
  PL_DAY_SHORT, startOfWeek, startOfMonth, addDays, addMonths, sameDay,
  formatTime, formatWeekRange, formatMonthYear,
} from '../lib/dateUtil'

const MAX_MONTHS_FORWARD = 3

const categoryLabel = (v) => PRACTICE_CATEGORIES.find(c => c.value === v)?.label || ''

const categoryColor = (v) => ({
  general:     '#5591CD',
  shooting:    '#E59A3C',
  dribbling:   '#9D6EE3',
  athleticism: '#3FA86A',
  conditioning:'#3CA9C4',
  strength:    '#D85546',
  iq:          '#7D58B6',
  recovery:    '#69B4A2',
  match:       '#1E3A5F',
}[v] || '#5591CD')

export default function SchedulePage() {
  const { currentTeam } = useCoachAuth()
  const [viewMode, setViewMode]   = useState('week')   // 'week' | 'month'
  const [anchorDate, setAnchorDate] = useState(() => new Date())
  const [practices, setPractices] = useState([])
  const [loadError, setLoadError] = useState(null)
  const [editPractice, setEditPractice] = useState(null)   // istniejący wiersz
  const [createForDate, setCreateForDate] = useState(null) // Date | null

  // Zakres dat dla bieżącego widoku
  const range = useMemo(() => {
    if (viewMode === 'week') {
      const from = startOfWeek(anchorDate)
      return { from, to: addDays(from, 7) }
    }
    const from = startOfMonth(anchorDate)
    return { from, to: addMonths(from, 1) }
  }, [viewMode, anchorDate.getTime()])

  // Ograniczenie planowania: 3 miesiące do przodu od dzisiaj
  const maxFutureDate = useMemo(() => addMonths(new Date(), MAX_MONTHS_FORWARD), [])
  const canGoNext = useMemo(() => {
    if (viewMode === 'week') return addDays(range.from, 7) <= maxFutureDate
    return addMonths(range.from, 1) <= maxFutureDate
  }, [viewMode, range.from.getTime(), maxFutureDate.getTime()])

  useEffect(() => {
    if (!currentTeam) return
    loadPractices()
  }, [currentTeam?.id, range.from.getTime(), range.to.getTime()])

  // Realtime: gdy ktokolwiek (np. inna sesja trenera) doda/edytuje/usunie
  // trening w tej drużynie, lista odświeża się sama.
  useEffect(() => {
    if (!currentTeam?.id) return
    const teamId = currentTeam.id
    let channel = null
    try {
      channel = supabase
        .channel(`coach-practice-${teamId}`)
        .on('postgres_changes', {
          event: '*', schema: 'public', table: 'team_practice',
          filter: `team_id=eq.${teamId}`,
        }, () => loadPractices())
        .subscribe()
    } catch (err) {
      console.warn('[coach/schedule] realtime failed:', err)
    }
    return () => { try { if (channel) supabase.removeChannel(channel) } catch {} }
  }, [currentTeam?.id])

  async function loadPractices() {
    setLoadError(null)
    const { data, error } = await supabase
      .from('team_practice')
      .select('id, scheduled_at, duration_min, category, location, notes')
      .eq('team_id', currentTeam.id)
      .gte('scheduled_at', range.from.toISOString())
      .lt('scheduled_at',  range.to.toISOString())
      .order('scheduled_at', { ascending: true })
    if (error) { setLoadError(error.message); console.error(error) }
    setPractices(data || [])
  }

  // Pogrupowane po dniu (klucz: YYYY-MM-DD)
  const practicesByDay = useMemo(() => {
    const m = new Map()
    for (const p of practices) {
      const d = new Date(p.scheduled_at)
      const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
      if (!m.has(key)) m.set(key, [])
      m.get(key).push(p)
    }
    return m
  }, [practices])

  const navPrev = () => setAnchorDate(viewMode === 'week' ? addDays(anchorDate, -7) : addMonths(anchorDate, -1))
  const navNext = () => { if (canGoNext) setAnchorDate(viewMode === 'week' ? addDays(anchorDate, 7) : addMonths(anchorDate, 1)) }
  const navToday = () => setAnchorDate(new Date())

  if (!currentTeam) return null

  const rangeLabel = viewMode === 'week' ? formatWeekRange(range.from) : formatMonthYear(range.from)

  return (
    <div>
      <header style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h1 className="coach-h1">Plan tygodnia · {currentTeam.name}</h1>
          <p className="coach-subtitle">Zaplanuj treningi — pojawią się u zawodników w aplikacji.</p>
        </div>
        <button className="coach-btn-primary" onClick={() => setCreateForDate(new Date())}>
          + Dodaj trening
        </button>
      </header>

      {/* Toolbar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        marginBottom: 16,
      }}>
        <div style={{
          display: 'inline-flex', borderRadius: 10, overflow: 'hidden',
          border: '1px solid #D4DDE8', background: '#FFFFFF',
        }}>
          <button onClick={() => setViewMode('week')}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: 600,
              background: viewMode === 'week' ? '#E8F1FA' : 'transparent',
              color: viewMode === 'week' ? '#1E3A5F' : '#4D5C73',
              border: 'none', cursor: 'pointer',
            }}>Tydzień</button>
          <button onClick={() => setViewMode('month')}
            style={{
              padding: '8px 14px', fontSize: 13, fontWeight: 600,
              background: viewMode === 'month' ? '#E8F1FA' : 'transparent',
              color: viewMode === 'month' ? '#1E3A5F' : '#4D5C73',
              border: 'none', cursor: 'pointer', borderLeft: '1px solid #D4DDE8',
            }}>Miesiąc</button>
        </div>

        <button onClick={navPrev} className="coach-btn-secondary" style={{ padding: '8px 12px' }}>‹</button>
        <button onClick={navToday} className="coach-btn-secondary" style={{ padding: '8px 14px', fontSize: 13 }}>Dziś</button>
        <button onClick={navNext} disabled={!canGoNext} className="coach-btn-secondary"
          style={{ padding: '8px 12px', opacity: canGoNext ? 1 : 0.4 }}>›</button>

        <div style={{ flex: 1 }}/>

        <div style={{ fontSize: 14, fontWeight: 600, color: '#1A2233' }}>
          {rangeLabel}
        </div>
      </div>

      {loadError && (
        <div className="coach-card" style={{
          marginBottom: 14, background: '#FCE5E2', borderColor: '#F4B5AB',
          color: '#A1372A', fontSize: 13,
        }}>
          <strong style={{ display: 'block', marginBottom: 4 }}>Błąd:</strong>
          <code style={{ fontSize: 12 }}>{loadError}</code>
        </div>
      )}

      {viewMode === 'week' ? (
        <WeekView
          range={range}
          practicesByDay={practicesByDay}
          onAddForDate={(d) => setCreateForDate(d)}
          onEditPractice={(p) => setEditPractice(p)}
        />
      ) : (
        <MonthView
          range={range}
          practicesByDay={practicesByDay}
          onAddForDate={(d) => setCreateForDate(d)}
          onEditPractice={(p) => setEditPractice(p)}
        />
      )}

      <p style={{ fontSize: 12, color: '#8A9AB0', marginTop: 14, textAlign: 'center' }}>
        Planować można na maksymalnie 3 miesiące do przodu.
      </p>

      {(createForDate || editPractice) && (
        <PracticeFormModal
          teamId={currentTeam.id}
          defaultDate={createForDate}
          practice={editPractice}
          onClose={() => { setCreateForDate(null); setEditPractice(null) }}
          onSaved={() => { setCreateForDate(null); setEditPractice(null); loadPractices() }}
          onDeleted={() => { setEditPractice(null); loadPractices() }}
        />
      )}
    </div>
  )
}


// ─── WEEK VIEW ──────────────────────────────────────────────────────────────
function WeekView({ range, practicesByDay, onAddForDate, onEditPractice }) {
  const days = Array.from({ length: 7 }, (_, i) => addDays(range.from, i))
  const today = new Date()
  return (
    <div className="coach-card" style={{ padding: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E6ECF3' }}>
        {days.map((d, i) => {
          const isToday = sameDay(d, today)
          return (
            <div key={i} style={{
              padding: '12px 10px', textAlign: 'center',
              borderRight: i < 6 ? '1px solid #E6ECF3' : 'none',
              background: isToday ? '#E8F1FA' : 'transparent',
            }}>
              <div style={{
                fontSize: 10, fontWeight: 700, color: '#8A9AB0',
                textTransform: 'uppercase', letterSpacing: 0.6,
              }}>{PL_DAY_SHORT[d.getDay()]}</div>
              <div style={{
                fontSize: 20, fontWeight: 700,
                color: isToday ? '#1E3A5F' : '#1A2233', marginTop: 2,
              }}>{d.getDate()}</div>
            </div>
          )
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', minHeight: 320 }}>
        {days.map((d, i) => {
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
          const dayPractices = practicesByDay.get(key) || []
          return (
            <div key={i}
              onClick={(e) => { if (e.target === e.currentTarget) onAddForDate(d) }}
              style={{
                padding: 8, gap: 6, display: 'flex', flexDirection: 'column',
                borderRight: i < 6 ? '1px solid #E6ECF3' : 'none',
                cursor: 'pointer', minHeight: 320,
              }}>
              {dayPractices.map(p => (
                <PracticePill key={p.id} practice={p} onClick={() => onEditPractice(p)} />
              ))}
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ─── MONTH VIEW ─────────────────────────────────────────────────────────────
function MonthView({ range, practicesByDay, onAddForDate, onEditPractice }) {
  // Siatka 7 kolumn, zaczyna się od poniedziałka tygodnia z 1-szym dniem miesiąca
  const firstDay = range.from
  const monthEnd = range.to
  const gridStart = startOfWeek(firstDay)
  const gridEnd   = startOfWeek(addDays(monthEnd, 6))  // domyka cały ostatni tydzień
  const totalDays = Math.round((gridEnd - gridStart) / (1000 * 60 * 60 * 24))
  const today = new Date()

  const cells = Array.from({ length: totalDays }, (_, i) => addDays(gridStart, i))
  const headers = ['Pon','Wt','Śr','Czw','Pt','Sob','Nd']

  return (
    <div className="coach-card" style={{ padding: 0 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', borderBottom: '1px solid #E6ECF3' }}>
        {headers.map((h, i) => (
          <div key={h} style={{
            padding: '10px', textAlign: 'center',
            fontSize: 10, fontWeight: 700, color: '#8A9AB0',
            textTransform: 'uppercase', letterSpacing: 0.6,
            borderRight: i < 6 ? '1px solid #E6ECF3' : 'none',
          }}>{h}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)' }}>
        {cells.map((d, i) => {
          const key = `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`
          const dayPractices = practicesByDay.get(key) || []
          const outside = d.getMonth() !== firstDay.getMonth()
          const isToday = sameDay(d, today)
          return (
            <div key={i}
              onClick={(e) => { if (e.target === e.currentTarget) onAddForDate(d) }}
              style={{
                minHeight: 92, padding: 6,
                borderRight: (i % 7) < 6 ? '1px solid #E6ECF3' : 'none',
                borderTop:   i >= 7         ? '1px solid #E6ECF3' : 'none',
                background:  outside ? '#FAFBFC' : (isToday ? '#E8F1FA' : '#FFFFFF'),
                cursor: 'pointer', position: 'relative',
                display: 'flex', flexDirection: 'column', gap: 4,
              }}>
              <div style={{
                fontSize: 11, fontWeight: 600,
                color: outside ? '#B7C2D1' : (isToday ? '#1E3A5F' : '#4D5C73'),
                textAlign: 'right',
              }}>{d.getDate()}</div>
              {dayPractices.slice(0, 3).map(p => (
                <PracticePill key={p.id} practice={p} compact onClick={() => onEditPractice(p)} />
              ))}
              {dayPractices.length > 3 && (
                <div style={{ fontSize: 10, color: '#8A9AB0', textAlign: 'center' }}>
                  +{dayPractices.length - 3} więcej
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}


// ─── PRACTICE PILL ──────────────────────────────────────────────────────────
function PracticePill({ practice, compact, onClick }) {
  const color = categoryColor(practice.category)
  const time  = formatTime(practice.scheduled_at)
  const label = practice.category ? categoryLabel(practice.category) : 'Trening'
  return (
    <button onClick={(e) => { e.stopPropagation(); onClick?.() }}
      style={{
        background: `${color}14`,
        border: `1px solid ${color}40`,
        borderLeft: `3px solid ${color}`,
        padding: compact ? '3px 6px' : '6px 8px',
        borderRadius: 6, textAlign: 'left', cursor: 'pointer',
        display: 'flex', flexDirection: 'column', gap: 1,
        WebkitTapHighlightColor: 'transparent',
      }}>
      <div style={{ fontSize: compact ? 10 : 11, fontWeight: 700, color: color }}>
        {time}{practice.duration_min ? ` · ${practice.duration_min}min` : ''}
      </div>
      {!compact && (
        <div style={{ fontSize: 11, color: '#1A2233', fontWeight: 500 }}>
          {label}
        </div>
      )}
      {!compact && practice.location && (
        <div style={{ fontSize: 10, color: '#8A9AB0', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {practice.location}
        </div>
      )}
    </button>
  )
}
