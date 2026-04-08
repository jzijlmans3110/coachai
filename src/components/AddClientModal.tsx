import { useState } from 'react'
import { X, User, Target, Dumbbell, Heart } from 'lucide-react'
import { supabase } from '../lib/supabase'

const EQUIPMENT = ['Barbell', 'Dumbbells', 'Cables', 'Bodyweight', 'Machines', 'Kettlebell', 'Weerstandsbanden']

interface Props {
  onClose: () => void
  onSuccess: () => void
}

type Step = 1 | 2 | 3 | 4

export default function AddClientModal({ onClose, onSuccess }: Props) {
  const [step, setStep] = useState<Step>(1)
  const [form, setForm] = useState({
    full_name: '',
    phone: '',
    gender: '' as 'man' | 'vrouw' | 'anders' | '',
    age: '',
    weight_kg: '',
    height_cm: '',
    goal: '',
    level: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    days_per_week: 3,
    training_time: '' as 'ochtend' | 'middag' | 'avond' | 'wisselend' | '',
    experience_years: '',
    equipment: [] as string[],
    injuries: '',
    medical_notes: '',
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const set = (key: keyof typeof form, value: unknown) =>
    setForm(f => ({ ...f, [key]: value }))

  const toggleEquipment = (item: string) =>
    setForm(f => ({
      ...f,
      equipment: f.equipment.includes(item)
        ? f.equipment.filter(e => e !== item)
        : [...f.equipment, item],
    }))

  const handleSubmit = async () => {
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase.from('clients').insert({
      coach_id: user.id,
      full_name: form.full_name,
      phone: form.phone || null,
      gender: form.gender || null,
      age: form.age ? Number(form.age) : null,
      weight_kg: form.weight_kg ? Number(form.weight_kg) : null,
      height_cm: form.height_cm ? Number(form.height_cm) : null,
      goal: form.goal,
      level: form.level,
      days_per_week: form.days_per_week,
      training_time: form.training_time || null,
      experience_years: form.experience_years ? Number(form.experience_years) : null,
      equipment: form.equipment,
      injuries: form.injuries || null,
      medical_notes: form.medical_notes || null,
    })

    if (error) { setError(error.message); setLoading(false) }
    else onSuccess()
  }

  const inputCls = "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:ring-0 transition-colors"
  const labelCls = "block text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1.5"

  const bmi = form.weight_kg && form.height_cm
    ? (Number(form.weight_kg) / Math.pow(Number(form.height_cm) / 100, 2)).toFixed(1)
    : null
  const bmiLabel = bmi
    ? parseFloat(bmi) < 18.5 ? 'Ondergewicht'
      : parseFloat(bmi) < 25 ? 'Gezond gewicht'
      : parseFloat(bmi) < 30 ? 'Overgewicht'
      : 'Obesitas'
    : null
  const bmiColor = bmi
    ? parseFloat(bmi) < 18.5 ? 'text-blue-600'
      : parseFloat(bmi) < 25 ? 'text-emerald-600'
      : parseFloat(bmi) < 30 ? 'text-amber-600'
      : 'text-rose-600'
    : ''

  const steps = [
    { num: 1, label: 'Profiel', icon: User },
    { num: 2, label: 'Lichaam', icon: Target },
    { num: 3, label: 'Training', icon: Dumbbell },
    { num: 4, label: 'Gezondheid', icon: Heart },
  ]

  const canNext = () => {
    if (step === 1) return form.full_name.trim().length > 0
    if (step === 2) return true
    if (step === 3) return form.goal.trim().length > 0
    return true
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Client toevoegen</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Steps */}
        <div className="flex items-center px-6 py-4 border-b border-slate-50 gap-2">
          {steps.map(({ num, label, icon: Icon }, i) => (
            <div key={num} className="flex items-center gap-2 flex-1">
              <button
                onClick={() => num < step && setStep(num as Step)}
                className={`flex items-center gap-1.5 text-xs font-semibold transition-colors ${
                  step === num ? 'text-brand-600' : num < step ? 'text-emerald-600 cursor-pointer' : 'text-slate-300'
                }`}
              >
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  step === num ? 'bg-brand-600 text-white' : num < step ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-400'
                }`}>
                  {num < step ? '✓' : <Icon className="h-3 w-3" />}
                </div>
                <span className="hidden sm:block">{label}</span>
              </button>
              {i < steps.length - 1 && <div className={`flex-1 h-px transition-colors ${num < step ? 'bg-emerald-200' : 'bg-slate-100'}`} />}
            </div>
          ))}
        </div>

        {/* Content */}
        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {/* Step 1: Profiel */}
          {step === 1 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Naam <span className="text-rose-400">*</span></label>
                <input type="text" value={form.full_name} onChange={e => set('full_name', e.target.value)} required className={inputCls} placeholder="Alex Johnson" autoFocus />
              </div>
              <div>
                <label className={labelCls}>Telefoonnummer <span className="text-slate-300 font-normal normal-case">(optioneel)</span></label>
                <input type="tel" value={form.phone} onChange={e => set('phone', e.target.value)} className={inputCls} placeholder="+31 6 12345678" />
              </div>
              <div>
                <label className={labelCls}>Geslacht</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['man', 'vrouw', 'anders'] as const).map(g => (
                    <button key={g} type="button" onClick={() => set('gender', form.gender === g ? '' : g)}
                      className={`py-2.5 rounded-xl text-sm font-semibold border capitalize transition-all ${form.gender === g ? 'bg-brand-600 border-brand-600 text-white' : 'bg-slate-50 border-slate-200 text-slate-600 hover:border-brand-400'}`}>
                      {g === 'man' ? '♂ Man' : g === 'vrouw' ? '♀ Vrouw' : '⚧ Anders'}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <label className={labelCls}>Leeftijd</label>
                <input type="number" min={10} max={99} value={form.age} onChange={e => set('age', e.target.value)} className={inputCls} placeholder="28" />
              </div>
            </div>
          )}

          {/* Step 2: Lichaam */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Gewicht (kg)</label>
                  <input type="number" step="0.1" value={form.weight_kg} onChange={e => set('weight_kg', e.target.value)} className={inputCls} placeholder="75.0" />
                </div>
                <div>
                  <label className={labelCls}>Lengte (cm)</label>
                  <input type="number" value={form.height_cm} onChange={e => set('height_cm', e.target.value)} className={inputCls} placeholder="178" />
                </div>
              </div>

              {/* BMI */}
              {bmi && (
                <div className="bg-slate-50 rounded-xl px-4 py-3 flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">BMI</p>
                    <p className={`text-2xl font-bold mt-0.5 ${bmiColor}`}>{bmi}</p>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-semibold ${bmiColor}`}>{bmiLabel}</p>
                    <p className="text-xs text-slate-400 mt-0.5">Body Mass Index</p>
                  </div>
                </div>
              )}

              <div className="bg-slate-50 rounded-xl p-4">
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">BMI schaal</p>
                <div className="space-y-1.5">
                  {[
                    { range: '< 18.5', label: 'Ondergewicht', color: 'bg-blue-400' },
                    { range: '18.5 – 24.9', label: 'Gezond gewicht', color: 'bg-emerald-400' },
                    { range: '25 – 29.9', label: 'Overgewicht', color: 'bg-amber-400' },
                    { range: '≥ 30', label: 'Obesitas', color: 'bg-rose-400' },
                  ].map(({ range, label, color }) => (
                    <div key={label} className="flex items-center gap-2">
                      <div className={`w-2 h-2 rounded-full ${color}`} />
                      <span className="text-xs text-slate-500 w-24">{range}</span>
                      <span className="text-xs text-slate-600 font-medium">{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 3: Training */}
          {step === 3 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Trainingsdoel <span className="text-rose-400">*</span></label>
                <input type="text" value={form.goal} onChange={e => set('goal', e.target.value)} required className={inputCls} placeholder="Spiermassa opbouwen, afvallen, conditie verbeteren..." />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Niveau</label>
                  <select value={form.level} onChange={e => set('level', e.target.value)} className={inputCls}>
                    <option value="beginner">Beginner</option>
                    <option value="intermediate">Gevorderd</option>
                    <option value="advanced">Expert</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Dagen per week</label>
                  <select value={form.days_per_week} onChange={e => set('days_per_week', Number(e.target.value))} className={inputCls}>
                    {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} dag{n > 1 ? 'en' : ''}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Trainingstijd voorkeur</label>
                  <select value={form.training_time} onChange={e => set('training_time', e.target.value)} className={inputCls}>
                    <option value="">Geen voorkeur</option>
                    <option value="ochtend">Ochtend</option>
                    <option value="middag">Middag</option>
                    <option value="avond">Avond</option>
                    <option value="wisselend">Wisselend</option>
                  </select>
                </div>
                <div>
                  <label className={labelCls}>Ervaring (jaren)</label>
                  <input type="number" min={0} max={50} step="0.5" value={form.experience_years} onChange={e => set('experience_years', e.target.value)} className={inputCls} placeholder="2" />
                </div>
              </div>
              <div>
                <label className={labelCls}>Beschikbare apparatuur</label>
                <div className="flex flex-wrap gap-2">
                  {EQUIPMENT.map(item => (
                    <button key={item} type="button" onClick={() => toggleEquipment(item)}
                      className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${form.equipment.includes(item) ? 'bg-brand-600 border-brand-600 text-white shadow-sm' : 'bg-white border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600'}`}>
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Step 4: Gezondheid */}
          {step === 4 && (
            <div className="space-y-4">
              <div>
                <label className={labelCls}>Blessures / beperkingen <span className="text-slate-300 font-normal normal-case">(optioneel)</span></label>
                <textarea value={form.injuries} onChange={e => set('injuries', e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="bv. slechte linkerknie, schouderoperatie 2022, hernia L4-L5..." />
              </div>
              <div>
                <label className={labelCls}>Medische notities <span className="text-slate-300 font-normal normal-case">(optioneel)</span></label>
                <textarea value={form.medical_notes} onChange={e => set('medical_notes', e.target.value)} rows={3} className={inputCls + ' resize-none'} placeholder="bv. hoge bloeddruk, diabetes type 2, medicijngebruik..." />
              </div>
              <div className="bg-amber-50 border border-amber-100 rounded-xl p-4">
                <p className="text-xs font-bold text-amber-700 mb-1">⚕ Medische disclaimer</p>
                <p className="text-xs text-amber-600 leading-relaxed">
                  Zorg dat de client toestemming heeft gegeven voor het verwerken van medische gegevens conform de AVG/GDPR. Bewaar deze informatie vertrouwelijk.
                </p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <div className="mx-6 mb-2 bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>
        )}

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-slate-100">
          <button
            type="button"
            onClick={step === 1 ? onClose : () => setStep((step - 1) as Step)}
            className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 hover:bg-slate-100 transition-colors rounded-xl"
          >
            {step === 1 ? 'Annuleren' : '← Terug'}
          </button>

          <div className="flex items-center gap-3">
            <div className="flex gap-1.5">
              {[1,2,3,4].map(n => (
                <div key={n} className={`h-1.5 rounded-full transition-all ${n === step ? 'w-4 bg-brand-600' : n < step ? 'w-1.5 bg-emerald-400' : 'w-1.5 bg-slate-200'}`} />
              ))}
            </div>
            {step < 4 ? (
              <button
                type="button"
                onClick={() => setStep((step + 1) as Step)}
                disabled={!canNext()}
                className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-40 shadow-sm"
              >
                Volgende →
              </button>
            ) : (
              <button
                type="button"
                onClick={handleSubmit}
                disabled={loading || !form.goal.trim()}
                className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
              >
                {loading ? 'Toevoegen...' : 'Client toevoegen ✓'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
