import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Zap, CheckCircle2 } from 'lucide-react'

export default function CheckIn() {
  const { clientId } = useParams<{ clientId: string }>()
  const [form, setForm] = useState({ week_number: 1, weight_kg: '', energy: 7, sleep_hrs: '', notes: '' })
  const [loading, setLoading] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return
    setLoading(true)
    setError('')

    const { data, error: insertError } = await supabase
      .from('check_ins')
      .insert({
        client_id: clientId,
        week_number: form.week_number,
        weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
        energy: form.energy,
        sleep_hrs: form.sleep_hrs ? Number(form.sleep_hrs) : null,
        notes: form.notes || null,
      })
      .select().single()

    if (insertError) { setError('Er is iets misgegaan. Probeer opnieuw.'); setLoading(false); return }
    if (data?.id) supabase.functions.invoke('generate-checkin-feedback', { body: { check_in_id: data.id } })
    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="bg-white/5 border border-white/10 backdrop-blur rounded-2xl w-full max-w-md p-10 text-center">
        <div className="w-16 h-16 bg-emerald-500/10 border border-emerald-500/20 rounded-full flex items-center justify-center mx-auto mb-5">
          <CheckCircle2 className="h-7 w-7 text-emerald-400" />
        </div>
        <h2 className="text-xl font-bold text-white mb-2">Check-in verstuurd!</h2>
        <p className="text-slate-400 text-sm">Bedankt! Je coach bekijkt je check-in en je ontvangt snel gepersonaliseerde feedback.</p>
      </div>
    </div>
  )

  const inputCls = "w-full px-3.5 py-2.5 bg-white/5 border border-white/10 rounded-xl text-sm text-white placeholder-slate-500 focus:border-brand-500 focus:bg-white/8 focus:ring-0 transition-colors"

  return (
    <div className="min-h-screen bg-sidebar flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Logo */}
        <div className="flex items-center gap-2.5 justify-center mb-8">
          <div className="bg-brand-600 rounded-lg p-1.5">
            <Zap className="h-4 w-4 text-white" fill="white" />
          </div>
          <span className="font-bold text-white text-lg tracking-wide">COACH<span className="text-brand-400">AI</span></span>
        </div>

        <div className="bg-white/5 border border-white/10 backdrop-blur rounded-2xl p-8">
          <h1 className="text-xl font-bold text-white mb-1">Wekelijkse check-in</h1>
          <p className="text-slate-400 text-sm mb-7">Houd je voortgang bij zodat je coach je programma kan aanpassen.</p>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Weeknummer</label>
              <input type="number" min={1} value={form.week_number} onChange={e => setForm(f => ({ ...f, week_number: Number(e.target.value) }))} required className={inputCls} />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Gewicht <span className="font-normal normal-case text-slate-500">(kg, optioneel)</span></label>
              <input type="number" step="0.1" value={form.weight_kg} onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))} className={inputCls} placeholder="75.5" />
            </div>

            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="text-xs font-semibold text-slate-400 uppercase tracking-wide">Energieniveau</label>
                <span className="text-brand-400 font-bold text-sm">{form.energy}<span className="text-slate-500 font-normal">/10</span></span>
              </div>
              <input type="range" min={1} max={10} value={form.energy} onChange={e => setForm(f => ({ ...f, energy: Number(e.target.value) }))} className="w-full" />
              <div className="flex justify-between text-xs text-slate-600 mt-1.5">
                <span>Uitgeput</span>
                <span>Vol energie</span>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Gem. slaapuren <span className="font-normal normal-case text-slate-500">(optioneel)</span></label>
              <input type="number" step="0.5" min={0} max={24} value={form.sleep_hrs} onChange={e => setForm(f => ({ ...f, sleep_hrs: e.target.value }))} className={inputCls} placeholder="7.5" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5">Notities <span className="font-normal normal-case text-slate-500">(optioneel)</span></label>
              <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} rows={3} className={inputCls + ' resize-none'} placeholder="Hoe voelden de trainingen? Hoogtepunten of struggles deze week?" />
            </div>

            {error && <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm rounded-xl px-4 py-3">{error}</div>}

            <button type="submit" disabled={loading} className="w-full bg-brand-600 hover:bg-brand-700 text-white font-semibold py-3 rounded-xl text-sm transition-colors disabled:opacity-50 shadow-sm">
              {loading ? 'Versturen...' : 'Check-in versturen'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
