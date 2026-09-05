import { nominatimReverse, nominatimSearch } from './geocode.js'

// ── Kanoniczna nazwa miasta ─────────────────────────────────────────────────
// Jedno pisanie w bazie ("Kraków", nie "KRK"/"krakow"/"Cracow") = działające filtry i
// rankingi po mieście. Ten słownik jest ŹRÓDŁEM PRAWDY także dla bazy: migracja
// 20260905_city_normalize.sql generuje z niego tabelę city_aliases (trigger na
// profiles.city), więc klient i serwer kanonizują identycznie.
//
// Klucz dopasowania = normalizeCityKey (małe litery, bez polskich znaków, bez kropek/
// myślników, pojedyncze spacje). Do listy aliasów dochodzi automatycznie klucz samej
// nazwy kanonicznej ("krakow" → "Kraków").

export const CITY_CANON = {
  'Kraków':               ['krk', 'cracow', 'krakau', 'krakuf'],
  'Warszawa':             ['waw', 'wwa', 'wawa', 'warsaw', 'warschau'],
  'Wrocław':              ['wro', 'wrc', 'breslau'],
  'Poznań':               ['poz', 'posen'],
  'Gdańsk':               ['gda', 'gdn', 'danzig'],
  'Gdynia':               ['gdy'],
  'Sopot':                ['sop'],
  'Szczecin':             ['szz', 'szn', 'stettin'],
  'Łódź':                 ['ldz', 'lodsch'],
  'Katowice':             ['kat', 'ktw', 'kato', 'kattowitz'],
  'Lublin':               ['lub', 'lbl'],
  'Białystok':            ['bia'],
  'Rzeszów':              ['rze'],
  'Toruń':                ['tor', 'thorn'],
  'Bydgoszcz':            ['bdg', 'bydg'],
  'Kielce':               ['kie', 'klc'],
  'Olsztyn':              ['ols', 'allenstein'],
  'Opole':                ['opo', 'oppeln'],
  'Częstochowa':          ['cze', 'czest'],
  'Radom':                ['rad', 'rdm'],
  'Gliwice':              ['gli', 'glw'],
  'Zabrze':               ['zab'],
  'Bielsko-Biała':        ['bie', 'bielsko', 'bb'],
  'Gorzów Wielkopolski':  ['gor', 'gorzow', 'gorzow wlkp'],
  'Zielona Góra':         ['zie', 'zg'],
  'Elbląg':               ['elb'],
  'Płock':                ['plo'],
  'Tarnów':               ['tar'],
  'Nowy Sącz':            ['nsacz', 'ns'],
  'Rybnik':               ['ryb'],
  'Tychy':                ['tyc'],
  'Dąbrowa Górnicza':     ['dg', 'dabrowa'],
  'Sosnowiec':            ['sos', 'sosno'],
  'Koszalin':             ['kos'],
  'Kalisz':               ['kal'],
  'Legnica':              ['leg'],
  'Grudziądz':            ['gru'],
  'Słupsk':               ['slu'],
  'Jaworzno':             ['jaw'],
  'Jastrzębie-Zdrój':     ['jastrzebie', 'jz'],
  'Wałbrzych':            ['wal'],
  'Chorzów':              ['cho'],
  'Siedlce':              ['sie'],
  'Mysłowice':            [],
  'Piła':                 [],
  'Ostrów Wielkopolski':  ['ostrow wlkp', 'ostrow'],
  'Lubin':                [],
  'Konin':                [],
  'Inowrocław':           ['ino'],
  'Suwałki':              [],
  'Stargard':             [],
  'Gniezno':              [],
  'Siemianowice Śląskie': ['siemianowice'],
  'Głogów':               [],
  'Pabianice':            [],
  'Leszno':               [],
  'Żory':                 [],
  'Zamość':               [],
  'Pruszków':             [],
  'Łomża':                [],
  'Ełk':                  [],
  'Tarnowskie Góry':      ['tg'],
  'Mielec':               [],
  'Tomaszów Mazowiecki':  ['tomaszow maz', 'tomaszow'],
  'Stalowa Wola':         [],
  'Kędzierzyn-Koźle':     ['kedzierzyn'],
  'Przemyśl':             [],
  'Świdnica':             [],
  'Będzin':               [],
  'Zgierz':               [],
  'Piotrków Trybunalski': ['piotrkow', 'piotrkow tryb'],
  'Ostrołęka':            [],
  'Skierniewice':         [],
  'Starachowice':         [],
  'Wejherowo':            [],
  'Puławy':               [],
  'Tczew':                [],
  'Świnoujście':          [],
  'Nysa':                 [],
  'Zakopane':             ['zako'],
  'Wieliczka':            [],
  'Skawina':              [],
}

const PL = { 'ą': 'a', 'ć': 'c', 'ę': 'e', 'ł': 'l', 'ń': 'n', 'ó': 'o', 'ś': 's', 'ź': 'z', 'ż': 'z' }

// Klucz porównania — TA SAMA reguła co public.normalize_city_key w bazie.
export function normalizeCityKey(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, ch => PL[ch])
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[._/-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

// alias-klucz → nazwa kanoniczna (zbudowane raz)
const ALIAS_INDEX = (() => {
  const m = new Map()
  for (const [canon, aliases] of Object.entries(CITY_CANON)) {
    m.set(normalizeCityKey(canon), canon)
    for (const a of aliases) m.set(normalizeCityKey(a), canon)
  }
  return m
})()

// Synchronicznie: znana nazwa/skrót → kanoniczna; inaczej null.
export function canonicalCity(raw) {
  const key = normalizeCityKey(raw)
  return key ? (ALIAS_INDEX.get(key) || null) : null
}

// Wpis użytkownika → miasto do zapisania. Pusty → null. Słownik → kanoniczne (bez sieci).
// Nieznane (≥4 znaki) → Nominatim (city/town/village z adresu) → w ostateczności Title Case.
// Bardzo krótkie nieznane (np. "xy") zostają jak wpisane, żeby było widać, że nierozpoznane.
export async function resolveCity(raw, lang = 'pl') {
  const trimmed = String(raw || '').trim()
  if (!trimmed) return null
  const known = canonicalCity(trimmed)
  if (known) return known
  if (trimmed.length >= 4) {
    const hit = await nominatimSearch(trimmed, lang)
    const fromAddr = cityFromAddress(hit?.address)
    if (fromAddr) return fromAddr
  }
  return titleCase(trimmed)
}

// Współrzędne → kanoniczne miasto albo null (pierwsze uruchomienie, przycisk w Ustawieniach).
export async function cityFromCoords(lat, lng, lang = 'pl') {
  const addr = await nominatimReverse(lat, lng, lang)
  return cityFromAddress(addr)
}

function cityFromAddress(addr) {
  if (!addr) return null
  const name = addr.city || addr.town || addr.village || addr.municipality || null
  if (!name) return null
  return canonicalCity(name) || titleCase(name)
}

export function titleCase(s) {
  return String(s).trim().toLowerCase().replace(/(^|[\s-])(\p{L})/gu, (m, sep, ch) => sep + ch.toUpperCase())
}
