import { supabase } from './supabase'

// ── POBIERZ KATALOG Z BAZY ────────────────────────────────────────────────────
// Zastępuje hardkodowany ACHIEVEMENTS_CATALOG — teraz dane żyją w Supabase.
// Wynik jest cachowany w module żeby nie robić wielu requestów na jednej sesji.

let _catalogCache = null

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

// Wyczyść cache (np. po dodaniu nowego osiągnięcia przez admina)
export function clearAchievementsCache() {
  _catalogCache = null
}

// ── PUNKTY ZA MEDALE ─────────────────────────────────────────────────────────
export const MEDAL_POINTS = { bronze: 20, silver: 25, gold: 50, diamond: 75, platinum: 100 }

export async function awardMedalPoints(userId, medal, weekNumber) {
  const pts = MEDAL_POINTS[medal]
  if (!pts || !weekNumber) return
  const today = new Date().toISOString().split('T')[0]
  await supabase.from('points_log').insert({
    user_id: userId,
    training_id: null,
    points: pts,
    week_number: weekNumber,
    date: today,
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
        await awardMedalPoints(userId, stage.medal, weekNumber)
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
        await awardMedalPoints(userId, stage.medal, weekNumber)
      }
    }
  }
  return newlyUnlocked
}
