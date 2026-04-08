import { useState } from 'react'
import { Save } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Program, Exercise } from '../lib/types'

interface Props {
  program: Program
  onSaved?: () => void
}

export default function ProgramView({ program: initialProgram, onSaved }: Props) {
  const [program, setProgram] = useState(initialProgram)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [activeWeek, setActiveWeek] = useState(0)

  const updateExercise = (wi: number, di: number, ei: number, field: keyof Exercise, value: string | number) => {
    setProgram(p => ({
      ...p,
      content: {
        ...p.content,
        weeks: p.content.weeks.map((w, wIdx) => wIdx !== wi ? w : {
          ...w,
          days: w.days.map((d, dIdx) => dIdx !== di ? d : {
            ...d,
            exercises: d.exercises.map((ex, eIdx) => eIdx !== ei ? ex : { ...ex, [field]: value }),
          }),
        }),
      },
    }))
    setSaved(false)
  }

  const handleSave = async () => {
    setSaving(true)
    await supabase.from('programs').update({ content: program.content, title: program.title }).eq('id', program.id)
    setSaving(false)
    setSaved(true)
    onSaved?.()
  }

  const weeks = program.content.weeks ?? []

  const inputCls = "w-full bg-transparent focus:outline-none focus:bg-slate-50 rounded-lg px-1.5 py-1 text-slate-800 transition-colors"

  return (
    <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
        <input
          type="text"
          value={program.title}
          onChange={e => { setProgram(p => ({ ...p, title: e.target.value })); setSaved(false) }}
          className="text-base font-bold text-slate-900 bg-transparent focus:outline-none focus:bg-slate-50 rounded-lg px-2 py-1 transition-colors flex-1 mr-4"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-50 shadow-sm flex-shrink-0"
        >
          <Save className="h-3.5 w-3.5" />
          {saving ? 'Opslaan...' : saved ? '✓ Opgeslagen' : 'Programma opslaan'}
        </button>
      </div>

      {/* Week tabs */}
      <div className="flex border-b border-slate-50 px-6 gap-1 overflow-x-auto">
        {weeks.map((w, idx) => (
          <button
            key={idx}
            onClick={() => setActiveWeek(idx)}
            className={`px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${
              activeWeek === idx
                ? 'border-brand-600 text-brand-600'
                : 'border-transparent text-slate-400 hover:text-slate-600'
            }`}
          >
            Week {w.week}
          </button>
        ))}
      </div>

      {/* Days */}
      <div className="p-6 space-y-8">
        {weeks[activeWeek]?.days.map((day, di) => (
          <div key={di}>
            <div className="flex items-center gap-2 mb-4">
              <h3 className="font-bold text-slate-900 text-sm">{day.day}</h3>
              <span className="text-xs font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">{day.focus}</span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-100">
              <table className="w-full text-sm">
                <thead>
                  <tr className="bg-slate-50 border-b border-slate-100">
                    {['Oefening', 'Sets', 'Reps', 'Rust', 'Notities'].map(h => (
                      <th key={h} className="text-left text-xs font-semibold text-slate-400 px-3 py-2.5 first:pl-4 last:pr-4">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {day.exercises.map((ex, ei) => (
                    <tr key={ei} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-3 py-2 first:pl-4 min-w-[160px]">
                        <input value={ex.name} onChange={e => updateExercise(activeWeek, di, ei, 'name', e.target.value)} className={inputCls + ' font-medium'} />
                      </td>
                      <td className="px-3 py-2 w-16">
                        <input type="number" value={ex.sets} onChange={e => updateExercise(activeWeek, di, ei, 'sets', Number(e.target.value))} className={inputCls + ' w-12 text-slate-600'} />
                      </td>
                      <td className="px-3 py-2 w-20">
                        <input value={ex.reps} onChange={e => updateExercise(activeWeek, di, ei, 'reps', e.target.value)} className={inputCls + ' w-16 text-slate-600'} />
                      </td>
                      <td className="px-3 py-2 w-16">
                        <input value={ex.rest} onChange={e => updateExercise(activeWeek, di, ei, 'rest', e.target.value)} className={inputCls + ' w-14 text-slate-600'} />
                      </td>
                      <td className="px-3 py-2 last:pr-4">
                        <input value={ex.notes} onChange={e => updateExercise(activeWeek, di, ei, 'notes', e.target.value)} className={inputCls + ' text-slate-400'} placeholder="—" />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
