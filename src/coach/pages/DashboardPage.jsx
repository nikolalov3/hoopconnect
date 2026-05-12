import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useCoachAuth } from '../context/CoachAuthContext'
import { addDays, startOfDay, formatDateShort } from '../lib/dateUtil'

export default function DashboardPage() {
  const { currentTeam } = useCoachAuth()
  const navigate = useNavigate()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!currentTeam?.id) return
    load()
  }, [currentTeam?.id])

  // Realtime: każda zmiana w member/practice/attendance/invites/broadcast → refetch
  useEffect(() => {
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

    const [rosterRes, pastPracticesRes, upcomingPracticesRes, attendanceRes, invitesRes] = await Promise.all([
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
    ])

    setData({
      roster:          rosterRes.data || [],
      pastPractices:   pastPracticesRes.data || [],
      upcomingPractices: upcomingPracticesRes.data || [],
      attendance:      attendanceRes.data || [],
      pendingInvites:  invitesRes.data || [],
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

  if (!currentTeam) return null

  return (
    <div>
      <header style={{ marginBottom: 24 }}>
        <h1 className="coach-h1">Pulpit · {currentTeam.name}</h1>
        <p className="coach-subtitle">Przegląd Twojej drużyny.</p>
      </header>

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
