// ── Nazwy graczy / klubów — moderacja (prewencyjna połowa Apple 1.2 UGC) ────────
// Normalizujemy nazwę tak, by rozbroić typowe omijacze (leetspeak, spacje,
// diakrytyki, homoglyfy cyrylicy), a potem odrzucamy, jeśli zawiera zablokowany
// termin. Lista celowo wąska (jednoznaczne wyzwiska + mocne wulgaryzmy), żeby
// ograniczyć fałszywe trafienia — odrzucona nazwa tylko prosi o wybór innej.

const LEET = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '9': 'g', '@': 'a', '$': 's', '!': 'i', '|': 'l', '(': 'c', '€': 'e' }

// Wybrane homoglyfy (cyrylica/greka → łacina) — najczęstsze podmianki.
const HOMOGLYPH = { 'а': 'a', 'е': 'e', 'о': 'o', 'р': 'p', 'с': 'c', 'у': 'y', 'х': 'x', 'к': 'k', 'м': 'm', 'т': 't', 'н': 'h', 'в': 'b', 'і': 'i', 'ѕ': 's', 'ј': 'j', 'ԁ': 'd', 'ɡ': 'g', 'ο': 'o', 'ε': 'e', 'α': 'a', 'ρ': 'p', 'ν': 'v' }

// Litery, które NFKD nie rozkłada — mapujemy ręcznie.
const EXTRA = { 'ł': 'l', 'ø': 'o', 'đ': 'd', 'ß': 'ss', 'æ': 'ae', 'œ': 'oe', 'þ': 'th' }

// Zblokowane rdzenie (sprawdzane po normalizacji, bez i po zwinięciu powtórzeń).
const BLOCKED = [
  // wyzwiska rasowe / etniczne / homofobiczne / transfobiczne
  'nigger', 'nigga', 'faggot', 'kike', 'chink', 'tranny', 'wetback', 'gook',
  // nienawiść / nazizm
  'hitler', 'heilhitler', 'siegheil', 'nazi', 'whitepower', 'kkk', '1488', '88hh',
  // mocne EN
  'cunt', 'fuck', 'motherfuck', 'rape', 'rapist', 'pedo', 'pedophile', 'incest', 'bitch', 'whore',
  // PL wulgaryzmy / obelgi
  'kurwa', 'chuj', 'pizda', 'jebac', 'jebany', 'wyjeb', 'pierdol', 'spierdalaj', 'skurwysyn',
  'cwel', 'pedal', 'ciota', 'kutas', 'dziwka', 'szmata', 'zjeb', 'debil', 'jebana',
  // PL wyzwiska rasowe
  'ciapaty',
]

// Kody liczbowe — leetspeak zamienia cyfry na litery, więc sprawdzamy je osobno
// na formie zachowującej cyfry.
const NUMERIC_BLOCKED = ['1488']

function normalize(raw) {
  let s = (raw || '').toLowerCase()
  s = s.replace(/./gu, ch => HOMOGLYPH[ch] || EXTRA[ch] || ch)     // homoglyfy + litery bez rozkładu NFKD
  s = s.normalize('NFKD').replace(/[̀-ͯ]/g, '')          // strip diakrytyki
  s = s.replace(/./gu, ch => LEET[ch] || ch)                       // leetspeak
  s = s.replace(/[^a-z0-9]/g, '')                                  // zostaw tylko a-z0-9
  return s
}

/**
 * Waliduje nazwę gracza/klubu.
 * @returns {{ ok: boolean, reason?: 'tooShort'|'tooLong'|'charset'|'blocked' }}
 */
export function validateName(raw, { min = 2, max = 24 } = {}) {
  const name = (raw || '').trim()
  if (name.length < min) return { ok: false, reason: 'tooShort' }
  if (name.length > max) return { ok: false, reason: 'tooLong' }
  // dozwolone znaki widoczne: litery (dowolny alfabet), cyfry, spacja i . _ - '
  if (!/^[\p{L}\p{N} ._'-]+$/u.test(name)) return { ok: false, reason: 'charset' }

  const norm = normalize(name)
  // zwiń tylko powtórzenia 3+ tej samej litery ("niiigger" → "nigger"), bez ruszania
  // podwojeń ("gg"), żeby nie robić fałszywych trafień (np. "Nigeria").
  const deRep = norm.replace(/(.)\1{2,}/g, '$1')
  for (const term of BLOCKED) {
    if (norm.includes(term) || deRep.includes(term)) return { ok: false, reason: 'blocked' }
  }
  const digits = name.toLowerCase().replace(/[^a-z0-9]/g, '')
  for (const code of NUMERIC_BLOCKED) {
    if (digits.includes(code)) return { ok: false, reason: 'blocked' }
  }
  return { ok: true }
}

// Podgląd znormalizowanej formy — przydatne w testach/debugowaniu.
export const _normalize = normalize
