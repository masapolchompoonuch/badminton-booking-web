'use client'

import { useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'

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
    useState<any>(null)

  const [loading, setLoading] =
    useState(false)

  const [selectedItems, setSelectedItems] =
    useState<number[]>([])

  const [cancelSuccess, setCancelSuccess] =
    useState(false)

  async function searchBooking() {
    setLoading(true)
    setBooking(null)
    setSelectedItems([])
    setCancelSuccess(false)

    const { data, error } = await supabase
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

    if (error || !data) {
      alert('Booking not found')
      return
    }

    const customerPhone = Array.isArray(
      data.customers
    )
      ? data.customers[0]?.phone
      : (data.customers as any)?.phone

    if (customerPhone !== phone) {
      alert('Phone number does not match')
      return
    }

    setBooking(data)
  }

  const cancellableItems = useMemo(() => {
    if (!booking?.booking_items) return []

    return booking.booking_items.filter(
      (item: any) =>
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
      (item: any) => item.id
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

    const confirmCancel = confirm(
      'Are you sure you want to cancel selected booking item(s)?'
    )

    if (!confirmCancel) return

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
      booking.booking_items.map((item: any) =>
        selectedItems.includes(item.id)
          ? {
              ...item,
              status: 'cancelled',
            }
          : item
      )

    const activeItems = updatedItems.filter(
      (item: any) =>
        item.status !== 'cancelled'
    )

    const newTotalAmount =
      activeItems.reduce(
        (sum: number, item: any) =>
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

    await searchBooking()
  }

  return (
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
              onClick={searchBooking}
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
          <div className="mt-6 rounded-3xl border border-white/10 bg-neutral-900 p-5 md:p-6">
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

            <div className="flex flex-col gap-3 sm:flex-row">
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

              <button
                onClick={cancelSelectedItems}
                disabled={
                  loading ||
                  selectedItems.length === 0
                }
                className="rounded-2xl bg-red-500 px-5 py-3 font-bold text-white transition hover:scale-[1.03] hover:bg-red-400 disabled:cursor-not-allowed disabled:bg-neutral-600"
              >
                Cancel Selected
              </button>
            </div>

            <div className="mt-6 space-y-4">
              {booking.booking_items?.map(
                (item: any) => {
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
                                    item.courts
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
            </div>
          </div>
        )}
      </section>
    </main>
  )
}