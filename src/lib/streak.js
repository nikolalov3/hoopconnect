/**
 * Streak helpers shared between HomePage, RecoveryPage, ClubPage.
 *
 * Rules (wystarczy JEDNA aktywność dziennie):
 *  - 'T' / 'R' day  →  pierwszy zaliczony trening w HomePage kredytuje serię
 *  - Każdy dzień    →  pierwsza aktywność w zakładce Regeneracja kredytuje serię
 *  - 'O' (odpoczynek) → dołączenie do meczu w zakładce Klub kredytuje serię
 */

import { supabase } from './supabase'

/**
 * Next streak value when crediting activity today, given the profile's stored
 * `streak` and `last_active`.
 *
 * - last_active === yesterday  → continue the run (+1)
 * - last_active older than yesterday (a full day was missed) → RESET to 1
 * - last_active empty/null (brand-new profile, or same-day unmark that cleared
 *   it) → continue (+1), so undo/re-mark doesn't nuke a legit streak
 *
 * This is the fix for "streak never resets" — previously every new-day credit
 * just did (streak + 1) regardless of how many days were skipped.
 *
 * Callers must already have ensured last_active !== today (crediting once/day).
 */
export function nextStreakValue(lastActive, currentStreak) {
  const today     = new Date().toISOString().split('T')[0]
  const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0]
  const la = (lastActive || '').slice(0, 10)
  const missedDay = la !== '' && la !== yesterday && la !== today
  return missedDay ? 1 : (currentStreak || 0) + 1
}

/**
 * Credit streak when a recovery activity or match participation happens.
 * No-op if streak was already credited today (profile.last_active === today).
 * Also writes an activity_log entry so achievement calculations stay in sync.
 *
 * Optimistic update: returns the new streak value AND applies it locally via
 * setProfileData (no refreshProfile fetch — saves a `profiles` SELECT per call,
 * which at scale = N writes/min × N rest-day actions = thousands of redundant
 * profile fetches per minute).
 *
 * @param {object}   profile         current profile object from AuthContext
 * @param {function} setProfileData  setProfileData from AuthContext (optional —
 *                                   if absent, caller must update local state)
 * @returns {number} the new streak if credited, or 0 if already credited today
 */
export async function creditRestDayStreak(profile, setProfileData) {
  const today = new Date().toISOString().split('T')[0]

  if (!profile) return 0
  // Normalise: last_active may come back as full ISO timestamp or plain date
  if ((profile.last_active || '').slice(0, 10) === today) return 0  // already credited today

  const newStreak = nextStreakValue(profile.last_active, profile.streak)
  const newLongest = Math.max(newStreak, profile.longest_streak || 0)

  await supabase.from('profiles').update({
    streak:         newStreak,
    longest_streak: newLongest,
    last_active:    today,
  }).eq('id', profile.id)

  // Keep activity_log in sync so achievement streak calculations work correctly
  await supabase.from('activity_log').upsert(
    { user_id: profile.id, date: today, trainings_completed: [], all_done: true },
    { onConflict: 'user_id,date' }
  )

  // Optimistic local update — no DB refetch needed
  if (typeof setProfileData === 'function') {
    setProfileData({ streak: newStreak, longest_streak: newLongest, last_active: today })
  }

  return newStreak
}
