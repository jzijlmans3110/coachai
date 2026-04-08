import { useEffect, useState } from 'react'
import { useParams } from 'react-router-dom'
import { Zap, Loader2, ClipboardList, Utensils, Target, Trophy, CheckCircle2, Calendar } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Program, CheckIn, MealPlan, Milestone } from '../lib/types'

interface PortalClient {
  id: string
  full_name: string
  goal: string
  level: string
  days_per_week: number
  weight_kg: number | null
  height_cm: number | null
  training_days: string[]
}

type Tab = 'programma' | 'checkins' | 'voeding' | 'doelen'

export default function Portal() {
  const { token } = useParams<{ token: string }>()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [client, setClient] = useState<PortalClient | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [tab, setTab] = useState<Tab>('programma')
  const [activeWeek, setActiveWeek] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data, error: fnError } = await supabase.functions.invoke('get-portal-data', {
        body: { portal_token: token },
      })
      if (fnError || data?.error) { setError(data?.error || 'Ongeldig portaal'); setLoading(false); return }
      setClient(data.client)
      setPrograms(data.programs ?? [])
      setCheckIns(data.checkIns ?? [])
      setMealPlans(data.mealPlans ?? [])
      setMilestones(data.milestones ?? [])
      setLoading(false)
    }
    load()
  }, [token])

  const latestProgram = programs[0]
  const weeks = latestProgram?.content?.weeks ?? []
  const avgEnergy = checkIns.length
    ? (checkIns.reduce((s, c) => s + c.energy, 0) / checkIns.length).toFixed(1)
    : null

  const consistencyScore = (() => {
    if (checkIns.length === 0) return null
    const unique = new Set(checkIns.map(c => c.week_number)).size
    const max = Math.max(...checkIns.map(c => c.week_number))
    return Math.round((unique / max) * 100)
  })()

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'programma', label: 'Programma', icon: <Calendar className="h-3.5 w-3.5" /> },
    { key: 'checkins', label: 'Check-ins', icon: <ClipboardList className="h-3.5 w-3.5" /> },
    { key: 'voeding', label: 'Voeding', icon: <Utensils className="h-3.5 w-3.5" /> },
    { key: 'doelen', label: 'Doelen', icon: <Target className="h-3.5 w-3.5" /> },
  ]

  if (loading) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 text-brand-400 animate-spin mx-auto mb-3" />
        <p className="text-slate-400 text-sm">Portaal laden...</p>
      </div>
    </div>
  )

  if (error || !client) return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-6">
      <div className="bg-white/10 border border-white/10 rounded-2xl p-8 text-center max-w-sm">
        <p className="text-white font-semibold mb-2">Portaal niet gevonden</p>
        <p className="text-slate-400 text-sm">{error || 'Controleer de link die je van je trainer hebt ontvangen.'}</p>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen bg-slate-900">
      {/* Top bar */}
      <div className="bg-sidebar border-b border-white/5 px-6 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-brand-600 rounded-lg p-1.5">
              <Zap className="h-4 w-4 text-white" fill="white" />
            </div>
            <span className="font-bold text-white text-sm tracking-wide">COACH<span className="text-brand-400">AI</span></span>
          </div>
          <p className="text-slate-400 text-sm">Jouw persoonlijk portaal</p>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-8">
        {/* Profile card */}
        <div className="bg-white/5 border border-white/10 rounded-2xl p-5 mb-6">
          <div className="flex items-center gap-4 mb-4">
            <div className="w-12 h-12 rounded-xl bg-brand-600 flex items-center justify-center text-white text-lg font-bold">
              {client.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">{client.full_name}</h1>
              <p className="text-slate-400 text-sm">{client.goal}</p>
            </div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            {[
              { label: 'Niveau', value: client.level, color: 'text-emerald-400' },
              { label: 'Gem. energie', value: avgEnergy ? `${avgEnergy}/10` : '—', color: 'text-amber-400' },
              { label: 'Consistentie', value: consistencyScore !== null ? `${consistencyScore}%` : '—', color: 'text-brand-400' },
              { label: 'Check-ins', value: checkIns.length.toString(), color: 'text-blue-400' },
            ].map(({ label, value, color }) => (
              <div key={label} className="bg-white/5 rounded-xl px-3 py-2.5">
                <p className="text-xs text-slate-500 mb-1">{label}</p>
                <p className={`text-base font-bold ${color} capitalize`}>{value}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 mb-5 bg-white/5 p-1 rounded-2xl">
          {tabs.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
                tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-300'
              }`}>
              {t.icon}{t.label}
            </button>
          ))}
        </div>

        {/* Programma */}
        {tab === 'programma' && (
          <div>
            {!latestProgram ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-10 text-center">
                <p className="text-slate-400 text-sm">Je trainer heeft nog geen programma voor je klaargezet.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-slate-900">{latestProgram.title}</h2>
                  <p className="text-xs text-slate-400 mt-0.5">{latestProgram.weeks} weken · {new Date(latestProgram.created_at).toLocaleDateString('nl-NL')}</p>
                </div>
                {/* Week tabs */}
                <div className="flex border-b border-slate-50 px-5 gap-1 overflow-x-auto">
                  {weeks.map((w, idx) => (
                    <button key={idx} onClick={() => setActiveWeek(idx)}
                      className={`px-4 py-3 text-xs font-semibold whitespace-nowrap border-b-2 transition-all ${activeWeek === idx ? 'border-brand-600 text-brand-600' : 'border-transparent text-slate-400 hover:text-slate-600'}`}>
                      Week {w.week}
                    </button>
                  ))}
                </div>
                <div className="p-5 space-y-6">
                  {weeks[activeWeek]?.days.map((day, di) => (
                    <div key={di}>
                      <div className="flex items-center gap-2 mb-3">
                        <h3 className="font-bold text-slate-900 text-sm">{day.day}</h3>
                        <span className="text-xs bg-slate-100 text-slate-500 px-2 py-0.5 rounded-full">{day.focus}</span>
                      </div>
                      <div className="space-y-2">
                        {day.exercises.map((ex, ei) => (
                          <div key={ei} className="flex items-center justify-between bg-slate-50 rounded-xl px-4 py-3">
                            <p className="text-sm font-semibold text-slate-800">{ex.name}</p>
                            <div className="flex items-center gap-4 text-xs text-slate-500">
                              <span><span className="font-bold text-slate-700">{ex.sets}</span> sets</span>
                              <span><span className="font-bold text-slate-700">{ex.reps}</span> reps</span>
                              <span>{ex.rest} rust</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Check-ins */}
        {tab === 'checkins' && (
          <div className="space-y-3">
            {checkIns.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-10 text-center">
                <p className="text-slate-400 text-sm">Nog geen check-ins ingediend.</p>
              </div>
            ) : checkIns.map(ci => (
              <div key={ci.id} className="bg-white rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <p className="font-semibold text-slate-900 text-sm">Week {ci.week_number}</p>
                  <p className="text-xs text-slate-400">{new Date(ci.submitted_at).toLocaleDateString('nl-NL')}</p>
                </div>
                <div className="flex items-center gap-4 mb-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${ci.energy >= 7 ? 'bg-emerald-400' : ci.energy >= 5 ? 'bg-amber-400' : 'bg-rose-400'}`} />
                    <span className="text-xs text-slate-600">Energie <strong>{ci.energy}/10</strong></span>
                  </div>
                  {ci.weight_kg && <span className="text-xs text-slate-500">⚖ {ci.weight_kg} kg</span>}
                  {ci.sleep_hrs && <span className="text-xs text-slate-500">🌙 {ci.sleep_hrs}u</span>}
                </div>
                {ci.ai_feedback && (
                  <div className="bg-brand-50 border border-brand-100 rounded-xl px-3 py-2.5 mt-2">
                    <p className="text-xs font-bold text-brand-600 mb-1">Feedback van AI</p>
                    <p className="text-xs text-brand-800 leading-relaxed">{ci.ai_feedback}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Voeding */}
        {tab === 'voeding' && (
          <div>
            {mealPlans.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-10 text-center">
                <p className="text-slate-400 text-sm">Je trainer heeft nog geen voedingsplan voor je gemaakt.</p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl overflow-hidden">
                <div className="px-5 py-4 border-b border-slate-100">
                  <h2 className="font-bold text-slate-900">{mealPlans[0].content.title}</h2>
                  <div className="flex gap-4 mt-2 text-xs text-slate-500">
                    <span className="text-orange-600 font-semibold">{mealPlans[0].content.calories_target} kcal/dag</span>
                    <span>{mealPlans[0].content.protein_target}g eiwit</span>
                    {mealPlans[0].content.carbs_target && <span>{mealPlans[0].content.carbs_target}g koolh.</span>}
                  </div>
                </div>
                <div className="p-5 space-y-4">
                  {mealPlans[0].content.days.map((day, di) => (
                    <div key={di}>
                      <div className="flex items-center justify-between mb-2">
                        <h3 className="font-bold text-slate-900 text-sm">{day.day}</h3>
                        <span className="text-xs text-orange-600 font-semibold">{day.total_calories} kcal</span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {day.meals.map((meal, mi) => (
                          <div key={mi} className="bg-slate-50 rounded-xl p-3">
                            <div className="flex items-center justify-between mb-1.5">
                              <p className="text-xs font-bold text-slate-700">{meal.name}</p>
                              {meal.time && <p className="text-xs text-slate-400">{meal.time}</p>}
                            </div>
                            <ul className="space-y-0.5 mb-2">
                              {meal.foods.map((f, fi) => <li key={fi} className="text-xs text-slate-600">· {f}</li>)}
                            </ul>
                            <span className="text-xs text-orange-600 font-semibold">{meal.calories} kcal</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Doelen */}
        {tab === 'doelen' && (
          <div className="space-y-2">
            {milestones.length === 0 ? (
              <div className="bg-white/5 border border-white/10 rounded-2xl px-6 py-10 text-center">
                <p className="text-slate-400 text-sm">Nog geen doelen ingesteld door je trainer.</p>
              </div>
            ) : milestones.map(m => (
              <div key={m.id} className={`rounded-2xl p-4 ${m.achieved_at ? 'bg-emerald-500/10 border border-emerald-500/20' : 'bg-white/5 border border-white/10'}`}>
                <div className="flex items-center gap-3">
                  {m.achieved_at
                    ? <Trophy className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                    : <CheckCircle2 className="h-5 w-5 text-slate-500 flex-shrink-0" />}
                  <div>
                    <p className={`text-sm font-semibold ${m.achieved_at ? 'text-emerald-300' : 'text-white'}`}>{m.title}</p>
                    <div className="flex gap-3 mt-0.5">
                      {m.target_date && <p className="text-xs text-slate-500">Streefdatum: {new Date(m.target_date).toLocaleDateString('nl-NL')}</p>}
                      {m.achieved_at && <p className="text-xs text-emerald-500 font-semibold">✓ Behaald!</p>}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
