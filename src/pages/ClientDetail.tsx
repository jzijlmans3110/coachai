import { useEffect, useState, useCallback, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import {
  ArrowLeft, Zap, Calendar, ClipboardList, Loader2, Brain,
  TrendingUp, TrendingDown, Minus, RefreshCw, Copy, Check,
  Ruler, Utensils, FileText, Target, MessageSquare, Plus,
  Trophy, Send, Printer, BookmarkPlus, Trash2, CheckCircle2,
  Camera, Dumbbell, ExternalLink, Flame, Sparkles, X, Clock, Video,
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client, Program, CheckIn, BodyMeasurement, SessionNote, Milestone, MealPlan, Habit, HabitLog, SessionBrief } from '../lib/types'
import ProgramView from '../components/ProgramView'
import VideoCallModal from '../components/VideoCallModal'

type Tab = 'overzicht' | 'metingen' | 'foto' | 'voeding' | 'notities' | 'doelen' | 'chat' | 'gewoontes' | 'brief' | 'tijdlijn'

interface ProgressPhoto {
  id: string
  client_id: string
  photo_url: string
  label: 'voor' | 'na' | 'voortgang'
  taken_at: string
  notes: string | null
  created_at: string
}

interface Benchmark {
  id: string
  client_id: string
  exercise: string
  value: number
  unit: string
  recorded_at: string
  notes: string | null
  created_at: string
}

interface Insights {
  samenvatting: string
  energie_trend: 'stijgend' | 'dalend' | 'stabiel'
  aandachtspunten: string[]
  sterke_punten: string[]
  aanbevelingen: string[]
  score: number
  score_toelichting: string
}

interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// Simple SVG line chart
function LineChart({ data, label, color = '#4f46e5' }: { data: { date: string; value: number }[]; label: string; color?: string }) {
  if (data.length < 2) return (
    <div className="flex items-center justify-center h-24 text-xs text-slate-300">Minimaal 2 metingen nodig</div>
  )
  const vals = data.map(d => d.value)
  const min = Math.min(...vals)
  const max = Math.max(...vals)
  const range = max - min || 1
  const W = 400, H = 80, pad = 10
  const points = data.map((d, i) => {
    const x = pad + (i / (data.length - 1)) * (W - pad * 2)
    const y = pad + ((max - d.value) / range) * (H - pad * 2)
    return `${x},${y}`
  }).join(' ')
  return (
    <div>
      <p className="text-xs font-semibold text-slate-400 mb-1">{label}</p>
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-20">
        <polyline fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
        {data.map((d, i) => {
          const x = pad + (i / (data.length - 1)) * (W - pad * 2)
          const y = pad + ((max - d.value) / range) * (H - pad * 2)
          return <circle key={i} cx={x} cy={y} r="3" fill={color} />
        })}
      </svg>
      <div className="flex justify-between text-xs text-slate-300 mt-1">
        <span>{data[0].date}</span>
        <span className="font-semibold text-slate-600">{vals[vals.length - 1]} → {vals[0] > vals[vals.length - 1] ? '↓' : '↑'}</span>
        <span>{data[data.length - 1].date}</span>
      </div>
    </div>
  )
}

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const [tab, setTab] = useState<Tab>('overzicht')
  const [client, setClient] = useState<Client | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [measurements, setMeasurements] = useState<BodyMeasurement[]>([])
  const [notes, setNotes] = useState<SessionNote[]>([])
  const [milestones, setMilestones] = useState<Milestone[]>([])
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([])
  const [photos, setPhotos] = useState<ProgressPhoto[]>([])
  const [benchmarks, setBenchmarks] = useState<Benchmark[]>([])
  const [loading, setLoading] = useState(true)
  const [coachId, setCoachId] = useState('')
  const [portalToken, setPortalToken] = useState('')

  // Overview
  const [generating, setGenerating] = useState(false)
  const [generatedProgram, setGeneratedProgram] = useState<Program | null>(null)
  const [adjusting, setAdjusting] = useState<string | null>(null)
  const [adjustedProgram, setAdjustedProgram] = useState<Program | null>(null)
  const [insights, setInsights] = useState<Insights | null>(null)
  const [loadingInsights, setLoadingInsights] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  // Measurements
  const [showMeasureForm, setShowMeasureForm] = useState(false)
  const [measureForm, setMeasureForm] = useState({ measured_at: new Date().toISOString().split('T')[0], weight_kg: '', chest_cm: '', waist_cm: '', hips_cm: '', bicep_cm: '', thigh_cm: '', notes: '' })

  // Notes
  const [showNoteForm, setShowNoteForm] = useState(false)
  const [noteContent, setNoteContent] = useState('')
  const [noteDate, setNoteDate] = useState(new Date().toISOString().split('T')[0])

  // Milestones
  const [showMilestoneForm, setShowMilestoneForm] = useState(false)
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDate, setMilestoneDate] = useState('')

  // Chat
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Meal plan
  const [generatingMeal, setGeneratingMeal] = useState(false)
  const [activeMealPlan, setActiveMealPlan] = useState<MealPlan | null>(null)

  // Template save
  const [savingTemplate, setSavingTemplate] = useState<string | null>(null)
  const [savedTemplate, setSavedTemplate] = useState<string | null>(null)

  // Photos
  const [showPhotoForm, setShowPhotoForm] = useState(false)
  const [photoUrl, setPhotoUrl] = useState('')
  const [photoLabel, setPhotoLabel] = useState<'voor' | 'na' | 'voortgang'>('voortgang')
  const [photoDate, setPhotoDate] = useState(new Date().toISOString().split('T')[0])
  const [photoNotes, setPhotoNotes] = useState('')
  const [lightbox, setLightbox] = useState<string | null>(null)

  // Benchmarks
  const [showBenchmarkForm, setShowBenchmarkForm] = useState(false)
  const [benchmarkForm, setBenchmarkForm] = useState({ exercise: '', value: '', unit: 'kg', recorded_at: new Date().toISOString().split('T')[0], notes: '' })

  // Habits
  const [habits, setHabits] = useState<Habit[]>([])
  const [habitLogs, setHabitLogs] = useState<HabitLog[]>([])
  const [newHabitTitle, setNewHabitTitle] = useState('')
  const [addingHabit, setAddingHabit] = useState(false)

  // Session Brief
  const [brief, setBrief] = useState<SessionBrief | null>(null)
  const [loadingBrief, setLoadingBrief] = useState(false)
  const [showBrief, setShowBrief] = useState(false)

  // Tijdlijn
  const [showAllTimeline, setShowAllTimeline] = useState(false)

  // Smart Auto-Adjust
  const [dismissedAutoAdjust, setDismissedAutoAdjust] = useState(false)
  const [autoAdjusting, setAutoAdjusting] = useState(false)
  const [autoAdjustedProgram, setAutoAdjustedProgram] = useState<Program | null>(null)

  // Video call
  const [showVideoCall, setShowVideoCall] = useState(false)

  const loadData = useCallback(async () => {
    if (!id) return
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    setCoachId(user.id)
    const [
      { data: clientData },
      { data: programsData },
      { data: checkInsData },
      { data: measureData },
      { data: notesData },
      { data: milestonesData },
      { data: mealData },
      { data: photosData },
      { data: benchmarksData },
    ] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      supabase.from('programs').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('check_ins').select('*').eq('client_id', id).order('submitted_at', { ascending: false }),
      supabase.from('body_measurements').select('*').eq('client_id', id).order('measured_at', { ascending: false }),
      supabase.from('session_notes').select('*').eq('client_id', id).order('session_date', { ascending: false }),
      supabase.from('milestones').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('meal_plans').select('*').eq('client_id', id).order('created_at', { ascending: false }),
      supabase.from('progress_photos').select('*').eq('client_id', id).order('taken_at', { ascending: false }),
      supabase.from('benchmarks').select('*').eq('client_id', id).order('recorded_at', { ascending: false }),
    ])
    setClient(clientData)
    setPrograms(programsData ?? [])
    setCheckIns(checkInsData ?? [])
    setMeasurements(measureData ?? [])
    setNotes(notesData ?? [])
    setMilestones(milestonesData ?? [])
    setMealPlans(mealData ?? [])
    if (mealData && mealData.length > 0) setActiveMealPlan(mealData[0])
    setPhotos((photosData as ProgressPhoto[]) ?? [])
    setBenchmarks((benchmarksData as Benchmark[]) ?? [])
    setPortalToken(clientData?.portal_token ?? '')

    // Load habits + logs (last 35 days)
    const thirtyFiveDaysAgo = new Date(Date.now() - 35 * 86400000).toISOString().slice(0, 10)
    const [{ data: habitsData }, { data: logsData }] = await Promise.all([
      supabase.from('habits').select('*').eq('client_id', id).order('created_at', { ascending: true }),
      supabase.from('habit_logs').select('*').eq('client_id', id).gte('logged_date', thirtyFiveDaysAgo),
    ])
    setHabits((habitsData as Habit[]) ?? [])
    setHabitLogs((logsData as HabitLog[]) ?? [])

    setLoading(false)
  }, [id])

  useEffect(() => { loadData() }, [loadData])
  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [chatMessages])

  // Consistency score: weeks with check-in / total weeks since first check-in
  const consistencyScore = (() => {
    if (checkIns.length === 0) return null
    const weeksWithCheckin = new Set(checkIns.map(c => c.week_number)).size
    const maxWeek = Math.max(...checkIns.map(c => c.week_number))
    if (maxWeek === 0) return 100
    return Math.round((weeksWithCheckin / maxWeek) * 100)
  })()

  const avgEnergy = checkIns.length
    ? (checkIns.reduce((s, c) => s + c.energy, 0) / checkIns.length).toFixed(1)
    : null

  const avgSleep = checkIns.filter(c => c.sleep_hrs).length
    ? (checkIns.filter(c => c.sleep_hrs).reduce((s, c) => s + (c.sleep_hrs ?? 0), 0) / checkIns.filter(c => c.sleep_hrs).length).toFixed(1)
    : null

  const levelBadge = (level: string) => ({
    beginner: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60',
    intermediate: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60',
    advanced: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/60',
  }[level] ?? 'bg-slate-100 text-slate-600')

  const trendIcon = (t: string) => t === 'stijgend'
    ? <TrendingUp className="h-4 w-4 text-emerald-500" />
    : t === 'dalend' ? <TrendingDown className="h-4 w-4 text-rose-500" />
    : <Minus className="h-4 w-4 text-slate-400" />

  // Handlers
  const handleGenerate = async () => {
    if (!client) return
    setGenerating(true); setError(''); setGeneratedProgram(null)
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
    setLoadingInsights(true); setInsights(null)
    const { data } = await supabase.functions.invoke('ai-insights', { body: { client_id: client.id } })
    if (data?.insights) setInsights(data.insights)
    setLoadingInsights(false)
  }

  const handleAdjust = async (program: Program) => {
    if (!client) return
    setAdjusting(program.id); setAdjustedProgram(null)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setAdjusting(null); return }
    const { data, error } = await supabase.functions.invoke('adjust-program', {
      body: { program_id: program.id, client_id: client.id, coach_id: user?.id },
    })
    if (data?.program) { setAdjustedProgram(data.program); loadData() }
    else setError(data?.error || error?.message || 'Aanpassen mislukt')
    setAdjusting(null)
  }

  const handleAutoAdjust = async () => {
    if (!client || programs.length === 0) return
    const latestProgram = programs[0]
    const deloadWeek = checkIns.length > 0 ? Math.max(...checkIns.map(c => c.week_number)) + 1 : 1
    setAutoAdjusting(true); setAutoAdjustedProgram(null)
    const { data, error } = await supabase.functions.invoke('adjust-program', {
      body: {
        program_id: latestProgram.id,
        client_id: client.id,
        instruction: `Genereer een deload week: verlaag het volume met 40-50%, behoud de oefeningen maar verlaag sets en gewichten. Dit is week ${deloadWeek} van herstel.`,
      },
    })
    if (data?.program) setAutoAdjustedProgram(data.program)
    else setError(data?.error || error?.message || 'Auto-aanpassen mislukt')
    setAutoAdjusting(false)
  }

  const handleSaveTemplate = async (program: Program) => {
    setSavingTemplate(program.id)
    await supabase.from('program_templates').insert({
      coach_id: coachId,
      title: `Template: ${program.title}`,
      weeks: program.weeks,
      content: program.content,
    })
    setSavingTemplate(null)
    setSavedTemplate(program.id)
    setTimeout(() => setSavedTemplate(null), 2000)
  }

  const handlePrintProgram = (program: Program) => {
    const win = window.open('', '_blank')
    if (!win) return
    const weeks = program.content.weeks ?? []
    const html = `<!DOCTYPE html><html><head><title>${program.title}</title>
<style>
body { font-family: Arial, sans-serif; padding: 24px; color: #1e293b; }
h1 { font-size: 20px; margin-bottom: 4px; }
h2 { font-size: 15px; margin: 16px 0 8px; color: #475569; border-bottom: 1px solid #e2e8f0; padding-bottom: 4px; }
h3 { font-size: 13px; margin: 12px 0 6px; }
table { width: 100%; border-collapse: collapse; font-size: 12px; margin-bottom: 12px; }
th { text-align: left; background: #f8fafc; padding: 6px 8px; border: 1px solid #e2e8f0; font-weight: 600; }
td { padding: 5px 8px; border: 1px solid #e2e8f0; }
.badge { display: inline-block; background: #eff6ff; color: #3b82f6; padding: 1px 8px; border-radius: 99px; font-size: 11px; margin-left: 6px; }
@media print { body { padding: 0; } }
</style></head><body>
<h1>${program.title}</h1>
<p style="color:#94a3b8;font-size:12px">${program.weeks} weken · ${new Date(program.created_at).toLocaleDateString('nl-NL')}</p>
${weeks.map(w => `<h2>Week ${w.week}</h2>${w.days.map(d => `<h3>${d.day} <span class="badge">${d.focus}</span></h3><table><thead><tr><th>Oefening</th><th>Sets</th><th>Reps</th><th>Rust</th><th>Notities</th></tr></thead><tbody>${d.exercises.map(e => `<tr><td>${e.name}</td><td>${e.sets}</td><td>${e.reps}</td><td>${e.rest}</td><td>${e.notes || '—'}</td></tr>`).join('')}</tbody></table>`).join('')}`).join('')}
<script>window.print()</script></body></html>`
    win.document.write(html)
    win.document.close()
  }

  const handleAddMeasurement = async () => {
    if (!id) return
    const payload: Record<string, unknown> = { client_id: id, measured_at: measureForm.measured_at }
    if (measureForm.weight_kg) payload.weight_kg = parseFloat(measureForm.weight_kg)
    if (measureForm.chest_cm) payload.chest_cm = parseFloat(measureForm.chest_cm)
    if (measureForm.waist_cm) payload.waist_cm = parseFloat(measureForm.waist_cm)
    if (measureForm.hips_cm) payload.hips_cm = parseFloat(measureForm.hips_cm)
    if (measureForm.bicep_cm) payload.bicep_cm = parseFloat(measureForm.bicep_cm)
    if (measureForm.thigh_cm) payload.thigh_cm = parseFloat(measureForm.thigh_cm)
    if (measureForm.notes) payload.notes = measureForm.notes
    await supabase.from('body_measurements').insert(payload)
    setShowMeasureForm(false)
    setMeasureForm({ measured_at: new Date().toISOString().split('T')[0], weight_kg: '', chest_cm: '', waist_cm: '', hips_cm: '', bicep_cm: '', thigh_cm: '', notes: '' })
    loadData()
  }

  const handleAddNote = async () => {
    if (!id || !noteContent.trim()) return
    await supabase.from('session_notes').insert({ client_id: id, coach_id: coachId, content: noteContent.trim(), session_date: noteDate })
    setNoteContent(''); setShowNoteForm(false); loadData()
  }

  const handleDeleteNote = async (noteId: string) => {
    await supabase.from('session_notes').delete().eq('id', noteId)
    loadData()
  }

  const handleAddMilestone = async () => {
    if (!id || !milestoneTitle.trim()) return
    await supabase.from('milestones').insert({ client_id: id, title: milestoneTitle.trim(), target_date: milestoneDate || null })
    setMilestoneTitle(''); setMilestoneDate(''); setShowMilestoneForm(false); loadData()
  }

  const handleToggleMilestone = async (m: Milestone) => {
    await supabase.from('milestones').update({ achieved_at: m.achieved_at ? null : new Date().toISOString() }).eq('id', m.id)
    loadData()
  }

  const handleDeleteMilestone = async (mId: string) => {
    await supabase.from('milestones').delete().eq('id', mId)
    loadData()
  }

  const handleGenerateMealPlan = async () => {
    if (!client) return
    setGeneratingMeal(true)
    const { data, error } = await supabase.functions.invoke('generate-meal-plan', {
      body: { client_id: client.id, coach_id: coachId },
    })
    if (data?.plan) { setActiveMealPlan(data.plan); loadData() }
    else setError(data?.error || error?.message || 'Voedingsplan mislukt')
    setGeneratingMeal(false)
  }

  const handleSendChat = async () => {
    if (!chatInput.trim() || !id || chatLoading) return
    const userMsg: ChatMessage = { role: 'user', content: chatInput.trim() }
    const newMessages = [...chatMessages, userMsg]
    setChatMessages(newMessages)
    setChatInput('')
    setChatLoading(true)
    const { data } = await supabase.functions.invoke('ai-chat', {
      body: { client_id: id, messages: newMessages },
    })
    if (data?.reply) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }])
    } else {
      setChatMessages(prev => [...prev, { role: 'assistant', content: data?.error || 'Er ging iets mis.' }])
    }
    setChatLoading(false)
  }

  const copyLink = () => {
    navigator.clipboard.writeText(`${window.location.origin}/checkin/${client?.id}`)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )
  if (!client) return <div className="p-8 text-slate-400">Client niet gevonden.</div>

  // Habit handlers
  const handleAddHabit = async () => {
    if (!id || !newHabitTitle.trim() || !coachId) return
    setAddingHabit(true)
    const { data } = await supabase.from('habits').insert({
      coach_id: coachId, client_id: id, title: newHabitTitle.trim(),
    }).select().single()
    if (data) setHabits(prev => [...prev, data as Habit])
    setNewHabitTitle('')
    setAddingHabit(false)
  }

  const handleDeleteHabit = async (habitId: string) => {
    await supabase.from('habit_logs').delete().eq('habit_id', habitId)
    await supabase.from('habits').delete().eq('id', habitId)
    setHabits(prev => prev.filter(h => h.id !== habitId))
    setHabitLogs(prev => prev.filter(l => l.habit_id !== habitId))
  }

  // Session Brief handler
  const handleGenerateBrief = async () => {
    if (!id) return
    setLoadingBrief(true)
    setShowBrief(true)
    const { data, error: fnError } = await supabase.functions.invoke('generate-session-brief', {
      body: { client_id: id },
    })
    if (!fnError && data && !data.error) {
      setBrief(data as SessionBrief)
    }
    setLoadingBrief(false)
  }

  // Heatmap helper: last 35 days grid
  const buildHeatmap = (habitId: string) => {
    const days: { date: string; logged: boolean }[] = []
    for (let i = 34; i >= 0; i--) {
      const d = new Date(Date.now() - i * 86400000)
      const dateStr = d.toISOString().slice(0, 10)
      days.push({ date: dateStr, logged: habitLogs.some(l => l.habit_id === habitId && l.logged_date === dateStr) })
    }
    return days
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'overzicht', label: 'Overzicht', icon: <Zap className="h-3.5 w-3.5" /> },
    { key: 'metingen', label: 'Metingen', icon: <Ruler className="h-3.5 w-3.5" /> },
    { key: 'foto', label: "Foto's", icon: <Camera className="h-3.5 w-3.5" /> },
    { key: 'voeding', label: 'Voeding', icon: <Utensils className="h-3.5 w-3.5" /> },
    { key: 'notities', label: 'Notities', icon: <FileText className="h-3.5 w-3.5" /> },
    { key: 'doelen', label: 'Doelen', icon: <Target className="h-3.5 w-3.5" /> },
    { key: 'gewoontes', label: 'Gewoontes', icon: <Flame className="h-3.5 w-3.5" /> },
    { key: 'brief', label: 'Session Brief', icon: <Sparkles className="h-3.5 w-3.5" /> },
    { key: 'chat', label: 'AI Chat', icon: <MessageSquare className="h-3.5 w-3.5" /> },
    { key: 'tijdlijn', label: 'Tijdlijn', icon: <Clock className="h-3.5 w-3.5" /> },
  ]

  const handleAddPhoto = async () => {
    if (!id || !photoUrl.trim()) return
    const { data } = await supabase.from('progress_photos').insert({
      client_id: id, photo_url: photoUrl.trim(), label: photoLabel, taken_at: photoDate, notes: photoNotes || null,
    }).select().single()
    if (data) { setPhotos(prev => [data as ProgressPhoto, ...prev]); setPhotoUrl(''); setPhotoNotes(''); setShowPhotoForm(false) }
  }

  const handleDeletePhoto = async (photoId: string) => {
    await supabase.from('progress_photos').delete().eq('id', photoId)
    setPhotos(prev => prev.filter(p => p.id !== photoId))
  }

  const handleAddBenchmark = async () => {
    if (!id || !benchmarkForm.exercise || !benchmarkForm.value) return
    const { data } = await supabase.from('benchmarks').insert({
      client_id: id,
      exercise: benchmarkForm.exercise,
      value: parseFloat(benchmarkForm.value),
      unit: benchmarkForm.unit,
      recorded_at: benchmarkForm.recorded_at,
      notes: benchmarkForm.notes || null,
    }).select().single()
    if (data) {
      setBenchmarks(prev => [data as Benchmark, ...prev])
      setBenchmarkForm({ exercise: '', value: '', unit: 'kg', recorded_at: new Date().toISOString().split('T')[0], notes: '' })
      setShowBenchmarkForm(false)
    }
  }

  const handleDeleteBenchmark = async (bId: string) => {
    await supabase.from('benchmarks').delete().eq('id', bId)
    setBenchmarks(prev => prev.filter(b => b.id !== bId))
  }

  const portalUrl = portalToken ? `${window.location.origin}/portal/${portalToken}` : ''

  const inputCls = "w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"

  // Smart Auto-Adjust detection
  const autoAdjustAlert = (() => {
    if (checkIns.length < 3) return null
    // checkIns are ordered newest-first; take the last 3 submitted
    const recent = checkIns.slice(0, 3)
    const energyValues = recent.map(c => c.energy)
    // Condition 1: 3 consecutive check-ins with energy < 6
    const allLow = energyValues.every(e => e < 6)
    // Condition 2: strictly declining trend over last 3
    const declining = energyValues[0] < energyValues[1] && energyValues[1] < energyValues[2]
    if (!allLow && !declining) return null
    const firstName = client.full_name.split(' ')[0]
    if (allLow) {
      return `${firstName} heeft 3 check-ins op rij met lage energie (${energyValues.map(e => `${e}/10`).join(', ')}). Een deload week kan herstel bevorderen.`
    }
    return `Dalende energietrend bij ${firstName} over de laatste 3 check-ins (${energyValues.reverse().map(e => `${e}/10`).join(' → ')}). Overweeg een deload week.`
  })()

  return (
    <>
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
              <div className="flex items-center gap-2 mt-2 flex-wrap">
                <span className={`text-xs font-semibold px-2.5 py-0.5 rounded-full capitalize ${levelBadge(client.level)}`}>{client.level}</span>
                <span className="text-xs text-slate-400">{client.days_per_week}×/week</span>
                {client.age && <span className="text-xs text-slate-400">· {client.age} jaar</span>}
                {client.weight_kg && client.height_cm && (
                  <span className="text-xs text-slate-400">· BMI {(client.weight_kg / Math.pow(client.height_cm / 100, 2)).toFixed(1)}</span>
                )}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={() => setShowVideoCall(true)}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm">
              <Video className="h-4 w-4" /> Video Call
            </button>
            <button onClick={handleInsights} disabled={loadingInsights}
              className="flex items-center gap-2 bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm">
              {loadingInsights ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
              AI Analyse
            </button>
            <button onClick={handleGenerate} disabled={generating}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm">
              {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              {generating ? 'Genereren...' : 'Programma genereren'}
            </button>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Gem. energie', value: avgEnergy ? `${avgEnergy}/10` : '—', color: 'text-amber-600', bg: 'bg-amber-50' },
            { label: 'Gem. slaap', value: avgSleep ? `${avgSleep}u` : '—', color: 'text-blue-600', bg: 'bg-blue-50' },
            { label: 'Check-ins', value: checkIns.length.toString(), color: 'text-brand-600', bg: 'bg-brand-50' },
            { label: "Programma's", value: programs.length.toString(), color: 'text-emerald-600', bg: 'bg-emerald-50' },
            { label: 'Consistentie', value: consistencyScore !== null ? `${consistencyScore}%` : '—', color: consistencyScore !== null && consistencyScore >= 80 ? 'text-emerald-600' : consistencyScore !== null && consistencyScore >= 60 ? 'text-amber-600' : 'text-rose-600', bg: 'bg-slate-50' },
          ].map(({ label, value, color, bg }) => (
            <div key={label} className={`${bg} rounded-xl px-3 py-2.5`}>
              <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
              <p className={`text-lg font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {/* Links */}
        <div className="mt-4 pt-4 border-t border-slate-50 flex items-center justify-between gap-3">
          <p className="text-xs font-mono text-slate-400 truncate">{window.location.origin}/checkin/{client.id}</p>
          <div className="flex items-center gap-2 flex-shrink-0">
            {portalUrl && (
              <a href={portalUrl} target="_blank" rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-colors">
                <ExternalLink className="h-3 w-3" /> Portaal
              </a>
            )}
            <button onClick={copyLink} className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-colors">
              {copied ? <><Check className="h-3 w-3 text-emerald-500" /> Gekopieerd</> : <><Copy className="h-3 w-3" /> Check-in link</>}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-5 bg-slate-100/70 p-1 rounded-2xl">
        {tabs.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`flex-1 flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-xl transition-all ${
              tab === t.key ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-700'
            }`}>
            {t.icon}{t.label}
          </button>
        ))}
      </div>

      {error && <div className="bg-red-50 border border-red-100 text-red-600 text-sm rounded-xl px-4 py-3 mb-5">{error}</div>}

      {/* ── OVERZICHT ── */}
      {tab === 'overzicht' && (
        <div>
          {/* Smart Auto-Adjust */}
          {autoAdjustAlert && !dismissedAutoAdjust && (
            <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5 mb-5">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 flex-1">
                  <TrendingDown className="h-5 w-5 text-amber-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-amber-800 mb-1">Smart Auto-Adjust</p>
                    <p className="text-sm text-amber-700 mb-4">{autoAdjustAlert}</p>
                    {autoAdjusting ? (
                      <div className="flex items-center gap-2 text-amber-700 text-sm">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        Deload week genereren...
                      </div>
                    ) : autoAdjustedProgram ? (
                      <div>
                        <div className="flex items-center gap-2 mb-3">
                          <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                          <p className="text-sm font-semibold text-slate-800">Deload week gegenereerd</p>
                        </div>
                        <ProgramView
                          program={autoAdjustedProgram}
                          onSaved={() => { setAutoAdjustedProgram(null); setDismissedAutoAdjust(true); loadData() }}
                        />
                      </div>
                    ) : programs.length > 0 ? (
                      <button
                        onClick={handleAutoAdjust}
                        className="flex items-center gap-2 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors shadow-sm"
                      >
                        <Zap className="h-4 w-4" />
                        Genereer Deload Week
                      </button>
                    ) : (
                      <p className="text-xs text-amber-600">Genereer eerst een programma om aan te passen.</p>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => setDismissedAutoAdjust(true)}
                  className="text-amber-400 hover:text-amber-600 transition-colors flex-shrink-0"
                  title="Sluiten"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* AI Insights */}
          {loadingInsights && (
            <div className="bg-slate-900 rounded-2xl px-6 py-8 text-center mb-5">
              <Loader2 className="h-6 w-6 text-brand-400 animate-spin mx-auto mb-3" />
              <p className="text-white font-semibold text-sm">AI analyseert {client.full_name}...</p>
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
                {[
                  { label: 'Sterke punten', items: insights.sterke_punten, color: 'text-emerald-400', bullet: '✓', bulletColor: 'text-emerald-500' },
                  { label: 'Aandachtspunten', items: insights.aandachtspunten, color: 'text-amber-400', bullet: '⚠', bulletColor: 'text-amber-500' },
                  { label: 'Aanbevelingen', items: insights.aanbevelingen, color: 'text-brand-400', bullet: '→', bulletColor: 'text-brand-400' },
                ].map(({ label, items, color, bullet, bulletColor }) => (
                  <div key={label}>
                    <p className={`text-xs font-bold ${color} uppercase tracking-wide mb-2`}>{label}</p>
                    <ul className="space-y-1.5">
                      {items.map((p, i) => (
                        <li key={i} className="text-xs text-slate-300 flex gap-2">
                          <span className={`${bulletColor} flex-shrink-0`}>{bullet}</span>{p}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Program generating */}
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

          {/* Programs */}
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
                      <div className="flex items-center gap-2">
                        <button onClick={() => handleSaveTemplate(program)} disabled={savingTemplate === program.id}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          title="Opslaan als template">
                          {savedTemplate === program.id ? <><Check className="h-3 w-3 text-emerald-500" /> Opgeslagen</> : savingTemplate === program.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <><BookmarkPlus className="h-3 w-3" /> Template</>}
                        </button>
                        <button onClick={() => handlePrintProgram(program)}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-colors"
                          title="PDF exporteren">
                          <Printer className="h-3 w-3" /> PDF
                        </button>
                        <button onClick={() => handleAdjust(program)} disabled={adjusting === program.id}
                          className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 hover:text-brand-600 bg-slate-100 hover:bg-brand-50 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50">
                          {adjusting === program.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                          {adjusting === program.id ? 'Aanpassen...' : 'Aanpassen'}
                        </button>
                      </div>
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
                <p className="text-slate-400 text-sm">Nog geen check-ins. Deel de check-in link hierboven.</p>
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
      )}

      {/* ── METINGEN ── */}
      {tab === 'metingen' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 text-sm">Lichaamsmetingen</h2>
            <button onClick={() => setShowMeasureForm(!showMeasureForm)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
              <Plus className="h-3.5 w-3.5" /> Meting toevoegen
            </button>
          </div>

          {showMeasureForm && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-4">
              <h3 className="font-semibold text-slate-900 text-sm mb-4">Nieuwe meting</h3>
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Datum</label>
                  <input type="date" value={measureForm.measured_at} onChange={e => setMeasureForm(f => ({ ...f, measured_at: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Gewicht (kg)</label>
                  <input type="number" step="0.1" placeholder="75.5" value={measureForm.weight_kg} onChange={e => setMeasureForm(f => ({ ...f, weight_kg: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Borst (cm)</label>
                  <input type="number" step="0.5" placeholder="95" value={measureForm.chest_cm} onChange={e => setMeasureForm(f => ({ ...f, chest_cm: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Taille (cm)</label>
                  <input type="number" step="0.5" placeholder="80" value={measureForm.waist_cm} onChange={e => setMeasureForm(f => ({ ...f, waist_cm: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Heupen (cm)</label>
                  <input type="number" step="0.5" placeholder="100" value={measureForm.hips_cm} onChange={e => setMeasureForm(f => ({ ...f, hips_cm: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Bicep (cm)</label>
                  <input type="number" step="0.5" placeholder="35" value={measureForm.bicep_cm} onChange={e => setMeasureForm(f => ({ ...f, bicep_cm: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Dij (cm)</label>
                  <input type="number" step="0.5" placeholder="55" value={measureForm.thigh_cm} onChange={e => setMeasureForm(f => ({ ...f, thigh_cm: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="mb-3">
                <label className="text-xs font-semibold text-slate-500 block mb-1">Notities</label>
                <input type="text" placeholder="Optioneel" value={measureForm.notes} onChange={e => setMeasureForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} />
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddMeasurement} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">Opslaan</button>
                <button onClick={() => setShowMeasureForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl transition-colors">Annuleren</button>
              </div>
            </div>
          )}

          {/* Charts */}
          {measurements.length >= 2 && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-4">
              <h3 className="font-semibold text-slate-900 text-sm mb-4">Voortgang grafieken</h3>
              <div className="grid grid-cols-2 gap-6">
                {(['weight_kg', 'waist_cm', 'chest_cm', 'bicep_cm'] as const).map(key => {
                  const d = measurements.filter(m => m[key] != null).map(m => ({
                    date: new Date(m.measured_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' }),
                    value: m[key] as number,
                  })).reverse()
                  if (d.length < 2) return null
                  const labels: Record<string, string> = { weight_kg: 'Gewicht (kg)', waist_cm: 'Taille (cm)', chest_cm: 'Borst (cm)', bicep_cm: 'Bicep (cm)' }
                  const colors: Record<string, string> = { weight_kg: '#4f46e5', waist_cm: '#f59e0b', chest_cm: '#10b981', bicep_cm: '#3b82f6' }
                  return <LineChart key={key} data={d} label={labels[key]} color={colors[key]} />
                })}
              </div>
            </div>
          )}

          {/* Measurements table */}
          {measurements.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-8 text-center">
              <Ruler className="h-8 w-8 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Nog geen metingen. Voeg de eerste meting toe.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-slate-50 border-b border-slate-100">
                      {['Datum', 'Gewicht', 'Borst', 'Taille', 'Heupen', 'Bicep', 'Dij', 'Notities'].map(h => (
                        <th key={h} className="text-left text-xs font-semibold text-slate-400 px-4 py-3">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {measurements.map(m => (
                      <tr key={m.id} className="hover:bg-slate-50/50">
                        <td className="px-4 py-3 text-xs font-semibold text-slate-700">{new Date(m.measured_at).toLocaleDateString('nl-NL')}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{m.weight_kg ? `${m.weight_kg} kg` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{m.chest_cm ? `${m.chest_cm} cm` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{m.waist_cm ? `${m.waist_cm} cm` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{m.hips_cm ? `${m.hips_cm} cm` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{m.bicep_cm ? `${m.bicep_cm} cm` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">{m.thigh_cm ? `${m.thigh_cm} cm` : '—'}</td>
                        <td className="px-4 py-3 text-xs text-slate-400 italic">{m.notes || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── BENCHMARKS (inside Metingen tab shown as section below) ── */}
      {tab === 'metingen' && (
        <div className="mt-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <Dumbbell className="h-4 w-4 text-slate-500" />
              <h2 className="font-bold text-slate-900 text-sm">Kracht benchmarks</h2>
            </div>
            <button onClick={() => setShowBenchmarkForm(!showBenchmarkForm)}
              className="flex items-center gap-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
              <Plus className="h-3.5 w-3.5" /> Benchmark toevoegen
            </button>
          </div>

          {showBenchmarkForm && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-4">
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Oefening</label>
                  <input type="text" placeholder="Deadlift, Bench press, 5km run..." value={benchmarkForm.exercise} onChange={e => setBenchmarkForm(f => ({ ...f, exercise: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Waarde</label>
                  <input type="number" step="0.5" placeholder="100" value={benchmarkForm.value} onChange={e => setBenchmarkForm(f => ({ ...f, value: e.target.value }))} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Eenheid</label>
                  <select value={benchmarkForm.unit} onChange={e => setBenchmarkForm(f => ({ ...f, unit: e.target.value }))} className={inputCls}>
                    <option value="kg">kg</option>
                    <option value="reps">reps</option>
                    <option value="min">min</option>
                    <option value="sec">sec</option>
                    <option value="km">km</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Datum</label>
                  <input type="date" value={benchmarkForm.recorded_at} onChange={e => setBenchmarkForm(f => ({ ...f, recorded_at: e.target.value }))} className={inputCls} />
                </div>
                <div className="col-span-3">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Notities</label>
                  <input type="text" placeholder="Optioneel" value={benchmarkForm.notes} onChange={e => setBenchmarkForm(f => ({ ...f, notes: e.target.value }))} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddBenchmark} className="bg-slate-900 hover:bg-slate-800 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">Opslaan</button>
                <button onClick={() => setShowBenchmarkForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl transition-colors">Annuleren</button>
              </div>
            </div>
          )}

          {benchmarks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-8 text-center">
              <Dumbbell className="h-8 w-8 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Nog geen benchmarks. Leg de eerste prestatie vast.</p>
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
              {/* Group by exercise */}
              {Array.from(new Set(benchmarks.map(b => b.exercise))).map(exercise => {
                const entries = benchmarks.filter(b => b.exercise === exercise)
                const best = entries.reduce((max, b) => b.value > max.value ? b : max, entries[0])
                const latest = entries[0]
                return (
                  <div key={exercise} className="border-b border-slate-50 last:border-b-0 px-5 py-4">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-semibold text-slate-900 text-sm">{exercise}</p>
                        <p className="text-xs text-slate-400">{entries.length} meting{entries.length !== 1 ? 'en' : ''}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Laatste</p>
                          <p className="text-sm font-bold text-slate-700">{latest.value} {latest.unit}</p>
                        </div>
                        <div className="text-right">
                          <p className="text-xs text-slate-400">Best</p>
                          <p className="text-sm font-bold text-brand-600">{best.value} {best.unit}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      {entries.map(b => (
                        <div key={b.id} className="flex items-center gap-1.5 bg-slate-50 rounded-lg px-2.5 py-1.5 group">
                          <span className="text-xs font-semibold text-slate-700">{b.value} {b.unit}</span>
                          <span className="text-xs text-slate-400">{new Date(b.recorded_at).toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</span>
                          <button onClick={() => handleDeleteBenchmark(b.id)}
                            className="opacity-0 group-hover:opacity-100 text-slate-300 hover:text-rose-400 transition-opacity">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── FOTO'S ── */}
      {tab === 'foto' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 text-sm">Voortgangsfoto's</h2>
            <button onClick={() => setShowPhotoForm(!showPhotoForm)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
              <Plus className="h-3.5 w-3.5" /> Foto toevoegen
            </button>
          </div>

          {showPhotoForm && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-4">
              <h3 className="font-semibold text-slate-900 text-sm mb-3">Nieuwe foto</h3>
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-3">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Foto URL</label>
                  <input type="url" placeholder="https://... (Google Photos, Dropbox, etc.)" value={photoUrl} onChange={e => setPhotoUrl(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Type</label>
                  <select value={photoLabel} onChange={e => setPhotoLabel(e.target.value as 'voor' | 'na' | 'voortgang')} className={inputCls}>
                    <option value="voor">Voor</option>
                    <option value="voortgang">Voortgang</option>
                    <option value="na">Na</option>
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Datum</label>
                  <input type="date" value={photoDate} onChange={e => setPhotoDate(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Notities</label>
                  <input type="text" placeholder="Optioneel" value={photoNotes} onChange={e => setPhotoNotes(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddPhoto} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">Opslaan</button>
                <button onClick={() => setShowPhotoForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl transition-colors">Annuleren</button>
              </div>
            </div>
          )}

          {/* Lightbox */}
          {lightbox && (
            <div className="fixed inset-0 bg-black/90 z-50 flex items-center justify-center p-6" onClick={() => setLightbox(null)}>
              <img src={lightbox} alt="Voortgang" className="max-w-full max-h-full object-contain rounded-2xl" />
              <button className="absolute top-4 right-4 text-white/60 hover:text-white text-2xl font-light" onClick={() => setLightbox(null)}>✕</button>
            </div>
          )}

          {photos.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-10 text-center">
              <Camera className="h-8 w-8 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm mb-1">Nog geen foto's toegevoegd.</p>
              <p className="text-xs text-slate-300">Voeg een URL toe van Google Photos, Dropbox of een andere fotoservice.</p>
            </div>
          ) : (
            <div>
              {/* Group by label */}
              {(['voor', 'voortgang', 'na'] as const).map(lbl => {
                const group = photos.filter(p => p.label === lbl)
                if (group.length === 0) return null
                return (
                  <div key={lbl} className="mb-5">
                    <p className="text-xs font-bold text-slate-500 uppercase tracking-wide mb-3 capitalize">{lbl === 'voor' ? 'Voor' : lbl === 'na' ? 'Na' : 'Voortgang'}</p>
                    <div className="grid grid-cols-3 gap-3">
                      {group.map(photo => (
                        <div key={photo.id} className="relative group rounded-xl overflow-hidden bg-slate-100 aspect-[3/4]">
                          <img
                            src={photo.photo_url} alt={photo.label}
                            className="w-full h-full object-cover cursor-pointer hover:scale-105 transition-transform"
                            onClick={() => setLightbox(photo.photo_url)}
                            onError={e => { (e.target as HTMLImageElement).src = 'https://placehold.co/300x400?text=Foto' }}
                          />
                          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors" />
                          <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/60 to-transparent">
                            <p className="text-white text-xs">{new Date(photo.taken_at).toLocaleDateString('nl-NL')}</p>
                            {photo.notes && <p className="text-white/70 text-xs truncate">{photo.notes}</p>}
                          </div>
                          <button onClick={() => handleDeletePhoto(photo.id)}
                            className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 bg-black/50 text-white p-1 rounded-lg transition-opacity hover:bg-rose-500/80">
                            <Trash2 className="h-3 w-3" />
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* ── VOEDING ── */}
      {tab === 'voeding' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-bold text-slate-900 text-sm">Voedingsplan</h2>
              {mealPlans.length > 0 && <p className="text-xs text-slate-400 mt-0.5">{mealPlans.length} plan{mealPlans.length !== 1 ? 'nen' : ''} gegenereerd</p>}
            </div>
            <button onClick={handleGenerateMealPlan} disabled={generatingMeal}
              className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 shadow-sm">
              {generatingMeal ? <Loader2 className="h-4 w-4 animate-spin" /> : <Utensils className="h-4 w-4" />}
              {generatingMeal ? 'Genereren...' : 'Nieuw voedingsplan'}
            </button>
          </div>

          {generatingMeal && (
            <div className="bg-emerald-50 border border-emerald-100 rounded-2xl px-6 py-8 text-center mb-5">
              <Loader2 className="h-6 w-6 text-emerald-600 animate-spin mx-auto mb-3" />
              <p className="text-emerald-700 font-semibold text-sm">AI genereert voedingsplan...</p>
              <p className="text-emerald-400 text-xs mt-1">Calorieën, macro's en maaltijden worden berekend</p>
            </div>
          )}

          {mealPlans.length > 1 && (
            <div className="flex gap-2 mb-4 flex-wrap">
              {mealPlans.map((p, i) => (
                <button key={p.id} onClick={() => setActiveMealPlan(p)}
                  className={`text-xs font-semibold px-3 py-1.5 rounded-xl transition-colors ${activeMealPlan?.id === p.id ? 'bg-emerald-600 text-white' : 'bg-white border border-slate-200 text-slate-600 hover:border-emerald-300'}`}>
                  Plan {mealPlans.length - i} — {new Date(p.created_at).toLocaleDateString('nl-NL')}
                </button>
              ))}
            </div>
          )}

          {activeMealPlan ? (
            <div className="space-y-3">
              {/* Macro targets */}
              <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                <h3 className="font-bold text-slate-900 text-sm mb-3">{activeMealPlan.content.title}</h3>
                <div className="grid grid-cols-4 gap-3">
                  {[
                    { label: 'Calorieën', value: `${activeMealPlan.content.calories_target} kcal`, color: 'text-orange-600', bg: 'bg-orange-50' },
                    { label: 'Eiwitten', value: `${activeMealPlan.content.protein_target}g`, color: 'text-blue-600', bg: 'bg-blue-50' },
                    { label: 'Koolhydraten', value: activeMealPlan.content.carbs_target ? `${activeMealPlan.content.carbs_target}g` : '—', color: 'text-amber-600', bg: 'bg-amber-50' },
                    { label: 'Vetten', value: activeMealPlan.content.fat_target ? `${activeMealPlan.content.fat_target}g` : '—', color: 'text-emerald-600', bg: 'bg-emerald-50' },
                  ].map(({ label, value, color, bg }) => (
                    <div key={label} className={`${bg} rounded-xl px-3 py-2.5`}>
                      <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
                      <p className={`text-base font-bold ${color}`}>{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Days */}
              {activeMealPlan.content.days.map((day, di) => (
                <div key={di} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="font-bold text-slate-900 text-sm">{day.day}</h3>
                    <div className="flex items-center gap-3 text-xs text-slate-400">
                      <span className="font-semibold text-orange-600">{day.total_calories} kcal</span>
                      <span>{day.total_protein}g eiwit</span>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    {day.meals.map((meal, mi) => (
                      <div key={mi} className="bg-slate-50 rounded-xl p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="text-xs font-bold text-slate-700">{meal.name}</p>
                          {meal.time && <p className="text-xs text-slate-400">{meal.time}</p>}
                        </div>
                        <ul className="space-y-0.5 mb-2">
                          {meal.foods.map((f, fi) => (
                            <li key={fi} className="text-xs text-slate-600">· {f}</li>
                          ))}
                        </ul>
                        <div className="flex gap-2 text-xs">
                          <span className="text-orange-600 font-semibold">{meal.calories} kcal</span>
                          <span className="text-slate-400">{meal.protein}g eiwit</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          ) : !generatingMeal && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-8 text-center">
              <Utensils className="h-8 w-8 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm mb-3">Nog geen voedingsplan. Genereer er een met AI.</p>
              <p className="text-xs text-slate-300">Gebaseerd op doel, gewicht, lengte en activiteitsniveau</p>
            </div>
          )}
        </div>
      )}

      {/* ── NOTITIES ── */}
      {tab === 'notities' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 text-sm">Sessie notities</h2>
            <button onClick={() => setShowNoteForm(!showNoteForm)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
              <Plus className="h-3.5 w-3.5" /> Notitie toevoegen
            </button>
          </div>

          {showNoteForm && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-4">
              <div className="grid grid-cols-4 gap-3 mb-3">
                <div className="col-span-1">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Datum sessie</label>
                  <input type="date" value={noteDate} onChange={e => setNoteDate(e.target.value)} className={inputCls} />
                </div>
                <div className="col-span-3">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Notitie</label>
                  <textarea value={noteContent} onChange={e => setNoteContent(e.target.value)}
                    placeholder="Wat ging goed, wat zijn aandachtspunten, aanpassingen voor volgende sessie..."
                    rows={3} className={inputCls + ' resize-none'} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddNote} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">Opslaan</button>
                <button onClick={() => setShowNoteForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl transition-colors">Annuleren</button>
              </div>
            </div>
          )}

          {notes.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-8 text-center">
              <FileText className="h-8 w-8 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Nog geen notities. Voeg de eerste sessie notitie toe.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {notes.map(note => (
                <div key={note.id} className="bg-white rounded-2xl border border-slate-100 shadow-card p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-xs font-semibold text-slate-400 mb-2">
                        {new Date(note.session_date).toLocaleDateString('nl-NL', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                      </p>
                      <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{note.content}</p>
                    </div>
                    <button onClick={() => handleDeleteNote(note.id)}
                      className="text-slate-300 hover:text-rose-400 transition-colors flex-shrink-0 mt-0.5">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── DOELEN ── */}
      {tab === 'doelen' && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-bold text-slate-900 text-sm">Doelen & mijlpalen</h2>
            <button onClick={() => setShowMilestoneForm(!showMilestoneForm)}
              className="flex items-center gap-1.5 bg-brand-600 hover:bg-brand-700 text-white text-xs font-semibold px-3 py-2 rounded-xl transition-colors">
              <Plus className="h-3.5 w-3.5" /> Doel toevoegen
            </button>
          </div>

          {showMilestoneForm && (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-4">
              <div className="grid grid-cols-3 gap-3 mb-3">
                <div className="col-span-2">
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Doel / mijlpaal</label>
                  <input type="text" placeholder="Bijv. 10 kg afvallen, eerste pull-up..." value={milestoneTitle} onChange={e => setMilestoneTitle(e.target.value)} className={inputCls} />
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 block mb-1">Streefdatum (optioneel)</label>
                  <input type="date" value={milestoneDate} onChange={e => setMilestoneDate(e.target.value)} className={inputCls} />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={handleAddMilestone} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">Opslaan</button>
                <button onClick={() => setShowMilestoneForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl transition-colors">Annuleren</button>
              </div>
            </div>
          )}

          {/* Stats */}
          {milestones.length > 0 && (
            <div className="grid grid-cols-3 gap-3 mb-4">
              {[
                { label: 'Totaal doelen', value: milestones.length, color: 'text-brand-600', bg: 'bg-brand-50' },
                { label: 'Behaald', value: milestones.filter(m => m.achieved_at).length, color: 'text-emerald-600', bg: 'bg-emerald-50' },
                { label: 'In voortgang', value: milestones.filter(m => !m.achieved_at).length, color: 'text-amber-600', bg: 'bg-amber-50' },
              ].map(({ label, value, color, bg }) => (
                <div key={label} className={`${bg} rounded-xl px-4 py-3`}>
                  <p className="text-xs font-medium text-slate-500 mb-1">{label}</p>
                  <p className={`text-xl font-bold ${color}`}>{value}</p>
                </div>
              ))}
            </div>
          )}

          {milestones.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-8 text-center">
              <Target className="h-8 w-8 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Nog geen doelen. Voeg de eerste mijlpaal toe.</p>
            </div>
          ) : (
            <div className="space-y-2">
              {milestones.map(m => (
                <div key={m.id} className={`bg-white rounded-2xl border shadow-card p-4 transition-colors ${m.achieved_at ? 'border-emerald-100 bg-emerald-50/30' : 'border-slate-100'}`}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button onClick={() => handleToggleMilestone(m)} className="flex-shrink-0">
                        {m.achieved_at
                          ? <Trophy className="h-5 w-5 text-emerald-500" />
                          : <CheckCircle2 className="h-5 w-5 text-slate-200 hover:text-emerald-400 transition-colors" />}
                      </button>
                      <div>
                        <p className={`text-sm font-semibold ${m.achieved_at ? 'text-emerald-700 line-through opacity-75' : 'text-slate-900'}`}>{m.title}</p>
                        <div className="flex items-center gap-3 mt-0.5">
                          {m.target_date && <p className="text-xs text-slate-400">Streefdatum: {new Date(m.target_date).toLocaleDateString('nl-NL')}</p>}
                          {m.achieved_at && <p className="text-xs text-emerald-600 font-semibold">✓ Behaald op {new Date(m.achieved_at).toLocaleDateString('nl-NL')}</p>}
                        </div>
                      </div>
                    </div>
                    <button onClick={() => handleDeleteMilestone(m.id)} className="text-slate-300 hover:text-rose-400 transition-colors">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── AI CHAT ── */}
      {tab === 'chat' && (
        <div className="flex flex-col h-[calc(100vh-380px)] min-h-[400px]">
          <div className="bg-slate-900 rounded-t-2xl px-5 py-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <p className="text-white text-xs font-semibold">AI Coach Assistent — {client.full_name}</p>
            <p className="text-slate-400 text-xs ml-auto">Heeft toegang tot check-ins, doelen en programma's</p>
          </div>

          {/* Messages */}
          <div className="flex-1 bg-slate-50 border-x border-slate-100 overflow-y-auto p-4 space-y-3">
            {chatMessages.length === 0 && (
              <div className="flex flex-col items-center justify-center h-full text-center">
                <Brain className="h-10 w-10 text-slate-200 mb-3" />
                <p className="text-sm font-semibold text-slate-400">Stel een vraag over {client.full_name}</p>
                <div className="grid grid-cols-2 gap-2 mt-4 max-w-sm">
                  {[
                    `Hoe presteert ${client.full_name.split(' ')[0]} de laatste weken?`,
                    'Wat zijn mijn aanbevelingen voor het volgende programma?',
                    'Wat zijn de risico\'s op blessures?',
                    'Hoe kan ik de motivatie verhogen?',
                  ].map((q, i) => (
                    <button key={i} onClick={() => { setChatInput(q) }}
                      className="text-xs text-slate-500 bg-white border border-slate-200 hover:border-brand-300 hover:text-brand-600 px-3 py-2 rounded-xl text-left transition-colors leading-snug">
                      {q}
                    </button>
                  ))}
                </div>
              </div>
            )}
            {chatMessages.map((msg, i) => (
              <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  msg.role === 'user'
                    ? 'bg-brand-600 text-white rounded-br-md'
                    : 'bg-white border border-slate-100 shadow-sm text-slate-800 rounded-bl-md'
                }`}>
                  {msg.content}
                </div>
              </div>
            ))}
            {chatLoading && (
              <div className="flex justify-start">
                <div className="bg-white border border-slate-100 shadow-sm rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex items-center gap-1.5">
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <div className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Input */}
          <div className="bg-white border border-slate-100 rounded-b-2xl p-3 flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={e => setChatInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendChat()}
              placeholder={`Vraag iets over ${client.full_name}...`}
              className="flex-1 text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"
            />
            <button onClick={handleSendChat} disabled={chatLoading || !chatInput.trim()}
              className="bg-brand-600 hover:bg-brand-700 text-white px-4 py-2.5 rounded-xl transition-colors disabled:opacity-50 flex-shrink-0">
              <Send className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}

      {/* Gewoontes tab */}
      {tab === 'gewoontes' && (
        <div className="space-y-4">
          {/* Add habit */}
          <div className="bg-white border border-slate-100 rounded-2xl shadow-card p-5">
            <h3 className="font-bold text-slate-900 text-sm mb-3">Gewoonte toevoegen</h3>
            <div className="flex gap-2">
              <input
                value={newHabitTitle}
                onChange={e => setNewHabitTitle(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddHabit()}
                placeholder="bijv. 10.000 stappen, 2L water, 8u slaap..."
                className="flex-1 border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
              />
              <button
                onClick={handleAddHabit}
                disabled={addingHabit || !newHabitTitle.trim()}
                className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 flex items-center gap-1.5"
              >
                <Plus className="h-4 w-4" />
                Toevoegen
              </button>
            </div>
          </div>

          {habits.length === 0 ? (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-card p-10 text-center">
              <Flame className="h-8 w-8 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-500 font-medium text-sm">Nog geen gewoontes</p>
              <p className="text-slate-400 text-xs mt-1">Voeg dagelijkse gewoontes toe die je client bijhoudt in het portaal.</p>
            </div>
          ) : (
            habits.map(habit => {
              const heatmap = buildHeatmap(habit.id)
              const loggedCount = heatmap.filter(d => d.logged).length
              const streakDays = (() => {
                let streak = 0
                for (let i = heatmap.length - 1; i >= 0; i--) {
                  if (heatmap[i].logged) streak++
                  else break
                }
                return streak
              })()
              // Group into weeks (5 rows of 7)
              const weeks: typeof heatmap[] = []
              for (let w = 0; w < 5; w++) weeks.push(heatmap.slice(w * 7, w * 7 + 7))

              return (
                <div key={habit.id} className="bg-white border border-slate-100 rounded-2xl shadow-card p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Flame className={`h-4 w-4 ${streakDays > 0 ? 'text-orange-500' : 'text-slate-300'}`} />
                      <span className="font-bold text-slate-900 text-sm">{habit.title}</span>
                      {streakDays > 1 && (
                        <span className="text-xs font-semibold bg-orange-50 text-orange-600 px-2 py-0.5 rounded-full">
                          🔥 {streakDays} daagse streak
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-slate-400">{loggedCount}/35 dagen</span>
                      <button
                        onClick={() => handleDeleteHabit(habit.id)}
                        className="text-slate-300 hover:text-rose-500 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  {/* Heatmap grid */}
                  <div className="space-y-1">
                    {weeks.map((week, wi) => (
                      <div key={wi} className="flex gap-1">
                        {week.map((day) => (
                          <div
                            key={day.date}
                            title={day.date}
                            className={`flex-1 h-6 rounded-md transition-colors ${
                              day.logged
                                ? 'bg-brand-500'
                                : 'bg-slate-100'
                            }`}
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <span className="text-xs text-slate-400">35 dagen geleden</span>
                    <span className="text-xs text-slate-400">Vandaag</span>
                  </div>
                </div>
              )
            })
          )}
        </div>
      )}

      {/* Session Brief tab */}
      {tab === 'brief' && (
        <div>
          {!showBrief ? (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-card p-10 text-center">
              <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
                <Sparkles className="h-7 w-7 text-brand-600" />
              </div>
              <h3 className="font-bold text-slate-900 mb-2">AI Session Brief</h3>
              <p className="text-sm text-slate-400 mb-6 max-w-sm mx-auto">
                Genereer een persoonlijke briefing voor je gesprek met {client.full_name}. AI analyseert alle check-ins, trends en doelen.
              </p>
              <button
                onClick={handleGenerateBrief}
                className="inline-flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-6 py-3 rounded-xl transition-colors"
              >
                <Sparkles className="h-4 w-4" />
                Genereer Session Brief
              </button>
            </div>
          ) : loadingBrief ? (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-card p-10 text-center">
              <Loader2 className="h-8 w-8 text-brand-500 animate-spin mx-auto mb-3" />
              <p className="text-sm text-slate-400">AI analyseert {client.full_name}...</p>
            </div>
          ) : brief ? (
            <div className="space-y-4">
              {/* Header */}
              <div className="bg-brand-600 rounded-2xl p-5 text-white">
                <div className="flex items-center justify-between mb-1">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-brand-200" />
                    <span className="text-xs font-semibold text-brand-200 uppercase tracking-wide">Session Brief</span>
                  </div>
                  <button onClick={() => { setShowBrief(false); setBrief(null) }} className="text-brand-300 hover:text-white transition-colors">
                    <X className="h-4 w-4" />
                  </button>
                </div>
                <h2 className="text-lg font-bold">{brief.client_name}</h2>
                <p className="text-xs text-brand-300 mt-0.5">{new Date(brief.generated_at).toLocaleString('nl-NL', { dateStyle: 'medium', timeStyle: 'short' })}</p>
              </div>

              {/* Snapshot */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-card p-5">
                <h3 className="font-bold text-slate-900 text-sm mb-3">Snapshot</h3>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: 'Gem. energie', value: brief.snapshot.avg_energy },
                    { label: 'Energietrend', value: brief.snapshot.energy_trend },
                    { label: 'Consistentie', value: brief.snapshot.consistency },
                    { label: 'Laatste check-in', value: brief.snapshot.last_checkin_days != null ? `${brief.snapshot.last_checkin_days} dagen geleden` : 'Onbekend' },
                    ...(brief.snapshot.weight_trend ? [{ label: 'Gewichtstrend', value: brief.snapshot.weight_trend }] : []),
                  ].map(({ label, value }) => (
                    <div key={label} className="bg-slate-50 rounded-xl px-3 py-2.5">
                      <p className="text-xs text-slate-400 mb-0.5">{label}</p>
                      <p className="text-sm font-bold text-slate-900 capitalize">{value}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Celebrate */}
              <div className="bg-emerald-50 border border-emerald-100 rounded-2xl p-5">
                <h3 className="font-bold text-emerald-800 text-sm mb-2 flex items-center gap-2">
                  <Trophy className="h-4 w-4 text-emerald-600" /> Vier dit
                </h3>
                <ul className="space-y-1.5">
                  {brief.celebrate.map((item, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-emerald-700">
                      <CheckCircle2 className="h-4 w-4 text-emerald-500 flex-shrink-0 mt-0.5" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Address */}
              {brief.address.length > 0 && (
                <div className="bg-amber-50 border border-amber-100 rounded-2xl p-5">
                  <h3 className="font-bold text-amber-800 text-sm mb-2 flex items-center gap-2">
                    <Brain className="h-4 w-4 text-amber-600" /> Bespreek dit
                  </h3>
                  <ul className="space-y-1.5">
                    {brief.address.map((item, i) => (
                      <li key={i} className="text-sm text-amber-700">• {item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Talking points */}
              <div className="bg-white border border-slate-100 rounded-2xl shadow-card p-5">
                <h3 className="font-bold text-slate-900 text-sm mb-3 flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-brand-500" /> Gesprekspunten
                </h3>
                <ol className="space-y-2">
                  {brief.talking_points.map((point, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="w-5 h-5 rounded-full bg-brand-100 text-brand-700 text-xs font-bold flex items-center justify-center flex-shrink-0 mt-0.5">{i + 1}</span>
                      <span className="text-sm text-slate-700">{point}</span>
                    </li>
                  ))}
                </ol>
              </div>

              {/* Program suggestion */}
              {brief.program_suggestion && (
                <div className="bg-brand-50 border border-brand-100 rounded-2xl p-5">
                  <h3 className="font-bold text-brand-800 text-sm mb-2 flex items-center gap-2">
                    <Zap className="h-4 w-4 text-brand-600" /> Programma suggestie
                  </h3>
                  <p className="text-sm text-brand-700">{brief.program_suggestion}</p>
                </div>
              )}

              {/* Regenerate */}
              <button
                onClick={handleGenerateBrief}
                disabled={loadingBrief}
                className="w-full flex items-center justify-center gap-2 border border-slate-200 text-slate-600 text-sm font-semibold py-3 rounded-xl hover:bg-slate-50 transition-colors"
              >
                <RefreshCw className="h-4 w-4" />
                Opnieuw genereren
              </button>
            </div>
          ) : (
            <div className="bg-white border border-slate-100 rounded-2xl shadow-card p-8 text-center">
              <p className="text-rose-500 text-sm">Genereren mislukt. Probeer opnieuw.</p>
              <button onClick={() => setShowBrief(false)} className="mt-3 text-xs text-slate-400 hover:text-slate-600">Terug</button>
            </div>
          )}
        </div>
      )}

      {/* ── TIJDLIJN ── */}
      {tab === 'tijdlijn' && (() => {
        type TLEventType = 'joined' | 'program' | 'checkin' | 'meal' | 'milestone' | 'note' | 'measurement'
        type TLEvent = { id: string; date: Date; type: TLEventType; icon: string; title: string; description: string }

        const tlEvents: TLEvent[] = []

        tlEvents.push({ id: 'joined', date: new Date(client.created_at), type: 'joined', icon: '📅', title: 'Client toegevoegd', description: `${client.full_name} is toegevoegd als client` })

        programs.forEach(p => tlEvents.push({ id: `program-${p.id}`, date: new Date(p.created_at), type: 'program', icon: '💪', title: 'Programma aangemaakt', description: p.title }))

        checkIns.forEach(ci => tlEvents.push({ id: `checkin-${ci.id}`, date: new Date(ci.submitted_at), type: 'checkin', icon: '✅', title: 'Check-in ingediend', description: `Week ${ci.week_number} · Energie ${ci.energy}/10${ci.sleep_hrs ? ` · Slaap ${ci.sleep_hrs}u` : ''}` }))

        mealPlans.forEach(mp => tlEvents.push({ id: `meal-${mp.id}`, date: new Date(mp.created_at), type: 'meal', icon: '🍽️', title: 'Voedingsplan aangemaakt', description: mp.title }))

        milestones.filter(m => m.achieved_at).forEach(m => tlEvents.push({ id: `milestone-${m.id}`, date: new Date(m.achieved_at!), type: 'milestone', icon: '🏆', title: 'Milestone behaald', description: m.title }))

        notes.forEach(n => tlEvents.push({ id: `note-${n.id}`, date: new Date(n.session_date), type: 'note', icon: '📝', title: 'Session note toegevoegd', description: n.content.length > 80 ? n.content.slice(0, 80) + '…' : n.content }))

        measurements.forEach(m => {
          const parts: string[] = []
          if (m.weight_kg) parts.push(`${m.weight_kg} kg`)
          if (m.waist_cm) parts.push(`taille ${m.waist_cm} cm`)
          if (m.chest_cm) parts.push(`borst ${m.chest_cm} cm`)
          tlEvents.push({ id: `measurement-${m.id}`, date: new Date(m.measured_at), type: 'measurement', icon: '📏', title: 'Meting gedaan', description: parts.length > 0 ? parts.join(' · ') : 'Lichaamsmetingen vastgelegd' })
        })

        tlEvents.sort((a, b) => b.date.getTime() - a.date.getTime())

        const TL_PAGE = 50
        const tlVisible = showAllTimeline ? tlEvents : tlEvents.slice(0, TL_PAGE)
        const tlHasMore = tlEvents.length > TL_PAGE

        const tlDot: Record<TLEventType, string> = { joined: 'bg-slate-400', program: 'bg-brand-500', checkin: 'bg-emerald-500', meal: 'bg-orange-500', milestone: 'bg-amber-500', note: 'bg-blue-500', measurement: 'bg-slate-500' }
        const tlBorder: Record<TLEventType, string> = { joined: 'border-slate-100', program: 'border-brand-100', checkin: 'border-emerald-100', meal: 'border-orange-100', milestone: 'border-amber-100', note: 'border-blue-100', measurement: 'border-slate-100' }
        const tlBg: Record<TLEventType, string> = { joined: 'bg-white', program: 'bg-brand-50/40', checkin: 'bg-emerald-50/40', meal: 'bg-orange-50/40', milestone: 'bg-amber-50/40', note: 'bg-blue-50/40', measurement: 'bg-white' }

        if (tlEvents.length === 0) {
          return (
            <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-12 text-center">
              <Clock className="h-8 w-8 text-slate-200 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">Nog geen activiteit om te tonen.</p>
            </div>
          )
        }

        const tlGrouped: { dateKey: string; eventsInDay: TLEvent[] }[] = []
        tlVisible.forEach(ev => {
          const key = ev.date.toISOString().slice(0, 10)
          const existing = tlGrouped.find(g => g.dateKey === key)
          if (existing) existing.eventsInDay.push(ev)
          else tlGrouped.push({ dateKey: key, eventsInDay: [ev] })
        })

        return (
          <div>
            <div className="relative">
              <div className="absolute left-[5.5rem] top-0 bottom-0 w-px bg-slate-100" />
              <div className="space-y-0">
                {tlGrouped.map(({ dateKey, eventsInDay }) => {
                  const d = new Date(dateKey + 'T12:00:00')
                  const dateLabel = d.toLocaleDateString('nl-NL', { day: '2-digit', month: 'short' })
                  return (
                    <div key={dateKey} className="flex gap-0 mb-4">
                      <div className="w-20 flex-shrink-0 pt-2 text-right pr-4">
                        <span className="text-xs font-semibold text-slate-400 leading-tight whitespace-nowrap">{dateLabel}</span>
                      </div>
                      <div className="flex-1 pl-6 relative">
                        {eventsInDay.map(ev => (
                          <div key={ev.id} className="relative flex items-start gap-3 mb-2">
                            <div className={`absolute -left-[1.65rem] top-2 w-3 h-3 rounded-full border-2 border-white flex-shrink-0 ${tlDot[ev.type]}`} />
                            <div className={`flex-1 rounded-xl border px-3 py-2.5 shadow-sm ${tlBg[ev.type]} ${tlBorder[ev.type]}`}>
                              <div className="flex items-start gap-2">
                                <span className="text-sm leading-none mt-0.5">{ev.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-xs font-bold text-slate-800">{ev.title}</p>
                                  <p className="text-xs text-slate-500 mt-0.5 leading-snug">{ev.description}</p>
                                </div>
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
            {tlHasMore && !showAllTimeline && (
              <div className="mt-2 text-center">
                <button onClick={() => setShowAllTimeline(true)} className="text-xs font-semibold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-4 py-2 rounded-xl transition-colors">
                  Toon meer ({tlEvents.length - TL_PAGE} verborgen)
                </button>
              </div>
            )}
          </div>
        )
      })()}
    </div>

    {showVideoCall && (
      <VideoCallModal
        roomName={`coachai-${id?.replace(/-/g, '').slice(0, 16)}`}
        displayName="Coach"
        onClose={() => setShowVideoCall(false)}
      />
    )}
    </>
  )
}
