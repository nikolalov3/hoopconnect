import { supabase } from './supabase'

// ── POBIERZ KATALOG Z BAZY ────────────────────────────────────────────────────
// Zastępuje hardkodowany ACHIEVEMENTS_CATALOG — teraz dane żyją w Supabase.
// Wynik jest cachowany w module żeby nie robić wielu requestów na jednej sesji.

let _catalogCache = null
let _trainingCategoryCache = null  // { recovery: Set<id>, shooting: Set<id> } — globalne, nigdy nie zmienia się per user

export async function fetchAchievementsCatalog() {
  if (_catalogCache) return _catalogCache

  const { data, error } = await supabase
    .from('achievements_catalog')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[achievements] fetchAchievementsCatalog error:', error)
    return []
  }

  _catalogCache = data || []
  return _catalogCache
}

/**
 * Pobiera ID treningów per kategoria w jednej query (zamiast osobnej dla każdego),
 * cachuje w module — kategorie treningów nie zmieniają się per user, więc każdy
 * mount AchievementsPage / lib/achievements deduplikuje request między userami.
 */
export async function getTrainingCategoryIds() {
  if (_trainingCategoryCache) return _trainingCategoryCache

  const { data } = await supabase
    .from('trainings')
    .select('id, category')
    .in('category', ['recovery', 'conditioning', 'shooting'])

  const recovery = new Set()
  const shooting = new Set()
  for (const t of (data || [])) {
    if (t.category === 'recovery' || t.category === 'conditioning') recovery.add(t.id)
    if (t.category === 'shooting') shooting.add(t.id)
  }

  _trainingCategoryCache = { recovery, shooting }
  return _trainingCategoryCache
}

// Wyczyść cache (np. po dodaniu nowego osiągnięcia przez admina)
export function clearAchievementsCache() {
  _catalogCache = null
  _trainingCategoryCache = null
}

// ── COFNIĘCIE OSIĄGNIĘĆ ───────────────────────────────────────────────────────
// Sprawdza czy użytkownik nadal spełnia progi dla osiągnięć danego base_id.
// Jeśli currentCount spadł poniżej progu — usuwa osiągnięcie z user_achievements.
// Wywołuj po każdym cofnięciu treningu/aktywności.

export async function revokeAchievementsIfNeeded(userId, baseId, currentCount) {
  const catalog = await fetchAchievementsCatalog()
  const ach = catalog.find(a => a.id === baseId)
  if (!ach) return []

  const { data: userAchs } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId)
    .eq('base_id', baseId)

  if (!userAchs?.length) return []

  const toRevoke = userAchs.filter(ua => {
    const stage = (ach.stages || []).find(s => `${ach.id}_${s.medal}` === ua.achievement_id)
    return stage && currentCount < stage.threshold
  })

  for (const ua of toRevoke) {
    await supabase.from('user_achievements')
      .delete()
      .eq('user_id', userId)
      .eq('achievement_id', ua.achievement_id)
  }

  return toRevoke.map(ua => ua.achievement_id)
}

// ── PEŁNA RESYNC STAGED ACHIEVEMENTS ─────────────────────────────────────────
// Przelicza wszystkie staged achievements dla użytkownika na podstawie
// aktualnych danych w DB i usuwa te które nie są już zasłużone.
// Wywołuj po każdym cofnięciu treningu.

export async function revokeStaleAchievements(userId) {
  const catalog = await fetchAchievementsCatalog()
  const stagedAchs = catalog.filter(a => a.type === 'staged')
  if (!stagedAchs.length) return

  // Pobierz wszystkie earned achievements tego użytkownika
  const { data: userAchs } = await supabase
    .from('user_achievements')
    .select('achievement_id, base_id')
    .eq('user_id', userId)
  if (!userAchs?.length) return

  // Pobierz dane potrzebne do przeliczenia.
  // Kategorie treningów (recovery/shooting IDs) cachowane modułowo — wcześniej były
  // 2 osobne queries z .select('*') przy każdym wywołaniu, teraz raz na sesję.
  const [
    { data: logs },
    trainingCats,
    { data: shotSessions },
  ] = await Promise.all([
    supabase.from('activity_log').select('trainings_completed, all_done').eq('user_id', userId),
    getTrainingCategoryIds(),
    supabase.from('shooting_sessions').select('made, attempted, shot_type').eq('user_id', userId),
  ])

  const recoveryIds = trainingCats.recovery
  const shootingIds = trainingCats.shooting

  let recoveryCount = 0, allDayCount = 0, totalTrainingsCount = 0, shootingSessionsCount = 0
  for (const log of (logs || [])) {
    if (log.all_done) allDayCount++
    for (const tid of (log.trainings_completed || [])) {
      if (recoveryIds.has(tid)) recoveryCount++
      if (shootingIds.has(tid)) shootingSessionsCount++
      totalTrainingsCount++
    }
  }

  // Liczniki dla shot achievements
  const shotCounts = {}
  const perfectCounts = {}
  for (const s of (shotSessions || [])) {
    shotCounts[s.shot_type] = (shotCounts[s.shot_type] || 0) + (s.made || 0)
    if (s.made === s.attempted && s.attempted > 0)
      perfectCounts[s.shot_type] = (perfectCounts[s.shot_type] || 0) + 1
  }

  const stageProgress = {
    regeneracja: recoveryCount,
    allday: allDayCount,
    the_grind: totalTrainingsCount,
    shooting_sessions: shootingSessionsCount,
  }

  // Dla shot achievements — dynamicznie z shot_type
  for (const ach of stagedAchs) {
    if (ach.shot_type) {
      const isP = ach.id.startsWith('perfect_')
      stageProgress[ach.id] = isP
        ? (perfectCounts[ach.shot_type] || 0)
        : (shotCounts[ach.shot_type] || 0)
    }
  }

  // Sprawdź każde earned staged achievement i cofnij jeśli próg nie jest spełniony
  const toRevoke = []
  for (const ua of userAchs) {
    const ach = stagedAchs.find(a => a.id === ua.base_id)
    if (!ach) continue
    const stage = (ach.stages || []).find(s => `${ach.id}_${s.medal}` === ua.achievement_id)
    if (!stage) continue
    const count = stageProgress[ach.id] ?? 0
    if (count < stage.threshold) toRevoke.push(ua.achievement_id)
  }

  if (!toRevoke.length) return

  // Batch delete jedną query zamiast N osobnych
  await supabase.from('user_achievements')
    .delete()
    .eq('user_id', userId)
    .in('achievement_id', toRevoke)
}

// Wygodny wrapper — sprawdza wszystkie shot achievements po cofnięciu sesji
// Zoptymalizowane: jedna query do user_achievements zamiast N (po jednej na ach.id)
export async function revokeShotAchievementsIfNeeded(userId, shotType) {
  const catalog = await fetchAchievementsCatalog()
  const shotAchs = catalog.filter(
    a => a.type === 'staged' && a.shot_type === shotType
  )
  if (!shotAchs.length) return []

  // Aktualna suma trafionych rzutów + perfect count w jednej query
  const { data: sessions } = await supabase
    .from('shooting_sessions')
    .select('made, attempted')
    .eq('user_id', userId)
    .eq('shot_type', shotType)
  const totalMade = (sessions || []).reduce((sum, r) => sum + (r.made || 0), 0)
  const perfectCount = (sessions || []).filter(
    s => s.made === s.attempted && s.attempted > 0
  ).length

  // Pobierz WSZYSTKIE earned achievements raz, filtruj w pamięci
  const baseIds = shotAchs.map(a => a.id)
  const { data: earned } = await supabase
    .from('user_achievements')
    .select('achievement_id, base_id')
    .eq('user_id', userId)
    .in('base_id', baseIds)

  if (!earned?.length) return []

  // Zbuduj mapę base_id → ach
  const achById = Object.fromEntries(shotAchs.map(a => [a.id, a]))

  const toRevoke = []
  for (const ua of earned) {
    const ach = achById[ua.base_id]
    if (!ach) continue
    const stage = (ach.stages || []).find(s => `${ach.id}_${s.medal}` === ua.achievement_id)
    if (!stage) continue
    const currentCount = ach.id.startsWith('perfect_') ? perfectCount : totalMade
    if (currentCount < stage.threshold) toRevoke.push(ua.achievement_id)
  }

  if (!toRevoke.length) return []

  // Batch delete jedną query (wcześniej: pętla N delete'ów)
  await supabase.from('user_achievements')
    .delete()
    .eq('user_id', userId)
    .in('achievement_id', toRevoke)

  return toRevoke
}

// ── ZWYCIĘSTWA DRUŻYNOWE ──────────────────────────────────────────────────────
// Sprawdza osiągnięcia za wygrane mecze drużynowe.
// Liczy mecze gdzie gracz uczestniczył i jego drużyna wygrała.
// Wywołuj po każdym zatwierdzonym wyniku meczu.

export async function checkTeamWinAchievements(userId, weekNumber) {
  const catalog = await fetchAchievementsCatalog()
  const ach = catalog.find(a => a.id === 'teamwin')
  if (!ach) return []

  // Pobierz wszystkie mecze użytkownika
  const { data: playerRows } = await supabase
    .from('match_players')
    .select('match_id, team')
    .eq('user_id', userId)
  if (!playerRows?.length) return []

  const matchIds = playerRows.map(r => r.match_id)
  const { data: completedMatches } = await supabase
    .from('club_matches')
    .select('id, score_home, score_away, walkover')
    .in('id', matchIds)
    .eq('status', 'completed')
    .is('walkover', null)   // walkover nie liczy się jako prawdziwe zwycięstwo

  const teamMap = Object.fromEntries(playerRows.map(r => [r.match_id, r.team]))
  let wins = 0
  for (const m of (completedMatches || [])) {
    if (m.score_home == null || m.score_away == null) continue
    const team = teamMap[m.id]
    const won = team === 'home' ? m.score_home > m.score_away : m.score_away > m.score_home
    if (won) wins++
  }

  const { data: existing } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId)
  const unlockedIds = new Set((existing || []).map(a => a.achievement_id))

  const newlyUnlocked = []
  for (const stage of (ach.stages || [])) {
    const key = `${ach.id}_${stage.medal}`
    if (wins >= stage.threshold && !unlockedIds.has(key)) {
      await supabase.from('user_achievements').insert({
        user_id: userId, achievement_id: key, base_id: ach.id,
      })
      unlockedIds.add(key)
      newlyUnlocked.push({ title: ach.title, stage, total: wins })
      await awardMedalPoints(userId, stage.medal, weekNumber, key)
    }
  }
  return newlyUnlocked
}

// ── PUNKTY ZA MEDALE ─────────────────────────────────────────────────────────
// Kolejność: bronze < silver < gold < platinum < diamond (najwyższy)
export const MEDAL_POINTS = { bronze: 20, silver: 25, gold: 50, platinum: 75, diamond: 100 }

export async function awardMedalPoints(userId, medal, weekNumber, achievementId = null) {
  const pts = MEDAL_POINTS[medal]
  if (!pts || !weekNumber) return
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('points_log').upsert({
    user_id:        userId,
    training_id:    null,
    points:         pts,
    week_number:    weekNumber,
    date:           today,
    source:         'achievement',
    achievement_id: achievementId,
  }, {
    // If same achievement was already awarded today → update (no-op in practice)
    onConflict: 'user_id,date,achievement_id,source',
    ignoreDuplicates: true,
  })
}

// ── HELPERS ───────────────────────────────────────────────────────────────────

// Zwraca aktualny stage na podstawie licznika
export function getCurrentStage(achievement, count) {
  const stages = achievement.stages || []
  let current = null
  for (const stage of stages) {
    if (count >= stage.threshold) current = stage
  }
  return current
}

// Zwraca nowy stage jeśli właśnie przekroczono próg (prevCount → newCount)
export function getNewlyUnlocked(achievement, prevCount, newCount) {
  const stages = achievement.stages || []
  for (const stage of stages) {
    if (prevCount < stage.threshold && newCount >= stage.threshold) {
      return stage
    }
  }
  return null
}

// ── PERFEKCYJNA SESJA ────────────────────────────────────────────────────────
// Sprawdza osiągnięcia za 100% skuteczności w sesji danego shot_type.
// Liczy ile razy użytkownik miał perfekcyjną sesję i odblokowuje staged stages.

export async function checkPerfectSession(userId, shotType, made, attempted, weekNumber) {
  if (made !== attempted || attempted === 0) return [] // nie perfekcyjna

  const catalog = await fetchAchievementsCatalog()
  const perfectAchs = catalog.filter(
    a => a.type === 'staged' && a.shot_type === shotType && a.id.startsWith('perfect_')
  )
  if (!perfectAchs.length) return []

  // Ile perfekcyjnych sesji dotychczas (włącznie z tą)
  const { data: sessions } = await supabase
    .from('shooting_sessions')
    .select('made, attempted')
    .eq('user_id', userId)
    .eq('shot_type', shotType)
  const perfectCount = (sessions || []).filter(s => s.made === s.attempted && s.attempted > 0).length

  const { data: existing } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId)
  const unlockedIds = new Set((existing || []).map(a => a.achievement_id))

  const newlyUnlocked = []
  for (const ach of perfectAchs) {
    for (const stage of (ach.stages || [])) {
      const key = `${ach.id}_${stage.medal}`
      if (perfectCount >= stage.threshold && !unlockedIds.has(key)) {
        await supabase.from('user_achievements').insert({
          user_id: userId,
          achievement_id: key,
          base_id: ach.id,
        })
        unlockedIds.add(key)
        newlyUnlocked.push({ title: ach.title, stage, total: perfectCount })
        await awardMedalPoints(userId, stage.medal, weekNumber, key)
      }
    }
  }
  return newlyUnlocked
}

// ── SKUMULOWANE OSIĄGNIĘCIA RZUTOWE ──────────────────────────────────────────
// Sprawdza osiągnięcia oparte o łączną liczbę trafionych rzutów danego typu.
// Wywołuj po każdym zakończeniu sesji rzutowej.
// Zwraca tablicę { title, stage, total } — nowo odblokowanych osiągnięć.

export async function checkShotAchievements(userId, shotType, weekNumber) {
  const catalog = await fetchAchievementsCatalog()
  const shotAchs = catalog.filter(a => a.type === 'staged' && a.shot_type === shotType && !a.id.startsWith('perfect_'))
  if (!shotAchs.length) return []

  // Suma trafionych rzutów danego typu dla użytkownika
  const { data: sessions } = await supabase
    .from('shooting_sessions')
    .select('made')
    .eq('user_id', userId)
    .eq('shot_type', shotType)
  const totalMade = (sessions || []).reduce((sum, r) => sum + (r.made || 0), 0)

  // Już odblokowane osiągnięcia
  const { data: existing } = await supabase
    .from('user_achievements')
    .select('achievement_id')
    .eq('user_id', userId)
  const unlockedIds = new Set((existing || []).map(a => a.achievement_id))

  const newlyUnlocked = []
  for (const ach of shotAchs) {
    for (const stage of (ach.stages || [])) {
      const key = `${ach.id}_${stage.medal}`
      if (totalMade >= stage.threshold && !unlockedIds.has(key)) {
        await supabase.from('user_achievements').insert({
          user_id: userId,
          achievement_id: key,
          base_id: ach.id,
        })
        unlockedIds.add(key) // zapobiega duplikatom w tej samej iteracji
        newlyUnlocked.push({ title: ach.title, stage, total: totalMade })
        await awardMedalPoints(userId, stage.medal, weekNumber, key)
      }
    }
  }
  return newlyUnlocked
}
