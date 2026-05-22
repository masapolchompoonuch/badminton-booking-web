'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { useRouter } from 'next/navigation'
import { LanguageToggle } from '../language-toggle'
import { useI18n } from '../language-provider'

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
  itemId?: number
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

function getScheduleSummary(items: BookingItem[]) {
  if (items.length === 0) return '-'

  const dates = Array.from(new Set(items.map((item) => item.booking_date))).sort()

  if (dates.length === 1) {
    return dates[0]
  }

  return `${dates[0]} - ${dates[dates.length - 1]}`
}

export default function AdminPage() {
  const { locale, t } = useI18n()
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
  const [expandedBookings, setExpandedBookings] = useState<string[]>([])
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null)

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
      showToast(t.admin.loadFailed, 'error')
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
    setLastRefreshedAt(new Date())
    setLoading(false)
  }, [showToast, t.admin.loadFailed])

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

  useEffect(() => {
    const interval = window.setInterval(() => {
      void fetchBookings(currentFilter)
    }, 60000)

    return () => window.clearInterval(interval)
  }, [fetchBookings, currentFilter])

  const dashboardStats = useMemo(() => {
    return bookings.reduce(
      (stats, booking) => {
        if (booking.status === 'pending') stats.pending += 1
        if (booking.status === 'paid') stats.paid += 1
        if (booking.status === 'cancelled') stats.cancelled += 1
        if (booking.status !== 'cancelled') {
          stats.revenue += Number(booking.total_amount)
        }

        return stats
      },
      {
        pending: 0,
        paid: 0,
        cancelled: 0,
        revenue: 0,
      }
    )
  }, [bookings])

  async function updateBookingStatus(
    bookingCode: string,
    newStatus: string,
    newPaymentStatus?: string,
    itemId?: number
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
          status,
          payment_status,
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
        showToast(t.admin.bookingNotFound, 'error')
        setUpdatingStatus(false)
        return
    }

    let itemUpdateQuery = supabase
      .from('booking_items')
      .update({
        status: newStatus,
      })
      .eq('booking_id', bookingRecord.id)

    if (itemId) {
      itemUpdateQuery = itemUpdateQuery.eq('id', itemId)
    }

    const { error: itemError } = await itemUpdateQuery

    if (itemError) {
        console.error(itemError)
        showToast(t.admin.itemUpdateFailed, 'error')
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
      status: itemId && item.id !== itemId ? item.status : newStatus,
    }))

    const activeItems = nextItems.filter((item) => item.status !== 'cancelled')

    const nextBookingStatus = itemId
      ? activeItems.length === 0
        ? 'cancelled'
        : activeItems.every((item) => item.status === 'completed')
        ? 'completed'
        : bookingRecord.status
      : newStatus

    const activeTotal =
      activeItems.length === 0
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
          status: nextBookingStatus,
          total_amount: activeTotal,
        })
        .eq('booking_code', bookingCode)

    if (bookingError) {
        console.error(bookingError)
        showToast(t.admin.bookingUpdateFailed, 'error')
        setUpdatingStatus(false)
        return
    }

    await fetchBookings(currentFilter)
    setUpdatingStatus(false)
    setPendingAction(null)
    showToast(t.admin.bookingUpdated, 'success')
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

  function getStatusLabel(status: string) {
    if (status === 'paid') return t.admin.statusPaid
    if (status === 'completed') return t.admin.statusCompleted
    if (status === 'cancelled') return t.admin.statusCancelled
    return t.admin.statusPending
  }

  function getPaymentStatusLabel(status: string) {
    if (status === 'paid') return t.admin.paymentPaid
    return t.admin.paymentUnpaid
  }

  function toggleBookingDetails(bookingCode: string) {
    setExpandedBookings((prev) =>
      prev.includes(bookingCode)
        ? prev.filter((code) => code !== bookingCode)
        : [...prev, bookingCode]
    )
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
            {t.admin.confirmAction}
          </p>

          <h2 className="mt-3 text-3xl font-bold text-white">
            {pendingAction.label}
          </h2>

          <p className="mt-3 text-neutral-400">
            {pendingAction.itemId
              ? t.admin.confirmSlotAction(pendingAction.bookingCode)
              : t.admin.confirmBookingAction(pendingAction.bookingCode)}
          </p>

          <div className="mt-6 grid grid-cols-2 gap-3">
            <button
              type="button"
              onClick={() => setPendingAction(null)}
              disabled={updatingStatus}
              className="h-12 rounded-2xl border border-white/10 font-bold text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {t.common.back}
            </button>

            <button
              type="button"
              onClick={() =>
                updateBookingStatus(
                  pendingAction.bookingCode,
                  pendingAction.status,
                  pendingAction.paymentStatus,
                  pendingAction.itemId
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
              {updatingStatus ? t.admin.updating : t.common.confirm}
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
              {t.admin.eyebrow}
            </p>
          </div>

          <h1
            className={`font-bold leading-tight md:text-5xl ${
              locale === 'th'
                ? 'text-[2rem] sm:text-4xl'
                : 'max-w-[180px] text-3xl sm:max-w-none sm:text-4xl'
            }`}
          >
            {locale === 'th' ? (
              <>
                <span className="block whitespace-nowrap md:hidden">แดชบอร์ด</span>
                <span className="block whitespace-nowrap md:hidden">แอดมิน</span>
                <span className="hidden whitespace-nowrap md:inline">แดชบอร์ดแอดมิน</span>
              </>
            ) : (
              t.admin.title
            )}
          </h1>
        </div>

        <div className="flex shrink-0 flex-col items-end gap-3 sm:flex-row sm:items-center">
          <LanguageToggle />

          <button
            onClick={handleLogout}
            className="inline-flex h-11 shrink-0 items-center justify-center rounded-xl bg-red-500 px-5 text-sm font-semibold text-white transition hover:bg-red-400 md:h-14 md:w-[220px] md:rounded-2xl md:text-base"
          >
            {t.admin.logout}
          </button>
        </div>
      </div>

      <section className="mb-6 grid grid-cols-2 gap-3 md:mb-8 xl:grid-cols-4">
        <div className="rounded-xl border border-white/10 bg-neutral-900 p-3 md:rounded-2xl md:p-4">
          <p className="text-xs text-neutral-400 md:text-sm">{t.admin.pendingPayment}</p>
          <p className="mt-1 text-2xl font-bold text-yellow-300 md:mt-2 md:text-3xl">
            {dashboardStats.pending}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-neutral-900 p-3 md:rounded-2xl md:p-4">
          <p className="text-xs text-neutral-400 md:text-sm">{t.admin.paidBookings}</p>
          <p className="mt-1 text-2xl font-bold text-emerald-300 md:mt-2 md:text-3xl">
            {dashboardStats.paid}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-neutral-900 p-3 md:rounded-2xl md:p-4">
          <p className="text-xs text-neutral-400 md:text-sm">{t.admin.cancelled}</p>
          <p className="mt-1 text-2xl font-bold text-red-300 md:mt-2 md:text-3xl">
            {dashboardStats.cancelled}
          </p>
        </div>

        <div className="rounded-xl border border-white/10 bg-neutral-900 p-3 md:rounded-2xl md:p-4">
          <p className="text-xs text-neutral-400 md:text-sm">{t.admin.activeRevenue}</p>
          <p className="mt-1 text-xl font-bold text-white md:mt-2 md:text-3xl">
            {dashboardStats.revenue} {t.common.thb}
          </p>
        </div>
      </section>

      <section className="mb-8 rounded-3xl border border-white/10 bg-neutral-900 p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-xl font-bold">{t.admin.filters}</h2>
            <p className="mt-1 text-sm text-neutral-500">
              {lastRefreshedAt
                ? t.admin.lastRefreshed(lastRefreshedAt.toLocaleTimeString())
                : t.admin.autoRefresh}
            </p>
          </div>

          <button
            type="button"
            onClick={() => fetchBookings(currentFilter)}
            disabled={loading}
            className="h-11 rounded-xl border border-white/10 px-4 font-semibold text-white transition hover:border-emerald-400 hover:text-emerald-300 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? t.admin.refreshing : t.admin.refresh}
          </button>
        </div>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <div className="min-w-0">
            <label className="mb-2 block text-sm text-neutral-400">
              {t.admin.showingBookings}
            </label>

            <div className="flex h-[58px] w-full items-center rounded-2xl border border-white/10 bg-neutral-950 px-4">
              <span className="text-2xl font-bold text-white">
                {bookings.length}
              </span>
            </div>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm text-neutral-400">
              {t.admin.filterByDate}
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
              {t.admin.filterByStatus}
            </label>

            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="h-[58px] w-full rounded-2xl border border-white/10 bg-neutral-950 px-4"
            >
              <option value="">{t.admin.allStatus}</option>
              <option value="pending">{t.admin.statusPending}</option>
              <option value="paid">{t.admin.statusPaid}</option>
              <option value="completed">{t.admin.statusCompleted}</option>
              <option value="cancelled">{t.admin.statusCancelled}</option>
            </select>
          </div>

          <div className="min-w-0">
            <label className="mb-2 block text-sm text-neutral-400">
              {t.admin.searchLabel}
            </label>

            <input
              type="text"
              placeholder={t.admin.searchPlaceholder}
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-[58px] w-full rounded-2xl border border-white/10 bg-neutral-950 px-4"
            />
          </div>

          <div className="min-w-0">
            <span className="mb-2 block text-sm text-transparent">
              {t.admin.actions}
            </span>

            <div className="flex gap-3">
            <button
              onClick={() => fetchBookings(currentFilter)}
              className="h-[58px] flex-1 rounded-2xl bg-white px-4 font-bold text-black transition hover:bg-neutral-200"
            >
              {t.admin.apply}
            </button>

            <button
              onClick={clearFilters}
              className="h-[58px] flex-1 rounded-2xl border border-white/10 px-4 font-bold transition hover:border-red-400 hover:text-red-400"
            >
              {t.admin.clear}
            </button>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div className="mb-6 rounded-2xl border border-white/10 bg-neutral-900 p-4 text-neutral-300">
          {t.admin.loadingBookings}
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
              const items = booking.booking_items || []
              const scheduleSummary = getScheduleSummary(items)
              const isExpanded = expandedBookings.includes(booking.booking_code)
              const canMarkPaid =
                booking.payment_status !== 'paid' &&
                booking.status !== 'cancelled'
              const canComplete =
                booking.status !== 'completed' &&
                booking.status !== 'cancelled'
              const canCancel = booking.status !== 'cancelled'
              const hasActions = canMarkPaid || canComplete || canCancel

              return (
                <>
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <h2 className="text-2xl font-bold">
                  {booking.booking_code}
                </h2>

                <p className="mt-1 text-sm text-neutral-400">
                  {t.admin.createdAt}: {new Date(booking.created_at).toLocaleString()}
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <span
                  className={`rounded-full border px-3 py-1 text-sm font-semibold ${getStatusStyle(
                    booking.status
                  )}`}
                >
                  {getStatusLabel(booking.status)}
                </span>

                <span className="rounded-full border border-white/10 bg-white/5 px-3 py-1 text-sm font-semibold">
                  {t.admin.payment}: {getPaymentStatusLabel(booking.payment_status)}
                </span>

              </div>
            </div>

            <div className="mt-4 grid gap-3 rounded-2xl border border-white/10 bg-neutral-950 p-4 md:grid-cols-[1fr_auto] md:items-center">
              <div className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <p className="text-neutral-500">{t.admin.customer}</p>
                  <p className="font-semibold text-white">
                    {customer?.full_name || '-'}
                  </p>
                </div>

                <div>
                  <p className="text-neutral-500">{t.admin.items}</p>
                  <p className="font-semibold text-white">
                    {items.length} {items.length === 1 ? t.admin.slot : t.admin.slots}
                  </p>
                </div>

                <div>
                  <p className="text-neutral-500">{t.admin.schedule}</p>
                  <p className="font-semibold text-white">
                    {scheduleSummary}
                  </p>
                </div>

                <div>
                  <p className="text-neutral-500">{t.admin.total}</p>
                  <p className="font-semibold text-white">
                    {booking.total_amount} {t.common.thb}
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => toggleBookingDetails(booking.booking_code)}
                className="h-11 rounded-xl border border-white/10 px-5 font-semibold text-white transition hover:border-emerald-400 hover:text-emerald-300"
              >
                {isExpanded ? t.admin.hideDetails : t.admin.details}
              </button>
            </div>

            {isExpanded && (
              <>
            <div className="mt-4 grid gap-4 md:grid-cols-3">
              <div className="rounded-2xl bg-neutral-950 p-4">
                <p className="mb-2 font-bold">{t.admin.customerDetails}</p>
                <p>{t.admin.name}: {customer?.full_name || '-'}</p>
                <p>{t.admin.phone}: {customer?.phone || '-'}</p>
                <p>{t.admin.email}: {customer?.email || '-'}</p>
              </div>

              <div className="rounded-2xl bg-neutral-950 p-4 md:col-span-2">
                <p className="mb-2 font-bold">{t.admin.bookingDetails}</p>

                {booking.booking_items?.map((item, index) => (
                  <div
                    key={index}
                    className="mb-3 grid gap-3 rounded-2xl border border-white/10 bg-black/40 p-3 text-sm last:mb-0 sm:grid-cols-[1fr_1fr_1fr_auto]"
                  >
                    <div>
                      <p className="text-neutral-500">{t.admin.court}</p>
                      <p className="font-semibold text-white">
                        {firstRelation(item.courts)?.name || '-'}
                      </p>
                    </div>

                    <div>
                      <p className="text-neutral-500">{t.admin.date}</p>
                      <p className="font-semibold text-white">{item.booking_date}</p>
                    </div>

                    <div>
                      <p className="text-neutral-500">{t.admin.time}</p>
                      <p className="font-semibold text-white">
                        {item.start_time} - {item.end_time}
                      </p>
                    </div>

                    <div className="sm:text-right">
                      <p className="text-neutral-500">{item.price} {t.common.thb}</p>
                      <p
                        className={
                          item.status === 'cancelled'
                            ? 'font-semibold text-red-400'
                            : item.status === 'completed'
                            ? 'font-semibold text-blue-400'
                            : 'font-semibold text-emerald-400'
                        }
                      >
                        {getStatusLabel(item.status)}
                      </p>

                      {item.id &&
                        item.status !== 'completed' &&
                        item.status !== 'cancelled' && (
                          <button
                            type="button"
                            onClick={() =>
                              setPendingAction({
                                bookingCode: booking.booking_code,
                                itemId: item.id,
                                label: t.admin.completeSlot,
                                status: 'completed',
                                tone: 'blue',
                              })
                            }
                            className="mt-2 h-9 rounded-lg border border-blue-500/40 bg-blue-500/10 px-3 text-xs font-bold text-blue-300 transition hover:bg-blue-500 hover:text-white"
                          >
                            {t.admin.completeSlot}
                          </button>
                        )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="mt-4 border-t border-white/10 pt-5">
              <div className="grid gap-4 lg:grid-cols-[1fr_auto] lg:items-end">
                <div className="space-y-3">
                  <p className="text-xl font-bold">
                    {t.admin.total}: {booking.total_amount} {t.common.thb}
                  </p>

                  {booking.slip_url ? (
                    <div className="flex w-full items-center justify-between gap-3 rounded-2xl border border-white/10 bg-neutral-950 p-4 sm:w-fit sm:min-w-[300px]">
                      <div>
                        <p className="font-bold text-white">{t.admin.paymentSlip}</p>
                        <p className="mt-1 text-sm text-neutral-500">
                          {t.admin.uploaded}
                        </p>
                      </div>

                      <a
                        href={booking.slip_url}
                        target="_blank"
                        className="inline-flex h-10 shrink-0 items-center justify-center rounded-xl bg-white px-4 text-sm font-bold text-black transition hover:bg-neutral-200 sm:h-11 sm:px-5 sm:text-base"
                      >
                        {t.admin.viewSlip}
                      </a>
                    </div>
                  ) : (
                    <div className="w-full rounded-2xl border border-white/10 bg-neutral-950 p-4 text-neutral-400 sm:w-fit sm:min-w-[260px]">
                      {t.admin.noSlip}
                    </div>
                  )}
                </div>

              <div className="rounded-2xl border border-white/10 bg-neutral-950 p-3">
                <p className="mb-3 text-sm font-semibold text-neutral-400 lg:hidden">
                  {t.admin.adminActions}
                </p>

                {hasActions ? (
                <div className="grid grid-cols-2 gap-3 sm:flex sm:flex-wrap lg:justify-end">
                {canMarkPaid && (
                <button
                    onClick={() =>
                      setPendingAction({
                        bookingCode: booking.booking_code,
                        label: t.admin.markAsPaid,
                        status: 'paid',
                        paymentStatus: 'paid',
                        tone: 'green',
                      })
                    }
                    className="col-span-2 h-11 rounded-xl bg-emerald-500 px-4 text-sm font-semibold text-black transition hover:bg-emerald-400 sm:col-span-1 sm:min-w-[150px] sm:px-5 sm:text-base"
                >
                    {t.admin.markAsPaid}
                </button>
                )}

                {canComplete && (
                <button
                  onClick={() =>
                    setPendingAction({
                      bookingCode: booking.booking_code,
                      label: t.admin.completeBooking,
                      status: 'completed',
                      tone: 'blue',
                    })
                  }
                  className="h-11 rounded-xl bg-blue-500 px-4 text-sm font-semibold text-white transition hover:bg-blue-400 sm:min-w-[150px] sm:px-5 sm:text-base"
                >
                  {t.admin.complete}
                </button>
                )}

                {canCancel && (
                <button
                  onClick={() =>
                    setPendingAction({
                      bookingCode: booking.booking_code,
                      label: t.admin.cancelBooking,
                      status: 'cancelled',
                      tone: 'red',
                    })
                  }
                  className="h-11 rounded-xl border border-red-500/50 bg-red-500/10 px-4 text-sm font-semibold text-red-300 transition hover:bg-red-500 hover:text-white sm:min-w-[150px] sm:px-5 sm:text-base"
                >
                  {t.admin.cancel}
                </button>
                )}
              </div>
                ) : (
                  <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm font-semibold text-neutral-400">
                    {t.admin.noActions}
                  </div>
                )}
              </div>
              </div>
            </div>
              </>
            )}
                </>
              )
            })()}
          </div>
        ))}

        {!loading && bookings.length === 0 && (
          <div className="rounded-3xl border border-dashed border-white/10 bg-neutral-900 p-10 text-center text-neutral-400">
            {t.admin.noBookings}
          </div>
        )}
      </div>
    </main>
    </>
  )
}
