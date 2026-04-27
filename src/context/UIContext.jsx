import { createContext, useContext, useState, useMemo } from 'react'

const UIContext = createContext({})

export function UIProvider({ children }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  const value = useMemo(() => ({ settingsOpen, setSettingsOpen }), [settingsOpen])
  return (
    <UIContext.Provider value={value}>
      {children}
    </UIContext.Provider>
  )
}

export const useUI = () => useContext(UIContext)
