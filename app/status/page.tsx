'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '../language-provider'
import { TopNavigation } from '../top-navigation'

type MaybeArray<T> = T | T[]

type StatusCustomer = {
  full_name: string | null
  phone: string | null
  email: string | null
}

type StatusItem = {
  id: number
  booking_date: string
  start_time: string
  end_time: string
  price: number
  status: string
  courts: MaybeArray<{
    name: string | null
  }> | null
}

type StatusBooking = {
  booking_code: string
  status: string
  payment_status: string
  slip_url: string | null
  total_amount: number
  created_at: string
  customers: MaybeArray<StatusCustomer> | null
  booking_items: StatusItem[] | null
}

type ToastTone = 'success' | 'error' | 'info'

type ToastState = {
  message: string
  tone: ToastTone
} | null

function firstRelation<T>(relation: MaybeArray<T> | null | undefined) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null
  }

  return relation ?? null
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '')
}

function getQueryParam(name: string) {
  if (typeof window === 'undefined') return ''

  return new URLSearchParams(window.location.search).get(name) || ''
}

function isPdfUrl(url: string) {
  return url.split('?')[0].toLowerCase().endsWith('.pdf')
}

function makeReceiptNumber(bookingCode: string) {
  return bookingCode.replace(/^BK-/, 'RC-')
}

function statusStyle(status: string) {
  if (status === 'paid' || status === 'completed') {
    return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
  }

  if (status === 'cancelled') {
    return 'border-red-500/30 bg-red-500/10 text-red-300'
  }

  return 'border-yellow-500/30 bg-yellow-500/10 text-yellow-300'
}

function isCancelled(status: string) {
  return status === 'cancelled' || status === 'canceled'
}

function canCancelBooking(
  bookingDate: string,
  startTime: string
) {
  const bookingStart = new Date(
    `${bookingDate}T${startTime}`
  )
  const diffHours =
    (bookingStart.getTime() - Date.now()) / (1000 * 60 * 60)

  return diffHours >= 2
}

function getBookingTime(
  bookingDate: string,
  time: string
) {
  return new Date(`${bookingDate}T${time}`)
}

function isBookingItemPast(item: StatusItem) {
  return getBookingTime(
    item.booking_date,
    item.end_time
  ).getTime() < Date.now()
}

function isBookingItemCompleted(item: StatusItem) {
  return item.status === 'completed' || isBookingItemPast(item)
}

function getStatusSortPriority(item: StatusItem) {
  if (isCancelled(item.status)) return 3

  if (isBookingItemCompleted(item)) return 2

  if (!canCancelBooking(item.booking_date, item.start_time)) return 1

  return 0
}

export default function StatusPage() {
  const { t } = useI18n()
  const [bookingCode, setBookingCode] = useState(() => getQueryParam('code'))
  const [phone, setPhone] = useState(() => getQueryParam('phone'))
  const [booking, setBooking] = useState<StatusBooking | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)
  const [slipPreview, setSlipPreview] = useState<string | null>(null)
  const [receiptPreview, setReceiptPreview] = useState<StatusBooking | null>(null)
  const autoSearchRef = useRef(false)

  const customer = useMemo(() => firstRelation(booking?.customers), [booking])
  const items = useMemo(
    () => booking?.booking_items || [],
    [booking?.booking_items]
  )
  const orderedItems = useMemo(() => {
    return [...items].sort((a, b) => {
      const priorityDiff =
        getStatusSortPriority(a) - getStatusSortPriority(b)

      if (priorityDiff !== 0) return priorityDiff

      return (
        getBookingTime(a.booking_date, a.start_time).getTime() -
        getBookingTime(b.booking_date, b.start_time).getTime()
      )
    })
  }, [items])
  const isPaid = booking?.payment_status === 'paid'

  function showToast(message: string, tone: ToastTone = 'info') {
    setToast({ message, tone })
    setTimeout(() => {
      setToast(null)
    }, 3000)
  }

  async function searchBooking() {
    const trimmedCode = bookingCode.trim()
    const normalizedPhone = normalizePhone(phone)

    if (!trimmedCode || !normalizedPhone) {
      showToast(t.status.enterInfoToast, 'error')
      return
    }

    setLoading(true)
    setBooking(null)

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        booking_code,
        status,
        payment_status,
        slip_url,
        total_amount,
        created_at,
        customers (
          full_name,
          phone,
          email
        ),
        booking_items (
          id,
          booking_date,
          start_time,
          end_time,
          price,
          status,
          courts (
            name
          )
        )
      `)
      .eq('booking_code', trimmedCode)
      .single()

    setLoading(false)

    if (error || !data) {
      showToast(t.status.notFoundToast, 'error')
      return
    }

    const statusBooking = data as unknown as StatusBooking
    const customerPhone = normalizePhone(firstRelation(statusBooking.customers)?.phone || '')

    if (customerPhone !== normalizedPhone) {
      showToast(t.status.phoneMismatchToast, 'error')
      return
    }

    setBooking(statusBooking)

    setTimeout(() => {
      document.getElementById('status-result')?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      })
    }, 100)
  }

  useEffect(() => {
    if (autoSearchRef.current || !bookingCode.trim() || !normalizePhone(phone)) {
      return
    }

    autoSearchRef.current = true
    void searchBooking()
    // Run once on mount so returning from receipt/cancel restores booking details.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <>
      {toast && (
        <div
          className={`fixed left-1/2 top-5 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border bg-neutral-900 px-5 py-4 text-center font-semibold shadow-2xl ${
            toast.tone === 'error'
              ? 'border-red-500/30 text-red-300'
              : toast.tone === 'success'
              ? 'border-emerald-500/30 text-emerald-300'
              : 'border-white/10 text-white'
          }`}
        >
          {toast.message}
        </div>
      )}

      {slipPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="w-full max-w-5xl rounded-3xl border border-white/10 bg-neutral-900 p-4 shadow-2xl md:p-6">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                  {t.status.viewSlip}
                </p>
                <h2 className="mt-2 text-2xl font-bold">{t.status.viewSlip}</h2>
              </div>

              <button
                type="button"
                onClick={() => setSlipPreview(null)}
                aria-label="Close slip preview"
                className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-white/10 text-2xl font-bold text-white transition hover:border-white/30 hover:bg-white hover:text-black"
              >
                ×
              </button>
            </div>

            <div className="overflow-hidden rounded-2xl border border-white/10 bg-black">
              {isPdfUrl(slipPreview) ? (
                <iframe
                  src={slipPreview}
                  title={t.status.viewSlip}
                  className="h-[78vh] w-full"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={slipPreview}
                  alt={t.status.viewSlip}
                  className="max-h-[78vh] w-full object-contain"
                />
              )}
            </div>
          </div>
        </div>
      )}

      {receiptPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 p-4 backdrop-blur-sm">
          <div className="max-h-[calc(100vh-2rem)] w-full max-w-6xl overflow-y-auto rounded-3xl border border-white/10 bg-neutral-900 p-5 shadow-2xl md:p-8">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                  {t.receipt.eyebrow}
                </p>
                <h2 className="mt-3 text-4xl font-bold leading-tight md:text-5xl">
                  {t.receipt.title}
                </h2>
                <p className="mt-3 max-w-3xl text-neutral-400">
                  {t.receipt.note}
                </p>
              </div>

              <div className="flex shrink-0 items-center gap-2 print:hidden">
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex h-11 items-center justify-center rounded-2xl bg-white px-5 text-sm font-bold text-black transition hover:bg-neutral-200"
                >
                  {t.common.print}
                </button>

                <button
                  type="button"
                  onClick={() => setReceiptPreview(null)}
                  aria-label="Close receipt preview"
                  className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 text-2xl font-bold text-white transition hover:border-white/30 hover:bg-white hover:text-black"
                >
                  ×
                </button>
              </div>
            </div>

            <div className="mt-8 border-t border-white/10 pt-6">
              <div className="grid gap-4 lg:grid-cols-[1fr_1fr_1fr]">
                <div className="rounded-2xl border border-white/10 bg-black p-5">
                  <p className="text-sm text-neutral-500">{t.receipt.receiptNumber}</p>
                  <p className="mt-2 text-xl font-bold">
                    {makeReceiptNumber(receiptPreview.booking_code)}
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black p-5">
                  <p className="text-sm text-neutral-500">{t.receipt.customer}</p>
                  <p className="mt-2 text-xl font-bold">
                    {customer?.full_name || '-'}
                  </p>
                  <p className="mt-1 text-neutral-400">{customer?.phone || '-'}</p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black p-5">
                  <p className="text-sm text-neutral-500">{t.receipt.issuedAt}</p>
                  <p className="mt-2 text-xl font-bold">
                    {new Date(receiptPreview.created_at).toLocaleString()}
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-4 lg:grid-cols-[1fr_auto] lg:items-center">
                <div className="rounded-2xl border border-white/10 bg-black p-5">
                  <p className="text-sm text-neutral-500">{t.receipt.bookingCode}</p>
                  <p className="mt-2 text-xl font-bold">
                    {receiptPreview.booking_code}
                  </p>
                </div>

                <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-5 lg:min-w-[240px]">
                  <p className="text-sm text-emerald-300/80">{t.receipt.totalPaid}</p>
                  <p className="mt-2 text-3xl font-bold text-white">
                    {receiptPreview.total_amount} {t.common.thb}
                  </p>
                </div>
              </div>

              <div className="mt-8">
                <h3 className="text-2xl font-bold">{t.receipt.bookingItems}</h3>

                <div className="mt-4 space-y-3">
                  {orderedItems.map((item) => (
                    <div
                      key={item.id}
                      className="grid gap-3 rounded-2xl border border-white/10 bg-black p-4 text-sm md:grid-cols-[1fr_1fr_1fr_auto] md:items-center"
                    >
                      <div>
                        <p className="text-neutral-500">{t.status.courtNumber}</p>
                        <p className="font-bold">
                          {firstRelation(item.courts)?.name || '-'}
                        </p>
                      </div>

                      <div>
                        <p className="text-neutral-500">{t.common.date}</p>
                        <p className="font-bold">{item.booking_date}</p>
                      </div>

                      <div>
                        <p className="text-neutral-500">{t.common.time}</p>
                        <p className="font-bold">
                          {item.start_time} - {item.end_time}
                        </p>
                      </div>

                      <div className="font-bold md:text-right">
                        {item.price} {t.common.thb}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      <main className="min-h-screen bg-neutral-950 text-white">
        <section className="mx-auto max-w-6xl space-y-8 px-5 py-10 md:py-16">
          <TopNavigation />

          <div className="rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 to-neutral-800 px-6 py-9 shadow-2xl md:px-10 md:py-12">
            <div className="mb-7 md:mb-9">
              <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400 sm:text-sm">
                {t.status.eyebrow}
              </p>
              <h1 className="mt-5 max-w-3xl text-[2.15rem] font-bold leading-[1.1] sm:text-5xl md:text-6xl">
                {t.status.title}
              </h1>
              <p className="mt-5 max-w-2xl text-base leading-relaxed text-neutral-300 md:mt-6 md:text-lg">
                {t.status.subtitle}
              </p>
            </div>

            <div className="rounded-3xl border border-white/10 bg-neutral-950 p-4 md:p-5">
              <div className="grid gap-4 md:grid-cols-[1fr_1fr_auto] md:items-end">
                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-neutral-400">
                    {t.status.bookingCode}
                  </span>
                  <input
                    value={bookingCode}
                    onChange={(event) => setBookingCode(event.target.value)}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black px-4 text-white outline-none transition focus:border-emerald-400"
                  />
                </label>

                <label className="block">
                  <span className="mb-2 block text-sm font-semibold text-neutral-400">
                    {t.status.phoneNumber}
                  </span>
                  <input
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    className="h-14 w-full rounded-2xl border border-white/10 bg-black px-4 text-white outline-none transition focus:border-emerald-400"
                  />
                </label>

                <button
                  type="button"
                  onClick={searchBooking}
                  disabled={loading}
                  className="h-14 w-full rounded-2xl bg-white px-8 font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400 md:w-auto md:min-w-[170px]"
                >
                  {loading ? t.common.loading : t.status.searchButton}
                </button>
              </div>
            </div>
          </div>

          {booking && (
            <section
              id="status-result"
              className="rounded-3xl border border-white/10 bg-neutral-900 p-5 shadow-2xl md:p-8"
            >
              <div>
                <div>
                  <h2 className="text-3xl font-bold">{t.status.detailsTitle}</h2>
                  <p className="mt-2 text-neutral-400">{booking.booking_code}</p>
                </div>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <div className="rounded-2xl bg-black p-4">
                  <p className="text-sm text-neutral-500">{t.status.customer}</p>
                  <p className="mt-1 font-bold">{customer?.full_name || '-'}</p>
                  <p className="mt-1 text-sm text-neutral-400">{customer?.phone || '-'}</p>
                </div>

                <div className="rounded-2xl bg-black p-4">
                  <p className="text-sm text-neutral-500">{t.common.total}</p>
                  <p className="mt-1 text-2xl font-bold">
                    {booking.total_amount} {t.common.thb}
                  </p>
                </div>

                <div className="rounded-2xl bg-black p-4">
                  <p className="text-sm text-neutral-500">{t.status.bookingStatus}</p>
                  <p className={`mt-2 inline-flex rounded-full border px-3 py-1 text-sm font-bold ${statusStyle(booking.status)}`}>
                    {isCancelled(booking.status) ? t.status.cancelledStatus : booking.status}
                  </p>
                </div>
              </div>

              <div className="mt-6">
                <h3 className="text-2xl font-bold">{t.status.schedule}</h3>
                <div className="mt-3 space-y-3">
                  {orderedItems.map((item) => {
                    const cancelled = isCancelled(item.status)
                    const completed = !cancelled && isBookingItemCompleted(item)

                    return (
                      <div
                        key={item.id}
                        className={`grid gap-4 rounded-2xl border p-4 transition md:grid-cols-4 md:items-start ${
                          cancelled
                            ? 'border-red-500/20 bg-red-950/10 text-neutral-500 opacity-70'
                            : completed
                            ? 'border-white/10 bg-black/60 text-neutral-500 opacity-75'
                            : 'border-white/10 bg-black'
                        }`}
                      >
                        <div>
                          <p className="text-sm text-neutral-500">{t.status.courtNumber}</p>
                          <p className={`mt-1 font-bold ${cancelled ? 'line-through decoration-red-400/60' : completed ? 'text-neutral-400' : ''}`}>
                            {firstRelation(item.courts)?.name || '-'}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-neutral-500">{t.common.date}</p>
                          <p className={`mt-1 font-bold ${cancelled ? 'line-through decoration-red-400/60' : completed ? 'text-neutral-400' : ''}`}>
                            {item.booking_date}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-neutral-500">{t.common.time}</p>
                          <p className={`mt-1 whitespace-nowrap font-bold ${cancelled ? 'line-through decoration-red-400/60' : completed ? 'text-neutral-400' : ''}`}>
                            {item.start_time} - {item.end_time}
                          </p>
                        </div>
                        <div>
                          <p className="text-sm text-neutral-500">{t.status.price}</p>
                          <p className={`mt-1 whitespace-nowrap font-bold ${cancelled ? 'line-through decoration-red-400/60' : completed ? 'text-neutral-400' : ''}`}>
                            {item.price} {t.common.thb}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-[minmax(0,720px)_auto] xl:items-stretch xl:justify-between">
                <div>
                  {!isPaid ? (
                    <div className="rounded-2xl border border-white/10 bg-neutral-950 p-4">
                      <p className="font-bold text-white">{t.status.receiptPending}</p>
                      <p className="mt-1 text-sm text-neutral-500">
                        {t.status.slipPending}
                      </p>
                    </div>
                  ) : (
                    <div className="grid h-full gap-3 sm:grid-cols-2">
                      {booking.slip_url ? (
                        <div className="flex min-h-[96px] w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950 p-4">
                          <div>
                            <p className="font-bold text-white">{t.admin.paymentSlip}</p>
                            <p className="mt-1 text-sm text-neutral-500">
                              {t.admin.uploaded}
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={() => setSlipPreview(booking.slip_url)}
                            className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-black transition hover:bg-neutral-200 sm:h-11 sm:px-5 sm:text-base"
                          >
                            {t.admin.viewSlip}
                          </button>
                        </div>
                      ) : (
                        <div className="rounded-2xl border border-white/10 bg-neutral-950 p-4 text-neutral-400">
                          {t.admin.noSlip}
                        </div>
                      )}

                      <div className="flex min-h-[96px] w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950 p-4">
                        <div>
                          <p className="font-bold text-white">{t.admin.viewReceipt}</p>
                          <p className="mt-1 text-sm text-neutral-500">
                            {t.admin.receiptReady}
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() => setReceiptPreview(booking)}
                          className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-black transition hover:bg-neutral-200 sm:h-11 sm:px-5 sm:text-base"
                        >
                          {t.admin.viewReceipt}
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {!isCancelled(booking.status) && (
                  <div className="flex items-center xl:ml-6 xl:min-w-[260px] xl:justify-end">
                    <a
                      href={`/cancel?code=${encodeURIComponent(
                        booking.booking_code
                      )}&phone=${encodeURIComponent(phone)}`}
                      className="inline-flex h-14 w-full items-center justify-center rounded-2xl border border-white/15 px-7 font-bold text-white transition hover:border-red-400 hover:bg-red-500/10 hover:text-red-300 sm:w-auto sm:min-w-[220px]"
                    >
                      {t.status.cancelBooking}
                    </a>
                  </div>
                )}
              </div>
            </section>
          )}
        </section>
      </main>
    </>
  )
}
