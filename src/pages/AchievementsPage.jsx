import { useState, useEffect, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../context/AuthContext'
import { supabase } from '../lib/supabase'
import { fetchAchievementsCatalog, getCurrentStage, clearAchievementsCache } from '../lib/achievements'

// ── STYLE MEDALI ──────────────────────────────────────────────────────────────
const MEDAL_STYLE = {
  bronze:   { glow: 'rgba(205,127,50,0.40)'  },
  silver:   { glow: 'rgba(168,168,168,0.40)' },
  gold:     { glow: 'rgba(255,215,0,0.45)'   },
  diamond:  { glow: 'rgba(91,184,245,0.50)'  },
  platinum: { glow: 'rgba(229,228,226,0.55)' },
}

function titleFontSize(title) {
  const len = title.length
  if (len <= 7)  return 12
  if (len <= 11) return 11
  if (len <= 16) return 10
  return 9
}

// ── MODAL SZCZEGÓŁÓW ─────────────────────────────────────────────────────────
const MEDAL_LABEL_PL = { bronze: 'Brąz', silver: 'Srebro', gold: 'Złoto', diamond: 'Diament', platinum: 'Platyna' }

function AchievementModal({ achievement, onClose }) {
  const { currentStage, title, description } = achievement
  const displayDescription = currentStage.description || description
  const medal = MEDAL_STYLE[currentStage.medal]
  const color = {
    bronze: '#CD7F32', silver: '#A8A8A8', gold: '#FFD700', diamond: '#5BB8F5', platinum: '#E5E4E2',
  }[currentStage.medal]

  return (
    <motion.div
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 500,
        background: 'rgba(4,2,0,0.80)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        padding: '0 0 110px',
      }}
    >
      <motion.div
        initial={{ opacity: 0, y: 60 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 60 }}
        transition={{ type: 'spring', stiffness: 320, damping: 30 }}
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%', maxWidth: 420,
          margin: '0 16px',
          background: 'rgba(12,8,4,0.95)',
          backdropFilter: 'blur(30px)',
          WebkitBackdropFilter: 'blur(30px)',
          border: `1px solid ${color}30`,
          borderTop: `1px solid ${color}55`,
          borderRadius: 28,
          padding: '32px 28px 28px',
          boxShadow: `0 -4px 60px rgba(0,0,0,0.60), 0 0 40px ${color}15`,
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0,
        }}
      >
        {/* Kreska */}
        <div style={{ width: 36, height: 3, background: 'rgba(255,255,255,0.12)', borderRadius: 2, marginBottom: 28 }} />

        {/* Badge */}
        <img
          src={currentStage.image}
          alt={title}
          loading="lazy" decoding="async"
          style={{
            maxWidth: '100%', height: 'auto',
            filter: `drop-shadow(0 0 20px ${medal.glow})`,
            marginBottom: 20,
          }}
        />

        {/* Medal stage */}
        <span style={{
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 10,
          letterSpacing: 2.5, textTransform: 'uppercase',
          color, background: `${color}15`,
          border: `1px solid ${color}35`,
          padding: '4px 14px', borderRadius: 99,
          marginBottom: 12,
        }}>
          {MEDAL_LABEL_PL[currentStage.medal]}
        </span>

        {/* Tytuł */}
        <h2 style={{
          fontFamily: 'var(--font-display)', fontWeight: 900, fontSize: 28,
          color: 'var(--text-primary)', textTransform: 'uppercase',
          letterSpacing: 1, textAlign: 'center', lineHeight: 1.1,
          marginBottom: 14,
        }}>
          {title}
        </h2>

        {/* Opis */}
        <p style={{
          color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.65,
          textAlign: 'center', marginBottom: 28,
        }}>
          {displayDescription}
        </p>

        {/* Próg */}
        <div style={{
          width: '100%', background: 'rgba(255,255,255,0.05)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 12, padding: '10px 16px',
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          marginBottom: 20,
        }}>
          <span style={{ color: 'var(--text-dim)', fontSize: 11, letterSpacing: 1, textTransform: 'uppercase', fontWeight: 600 }}>Twój wynik</span>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color }}>{achievement.count ?? currentStage.threshold}×</span>
        </div>

        <button className="btn-ghost" onClick={onClose} style={{ width: '100%', padding: '13px' }}>
          Zamknij
        </button>
      </motion.div>
    </motion.div>
  )
}

// ── KOMÓRKA OSIĄGNIĘCIA ───────────────────────────────────────────────────────
function AchievementCell({ achievement, onPress, isNew }) {
  const { title, currentStage } = achievement
  const fs = titleFontSize(title)
  const medal = MEDAL_STYLE[currentStage.medal]

  return (
    <div
      onClick={onPress}
      style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, cursor: 'pointer' }}
    >
      <div style={{ width: '100%', aspectRatio: '1 / 1', position: 'relative' }}>
        <img
          src={currentStage.image}
          alt={title}
          loading="lazy" decoding="async"
          style={{
            width: '100%', height: '100%', objectFit: 'contain',
            filter: `drop-shadow(0 0 12px ${medal.glow})`,
          }}
        />
        {isNew && (
          <div style={{
            position: 'absolute', top: 4, right: 4,
            width: 10, height: 10, borderRadius: '50%',
            background: '#FF3B30',
            boxShadow: '0 0 6px 2px rgba(255,59,48,0.75)',
            border: '1.5px solid rgba(10,6,3,0.85)',
          }} />
        )}
      </div>
      <p style={{
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: fs,
        color: 'var(--text-primary)', textAlign: 'center',
        textTransform: 'uppercase', letterSpacing: 0.8,
        lineHeight: 1.3, wordBreak: 'break-word', width: '100%', margin: 0,
      }}>
        {title}
      </p>
    </div>
  )
}

// ── STRONA ────────────────────────────────────────────────────────────────────
export default function AchievementsPage() {
  const { profile } = useAuth()
  const [catalog, setCatalog] = useState([])
  const [userProgress, setUserProgress] = useState({})
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState(null)
  const [unlockingAll, setUnlockingAll] = useState(false)
  const [unseenBaseIds, setUnseenBaseIds] = useState(new Set())

  async function handlePress(a) {
    setSelected(a)
    if (unseenBaseIds.has(a.id)) {
      setUnseenBaseIds(prev => { const s = new Set(prev); s.delete(a.id); return s })
      await supabase
        .from('user_achievements')
        .update({ seen_at: new Date().toISOString() })
        .eq('user_id', profile.id)
        .eq('base_id', a.id)
        .is('seen_at', null)
    }
  }

  async function unlockAllAchievements() {
    if (!profile) return
    setUnlockingAll(true)
    try {
      clearAchievementsCache()
      const allCatalog = await fetchAchievementsCatalog()
      const TODAY = new Date().toISOString().split('T')[0]
      const { data: existing } = await supabase
        .from('user_achievements')
        .select('achievement_id')
        .eq('user_id', profile.id)
      const existingIds = new Set((existing || []).map(a => a.achievement_id))

      const toInsert = []
      for (const ach of allCatalog) {
        if (ach.type === 'staged') {
          for (const stage of (ach.stages || [])) {
            const key = `${ach.id}_${stage.medal}`
            if (!existingIds.has(key)) toInsert.push({ user_id: profile.id, achievement_id: key, base_id: ach.id })
          }
        } else if (ach.type === 'repeatable') {
          const key = `${ach.id}_${TODAY}`
          if (!existingIds.has(key)) toInsert.push({ user_id: profile.id, achievement_id: key, base_id: ach.id })
        }
      }

      if (toInsert.length > 0) {
        await supabase.from('user_achievements').insert(toInsert)
      }
      // Odśwież widok
      window.location.reload()
    } catch (e) {
      console.error(e)
    } finally {
      setUnlockingAll(false)
    }
  }

  const EMPTY_MESSAGES = [
    "Każda legenda zaczęła od zera. Twój pierwszy medal jest o jeden trening stąd.",
    "Puste miejsce nie wypełni się samo. Czas na robotę.",
    "Żadnych trofeów? Jeszcze. Pierwsze zdobędziesz dziś."
  ]
  const emptyMessage = useMemo(() => EMPTY_MESSAGES[Math.floor(Math.random() * EMPTY_MESSAGES.length)], [])

  useEffect(() => {
    if (!profile) return

    async function loadProgress() {
      const [
        achievementsCatalog,
        { data: recoveryTrainings },
        { data: logs },
        { data: unlockedAchievements },
        { data: shotSessions },
      ] = await Promise.all([
        fetchAchievementsCatalog(),
        supabase.from('trainings').select('id').in('category', ['recovery', 'conditioning']),
        supabase.from('activity_log').select('trainings_completed, all_done').eq('user_id', profile.id),
        supabase.from('user_achievements').select('achievement_id, base_id, seen_at').eq('user_id', profile.id),
        supabase.from('shooting_sessions').select('shot_type, made').eq('user_id', profile.id),
      ])

      // Suma trafionych per shot_type
      const shotTotals = {}
      for (const s of (shotSessions || [])) {
        shotTotals[s.shot_type] = (shotTotals[s.shot_type] || 0) + (s.made || 0)
      }

      setCatalog(achievementsCatalog)

      const recoveryIds = new Set((recoveryTrainings || []).map(t => t.id))
      let recoveryCount = 0
      let allDayCount = 0

      for (const log of (logs || [])) {
        if (log.all_done) allDayCount++
        for (const tid of (log.trainings_completed || [])) {
          if (recoveryIds.has(tid)) recoveryCount++
        }
      }

      const unlockedIds = new Set((unlockedAchievements || []).map(a => a.achievement_id))

      // Dla repeatable z licznikiem (goat_1, goat_2...): liczymy rekordy per base_id
      // Dla repeatable z datą (early_bird_2026-04-12): liczymy rekordy per base_id
      // Dla staged (regeneracja_bronze): nie liczymy rekordów — używamy activityCount
      const repeatableCounts = {}
      for (const a of (unlockedAchievements || [])) {
        const baseId = a.achievement_id.replace(/_\d+$/, '').replace(/_\d{4}-\d{2}-\d{2}$/, '')
        const cat = achievementsCatalog.find(c => c.id === baseId)
        if (cat && cat.type === 'repeatable') {
          repeatableCounts[baseId] = (repeatableCounts[baseId] || 0) + 1
        }
      }

      // base_ids z seen_at IS NULL → nieodczytane
      const unseen = new Set(
        (unlockedAchievements || [])
          .filter(a => a.seen_at === null && a.base_id)
          .map(a => a.base_id)
      )
      setUnseenBaseIds(unseen)

      setUserProgress({
        regeneracja: recoveryCount,
        allday: allDayCount,
        _unlockedIds: unlockedIds,
        _repeatableCounts: repeatableCounts,
        _shotTotals: shotTotals,
      })
      setLoading(false)
    }

    loadProgress()
  }, [profile])

  // Tylko osiągnięcia z odblokowanym co najmniej brązem
  const unlockedIds = userProgress._unlockedIds || new Set()
  const repeatableCounts = userProgress._repeatableCounts || {}
  const shotTotals = userProgress._shotTotals || {}
  const unlockedCells = catalog
    .map(a => {
      if (a.type === 'repeatable') {
        const count = repeatableCounts[a.id] || 0
        if (count === 0) return null
        return { ...a, currentStage: (a.stages || [])[0], count }
      }
      // staged z shot_type (III, II, I) — najwyższy odblokowany stage
      if (a.shot_type) {
        const hasAny = (a.stages || []).some(s => unlockedIds.has(`${a.id}_${s.medal}`))
        if (!hasAny) return null
        const stages = [...(a.stages || [])].reverse()
        const stage = stages.find(s => unlockedIds.has(`${a.id}_${s.medal}`))
        const count = shotTotals[a.shot_type] || 0
        return stage ? { ...a, currentStage: stage, count } : null
      }
      // staged klasyczne (regeneracja, allday, the_grind, shooting_sessions, ...)
      const activityCount = userProgress[a.id] || 0
      const reversedStages = [...(a.stages || [])].reverse()
      const stage = reversedStages.find(s => unlockedIds.has(`${a.id}_${s.medal}`))
      if (!stage) return null
      return { ...a, currentStage: stage, count: activityCount }
    })
    .filter(Boolean)
    .sort((a, b) => {
      const ORDER = { platinum: 0, diamond: 1, gold: 2, silver: 3, bronze: 4 }
      return (ORDER[a.currentStage?.medal] ?? 9) - (ORDER[b.currentStage?.medal] ?? 9)
    })

  const totalUnlocked = unlockedCells.length
  const total = catalog.length



  return (
    <div className="page-content" style={{ padding: '32px 22px', position: 'relative' }}>
      {/* Warm background overlay — covers blue global gradient */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none', zIndex: 0,
        background: `
          radial-gradient(ellipse 90% 55% at 50% -5%,  rgba(91,184,245,0.45) 0%, transparent 60%),
          radial-gradient(ellipse 65% 45% at -10% 65%, rgba(91,184,245,0.22) 0%, transparent 55%),
          radial-gradient(ellipse 75% 45% at 110% 55%, rgba(91,184,245,0.18) 0%, transparent 55%),
          radial-gradient(ellipse 100% 55% at 50% 110%,rgba(91,184,245,0.25) 0%, transparent 50%),
          linear-gradient(170deg, rgba(4,10,20,0.72) 0%, rgba(2,6,12,0.78) 100%)
        `,
      }} />
      <AnimatePresence>
        {selected && <AchievementModal achievement={selected} onClose={() => setSelected(null)} />}
      </AnimatePresence>
      <div style={{ position: 'relative', zIndex: 1 }}>
      <p className="section-label" style={{ marginBottom: 4 }}>Twoja kolekcja</p>
      <h1 className="display-title" style={{ fontSize: 38, marginBottom: 4 }}>Osiągnięcia</h1>
      <p style={{ color: 'var(--text-dim)', fontSize: 12, fontWeight: 500, marginBottom: 20, letterSpacing: 0.5 }}>
        {totalUnlocked} z {total} odblokowanych
      </p>

      {/* ── DEV: odblokuj wszystko ── */}
      {import.meta.env.DEV && (
        <button
          onClick={unlockAllAchievements}
          disabled={unlockingAll}
          style={{
            marginBottom: 16, width: '100%', padding: '10px',
            background: 'rgba(255,80,0,0.15)', border: '1px dashed rgba(255,80,0,0.5)',
            borderRadius: 10, color: 'var(--orange)', fontSize: 12, fontWeight: 700,
            letterSpacing: 1, textTransform: 'uppercase', cursor: 'pointer',
          }}
        >
          {unlockingAll ? 'Odblokowuję...' : '🛠 [DEV] Odblokuj wszystkie osiągnięcia'}
        </button>
      )}

      {/* Pasek postępu */}
      <div style={{ background: 'rgba(255,255,255,0.06)', borderRadius: 4, height: 3, overflow: 'hidden', marginBottom: 28 }}>
        <div style={{
          height: '100%',
          background: 'linear-gradient(90deg, var(--orange), var(--orange-hot))',
          width: `${total > 0 ? (totalUnlocked / total) * 100 : 0}%`,
          borderRadius: 4, transition: 'width 1s ease',
          boxShadow: '0 0 10px rgba(91,184,245,0.55)',
        }} />
      </div>

      {loading ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 48 }}>
          <div className="spinner" />
        </div>
      ) : unlockedCells.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px 0' }}>
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--text-dim)" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom: 12, opacity: 0.35 }}>
            <rect x="3" y="11" width="18" height="11" rx="3"/>
            <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
          </svg>
          <p style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--text-dim)', textTransform: 'uppercase', letterSpacing: 1 }}>
            Brak osiągnięć
          </p>
          <p style={{ color: 'var(--text-dim)', fontSize: 12, marginTop: 8 }}>
            {emptyMessage}
          </p>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, paddingBottom: 36 }}>
          {unlockedCells.map(a => (
            <AchievementCell key={a.id} achievement={a} onPress={() => handlePress(a)} isNew={unseenBaseIds.has(a.id)} />
          ))}
        </div>
      )}
      </div>
    </div>
  )
}
