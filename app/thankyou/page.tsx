'use client'

import { LanguageToggle } from '../language-toggle'
import { useI18n } from '../language-provider'

export default function ThankYouPage() {
  const { t } = useI18n()

  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-neutral-900 p-8 text-center">
        <div className="mb-6 flex justify-end">
          <LanguageToggle />
        </div>
        
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-4xl font-bold text-black">
          ✓
        </div>

        <h1 className="text-4xl font-bold">
          {t.thankyou.title}
        </h1>

        <p className="mt-4 mb-10 text-neutral-400">
          {t.thankyou.textLine1}
          <br />
          {t.thankyou.textLine2}
        </p>

        <button
          onClick={() => {
            window.location.href = '/'
          }}
          className="mt-10 w-full rounded-2xl bg-emerald-500 p-4 font-bold text-black transition hover:bg-emerald-400"
        >
          {t.thankyou.backHome}
        </button>
      </div>
    </main>
  )
}
