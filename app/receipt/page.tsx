'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useI18n } from '../language-provider'
import { TopNavigation } from '../top-navigation'

type MaybeArray<T> = T | T[]

type ReceiptCustomer = {
  full_name: string | null
  phone: string | null
  email: string | null
}

type ReceiptItem = {
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

type ReceiptBooking = {
  booking_code: string
  status: string
  payment_status: string
  total_amount: number
  created_at: string
  customers: MaybeArray<ReceiptCustomer> | null
  booking_items: ReceiptItem[] | null
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

function makeReceiptNumber(bookingCode: string) {
  return bookingCode.replace(/^BK-/, 'RC-')
}

function getQueryParam(name: string) {
  if (typeof window === 'undefined') return ''

  return new URLSearchParams(window.location.search).get(name) || ''
}

export default function ReceiptPage() {
  const { t } = useI18n()
  const [bookingCode, setBookingCode] = useState(() => getQueryParam('code'))
  const [phone, setPhone] = useState(() => getQueryParam('phone'))
  const [openedFromStatus] = useState(
    () => Boolean(getQueryParam('code').trim() && normalizePhone(getQueryParam('phone')))
  )
  const [booking, setBooking] = useState<ReceiptBooking | null>(null)
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)
  const autoSearchRef = useRef(false)

  const customer = useMemo(() => firstRelation(booking?.customers), [booking])
  const items = booking?.booking_items || []
  const isPaid = booking?.payment_status === 'paid'
  const statusBackHref =
    bookingCode.trim() && normalizePhone(phone)
      ? `/status?code=${encodeURIComponent(bookingCode)}&phone=${encodeURIComponent(phone)}`
      : '/status'

  function showToast(message: string, tone: ToastTone = 'info') {
    setToast({ message, tone })
    setTimeout(() => {
      setToast(null)
    }, 3000)
  }

  async function searchReceipt(
    code = bookingCode,
    phoneValue = phone,
    shouldScroll = true
  ) {
    const trimmedCode = code.trim()
    const normalizedPhone = normalizePhone(phoneValue)

    if (!trimmedCode || !normalizedPhone) {
      showToast(t.receipt.enterInfoToast, 'error')
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
      showToast(t.receipt.notFoundToast, 'error')
      return
    }

    const receiptBooking = data as unknown as ReceiptBooking
    const customerPhone = normalizePhone(firstRelation(receiptBooking.customers)?.phone || '')

    if (customerPhone !== normalizedPhone) {
      showToast(t.receipt.phoneMismatchToast, 'error')
      return
    }

    setBooking(receiptBooking)

    if (shouldScroll) {
      setTimeout(() => {
        document.getElementById('receipt-result')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      }, 100)
    }
  }

  useEffect(() => {
    if (autoSearchRef.current || !bookingCode.trim() || !normalizePhone(phone)) {
      return
    }

    autoSearchRef.current = true
    void searchReceipt(bookingCode, phone, true)
    // Run once on mount so links from the status page open the receipt directly.
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

      <main className="min-h-screen bg-neutral-950 text-white print:bg-white print:px-0 print:py-0 print:text-black">
        <section className="mx-auto max-w-6xl space-y-8 px-5 py-10 print:px-0 print:py-0 md:py-16">
          <TopNavigation backHref={statusBackHref} className="print:hidden" />

          {!openedFromStatus && (
          <div className="rounded-3xl border border-white/10 bg-neutral-900 p-6 shadow-2xl print:hidden md:p-8">
            <div className="mb-8">
              <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                {t.receipt.eyebrow}
              </p>
              <h1 className="mt-3 text-4xl font-bold md:text-5xl">
                {t.receipt.title}
              </h1>
              <p className="mt-3 max-w-2xl text-neutral-400">
                {t.receipt.subtitle}
              </p>
            </div>

            <div className="grid gap-3 md:grid-cols-[1fr_1fr_auto] md:items-end">
              <label className="block">
                <span className="mb-2 block text-sm text-neutral-400">
                  {t.receipt.bookingCode}
                </span>
                <input
                  value={bookingCode}
                  onChange={(event) => setBookingCode(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 text-white outline-none transition focus:border-emerald-400"
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-sm text-neutral-400">
                  {t.receipt.phoneNumber}
                </span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  className="h-14 w-full rounded-2xl border border-white/10 bg-neutral-950 px-4 text-white outline-none transition focus:border-emerald-400"
                />
              </label>

              <button
                type="button"
                onClick={() => searchReceipt()}
                disabled={loading}
                className="h-14 rounded-2xl bg-white px-8 font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:bg-neutral-700 disabled:text-neutral-400"
              >
                {loading ? t.common.loading : t.receipt.searchButton}
              </button>
            </div>
          </div>
          )}

          {booking && (
            <section
              id="receipt-result"
              className="rounded-3xl border border-white/10 bg-neutral-900 p-5 shadow-2xl print:rounded-none print:border-0 print:bg-white print:p-10 print:shadow-none md:p-8"
            >
              {isPaid ? (
                <>
                  <div className="flex flex-col gap-6 border-b border-white/10 pb-8 print:border-black/20 md:flex-row md:items-start md:justify-between">
                    <div>
                      <p className="text-xs font-semibold uppercase tracking-[0.25em] text-emerald-400 print:text-black sm:text-sm">
                        {t.receipt.eyebrow}
                      </p>
                      <h2 className="mt-5 text-[2.15rem] font-bold leading-[1.1] md:text-6xl">
                        {t.receipt.title}
                      </h2>
                      <p className="mt-5 max-w-3xl text-base leading-relaxed text-neutral-400 print:text-black/60 md:mt-6 md:text-lg">
                        {t.receipt.note}
                      </p>
                    </div>

                    <div className="rounded-2xl border border-white/10 bg-neutral-950 p-4 print:border-black/20 print:bg-white md:min-w-[280px]">
                      <p className="text-sm text-neutral-500 print:text-black/60">
                        {t.receipt.receiptNumber}
                      </p>
                      <p className="mt-1 text-2xl font-bold">
                        {makeReceiptNumber(booking.booking_code)}
                      </p>
                      <p className="mt-4 text-sm text-neutral-500 print:text-black/60">
                        {t.receipt.issuedAt}
                      </p>
                      <p className="mt-1 font-semibold">
                        {new Date().toLocaleString()}
                      </p>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-4 md:grid-cols-3">
                    <div className="rounded-2xl bg-black p-4 print:border print:border-black/20 print:bg-white">
                      <p className="text-sm text-neutral-500 print:text-black/60">
                        {t.receipt.bookingCode}
                      </p>
                      <p className="mt-1 font-bold">{booking.booking_code}</p>
                    </div>

                    <div className="rounded-2xl bg-black p-4 print:border print:border-black/20 print:bg-white">
                      <p className="text-sm text-neutral-500 print:text-black/60">
                        {t.receipt.customer}
                      </p>
                      <p className="mt-1 font-bold">{customer?.full_name || '-'}</p>
                      <p className="mt-1 text-sm text-neutral-400 print:text-black/60">
                        {customer?.phone || '-'}
                      </p>
                    </div>

                    <div className="rounded-2xl bg-black p-4 print:border print:border-black/20 print:bg-white">
                      <p className="text-sm text-neutral-500 print:text-black/60">
                        {t.receipt.status}
                      </p>
                      <p className="mt-1 font-bold text-emerald-300 print:text-black">
                        {t.receipt.paid}
                      </p>
                    </div>
                  </div>

                  <div className="mt-8">
                    <h3 className="text-2xl font-bold">{t.receipt.bookingItems}</h3>

                    <div className="mt-4 space-y-3">
                      {items.map((item) => (
                        <div
                          key={item.id}
                          className="grid gap-3 rounded-2xl border border-white/10 bg-black p-4 print:border-black/20 print:bg-white md:grid-cols-[1fr_1fr_auto] md:items-center"
                        >
                          <div>
                            <p className="font-bold">
                              {firstRelation(item.courts)?.name || '-'}
                            </p>
                            <p className="text-sm text-neutral-400 print:text-black/60">
                              {item.booking_date}
                            </p>
                          </div>

                          <p className="text-neutral-300 print:text-black/70">
                            {item.start_time} - {item.end_time}
                          </p>

                          <p className="font-bold">
                            {item.price} {t.common.thb}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="mt-8 rounded-2xl bg-white/5 p-5 print:border print:border-black/20 print:bg-white">
                    <div className="flex items-center justify-between gap-4">
                      <span className="text-neutral-400 print:text-black/60">
                        {t.receipt.totalPaid}
                      </span>
                      <span className="text-3xl font-bold">
                        {booking.total_amount} {t.common.thb}
                      </span>
                    </div>
                  </div>

                  <div className="mt-6 grid gap-3 print:hidden">
                    <button
                      type="button"
                      onClick={() => window.print()}
                      className="h-14 rounded-2xl bg-white font-bold text-black transition hover:bg-emerald-400"
                    >
                      {t.common.print}
                    </button>
                  </div>
                </>
              ) : (
                <div className="rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-6 text-yellow-200">
                  <h2 className="text-2xl font-bold">{t.receipt.notReadyTitle}</h2>
                  <p className="mt-2">{t.receipt.notReadyText}</p>
                </div>
              )}
            </section>
          )}
        </section>
      </main>
    </>
  )
}
