import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { Zap, CheckCircle2, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'

const DAYS_NL = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']
const EQUIPMENT_OPTIONS = ['Dumbbells', 'Barbell', 'Bench', 'Pull-up bar', 'Cables', 'Machines', 'Kettlebell', 'Weerstandsbanden', 'Volledig gym']

export default function Intake() {
  const { token } = useParams<{ token: string }>()
  const [step, setStep] = useState(1)
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState('')

  const [form, setForm] = useState({
    full_name: '', phone: '', goal: '', age: '',
    gender: '', weight_kg: '', height_cm: '',
    level: 'beginner', days_per_week: '3',
    training_days: [] as string[], equipment: [] as string[],
    injuries: '', medical_notes: '', intake_notes: '',
  })

  const set = (field: string, value: unknown) => setForm(f => ({ ...f, [field]: value }))

  const toggleArr = (field: 'training_days' | 'equipment', val: string) => {
    const arr = form[field] as string[]
    set(field, arr.includes(val) ? arr.filter(v => v !== val) : [...arr, val])
  }

  const bmi = form.weight_kg && form.height_cm
    ? (parseFloat(form.weight_kg) / Math.pow(parseFloat(form.height_cm) / 100, 2)).toFixed(1)
    : null

  const bmiColor = bmi
    ? parseFloat(bmi) < 18.5 ? 'text-blue-600' : parseFloat(bmi) < 25 ? 'text-emerald-600' : parseFloat(bmi) < 30 ? 'text-amber-600' : 'text-rose-600'
    : ''

  const handleSubmit = async () => {
    if (!form.full_name || !form.goal) { setError('Vul je naam en doel in'); return }
    setSubmitting(true); setError('')
    const { data, error: fnError } = await supabase.functions.invoke('submit-intake', {
      body: { intake_token: token, form },
    })
    if (fnError || data?.error) { setError(data?.error || 'Er is iets misgegaan'); setSubmitting(false); return }
    setDone(true)
  }

  const inputCls = "w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
  const stepDots = [1, 2, 3, 4]

  if (done) return (
    <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl border border-slate-100 shadow-xl p-10 text-center max-w-md w-full">
        <div className="w-16 h-16 bg-emerald-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <CheckCircle2 className="h-8 w-8 text-emerald-500" />
        </div>
        <h2 className="text-2xl font-bold text-slate-900 mb-3">Intake verstuurd!</h2>
        <p className="text-slate-500 text-sm leading-relaxed">Je trainer ontvangt je gegevens en neemt zo snel mogelijk contact op. Je programma wordt voor je klaargezet.</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-6">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden">
        {/* Header */}
        <div className="bg-sidebar px-8 py-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="bg-brand-600 rounded-lg p-1.5">
              <Zap className="h-4 w-4 text-white" fill="white" />
            </div>
            <span className="font-bold text-white text-sm tracking-wide">COACH<span className="text-brand-400">AI</span></span>
          </div>
          <h1 className="text-xl font-bold text-white mb-1">Welkom! Vul je intake in</h1>
          <p className="text-slate-400 text-sm">Je trainer stelt op basis hiervan een persoonlijk programma samen</p>
          {/* Progress */}
          <div className="flex items-center gap-2 mt-4">
            {stepDots.map(s => (
              <div key={s} className={`h-1.5 rounded-full flex-1 transition-all ${s <= step ? 'bg-brand-500' : 'bg-white/10'}`} />
            ))}
          </div>
          <p className="text-xs text-slate-400 mt-2">Stap {step} van 4</p>
        </div>

        <div className="p-8">
          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">{error}</div>}

          {/* Step 1: Persoonlijk */}
          {step === 1 && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 text-base mb-2">Persoonlijke gegevens</h2>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Volledige naam *</label>
                <input type="text" placeholder="Jan Jansen" value={form.full_name} onChange={e => set('full_name', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Telefoonnummer</label>
                <input type="tel" placeholder="+31 6 12345678" value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Jouw fitnessdoel *</label>
                <input type="text" placeholder="Bijv. 10 kg afvallen, spiermassa opbouwen..." value={form.goal} onChange={e => set('goal', e.target.value)} className={inputCls} />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Geslacht</label>
                  <select value={form.gender} onChange={e => set('gender', e.target.value)} className={inputCls}>
                    <option value="">Kies...</option>
                    <option value="man">Man</option>
                    <option value="vrouw">Vrouw</option>
                    <option value="anders">Anders</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Leeftijd</label>
                  <input type="number" placeholder="25" value={form.age} onChange={e => set('age', e.target.value)} className={inputCls} />
                </div>
              </div>
            </div>
          )}

          {/* Step 2: Lichaam */}
          {step === 2 && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 text-base mb-2">Lichaamsgegevens</h2>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Gewicht (kg)</label>
                  <input type="number" step="0.1" placeholder="70" value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Lengte (cm)</label>
                  <input type="number" placeholder="175" value={form.height_cm} onChange={e => set('height_cm', e.target.value)} className={inputCls} />
                </div>
              </div>
              {bmi && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <span className="text-sm text-slate-500">BMI</span>
                  <span className={`text-lg font-bold ${bmiColor}`}>{bmi}</span>
                </div>
              )}
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Fitnessniveau</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['beginner', 'intermediate', 'advanced'] as const).map(l => (
                    <button key={l} onClick={() => set('level', l)}
                      className={`py-2 px-3 rounded-xl text-xs font-semibold border transition-all capitalize ${form.level === l ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'}`}>
                      {l === 'beginner' ? 'Beginner' : l === 'intermediate' ? 'Gemiddeld' : 'Gevorderd'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Training */}
          {step === 3 && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 text-base mb-2">Trainingsvoorkeur</h2>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Aantal trainingsdagen per week</label>
                <div className="flex gap-2">
                  {[2, 3, 4, 5, 6].map(d => (
                    <button key={d} onClick={() => set('days_per_week', String(d))}
                      className={`flex-1 py-2 rounded-xl text-sm font-bold border transition-all ${form.days_per_week === String(d) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'}`}>
                      {d}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Voorkeursdagen (optioneel)</label>
                <div className="flex flex-wrap gap-2">
                  {DAYS_NL.map(day => (
                    <button key={day} onClick={() => toggleArr('training_days', day)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${form.training_days.includes(day) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'}`}>
                      {day.slice(0, 2)}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-2">Beschikbare apparatuur</label>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT_OPTIONS.map(eq => (
                    <button key={eq} onClick={() => toggleArr('equipment', eq)}
                      className={`text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${form.equipment.includes(eq) ? 'bg-brand-600 text-white border-brand-600' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-300'}`}>
                      {eq}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Gezondheid */}
          {step === 4 && (
            <div className="space-y-4">
              <h2 className="font-bold text-slate-900 text-base mb-2">Gezondheid & opmerkingen</h2>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Blessures of lichamelijke beperkingen</label>
                <input type="text" placeholder="Bijv. knieblessure links, rugklachten..." value={form.injuries} onChange={e => set('injuries', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Medische aandoeningen (optioneel)</label>
                <input type="text" placeholder="Bijv. diabetes type 2, hoge bloeddruk..." value={form.medical_notes} onChange={e => set('medical_notes', e.target.value)} className={inputCls} />
              </div>
              <div>
                <label className="text-xs font-semibold text-slate-500 block mb-1">Nog iets dat je trainer moet weten?</label>
                <textarea rows={3} placeholder="Schrijf hier alles wat relevant is..." value={form.intake_notes} onChange={e => set('intake_notes', e.target.value)} className={inputCls + ' resize-none'} />
              </div>
            </div>
          )}

          {/* Navigation */}
          <div className="flex items-center justify-between mt-8">
            {step > 1
              ? <button onClick={() => setStep(s => s - 1)} className="text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors">← Terug</button>
              : <div />}
            {step < 4
              ? <button onClick={() => { if (step === 1 && (!form.full_name || !form.goal)) { setError('Vul je naam en doel in'); return } setError(''); setStep(s => s + 1) }}
                className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors">
                Volgende →
              </button>
              : <button onClick={handleSubmit} disabled={submitting}
                className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-6 py-2.5 rounded-xl transition-colors disabled:opacity-50">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {submitting ? 'Versturen...' : 'Intake versturen'}
              </button>}
          </div>
        </div>
      </div>
    </div>
  )
}
