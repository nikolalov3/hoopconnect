import { createContext, useContext, useState, useMemo } from 'react'

const UIContext = createContext({})

export function UIProvider({ children }) {
  const [settingsOpen,          setSettingsOpen]          = useState(false)
  const [leaderboardOpen,       setLeaderboardOpen]       = useState(false)
  const [leagueOpen,            setLeagueOpen]            = useState(false)
  const [leaderboardFromLeague, setLeaderboardFromLeague] = useState(false)
  const [frameUnlockOpen,       setFrameUnlockOpen]       = useState(false)
  const [frameUnlockData,       setFrameUnlockData]       = useState(null)
  const [notificationsOpen,     setNotificationsOpen]     = useState(false)
  const [storyOpen,             setStoryOpen]             = useState(false)
  const [navHidden,             setNavHidden]             = useState(false)

  // Memoize so the value only changes when a UI flag actually changes — otherwise
  // every UIProvider re-render minted a fresh object and re-rendered all consumers
  // (the whole keep-alive Home/Club tree). Setters from useState are already stable.
  const value = useMemo(() => ({
    settingsOpen,    setSettingsOpen,
    leaderboardOpen, setLeaderboardOpen,
    leagueOpen,      setLeagueOpen,
    leaderboardFromLeague, setLeaderboardFromLeague,
    frameUnlockOpen, setFrameUnlockOpen,
    frameUnlockData, setFrameUnlockData,
    notificationsOpen, setNotificationsOpen,
    storyOpen, setStoryOpen,
    navHidden, setNavHidden,
  }), [settingsOpen, leaderboardOpen, leagueOpen, leaderboardFromLeague,
       frameUnlockOpen, frameUnlockData, notificationsOpen, storyOpen, navHidden])

  return <UIContext.Provider value={value}>{children}</UIContext.Provider>
}

export const useUI = () => useContext(UIContext)
