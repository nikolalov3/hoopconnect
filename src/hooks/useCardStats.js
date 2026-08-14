import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

/**
 * Match wins + KotC wins for a user — the two PlayerCard3D stats that aren't
 * already on the `profiles` row (name / hc_id / arena_level / xp / equipped_frame
 * all come from AuthContext's profile). Kept lightweight: two queries + one
 * follow-up, mirroring the win-count logic in ClubPage's usePlayerProfileData.
 */
export function useCardStats(userId) {
  const [stats, setStats] = useState({ matchWins: 0, kotcWins: 0 })

  useEffect(() => {
    if (!userId) return
    let cancelled = false

    ;(async () => {
      const [mpRes, kotcRes] = await Promise.all([
        supabase.from('match_players').select('match_id,team').eq('user_id', userId),
        supabase.from('user_achievements')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', userId).eq('base_id', 'kotc_win_july'),
      ])

      let wins = 0
      const mpRows = mpRes.data || []
      const matchIds = mpRows.map(r => r.match_id)
      if (matchIds.length) {
        const { data: matches } = await supabase.from('club_matches')
          .select('id,score_home,score_away,walkover,status')
          .in('id', matchIds).eq('status', 'completed')
        const teamByMatch = {}
        mpRows.forEach(r => { teamByMatch[r.match_id] = r.team })
        ;(matches || []).forEach(m => {
          const team = teamByMatch[m.id]
          if (!team) return
          if (m.walkover) {
            const won = (m.walkover === 'away_noshow' && team === 'home') ||
                        (m.walkover === 'home_cancelled' && team === 'away')
            if (won) wins++
          } else if (m.score_home != null && m.score_away != null) {
            const ps = team === 'home' ? m.score_home : m.score_away
            const os = team === 'home' ? m.score_away : m.score_home
            if (ps > os) wins++
          }
        })
      }

      if (!cancelled) setStats({ matchWins: wins, kotcWins: kotcRes?.count ?? 0 })
    })()

    return () => { cancelled = true }
  }, [userId])

  return stats
}
