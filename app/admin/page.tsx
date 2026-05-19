'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'

type Customer = {
  full_name: string | null
  phone: string | null
  email: string | null
}

type MaybeArray<T> = T | T[]

type BookingItem = {
  id?: number
  booking_date: string
  start_time: string
  end_time: string
  price: number
  status: string
  courts: MaybeArray<{
    name: string | null
  }> | null
}

type Booking = {
  booking_code: string
  total_amount: number
  status: string
  payment_status: string
  slip_url: string | null
  created_at: string
  customers: MaybeArray<Customer> | null
  booking_items: BookingItem[] | null
}

type BookingFilter = {
  day: number
  month: number
  year: number
  status: string
  search: string
}

type PendingAction = {
  bookingCode: string
  label: string
  status: string
  paymentStatus?: string
  tone: 'green' | 'blue' | 'red'
} | null

type ToastTone = 'success' | 'error' | 'info'

type ToastState = {
  message: string
  tone: ToastTone
} | null

function getTodayParts() {
  const today = new Date()

  return {
    day: today.getDate(),
    month: today.getMonth() + 1,
    year: today.getFullYear(),
  }
}

function formatDate(year: number, month: number, day: number) {
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`
}

function firstRelation<T>(relation: MaybeArray<T> | null | undefined) {
  if (Array.isArray(relation)) {
    return relation[0] ?? null
  }

  return relation ?? null
}

export default function AdminPage() {
  const router = useRouter()
  const initialToday = useMemo(() => getTodayParts(), [])

  const [bookings, setBookings] = useState<Booking[]>([])
  const [loading, setLoading] = useState(false)

  const [filterStatus, setFilterStatus] = useState('')
  const [searchText, setSearchText] = useState('')
  const [filterDay, setFilterDay] = useState(initialToday.day)
  const [filterMonth, setFilterMonth] = useState(initialToday.month)
  const [filterYear, setFilterYear] = useState(initialToday.year)
  const [pendingAction, setPendingAction] = useState<PendingAction>(null)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [toast, setToast] = useState<ToastState>(null)

  const currentFilter = useMemo<BookingFilter>(
    () => ({
      day: filterDay,
      month: filterMonth,
      year: filterYear,
      status: filterStatus,
      search: searchText,
    }),
    [filterDay, filterMonth, filterYear, filterStatus, searchText]
  )

  const initialFilter = useMemo<BookingFilter>(
    () => ({
      day: initialToday.day,
      month: initialToday.month,
      year: initialToday.year,
      status: '',
      search: '',
    }),
    [initialToday]
  )

  const showToast = useCallback((message: string, tone: ToastTone = 'info') => {
    setToast({ message, tone })
    setTimeout(() => {
      setToast(null)
    }, 3000)
  }, [])

  const fetchBookings = useCallback(async (filter: BookingFilter) => {
    setLoading(true)

    const { data, error } = await supabase
      .from('bookings')
      .select(`
        booking_code,
        total_amount,
        status,
        payment_status,
        slip_url,
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
      .order('created_at', { ascending: false })

    if (error) {
      console.error(error)
      showToast('Failed to load bookings', 'error')
      setLoading(false)
      return
    }

    const selectedFilterDate = formatDate(filter.year, filter.month, filter.day)
    const search = filter.search.toLowerCase().trim()
    const filteredData = ((data || []) as unknown as Booking[]).filter((booking) => {
      const customer = firstRelation(booking.customers)
      const matchesDate = booking.booking_items?.some(
        (item) => item.booking_date === selectedFilterDate
      ) ?? false

      const matchesStatus = filter.status
        ? booking.status === filter.status
        : true

      const matchesSearch = search
        ? booking.booking_code.toLowerCase().includes(search) ||
          customer?.phone?.toLowerCase().includes(search) ||
          customer?.full_name?.toLowerCase().includes(search)
        : true

      return matchesDate && matchesStatus && matchesSearch
    })

    setBookings(filteredData)
    setLoading(false)
  }, [showToast])

  useEffect(() => {
    async function checkAuth() {
      const {
        data: { session },
      } = await supabase.auth.getSession()

      if (!session) {
        router.push('/admin/login')
      }
    }

    checkAuth()
  }, [router])

  useEffect(() => {
    void Promise.resolve().then(() => fetchBookings(initialFilter))
  }, [fetchBookings, initialFilter])

  async function updateBookingStatus(
    bookingCode: string,
    newStatus: string,
    newPaymentStatus?: string
    ) {
    setUpdatingStatus(true)

    const updateData: {
      status: string
      payment_status?: string
    } = {
        status: newStatus,
    }

    if (newPaymentStatus) {
        updateData.payment_status = newPaymentStatus
    }

    const { data: bookingRecord, error: findError } = await supabase
        .from('bookings')
        .select(`
          id,
          booking_items (
            id,
            price,
            status
          )
        `)
        .eq('booking_code', bookingCode)
        .single()

    if (findError) {
        console.error(findError)
        showToast('Booking not found', 'error')
        setUpdatingStatus(false)
        return
    }

    const { error: itemError } = await supabase
        .from('booking_items')
        .update({
        status: newStatus,
        })
        .eq('booking_id', bookingRecord.id)

    if (itemError) {
        console.error(itemError)
        showToast('Update booking item failed', 'error')
        setUpdatingStatus(false)
        return
    }

    const bookingItems =
      (bookingRecord.booking_items || []) as Array<{
        id: number
        price: number
        status: string
      }>

    const nextItems = bookingItems.map((item) => ({
      ...item,
      status: newStatus,
    }))

    const activeTotal =
      newStatus === 'cancelled'
        ? 0
        : nextItems.reduce(
            (sum, item) =>
              item.status === 'cancelled' ? sum : sum + Number(item.price),
            0
          )

    const { error: bookingError } = await supabase
        .from('bookings')
        .update({
          ...updateData,
          total_amount: activeTotal,
        })
        .eq('booking_code', bookingCode)

    if (bookingError) {
        console.error(bookingError)
        showToast('Update booking failed', 'error')
        setUpdatingStatus(false)
        return
    }

    await fetchBookings(currentFilter)
    setUpdatingStatus(false)
    setPendingAction(null)
    showToast('Booking updated successfully', 'success')
  }



  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
  }

  function clearFilters() {
    const today = getTodayParts()
    const nextFilter = {
      day: today.day,
      month: today.month,
      year: today.year,
      status: '',
      search: '',
    }

    setFilterDay(nextFilter.day)
    setFilterMonth(nextFilter.month)
    setFilterYear(nextFilter.year)
    setFilterStatus('')
    setSearchText('')
    fetchBookings(nextFilter)
  }

  function getStatusStyle(status: string) {
    if (status === 'paid') {
      return 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
    }

    if (status === 'completed') {
      return 'bg-blue-500/10 text-blue-400 border-blue-500/30'
    }

    if (status === 'cancelled') {
      return 'bg-red-500/10 text-red-400 border-red-500/30'
    }

    return 'bg-yellow-500/10 text-yellow-400 border-yellow-500/30'
  }

  

  return (
    <>
    {toast && (
      <div
        className={`fixed top-5 left-1/2 z-[60] w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border bg-neutral-900 px-5 py-4 text-center font-semibold shadow-2xl ${
          toast.tone === 'success'
            ? 'border-emerald-500/30 text-emerald-300'
            : toast.tone === 'error'
            ? 'border-red-500/30 text-red-300'
            : 'border-white/10 text-white'
        }`}
      >
        {toast.message}
      </div>
    )}

    {pendingAction && (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-5">
        <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-900 p-6 shadow-2xl">
          <p className="text-sm font-semibold uppercase tracking-[0.2em] text-neutral-500">
            Confirm action
          </p>

          <h2 className="mt-3 text-3xl font-bold text-white">
            {pendingAction.label}
          </h2>

          <p className="mt-3 text-neutral-400">
            Apply this change to booking {pendingAction.bookingCode} and its booking items?
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              disabled={updatingStatus}
              className="h-12 rounded-2xl border border-white/10 font-bold text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              Back
            </button>

            <button
              type="button"
              onClick={() =>
                updateBookingStatus(
                  pendingAction.bookingCode,
                  pendingAction.status,
                  pendingAction.paymentStatus
                )
              }
              disabled={updatingStatus}
              className={`h-12 rounded-2xl font-bold transition disabled:cursor-not-allowed disabled:opacity-60 ${
                pendingAction.tone === 'green'
                  ? 'bg-emerald-500 text-black hover:bg-emerald-400'
                  : pendingAction.tone === 'blue'
                  ? 'bg-blue-500 text-white hover:bg-blue-400'
                  : 'bg-red-500 text-white hover:bg-red-400'
              }`}
            >
              {updatingStatus ? 'Updating...' : 'Confirm'}
            </button>
          </div>
        </div>
      </div>
    )}

    <main className="min-h-screen bg-neutral-950 p-6 text-white md:p-8">
      <div className="mb-8 flex items-start justify-between gap-4 md:items-center">
        <div className="min-w-0">
          <div className="mb-2">
            <p className="text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
              Court Management
            </p>
          </div>

          <h1 className="text-3xl font-bold leading-tight sm:text-4xl md:text-5xl">
            Admin Dashboard
          </h1>
        </div>

        <button
          onClick={handleLogout}
          className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-red-500 px-5 text-sm font-semibold text-white transition hover:bg-red-400 md:h-14 md:w-[220px] md:rounded-2xl md:text-base"
        >
          Logout
        </button>
      </div>

      <section className="mb-8 rounded-3xl border border-white/10 bg-neutral-900 p-5">
        <h2 className="mb-4 text-xl font-bold">Filters</h2>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="min-w-0">
            <label className="mb-2 block text-sm text-neutral-400">
              Showing bookings
            </label>

            <div className="flex h-[58px] w-full items-center rounded-2xl border border-white/10 bg-neutral-950 px-4">
              <span className="text-2xl font-bold text-white">
                {bookings.length}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm text-neutral-400">
              Filter by date
            </label>

            <div className="grid grid-cols-3 gap-2">
                <select
                    value={filterDay}
                    onChange={(e) => setFilterDay(Number(e.target.value))}
                    className="h-[58px] min-w-0 rounded-2xl border border-white/10 bg-neutral-950 px-3"
                >
                    {Array.from({ length: 31 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                        {i + 1}
                    </option>
                    ))}
                </select>

                <select
                    value={filterMonth}
                    onChange={(e) => setFilterMonth(Number(e.target.value))}
                    className="h-[58px] min-w-0 rounded-2xl border border-white/10 bg-neutral-950 px-3"
                >
                    {Array.from({ length: 12 }, (_, i) => (
                    <option key={i + 1} value={i + 1}>
                        {i + 1}
                    </option>
                    ))}
                </select>

                <select
                    value={filterYear}
                    onChange={(e) => setFilterYear(Number(e.target.value))}
                    className="h-[58px] min-w-0 rounded-2xl border border-white/10 bg-neutral-950 px-3"
                >
                    {[2025, 2026, 2027].map((year) => (
                    <option key={year} value={year}>
                        {year}
                    </option>
                    ))}
                </select>
                </div>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm text-neutral-400">
              Filter by status
            </label>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-[58px] w-full rounded-2xl border border-white/10 bg-neutral-950 px-4"
            >
              <option value="">All status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm text-neutral-400">
              Search booking / phone / name
            </label>

            <input
              type="text"
              placeholder="BK-... / phone / name"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-[58px] w-full rounded-2xl border border-white/10 bg-neutral-950 px-4"
            />
          </div>

          <div className="min-w-0">
            <span className="mb-2 block text-sm text-transparent">
              Actions
            </span>

            <div className="flex gap-3">
            <button
              onClick={() => fetchBookings(currentFilter)}
              className="h-[58px] flex-1 rounded-2xl bg-white px-4 font-bold text-black transition hover:bg-neutral-200"
            >
              Apply
            </button>

            <button
              onClick={clearFilters}
              className="h-[58px] flex-1 rounded-2xl border border-white/10 px-4 font-bold transition hover:border-red-400 hover:text-red-400"
            >
              Clear
            </button>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-neutral-900 p-4 text-neutral-300">
          Loading bookings...
        </div>
      )}

      <div className="grid gap-4">
        {bookings.map((booking) => (
          <div
            key={booking.booking_code}
            className="rounded-3xl border border-white/10 bg-neutral-900 p-5 shadow-xl"
          >
            {(() => {
              const customer = firstRelation(booking.customers)
              const canMarkPaid =
                booking.payment_status !== 'paid' &&
                booking.status !== 'cancelled'

              return (
                <>
            <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {booking.booking_code}
                </h2>

                <p className="mt-1 text-sm text-neutral-400">
                  Created at: {new Date(booking.created_at).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-semibold ${getStatusStyle(
                    booking.status
                  )}`}
                >
                  {booking.status}
                </span>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold">
                  Payment: {booking.payment_status}
                </span>
              </div>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-neutral-950 p-4">
                <p className="mb-2 font-bold">Customer</p>
                <p>Name: {customer?.full_name || '-'}</p>
                <p>Phone: {customer?.phone || '-'}</p>
                <p>Email: {customer?.email || '-'}</p>
              </div>

              <div className="rounded-2xl bg-neutral-950 p-4 md:col-span-2">
                <p className="mb-2 font-bold">Booking details</p>

                {booking.booking_items?.map((item, index) => (
                  <div
                    key={index}
                    className="mb-3 grid gap-3 rounded-2xl border border-white/10 bg-black/40 p-3 text-sm last:mb-0 sm:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <div>
                      <p className="text-neutral-500">Court</p>
                      <p className="font-semibold text-white">
                        {firstRelation(item.courts)?.name || '-'}
                      </p>
                    </div>

                    <div>
                      <p className="text-neutral-500">Date</p>
                      <p className="font-semibold text-white">{item.booking_date}</p>
                    </div>

                    <div>
                      <p className="text-neutral-500">Time</p>
                      <p className="font-semibold text-white">
                        {item.start_time} - {item.end_time}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-neutral-500">{item.price} THB</p>
                      <p
                        className={
                          item.status === 'cancelled'
                            ? 'font-semibold text-red-400'
                            : 'font-semibold text-emerald-400'
                        }
                      >
                        {item.status}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 pt-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="space-y-3">
                  <p className="text-xl font-bold">
                    Total: {booking.total_amount} THB
                  </p>

                  {booking.slip_url ? (
                    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950 p-4 sm:w-fit sm:min-w-[300px]">
                      <div>
                        <p className="font-bold text-white">Payment Slip</p>
                        <p className="mt-1 text-sm text-neutral-500">
                          Uploaded
                        </p>
                      </div>

                      <a
                        href={booking.slip_url}
                        target="_blank"
                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-black transition hover:bg-neutral-200 sm:h-11 sm:px-5 sm:text-base"
                      >
                        View Slip
                      </a>
                    </div>
                  ) : (
                    <div className="w-full rounded-2xl border border-white/10 bg-neutral-950 p-4 text-neutral-400 sm:w-fit sm:min-w-[260px]">
                      No payment slip uploaded
                    </div>
                  )}
                </div>

              <div className="rounded-2xl border border-white/10 bg-neutral-950 p-3">
                <p className="mb-3 text-sm font-semibold text-neutral-400 lg:hidden">
                  Admin actions
                </p>

                <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap lg:justify-end">
                {canMarkPaid && (
                <button
                    onClick={() =>
                      setPendingAction({
                        bookingCode: booking.booking_code,
                        label: 'Mark as paid',
                        status: 'paid',
                        paymentStatus: 'paid',
                        tone: 'green',
                      })
                    }
                    className="col-span-2 h-11 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400 sm:col-span-1 sm:min-w-[150px] sm:px-5 sm:text-base"
                >
                    Mark as Paid
                </button>
                )}

                <button
                  onClick={() =>
                    setPendingAction({
                      bookingCode: booking.booking_code,
                      label: 'Complete booking',
                      status: 'completed',
                      tone: 'blue',
                    })
                  }
                  className="h-11 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition hover:bg-blue-400 sm:min-w-[150px] sm:px-5 sm:text-base"
                >
                  Complete
                </button>

                <button
                  onClick={() =>
                    setPendingAction({
                      bookingCode: booking.booking_code,
                      label: 'Cancel booking',
                      status: 'cancelled',
                      tone: 'red',
                    })
                  }
                  className="h-11 rounded-xl border border-red-500/50 bg-red-500/10 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500 hover:text-white sm:min-w-[150px] sm:px-5 sm:text-base"
                >
                  Cancel
                </button>
              </div>
              </div>
              </div>
            </div>
                </>
              )
            })()}
          </div>
        ))}

        {!loading && bookings.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-neutral-900 p-10 text-center text-neutral-400">
            No bookings found.
          </div>
        )}
      </div>
    </main>
    </>
  )
}
