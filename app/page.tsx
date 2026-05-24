'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LanguageToggle } from './language-toggle'
import { useI18n } from './language-provider'

const galleryGroups = [
  [
    'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1600&q=85',
    'https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=1600&q=85',
  ],
  [
    'https://images.unsplash.com/photo-1613918431703-aa50889e3be9?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1613918431703-aa50889e3be9?auto=format&fit=crop&w=1600&q=85',
    'https://images.unsplash.com/photo-1626224583764-f87db24ac4ea?auto=format&fit=crop&w=1600&q=85',
  ],
  [
    'https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=1200&q=80',
    'https://images.unsplash.com/photo-1599474924187-334a4ae5bd3c?auto=format&fit=crop&w=1600&q=85',
    'https://images.unsplash.com/photo-1613918431703-aa50889e3be9?auto=format&fit=crop&w=1600&q=85',
  ],
]

export default function LandingPage() {
  const router = useRouter()
  const { locale, t } = useI18n()
  const [activeGalleryIndex, setActiveGalleryIndex] = useState<number | null>(null)
  const [activeImageIndex, setActiveImageIndex] = useState(0)

  const activeGallery =
    activeGalleryIndex === null ? null : galleryGroups[activeGalleryIndex]

  const pricing = [
    {
      label: t.landing.weekdayRate,
      price: `160 ${t.common.thb}`,
    },
    {
      label: t.landing.weekendRate,
      price: `220 ${t.common.thb}`,
    },
  ]

  const primaryLinks = [
    {
      label: t.landing.bookNow,
      href: '/booking',
      className: 'bg-emerald-500 text-black hover:bg-emerald-400',
    },
    {
      label: t.landing.manageBooking,
      href: '/status',
      className: 'border border-white/15 text-white hover:border-emerald-400 hover:text-emerald-300',
    },
  ]

  function navigateTo(href: string) {
    window.localStorage.setItem('locale', locale)
    router.push(href)
  }

  function openGallery(index: number) {
    setActiveGalleryIndex(index)
    setActiveImageIndex(0)
  }

  function closeGallery() {
    setActiveGalleryIndex(null)
    setActiveImageIndex(0)
  }

  function showPreviousImage() {
    if (!activeGallery) return

    setActiveImageIndex((current) =>
      current === 0 ? activeGallery.length - 1 : current - 1
    )
  }

  function showNextImage() {
    if (!activeGallery) return

    setActiveImageIndex((current) =>
      current === activeGallery.length - 1 ? 0 : current + 1
    )
  }

  return (
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-6xl space-y-8 px-5 py-10 md:py-16">
        <nav className="flex h-11 items-center justify-between gap-4 md:h-12">
          <div className="flex h-full items-center">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
              Badminton Courts
            </p>
          </div>
          <LanguageToggle />
        </nav>

        <section className="overflow-hidden rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 to-neutral-800 shadow-2xl">
          <div className="max-w-4xl px-6 py-9 md:px-10 md:py-12">
            <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400 sm:text-sm">
              {t.landing.eyebrow}
            </p>

            <h1
              className={`mt-5 font-bold leading-[1.1] ${
                locale === 'th'
                  ? 'max-w-5xl text-[2.15rem] sm:text-5xl md:text-[4.5rem]'
                  : 'text-[2.25rem] sm:text-5xl md:text-[4.25rem]'
              }`}
            >
              {locale === 'th' ? (
                <>
                  <span className="block md:inline">จองสนามง่าย</span>
                  <span className="block md:inline">
                    <span className="hidden md:inline"> </span>
                    ได้มาตรฐาน
                  </span>
                </>
              ) : (
                t.landing.title
              )}
            </h1>

            <p className="mt-5 max-w-4xl text-base leading-relaxed text-neutral-300 md:text-lg">
              {t.landing.subtitle}
            </p>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              {primaryLinks.map((link) => (
                <button
                  key={link.href}
                  type="button"
                  onClick={() => navigateTo(link.href)}
                  className={`inline-flex h-14 items-center justify-center rounded-2xl px-7 font-bold transition ${link.className}`}
                >
                  {link.label}
                </button>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 md:grid-cols-3">
          <div className="rounded-3xl border border-white/10 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-400">{t.landing.locationTitle}</p>
            <h2 className="mt-3 text-base font-semibold leading-relaxed text-neutral-100 md:text-lg">
              {t.landing.locationText}
            </h2>
          </div>

          <div className="rounded-3xl border border-white/10 bg-neutral-900 p-6">
            <p className="text-sm text-neutral-400">{t.landing.contactTitle}</p>
            <div className="mt-3 space-y-2 text-base font-semibold leading-relaxed md:text-lg">
              <p>{t.landing.phone}</p>
              <p>{t.landing.line}</p>
              <p>{t.landing.hours}</p>
            </div>
          </div>

          <div className="rounded-3xl border border-emerald-500/30 bg-emerald-500/10 p-6">
            <p className="text-sm text-emerald-300">{t.landing.pricingTitle}</p>
            <div className="mt-4 space-y-3">
              {pricing.map((item) => (
                <div
                  key={item.label}
                  className="flex items-center justify-between gap-4 rounded-2xl bg-black/30 p-4"
                >
                  <span className="text-neutral-300">{item.label}</span>
                  <span className="text-xl font-bold md:text-2xl">
                    {item.price}
                    <span className="ml-1 text-sm font-semibold text-neutral-400">
                      / {t.landing.perHour}
                    </span>
                  </span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="grid gap-5 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="rounded-3xl border border-white/10 bg-neutral-900 p-6 md:p-8">
            <div className="lg:min-h-[120px]">
              <h2 className="text-3xl font-bold md:text-4xl">{t.landing.courtTitle}</h2>
              <p className="mt-4 text-base leading-relaxed text-neutral-300 md:text-lg">
                {t.landing.courtDescription}
              </p>
            </div>

            <div className="mt-5 grid gap-3 md:mt-6">
              {t.landing.features.map((feature) => (
                <div
                  key={feature}
                  className="flex items-start gap-3 rounded-2xl border border-white/10 bg-black p-4"
                >
                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-emerald-400" />
                  <span className="text-sm font-semibold leading-relaxed text-neutral-100 md:text-base">
                    {feature}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-white/10 bg-neutral-900 p-6 md:p-8">
            <div className="lg:min-h-[120px]">
              <h2 className="text-3xl font-bold md:text-4xl">{t.landing.galleryTitle}</h2>
              <p className="mt-4 text-base leading-relaxed text-neutral-300 md:text-lg">
                {t.landing.gallerySubtitle}
              </p>
            </div>

            <div className="mt-5 grid gap-4 md:mt-6 md:grid-cols-3">
              {galleryGroups.map((images, index) => (
                <button
                  key={t.landing.gallery[index]}
                  type="button"
                  onClick={() => openGallery(index)}
                  className="overflow-hidden rounded-2xl border border-white/10 bg-black text-left transition hover:border-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400"
                >
                  <div
                    role="img"
                    aria-label={t.landing.gallery[index]}
                    className="h-56 w-full bg-cover bg-center md:h-72"
                    style={{
                      backgroundImage: `url(${images[0]})`,
                    }}
                  />
                  <div className="p-4 font-bold">
                    {t.landing.gallery[index]}
                  </div>
                </button>
              ))}
            </div>
          </div>
        </section>

        <section>
          <div className="grid gap-5 rounded-3xl border border-white/10 bg-neutral-900 p-6 md:grid-cols-[1fr_auto] md:items-center md:p-8">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                {t.landing.statusTitle}
              </p>
              <h2 className="mt-3 text-3xl font-bold md:text-4xl">
                {t.landing.manageBooking}
              </h2>
              <p className="mt-3 max-w-3xl text-neutral-300">
                {t.landing.statusText}
              </p>
            </div>

            <div className="md:w-[220px]">
              <button
                type="button"
                onClick={() => navigateTo('/status')}
                className="inline-flex h-14 w-full items-center justify-center rounded-2xl bg-white px-6 text-base font-bold text-black transition hover:bg-emerald-400"
              >
                {t.landing.manageBooking}
              </button>
            </div>
          </div>
        </section>
      </section>

      {activeGallery && activeGalleryIndex !== null && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label={t.landing.gallery[activeGalleryIndex]}
        >
          <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-neutral-950 p-4 shadow-2xl md:p-5">
            <div className="mb-4 flex items-center justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400">
                  {t.landing.galleryTitle}
                </p>
                <h3 className="mt-1 text-xl font-bold md:text-2xl">
                  {t.landing.gallery[activeGalleryIndex]}
                </h3>
              </div>

              <button
                type="button"
                onClick={closeGallery}
                aria-label="Close gallery"
                className="inline-flex h-11 w-11 items-center justify-center rounded-xl border border-white/15 text-2xl font-bold leading-none text-white transition hover:border-emerald-400 hover:text-emerald-300"
              >
                ×
              </button>
            </div>

            <div className="grid gap-4 md:grid-cols-[auto_1fr_auto] md:items-center">
              <button
                type="button"
                onClick={showPreviousImage}
                className="hidden h-14 w-14 items-center justify-center rounded-2xl border border-white/15 text-2xl font-bold transition hover:border-emerald-400 hover:text-emerald-300 md:inline-flex"
                aria-label="Previous image"
              >
                {'<'}
              </button>

              <div
                role="img"
                aria-label={t.landing.gallery[activeGalleryIndex]}
                className="min-h-[360px] rounded-2xl border border-white/10 bg-black bg-contain bg-center bg-no-repeat md:min-h-[560px]"
                style={{
                  backgroundImage: `url(${activeGallery[activeImageIndex]})`,
                }}
              />

              <button
                type="button"
                onClick={showNextImage}
                className="hidden h-14 w-14 items-center justify-center rounded-2xl border border-white/15 text-2xl font-bold transition hover:border-emerald-400 hover:text-emerald-300 md:inline-flex"
                aria-label="Next image"
              >
                {'>'}
              </button>
            </div>

            <div className="mt-4 flex items-center justify-between gap-3">
              <button
                type="button"
                onClick={showPreviousImage}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-white/15 font-bold transition hover:border-emerald-400 hover:text-emerald-300 md:hidden"
              >
                {'<'}
              </button>

              <p className="min-w-24 text-center text-sm font-semibold text-neutral-400">
                {activeImageIndex + 1} / {activeGallery.length}
              </p>

              <button
                type="button"
                onClick={showNextImage}
                className="inline-flex h-12 flex-1 items-center justify-center rounded-2xl border border-white/15 font-bold transition hover:border-emerald-400 hover:text-emerald-300 md:hidden"
              >
                {'>'}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}
