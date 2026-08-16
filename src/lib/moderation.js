import { supabase } from './supabase'

// Zgłoszenie nieodpowiedniej nazwy gracza (reaktywna połowa Apple 1.2 UGC).
// Jedno zgłoszenie na parę (reporter, zgłoszony) — duplikaty są cicho ignorowane.
export async function reportName(reportedUserId, reportedName, context = null) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !reportedUserId) return { ok: false }
  const { error } = await supabase.from('name_reports').upsert(
    { reporter_id: user.id, reported_user_id: reportedUserId, reported_name: reportedName, context },
    { onConflict: 'reporter_id,reported_user_id', ignoreDuplicates: true },
  )
  return { ok: !error, error }
}
