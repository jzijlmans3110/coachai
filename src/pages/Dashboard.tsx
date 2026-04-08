import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, Zap, ChevronRight, TrendingUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client, Program } from '../lib/types'

export default function Dashboard() {
  const [clients, setClients] = useState<Client[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [coachName, setCoachName] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: coachData }, { data: clientsData }, { data: programsData }] = await Promise.all([
        supabase.from('coaches').select('full_name').eq('id', user.id).single(),
        supabase.from('clients').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
        supabase.from('programs').select('*').eq('coach_id', user.id),
      ])

      setCoachName(coachData?.full_name ?? '')
      setClients(clientsData ?? [])
      setPrograms(programsData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const thisMonth = new Date(); thisMonth.setDate(1)
  const programsThisMonth = programs.filter(p => new Date(p.created_at) >= thisMonth).length

  const levelBadge = (level: string) => ({
    beginner: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60',
    intermediate: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60',
    advanced: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/60',
  }[level] ?? 'bg-slate-100 text-slate-600')

  const avatar = (name: string) => (
    <div className="w-9 h-9 rounded-full bg-brand-600 flex items-center justify-center text-white text-sm font-semibold flex-shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  )

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  const hour = new Date().getHours()
  const greeting = hour < 12 ? 'Goedemorgen' : hour < 18 ? 'Goedemiddag' : 'Goedenavond'

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-slate-500 text-sm font-medium mb-1">{greeting}{coachName ? `, ${coachName.split(' ')[0]}` : ''} 👋</p>
        <h1 className="text-2xl font-bold text-slate-900">Dashboard</h1>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-8">
        {[
          {
            label: 'Actieve clients',
            value: clients.length,
            icon: Users,
            color: 'text-brand-600',
            bg: 'bg-brand-50',
            sub: clients.length === 0 ? 'Voeg je eerste client toe' : `${clients.length} ingeschreven`,
          },
          {
            label: "Programma's deze maand",
            value: programsThisMonth,
            icon: Zap,
            color: 'text-amber-600',
            bg: 'bg-amber-50',
            sub: `${programs.length} totaal gegenereerd`,
          },
          {
            label: 'Gemiddeld niveau',
            value: clients.length > 0
              ? ['beginner', 'intermediate', 'advanced'].find(
                  l => clients.filter(c => c.level === l).length === Math.max(...['beginner','intermediate','advanced'].map(x => clients.filter(c => c.level === x).length))
                ) ?? '—'
              : '—',
            icon: TrendingUp,
            color: 'text-emerald-600',
            bg: 'bg-emerald-50',
            sub: 'Meest voorkomend niveau',
          },
        ].map(({ label, value, icon: Icon, color, bg, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-card p-6">
            <div className="flex items-center justify-between mb-4">
              <p className="text-sm font-medium text-slate-500">{label}</p>
              <div className={`${bg} rounded-xl p-2`}>
                <Icon className={`h-4 w-4 ${color}`} />
              </div>
            </div>
            <p className="text-3xl font-bold text-slate-900 mb-1 capitalize">{value}</p>
            <p className="text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* Recent clients */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-50">
          <h2 className="font-semibold text-slate-900 text-sm">Recente clients</h2>
          <Link to="/clients" className="text-xs font-semibold text-brand-600 hover:text-brand-700 transition-colors">
            Alle clients →
          </Link>
        </div>

        {clients.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <div className="w-12 h-12 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Users className="h-5 w-5 text-brand-600" />
            </div>
            <p className="text-slate-900 font-medium text-sm mb-1">Nog geen clients</p>
            <p className="text-slate-400 text-xs mb-4">Voeg je eerste client toe om te beginnen</p>
            <Link to="/clients" className="inline-flex items-center gap-1.5 bg-brand-600 text-white text-xs font-semibold px-4 py-2 rounded-lg hover:bg-brand-700 transition-colors">
              Client toevoegen
            </Link>
          </div>
        ) : (
          <ul>
            {clients.slice(0, 5).map((client, i) => (
              <li key={client.id} className={i < Math.min(clients.slice(0,5).length, 5) - 1 ? 'border-b border-slate-50' : ''}>
                <Link
                  to={`/clients/${client.id}`}
                  className="flex items-center justify-between px-6 py-3.5 hover:bg-slate-50/60 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    {avatar(client.full_name)}
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{client.full_name}</p>
                      <p className="text-xs text-slate-400 mt-0.5 truncate max-w-xs">{client.goal}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-2.5">
                    <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${levelBadge(client.level)}`}>
                      {client.level}
                    </span>
                    <ChevronRight className="h-4 w-4 text-slate-300" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  )
}
