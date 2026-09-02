import { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useTranslation } from 'react-i18next'
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

const QUICK_META = [
  { id: 'sleep',     emoji: '😴', minutes: 540, color: '#7C5CBF' },
  { id: 'foam',      emoji: '🎯', minutes: 20,  color: '#2980B9' },
  { id: 'stretch',   emoji: '🤸', minutes: 15,  color: '#27AE60' },
  { id: 'meditate',  emoji: '🧘', minutes: 10,  color: '#E67E22' },
  { id: 'read',      emoji: '📖', minutes: 30,  color: '#D4AC0D' },
  { id: 'video',     emoji: '🎬', minutes: 30,  color: '#C0392B' },
  { id: 'cold',      emoji: '🧊', minutes: 5,   color: '#148F77' },
  { id: 'meal',      emoji: '🥗', minutes: 45,  color: '#1E8449' },
  { id: 'journal',   emoji: '✍️', minutes: 15,  color: '#2471A3' },
  { id: 'walk',      emoji: '🚶', minutes: 30,  color: '#5D6D7E' },
  { id: 'ice',       emoji: '❄️', minutes: 15,  color: '#1A5276' },
  { id: 'nap',       emoji: '💤', minutes: 20,  color: '#6C3483' },
]

const TIP_ICONS = ['💧','📵','☀️','🎵','🍌','📚','🛏️','🧠']

function RecoveryTile({ activity, done, onToggle }) {
  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={onToggle}
      style={{
        padding: '14px 10px',
        background: done
          ? `${activity.color}1A`
          : 'rgba(255,255,255,0.58)',
        backdropFilter: 'blur(20px) saturate(1.4)',
        WebkitBackdropFilter: 'blur(20px) saturate(1.4)',
        border: 'none',
        borderRadius: 14,
        cursor: 'pointer',
        textAlign: 'center',
        // Krawędzie z luminancji (Apple-style) — top highlight + bottom shade
        boxShadow: done
          ? `inset 0 1px 0 ${activity.color}30, inset 0 -1px 0 rgba(0,0,0,0.06), inset 0 0 0 0.5px ${activity.color}38, 0 1px 4px ${activity.color}1A`
          : 'inset 0 1px 0 rgba(255,255,255,0.55), inset 0 -1px 0 rgba(80,130,170,0.08), inset 0 0 0 0.5px rgba(180,210,240,0.30), 0 1px 4px rgba(100,160,210,0.10)',
        transition: 'background 0.20s ease, box-shadow 0.20s ease',
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
        position: 'relative', overflow: 'hidden',
      }}
    >
      {done && (
        <div style={{
          position: 'absolute', top: 6, right: 6,
          width: 16, height: 16, borderRadius: '50%',
          background: `radial-gradient(circle at 35% 30%, ${activity.color}, ${activity.color}CC 80%)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: `inset 0 1px 0 rgba(255,255,255,0.30)`,
        }}>
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round">
            <path d="M20 6L9 17l-5-5"/>
          </svg>
        </div>
      )}
      <span style={{ fontSize: 26, filter: done ? 'none' : 'saturate(0.7)' }}>{activity.emoji}</span>
      <p style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
        color: done ? activity.color : '#4A6880',
        letterSpacing: 0.2, lineHeight: 1.2,
        transition: 'color 0.2s',
      }}>{activity.label}</p>
      <p style={{ color: '#8AAEC4', fontSize: 10, letterSpacing: 0.1 }}>
        {activity.minutes >= 60
          ? `${Math.floor(activity.minutes/60)}h${activity.minutes%60>0 ? activity.minutes%60+'min' : ''}`
          : `${activity.minutes} min`}
      </p>
    </motion.button>
  )
}

export default function RecoveryPage() {
  const { t } = useTranslation('recovery')
  const QUICK_ACTIVITIES = QUICK_META.map(m => ({ ...m, label: t(`activities.${m.id}`) }))
  const TIPS = t('tips', { returnObjects: true }).map((text, i) => ({ icon: TIP_ICONS[i], text }))
  const { profile, refreshProfile, setProfileData } = useAuth()
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
        const credited = await creditRestDayStreak(profile, setProfileData)
        if (credited) setStreakToast(credited)
      }
    }
  }

  const doneCount = doneActivities.size
  const recoveryScore = Math.round((doneCount / 5) * 100)
  const tip = TIPS[tipIndex]

  const scoreColor = recoveryScore >= 80 ? '#1E8449' : recoveryScore >= 50 ? '#D4800A' : '#5D9CEC'

  return (
    <div className="page-content" style={{
      padding: 'max(52px, calc(env(safe-area-inset-top) + 20px)) 22px 22px',
      background: 'linear-gradient(175deg, #C8E8FA 0%, #D9EEFA 35%, #BFD9F0 100%)',
    }}>
      {/* Header */}
      <div style={{ marginBottom: 22 }}>
        <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0.2, color: '#6A96B8', marginBottom: 4 }}>
          {t('today')}
        </p>
        <h1 style={{
          fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 38,
          textTransform: 'uppercase', color: '#1A3D5C', lineHeight: 0.95, letterSpacing: 0,
        }}>{t('title')}</h1>
        <p style={{ color: '#5A8AAA', fontSize: 13, fontWeight: 400, marginTop: 8, lineHeight: 1.45 }}>
          {t('subtitle')}
        </p>
      </div>

      {/* Recovery score card — Apple liquid-glass (light), brak twardych obrysów */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        style={{
          padding: '20px 22px', marginBottom: 14,
          background: 'rgba(255,255,255,0.50)',
          backdropFilter: 'blur(30px) saturate(1.5)',
          WebkitBackdropFilter: 'blur(30px) saturate(1.5)',
          border: 'none',
          borderRadius: 18,
          boxShadow: [
            'inset 0 1px 0 rgba(255,255,255,0.65)',
            'inset 0 -1px 0 rgba(80,130,170,0.08)',
            'inset 0 0 0 0.5px rgba(180,215,245,0.40)',
            '0 1px 6px rgba(80,150,200,0.10)',
          ].join(', '),
        }}>
        <div style={{ marginBottom: 14 }}>
          <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: 1.6, textTransform: 'uppercase', color: '#6A96B8', marginBottom: 4 }}>
            {t('recoveryScore')}
          </p>
          <p style={{
            fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 56,
            color: scoreColor, lineHeight: 1,
            // Glow przyciszony 70% (20px/39 → 8px/12)
            textShadow: `0 0 8px ${scoreColor}1F`,
          }}>{recoveryScore}<span style={{ fontSize: 22 }}>%</span></p>
        </div>
        {/* Progress bar — bez neon glow */}
        <div style={{ background: 'rgba(150,200,235,0.26)', borderRadius: 4, height: 5, overflow: 'hidden' }}>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(recoveryScore, 100)}%` }}
            transition={{ type: 'spring', stiffness: 100, damping: 24, delay: 0.2 }}
            style={{
              height: '100%', borderRadius: 4,
              background: recoveryScore >= 80
                ? 'linear-gradient(90deg, #27AE60, #2ECC71)'
                : recoveryScore >= 50
                ? 'linear-gradient(90deg, #D4800A, #F39C12)'
                : 'linear-gradient(90deg, #4A8FC8, #5DADE2)',
            }}
          />
        </div>
      </motion.div>

      {/* Daily tip — quieter, no border */}
      <motion.div
        initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30, delay: 0.08 }}
        style={{
          padding: '14px 16px', marginBottom: 22,
          background: 'rgba(255,255,255,0.42)',
          backdropFilter: 'blur(28px) saturate(1.4)',
          WebkitBackdropFilter: 'blur(28px) saturate(1.4)',
          border: 'none',
          borderRadius: 14,
          boxShadow: [
            'inset 0 1px 0 rgba(255,255,255,0.50)',
            'inset 0 -1px 0 rgba(80,130,170,0.06)',
            '0 1px 4px rgba(80,150,200,0.08)',
          ].join(', '),
          display: 'flex', gap: 12, alignItems: 'flex-start',
        }}>
        <span style={{ fontSize: 22, flexShrink: 0, marginTop: 1 }}>{tip.icon}</span>
        <p style={{ color: '#4A6880', fontSize: 13, lineHeight: 1.55, letterSpacing: 0.1 }}>
          <span style={{ color: '#2471A3', fontWeight: 600 }}>{t('proTip')}</span>
          {tip.text}
        </p>
      </motion.div>

      {/* Activities grid */}
      <p style={{ fontSize: 13, fontWeight: 500, letterSpacing: 0.2, color: '#6A96B8', marginBottom: 12 }}>
        {t('checkToday')}
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

      {/* Elite recovery badge — luminance edge zamiast border */}
      {doneCount >= 5 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          style={{
            padding: '18px 20px', marginBottom: 32,
            background: 'rgba(39,174,96,0.10)',
            backdropFilter: 'blur(28px) saturate(1.5)',
            WebkitBackdropFilter: 'blur(28px) saturate(1.5)',
            border: 'none',
            borderRadius: 18,
            textAlign: 'center',
            boxShadow: [
              'inset 0 1px 0 rgba(46,204,113,0.35)',
              'inset 0 -1px 0 rgba(30,132,73,0.10)',
              'inset 0 0 0 0.5px rgba(39,174,96,0.18)',
              '0 1px 6px rgba(39,174,96,0.10)',
            ].join(', '),
          }}
        >
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 20, color: '#1E8449', letterSpacing: 1, marginBottom: 4 }}>
            {t('eliteBadge')}
          </p>
          <p style={{ color: '#2E7D52', fontSize: 13 }}>
            {t('eliteSubtitle')}
          </p>
        </motion.div>
      )}

      <StreakToast streak={streakToast} visible={streakToast > 0} onHide={() => setStreakToast(0)} />
    </div>
  )
}
