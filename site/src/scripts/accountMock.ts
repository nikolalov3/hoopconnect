/**
 * Atrapa AccountApi do oglądania strony konta bez logowania do prawdziwej bazy. TYLKO DEV:
 * account.ts ładuje ją dynamicznie za warunkiem import.meta.env.DEV, więc w buildzie produkcyjnym jej nie ma.
 * Użycie: http://localhost:4321/konto/?mock=1  (dodatkowo &in=1 startuje zalogowany, &pro=0 daje konto bez profilu,
 * &fail=1 sprawia, że zapis się nie udaje). Dane logowania w atrapie: dowolny e-mail, hasło „bad" daje błąd.
 */
import type { AccountApi, Equipped, Snapshot } from './accountApi'

export function createMockApi(q: URLSearchParams): AccountApi {
  let signedIn = q.get('in') === '1'
  const listeners = new Set<(s: boolean) => void>()
  const emit = () => listeners.forEach((cb) => cb(signedIn))
  const wait = (ms = 450) => new Promise((r) => setTimeout(r, ms))
  const state: Equipped = { frame: 'early_access', background: null }
  const hasProfile = q.get('pro') !== '0'
  const extra = q.get('items') !== '0'

  return {
    async hasSession() { await wait(150); return signedIn },
    onChange(cb) { listeners.add(cb); return () => listeners.delete(cb) },
    async signIn(email, password) {
      await wait()
      if (password === 'bad') return { ok: false, error: 'invalid' }
      if (!email) return { ok: false, error: 'unknown' }
      signedIn = true; emit()
      return { ok: true }
    },
    async signInGoogle() { await wait(); return { ok: false } },
    async signOut() { await wait(200); signedIn = false; emit() },
    async load(): Promise<Snapshot> {
      await wait()
      return {
        email: 'demo@example.test',
        profile: hasProfile ? {
          id: 'mock', name: 'Alex', hcId: 20102, city: 'Kraków', xp: 5940, arenaLevel: 5, kotcWins: 4,
          frame: state.frame, background: state.background,
        } : null,
        matchWins: 15,
        backgrounds: extra ? [{ id: 'bg_dragon', name: 'Rok Smoka', asset: '/backgrounds/dragon.png', rarity: 'legendary' }] : [],
        ownedFrames: extra ? ['early_access', 'diamond_s1', 'ff'] : ['early_access'],
      }
    },
    async save(patch) {
      await wait(600)
      if (q.get('fail') === '1') return { ok: false, error: 'denied' }
      state.frame = patch.frame; state.background = patch.background
      return { ok: true }
    },
  }
}
