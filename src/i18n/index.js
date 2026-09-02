import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'

// ── Player app (hoopconnect.pl) — ładujemy TYLKO wykryty język ──────────────
// Wcześniej oba języki (21 namespace'ów × 2) siedziały w jednym chunku (~113 KB)
// ładowanym przed pierwszym renderem — Polak ściągał cały angielski. Teraz każdy
// język to osobny chunk (locales/<lng>/index.js), a ładujemy jeden. PL jest
// kompletny względem EN (zweryfikowane), więc nie potrzebuje fallbacku na en.
// Coach (trener.) i admin (gu.) to osobne apki — nie używają tej instancji.

const LANG_STORAGE_KEY = 'hc_lang'
const SUPPORTED = ['en', 'pl']
const NAMESPACES = [
  'common', 'auth', 'onboarding', 'home', 'shooting', 'calendar', 'stats',
  'achievements', 'recovery', 'club', 'joinClub', 'qrLanding', 'arenaRoad',
  'settings', 'leaderboard', 'notifications', 'frames', 'leagueInfo', 'addSession',
  'trainingCard', 'appStory',
]

// Ta sama reguła co detector poniżej (localStorage → język systemu), tylko
// synchronicznie — żeby wiedzieć, KTÓRY chunk ściągnąć, zanim i18next wystartuje.
// Każdy język systemu inny niż polski → angielski. Bez promptu o lokalizację.
function systemLanguageOrPolish() {
  const primary = (typeof navigator !== 'undefined' && navigator.language) || ''
  const langs = (typeof navigator !== 'undefined' && navigator.languages) || []
  return [primary, ...langs].filter(Boolean).some(l => l.toLowerCase().startsWith('pl')) ? 'pl' : 'en'
}
function detectLang() {
  try {
    const stored = localStorage.getItem(LANG_STORAGE_KEY)
    if (SUPPORTED.includes(stored)) return stored
  } catch { /* localStorage może być zablokowany */ }
  return systemLanguageOrPolish()
}

// Vite z `./locales/${lng}/index.js` robi glob po locales/*/index.js → jeden
// chunk na język, ładowany na żądanie.
async function loadBundle(lng) {
  const { default: res } = await import(`./locales/${lng}/index.js`)
  return res
}

// Dociągnij język, którego jeszcze nie ma w pamięci (zmiana języka w runtime,
// albo gdyby detector wybrał inaczej niż detectLang). Idempotentne.
export async function ensureLanguage(lng) {
  if (!SUPPORTED.includes(lng) || i18n.hasResourceBundle(lng, 'common')) return
  const res = await loadBundle(lng)
  for (const [ns, data] of Object.entries(res)) i18n.addResourceBundle(lng, ns, data, true, true)
}

// Bezpieczna zmiana języka: najpierw bundle, potem przełączenie (zero mignięcia kluczy).
export async function changeLanguage(lng) {
  await ensureLanguage(lng)
  return i18n.changeLanguage(lng)
}

const detector = new LanguageDetector()
detector.addDetector({ name: 'systemLanguageOrPolish', lookup: systemLanguageOrPolish })

const initialLng = detectLang()

// main.jsx czeka na `ready` przed pierwszym renderem (zamiast na sam import modułu).
export const ready = loadBundle(initialLng).then(res =>
  i18n
    .use(detector)
    .use(initReactI18next)
    .init({
      resources: { [initialLng]: res },
      fallbackLng: 'en',
      supportedLngs: SUPPORTED,
      defaultNS: 'common',
      ns: NAMESPACES,
      partialBundledLanguages: true,   // zasoby częściowe (jeden język) — nie próbuj nic doładowywać sam
      detection: {
        order: ['localStorage', 'systemLanguageOrPolish'],
        lookupLocalStorage: LANG_STORAGE_KEY,
        caches: ['localStorage'],
      },
      interpolation: { escapeValue: false },
      // Gdy bundle języka dojdzie PO przełączeniu (bezpośrednie i18n.changeLanguage
      // skądś indziej), react-i18next ma przerenderować — domyślnie nie słucha 'added'.
      react: { bindI18nStore: 'added' },
    })
    // Gdyby detector wybrał inny język niż detectLang (nie powinien — ta sama
    // reguła), dociągamy go, zamiast pokazywać surowe klucze.
    .then(() => (i18n.language !== initialLng ? ensureLanguage(i18n.language) : undefined))
)

// Siatka bezpieczeństwa dla bezpośrednich wywołań i18n.changeLanguage skądś indziej.
i18n.on('languageChanged', (lng) => { ensureLanguage(lng) })

export default i18n
