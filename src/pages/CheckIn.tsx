import { useState } from 'react'
import { useParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { Dumbbell, CheckCircle } from 'lucide-react'

export default function CheckIn() {
  const { clientId } = useParams<{ clientId: string }>()
  const [form, setForm] = useState({
    week_number: 1,
    weight_kg: '',
    energy: 7,
    sleep_hrs: '',
    notes: '',
  })
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
      .select()
      .single()

    if (insertError) {
      setError('Something went wrong. Please try again.')
      setLoading(false)
      return
    }

    // Trigger AI feedback (fire and forget)
    if (data?.id) {
      supabase.functions.invoke('generate-checkin-feedback', { body: { check_in_id: data.id } })
    }

    setSubmitted(true)
    setLoading(false)
  }

  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8 text-center">
          <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-4">
            <CheckCircle className="h-7 w-7 text-green-500" />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Check-in submitted!</h2>
          <p className="text-gray-500 text-sm">Thanks! Your coach will review your check-in and you'll receive personalized feedback soon.</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 w-full max-w-md p-8">
        <div className="flex items-center gap-2 mb-6">
          <div className="bg-blue-500 rounded-lg p-1.5">
            <Dumbbell className="h-5 w-5 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">CoachAI</span>
        </div>

        <h1 className="text-2xl font-bold text-gray-900 mb-1">Weekly check-in</h1>
        <p className="text-gray-500 text-sm mb-6">Track your progress so your coach can adjust your program.</p>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Week number</label>
            <input
              type="number"
              min={1}
              value={form.week_number}
              onChange={e => setForm(f => ({ ...f, week_number: Number(e.target.value) }))}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Weight <span className="text-gray-400 font-normal">(kg, optional)</span>
            </label>
            <input
              type="number"
              step="0.1"
              value={form.weight_kg}
              onChange={e => setForm(f => ({ ...f, weight_kg: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="75.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Energy level: <span className="text-blue-500 font-semibold">{form.energy}/10</span>
            </label>
            <input
              type="range"
              min={1}
              max={10}
              value={form.energy}
              onChange={e => setForm(f => ({ ...f, energy: Number(e.target.value) }))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-gray-400 mt-1">
              <span>Exhausted</span>
              <span>Full of energy</span>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Avg. sleep hours <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <input
              type="number"
              step="0.5"
              min={0}
              max={24}
              value={form.sleep_hrs}
              onChange={e => setForm(f => ({ ...f, sleep_hrs: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              placeholder="7.5"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Notes <span className="text-gray-400 font-normal">(optional)</span>
            </label>
            <textarea
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
              placeholder="How did the workouts feel? Any wins or struggles this week?"
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-medium py-2.5 rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            {loading ? 'Submitting...' : 'Submit check-in'}
          </button>
        </form>
      </div>
    </div>
  )
}
