'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'


export default function AdminPage() {
    const router = useRouter()
  const [bookings, setBookings] = useState<any[]>([])
  const [loading, setLoading] = useState(false)


  const [filterDate, setFilterDate] = useState('')
  const [filterStatus, setFilterStatus] = useState('')
  const [searchText, setSearchText] = useState('')

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
    }, [])

  useEffect(() => {
    fetchBookings()
    }, [])

  async function fetchBookings() {
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

    const filteredData = (data || []).filter((booking: any) => {
      const matchesDate = filterDate
        ? booking.booking_items?.some(
            (item: any) => item.booking_date === filterDate
          )
        : true

      const matchesStatus = filterStatus
        ? booking.status === filterStatus
        : true

      const search = searchText.toLowerCase().trim()

      const matchesSearch = search
        ? booking.booking_code?.toLowerCase().includes(search) ||
          booking.customers?.phone?.toLowerCase().includes(search) ||
          booking.customers?.full_name?.toLowerCase().includes(search)
        : true

      return matchesDate && matchesStatus && matchesSearch
    })

    setBookings(filteredData)
    setLoading(false)
  }

  async function updateBookingStatus(
    bookingCode: string,
    newStatus: string,
    newPaymentStatus?: string
    ) {
    const updateData: any = {
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

    await fetchBookings()
    }



  async function handleLogout() {
    await supabase.auth.signOut()
    router.push('/admin/login')
    }

  function clearFilters() {
    setFilterDate('')
    setFilterStatus('')
    setSearchText('')

    setTimeout(() => {
      fetchBookings()
    }, 0)
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
      <div className="mb-8 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
            <p className="mb-2 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
                Court Management
            </p>

            <h1 className="text-4xl font-bold md:text-5xl">
                Admin Dashboard
            </h1>
        </div>

        <button
            onClick={handleLogout}
            style={{
                width: '220px',
                height: '56px',
                borderRadius: '16px',
            }}
            className="bg-red-500 font-semibold text-white transition hover:bg-red-400"
            >
            Logout
        </button>
        </div>

      <div className="mb-6 grid gap-4 md:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
          <p className="text-sm text-neutral-400">Showing bookings</p>
          <p className="mt-2 text-3xl font-bold">{bookings.length}</p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
          <p className="text-sm text-neutral-400">Date filter</p>
          <p className="mt-2 text-lg font-semibold">
            {filterDate || 'All dates'}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
          <p className="text-sm text-neutral-400">Status filter</p>
          <p className="mt-2 text-lg font-semibold">
            {filterStatus || 'All status'}
          </p>
        </div>

        <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5">
          <p className="text-sm text-neutral-400">Search</p>
          <p className="mt-2 truncate text-lg font-semibold">
            {searchText || 'None'}
          </p>
        </div>
      </div>

      <section className="mb-8 rounded-3xl border border-white/10 bg-neutral-900 p-5">
        <h2 className="mb-4 text-xl font-bold">Filters</h2>

        <div className="grid gap-4 md:grid-cols-4">
          <div>
            <label className="mb-2 block text-sm text-neutral-400">
              Filter by date
            </label>

            <input
              type="date"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-neutral-950 p-4"
            />
          </div>

          <div>
            <label className="mb-2 block text-sm text-neutral-400">
              Filter by status
            </label>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-neutral-950 p-4"
            >
              <option value="">All status</option>
              <option value="pending">Pending</option>
              <option value="paid">Paid</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          <div>
            <label className="mb-2 block text-sm text-neutral-400">
              Search booking / phone / name
            </label>

            <input
              type="text"
              placeholder="BK-... / phone / name"
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="w-full rounded-2xl border border-white/10 bg-neutral-950 p-4"
            />
          </div>

          <div className="flex gap-3 md:items-end">
            <button
              onClick={fetchBookings}
              className="flex-1 rounded-2xl bg-white p-4 font-bold text-black transition hover:bg-neutral-200"
            >
              Apply
            </button>

            <button
              onClick={clearFilters}
              className="flex-1 rounded-2xl border border-white/10 p-4 font-bold transition hover:border-red-400 hover:text-red-400"
            >
              Clear
            </button>
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
                <p>Name: {booking.customers?.full_name || '-'}</p>
                <p>Phone: {booking.customers?.phone || '-'}</p>
                <p>Email: {booking.customers?.email || '-'}</p>
              </div>

              <div className="rounded-2xl bg-neutral-950 p-4 md:col-span-2">
                <p className="mb-2 font-bold">Booking details</p>

                {booking.booking_items?.map((item: any, index: number) => (
                  <div key={index} className="mb-3 last:mb-0">
                    <p>Court: {item.courts?.name || '-'}</p>
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

            <div className="mt-4 border-t border-white/10 pt-4">
              <div className="space-y-4">
                <p className="text-lg font-bold">
                    Total: {booking.total_amount} THB
                </p>

                {booking.slip_url ? (
                    <div className="w-fit rounded-2xl border border-white/10 bg-neutral-950 p-4">
                    <p className="mb-3 font-bold text-white">Payment Slip</p>

                    <a
                        href={booking.slip_url}
                        target="_blank"
                        className="inline-block rounded-xl bg-white px-4 py-2 font-bold text-black transition hover:bg-neutral-200"
                    >
                        View Slip
                    </a>
                    </div>
                ) : (
                    <div className="w-fit rounded-2xl border border-white/10 bg-neutral-950 p-4 text-neutral-400">
                    No payment slip uploaded
                    </div>
                )}
                </div>

              <div className="mt-6 flex flex-col gap-3 sm:flex-row">
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
                    className="w-full rounded-xl bg-emerald-500 px-4 py-2 font-semibold text-black transition hover:bg-emerald-400"
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
                  className="w-full rounded-xl bg-blue-500 px-4 py-2 font-semibold text-white transition hover:bg-blue-400"
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
                  className="w-full rounded-xl bg-red-500 px-4 py-2 font-semibold text-white transition hover:bg-red-400"
                >
                  Cancel
                </button>
              </div>
            </div>
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