// ── Kraje świata ──────────────────────────────────────────────────────────────
// Pełna lista kodów ISO 3166-1 alpha-2. Flaga emoji jest LICZONA z kodu
// (regional indicator symbols), a nazwa lokalizowana przez wbudowane
// Intl.DisplayNames — dzięki temu nie trzymamy ręcznie nazw w 2 językach.
// Wartość zapisywana w profiles.country pozostaje kodem ISO (jak dotąd).

export const COUNTRY_CODES = [
  'AD','AE','AF','AG','AI','AL','AM','AO','AR','AT','AU','AW','AX','AZ',
  'BA','BB','BD','BE','BF','BG','BH','BI','BJ','BL','BM','BN','BO','BQ','BR','BS','BT','BW','BY','BZ',
  'CA','CD','CF','CG','CH','CI','CK','CL','CM','CN','CO','CR','CU','CV','CW','CY','CZ',
  'DE','DJ','DK','DM','DO','DZ',
  'EC','EE','EG','EH','ER','ES','ET',
  'FI','FJ','FK','FM','FO','FR',
  'GA','GB','GD','GE','GF','GG','GH','GI','GL','GM','GN','GP','GQ','GR','GT','GU','GW','GY',
  'HK','HN','HR','HT','HU',
  'ID','IE','IL','IM','IN','IO','IQ','IR','IS','IT',
  'JE','JM','JO','JP',
  'KE','KG','KH','KI','KM','KN','KP','KR','KW','KY','KZ',
  'LA','LB','LC','LI','LK','LR','LS','LT','LU','LV','LY',
  'MA','MC','MD','ME','MF','MG','MH','MK','ML','MM','MN','MO','MP','MQ','MR','MS','MT','MU','MV','MW','MX','MY','MZ',
  'NA','NC','NE','NF','NG','NI','NL','NO','NP','NR','NU','NZ',
  'OM',
  'PA','PE','PF','PG','PH','PK','PL','PM','PN','PR','PS','PT','PW','PY',
  'QA',
  'RE','RO','RS','RU','RW',
  'SA','SB','SC','SD','SE','SG','SH','SI','SK','SL','SM','SN','SO','SR','SS','ST','SV','SX','SY','SZ',
  'TC','TD','TG','TH','TJ','TK','TL','TM','TN','TO','TR','TT','TV','TW','TZ',
  'UA','UG','US','UY','UZ',
  'VA','VC','VE','VG','VI','VN','VU',
  'WF','WS',
  'XK', // Kosowo (kod nieoficjalny, ale powszechnie używany)
  'YE','YT',
  'ZA','ZM','ZW',
]

// Kod ISO → flaga emoji (np. 'PL' → 🇵🇱). Na Windows bez glifów flag pokaże
// litery regionalne — wciąż czytelne.
export function flagEmoji(code) {
  if (!code || code.length !== 2) return ''
  const A = 0x1F1E6 - 'A'.charCodeAt(0)
  return String.fromCodePoint(
    ...code.toUpperCase().split('').map(c => A + c.charCodeAt(0))
  )
}

// Zlokalizowana, posortowana lista { code, name, flag }.
// `pinned` trafiają na górę (w podanej kolejności), reszta alfabetycznie.
// Między przypiętymi a resztą wstawiany jest separator ({ separator: true }).
export function getCountryOptions(locale, opts = {}) {
  const pinned = opts.pinned || ['PL', 'US', 'LT', 'RS', 'ES', 'GR', 'DE', 'FR', 'GB', 'IT']
  const withSeparator = opts.separator !== false
  const lang = locale || 'en'

  let dn = null
  try { dn = new Intl.DisplayNames([lang], { type: 'region' }) } catch { dn = null }
  const nameOf = (code) => {
    if (!dn) return code
    try { return dn.of(code) || code } catch { return code }
  }

  const all = COUNTRY_CODES.map(code => ({ code, name: nameOf(code), flag: flagEmoji(code) }))

  let coll
  try { coll = new Intl.Collator(lang) } catch { coll = null }
  all.sort((a, b) => coll ? coll.compare(a.name, b.name) : a.name.localeCompare(b.name))

  const pinnedList = []
  for (const code of pinned) {
    const idx = all.findIndex(c => c.code === code)
    if (idx >= 0) pinnedList.push(all.splice(idx, 1)[0])
  }

  if (pinnedList.length && withSeparator && all.length) {
    return [...pinnedList, { code: '__sep__', separator: true, name: '──────────', flag: '' }, ...all]
  }
  return [...pinnedList, ...all]
}
