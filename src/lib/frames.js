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
//
// Własność (unlock) jest trwała w bazie: `itemId` mapuje ramkę na wiersz w
// public.card_items, a public.user_unlocks trzyma, kto ją posiada (migracja
// 20260822_frame_ownership.sql). `free: true` = card_items.is_default = każdy
// zarejestrowany user ją ma (early_access) — bez wiersza w user_unlocks.
export const FRAME_CATALOG = [
  { id: 'early_access', path: '/earlyaccess.png', rarity: 'rare',      i18nKey: 'earlyAccess', itemId: 'frame_early_access', free: true },
  { id: 'diamond_s1',   path: '/ramkas1diax.png', rarity: 'legendary', i18nKey: 'diamondS1',   itemId: 'frame_diamond_s1' },
  { id: 'ff',           path: '/ff.png',          rarity: 'legendary', i18nKey: 'ff', autoGrantSilent: true, itemId: 'frame_ff' },
]

// itemId → catalog id (odwrotne mapowanie, np. przy czytaniu user_unlocks).
export const ITEM_TO_FRAME = Object.fromEntries(
  FRAME_CATALOG.filter(f => f.itemId).map(f => [f.itemId, f.id])
)

// Klucz localStorage używany zarówno przez FrameUnlockPanel (early_access/
// diamond_s1, ustawiany na onClose) jak i przez auto-grant (ff i przyszłe
// autoGrantSilent) — jeden wzorzec klucza dla całej apki.
export function frameSeenKey(id, uid) {
  return `hc_frame_seen_${id}_${uid}`
}
