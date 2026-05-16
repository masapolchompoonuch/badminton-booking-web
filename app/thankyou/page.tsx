'use client'
export default function ThankYouPage() {
  return (
    <main className="min-h-screen bg-black text-white flex items-center justify-center p-6">
      <div className="w-full max-w-lg rounded-3xl border border-emerald-500/30 bg-neutral-900 p-8 text-center">
        
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-full bg-emerald-500 text-4xl font-bold text-black">
          ✓
        </div>

        <h1 className="text-4xl font-bold">
          Thank you for booking with us
        </h1>

        <p className="mt-4 mb-10 text-neutral-400">
          Your booking and payment slip have been received successfully.
          <br />
          We look forward to seeing you soon.
        </p>

        <button
          onClick={() => {
            window.location.href = '/'
          }}
          className="mt-10 w-full rounded-2xl bg-emerald-500 p-4 font-bold text-black transition hover:bg-emerald-400"
        >
          Back to Home
        </button>
      </div>
    </main>
  )
}