// Zgłasza adresy z wygenerowanej sitemapy do IndexNow (Bing / Yandex / Seznam).
// Uruchom PO deployu nowej wersji: `npm run indexnow` (wymaga wcześniejszego `npm run build`).
// IndexNow = natychmiastowe „przeskanuj to" — uzupełnia sitemapę, nie zastępuje jej.
import { readFileSync } from 'node:fs'

const KEY = '1c54f283f28edf46074c1e6922e550e3'
const HOST = 'hoopconnect.pl'
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`

const xml = readFileSync(new URL('../dist/sitemap-0.xml', import.meta.url), 'utf8')
const urlList = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1])

if (urlList.length === 0) {
  console.error('Brak URL-i w dist/sitemap-0.xml — najpierw `npm run build`.')
  process.exit(1)
}

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
})

console.log(`IndexNow: ${res.status} ${res.statusText} — zgłoszono ${urlList.length} URL:`)
for (const u of urlList) console.log('  ' + u)
if (res.status !== 200 && res.status !== 202) {
  console.error('Uwaga: IndexNow zwrócił nie-OK. Sprawdź, czy https://' + HOST + '/' + KEY + '.txt jest dostępny.')
}
