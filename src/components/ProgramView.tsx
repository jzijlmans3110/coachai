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

  const updateExercise = (weekIdx: number, dayIdx: number, exIdx: number, field: keyof Exercise, value: string | number) => {
    setProgram(p => {
      const weeks = p.content.weeks.map((w, wi) => {
        if (wi !== weekIdx) return w
        return {
          ...w,
          days: w.days.map((d, di) => {
            if (di !== dayIdx) return d
            return {
              ...d,
              exercises: d.exercises.map((ex, ei) => {
                if (ei !== exIdx) return ex
                return { ...ex, [field]: value }
              }),
            }
          }),
        }
      })
      return { ...p, content: { ...p.content, weeks } }
    })
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

  return (
    <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
        <input
          type="text"
          value={program.title}
          onChange={e => { setProgram(p => ({ ...p, title: e.target.value })); setSaved(false) }}
          className="text-lg font-semibold text-gray-900 bg-transparent focus:outline-none focus:ring-2 focus:ring-blue-400 rounded px-1"
        />
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {saving ? 'Saving...' : saved ? 'Saved!' : 'Save program'}
        </button>
      </div>

      {/* Week tabs */}
      <div className="flex border-b border-gray-100 px-6 gap-1 overflow-x-auto">
        {weeks.map((w, idx) => (
          <button
            key={idx}
            onClick={() => setActiveWeek(idx)}
            className={`px-4 py-3 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
              activeWeek === idx
                ? 'border-blue-500 text-blue-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            Week {w.week}
          </button>
        ))}
      </div>

      {/* Days */}
      <div className="p-6 space-y-6">
        {weeks[activeWeek]?.days.map((day, dayIdx) => (
          <div key={dayIdx}>
            <div className="flex items-center gap-2 mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">{day.day}</h3>
              <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">{day.focus}</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100">
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4 min-w-[160px]">Exercise</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4 w-16">Sets</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4 w-20">Reps</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2 pr-4 w-16">Rest</th>
                    <th className="text-left text-xs font-medium text-gray-500 pb-2">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {day.exercises.map((ex, exIdx) => (
                    <tr key={exIdx}>
                      <td className="py-2 pr-4">
                        <input
                          value={ex.name}
                          onChange={e => updateExercise(activeWeek, dayIdx, exIdx, 'name', e.target.value)}
                          className="w-full bg-transparent focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5 text-gray-900"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          type="number"
                          value={ex.sets}
                          onChange={e => updateExercise(activeWeek, dayIdx, exIdx, 'sets', Number(e.target.value))}
                          className="w-12 bg-transparent focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5 text-gray-700"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          value={ex.reps}
                          onChange={e => updateExercise(activeWeek, dayIdx, exIdx, 'reps', e.target.value)}
                          className="w-16 bg-transparent focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5 text-gray-700"
                        />
                      </td>
                      <td className="py-2 pr-4">
                        <input
                          value={ex.rest}
                          onChange={e => updateExercise(activeWeek, dayIdx, exIdx, 'rest', e.target.value)}
                          className="w-14 bg-transparent focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5 text-gray-700"
                        />
                      </td>
                      <td className="py-2">
                        <input
                          value={ex.notes}
                          onChange={e => updateExercise(activeWeek, dayIdx, exIdx, 'notes', e.target.value)}
                          className="w-full bg-transparent focus:outline-none focus:bg-blue-50 rounded px-1 py-0.5 text-gray-500"
                          placeholder="—"
                        />
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
