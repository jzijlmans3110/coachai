import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { Zap } from 'lucide-react'

export default function Auth() {
  const [mode, setMode] = useState<'login' | 'signup'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [fullName, setFullName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setMessage('')

    if (mode === 'signup') {
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { full_name: fullName } },
      })
      if (error) setError(error.message)
      else setMessage('Check your email to confirm your account.')
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) setError(error.message)
    }
    setLoading(false)
  }

  return (
    <div className="min-h-screen flex">
      {/* Left — branding */}
      <div className="hidden lg:flex w-1/2 bg-sidebar flex-col justify-between p-12 relative overflow-hidden">
        {/* Glow */}
        <div className="absolute -top-32 -left-32 w-96 h-96 bg-brand-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-brand-500/10 rounded-full blur-3xl pointer-events-none" />

        {/* Logo */}
        <div className="flex items-center gap-2.5 relative z-10">
          <div className="bg-brand-600 rounded-lg p-2">
            <Zap className="h-5 w-5 text-white" fill="white" />
          </div>
          <span className="font-bold text-white text-xl tracking-wide">COACH<span className="text-brand-400">AI</span></span>
        </div>

        {/* Copy */}
        <div className="relative z-10">
          <p className="text-brand-400 text-sm font-semibold uppercase tracking-widest mb-4">Voor de beste trainers</p>
          <h1 className="text-4xl font-bold text-white leading-tight mb-6">
            Geef jouw coaching<br />
            een <span className="text-brand-400">oneerlijk</span><br />
            voordeel.
          </h1>
          <p className="text-slate-400 text-base leading-relaxed max-w-sm">
            AI genereert gepersonaliseerde trainingsprogramma's in seconden. Jij focust op coachen. CoachAI doet de rest.
          </p>

          {/* Stats */}
          <div className="flex gap-8 mt-10">
            {[
              { value: '10s', label: 'Programma genereren' },
              { value: '4×', label: 'Meer klanten mogelijk' },
              { value: '100%', label: 'GDPR-compliant' },
            ].map(({ value, label }) => (
              <div key={label}>
                <p className="text-2xl font-bold text-white">{value}</p>
                <p className="text-slate-500 text-xs mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="text-slate-600 text-xs relative z-10">© 2026 CoachAI · GDPR Compliant · EU Data</p>
      </div>

      {/* Right — form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-slate-50">
        <div className="w-full max-w-sm">
          {/* Mobile logo */}
          <div className="flex items-center gap-2 mb-8 lg:hidden">
            <div className="bg-brand-600 rounded-lg p-1.5">
              <Zap className="h-4 w-4 text-white" fill="white" />
            </div>
            <span className="font-bold text-slate-900 text-lg tracking-wide">COACH<span className="text-brand-600">AI</span></span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            {mode === 'login' ? 'Welkom terug' : 'Start vandaag'}
          </h2>
          <p className="text-slate-500 text-sm mb-8">
            {mode === 'login'
              ? 'Log in om je clients en programma\'s te beheren'
              : 'Maak een gratis account aan en genereer je eerste programma'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Naam</label>
                <input
                  type="text"
                  value={fullName}
                  onChange={e => setFullName(e.target.value)}
                  required
                  className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 shadow-card focus:border-brand-500 focus:ring-0 transition-colors"
                  placeholder="Jan de Vries"
                />
              </div>
            )}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">E-mail</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                required
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 shadow-card focus:border-brand-500 focus:ring-0 transition-colors"
                placeholder="jan@example.com"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1.5">Wachtwoord</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                required
                minLength={6}
                className="w-full px-3.5 py-2.5 bg-white border border-slate-200 rounded-lg text-sm text-slate-900 placeholder-slate-400 shadow-card focus:border-brand-500 focus:ring-0 transition-colors"
                placeholder="••••••••"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}
            {message && (
              <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-lg px-4 py-3">
                {message}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50 shadow-sm"
            >
              {loading ? 'Laden...' : mode === 'login' ? 'Inloggen' : 'Account aanmaken'}
            </button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {mode === 'login' ? 'Nog geen account? ' : 'Al een account? '}
            <button
              onClick={() => { setMode(mode === 'login' ? 'signup' : 'login'); setError(''); setMessage('') }}
              className="text-brand-600 hover:text-brand-700 font-semibold transition-colors"
            >
              {mode === 'login' ? 'Aanmelden' : 'Inloggen'}
            </button>
          </p>
        </div>
      </div>
    </div>
  )
}
