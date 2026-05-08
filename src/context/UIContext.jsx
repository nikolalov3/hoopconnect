import { createContext, useContext, useState } from 'react'

const UIContext = createContext({})

export function UIProvider({ children }) {
  const [settingsOpen,         setSettingsOpen]         = useState(false)
  const [leaderboardOpen,      setLeaderboardOpen]      = useState(false)
  const [leagueOpen,           setLeagueOpen]           = useState(false)
  const [leaderboardFromLeague,setLeaderboardFromLeague]= useState(false)
  return (
    <UIContext.Provider value={{
      settingsOpen,    setSettingsOpen,
      leaderboardOpen, setLeaderboardOpen,
      leagueOpen,      setLeagueOpen,
      leaderboardFromLeague, setLeaderboardFromLeague,
    }}>
      {children}
    </UIContext.Provider>
  )
}

export const useUI = () => useContext(UIContext)
