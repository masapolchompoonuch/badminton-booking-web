'use client'

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  defaultLocale,
  dictionaries,
  type Dictionary,
  type Locale,
} from '@/lib/i18n'

type LanguageContextValue = {
  locale: Locale
  setLocale: (locale: Locale) => void
  t: Dictionary
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function getCookieLocale() {
  if (typeof document === 'undefined') return null

  const cookieLocale = document.cookie
    .split('; ')
    .find((cookie) => cookie.startsWith('locale='))
    ?.split('=')[1]

  return cookieLocale === 'en' || cookieLocale === 'th'
    ? cookieLocale
    : null
}

function saveLocale(nextLocale: Locale) {
  window.localStorage.setItem('locale', nextLocale)
  document.cookie = `locale=${nextLocale}; path=/; max-age=31536000; samesite=lax`
}

export function LanguageProvider({
  children,
  initialLocale = defaultLocale,
}: {
  children: ReactNode
  initialLocale?: Locale
}) {
  const [locale, setLocaleState] = useState<Locale>(() => {
    if (typeof window === 'undefined') return initialLocale

    const savedLocale = window.localStorage.getItem('locale')

    if (savedLocale === 'en' || savedLocale === 'th') {
      return savedLocale
    }

    return getCookieLocale() || initialLocale
  })

  useEffect(() => {
    document.documentElement.lang = locale
    saveLocale(locale)
  }, [locale])

  useEffect(() => {
    function syncSavedLocale() {
      const savedLocale = window.localStorage.getItem('locale')

      if (savedLocale === 'en' || savedLocale === 'th') {
        setLocaleState(savedLocale)
        return
      }

      const cookieLocale = getCookieLocale()

      if (cookieLocale) {
        setLocaleState(cookieLocale)
      }
    }

    window.addEventListener('pageshow', syncSavedLocale)
    window.addEventListener('focus', syncSavedLocale)
    window.addEventListener('storage', syncSavedLocale)

    return () => {
      window.removeEventListener('pageshow', syncSavedLocale)
      window.removeEventListener('focus', syncSavedLocale)
      window.removeEventListener('storage', syncSavedLocale)
    }
  }, [])

  const setLocale = useCallback((nextLocale: Locale) => {
    setLocaleState(nextLocale)
    saveLocale(nextLocale)
  }, [])

  const value = useMemo(
    () => ({
      locale,
      setLocale,
      t: dictionaries[locale],
    }),
    [locale, setLocale]
  )

  return (
    <LanguageContext.Provider value={value}>
      {children}
    </LanguageContext.Provider>
  )
}

export function useI18n() {
  const context = useContext(LanguageContext)

  if (!context) {
    throw new Error('useI18n must be used inside LanguageProvider')
  }

  return context
}
