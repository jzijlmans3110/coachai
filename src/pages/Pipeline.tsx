import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { UserPlus, ChevronRight, Users, Clock, PauseCircle, XCircle } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client } from '../lib/types'

type Status = 'intake' | 'actief' | 'inactief' | 'gestopt'

const columns: { key: Status; label: string; icon: React.ReactNode; color: string; bg: string; border: string }[] = [
  { key: 'intake', label: 'Intake', icon: <UserPlus className="h-4 w-4" />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-200' },
  { key: 'actief', label: 'Actief', icon: <Users className="h-4 w-4" />, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-200' },
  { key: 'inactief', label: 'Inactief', icon: <PauseCircle className="h-4 w-4" />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-200' },
  { key: 'gestopt', label: 'Gestopt', icon: <XCircle className="h-4 w-4" />, color: 'text-slate-400', bg: 'bg-slate-50', border: 'border-slate-200' },
]

export default function Pipeline() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [moving, setMoving] = useState<string | null>(null)
  const [intakeLink, setIntakeLink] = useState('')

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: clientsData }, { data: coachData }] = await Promise.all([
        supabase.from('clients').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
        supabase.from('coaches').select('intake_token').eq('id', user.id).single(),
      ])
      setClients(clientsData ?? [])
      if (coachData?.intake_token) {
        setIntakeLink(`${window.location.origin}/intake/${coachData.intake_token}`)
      }
      setLoading(false)
    }
    load()
  }, [])

  const moveClient = async (clientId: string, newStatus: Status) => {
    setMoving(clientId)
    await supabase.from('clients').update({ status: newStatus }).eq('id', clientId)
    setClients(prev => prev.map(c => c.id === clientId ? { ...c, status: newStatus } : c))
    setMoving(null)
  }

  const copyIntakeLink = () => {
    navigator.clipboard.writeText(intakeLink)
  }

  const levelBadge = (level: string) => ({
    beginner: 'bg-emerald-50 text-emerald-700',
    intermediate: 'bg-amber-50 text-amber-700',
    advanced: 'bg-rose-50 text-rose-700',
  }[level] ?? 'bg-slate-100 text-slate-600')

  const byStatus = (status: Status) => clients.filter(c => (c.status ?? 'actief') === status)

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Pipeline</h1>
          <p className="text-slate-400 text-sm mt-0.5">Beheer de status van al je clients</p>
        </div>
        {intakeLink && (
          <div className="flex items-center gap-3">
            <p className="text-xs text-slate-400 font-mono truncate max-w-xs">{intakeLink}</p>
            <button onClick={copyIntakeLink}
              className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
              <UserPlus className="h-4 w-4" /> Intake link kopiëren
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-4 gap-4">
        {columns.map(col => {
          const colClients = byStatus(col.key)
          return (
            <div key={col.key} className="flex flex-col">
              {/* Column header */}
              <div className={`flex items-center justify-between px-4 py-3 rounded-t-2xl border ${col.border} ${col.bg}`}>
                <div className={`flex items-center gap-2 ${col.color} font-semibold text-sm`}>
                  {col.icon} {col.label}
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${col.bg} ${col.color}`}>{colClients.length}</span>
              </div>

              {/* Cards */}
              <div className={`flex-1 border-x border-b ${col.border} rounded-b-2xl p-3 space-y-2 min-h-[400px] bg-white`}>
                {colClients.length === 0 && (
                  <div className="flex items-center justify-center h-24">
                    <p className="text-xs text-slate-300">Geen clients</p>
                  </div>
                )}
                {colClients.map(client => (
                  <div key={client.id} className="bg-white border border-slate-100 rounded-xl p-3 shadow-sm hover:shadow-card transition-shadow">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {client.full_name.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-900">{client.full_name}</p>
                          <p className="text-xs text-slate-400 truncate max-w-[100px]">{client.goal}</p>
                        </div>
                      </div>
                      <Link to={`/clients/${client.id}`} className="text-slate-300 hover:text-brand-600 transition-colors">
                        <ChevronRight className="h-4 w-4" />
                      </Link>
                    </div>
                    <div className="flex items-center gap-1 mb-2 flex-wrap">
                      <span className={`text-xs px-1.5 py-0.5 rounded-full capitalize ${levelBadge(client.level)}`}>{client.level}</span>
                      <span className="text-xs text-slate-400">{client.days_per_week}×/week</span>
                    </div>
                    {/* Move buttons */}
                    <div className="flex gap-1 flex-wrap">
                      {columns.filter(c => c.key !== col.key).map(target => (
                        <button key={target.key} onClick={() => moveClient(client.id, target.key)}
                          disabled={moving === client.id}
                          className={`text-xs px-2 py-0.5 rounded-lg border ${target.border} ${target.bg} ${target.color} hover:opacity-80 transition-opacity disabled:opacity-40`}>
                          → {target.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {/* Intake clients alert */}
      {byStatus('intake').length > 0 && (
        <div className="mt-6 bg-blue-50 border border-blue-100 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-blue-500" />
            <h3 className="font-bold text-blue-700 text-sm">{byStatus('intake').length} nieuwe intake{byStatus('intake').length !== 1 ? 's' : ''} wachten op je</h3>
          </div>
          <p className="text-xs text-blue-600">Open hun profiel, genereer een programma en verplaats naar Actief.</p>
        </div>
      )}
    </div>
  )
}
