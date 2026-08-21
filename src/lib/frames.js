// ── Katalog ramek — jedno źródło prawdy (ścieżka/rzadkość/i18n key) ──────────
// Dodanie tu nowej ramki automatycznie działa w:
//  - HexAvatar.jsx (renderowanie — FRAME_PATHS budowane z tego katalogu)
//  - SettingsPanel.jsx (FramePicker — lista + "unlocked" check, generyczne)
//  - App.jsx (dane dla FrameUnlockPanel: path/rarity/label/sublabel/description)
//
// Czego katalog NIE robi automatycznie: kiedy ramka ma się odblokować.
// To zawsze inna reguła biznesowa per ramka (np. "od razu", "próg punktowy
// od daty X") — taki trigger dopisuje się w App.jsx jak dotychczas.
// WYJĄTEK: `autoGrantSilent: true` — dla ramek przyznawanych ręcznie w bazie
// (bez ekranu "nowa ramka odblokowana"). Te odblokowują się w pickerze
// automatycznie, samym dodaniem do katalogu — zero kodu w App.jsx.
export const FRAME_CATALOG = [
  { id: 'early_access', path: '/earlyaccess.png', rarity: 'rare',      i18nKey: 'earlyAccess' },
  { id: 'diamond_s1',   path: '/ramkas1diax.png', rarity: 'legendary', i18nKey: 'diamondS1' },
  { id: 'ff',           path: '/ff.png',          rarity: 'legendary', i18nKey: 'ff', autoGrantSilent: true },
]

// Klucz localStorage używany zarówno przez FrameUnlockPanel (early_access/
// diamond_s1, ustawiany na onClose) jak i przez auto-grant (ff i przyszłe
// autoGrantSilent) — jeden wzorzec klucza dla całej apki.
export function frameSeenKey(id, uid) {
  return `hc_frame_seen_${id}_${uid}`
}
