import { supabase } from './supabase'

/**
 * Calculates fraud_probability (0.0–1.0) based on shooting sessions.
 * Called after every shooting session save — fire-and-forget.
 *
 * Signals:
 *  1. Tap-by-tap spam  — started_at set + < 8 sek/rzut → ktoś klika zamiast strzelać
 *                        (waga ŚREDNIA — ręczny wpis po treningu nie jest liczony:
 *                         tam started_at = czas otwarcia ekranu, nie sesji rzutów)
 *  2. Perfekcja sesji  — > 95% w jednej sesji (≥10 rzutów) → waga WYSOKA
 *  3. Stała skuteczność — śr. > 90% w ost. 10 sesjach → waga WYSOKA
 *  4. Spam sesji       — ten sam typ rzutów > 2× dziennie → waga ŚREDNIA
 */
export async function recalcFraud(userId) {
  try {
    const today = new Date().toISOString().split('T')[0]

    const { data: sessions } = await supabase
      .from('shooting_sessions')
      .select('made, attempted, shot_type, started_at, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(20)

    if (!sessions?.length) return

    let score    = 0
    let maxScore = 0

    // ── per-session signals ─────────────────────────────────────────
    for (const s of sessions) {
      const accuracy    = s.attempted > 0 ? s.made / s.attempted : 0
      const durationSec = (s.started_at && s.created_at)
        ? (new Date(s.created_at) - new Date(s.started_at)) / 1000
        : null
      const secPerShot  = (durationSec !== null && s.attempted > 0)
        ? durationSec / s.attempted
        : null

      // Signal 1 — ŚREDNIA waga: ktoś klika rzuty w aplikacji zamiast naprawdę strzelać
      // Liczymy tylko gdy started_at istnieje (tap-by-tap, nie ręczny wpis z cyframi)
      // Ręczny wpis cyfr po treningu: started_at = czas wejścia na ekran → brak tej flagi
      // Waga średnia (1.5/3), nie wysoka — bo nie jesteśmy w 100% pewni
      maxScore += 3
      if (secPerShot !== null && secPerShot < 5)       score += 1.5   // wyraźnie za szybko
      else if (secPerShot !== null && secPerShot < 8)  score += 0.8   // lekko podejrzany

      // Signal 2 — WYSOKA waga: perfekcyjna celność w jednej sesji
      maxScore += 3
      if (s.attempted >= 10 && accuracy > 0.95)        score += 3
      else if (s.attempted >= 10 && accuracy > 0.90)   score += 1.5
    }

    // ── aggregate signals ───────────────────────────────────────────
    const recent = sessions.slice(0, 10)

    // Signal 3 — WYSOKA waga: stale wysoka skuteczność (≥3 sesje)
    if (recent.length >= 3) {
      const avgAcc = recent.reduce((sum, s) =>
        sum + (s.attempted > 0 ? s.made / s.attempted : 0), 0) / recent.length
      maxScore += 4
      if      (avgAcc > 0.92) score += 4      // niemożliwe dla większości graczy
      else if (avgAcc > 0.90) score += 2.5    // bardzo podejrzane
      else if (avgAcc > 0.85) score += 1      // lekki sygnał
    }

    // Signal 4 — ŚREDNIA waga: spam sesji tego samego typu w ciągu dnia
    const todaySessions = sessions.filter(s => s.created_at?.startsWith(today))
    const byType = {}
    for (const s of todaySessions) byType[s.shot_type] = (byType[s.shot_type] || 0) + 1
    const maxSameType = Math.max(0, ...Object.values(byType))
    maxScore += 2
    if      (maxSameType > 3) score += 2
    else if (maxSameType > 2) score += 1

    // ── normalizacja 0.0–1.0 ────────────────────────────────────────
    const probability = maxScore > 0
      ? Math.min(1.0, Math.round((score / maxScore) * 100) / 100)
      : 0

    const update = { fraud_probability: probability }
    if (probability >= 0.6) update.fraud_flagged_at = new Date().toISOString()

    await supabase.from('profiles').update(update).eq('id', userId)

  } catch (e) {
    console.warn('[anticheat] recalcFraud failed', e)
  }
}
