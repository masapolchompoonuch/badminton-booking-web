'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { LanguageToggle } from '../../language-toggle'
import { useI18n } from '../../language-provider'

export default function AdminLoginPage() {
  const { t } = useI18n()
  const router = useRouter()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setLoading(true)

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (error) {
      alert(error.message)
      return
    }

    router.push('/admin')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-black p-6 text-white">
      <div className="w-full max-w-md rounded-3xl border border-white/10 bg-neutral-950 p-8">
        <div className="mb-8 flex items-start justify-between gap-4">
          <h1 className="text-3xl font-bold">
            {t.admin.loginTitle}
          </h1>

          <LanguageToggle />
        </div>

        <div className="space-y-4">
          <input
            type="email"
            placeholder={t.common.email}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black p-4"
          />

          <input
            type="password"
            placeholder={t.admin.password}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-2xl border border-white/10 bg-black p-4"
          />

          <button
            onClick={handleLogin}
            disabled={loading}
            className="w-full rounded-2xl bg-white p-4 font-bold text-black"
          >
            {loading ? t.common.loading : t.admin.login}
          </button>
        </div>
      </div>
    </main>
  )
}
