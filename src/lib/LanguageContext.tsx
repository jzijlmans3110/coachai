import { createContext, useContext, useState } from 'react'
import type { ReactNode } from 'react'
import { translations } from './translations'
import type { Language } from './translations'

interface LanguageContextValue {
  lang: Language
  setLang: (l: Language) => void
  t: (key: string, vars?: Record<string, string | number>) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Language>(() => {
    const stored = localStorage.getItem('coach_lang')
    return (stored === 'nl' || stored === 'de') ? stored : 'nl'
  })

  const setLang = (l: Language) => {
    localStorage.setItem('coach_lang', l)
    setLangState(l)
  }

  const t = (key: string, vars?: Record<string, string | number>): string => {
    let str = translations[lang][key] ?? translations['nl'][key] ?? key
    if (vars) {
      Object.entries(vars).forEach(([k, v]) => {
        str = str.replaceAll(`{${k}}`, String(v))
      })
    }
    return str
  }

  return (
    <LanguageContext.Provider value={{ lang, setLang, t }}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useLanguage() {
  const ctx = useContext(LanguageContext)
  if (!ctx) throw new Error('useLanguage must be used inside LanguageProvider')
  return ctx
}
