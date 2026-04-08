import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Zap, Calendar, ClipboardList, Loader2, Brain, TrendingUp, TrendingDown, Minus, RefreshCw, Copy, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client, Program, CheckIn } from '../lib/types'
import ProgramView from '../components/ProgramView'

interface Insights {
  samenvatting: string
  energie_trend: 'stijgend' | 'dalend' | 'stabiel'
  aandachtspunten: string[]
  sterke_punten: string[]
  aanbevelingen: string[]
  score: number
  score_toelichting: string
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [generating, setGenerating] = useState(false)
  const [generatedProgram, setGeneratedProgram] = useState<Program | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  // AI Insights
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)

  // Adjust program
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [adjustedProgram, setAdjustedProgram] = useState<Program | null>(null)

  // Copy link
  const [copied, setCopied] = useState(false)

  const loadData = useCallback(async () => {
    if (!id) return
    const [{ data: clientData }, { data: programsData }, { data: checkInsData }] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('programs').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('check_ins').select('*').eq('client_id', id).order('submitted_at', { ascending: false }),
    ])
    setClient(clientData)
    setPrograms(programsData ?? [])
    setCheckIns(checkInsData ?? [])
    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])

  const handleGenerate = async () => {
    if (!client) return
    setGenerating(true)
    setError('')
    setGeneratedProgram(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data, error } = await supabase.functions.invoke('generate-program', {
      body: { client_id: client.id, coach_id: user.id },
    })
    if (error || data?.error) setError(data?.error || `Fout: ${error?.message}`)
    else if (data?.program) { setGeneratedProgram(data.program); loadData() }
    setGenerating(false)
  }

  const handleInsights = async () => {
    if (!client) return
    setLoadingInsights(true)
    setInsights(null)
    const { data } = await supabase.functions.invoke('ai-insights', {
      body: { client_id: client.id },
    })
    if (data?.insights) setInsights(data.insights)
    setLoadingInsights(false)
  }

  const handleAdjust = async (program: Program) => {
    if (!client) return
    setAdjusting(program.id)
    setAdjustedProgram(null)
    const { data: { user } } = await supabase.auth.getUser()
    const { data, error } = await supabase.functions.invoke('adjust-program', {
      body: { program_id: program.id, client_id: client.id, coach_id: user?.id },
    })
    if (data?.program) { setAdjustedProgram(data.program); loadData() }
    else setError(data?.error || error?.message || 'Aanpassen mislukt')
    setAdjusting(null)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/checkin/${client?.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const levelBadge = (level: string) => ({
    beginner: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60',
    intermediate: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60',
    advanced: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/60',
  }[level] ?? 'bg-slate-100 text-slate-600')

  const trendIcon = (t: string) => t === 'stijgend'
    ? <TrendingUp className="h-4 w-4 text-emerald-500" />
    : t === 'dalend' ? <TrendingDown className="h-4 w-4 text-rose-500" />
    : <Minus className="h-4 w-4 text-slate-400" />

  const avgEnergy = checkIns.length
    ? (checkIns.reduce((s, c) => s + c.energy, 0) / checkIns.length).toFixed(1)
    : null

  const avgSleep = checkIns.filter(c => c.sleep_hrs).length
    ? (checkIns.filter(c => c.sleep_hrs).reduce((s, c) => s + (c.sleep_hrs ?? 0), 0) / checkIns.filter(c => c.sleep_hrs).length).toFixed(1)
    : null

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!client) return <div className="p-8 text-slate-400">Client niet gevonden.</div>

  return (
    <div className="p-8 max-w-5xl">
      <Link to="/clients" className="flex items-center gap-1.5 text-sm text-slate-400 hover:text-slate-600 mb-6 transition-colors">
        <ArrowLeft className="h-4 w-4" /> Terug naar clients
      </Link>

      {/* Client card */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-6 mb-5">
        <div className="flex items-start justify-between mb-5">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-brand-600 flex items-center justify-center text-white text-xl font-bold">
              {client.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">{client.full_name}</h1>
              <p className="text-slate-400 text-sm mt-0.5">{client.goal}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${levelBadge(client.level)}`}>{client.level}</span>
                <span className="text-xs text-slate-400">{client.days_per_week}×/week</span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-400">{programs.length} programma{programs.length !== 1 ? "'s" : ''}</span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-400">{checkIns.length} check-ins</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleInsights}
              disabled={loadingInsights}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
            >
              {loadingInsights ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              AI Analyse
            </button>
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm"
            >
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {generating ? 'Genereren...' : 'Programma genereren'}
            </button>
          </div>
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-3">
          {[
            { label: 'Gem. energie', value: avgEnergy ? `${avgEnergy}/10` : '—', color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Gem. slaap', value: avgSleep ? `${avgSleep}u` : '—', color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Check-ins', value: checkIns.length.toString(), color: 'text-brand-600', bg: 'bg-brand-50' },
            { label: "Programma's", value: programs.length.toString(), color: 'text-emerald-600', bg: 'bg-emerald-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl px-4 py-3`}>
              <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Equipment + injuries */}
        <div className="grid grid-cols-2 gap-4 mt-4 pt-4 border-t border-slate-50">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Apparatuur</p>
            <div className="flex flex-wrap gap-1.5">
              {client.equipment.length > 0
                ? client.equipment.map(e => <span key={e} className="text-xs bg-slate-100 text-slate-600 px-2 py-0.5 rounded-full capitalize">{e}</span>)
                : <span className="text-xs text-slate-300">Niet opgegeven</span>}
            </div>
          </div>
          {client.injuries && (
            <div>
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Blessures</p>
              <p className="text-sm text-slate-600">{client.injuries}</p>
            </div>
          )}
        </div>

        {/* Check-in link */}
        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">Check-in link</p>
            <p className="text-xs text-slate-400 font-mono truncate max-w-sm">{window.location.origin}/checkin/{client.id}</p>
          </div>
          <button onClick={copyLink} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-colors">
            {copied ? <><Check className="h-3 w-3 text-emerald-500" /> Gekopieerd</> : <><Copy className="h-3 w-3" /> Kopiëren</>}
          </button>
        </div>
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">{error}</div>}

      {/* AI Insights */}
      {loadingInsights && (
        <div className="bg-slate-900 rounded-2xl px-6 py-8 text-center mb-5">
          <Loader2 className="h-6 w-6 text-brand-400 animate-spin mx-auto mb-3" />
          <p className="text-white font-semibold text-sm">AI analyseert de voortgang van {client.full_name}...</p>
          <p className="text-slate-400 text-xs mt-1">Check-ins, energie, slaap en trends worden geanalyseerd</p>
        </div>
      )}

      {insights && (
        <div className="bg-slate-900 rounded-2xl border border-white/5 p-6 mb-5">
          <div className="flex items-center justify-between mb-5">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-brand-400" />
              <h2 className="font-bold text-white text-sm">AI Analyse — {client.full_name}</h2>
            </div>
            <div className="flex items-center gap-2">
              {trendIcon(insights.energie_trend)}
              <span className="text-xs text-slate-400 capitalize">{insights.energie_trend}</span>
              <span className="ml-2 text-xs font-bold text-white bg-brand-600 px-2.5 py-1 rounded-full">{insights.score}/10</span>
            </div>
          </div>

          <p className="text-slate-300 text-sm mb-5">{insights.samenvatting}</p>
          <p className="text-xs text-slate-500 mb-5 italic">{insights.score_toelichting}</p>

          <div className="grid grid-cols-3 gap-4">
            <div>
              <p className="text-xs font-bold text-emerald-400 uppercase tracking-wide mb-2">Sterke punten</p>
              <ul className="space-y-1.5">
                {insights.sterke_punten.map((p, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-2">
                    <span className="text-emerald-500 flex-shrink-0">✓</span>{p}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-amber-400 uppercase tracking-wide mb-2">Aandachtspunten</p>
              <ul className="space-y-1.5">
                {insights.aandachtspunten.map((p, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-2">
                    <span className="text-amber-500 flex-shrink-0">⚠</span>{p}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="text-xs font-bold text-brand-400 uppercase tracking-wide mb-2">Aanbevelingen</p>
              <ul className="space-y-1.5">
                {insights.aanbevelingen.map((p, i) => (
                  <li key={i} className="text-xs text-slate-300 flex gap-2">
                    <span className="text-brand-400 flex-shrink-0">→</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}

      {/* New generated program */}
      {generating && (
        <div className="bg-brand-50 border border-brand-100 rounded-2xl px-6 py-8 text-center mb-5">
          <Loader2 className="h-6 w-6 text-brand-600 animate-spin mx-auto mb-3" />
          <p className="text-brand-700 font-semibold text-sm">AI genereert programma...</p>
          <p className="text-brand-400 text-xs mt-1">Duurt 10–20 seconden</p>
        </div>
      )}
      {(generatedProgram || adjustedProgram) && (
        <div className="mb-5">
          <div className="flex items-center gap-2 mb-3">
            <Zap className="h-4 w-4 text-brand-600" />
            <h2 className="font-bold text-slate-900 text-sm">
              {adjustedProgram ? 'Aangepast programma gegenereerd' : 'Nieuw programma gegenereerd'}
            </h2>
          </div>
          <ProgramView program={(adjustedProgram || generatedProgram)!} onSaved={() => { setGeneratedProgram(null); setAdjustedProgram(null); loadData() }} />
        </div>
      )}

      {/* Programs list */}
      <div className="mb-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar className="h-4 w-4 text-slate-500" />
          <h2 className="font-bold text-slate-900 text-sm">Programma's ({programs.length})</h2>
        </div>
        {programs.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-8 text-center">
            <p className="text-slate-400 text-sm">Nog geen programma's. Genereer er een hierboven.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {programs.map(program => (
              <div key={program.id} className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-semibold text-slate-900 text-sm">{program.title}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {program.weeks} weken · {new Date(program.created_at).toLocaleDateString('nl-NL')}
                      {program.ai_generated && ' · AI gegenereerd'}
                    </p>
                  </div>
                  <button
                    onClick={() => handleAdjust(program)}
                    disabled={adjusting === program.id}
                    className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                  >
                    {adjusting === program.id
                      ? <Loader2 className="h-3 w-3 animate-spin" />
                      : <RefreshCw className="h-3 w-3" />}
                    {adjusting === program.id ? 'Aanpassen...' : 'Aanpassen op check-ins'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Check-ins */}
      <div>
        <div className="flex items-center gap-2 mb-3">
          <ClipboardList className="h-4 w-4 text-slate-500" />
          <h2 className="font-bold text-slate-900 text-sm">Check-ins ({checkIns.length})</h2>
        </div>
        {checkIns.length === 0 ? (
          <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-8 text-center">
            <p className="text-slate-400 text-sm">Nog geen check-ins. Deel de check-in link met je client.</p>
          </div>
        ) : (
          <div className="space-y-2">
            {checkIns.map(ci => (
              <div key={ci.id} className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
                <div className="flex items-start justify-between mb-3">
                  <p className="font-semibold text-slate-900 text-sm">Week {ci.week_number}</p>
                  <p className="text-xs text-slate-400">{new Date(ci.submitted_at).toLocaleDateString('nl-NL')}</p>
                </div>
                <div className="flex items-center gap-4 text-sm mb-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <div className={`w-2 h-2 rounded-full ${ci.energy >= 7 ? 'bg-emerald-400' : ci.energy >= 5 ? 'bg-amber-400' : 'bg-rose-400'}`} />
                    <span className="text-slate-600 text-xs">Energie <span className="font-bold">{ci.energy}/10</span></span>
                  </div>
                  {ci.weight_kg && <span className="text-xs text-slate-500">⚖ {ci.weight_kg} kg</span>}
                  {ci.sleep_hrs && <span className="text-xs text-slate-500">🌙 {ci.sleep_hrs}u slaap</span>}
                </div>
                {ci.notes && <p className="text-xs text-slate-500 mb-2 italic">"{ci.notes}"</p>}
                {ci.ai_feedback && (
                  <div className="bg-brand-50 border border-brand-100 rounded-xl px-3 py-2.5 mt-2">
                    <p className="text-xs font-bold text-brand-600 mb-1">AI Feedback</p>
                    <p className="text-xs text-brand-800 leading-relaxed">{ci.ai_feedback}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
