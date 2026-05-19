'use client'

import { useState, useSyncExternalStore } from 'react'
import { supabase } from '@/lib/supabase'

type Court = {
  id: number
  name: string
  court_number: number
  court_type: string
  hourly_rate: number
  is_active: boolean
}

type BookingCartItem = {
  court_id: number
  court_name: string
  booking_date: string
  start_time: string
  end_time: string
  price: number
}

type ToastTone = 'success' | 'error' | 'info'

type ToastState = {
  message: string
  tone: ToastTone
} | null

const timeSlots = [
  { start: '08:00', end: '09:00' },
  { start: '09:00', end: '10:00' },
  { start: '10:00', end: '11:00' },
  { start: '11:00', end: '12:00' },
  { start: '12:00', end: '13:00' },
  { start: '13:00', end: '14:00' },
  { start: '14:00', end: '15:00' },
  { start: '15:00', end: '16:00' },
  { start: '16:00', end: '17:00' },
  { start: '17:00', end: '18:00' },
  { start: '18:00', end: '19:00' },
  { start: '19:00', end: '20:00' },
  { start: '20:00', end: '21:00' },
  { start: '21:00', end: '22:00' },
  { start: '22:00', end: '23:00' },
]

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

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month, 0).getDate()
}

function subscribeToClient() {
  return () => {}
}

function getClientSnapshot() {
  return true
}

function getServerSnapshot() {
  return false
}

function scrollToSection(id: string, offset = 24) {
  window.requestAnimationFrame(() => {
    const target = document.getElementById(id)

    if (!target) return

    const top = target.getBoundingClientRect().top + window.scrollY - offset

    window.scrollTo({
      top: Math.max(top, 0),
      behavior: 'smooth',
    })
  })
}

function normalizePhone(value: string) {
  return value.replace(/[^\d+]/g, '')
}

export default function Home() {
  const today = getTodayParts()

  const [startTime, setStartTime] = useState('')
  const [endTime, setEndTime] = useState('')
  const [courts, setCourts] = useState<Court[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedCourtId, setSelectedCourtId] = useState<number | null>(null)

  const [selectedDay, setSelectedDay] = useState(today.day)
  const [selectedMonth, setSelectedMonth] = useState(today.month)
  const [selectedYear, setSelectedYear] = useState(today.year)

  const [fullName, setFullName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')

  const [bookingCart, setBookingCart] = useState<BookingCartItem[]>([])
  const [showCustomerForm, setShowCustomerForm] = useState(false)
  const mounted = useSyncExternalStore(
    subscribeToClient,
    getClientSnapshot,
    getServerSnapshot
  )
  const [successMessage, setSuccessMessage] = useState('')
  const [courtMessage, setCourtMessage] = useState('')
  const [toast, setToast] = useState<ToastState>(null)
  const [latestBookingCode, setLatestBookingCode] = useState('')
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [uploadingSlip, setUploadingSlip] = useState(false)
  const [slipUploaded, setSlipUploaded] = useState(false)
  const [submittingBooking, setSubmittingBooking] = useState(false)
  const [showBookingConfirm, setShowBookingConfirm] = useState(false)

  const selectedCourt = courts.find((court) => court.id === selectedCourtId)
  const bookingDate = formatDate(selectedYear, selectedMonth, selectedDay)
  const totalAmount = bookingCart.reduce((sum, item) => sum + Number(item.price), 0)

  function showToast(message: string, tone: ToastTone = 'info') {
    setToast({ message, tone })
    setTimeout(() => {
      setToast(null)
    }, 3000)
  }

  async function getBookedCourtIds(): Promise<number[]> {
    const { data, error } = await supabase
      .from('booking_items')
      .select('court_id')
      .eq('booking_date', bookingDate)
      .in('status', ['pending', 'paid'])
      .lt('start_time', endTime)
      .gt('end_time', startTime)

    if (error) {
      console.error(error)
      return []
    }

    if (!data || data.length === 0) return []

    return data.map((item) => item.court_id)
  }

  async function findAvailableCourts() {
    setLoading(true)
    setSuccessMessage('')
    setSelectedCourtId(null)

    const bookedIds = await getBookedCourtIds()

    const { data, error } = await supabase
      .from('courts')
      .select('*')
      .eq('is_active', true)
      .not('id', 'in', `(${bookedIds.length ? bookedIds.join(',') : 0})`)
      .order('court_number')

    if (error) {
      console.error(error)
      setCourts([])
    } else {
      setCourts(data || [])
        if ((data || []).length > 0) {
          setTimeout(() => {
            document.getElementById('available-courts')?.scrollIntoView({
              behavior: 'smooth',
              block: 'start',
            })
          }, 200)
        }

      if ((data || []).length === 0) {
        setCourtMessage('This time slot has been fully booked.')
      } else {
        setCourtMessage('')
      }
    }

    setLoading(false)
  }

  function selectTimeSlot(start: string, end: string) {
    setStartTime(start)
    setEndTime(end)
    setCourts([])
    setSelectedCourtId(null)
    setSuccessMessage('')
  }

  function addBookingToCart() {
    if (!selectedCourt) {
      showToast('Please select a court', 'error')
      return
    }

    const duplicated = bookingCart.some(
      (item) =>
        item.court_id === selectedCourt.id &&
        item.booking_date === bookingDate &&
        item.start_time === startTime &&
        item.end_time === endTime
    )

    if (duplicated) {
      showToast('This booking is already in your cart', 'error')
      return
    }

    setBookingCart([
      ...bookingCart,
      {
        court_id: selectedCourt.id,
        court_name: selectedCourt.name,
        booking_date: bookingDate,
        start_time: startTime,
        end_time: endTime,
        price: selectedCourt.hourly_rate,
      },
    ])

    setSelectedCourtId(null)
    setShowCustomerForm(false)
    showToast(`${selectedCourt.name} added to cart`, 'success')
    setTimeout(() => {
      scrollToSection('booking-cart-section')
    }, 50)
  }

  function addAnotherBooking() {
    setStartTime('')
    setEndTime('')
    setCourts([])
    setSelectedCourtId(null)
    setCourtMessage('')
    setShowCustomerForm(false)
    scrollToSection('select-time')
  }

  function continueToCustomerForm() {
    if (showCustomerForm) {
      scrollToSection('customer-info')
      return
    }

    setShowCustomerForm(true)

    setTimeout(() => {
      scrollToSection('customer-info')
    }, 100)
  }

  function removeCartItem(index: number) {
    setBookingCart(bookingCart.filter((_, i) => i !== index))
  }

  async function checkCartAvailability() {
    for (const item of bookingCart) {
      const { data, error } = await supabase
        .from('booking_items')
        .select('id')
        .eq('court_id', item.court_id)
        .eq('booking_date', item.booking_date)
        .in('status', ['pending', 'paid'])
        .lt('start_time', item.end_time)
        .gt('end_time', item.start_time)

      if (error) {
        console.error(error)
        return false
      }

      if (data && data.length > 0) {
        showToast(
          `${item.court_name} on ${item.booking_date} ${item.start_time}-${item.end_time} was just booked by someone else.`,
          'error'
        )
        return false
      }
    }

    return true
  }

  function reviewBooking() {
    if (!fullName || !phone) {
      showToast('Please enter your name and phone number', 'error')
      return
    }

    if (bookingCart.length === 0) {
      showToast('Please add at least one booking', 'error')
      return
    }

    setShowBookingConfirm(true)
  }

  async function confirmBooking() {
    if (submittingBooking) return

    setSubmittingBooking(true)

    const isAvailable = await checkCartAvailability()

    if (!isAvailable) {
      setBookingCart([])
      setCourts([])
      setSelectedCourtId(null)
      setShowBookingConfirm(false)
      setSubmittingBooking(false)
      return
    }

    try {
      const normalizedPhone = normalizePhone(phone)

      const { data: customerData, error: customerError } = await supabase
        .from('customers')
        .insert([
          {
            full_name: fullName,
            phone: normalizedPhone,
            email,
            line_id: null,
          },
        ])
        .select()
        .single()

      if (customerError) {
        console.error(customerError)
        showToast('Customer creation failed', 'error')
        setSubmittingBooking(false)
        return
      }

      const bookingCode = 'BK-' + Date.now()

      const { data: bookingData, error: bookingError } = await supabase
        .from('bookings')
        .insert([
          {
            booking_code: bookingCode,
            customer_id: customerData.id,
            total_amount: totalAmount,
            status: 'pending',
            payment_status: 'unpaid',
            note,
          },
        ])
        .select()
        .single()

      if (bookingError) {
        console.error(bookingError)
        showToast('Booking creation failed', 'error')
        setSubmittingBooking(false)
        return
      }

      const bookingItems = bookingCart.map((item) => ({
        booking_id: bookingData.id,
        court_id: item.court_id,
        booking_date: item.booking_date,
        start_time: item.start_time,
        end_time: item.end_time,
        price: item.price,
        status: 'pending',
      }))

      const { error: itemError } = await supabase
        .from('booking_items')
        .insert(bookingItems)

      if (itemError) {
        console.error(itemError)
        showToast('Booking item failed', 'error')
        setSubmittingBooking(false)
        return
      }

      setSuccessMessage(`Booking success! Your booking code is ${bookingCode}`)
      setLatestBookingCode(bookingCode)
      setShowBookingConfirm(false)

      setTimeout(() => {
        window.scrollTo({
          top: 0,
          behavior: 'smooth',
        })
      }, 100)

      setFullName('')
      setPhone('')
      setEmail('')
      setNote('')
      setSelectedCourtId(null)
      setCourts([])
      setBookingCart([])
    } catch (error) {
      console.error(error)
      showToast('Something went wrong', 'error')
    } finally {
      setSubmittingBooking(false)
    }
  }

  async function uploadPaymentSlip() {
    if (!slipFile || !latestBookingCode) {
      showToast('Please select a slip file', 'error')
      return
    }

    setUploadingSlip(true)

    const filePath = `${latestBookingCode}-${Date.now()}-${slipFile.name}`

    const { error: uploadError } = await supabase.storage
      .from('payment-slips')
      .upload(filePath, slipFile)

    if (uploadError) {
      console.error(uploadError)
      showToast('Upload slip failed', 'error')
      setUploadingSlip(false)
      return
    }

    const { data } = supabase.storage
      .from('payment-slips')
      .getPublicUrl(filePath)

    const slipUrl = data.publicUrl

    const { error: updateError } = await supabase
      .from('bookings')
      .update({ slip_url: slipUrl })
      .eq('booking_code', latestBookingCode)

    setUploadingSlip(false)

    if (updateError) {
      console.error(updateError)
      showToast('Save slip failed', 'error')
      return
    }
    window.scrollTo({
      top: 0,
      behavior: 'smooth',
    })

    setSlipUploaded(true)
  }

  function isPastTimeSlot(time: string) {
    const now = new Date()

    const thailandNow = new Date(
      now.toLocaleString('en-US', { timeZone: 'Asia/Bangkok' })
    )

    const selectedDateTime = new Date(`${bookingDate}T${time}:00`)

    return selectedDateTime <= thailandNow
  }

  function resetSelection() {
    setStartTime('')
    setEndTime('')
    setCourts([])
    setSelectedCourtId(null)
  }

  function updateSelectedDate(nextYear: number, nextMonth: number, nextDay: number) {
    const maxDay = getDaysInMonth(nextYear, nextMonth)
    const clampedDay = Math.min(nextDay, maxDay)
    const todayString = formatDate(today.year, today.month, today.day)
    const nextDate = formatDate(nextYear, nextMonth, clampedDay)

    if (nextDate < todayString) {
      setSelectedYear(today.year)
      setSelectedMonth(today.month)
      setSelectedDay(today.day)
    } else {
      setSelectedYear(nextYear)
      setSelectedMonth(nextMonth)
      setSelectedDay(clampedDay)
    }

    resetSelection()
  }

  return (
    <>
      {toast && (
        <div
          className={`fixed top-5 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 rounded-2xl border bg-neutral-900 px-5 py-4 text-center font-semibold shadow-2xl ${
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

      {showBookingConfirm && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/80 p-4">
          <div className="my-4 flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col overflow-hidden rounded-3xl border border-white/10 bg-neutral-900 shadow-2xl">
            <div className="shrink-0 p-6 pb-4">
              <p className="text-sm font-semibold uppercase tracking-[0.2em] text-emerald-400">
                Review booking
              </p>

              <h2 className="mt-3 text-3xl font-bold text-white">
                Confirm your booking
              </h2>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-5">
              <div className="space-y-3">
                {bookingCart.map((item, index) => (
                  <div
                    key={`${item.court_id}-${item.start_time}-${index}`}
                    className="rounded-2xl border border-white/10 bg-neutral-950 p-4"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-bold text-white">{item.court_name}</p>
                        <p className="text-sm text-neutral-400">
                          {item.booking_date}
                        </p>
                        <p className="text-sm text-neutral-400">
                          {item.start_time} - {item.end_time}
                        </p>
                      </div>

                      <p className="font-bold text-white">{item.price} THB</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-5 rounded-2xl bg-white/5 p-4">
                <div className="flex justify-between gap-4">
                  <span className="text-neutral-400">Customer</span>
                  <span className="text-right font-semibold text-white">
                    {fullName}
                  </span>
                </div>
                <div className="mt-2 flex justify-between gap-4">
                  <span className="text-neutral-400">Phone</span>
                  <span className="text-right font-semibold text-white">
                    {normalizePhone(phone)}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between gap-4 border-t border-white/10 pt-4">
                  <span className="text-neutral-400">Total</span>
                  <span className="text-2xl font-bold text-white">
                    {totalAmount} THB
                  </span>
                </div>
              </div>
            </div>

            <div className="grid shrink-0 grid-cols-2 gap-3 border-t border-white/10 bg-neutral-900 p-4">
              <button
                type="button"
                onClick={() => setShowBookingConfirm(false)}
                disabled={submittingBooking}
                className="h-12 rounded-2xl border border-white/10 font-bold text-white transition hover:border-white/30 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Back
              </button>

              <button
                type="button"
                onClick={confirmBooking}
                disabled={submittingBooking}
                className="h-12 rounded-2xl bg-emerald-500 font-bold text-black transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submittingBooking ? 'Booking...' : 'Confirm'}
              </button>
            </div>
          </div>
        </div>
      )}

      {slipUploaded && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-6">
          <div className="w-full max-w-md rounded-3xl border border-emerald-500/30 bg-neutral-900 p-8 text-center shadow-2xl">
            <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-500 text-3xl font-bold text-black">
              ✓
            </div>

            <h2 className="text-3xl font-bold text-white">
              Uploaded Successfully
            </h2>

            <p className="mt-3 text-neutral-400">
              Your payment slip has been uploaded successfully. Our team will verify your payment shortly.
            </p>

            <button
              onClick={() => {
                setSlipUploaded(false)
                window.location.href = '/thankyou'
              }}
              className="mt-6 w-full rounded-2xl bg-emerald-500 p-4 font-bold text-black transition hover:bg-emerald-400"
            >
              Finish
            </button>
          </div>
        </div>
      )}

      <main
        className={`min-h-screen bg-neutral-950 text-white ${
          bookingCart.length > 0 ? 'pb-28 lg:pb-0' : ''
        }`}
      >
        <section className="mx-auto max-w-6xl px-5 py-10 md:py-16">
          <div className="mb-10 rounded-3xl border border-white/10 bg-gradient-to-br from-neutral-900 to-neutral-800 p-6 shadow-2xl md:p-10">
            <p className="mb-3 text-sm font-semibold uppercase tracking-[0.25em] text-emerald-400">
              Badminton Court Booking
            </p>

            <h1 className="max-w-3xl text-4xl font-bold leading-tight md:text-6xl">
              Book your badminton court online
            </h1>

            <p className="mt-5 max-w-2xl text-neutral-300">
              Select your date, time, available court, and add multiple bookings before confirming.
            </p>
          </div>

          {successMessage && (
            <div className="mt-8 mb-8 rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-5 text-emerald-300">
              <p className="font-semibold">{successMessage}</p>

              <div className="mt-5 rounded-2xl border border-white/10 bg-neutral-950 p-4">
                <p className="mb-3 font-semibold text-white">
                  Upload payment slip
                </p>

                <input
                  type="file"
                  accept="image/*,.pdf"
                  onChange={(e) => {
                    const file = e.target.files?.[0]
                    if (file) setSlipFile(file)
                  }}
                  className="mb-4 w-full rounded-xl border border-white/10 bg-neutral-900 p-3 text-white"
                />

                <button
                  onClick={uploadPaymentSlip}
                  disabled={uploadingSlip}
                  className="rounded-xl bg-white px-5 py-3 font-bold text-black"
                >
                  {uploadingSlip ? 'Uploading...' : 'Upload Slip'}
                </button>
              </div>
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <section id="booking-selection" className="space-y-6">
              <div
                id="select-time"
                className="rounded-3xl border border-white/10 bg-neutral-900 p-5 md:p-6"
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 font-bold text-black">
                    1
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Select date</h2>
                    <p className="text-sm text-neutral-400">
                      Choose day, month, and year
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <select
                    value={selectedDay}
                    onChange={(e) => {
                      updateSelectedDate(
                        selectedYear,
                        selectedMonth,
                        Number(e.target.value)
                      )
                    }}
                    className="rounded-2xl border border-white/10 bg-neutral-950 p-4 text-white"
                  >
                    {Array.from(
                      { length: getDaysInMonth(selectedYear, selectedMonth) },
                      (_, i) => i + 1
                    )
                      .filter((day) => {
                        if (selectedYear === today.year && selectedMonth === today.month) {
                          return day >= today.day
                        }

                        return true
                      })
                      .map((day) => (
                        <option key={day} value={day}>
                          Day {day}
                        </option>
                      ))}
                  </select>

                  <select
                    value={selectedMonth}
                    onChange={(e) => {
                      updateSelectedDate(
                        selectedYear,
                        Number(e.target.value),
                        selectedDay
                      )
                    }}
                    className="rounded-2xl border border-white/10 bg-neutral-950 p-4 text-white"
                  >
                    {Array.from({ length: 12 }, (_, i) => i + 1)
                      .filter((month) => {
                        if (selectedYear === today.year) {
                          return month >= today.month
                        }

                        return true
                      })
                      .map((month) => (
                        <option key={month} value={month}>
                          Month {month}
                        </option>
                      ))}
                  </select>

                  <select
                    value={selectedYear}
                    onChange={(e) => {
                      updateSelectedDate(
                        Number(e.target.value),
                        selectedMonth,
                        selectedDay
                      )
                    }}
                    className="rounded-2xl border border-white/10 bg-neutral-950 p-4 text-white"
                  >
                    {Array.from({ length: 5 }, (_, i) => today.year + i).map(
                      (year) => (
                        <option key={year} value={year}>
                          {year}
                        </option>
                      )
                    )}
                  </select>
                </div>

                <p className="mt-4 rounded-2xl bg-white/5 p-4 text-sm text-neutral-300">
                  Selected date:{' '}
                  <span className="font-semibold text-white">
                    {selectedDay}/{selectedMonth}/{selectedYear}
                  </span>
                </p>
              </div>

              <div className="rounded-3xl border border-white/10 bg-neutral-900 p-5 md:p-6">
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 font-bold text-black">
                    2
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Select time</h2>
                    <p className="text-sm text-neutral-400">
                      Choose your preferred time slot
                    </p>
                  </div>
                </div>

                <div className="mt-6 grid grid-cols-2 md:grid-cols-3 gap-2">
                  {timeSlots.map((slot) => {
                    const isSelected =
                      startTime === slot.start && endTime === slot.end

                    const isPast = mounted && isPastTimeSlot(slot.start)
                    const isUnavailable = false

                    return (
                      <button
                        key={`${slot.start}-${slot.end}`}
                        disabled={isPast || isUnavailable}
                        onClick={() => selectTimeSlot(slot.start, slot.end)}
                        className={`rounded-2xl border p-4 text-left transition ${
                          isPast || isUnavailable
                            ? 'cursor-not-allowed border-white/5 bg-neutral-900 text-neutral-600'
                            : isSelected
                            ? 'border-emerald-400 bg-emerald-500 text-black'
                            : 'border-white/10 bg-neutral-950 hover:border-emerald-400'
                        }`}
                      >
                        <div className="font-bold">
                          {slot.start} - {slot.end}
                        </div>
                      </button>
                    )
                  })}
                </div>

	                <button
	                  onClick={findAvailableCourts}
	                  disabled={!startTime || !endTime || loading}
	                  className={`mt-5 w-full rounded-2xl p-4 font-bold transition ${
	                    !startTime || !endTime || loading
	                      ? 'cursor-not-allowed border border-white/10 bg-neutral-800 text-neutral-500'
	                      : 'bg-white text-black hover:bg-neutral-200'
	                  }`}
	                >
	                  {loading ? 'Searching...' : 'Search available courts'}
	                </button>
                {courtMessage && (
                  <p className="mt-3 text-sm font-semibold text-red-400">
                    {courtMessage}
                  </p>
                )}
              </div>

              <div
                id="available-courts"
                className="rounded-3xl border border-white/10 bg-neutral-900 p-5 md:p-6"
              >
                <div className="mb-5 flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-500 font-bold text-black">
                    3
                  </div>
                  <div>
                    <h2 className="text-xl font-bold">Available courts</h2>
                    <p className="text-sm text-neutral-400">
                      Available courts: {courts.length}
                    </p>
                  </div>
                </div>

                {courts.length === 0 && !loading && (
                  <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-neutral-400">
                    Select date and time, then search available courts.
                  </div>
                )}

                <div className="grid gap-3 md:grid-cols-2">
                  {courts.map((court) => (
                    <button
                      key={court.id}
                      onClick={() => setSelectedCourtId(court.id)}
                      className={`w-full rounded-2xl border p-5 text-left transition ${
                        selectedCourtId === court.id
                          ? 'border-emerald-400 bg-emerald-500 text-black'
                          : 'border-white/10 bg-neutral-950 hover:border-emerald-400'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <h3 className="text-2xl font-bold">{court.name}</h3>
                          <p className="mt-1 text-sm opacity-80">
                            {court.court_type}
                          </p>
                        </div>
                        <span className="rounded-full bg-white px-3 py-1 text-sm font-bold text-black">
                          Available
                        </span>
                      </div>

                      <p className="mt-4 font-semibold">
                        {court.hourly_rate} THB / hour
                      </p>
                    </button>
                  ))}
                </div>

                {selectedCourt && (
                  <button
                    onClick={addBookingToCart}
                    className="mt-5 w-full rounded-2xl bg-emerald-500 p-4 font-bold text-black transition hover:bg-emerald-400"
                  >
                    Add Booking
                  </button>
                )}
              </div>
            </section>

            <aside className="space-y-6">
              <div
                id="booking-cart-section"
                className="rounded-3xl border border-white/10 bg-neutral-900 p-5 md:p-6 lg:sticky lg:top-6"
              >
                <h2 id="booking-cart" className="scroll-mt-6 text-2xl font-bold">
                  Booking cart
                </h2>

                <div className="mt-5 space-y-3">
                  {bookingCart.length === 0 && (
                    <div className="rounded-2xl border border-dashed border-white/10 p-5 text-center text-neutral-400">
                      No booking added yet.
                    </div>
                  )}

                  {bookingCart.map((item, index) => (
                    <div
                      key={index}
                      className="rounded-2xl border border-white/10 bg-neutral-950 p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-bold text-white">
                            {item.court_name}
                          </p>
                          <p className="text-sm text-neutral-400">
                            {item.booking_date}
                          </p>
                          <p className="text-sm text-neutral-400">
                            {item.start_time} - {item.end_time}
                          </p>
                          <p className="mt-2 font-semibold">
                            {item.price} THB
                          </p>
                        </div>

                        <button
                          onClick={() => removeCartItem(index)}
                          className="rounded-xl bg-red-500 px-3 py-2 text-sm font-bold text-white"
                        >
                          Remove
                        </button>
                      </div>
                    </div>
	                  ))}
	                  {bookingCart.length > 0 && (
	                    <button
	                      type="button"
	                      onClick={addAnotherBooking}
	                      className="mt-2 w-full rounded-2xl border border-emerald-500/40 bg-emerald-500/10 p-4 font-bold text-emerald-300 transition hover:bg-emerald-500/20"
	                    >
	                      + Add another booking
	                    </button>
	                  )}
	                </div>

	                <div className="mt-5 rounded-2xl bg-white/5 p-4 lg:mb-8">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-400">Total</span>
                    <span className="text-2xl font-bold">
                      {totalAmount} THB
                    </span>
                  </div>
                </div>

                {bookingCart.length > 0 && !showCustomerForm && (
	                  <button
	                    type="button"
	                    onClick={continueToCustomerForm}
	                    className="hidden w-full rounded-2xl bg-white p-4 font-bold text-black transition hover:bg-neutral-200 lg:block"
	                  >
	                    Continue
	                  </button>
                )}

                {bookingCart.length > 0 && showCustomerForm && (
                  <div
                    id="customer-info"
                    className="mt-6 space-y-4 rounded-2xl border border-white/10 bg-neutral-950 p-4"
                  >
                    <h3 className="text-xl font-bold">Your information</h3>

                    <div>
                      <label className="mb-2 block text-sm text-neutral-400">
                        Full name *
                      </label>
                      <input
                        type="text"
                        placeholder="Your full name"
                        value={fullName}
                        onChange={(e) => setFullName(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-neutral-900 p-4"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-neutral-400">
                        Phone number *
                      </label>
                      <input
                        type="text"
                        placeholder="0812345678"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-neutral-900 p-4"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-neutral-400">
                        Email
                      </label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        className="w-full rounded-2xl border border-white/10 bg-neutral-900 p-4"
                      />
                    </div>

                    <div>
                      <label className="mb-2 block text-sm text-neutral-400">
                        Note
                      </label>
                      <textarea
                        placeholder="Optional"
                        value={note}
                        onChange={(e) => setNote(e.target.value)}
                        className="min-h-24 w-full rounded-2xl border border-white/10 bg-neutral-900 p-4"
                      />
                    </div>

	                    <button
	                      onClick={reviewBooking}
	                      disabled={!fullName || !phone || submittingBooking}
	                      className={`w-full rounded-2xl p-4 font-bold text-black transition ${
	                        !fullName || !phone || submittingBooking
	                          ? 'cursor-not-allowed bg-neutral-500'
	                          : 'bg-emerald-500 hover:bg-emerald-400'
	                      }`}
	                    >
	                      Review booking
	                    </button>
                  </div>
                )}
                
              </div>
            </aside>
          </div>
        </section>

        {bookingCart.length > 0 && (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-neutral-950/95 p-4 backdrop-blur lg:hidden">
            <div className="mx-auto flex max-w-3xl items-center gap-3">
              <button
                type="button"
                onClick={() => scrollToSection('booking-cart-section')}
                className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-neutral-900 px-4 py-3 text-left"
              >
                <p className="text-sm text-neutral-400">
                  {bookingCart.length} booking{bookingCart.length > 1 ? 's' : ''}
                </p>
                <p className="truncate text-xl font-bold text-white">
                  {totalAmount} THB
                </p>
              </button>

	              <button
	                type="button"
	                onClick={continueToCustomerForm}
	                className="h-[58px] rounded-2xl bg-white px-5 font-bold text-black"
	              >
                Continue
              </button>
            </div>
          </div>
        )}
      </main>
    </>
  )
}
