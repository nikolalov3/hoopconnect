// Jedno źródło prawdy dla adresów i meta. Apka i strefa trenera to osobne originy.
export const SITE = 'https://hoopconnect.pl'
export const APP_URL = 'https://app.hoopconnect.pl'
export const COACH_URL = 'https://trener.hoopconnect.pl'
// Landing sprzedażowy dla trenerów. Goły trener.* to prosty landing/login — kierujemy na /oferta.
export const COACH_OFFER_URL = `${COACH_URL}/oferta`

// Profile społecznościowe. Używane w stopce i w polu sameAs schema Organization (SEO / knowledge graph).
export const SOCIALS = {
  x: 'https://x.com/HoopConnectApp',
  facebook: 'https://www.facebook.com/profile.php?id=61564709893323&sk=grid',
}
export const RANK_URL = `${APP_URL}/rank`

// Newsletter (zapis przez Resend). Front jest gotowy, zaplecze jeszcze nie: dopóki nie ma endpointu,
// formularz i wysuwany panel są widoczne tylko lokalnie (astro dev). Na produkcji włącza je zmienna
// środowiskowa PUBLIC_NEWSLETTER=1 (Vercel → Environment Variables), ustawiana po podpięciu Resend.
// Kontrakt endpointu: POST JSON { email, consent: true, source: 'page' | 'popup', hp: '' }
//   → 200 { ok: true } albo 4xx/5xx { ok: false, error: 'invalid' | 'exists' | 'server' }.
// Pole hp to pułapka na boty: prawdziwy formularz wysyła je puste.
export const NEWSLETTER = {
  enabled: import.meta.env.PUBLIC_NEWSLETTER === '1' || import.meta.env.DEV,
  endpoint: '/api/newsletter',
  privacyUrl: '/privacy',
}

export const BRAND = {
  name: 'HoopConnect',
  tagline: 'Phone down, game up',
  defaultTitle: 'HoopConnect · aplikacja do koszykówki ulicznej i treningu',
  defaultDescription:
    'HoopConnect porządkuje koszykówkę uliczną (streetbasket): znajdź grę i graczy w okolicy, ' +
    'rozegraj King of the Court bez chaosu, zbieraj XP i wbijaj się w rankingi. ' +
    'Aplikacja pomaga przed grą i po niej. Resztę robisz na boisku.',
}

// Schema aplikacji (JSON-LD) — apka gracza jest darmowa. Wpinane na home i FAQ.
// Bogate pola (featureList, publisher, screenshot) poprawiają cytowalność przez asystentów AI.
export const APP_SCHEMA = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'HoopConnect',
  alternateName: ['HoopConnect streetbasket', 'HoopConnect 3x3'],
  applicationCategory: 'SportsApplication',
  applicationSubCategory: 'Basketball',
  operatingSystem: 'Web',
  url: APP_URL,
  inLanguage: 'pl-PL',
  description:
    'Aplikacja do koszykówki ulicznej (streetbasket): znajdź grę i graczy w okolicy, umawiaj mecze 2v2, 3v3 i 5v5, graj King of the Court, ' +
    'trenuj indywidualnie według planu dopasowanego do liczby dni w tygodniu, zbieraj XP i wbijaj się w rankingi.',
  featureList: [
    'Mecze 2v2, 3v3 i 5v5 oraz gracze na boiskach w okolicy',
    'King of the Court z automatycznym losowaniem trzyosobowych drużyn',
    'Indywidualny asystent treningu z codziennymi ćwiczeniami dopasowanymi do gracza',
    'Ćwiczenia regeneracyjne na dni odpoczynku',
    'System XP, areny i publiczne rankingi z filtrem po mieście',
    'Panel dla trenerów i klubów: frekwencja na treningach i rozliczanie składek',
  ],
  screenshot: new URL('/brand/rank.webp', SITE).href,
  image: new URL('/brand/horizontal.png', SITE).href,
  publisher: { '@type': 'Organization', name: 'HoopConnect', url: SITE },
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
