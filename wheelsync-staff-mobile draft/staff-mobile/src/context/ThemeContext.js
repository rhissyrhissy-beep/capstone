import { createContext, useContext, useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { useColorScheme } from 'react-native'
import { darkTheme, lightTheme } from '../theme'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'wheelsync-theme-mode'

export function ThemeProvider({ children }) {
  const systemScheme = useColorScheme()
  const [mode, setMode] = useState(systemScheme === 'light' ? 'light' : 'dark')
  const [ready, setReady] = useState(false)

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved === 'light' || saved === 'dark') setMode(saved)
      setReady(true)
    })
  }, [])

  function toggleTheme() {
    setMode((m) => {
      const next = m === 'dark' ? 'light' : 'dark'
      AsyncStorage.setItem(STORAGE_KEY, next)
      return next
    })
  }

  const colors = mode === 'dark' ? darkTheme : lightTheme

  if (!ready) return null

  return (
    <ThemeContext.Provider value={{ mode, colors, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useAppTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useAppTheme must be used within ThemeProvider')
  return ctx
}
