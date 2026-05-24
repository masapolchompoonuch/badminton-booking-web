'use client'

import { useRouter } from 'next/navigation'
import { LanguageToggle } from './language-toggle'
import { useI18n } from './language-provider'

type TopNavigationProps = {
  backHref?: string
  className?: string
}

export function TopNavigation({
  backHref = '/',
  className = '',
}: TopNavigationProps) {
  const router = useRouter()
  const { locale, t } = useI18n()

  function goBack() {
    window.localStorage.setItem('locale', locale)
    router.push(backHref)
  }

  return (
    <div className={`flex h-11 items-center justify-between gap-4 md:h-12 ${className}`}>
      <button
        type="button"
        onClick={goBack}
        className="inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-white/10 bg-neutral-900 px-4 text-sm font-bold text-white transition hover:border-emerald-400 hover:text-emerald-300 md:h-12 md:px-5 md:text-base"
      >
        <span className="text-xl leading-none" aria-hidden="true">
          ‹
        </span>
        {t.common.back}
      </button>

      <LanguageToggle />
    </div>
  )
}
