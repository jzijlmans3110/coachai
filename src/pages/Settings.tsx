import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Coach } from '../lib/types'
import { loadStripe } from '@stripe/stripe-js'
import { Crown, User, CreditCard } from 'lucide-react'

const stripePromise = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY
  ? loadStripe(import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY)
  : null

export default function Settings() {
  const [coach, setCoach] = useState<Coach | null>(null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? '')

      const { data } = await supabase.from('coaches').select('*').eq('id', user.id).single()
      setCoach(data)
      setFullName(data?.full_name ?? '')
      setLoading(false)
    }
    load()
  }, [])

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    await supabase.from('coaches').upsert({ id: user.id, full_name: fullName })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  const handleUpgrade = async () => {
    if (!stripePromise) {
      alert('Stripe is not configured. Add VITE_STRIPE_PUBLISHABLE_KEY to your .env file.')
      return
    }
    setCheckoutLoading(true)

    const { data, error } = await supabase.functions.invoke('create-checkout-session', {
      body: { price_id: import.meta.env.VITE_STRIPE_PRICE_ID },
    })

    if (error || !data?.url) {
      alert('Failed to start checkout. Please try again.')
      setCheckoutLoading(false)
      return
    }

    window.location.href = data.url
  }

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  )

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Settings</h1>
        <p className="text-gray-500 text-sm mt-1">Manage your account and subscription</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <User className="h-5 w-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">Profile</h2>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Full name</label>
            <input
              type="text"
              value={fullName}
              onChange={e => setFullName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
            <input
              type="email"
              value={email}
              disabled
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm bg-gray-50 text-gray-500 cursor-not-allowed"
            />
          </div>
          <button
            type="submit"
            disabled={saving}
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {saving ? 'Saving...' : saved ? 'Saved!' : 'Save changes'}
          </button>
        </form>
      </div>

      {/* Subscription */}
      <div className="bg-white rounded-xl border border-gray-200 p-6">
        <div className="flex items-center gap-2 mb-5">
          <CreditCard className="h-5 w-5 text-gray-600" />
          <h2 className="font-semibold text-gray-900">Subscription</h2>
        </div>

        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl border border-gray-100 mb-4">
          <div>
            <p className="font-medium text-gray-900 capitalize">{coach?.plan ?? 'free'} plan</p>
            <p className="text-sm text-gray-500 mt-0.5">
              {coach?.plan === 'pro'
                ? 'Unlimited clients · AI programs · Check-in feedback'
                : 'Up to 3 clients · AI programs'}
            </p>
          </div>
          {coach?.plan === 'pro' && (
            <span className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              <Crown className="h-3.5 w-3.5" />
              Pro
            </span>
          )}
        </div>

        {coach?.plan !== 'pro' && (
          <div className="border border-blue-200 rounded-xl p-5 bg-blue-50">
            <div className="flex items-center gap-2 mb-2">
              <Crown className="h-5 w-5 text-blue-500" />
              <h3 className="font-semibold text-blue-900">Upgrade to Pro</h3>
            </div>
            <ul className="text-sm text-blue-800 space-y-1 mb-4">
              <li>✓ Unlimited clients</li>
              <li>✓ Unlimited AI program generation</li>
              <li>✓ AI-powered check-in feedback</li>
              <li>✓ Priority support</li>
            </ul>
            <div className="flex items-baseline gap-1 mb-4">
              <span className="text-2xl font-bold text-blue-900">€49</span>
              <span className="text-blue-700 text-sm">/month</span>
            </div>
            <button
              onClick={handleUpgrade}
              disabled={checkoutLoading}
              className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              {checkoutLoading ? 'Loading...' : 'Upgrade to Pro →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
