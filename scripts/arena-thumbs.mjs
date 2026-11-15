// Miniatury aren do list (ranking /rank): public/arenas/thumb/arena-N.webp, 96 px.
// ORYGINAŁY ZOSTAJĄ NIETKNIĘTE (public/arenas/arena-N.png); skrypt zapisuje tylko pomniejszone kopie.
// Pełny PNG areny waży 170-270 kB, a w wierszu rankingu ma 28 px, więc lista ładuje kopie po kilka kB.
// Uruchom po podmianie oryginału:  npm run arena-thumbs  (albo z --force).
import { mkdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const dir = fileURLToPath(new URL('../public/arenas/', import.meta.url))
const force = process.argv.includes('--force')
const mtime = async (p) => { try { return (await stat(p)).mtimeMs } catch { return 0 } }

await mkdir(path.join(dir, 'thumb'), { recursive: true })
let made = 0
for (let n = 1; n <= 12; n++) {
  const src = path.join(dir, `arena-${n}.png`), out = path.join(dir, 'thumb', `arena-${n}.webp`)
  const [ms, mo] = await Promise.all([mtime(src), mtime(out)])
  if (!ms) continue                      // nie ma takiej areny
  if (!force && mo >= ms) continue       // kopia aktualna
  await sharp(src).resize(96, 96, { fit: 'inside', withoutEnlargement: true }).webp({ quality: 86, alphaQuality: 92, effort: 6 }).toFile(out)
  made++
  console.log(`[arena-thumbs] thumb/arena-${n}.webp`)
}
console.log(made ? `[arena-thumbs] zapisano ${made} plik(ów)` : '[arena-thumbs] wszystko aktualne')
