import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight, Crown } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client, Coach } from '../lib/types'
import AddClientModal from '../components/AddClientModal'

export default function Clients() {
  const [clients, setClients] = useState<Client[]>([])
  const [coach, setCoach] = useState<Coach | null>(null)
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: coachData }, { data: clientsData }] = await Promise.all([
      supabase.from('coaches').select('*').eq('id', user.id).single(),
      supabase.from('clients').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
    ])
    setCoach(coachData)
    setClients(clientsData ?? [])
    setLoading(false)
  }

  useEffect(() => { loadData() }, [])

  const levelBadge = (level: string) => ({
    beginner: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60',
    intermediate: 'bg-amber-50 text-amber-700 ring-1 ring-amber-200/60',
    advanced: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200/60',
  }[level] ?? 'bg-slate-100 text-slate-600')

  const atLimit = coach?.plan === 'free' && clients.length >= 3

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-5xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Clients</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {coach?.plan === 'free'
              ? `${clients.length}/3 clients · gratis plan`
              : `${clients.length} client${clients.length !== 1 ? 's' : ''}`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {atLimit && (
            <Link to="/settings" className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors">
              <Crown className="h-3.5 w-3.5" />
              Upgrade voor meer
            </Link>
          )}
          <button
            onClick={() => setShowModal(true)}
            disabled={atLimit}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Plus className="h-4 w-4" />
            Client toevoegen
          </button>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-20 text-center">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plus className="h-6 w-6 text-brand-600" />
          </div>
          <p className="text-slate-900 font-semibold mb-1">Nog geen clients</p>
          <p className="text-slate-400 text-sm mb-6">Voeg je eerste client toe en genereer direct een AI-programma</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            Client toevoegen
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3.5">Client</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3.5">Doel</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3.5">Niveau</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3.5">Dagen/wk</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3.5">Toegevoegd</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {clients.map((client, i) => (
                <tr key={client.id} className={`hover:bg-slate-50/60 transition-colors ${i < clients.length - 1 ? 'border-b border-slate-50' : ''}`}>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {client.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-semibold text-slate-900">{client.full_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500 max-w-xs truncate">{client.goal}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full capitalize ${levelBadge(client.level)}`}>
                      {client.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-slate-500">{client.days_per_week}×</td>
                  <td className="px-6 py-4 text-sm text-slate-400">
                    {new Date(client.created_at).toLocaleDateString('nl-NL')}
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/clients/${client.id}`} className="text-slate-300 hover:text-brand-600 transition-colors">
                      <ChevronRight className="h-4 w-4" />
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <AddClientModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); loadData() }}
        />
      )}
    </div>
  )
}
