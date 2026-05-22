'use client'

import { useI18n } from './language-provider'

export function LanguageToggle() {
  const { locale, setLocale, t } = useI18n()

  return (
    <div
      aria-label={t.common.language}
      className="inline-flex rounded-xl border border-white/10 bg-neutral-950/80 p-1 text-xs font-bold text-white"
    >
      <button
        type="button"
        onClick={() => setLocale('en')}
        className={`h-8 rounded-lg px-3 transition ${
          locale === 'en'
            ? 'bg-white text-black'
            : 'text-neutral-400 hover:text-white'
        }`}
      >
        {t.common.english}
      </button>

      <button
        type="button"
        onClick={() => setLocale('th')}
        className={`h-8 rounded-lg px-3 transition ${
          locale === 'th'
            ? 'bg-white text-black'
            : 'text-neutral-400 hover:text-white'
        }`}
      >
        {t.common.thai}
      </button>
    </div>
  )
}
