import { useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { cityFromCoords } from '../lib/city'

// Pierwsze uruchomienie BEZ miasta w profilu → ustal miasto z lokalizacji. Jedna próba na
// urządzenie (flaga w localStorage), więc nie nagabujemy przy każdym starcie; użytkownik
// może potem zmienić miasto w Ustawieniach. Jeśli lokalizacja jest już odmówiona — nie
// pytamy w ogóle. Zapis tylko, gdy miasto wciąż puste (nie nadpisze wpisu z Ustawień).
export function useAutoCity(profile, setProfileData) {
  useEffect(() => {
    const uid = profile?.id
    if (!uid || !profile.onboarding_done || profile.city) return
    const key = `hc_city_auto_${uid}`
    try { if (localStorage.getItem(key)) return } catch { return }
    if (typeof navigator === 'undefined' || !navigator.geolocation) return

    let cancelled = false
    const markTried = () => { try { localStorage.setItem(key, '1') } catch { /* localStorage zablokowany */ } }
    const run = () => navigator.geolocation.getCurrentPosition(async (pos) => {
      markTried()
      const city = await cityFromCoords(pos.coords.latitude, pos.coords.longitude)
      if (cancelled || !city) return
      const { data } = await supabase.from('profiles').update({ city }).eq('id', uid).is('city', null).select('id')
      if (data?.length) setProfileData?.({ city })
    }, markTried, { timeout: 10000, maximumAge: 300000 })

    if (navigator.permissions?.query) {
      navigator.permissions.query({ name: 'geolocation' })
        .then(p => { if (p.state === 'denied') markTried(); else run() }, run)
    } else run()
    return () => { cancelled = true }
  }, [profile?.id, profile?.onboarding_done, profile?.city, setProfileData])
}
