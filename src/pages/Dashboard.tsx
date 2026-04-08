import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Zap, ChevronRight, ClipboardList, Battery, Moon, AlertTriangle, TrendingDown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client, Program, CheckIn } from '../lib/types'

interface ChurnRisk {
  client: Client
  score: number // 0-100, higher = more at risk
  level: 'low' | 'medium' | 'high'
  reasons: string[]
  suggestion: string
  daysSinceCheckIn: number | null
}

function computeChurnRisk(client: Client, checkIns: CheckIn[]): ChurnRisk {
  const clientCheckIns = checkIns
    .filter(c => c.client_id === client.id)
    .sort((a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime())

  const reasons: string[] = []
  let score = 0

  // Days since last check-in
  let daysSinceCheckIn: number | null = null
  if (clientCheckIns.length === 0) {
    score += 40
    reasons.push('Nog nooit ingecheckt')
  } else {
    daysSinceCheckIn = Math.floor((Date.now() - new Date(clientCheckIns[0].submitted_at).getTime()) / 86400000)
    if (daysSinceCheckIn > 21) { score += 40; reasons.push(`${daysSinceCheckIn} dagen geen check-in`) }
    else if (daysSinceCheckIn > 10) { score += 20; reasons.push(`${daysSinceCheckIn} dagen geen check-in`) }
  }

  // Energy trend (last 3)
  if (clientCheckIns.length >= 3) {
    const [e1, e2, e3] = clientCheckIns.slice(0, 3).map(c => c.energy)
    if (e1 < e2 && e2 < e3) { score += 25; reasons.push('Dalende energietrend') }
    else if (e1 < 5) { score += 15; reasons.push('Lage energie bij laatste check-in') }
  } else if (clientCheckIns.length === 1 && clientCheckIns[0].energy < 5) {
    score += 15
    reasons.push('Lage energie bij laatste check-in')
  }

  // Few check-ins vs client age
  const clientAgeDays = Math.floor((Date.now() - new Date(client.created_at).getTime()) / 86400000)
  const expectedCheckIns = Math.floor(clientAgeDays / 7)
  if (expectedCheckIns > 2 && clientCheckIns.length < expectedCheckIns * 0.4) {
    score += 20
    reasons.push('Weinig check-ins vergeleken met inschrijfduur')
  }

  // Status
  if (client.status === 'inactief') { score += 15; reasons.push('Status: inactief') }

  score = Math.min(score, 100)
  const level = score >= 50 ? 'high' : score >= 25 ? 'medium' : 'low'

  const suggestions: Record<string, string> = {
    high: 'Neem direct contact op — stuur een persoonlijk bericht of bel om te vragen hoe het gaat.',
    medium: 'Stuur een motiverende check-in reminder en vraag actief naar voortgang.',
    low: 'Client is betrokken — houd momentum vast met positieve feedback.',
  }

  return { client, score, level, reasons, suggestion: suggestions[level], daysSinceCheckIn }
}

export default function Dashboard() {
  const [clients, setClients] = useState<Client[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [coachName, setCoachName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: coachData }, { data: clientsData }, { data: programsData }, { data: checkInsData }] = await Promise.all([
        supabase.from('coaches').select('full_name').eq('id', user.id).single(),
        supabase.from('clients').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
        supabase.from('programs').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
        supabase.from('check_ins').select('*, clients!inner(coach_id)').eq('clients.coach_id', user.id).order('submitted_at', { ascending: false }).limit(50),
      ])
      setCoachName(coachData?.full_name ?? '')
      setClients(clientsData ?? [])
      setPrograms(programsData ?? [])
      setCheckIns(checkInsData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const now = new Date()
  const thisMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const thisWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

  const programsThisMonth = programs.filter(p => new Date(p.created_at) >= thisMonth).length
  const checkInsThisWeek = checkIns.filter(c => new Date(c.submitted_at) >= thisWeek).length
  const avgEnergy = checkIns.length
    ? (checkIns.slice(0, 20).reduce((s, c) => s + c.energy, 0) / Math.min(checkIns.length, 20)).toFixed(1)
    : null
  const avgSleep = checkIns.filter(c => c.sleep_hrs).slice(0, 20)
  const avgSleepVal = avgSleep.length
    ? (avgSleep.reduce((s, c) => s + (c.sleep_hrs ?? 0), 0) / avgSleep.length).toFixed(1)
    : null

  // Clients with low energy (last check-in < 5)
  const lowEnergyClients = clients.filter(client => {
    const clientCheckIns = checkIns.filter(c => c.client_id === client.id)
    if (!clientCheckIns.length) return false
    return clientCheckIns[0].energy < 5
  })

  // Churn risk engine
  const churnRisks = clients
    .map(c => computeChurnRisk(c, checkIns))
    .filter(r => r.level !== 'low')
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)

  const levelBadge = (level: string) => ({
    beginner: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60',
    intermediate: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60',
    advanced: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/60',
  }[level] ?? 'bg-slate-100 text-slate-600')

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const hour = now.getHours()
  const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-slate-400 text-sm font-medium mb-0.5">{greeting}{coachName ? `, ${coachName.split(' ')[0]}` : ''} 👋</p>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-4 mb-4">
        {[
          { label: 'Actieve clients', value: clients.length, icon: Users, color: 'text-brand-600', bg: 'bg-brand-50', sub: clients.length === 1 ? '1 ingeschreven' : `${clients.length} ingeschreven` },
          { label: "Programma's deze maand", value: programsThisMonth, icon: Zap, color: 'text-amber-600', bg: 'bg-amber-50', sub: `${programs.length} totaal gegenereerd` },
          { label: 'Check-ins deze week', value: checkInsThisWeek, icon: ClipboardList, color: 'text-emerald-600', bg: 'bg-emerald-50', sub: `${checkIns.length} totaal ontvangen` },
        ].map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
              <div className={`${bg} rounded-xl p-2`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-0.5">{value}</p>
            <p className="text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Gem. energieniveau', value: avgEnergy ? `${avgEnergy}/10` : '—', icon: Battery, color: avgEnergy && parseFloat(avgEnergy) >= 7 ? 'text-emerald-600' : avgEnergy && parseFloat(avgEnergy) >= 5 ? 'text-amber-600' : 'text-rose-600', bg: 'bg-slate-50', sub: 'Laatste 20 check-ins' },
          { label: 'Gem. slaap', value: avgSleepVal ? `${avgSleepVal}u` : '—', icon: Moon, color: 'text-blue-600', bg: 'bg-blue-50/50', sub: 'Gemiddeld per nacht' },
          { label: 'Aandacht nodig', value: lowEnergyClients.length, icon: AlertTriangle, color: lowEnergyClients.length > 0 ? 'text-rose-600' : 'text-slate-400', bg: lowEnergyClients.length > 0 ? 'bg-rose-50' : 'bg-slate-50', sub: 'Clients met lage energie' },
        ].map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
              <div className={`${bg} rounded-xl p-2`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold mb-0.5 ${color}`}>{value}</p>
            <p className="text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-5 gap-5">
        {/* Recent clients */}
        <div className="col-span-3 bg-white rounded-2xl border border-slate-100 shadow-card">
          <div className="flex items-center justify-between px-5 py-4 border-b border-slate-50">
            <h2 className="font-bold text-slate-900 text-sm">Recente clients</h2>
            <Link to="/clients" className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">Alle clients →</Link>
          </div>
          {clients.length === 0 ? (
            <div className="px-5 py-12 text-center">
              <p className="text-slate-400 text-sm mb-3">Nog geen clients</p>
              <Link to="/clients" className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">Client toevoegen</Link>
            </div>
          ) : (
            <ul>
              {clients.slice(0, 6).map((client, i) => {
                const lastCheckIn = checkIns.find(c => c.client_id === client.id)
                return (
                  <li key={client.id} className={i < Math.min(clients.length, 6) - 1 ? 'border-b border-slate-50' : ''}>
                    <Link to={`/clients/${client.id}`} className="flex items-center justify-between px-5 py-3 hover:bg-slate-50/60 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {client.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-sm font-semibold text-slate-900">{client.full_name}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[180px]">{client.goal}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {lastCheckIn && (
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${lastCheckIn.energy >= 7 ? 'bg-emerald-50 text-emerald-600' : lastCheckIn.energy >= 5 ? 'bg-amber-50 text-amber-600' : 'bg-rose-50 text-rose-600'}`}>
                            ⚡ {lastCheckIn.energy}/10
                          </span>
                        )}
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${levelBadge(client.level)}`}>{client.level}</span>
                        <ChevronRight className="h-4 w-4 text-slate-300" />
                      </div>
                    </Link>
                  </li>
                )
              })}
            </ul>
          )}
        </div>

        {/* Recent activity */}
        <div className="col-span-2 bg-white rounded-2xl border border-slate-100 shadow-card">
          <div className="px-5 py-4 border-b border-slate-50">
            <h2 className="font-bold text-slate-900 text-sm">Recente activiteit</h2>
          </div>
          <div className="p-4 space-y-2">
            {[
              ...checkIns.slice(0, 5).map(c => ({
                type: 'checkin' as const,
                date: new Date(c.submitted_at),
                client_id: c.client_id,
                energy: c.energy,
                label: `Week ${c.week_number} check-in`,
              })),
              ...programs.slice(0, 5).map(p => ({
                type: 'program' as const,
                date: new Date(p.created_at),
                client_id: p.client_id,
                label: p.title,
              })),
            ]
              .sort((a, b) => b.date.getTime() - a.date.getTime())
              .slice(0, 8)
              .map((item, i) => {
                const client = clients.find(c => c.id === item.client_id)
                return (
                  <Link key={i} to={`/clients/${item.client_id}`} className="flex items-center gap-3 p-2 rounded-xl hover:bg-slate-50 transition-colors">
                    <div className={`w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 ${item.type === 'checkin' ? 'bg-emerald-50' : 'bg-brand-50'}`}>
                      {item.type === 'checkin'
                        ? <ClipboardList className="h-3.5 w-3.5 text-emerald-600" />
                        : <Zap className="h-3.5 w-3.5 text-brand-600" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-slate-700 truncate">{client?.full_name ?? 'Client'}</p>
                      <p className="text-xs text-slate-400 truncate">{item.label}</p>
                    </div>
                    <p className="text-xs text-slate-300 flex-shrink-0">{item.date.toLocaleDateString('nl-NL', { day: 'numeric', month: 'short' })}</p>
                  </Link>
                )
              })}
            {checkIns.length === 0 && programs.length === 0 && (
              <p className="text-xs text-slate-400 text-center py-6">Nog geen activiteit</p>
            )}
          </div>
        </div>
      </div>

      {/* Low energy alert */}
      {lowEnergyClients.length > 0 && (
        <div className="mt-5 bg-rose-50 border border-rose-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <h3 className="font-bold text-rose-700 text-sm">Aandacht nodig</h3>
          </div>
          <p className="text-xs text-rose-600 mb-3">De volgende clients hebben een lage energie-score bij hun laatste check-in:</p>
          <div className="flex flex-wrap gap-2">
            {lowEnergyClients.map(client => (
              <Link key={client.id} to={`/clients/${client.id}`} className="flex items-center gap-2 bg-white border border-rose-100 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-700 hover:bg-rose-50 transition-colors">
                <span className="w-5 h-5 rounded-full bg-rose-100 flex items-center justify-center text-xs font-bold">
                  {client.full_name.charAt(0)}
                </span>
                {client.full_name}
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Churn Risk Engine */}
      {churnRisks.length > 0 && (
        <div className="mt-5 bg-white border border-slate-100 shadow-card rounded-2xl">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-50">
            <TrendingDown className="h-4 w-4 text-amber-500" />
            <h2 className="font-bold text-slate-900 text-sm">Churn Risico Radar</h2>
            <span className="ml-auto text-xs text-slate-400 font-medium">AI-gedreven retentie</span>
          </div>
          <div className="divide-y divide-slate-50">
            {churnRisks.map(risk => {
              const riskColor = risk.level === 'high'
                ? { bar: 'bg-rose-500', badge: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/60', dot: 'bg-rose-400' }
                : { bar: 'bg-amber-400', badge: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60', dot: 'bg-amber-400' }
              return (
                <div key={risk.client.id} className="px-5 py-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0 mt-0.5">
                      {risk.client.full_name.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <Link to={`/clients/${risk.client.id}`} className="text-sm font-bold text-slate-900 hover:text-brand-600 transition-colors">
                          {risk.client.full_name}
                        </Link>
                        <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${riskColor.badge}`}>
                          {risk.level === 'high' ? 'Hoog risico' : 'Matig risico'}
                        </span>
                      </div>
                      {/* Risk bar */}
                      <div className="flex items-center gap-2 mb-2">
                        <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                          <div className={`h-full rounded-full transition-all ${riskColor.bar}`} style={{ width: `${risk.score}%` }} />
                        </div>
                        <span className="text-xs text-slate-400 font-medium flex-shrink-0">{risk.score}%</span>
                      </div>
                      {/* Reasons */}
                      <div className="flex flex-wrap gap-1 mb-2">
                        {risk.reasons.map(r => (
                          <span key={r} className="flex items-center gap-1 text-xs text-slate-500 bg-slate-50 px-2 py-0.5 rounded-full">
                            <span className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${riskColor.dot}`} />
                            {r}
                          </span>
                        ))}
                      </div>
                      {/* AI suggestion */}
                      <p className="text-xs text-slate-600 bg-slate-50 px-3 py-2 rounded-xl leading-relaxed">
                        <span className="font-semibold text-brand-600">Advies: </span>{risk.suggestion}
                      </p>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
