import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import type { Coach } from '../lib/types'
import { Crown, User, CreditCard, Shield, Check, Gift, Copy, CheckCircle2 } from 'lucide-react'

export default function Settings() {
  const [coach, setCoach] = useState<Coach | null>(null)
  const [email, setEmail] = useState('')
  const [fullName, setFullName] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [checkoutLoading, setCheckoutLoading] = useState(false)
  const [loading, setLoading] = useState(true)
  const [referralCode, setReferralCode] = useState('')
  const [copiedReferral, setCopiedReferral] = useState(false)
  const [intakeToken, setIntakeToken] = useState('')
  const [copiedIntake, setCopiedIntake] = useState(false)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setEmail(user.email ?? '')
      const { data } = await supabase.from('coaches').select('*').eq('id', user.id).single()
      setCoach(data)
      setFullName(data?.full_name ?? '')
      setReferralCode(data?.referral_code ?? '')
      setIntakeToken(data?.intake_token ?? '')
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
    setTimeout(() => setSaved(false), 2500)
  }

  const handleUpgrade = async () => {
    setCheckoutLoading(true)
    const { data, error } = await supabase.functions.invoke('create-checkout-session', {})
    if (error || !data?.url) { alert('Checkout mislukt. Probeer opnieuw.'); setCheckoutLoading(false); return }
    window.location.href = data.url
  }

  const inputCls = "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:ring-0 transition-colors"

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-2xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Instellingen</h1>
        <p className="text-slate-400 text-sm mt-0.5">Beheer je account en abonnement</p>
      </div>

      {/* Profile */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 mb-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="bg-slate-100 rounded-lg p-1.5">
            <User className="h-4 w-4 text-slate-600" />
          </div>
          <h2 className="font-semibold text-slate-900 text-sm">Profiel</h2>
        </div>
        <form onSubmit={handleSaveProfile} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Naam</label>
            <input type="text" value={fullName} onChange={e => setFullName(e.target.value)} className={inputCls} />
          </div>
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">E-mail</label>
            <input type="email" value={email} disabled className="w-full px-3.5 py-2.5 bg-slate-50 border border-slate-100 rounded-xl text-sm text-slate-400 cursor-not-allowed" />
          </div>
          <button type="submit" disabled={saving} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm">
            {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : 'Wijzigingen opslaan'}
          </button>
        </form>
      </div>

      {/* Subscription */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 mb-5">
        <div className="flex items-center gap-2.5 mb-5">
          <div className="bg-slate-100 rounded-lg p-1.5">
            <CreditCard className="h-4 w-4 text-slate-600" />
          </div>
          <h2 className="font-semibold text-slate-900 text-sm">Abonnement</h2>
        </div>

        <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-100 mb-4">
          <div>
            <p className="font-semibold text-slate-900 text-sm capitalize">
              {coach?.plan === 'pro' ? 'Pro' : 'Gratis'} plan
            </p>
            <p className="text-xs text-slate-400 mt-0.5">
              {coach?.plan === 'pro'
                ? 'Onbeperkte clients · AI-programma\'s · Check-in feedback'
                : 'Tot 3 clients · AI-programma\'s'}
            </p>
          </div>
          {coach?.plan === 'pro' && (
            <span className="flex items-center gap-1.5 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-full">
              <Crown className="h-3 w-3" />
              Pro
            </span>
          )}
        </div>

        {coach?.plan !== 'pro' && (
          <div className="rounded-2xl overflow-hidden border border-brand-200 bg-gradient-to-br from-brand-50 to-white">
            <div className="p-5">
              <div className="flex items-center gap-2 mb-1">
                <Crown className="h-4 w-4 text-brand-600" />
                <span className="font-bold text-brand-900 text-sm">Upgrade naar Pro</span>
              </div>
              <p className="text-xs text-slate-500 mb-4">Schaal je praktijk zonder beperkingen</p>
              <ul className="space-y-2 mb-5">
                {[
                  'Onbeperkte clients',
                  'Onbeperkte AI-programma\'s',
                  'AI check-in feedback',
                  'Prioriteitsondersteuning',
                ].map(f => (
                  <li key={f} className="flex items-center gap-2 text-sm text-slate-700">
                    <span className="w-4 h-4 rounded-full bg-brand-100 flex items-center justify-center flex-shrink-0">
                      <Check className="h-2.5 w-2.5 text-brand-600" />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <div className="flex items-baseline gap-1 mb-4">
                <span className="text-3xl font-bold text-slate-900">€49</span>
                <span className="text-slate-400 text-sm">/maand</span>
              </div>
              <button
                onClick={handleUpgrade}
                disabled={checkoutLoading}
                className="w-full bg-brand-600 hover:bg-brand-700 text-white font-bold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 shadow-sm"
              >
                {checkoutLoading ? 'Laden...' : 'Upgraden naar Pro →'}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Referral */}
      {referralCode && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 mb-5">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="bg-amber-50 rounded-lg p-1.5">
              <Gift className="h-4 w-4 text-amber-600" />
            </div>
            <h2 className="font-semibold text-slate-900 text-sm">Referral programma</h2>
          </div>
          <p className="text-sm text-slate-600 mb-4">Deel CoachAI met andere trainers en verdien een gratis maand voor elke nieuwe coach die zich aanmeldt via jouw link.</p>
          <div className="space-y-3">
            <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
              <div>
                <p className="text-xs font-semibold text-slate-400 mb-0.5">Jouw referral link</p>
                <p className="text-sm font-mono text-slate-700">{window.location.origin}/auth?ref={referralCode}</p>
              </div>
              <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/auth?ref=${referralCode}`); setCopiedReferral(true); setTimeout(() => setCopiedReferral(false), 2000) }}
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                {copiedReferral ? <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Gekopieerd</> : <><Copy className="h-3 w-3" /> Kopiëren</>}
              </button>
            </div>
            {intakeToken && (
              <div className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                <div>
                  <p className="text-xs font-semibold text-slate-400 mb-0.5">Intake link (deel met nieuwe clients)</p>
                  <p className="text-sm font-mono text-slate-700">{window.location.origin}/intake/{intakeToken}</p>
                </div>
                <button onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/intake/${intakeToken}`); setCopiedIntake(true); setTimeout(() => setCopiedIntake(false), 2000) }}
                  className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 bg-white border border-slate-200 px-3 py-1.5 rounded-lg transition-colors">
                  {copiedIntake ? <><CheckCircle2 className="h-3 w-3 text-emerald-500" /> Gekopieerd</> : <><Copy className="h-3 w-3" /> Kopiëren</>}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* GDPR badge */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
        <div className="flex items-center gap-3">
          <div className="bg-emerald-50 rounded-xl p-2.5">
            <Shield className="h-5 w-5 text-emerald-600" />
          </div>
          <div>
            <p className="font-semibold text-slate-900 text-sm">Privacy & GDPR</p>
            <p className="text-xs text-slate-400 mt-0.5">Jouw data wordt opgeslagen in de EU · Volledig AVG-compliant</p>
          </div>
          <span className="ml-auto text-xs font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-full flex-shrink-0">
            ✓ Compliant
          </span>
        </div>
      </div>
    </div>
  )
}
