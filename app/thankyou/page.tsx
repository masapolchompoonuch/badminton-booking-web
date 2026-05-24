'use client'

import { useState } from 'react'
import { useI18n } from '../language-provider'

function getBookingCodeFromUrl() {
  if (typeof window === 'undefined') return ''

  return new URLSearchParams(window.location.search).get('code') || ''
}

export default function ThankYouPage() {
  const { t } = useI18n()
  const [bookingCode] = useState(() => getBookingCodeFromUrl())

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto flex min-h-screen w-full max-w-6xl items-center px-5 py-10 md:py-16">
        <div className="mx-auto w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-neutral-900 p-8 text-center">
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

        <div className="rounded-2xl border border-white/10 bg-black p-4 text-left">
          <p className="text-sm text-neutral-400">
            {t.thankyou.receiptNote}
          </p>

          {bookingCode && (
            <p className="mt-2 truncate font-bold text-white">
              {bookingCode}
            </p>
          )}
        </div>

        <button
          onClick={() => {
            window.location.href = '/'
          }}
          className="mt-10 w-full rounded-2xl bg-emerald-500 p-4 font-bold text-black transition hover:bg-emerald-400"
        >
          {t.thankyou.backHome}
        </button>
        </div>
      </section>
    </main>
  )
}
