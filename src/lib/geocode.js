// Nominatim (OpenStreetMap) — surowe wywołania. Polityka użycia: 1 req/s, User-Agent.
// Warstwa miast (lib/city.js) buduje na tym kanonizację; ClubPage ma własne wrappery
// pod lokalizację meczu (etykieta ulica/dzielnica).

const UA = { 'User-Agent': 'HoopConnect/1.0' }

// Adres dla współrzędnych (obiekt `address` Nominatim) albo null.
export async function nominatimReverse(lat, lng, lang = 'pl') {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&addressdetails=1&accept-language=${lang}`,
      { headers: UA },
    )
    const d = await res.json()
    return d?.address || null
  } catch { return null }
}

// Pierwszy wynik wyszukiwania (z `address`) albo null.
export async function nominatimSearch(q, lang = 'pl') {
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1&addressdetails=1&accept-language=${lang}`,
      { headers: UA },
    )
    const d = await res.json()
    return Array.isArray(d) && d[0] ? d[0] : null
  } catch { return null }
}
