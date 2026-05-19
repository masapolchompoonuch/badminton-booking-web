'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

type MaybeArray<T> = T | T[]

type CancelCustomer = {
  full_name: string | null
  phone: string | null
}

type CancelBookingItem = {
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

type CancelBooking = {
  id: number
  booking_code: string
  status: string
  payment_status: string
  total_amount: number
  customers: MaybeArray<CancelCustomer> | null
  booking_items: CancelBookingItem[] | null
}

function firstRelation<T>(relation: MaybeArray<T> | null | undefined) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null
  }

  return relation ?? null
}

function canCancelBooking(
  bookingDate: string,
  startTime: string
) {
  const bookingStart = new Date(
    `${bookingDate}T${startTime}`
  )

  const now = new Date()

  const diffMs =
    bookingStart.getTime() - now.getTime()

  const diffHours =
    diffMs / (1000 * 60 * 60)

  return diffHours >= 2
}

export default function CancelPage() {
  const [bookingCode, setBookingCode] =
    useState('')

  const [phone, setPhone] = useState('')

  const [booking, setBooking] =
    useState<CancelBooking | null>(null)

  const [loading, setLoading] =
    useState(false)

  const [selectedItems, setSelectedItems] =
    useState<number[]>([])

  const [cancelSuccess, setCancelSuccess] =
    useState(false)

const [showCancelConfirm, setShowCancelConfirm] =
  useState(false)

const [cancelDone, setCancelDone] =
  useState(false)

  async function searchBooking(shouldScroll = true) {
    setLoading(true)
    setBooking(null)
    setSelectedItems([])
    setCancelSuccess(false)

    const { data: bookingData, error } = await supabase
      .from('bookings')
      .select(`
        id,
        booking_code,
        status,
        payment_status,
        total_amount,
        customers (
          full_name,
          phone
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
      .eq('booking_code', bookingCode)
      .single()

    setLoading(false)

    if (error || !bookingData) {
      alert('Booking not found')
      return
    }

    const data = bookingData as unknown as CancelBooking
    const customerPhone = firstRelation(data.customers)?.phone

    if (customerPhone !== phone) {
      alert('Phone number does not match')
      return
    }

    setBooking(data)
    if (shouldScroll) {
        setTimeout(() => {
            document.getElementById('booking-details')?.scrollIntoView({
            behavior: 'smooth',
            block: 'start',
            })
        }, 100)
        }
  }

  const cancellableItems = useMemo(() => {
    if (!booking?.booking_items) return []

    return booking.booking_items.filter(
      (item) =>
        item.status !== 'cancelled' &&
        canCancelBooking(
          item.booking_date,
          item.start_time
        )
    )
  }, [booking])

  function toggleSelectItem(itemId: number) {
    setSelectedItems((prev) =>
      prev.includes(itemId)
        ? prev.filter((id) => id !== itemId)
        : [...prev, itemId]
    )
  }

  function selectAllItems() {
    const allIds = cancellableItems.map(
      (item) => item.id
    )

    setSelectedItems(allIds)
  }

  function clearSelection() {
    setSelectedItems([])
  }

  async function cancelSelectedItems() {
    if (!booking) return

    if (selectedItems.length === 0) {
      alert('Please select item(s)')
      return
    }

    // const confirmCancel = confirm(
    //   'Are you sure you want to cancel selected booking item(s)?'
    // )

    // if (!confirmCancel) return

    setLoading(true)

    const { error: itemError } = await supabase
      .from('booking_items')
      .update({
        status: 'cancelled',
      })
      .in('id', selectedItems)

    if (itemError) {
      console.error(itemError)
      alert('Cancel failed')
      setLoading(false)
      return
    }

    const updatedItems =
      booking.booking_items?.map((item) =>
        selectedItems.includes(item.id)
          ? {
              ...item,
              status: 'cancelled',
            }
          : item
      ) ?? []

    const activeItems = updatedItems.filter(
      (item) =>
        item.status !== 'cancelled'
    )

    const newTotalAmount =
      activeItems.reduce(
        (sum, item) =>
          sum + Number(item.price),
        0
      )

    const allCancelled =
      activeItems.length === 0

    const { error: bookingError } =
      await supabase
        .from('bookings')
        .update({
          total_amount: newTotalAmount,
          status: allCancelled
            ? 'cancelled'
            : booking.status,
        })
        .eq('id', booking.id)

    setLoading(false)

    if (bookingError) {
      console.error(bookingError)
      alert('Update booking failed')
      return
    }

    setCancelSuccess(true)

    await searchBooking(false)
  }

  return (
    <>
    {showCancelConfirm && (
        <div
        id="cancel-confirm-popup"
        className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6"
        >
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900 p-8 text-center shadow-2xl">
            <h2 className="text-3xl font-bold text-white">Are you sure?</h2>

            <p className="mt-4 mb-8 text-neutral-400">
            Do you want to cancel the selected booking?
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
            <button
                onClick={() => setShowCancelConfirm(false)}
                className="rounded-2xl border border-white/10 p-4 font-bold text-white"
            >
                No
            </button>

            <button
                onClick={async () => {
                setShowCancelConfirm(false)
                await cancelSelectedItems()
                setCancelDone(true)
                }}
                className="rounded-2xl bg-red-500 p-4 font-bold text-white"
            >
                Yes
            </button>
            </div>
        </div>
        </div>
    )}

    {cancelDone && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
        <div className="w-full max-w-md rounded-3xl border border-emerald-500/30 bg-neutral-900 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl font-bold text-black">
            ✓
            </div>

            <h2 className="text-3xl font-bold text-white">Booking cancelled</h2>

            <p className="mt-4 mb-8 text-neutral-400">
            Your booking has been cancelled successfully.
            </p>

            <button
            onClick={() => {
                setCancelDone(false)

                setTimeout(() => {
                    document.getElementById('booking-details')?.scrollIntoView({
                    behavior: 'smooth',
                    block: 'start',
                    })
                }, 100)
                }}
            className="mt-8 w-full rounded-2xl bg-emerald-500 p-4 font-bold text-black"
            >
            Finish
            </button>
        </div>
        </div>
    )}
    <main className="min-h-screen bg-neutral-950 text-white">
      <section className="mx-auto max-w-6xl px-5 py-10 md:py-16">
        <div className="mx-auto mb-10 max-w-4xl rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 to-neutral-950 p-8 md:p-10">
          <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-red-400">
            Booking Management
          </p>

          <h1 className="text-4xl font-bold leading-tight md:text-6xl">
            Cancel Your Booking
          </h1>

          <p className="mt-5 max-w-2xl text-neutral-400">
            Search your booking and
            select the item(s) you want
            to cancel.
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5 md:p-6">
          <div className="space-y-4">
            <input
              type="text"
              placeholder="Booking code"
              value={bookingCode}
              onChange={(e) =>
                setBookingCode(
                  e.target.value
                )
              }
              className="w-full rounded-2xl border border-white/10 bg-neutral-950 p-4 outline-none transition focus:border-red-500"
            />

            <input
              type="text"
              placeholder="Phone number"
              value={phone}
              onChange={(e) =>
                setPhone(e.target.value)
              }
              className="w-full rounded-2xl border border-white/10 bg-neutral-950 p-4 outline-none transition focus:border-red-500"
            />

            <button
              onClick={() => searchBooking()}
              disabled={
                loading ||
                !bookingCode ||
                !phone
              }
              className="w-full rounded-2xl bg-white p-4 font-bold text-black transition hover:scale-[1.01] hover:bg-neutral-200 disabled:cursor-not-allowed disabled:bg-neutral-600"
            >
              {loading
                ? 'Loading...'
                : 'Search Booking'}
            </button>
          </div>
        </div>

        {cancelSuccess && (
          <div className="mt-6 rounded-3xl border border-red-500/30 bg-red-500/10 p-6">
            <h2 className="text-2xl font-bold text-red-300">
              Booking Cancelled Successfully
            </h2>

            <p className="mt-2 text-neutral-300">
              Selected booking item(s)
              have been cancelled.
            </p>
          </div>
        )}

        {booking && (
          <div
            id="booking-details"
            className="mt-6 rounded-3xl border border-white/10 bg-neutral-900 p-5 md:p-6"
            >
            <div className="mb-6">
              <h2 className="text-3xl font-bold">
                Booking Details
              </h2>

              <p className="mt-3 text-neutral-400">
                Booking Code:{' '}
                {booking.booking_code}
              </p>

              <p className="text-neutral-400">
                Total Amount:{' '}
                {booking.total_amount} THB
              </p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={selectAllItems}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-semibold transition hover:bg-white hover:text-black"
              >
                Select All
              </button>

              <button
                onClick={clearSelection}
                className="rounded-2xl border border-white/10 bg-white/10 px-5 py-3 font-semibold transition hover:bg-white hover:text-black"
              >
                Clear Selection
              </button>

             
            </div>

            <div className="mt-6 space-y-4">
              {booking.booking_items?.map(
                (item) => {
                  const canCancel =
                    item.status !==
                      'cancelled' &&
                    canCancelBooking(
                      item.booking_date,
                      item.start_time
                    )

                  return (
                    <div
                      key={item.id}
                      className="rounded-3xl border border-white/10 bg-black p-5 md:p-6"
                    >
                      <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                        <div className="w-full">
                          <div className="mb-4 flex items-start justify-between gap-4">
                            <div className="flex items-center gap-4">
                                <input
                                type="checkbox"
                                checked={selectedItems.includes(
                                    item.id
                                )}
                                disabled={
                                    !canCancel
                                }
                                onChange={() =>
                                    toggleSelectItem(
                                    item.id
                                    )
                                }
                                className="h-5 w-5"
                                />

                                <h3 className="text-2xl font-bold">
                                {
                                    firstRelation(item.courts)
                                    ?.name
                                }
                                </h3>
                            </div>

                            {item.status === 'cancelled' ? (
                                <p className="text-sm font-bold text-neutral-400">
                                Cancelled
                                </p>
                            ) : !canCancel ? (
                                <p className="text-sm font-bold text-red-400">
                                Cannot Cancel
                                </p>
                            ) : null}
                            </div>

                          <p className="text-neutral-400">
                            Date:{' '}
                            {
                              item.booking_date
                            }
                          </p>

                          <p className="text-neutral-400">
                            Time:{' '}
                            {
                              item.start_time
                            }{' '}
                            -{' '}
                            {item.end_time}
                          </p>

                          <p className="mt-3 text-xl font-bold">
                            {item.price} THB
                          </p>

                          <div className="mt-3 flex items-center justify-between gap-4">
                            {item.status === 'cancelled' ? (
                                <span className="text-sm font-semibold text-red-300">
                                Cancelled
                                </span>
                            ) : (
                                <span className="text-sm font-semibold text-emerald-300">
                                Active
                                </span>
                            )}


                            </div>

                          {!canCancel &&
                            item.status !==
                              'cancelled' && (
                              <p className="mt-4 rounded-2xl border border-yellow-500/20 bg-yellow-500/10 p-4 text-sm text-yellow-300">
                                Cannot cancel
                                within 2 hours
                                before booking
                                time.
                              </p>
                            )}
                        </div>

                        
                      </div>
                    </div>
                  )
                }
              )}
              <button
                onClick={() => {
                setShowCancelConfirm(true)

                setTimeout(() => {
                    document
                    .getElementById('cancel-confirm-popup')
                    ?.scrollIntoView({
                        behavior: 'smooth',
                        block: 'center',
                    })
                }, 100)
                }}
                disabled={loading || selectedItems.length === 0}
                className={`mt-8 w-full rounded-2xl px-5 py-3 font-bold transition ${
                    loading || selectedItems.length === 0
                        ? 'cursor-not-allowed border border-white/10 bg-neutral-700 text-neutral-400'
                        : 'bg-red-500 text-white hover:scale-[1.03] hover:bg-red-600'
                    }`}
                >
                Cancel Selected
                </button>
            </div>
          </div>
        )}
      </section>
    </main>
    </>
  )
}
