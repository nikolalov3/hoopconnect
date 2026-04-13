import { useState, useEffect } from 'react'

const STORAGE_KEY = 'hoop_shooting_session'

export function useShootingSession(trainingId) {
  const [history, setHistory] = useState([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!trainingId) return
    try {
      const saved = localStorage.getItem(STORAGE_KEY)
      if (saved) {
        const parsed = JSON.parse(saved)
        if (parsed.trainingId === trainingId) {
          setHistory(parsed.history || [])
        }
      }
    } catch {}
    setLoaded(true)
  }, [trainingId])

  useEffect(() => {
    if (!loaded || !trainingId) return
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ trainingId, history }))
  }, [history, trainingId, loaded])

  function addShot(made) {
    setHistory(h => [...h, made])
  }

  function undoShot() {
    setHistory(h => h.slice(0, -1))
  }

  function clearSession() {
    setHistory([])
    localStorage.removeItem(STORAGE_KEY)
  }

  return { history, addShot, undoShot, clearSession, loaded }
}
