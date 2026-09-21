// Jedno źródło prawdy dla adresów i meta. Apka i strefa trenera to osobne originy.
export const SITE = 'https://hoopconnect.pl'
export const APP_URL = 'https://app.hoopconnect.pl'
export const COACH_URL = 'https://trener.hoopconnect.pl'
// Landing sprzedażowy dla trenerów. Goły trener.* to prosty landing/login — kierujemy na /oferta.
export const COACH_OFFER_URL = `${COACH_URL}/oferta`
export const RANK_URL = `${APP_URL}/rank`

export const BRAND = {
  name: 'HoopConnect',
  tagline: 'Phone down, game up',
  defaultTitle: 'HoopConnect · mniej klikania, więcej grania',
  defaultDescription:
    'HoopConnect porządkuje koszykówkę uliczną 3x3: znajdź grę i graczy w okolicy, ' +
    'rozegraj King of the Court bez chaosu, zbieraj XP i wbijaj się w rankingi. ' +
    'Aplikacja pomaga przed grą i po niej. Resztę robisz na boisku.',
}

// Schema aplikacji (JSON-LD) — apka gracza jest darmowa. Wpinane na home i FAQ.
export const APP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'HoopConnect',
  applicationCategory: 'SportsApplication',
  operatingSystem: 'Web',
  url: APP_URL,
  inLanguage: 'pl-PL',
  description:
    'Aplikacja do koszykówki ulicznej 3x3: znajdź grę i graczy w okolicy, graj King of the Court, ' +
    'trenuj indywidualnie, zbieraj XP i wbijaj się w rankingi.',
  offers: { '@type': 'Offer', price: '0', priceCurrency: 'PLN' },
}

// Główna nawigacja. `soon` = sekcja w planach (jeszcze nie budujemy), pokazujemy jako „wkrótce".
export const NAV: { label: string; href: string; soon?: boolean; external?: boolean }[] = [
  { label: 'Asystent treningu', href: '/asystent-treningu' },
  { label: 'Klub', href: '/klub' },
  { label: 'Ranking', href: '/ranking' },
  { label: 'FAQ', href: '/faq' },
  { label: 'Dla trenerów', href: COACH_OFFER_URL, external: true },
]
