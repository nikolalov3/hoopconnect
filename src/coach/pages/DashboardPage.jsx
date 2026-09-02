import { useState, useEffect, useMemo } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCoachAuth } from '../context/CoachAuthContext'
import { addDays, startOfDay } from '../lib/dateUtil'

// ── DEMO MODE ───────────────────────────────────────────────────────────────
// Odwiedź panel z ?demo=1 aby zobaczyć w pełni wypełniony pulpit (14 zawodników,
// 8 nadchodzących treningów, wykres aktywności, frekwencja). Nic nie zapisuje do
// bazy — czysta wizualizacja do zrzutów ekranu i demo na żywo dla klubów.
const DEMO_NAMES = [
  ['Kacper', 'Nowak', 7], ['Jan', 'Kowalski', 4], ['Szymon', 'Wiśniewski', 11],
  ['Antoni', 'Wójcik', 5], ['Filip', 'Kamiński', 23], ['Mikołaj', 'Lewandowski', 8],
  ['Aleksander', 'Zieliński', 12], ['Jakub', 'Szymański', 3], ['Franciszek', 'Woźniak', 9],
  ['Wojciech', 'Dąbrowski', 15], ['Adam', 'Kozłowski', 6], ['Igor', 'Jankowski', 21],
  ['Tymon', 'Mazur', 10], ['Leon', 'Krawczyk', 14],
]
function buildDemoData() {
  const now = new Date()
  const roster = DEMO_NAMES.map(([f, l, n], i) => ({
    player_id: `demo-${i}`, display_first_name: f, display_last_name: l, jersey_number: n,
  }))
  // Przeszłe treningi: rozkład 2/3/2/3 na 4 ostatnie tygodnie (= 10, wykres + treningi/tydz)
  const perWeek = [2, 3, 2, 3] // tydzień -4, -3, -2, -1
  const pastPractices = []
  let pid = 0
  perWeek.forEach((cnt, wIdx) => {
    const weekFromNow = -(4 - wIdx) // -4..-1
    for (let k = 0; k < cnt; k++) {
      const d = addDays(startOfDay(now), 7 * weekFromNow + 2 + k * 2)
      d.setHours(18, 0, 0, 0)
      pastPractices.push({ id: `pp-${pid++}`, scheduled_at: d.toISOString() })
    }
  })
  // Nadchodzące treningi: 8 w ciągu najbliższych 4 tygodni (wt/czw 18:00)
  const LOCS = ['Hala SP nr 2', 'Hala SP nr 2', 'Hala MOSiR', 'Hala SP nr 2']
  const CATS = ['Trening', 'Rzuty + gra', 'Obrona', 'Kondycja']
  const upcomingPractices = []
  for (let i = 0; i < 8; i++) {
    const d = addDays(startOfDay(now), 2 + i * 3) // co ~3 dni, pierwszy w tym tygodniu
    d.setHours(18, 0, 0, 0)
    upcomingPractices.push({
      id: `up-${i}`, scheduled_at: d.toISOString(),
      category: CATS[i % CATS.length], location: LOCS[i % LOCS.length],
    })
  }
  // Frekwencja: ~91% (mix present/late/absent), wszystkie wpięte do przeszłych treningów
  const attendance = []
  for (let i = 0; i < 50; i++) {
    const status = i % 11 === 0 ? 'absent' : (i % 6 === 0 ? 'late' : 'present')
    attendance.push({ practice_id: pastPractices[i % pastPractices.length].id, status })
  }
  return { roster, pastPractices, upcomingPractices, attendance, pendingInvites: [], hasBroadcast: true }
}

export default function DashboardPage() {
  const { currentTeam } = useCoachAuth()
  const navigate = useNavigate()
  const isDemo = new URLSearchParams(useLocation().search).get('demo') === '1'
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isDemo) { setData(buildDemoData()); setLoading(false); return }
    if (!currentTeam?.id) return
    load()
  }, [currentTeam?.id, isDemo])

  // Realtime: każda zmiana w member/practice/attendance/invites/broadcast → refetch
  useEffect(() => {
    if (isDemo) return
    if (!currentTeam?.id) return
    const teamId = currentTeam.id
    let ch = null
    try {
      ch = supabase
        .channel(`coach-dashboard-${teamId}`)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team_members',     filter: `team_id=eq.${teamId}` }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team_practice',    filter: `team_id=eq.${teamId}` }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'team_invites',     filter: `team_id=eq.${teamId}` }, () => load())
        .on('postgres_changes', { event: '*', schema: 'public', table: 'practice_attendance' }, () => load())
        .subscribe()
    } catch {}
    return () => { try { if (ch) supabase.removeChannel(ch) } catch {} }
  }, [currentTeam?.id])

  async function load() {
    setLoading(true)
    const teamId = currentTeam.id
    const now = new Date()
    const fourWeeksAgo = addDays(startOfDay(now), -28)
    const fourWeeksFromNow = addDays(startOfDay(now), 28)

    const [rosterRes, pastPracticesRes, upcomingPracticesRes, attendanceRes, invitesRes, broadcastsRes] = await Promise.all([
      supabase.rpc('get_team_roster', { p_team_id: teamId }),
      supabase.from('team_practice')
        .select('id, scheduled_at')
        .eq('team_id', teamId)
        .gte('scheduled_at', fourWeeksAgo.toISOString())
        .lte('scheduled_at', now.toISOString())
        .order('scheduled_at', { ascending: true }),
      supabase.from('team_practice')
        .select('id, scheduled_at, category, location')
        .eq('team_id', teamId)
        .gt('scheduled_at', now.toISOString())
        .lte('scheduled_at', fourWeeksFromNow.toISOString())
        .order('scheduled_at', { ascending: true })
        .limit(20),
      supabase.rpc('get_team_attendance_recent', { p_team_id: teamId, p_limit: 50 }),
      supabase.from('team_invites')
        .select('id').eq('team_id', teamId).eq('status', 'pending'),
      supabase.from('coach_broadcasts')
        .select('id').eq('team_id', teamId).limit(1),
    ])

    setData({
      roster:           rosterRes.data || [],
      pastPractices:    pastPracticesRes.data || [],
      upcomingPractices: upcomingPracticesRes.data || [],
      attendance:       attendanceRes.data || [],
      pendingInvites:   invitesRes.data || [],
      hasBroadcast:    (broadcastsRes.data || []).length > 0,
    })
    setLoading(false)
  }

  const stats = useMemo(() => {
    if (!data) return null
    const { roster, pastPractices, upcomingPractices, attendance } = data
    const practicesPerWeek = +(pastPractices.length / 4).toFixed(1)
    const presentCount = attendance.filter(a => a.status === 'present').length
    const lateCount    = attendance.filter(a => a.status === 'late').length
    const totalMarked  = attendance.filter(a => a.status).length
    const attendancePct = totalMarked === 0 ? null
      : Math.round(((presentCount + lateCount * 0.5) / totalMarked) * 100)
    return {
      roster:          roster.length,
      practicesPerWeek,
      attendancePct,
      upcomingCount:   upcomingPractices.length,
    }
  }, [data])

  // Aktywność z 4 ostatnich tygodni — bar chart
  const weeklyBars = useMemo(() => {
    if (!data) return []
    const now = new Date()
    const bars = []
    for (let i = 3; i >= 0; i--) {
      const weekStart = addDays(startOfDay(now), -7 * (i + 1))
      const weekEnd   = addDays(startOfDay(now), -7 * i)
      const count = data.pastPractices.filter(p => {
        const t = new Date(p.scheduled_at)
        return t >= weekStart && t < weekEnd
      }).length
      bars.push({ label: i === 0 ? 'Ten tydz.' : `−${i+1}t`, count })
    }
    return bars
  }, [data])

  const maxBar = Math.max(1, ...weeklyBars.map(b => b.count))

  const alerts = useMemo(() => {
    if (!data) return []
    const out = []
    const noName = data.roster.filter(r => !r.display_first_name && !r.display_last_name).length
    if (noName > 0) out.push({
      msg: `${noName} ${noName === 1 ? 'zawodnik nie ma' : 'zawodników nie ma'} podanego imienia`,
      action: 'Uzupełnij na profilu zawodnika',
      onClick: () => navigate('/team'),
    })
    if (data.pendingInvites.length > 0) out.push({
      msg: `${data.pendingInvites.length} ${data.pendingInvites.length === 1 ? 'zaproszenie czeka' : 'zaproszeń czeka'} na odpowiedź`,
      action: 'Zobacz w drużynie',
      onClick: () => navigate('/team'),
    })
    const sevenDaysFromNow = addDays(startOfDay(new Date()), 7).getTime()
    const nextWeekPractices = data.upcomingPractices.filter(
      p => new Date(p.scheduled_at).getTime() < sevenDaysFromNow
    )
    if (nextWeekPractices.length === 0) out.push({
      msg: 'Brak treningów w najbliższym tygodniu',
      action: 'Zaplanuj trening',
      onClick: () => navigate('/schedule'),
    })
    // Treningi w przeszłości bez zaznaczonej frekwencji
    const practiceIdsWithAttendance = new Set(data.attendance.filter(a => a.status).map(a => a.practice_id))
    const unmarkedPastPractices = data.pastPractices.filter(p => !practiceIdsWithAttendance.has(p.id))
    if (unmarkedPastPractices.length > 0) out.push({
      msg: `${unmarkedPastPractices.length} ${unmarkedPastPractices.length === 1 ? 'trening' : 'treningów'} bez zaznaczonej frekwencji`,
      action: 'Otwórz plan tygodnia',
      onClick: () => navigate('/schedule'),
    })
    return out
  }, [data, navigate])

  // Pierwsze kroki checklist — pokazujemy dopóki nie wszystko zrobione
  const checklist = data ? [
    { key: 'roster',     label: 'Dodaj pierwszego zawodnika',         done: data.roster.length > 0,            cta: '/team' },
    { key: 'practice',   label: 'Zaplanuj pierwszy trening',          done: (data.pastPractices.length + data.upcomingPractices.length) > 0, cta: '/schedule' },
    { key: 'attendance', label: 'Zaznacz frekwencję na treningu',     done: data.attendance.some(a => a.status), cta: '/schedule' },
    { key: 'broadcast',  label: 'Wyślij pierwsze powiadomienie',      done: data.hasBroadcast,                  cta: '/notifications' },
  ] : []
  const checklistDone   = checklist.filter(c => c.done).length
  const checklistTotal  = checklist.length
  const checklistHidden = (() => {
    try { return localStorage.getItem(`hc_coach_checklist_${currentTeam.id}_hidden`) === '1' } catch { return false }
  })()
  const showChecklist = !loading && checklistDone < checklistTotal && !checklistHidden

  const hideChecklist = () => {
    try { localStorage.setItem(`hc_coach_checklist_${currentTeam.id}_hidden`, '1') } catch {}
    // Force re-render by toggling a local state — simplest: just navigate same page
    // (no state for hidden flag; we read localStorage each render. Trigger via load().)
    load()
  }

  if (!currentTeam) return null

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="coach-h1">Pulpit · {currentTeam.name}</h1>
        <p className="coach-subtitle">Przegląd Twojej drużyny.</p>
      </header>

      {/* Pierwsze kroki — checklist dla nowych trenerów */}
      {showChecklist && (
        <div className="coach-card" style={{
          marginBottom: 16, borderColor: '#5591CD',
          background: 'linear-gradient(135deg, #FFFFFF 0%, #F2F8FD 100%)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
            <div>
              <h2 className="coach-h2" style={{ marginBottom: 4 }}>Pierwsze kroki</h2>
              <p className="coach-subtitle">
                {checklistDone} z {checklistTotal} {checklistDone === 1 ? 'zrobione' : 'zrobionych'}
              </p>
            </div>
            <button onClick={hideChecklist} title="Ukryj"
              style={{ background: 'transparent', border: 'none', color: '#8A9AB0', fontSize: 18, cursor: 'pointer', padding: 4 }}>×</button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {checklist.map(c => (
              <button key={c.key} onClick={() => navigate(c.cta)}
                disabled={c.done}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '10px 12px', borderRadius: 10,
                  border: `1px solid ${c.done ? '#9CD9B7' : '#D4DDE8'}`,
                  background: c.done ? '#E2F4EB' : '#FFFFFF',
                  cursor: c.done ? 'default' : 'pointer',
                  textAlign: 'left', fontFamily: 'inherit',
                }}>
                <div style={{
                  width: 20, height: 20, borderRadius: '50%',
                  background: c.done ? '#3FA86A' : 'transparent',
                  border: c.done ? 'none' : '2px solid #D4DDE8',
                  display: 'grid', placeItems: 'center', flexShrink: 0,
                  color: '#FFFFFF', fontSize: 12, fontWeight: 700,
                }}>{c.done ? '✓' : ''}</div>
                <span style={{
                  flex: 1, fontSize: 14, fontWeight: 500,
                  color: c.done ? '#1E6B3D' : '#1A2233',
                  textDecoration: c.done ? 'line-through' : 'none',
                }}>{c.label}</span>
                {!c.done && (
                  <span style={{ fontSize: 12, color: '#5591CD', fontWeight: 600 }}>→</span>
                )}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
        gap: 14, marginBottom: 24,
      }}>
        <StatCard label="Zawodnicy"          value={loading ? null : stats?.roster ?? 0} />
        <StatCard label="Treningi / tydz."   value={loading ? null : stats?.practicesPerWeek ?? 0} sub="ostatnie 4 tyg." />
        <StatCard label="Frekwencja drużyny" value={loading ? null : stats?.attendancePct == null ? '—' : `${stats.attendancePct}%`} />
        <StatCard label="Nadchodzące treningi" value={loading ? null : stats?.upcomingCount ?? 0} sub="najbliższe 4 tyg." />
      </div>

      {/* Activity chart */}
      <div className="coach-card" style={{ marginBottom: 16 }}>
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Aktywność drużyny</h2>
        <p className="coach-subtitle" style={{ marginBottom: 18 }}>
          Treningi drużynowe w ostatnich 4 tygodniach
        </p>
        {loading ? (
          <div className="coach-placeholder" style={{ minHeight: 180 }}><div className="spinner"/></div>
        ) : (data?.pastPractices?.length || 0) === 0 ? (
          <div className="coach-placeholder" style={{ minHeight: 180 }}>
            <div>Brak treningów w ostatnich 4 tygodniach.</div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, padding: '12px 0 6px', height: 180 }}>
            {weeklyBars.map((b, i) => {
              const h = Math.round((b.count / maxBar) * 140)
              return (
                <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: '#1A2233' }}>{b.count}</div>
                  <div style={{
                    width: '100%',
                    height: Math.max(h, 4),
                    background: 'linear-gradient(180deg, #5591CD 0%, #3D78B5 100%)',
                    borderRadius: '6px 6px 2px 2px',
                  }}/>
                  <div style={{ fontSize: 11, color: '#8A9AB0' }}>{b.label}</div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Upcoming practices preview */}
      {data?.upcomingPractices?.length > 0 && (
        <div className="coach-card" style={{ marginBottom: 16 }}>
          <h2 className="coach-h2" style={{ marginBottom: 4 }}>Najbliższe treningi</h2>
          <p className="coach-subtitle" style={{ marginBottom: 14 }}>
            Pierwsze 5 nadchodzących
          </p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {data.upcomingPractices.slice(0, 5).map(p => {
              const d = new Date(p.scheduled_at)
              return (
                <button
                  key={p.id}
                  onClick={() => navigate('/schedule')}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px',
                    border: '1px solid #E6ECF3', borderRadius: 10, background: '#FFFFFF',
                    cursor: 'pointer', textAlign: 'left',
                  }}>
                  <div style={{
                    width: 44, padding: '4px 0', borderRadius: 8, background: '#E8F1FA',
                    textAlign: 'center', flexShrink: 0,
                  }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: '#5591CD', textTransform: 'uppercase' }}>
                      {d.toLocaleDateString('pl-PL', { month: 'short' })}
                    </div>
                    <div style={{ fontSize: 16, fontWeight: 800, color: '#1E3A5F' }}>
                      {d.getDate()}
                    </div>
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2233' }}>
                      {d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                      {p.location && ` · ${p.location}`}
                    </div>
                    <div style={{ fontSize: 11, color: '#8A9AB0' }}>
                      {d.toLocaleDateString('pl-PL', { weekday: 'long' })}
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
        </div>
      )}

      {/* Alerts */}
      <div className="coach-card">
        <h2 className="coach-h2" style={{ marginBottom: 4 }}>Alerty</h2>
        <p className="coach-subtitle" style={{ marginBottom: 16 }}>Co warto sprawdzić</p>
        {loading ? (
          <div className="coach-placeholder" style={{ minHeight: 80 }}><div className="spinner"/></div>
        ) : alerts.length === 0 ? (
          <div style={{ padding: '20px 16px', fontSize: 13, color: '#3FA86A', textAlign: 'center', fontWeight: 600 }}>
            ✓ Wszystko w porządku.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {alerts.map((a, i) => (
              <button key={i} onClick={a.onClick} style={{
                display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px',
                background: '#FCF2DE', border: '1px solid #E8C97A', borderRadius: 10,
                cursor: 'pointer', textAlign: 'left',
              }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#E5A93C', flexShrink: 0 }}/>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600, color: '#1A2233' }}>{a.msg}</div>
                  <div style={{ fontSize: 11, color: '#A37416', marginTop: 2 }}>{a.action} →</div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function StatCard({ label, value, sub }) {
  const isLoading = value === null
  return (
    <div className="coach-card">
      <div style={{
        fontSize: 11, color: '#8A9AB0', fontWeight: 700,
        textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 10,
      }}>{label}</div>
      <div style={{
        fontSize: 30, fontWeight: 700, color: '#1A2233', letterSpacing: -0.5,
        opacity: isLoading ? 0.25 : 1,
      }}>
        {isLoading ? '—' : value}
      </div>
      {sub && (
        <div style={{ fontSize: 10, color: '#8A9AB0', marginTop: 4, letterSpacing: 0.2 }}>
          {sub}
        </div>
      )}
    </div>
  )
}
