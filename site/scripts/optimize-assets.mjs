// Pochodne grafik do sieci. ORYGINAŁY ZOSTAJĄ NIETKNIĘTE (public/arenas/*.png, public/earlyaccess.png):
// skrypt tylko zapisuje pomniejszone kopie WebP obok nich.
//   arenas/thumb/arena-N.webp  128 px   ikonki areny na karcie gracza (na karcie mają 32 px)
//   arenas/web/arena-N.webp    360 px   karuzela aren na stronie głównej
//   frames/earlyaccess.webp    384 px   ramka hexa (karta gracza, karta meczu)
//   brand/xp-96.webp            96 px   ikonka XP w tabelach
// Uruchom po podmianie oryginału: `npm run assets` (albo `npm run assets -- --force`).
// Leci też przed buildem (prebuild) i nigdy nie wywala builda: przy błędzie zostają pliki z repo.
import { mkdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const pub = fileURLToPath(new URL('../public/', import.meta.url))
const force = process.argv.includes('--force')

const jobs = []
for (let n = 1; n <= 6; n++) {
  jobs.push({ src: `arenas/arena-${n}.png`, out: `arenas/thumb/arena-${n}.webp`, size: 128, quality: 86 })
  jobs.push({ src: `arenas/arena-${n}.png`, out: `arenas/web/arena-${n}.webp`, size: 360, quality: 88 })
}
jobs.push({ src: 'earlyaccess.png', out: 'frames/earlyaccess.webp', size: 384, quality: 88 })
jobs.push({ src: 'brand/xp.png', out: 'brand/xp-96.webp', size: 96, quality: 90 })

const mtime = async (p) => { try { return (await stat(p)).mtimeMs } catch { return 0 } }

try {
  const { default: sharp } = await import('sharp')
  let made = 0
  for (const j of jobs) {
    const src = path.join(pub, j.src), out = path.join(pub, j.out)
    const [ms, mo] = await Promise.all([mtime(src), mtime(out)])
    if (!ms) { console.warn(`[assets] brak źródła: ${j.src}`); continue }
    if (!force && mo >= ms) continue
    await mkdir(path.dirname(out), { recursive: true })
    await sharp(src)
      .resize(j.size, j.size, { fit: 'inside', withoutEnlargement: true })
      .webp({ quality: j.quality, alphaQuality: 92, effort: 6 })
      .toFile(out)
    made++
    console.log(`[assets] ${j.out}`)
  }
  console.log(made ? `[assets] zapisano ${made} plik(ów)` : '[assets] wszystko aktualne')
} catch (err) {
  console.warn('[assets] pominięto (zostają pliki z repo):', err?.message ?? err)
}
