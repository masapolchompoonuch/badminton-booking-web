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
      alert('Failed to load bookings')
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
  }, [])

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
        .select('id')
        .eq('booking_code', bookingCode)
        .single()

    if (findError) {
        console.error(findError)
        alert('Booking not found')
        return
    }

    const { error: bookingError } = await supabase
        .from('bookings')
        .update(updateData)
        .eq('booking_code', bookingCode)

    if (bookingError) {
        console.error(bookingError)
        alert('Update booking failed')
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
        alert('Update booking item failed')
        return
    }

    await fetchBookings(currentFilter)
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
                  <div key={index} className="mb-3 last:mb-0">
                    <p>Court: {firstRelation(item.courts)?.name || '-'}</p>
                    <p>Date: {item.booking_date}</p>
                    <p>
                      Time: {item.start_time} - {item.end_time}
                    </p>
                    <p>Price: {item.price} THB</p>
                    <p>
                    Status:{' '}
                    <span
                        className={
                        item.status === 'cancelled'
                            ? 'text-red-400 font-semibold'
                            : 'text-emerald-400 font-semibold'
                        }
                    >
                        {item.status}
                    </span>
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 pt-5">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                <div className="space-y-3">
                  <p className="text-lg font-bold">
                    Total: {booking.total_amount} THB
                  </p>

                  {booking.slip_url ? (
                    <div className="flex w-full flex-col gap-3 rounded-2xl border border-white/10 bg-neutral-950 p-4 sm:w-fit sm:min-w-[260px] sm:flex-row sm:items-center sm:justify-between">
                      <div>
                        <p className="font-bold text-white">Payment Slip</p>
                        <p className="mt-1 text-sm text-neutral-500">
                          Uploaded
                        </p>
                      </div>

                      <a
                        href={booking.slip_url}
                        target="_blank"
                        className="inline-flex h-11 items-center justify-center rounded-xl bg-white px-5 font-bold text-black transition hover:bg-neutral-200"
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

              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap lg:justify-end">
                {booking.payment_status !== 'paid' &&
                booking.status !== 'cancelled' && (
                <button
                    onClick={() =>
                    updateBookingStatus(
                        booking.booking_code,
                        'paid',
                        'paid'
                    )
                    }
                    className="h-11 rounded-xl bg-emerald-500 px-5 font-semibold text-black transition hover:bg-emerald-400 sm:min-w-[150px]"
                >
                    Mark as Paid
                </button>
                )}

                <button
                  onClick={() =>
                    updateBookingStatus(
                      booking.booking_code,
                      'completed'
                    )
                  }
                  className="h-11 rounded-xl bg-blue-500 px-5 font-semibold text-white transition hover:bg-blue-400 sm:min-w-[150px]"
                >
                  Complete
                </button>

                <button
                  onClick={() =>
                    updateBookingStatus(
                      booking.booking_code,
                      'cancelled'
                    )
                  }
                  className="h-11 rounded-xl bg-red-500 px-5 font-semibold text-white transition hover:bg-red-400 sm:min-w-[150px]"
                >
                  Cancel
                </button>
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
  )
}
