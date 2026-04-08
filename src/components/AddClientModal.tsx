import { useState } from 'react'
import { X } from 'lucide-react'
import { supabase } from '../lib/supabase'

const EQUIPMENT = ['Barbell', 'Dumbbells', 'Cables', 'Bodyweight', 'Machines']

interface Props {
  onClose: () => void
  onSuccess: () => void
}

export default function AddClientModal({ onClose, onSuccess }: Props) {
  const [form, setForm] = useState({
    full_name: '',
    goal: '',
    level: 'beginner' as 'beginner' | 'intermediate' | 'advanced',
    days_per_week: 3,
    injuries: '',
    equipment: [] as string[],
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const toggleEquipment = (item: string) =>
    setForm(f => ({
      ...f,
      equipment: f.equipment.includes(item)
        ? f.equipment.filter(e => e !== item)
        : [...f.equipment, item],
    }))

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { error } = await supabase.from('clients').insert({
      coach_id: user.id,
      ...form,
      injuries: form.injuries || null,
      equipment: form.equipment.map(e => e.toLowerCase()),
    })
    if (error) { setError(error.message); setLoading(false) }
    else onSuccess()
  }

  const inputCls = "w-full px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm text-slate-900 placeholder-slate-400 focus:border-brand-500 focus:bg-white focus:ring-0 transition-colors"

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-modal w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
          <h2 className="text-base font-bold text-slate-900">Client toevoegen</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors rounded-lg p-1 hover:bg-slate-100">
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Naam</label>
            <input type="text" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} required className={inputCls} placeholder="Alex Johnson" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Doel</label>
            <input type="text" value={form.goal} onChange={e => setForm(f => ({ ...f, goal: e.target.value }))} required className={inputCls} placeholder="Spiermassa opbouwen, afvallen, marathon lopen..." />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Niveau</label>
              <select value={form.level} onChange={e => setForm(f => ({ ...f, level: e.target.value as typeof form.level }))} className={inputCls}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Gevorderd</option>
                <option value="advanced">Expert</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Dagen per week</label>
              <select value={form.days_per_week} onChange={e => setForm(f => ({ ...f, days_per_week: Number(e.target.value) }))} className={inputCls}>
                {[1,2,3,4,5,6].map(n => <option key={n} value={n}>{n} dag{n > 1 ? 'en' : ''}</option>)}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-1.5">Blessures / beperkingen <span className="font-normal normal-case text-slate-400">(optioneel)</span></label>
            <textarea value={form.injuries} onChange={e => setForm(f => ({ ...f, injuries: e.target.value }))} rows={2} className={inputCls + ' resize-none'} placeholder="bv. slechte linkerknie, schouderoperatie 2022" />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-500 uppercase tracking-wide mb-2">Beschikbare apparatuur</label>
            <div className="flex flex-wrap gap-2">
              {EQUIPMENT.map(item => (
                <button
                  key={item}
                  type="button"
                  onClick={() => toggleEquipment(item)}
                  className={`px-3 py-1.5 rounded-full text-xs font-semibold border transition-all ${
                    form.equipment.includes(item)
                      ? 'bg-brand-600 border-brand-600 text-white shadow-sm'
                      : 'bg-white border-slate-200 text-slate-600 hover:border-brand-400 hover:text-brand-600'
                  }`}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3">{error}</div>}

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2.5 text-sm font-semibold text-slate-500 hover:text-slate-700 transition-colors rounded-xl hover:bg-slate-100">
              Annuleren
            </button>
            <button type="submit" disabled={loading} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm">
              {loading ? 'Toevoegen...' : 'Client toevoegen'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
