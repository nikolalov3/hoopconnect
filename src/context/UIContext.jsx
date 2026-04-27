import { createContext, useContext, useState } from 'react'

const UIContext = createContext({})

export function UIProvider({ children }) {
  const [settingsOpen, setSettingsOpen] = useState(false)
  return (
    <UIContext.Provider value={{ settingsOpen, setSettingsOpen }}>
      {children}
    </UIContext.Provider>
  )
}

export const useUI = () => useContext(UIContext)
