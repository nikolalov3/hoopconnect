import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { supabase } from '../lib/supabase'
import { useAuth } from '../context/AuthContext'
import { creditRestDayStreak } from '../lib/streak'
import StreakToast from '../components/ui/StreakToast'

const TODAY = new Date().toISOString().split('T')[0]

const SCHEDULES = {
  3: ['T','O','T','O','T','R','O'],
  4: ['T','T','O','T','T','R','O'],
  5: ['T','T','R','T','T','T','O'],
  6: ['T','T','T','R','T','T','T'],
}
function getTodayType(profile) {
  if (profile?.created_at) {
    const reg = new Date(profile.created_at).toISOString().split('T')[0]
    if (reg === TODAY) return 'T'
  }
  const schedule = SCHEDULES[profile?.training_days || 4] || SCHEDULES[4]
  const dow = new Date().getDay()
  return schedule[dow === 0 ? 6 : dow - 1]
}

const QUICK_ACTIVITIES = [
  { id: 'sleep',     emoji: '😴', label: 'Sen 9h+',         minutes: 540, color: '#7C5CBF' },
  { id: 'foam',      emoji: '🎯', label: 'Foam rolling',    minutes: 20,  color: '#2980B9' },
  { id: 'stretch',   emoji: '🤸', label: 'Stretching',      minutes: 15,  color: '#27AE60' },
  { id: 'meditate',  emoji: '🧘', label: 'Medytacja',       minutes: 10,  color: '#E67E22' },
  { id: 'read',      emoji: '📖', label: 'Czytanie',        minutes: 30,  color: '#D4AC0D' },
  { id: 'video',     emoji: '🎬', label: 'Analiza video',   minutes: 30,  color: '#C0392B' },
  { id: 'cold',      emoji: '🧊', label: 'Zimny prysznic',  minutes: 5,   color: '#148F77' },
  { id: 'meal',      emoji: '🥗', label: 'Meal prep',       minutes: 45,  color: '#1E8449' },
  { id: 'journal',   emoji: '✍️', label: 'Dziennik',        minutes: 15,  color: '#2471A3' },
  { id: 'walk',      emoji: '🚶', label: 'Spacer',          minutes: 30,  color: '#5D6D7E' },
  { id: 'ice',       emoji: '❄️', label: 'Okłady lodowe',   minutes: 15,  color: '#1A5276' },
  { id: 'nap',       emoji: '💤', label: 'Drzemka 20min',   minutes: 20,  color: '#6C3483' },
]

const TIPS = [
  { icon: '💧', text: 'Wypij 500ml wody zaraz po przebudzeniu — twoje ciało jest odwodnione po 8h snu.' },
  { icon: '📵', text: 'Nie dotykaj telefonu przez pierwszą godzinę dnia — to czas dla twojego mózgu.' },
  { icon: '☀️', text: 'Wyjdź na 10 minut słońca przed 10:00 — reguluje rytm dobowy i poziom melatoniny.' },
  { icon: '🎵', text: 'Muzyka 60-70 BPM podczas foam rollingu redukuje napięcie mięśniowe o 20%.' },
  { icon: '🍌', text: 'Banan + masło orzechowe to idealna przekąska 30 min przed treningiem.' },
  { icon: '📚', text: '"The Mamba Mentality" Kobe Bryanta — must-read dla każdego kto chce być najlepszy.' },
  { icon: '🛏️', text: 'Temperatura 18°C w sypialni = 45 minut dłuższy głęboki sen według badań.' },
  { icon: '🧠', text: 'Wizualizacja przed snem: wyobraź sobie jutrzejszy trening krok po kroku.' },
]

function RecoveryTile({ activity, done, onToggle }) {
  return (
    <motion.button
      whileTap={{ scale: 0.94 }}
      onClick={onToggle}
      style={{
        padding: '14px 10px',
        background: done
          ? `${activity.color}18`
          : 'rgba(255,255,255,0.70)',
        backdropFilter: done ? 'none' : 'blur(8px)',
        WebkitBackdropFilter: done ? 'none' : 'blur(8px)',
        border: done
          ? `1.5px solid ${activity.color}60`
          : '1.5px solid rgba(180,210,240,0.60)',
        borderRadius: 16,
        cursor: 'pointer',
        textAlign: 'center',
        boxShadow: done
          ? `0 4px 16px ${activity.color}25, 0 2px 6px rgba(0,0,0,0.06)`
          : '0 2px 12px rgba(100,160,210,0.15), 0 1px 4px rgba(0,0,0,0.06)',
        transition: 'all 0.20s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {done && (
        <div style={{
          position: 'absolute', top: 5, right: 5,
          width: 16, height: 16, borderRadius: '50%',
          background: activity.color,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `0 0 8px ${activity.color}60`,
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
      )}
      <span style={{ fontSize: 26, filter: done ? 'none' : 'saturate(0.7)' }}>{activity.emoji}</span>
      <p style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10,
        color: done ? activity.color : '#4A6880',
        textTransform: 'uppercase', letterSpacing: 0.6, lineHeight: 1.2,
        transition: 'color 0.2s',
      }}>{activity.label}</p>
      <p style={{ color: '#8AAEC4', fontSize: 9, letterSpacing: 0.4 }}>
        {activity.minutes >= 60
          ? `${Math.floor(activity.minutes/60)}h${activity.minutes%60>0 ? activity.minutes%60+'min' : ''}`
          : `${activity.minutes} min`}
      </p>
    </motion.button>
  )
}

export default function RecoveryPage() {
  const { profile, refreshProfile } = useAuth()
  const [doneActivities, setDoneActivities] = useState(new Set())
  const [tipIndex,       setTipIndex]       = useState(0)
  const [loading,        setLoading]        = useState(true)
  const [streakToast,    setStreakToast]     = useState(0)

  useEffect(() => {
    if (!profile) return
    supabase
      .from('recovery_log')
      .select('activity')
      .eq('user_id', profile.id)
      .eq('date', TODAY)
      .then(({ data }) => {
        setDoneActivities(new Set((data || []).map(r => r.activity)))
        setLoading(false)
      })

    const tipSeed = new Date().getDate() % TIPS.length
    setTipIndex(tipSeed)
  }, [profile])

  async function toggleActivity(activityId) {
    const isDone = doneActivities.has(activityId)
    const activity = QUICK_ACTIVITIES.find(a => a.id === activityId)
    if (!activity) return

    if (isDone) {
      await supabase.from('recovery_log')
        .delete()
        .eq('user_id', profile.id)
        .eq('date', TODAY)
        .eq('activity', activityId)

      const newDone = new Set(doneActivities)
      newDone.delete(activityId)
      setDoneActivities(newDone)

      // Jeśli to była ostatnia aktywność dziś — sprawdź czy cofnąć serię
      if (newDone.size === 0) {
        const [{ data: todayLog }, { data: fp }] = await Promise.all([
          supabase.from('activity_log')
            .select('trainings_completed')
            .eq('user_id', profile.id)
            .eq('date', TODAY)
            .maybeSingle(),
          supabase.from('profiles')
            .select('streak, last_active')
            .eq('id', profile.id)
            .single(),
        ])
        const hasTrainings = (todayLog?.trainings_completed?.length || 0) > 0
        if (!hasTrainings && (fp?.last_active || '').slice(0, 10) === TODAY) {
          // Cofnij serię
          const newStreak = Math.max(0, (fp.streak || 0) - 1)
          await supabase.from('profiles').update({
            streak:      newStreak,
            last_active: null,
          }).eq('id', profile.id)
          // Usuń wpis activity_log wstawiony przez creditRestDayStreak
          // (brak treningów + brak aktywności = dzień nieaktywny w kalendarzu)
          await supabase.from('activity_log')
            .delete()
            .eq('user_id', profile.id)
            .eq('date', TODAY)
          await refreshProfile()
        } else if (hasTrainings) {
          // Są treningi → zostaw activity_log, ale zresetuj all_done na false
          // bo sam recovery nie wystarczy do "wszystko zrobione"
          await supabase.from('activity_log')
            .update({ all_done: false })
            .eq('user_id', profile.id)
            .eq('date', TODAY)
        }
      }

    } else {
      await supabase.from('recovery_log').insert({
        user_id: profile.id,
        date: TODAY,
        activity: activityId,
        duration_minutes: activity.minutes,
      })
      setDoneActivities(prev => new Set([...prev, activityId]))

      // Seria kredytowana tylko w dni wolne/regeneracji — NIE w dni treningowe
      const dayType = getTodayType(profile)
      if (dayType !== 'T') {
        const credited = await creditRestDayStreak(profile, refreshProfile)
        if (credited) setStreakToast(credited)
      }
    }
  }

  const doneCount = doneActivities.size
  const recoveryScore = Math.round((doneCount / 5) * 100)
  const tip = TIPS[tipIndex]

  const scoreColor = recoveryScore >= 80 ? '#1E8449' : recoveryScore >= 50 ? '#D4800A' : '#5D9CEC'
  const scoreBg    = recoveryScore >= 80 ? 'rgba(39,174,96,0.12)' : recoveryScore >= 50 ? 'rgba(212,128,10,0.10)' : 'rgba(93,156,236,0.10)'

  return (
    <div className="page-content" style={{
      padding: '32px 22px',
      background: 'linear-gradient(175deg, #C8E8FA 0%, #D9EEFA 35%, #BFD9F0 100%)',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 20 }}>
        <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', color: '#6A96B8', marginBottom: 3 }}>
          Dzisiaj
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 38,
          textTransform: 'uppercase', color: '#1A3D5C', lineHeight: 0.95, letterSpacing: 0,
        }}>Regeneracja</h1>
        <p style={{ color: '#5A8AAA', fontSize: 12, fontWeight: 500, marginTop: 6 }}>
          Jutrzejszy trening zaczyna się teraz. Bez regeneracji nie ma progresu.
        </p>
      </div>

      {/* Recovery score card */}
      <div style={{
        padding: '18px 20px', marginBottom: 16,
        background: 'rgba(255,255,255,0.72)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        border: '1.5px solid rgba(180,215,245,0.80)',
        borderRadius: 20,
        boxShadow: '0 4px 24px rgba(80,150,200,0.15), 0 1px 4px rgba(0,0,0,0.05)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2, textTransform: 'uppercase', color: '#6A96B8', marginBottom: 4 }}>
              Recovery score
            </p>
            <p style={{
              fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 52,
              color: scoreColor, lineHeight: 1,
              textShadow: `0 0 20px ${scoreColor}40`,
            }}>{recoveryScore}<span style={{ fontSize: 22 }}>%</span></p>
          </div>
          <div style={{ textAlign: 'right' }}>
            <p style={{ color: '#8AAEC4', fontSize: 10, letterSpacing: 1.5, textTransform: 'uppercase', fontWeight: 600 }}>
              Wykonano dziś
            </p>
            <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 30, color: '#1A3D5C' }}>
              {doneCount}<span style={{ fontSize: 14, color: '#8AAEC4', fontWeight: 400 }}> / {QUICK_ACTIVITIES.length}</span>
            </p>
          </div>
        </div>
        {/* Progress bar */}
        <div style={{ background: 'rgba(150,200,235,0.30)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: `${Math.min(recoveryScore, 100)}%` }}
            animate={{ width: `${Math.min(recoveryScore, 100)}%` }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            style={{
              height: '100%', borderRadius: 4,
              background: recoveryScore >= 80
                ? 'linear-gradient(90deg, #27AE60, #2ECC71)'
                : recoveryScore >= 50
                ? 'linear-gradient(90deg, #D4800A, #F39C12)'
                : 'linear-gradient(90deg, #4A8FC8, #5DADE2)',
              boxShadow: `0 0 8px ${scoreColor}60`,
            }}
          />
        </div>
      </div>

      {/* Daily tip */}
      <div style={{
        padding: '14px 16px', marginBottom: 20,
        background: 'rgba(255,255,255,0.65)',
        border: '1.5px solid rgba(180,215,245,0.70)',
        borderRadius: 16,
        boxShadow: '0 2px 12px rgba(80,150,200,0.12)',
        display: 'flex', gap: 12, alignItems: 'flex-start',
      }}>
        <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{tip.icon}</span>
        <p style={{ color: '#4A6880', fontSize: 12, lineHeight: 1.6 }}>
          <span style={{ color: '#2471A3', fontWeight: 600 }}>Pro tip: </span>
          {tip.text}
        </p>
      </div>

      {/* Activities grid */}
      <p style={{ fontSize: 10, fontWeight: 600, letterSpacing: 2.5, textTransform: 'uppercase', color: '#6A96B8', marginBottom: 12 }}>
        Zaznacz co dziś zrobiłeś
      </p>
      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 32 }}>
          <div style={{ width: 28, height: 28, border: '2px solid rgba(100,170,220,0.25)', borderTopColor: '#4A8FC8', borderRadius: '50%', animation: 'spin .8s linear infinite' }} />
        </div>
      ) : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 10,
          paddingBottom: 32,
        }}>
          {QUICK_ACTIVITIES.map(activity => (
            <RecoveryTile
              key={activity.id}
              activity={activity}
              done={doneActivities.has(activity.id)}
              onToggle={() => toggleActivity(activity.id)}
            />
          ))}
        </div>
      )}

      {/* Elite recovery badge */}
      {doneCount >= 5 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{
            padding: '18px 20px', marginBottom: 32,
            background: 'rgba(39,174,96,0.12)',
            border: '1.5px solid rgba(39,174,96,0.35)',
            borderRadius: 20,
            textAlign: 'center',
            boxShadow: '0 4px 20px rgba(39,174,96,0.15)',
          }}
        >
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: '#1E8449', letterSpacing: 1, marginBottom: 4 }}>
            💚 ELITE RECOVERY
          </p>
          <p style={{ color: '#2E7D52', fontSize: 13 }}>
            Twoje ciało jutro będzie silniejsze. Tak pracują zawodowcy.
          </p>
        </motion.div>
      )}

      <StreakToast streak={streakToast} visible={streakToast > 0} onHide={() => setStreakToast(0)} />
    </div>
  )
}
