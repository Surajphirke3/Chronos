'use client'

import { SessionProvider } from 'next-auth/react'
import { Toaster } from 'sonner'
import { createContext, useContext, useEffect, useState } from 'react'

/* ─── Theme Context ──────────────────────────────────────── */
type Theme = 'light' | 'dark'

const ThemeContext = createContext<{
  theme: Theme
  setTheme: (t: Theme) => void
  toggleTheme: () => void
}>({ theme: 'light', setTheme: () => {}, toggleTheme: () => {} })

export function useTheme() {
  return useContext(ThemeContext)
}

function ThemeProvider({ children }: { children: React.ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'light'
    const stored = localStorage.getItem('theme') as Theme | null
    return stored === 'dark' || stored === 'light' ? stored : 'light'
  })

  const applyTheme = (t: Theme) => {
    setTheme(t)
    if (typeof window === 'undefined') return
    localStorage.setItem('theme', t)
    localStorage.setItem('landing-theme', t)
    document.documentElement.setAttribute('data-theme', t)
    if (t === 'dark') {
      document.documentElement.classList.add('dark')
    } else {
      document.documentElement.classList.remove('dark')
    }
  }

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    if (theme === 'dark') document.documentElement.classList.add('dark')
    else document.documentElement.classList.remove('dark')
  }, [theme])

  const handleSetTheme = (t: Theme) => {
    applyTheme(t)
  }

  const toggleTheme = () => {
    applyTheme(theme === 'dark' ? 'light' : 'dark')
  }

  return (
    <ThemeContext.Provider value={{ theme, setTheme: handleSetTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  )
}

/* ─── Root Providers ─────────────────────────────────────── */
export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider>
      <ThemeProvider>
        {children}
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: 'var(--bg-elevated)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-primary)',
              boxShadow: 'var(--shadow-md)',
              borderRadius: '10px',
              fontSize: '13.5px',
            },
          }}
        />
      </ThemeProvider>
    </SessionProvider>
  )
}
