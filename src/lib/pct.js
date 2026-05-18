// Procent skuteczności — tylko 100% gdy DOKŁADNIE 100% (49/50 = 98, nie 100).
// Math.round zaokrąglał 99.5% do 100, co dawało false-positive perfect session.
export function pct(made, attempted) {
  if (!attempted) return 0
  if (made >= attempted) return 100
  return Math.floor((made / attempted) * 100)
}
