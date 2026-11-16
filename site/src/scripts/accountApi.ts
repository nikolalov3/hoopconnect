/**
 * Warstwa danych strony konta (/konto). Jedyne miejsce, które zna Supabase.
 * UI (account.ts) rozmawia tylko z interfejsem AccountApi, więc da się go sprawdzić na atrapie (accountMock.ts, tylko dev).
 *
 * Zasady (z doświadczeń apki, patrz match-lifecycle-gotchas):
 *  - UPDATE, który RLS może odrzucić, zawsze z .select() i sprawdzeniem liczby wierszy: zablokowany zapis NIE daje błędu, tylko 0 wierszy.
 *  - Wylogowanie z zakresem 'local': domyślny 'global' unieważniłby też sesję w aplikacji i na innych urządzeniach.
 *  - Z bazy czytamy tylko to, co pokazujemy (jawne kolumny, bez select '*'). Profil jest „owner-only" (RLS), katalog kart publiczny.
 *  - Dane z bazy traktujemy jak niezaufane: nazwy trafiają do DOM przez textContent, ścieżki obrazów przechodzą walidację.
 */
import type { SupabaseClient } from '@supabase/supabase-js'
import { FRAMES } from '../data/cosmetics'

export type Item = { id: string; name: string; asset: string; rarity: string }
export type Profile = {
  id: string; name: string; hcId: number | null; city: string | null
  xp: number; arenaLevel: number; kotcWins: number
  frame: string | null; background: string | null
}
export type Snapshot = {
  email: string
  profile: Profile | null
  matchWins: number
  /** tła, które gracz może założyć (domyślne + z user_unlocks); bez „klasycznego" (brak tła) */
  backgrounds: Item[]
  /** id ramek (jak w profiles.equipped_frame), które gracz może założyć */
  ownedFrames: string[]
}
export type Equipped = { frame: string | null; background: string | null }
export type SignInResult = { ok: true } | { ok: false; error: 'invalid' | 'rate' | 'network' | 'unknown' }
export type SaveResult = { ok: true } | { ok: false; error: 'denied' | 'network' }

export interface AccountApi {
  /** czy jest zapisana sesja (bez sieci, jeśli token jest świeży) */
  hasSession(): Promise<boolean>
  /** zmiany logowania (też po powrocie z Google); zwraca funkcję wypisującą */
  onChange(cb: (signedIn: boolean) => void): () => void
  signIn(email: string, password: string): Promise<SignInResult>
  signInGoogle(): Promise<{ ok: boolean }>
  signOut(): Promise<void>
  load(): Promise<Snapshot>
  save(patch: Equipped): Promise<SaveResult>
}

/** Ścieżka zasobu z katalogu kart: tylko /litery/cyfry/_-./ bez „..": nie wpuszczamy cudzych adresów ani znaków psujących CSS url(). */
export function safeAssetPath(p: unknown): string | null {
  if (typeof p !== 'string') return null
  return /^\/[A-Za-z0-9._\-/]+$/.test(p) && !p.includes('..') && !p.includes('//') ? p : null
}
const ID = /^[A-Za-z0-9_-]{1,64}$/
/** Nazwy z bazy bywają z długą kreską; na stronie jej nie używamy (zasada marki). */
const cleanName = (s: unknown) => String(s ?? '').replace(/\s*[—–]\s*/g, ' · ').trim().slice(0, 40)

type Cfg = { redirectTo: () => string }

/** Prawdziwa implementacja na kliencie Supabase (klient wstrzykiwany: da się ją sprawdzić na stubie). */
export function createSupabaseApi(client: SupabaseClient, cfg: Cfg): AccountApi {
  const isNetwork = (e: any) => !!e && (e.name === 'AuthRetryableFetchError' || /fetch|network|load failed/i.test(String(e.message || '')))
  const sessionOrThrow = async () => {
    const { data } = await client.auth.getSession()
    if (!data.session) throw new Error('no_session')
    return data.session
  }

  return {
    async hasSession() {
      const { data } = await client.auth.getSession()
      return !!data.session
    },

    onChange(cb) {
      const { data } = client.auth.onAuthStateChange((_event, session) => cb(!!session))
      return () => data.subscription.unsubscribe()
    },

    async signIn(email, password) {
      try {
        const { error } = await client.auth.signInWithPassword({ email, password })
        if (!error) return { ok: true }
        const e: any = error
        if (e.status === 429 || e.code === 'over_request_rate_limit') return { ok: false, error: 'rate' }
        if (isNetwork(e)) return { ok: false, error: 'network' }
        if (e.code === 'invalid_credentials' || e.status === 400) return { ok: false, error: 'invalid' }
        return { ok: false, error: 'unknown' }
      } catch (e) {
        return { ok: false, error: isNetwork(e) ? 'network' : 'unknown' }
      }
    },

    async signInGoogle() {
      const { error } = await client.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: cfg.redirectTo() } })
      return { ok: !error }
    },

    async signOut() {
      await client.auth.signOut({ scope: 'local' })
    },

    async load() {
      const session = await sessionOrThrow()
      const uid = session.user.id
      const [prof, unlocks, items, players] = await Promise.all([
        client.from('profiles')
          .select('id,name,hc_id,city,xp,arena_level,kotc_wins,equipped_frame,equipped_background')
          .eq('id', uid).maybeSingle(),
        client.from('user_unlocks').select('item_id').eq('user_id', uid),
        client.from('card_items').select('id,type,name,asset_path,rarity,is_default,sort').eq('active', true).order('sort', { ascending: true }),
        client.from('match_players').select('match_id,team').eq('user_id', uid),
      ])
      if (prof.error) throw prof.error
      if (unlocks.error) throw unlocks.error
      if (items.error) throw items.error

      const p = prof.data as any
      const owned = new Set<string>((unlocks.data ?? []).map((r: any) => r.item_id))

      // Wygrane mecze: ta sama reguła co karta w apce (useCardStats): wygrana wynikiem albo walkowerem, tylko zakończone mecze.
      let matchWins = 0
      const rows = (players.data ?? []) as { match_id: string; team: string }[]
      if (rows.length) {
        const { data: matches } = await client.from('club_matches')
          .select('id,score_home,score_away,walkover,status').in('id', rows.map((r) => r.match_id)).eq('status', 'completed')
        const teamBy = new Map(rows.map((r) => [r.match_id, r.team]))
        for (const m of (matches ?? []) as any[]) {
          const team = teamBy.get(m.id)
          if (!team) continue
          if (m.walkover) {
            if ((m.walkover === 'away_noshow' && team === 'home') || (m.walkover === 'home_cancelled' && team === 'away')) matchWins++
          } else if (m.score_home != null && m.score_away != null) {
            const mine = team === 'home' ? m.score_home : m.score_away
            const theirs = team === 'home' ? m.score_away : m.score_home
            if (mine > theirs) matchWins++
          }
        }
      }

      const backgrounds: Item[] = []
      for (const it of (items.data ?? []) as any[]) {
        if (it.type !== 'background') continue
        if (!(it.is_default || owned.has(it.id))) continue
        const asset = safeAssetPath(it.asset_path)
        if (!asset || !ID.test(it.id)) continue
        backgrounds.push({ id: it.id, name: cleanName(it.name), asset, rarity: String(it.rarity || 'common') })
      }

      const profile: Profile | null = p ? {
        id: p.id, name: cleanName(p.name), hcId: p.hc_id ?? null, city: p.city ? cleanName(p.city) : null,
        xp: Number(p.xp) || 0, arenaLevel: Number(p.arena_level) || 0, kotcWins: Number(p.kotc_wins) || 0,
        frame: p.equipped_frame ?? null, background: p.equipped_background ?? null,
      } : null

      // Ramki: darmowa (early_access) + własność z user_unlocks + aktualnie założona (jak w FramePicker apki).
      const ownedFrames = FRAMES.filter((f) => f.free || owned.has(f.itemId) || profile?.frame === f.id).map((f) => f.id)

      return { email: session.user.email ?? '', profile, matchWins, backgrounds, ownedFrames }
    },

    async save(patch) {
      if (patch.frame !== null && !FRAMES.some((f) => f.id === patch.frame)) return { ok: false, error: 'denied' }
      if (patch.background !== null && !ID.test(patch.background)) return { ok: false, error: 'denied' }
      try {
        const session = await sessionOrThrow()
        const { data, error } = await client.from('profiles')
          .update({ equipped_frame: patch.frame, equipped_background: patch.background })
          .eq('id', session.user.id)
          .select('equipped_frame,equipped_background')
        if (error) return { ok: false, error: isNetwork(error) ? 'network' : 'denied' }
        if (!data || data.length !== 1) return { ok: false, error: 'denied' }   // RLS potrafi odrzucić UPDATE bez błędu: 0 wierszy
        return { ok: true }
      } catch (e) {
        return { ok: false, error: isNetwork(e) ? 'network' : 'denied' }
      }
    },
  }
}

/** Klient na prawdziwym Supabase. Biblioteka ładuje się dopiero tu (osobny chunk, tylko na /konto). */
export async function createRealApi(cfg: { url: string; key: string }): Promise<AccountApi> {
  const { createClient } = await import('@supabase/supabase-js')
  const client = createClient(cfg.url, cfg.key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  return createSupabaseApi(client, { redirectTo: () => `${location.origin}/konto/` })
}
