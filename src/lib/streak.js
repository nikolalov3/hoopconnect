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
 * Credit streak when a recovery activity or match participation happens.
 * No-op if streak was already credited today (profile.last_active === today).
 * Also writes an activity_log entry so achievement calculations stay in sync.
 *
 * @param {object}   profile         current profile object from AuthContext
 * @param {function} refreshProfile  refreshProfile from AuthContext
 */
/**
 * Returns the new streak value if the streak was credited, or 0 if it was
 * already credited today (use the return value to decide whether to show a toast).
 */
export async function creditRestDayStreak(profile, refreshProfile) {
  const today = new Date().toISOString().split('T')[0]

  if (!profile) return 0
  // Normalise: last_active may come back as full ISO timestamp or plain date
  if ((profile.last_active || '').slice(0, 10) === today) return 0  // already credited today

  const newStreak = (profile.streak || 0) + 1

  await supabase.from('profiles').update({
    streak:         newStreak,
    longest_streak: Math.max(newStreak, profile.longest_streak || 0),
    last_active:    today,
  }).eq('id', profile.id)

  // Keep activity_log in sync so achievement streak calculations work correctly
  await supabase.from('activity_log').upsert(
    { user_id: profile.id, date: today, trainings_completed: [], all_done: true },
    { onConflict: 'user_id,date' }
  )

  await refreshProfile()
  return newStreak
}
