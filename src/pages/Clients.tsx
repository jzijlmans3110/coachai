import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight } from 'lucide-react'
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

  const levelColor = (level: string) => ({
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-red-100 text-red-700',
  }[level] ?? 'bg-gray-100 text-gray-600')

  const atClientLimit = coach?.plan === 'free' && clients.length >= 3

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Clients</h1>
          <p className="text-gray-500 text-sm mt-1">
            {coach?.plan === 'free'
              ? `${clients.length}/3 clients on free plan`
              : `${clients.length} clients`}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {atClientLimit && (
            <Link
              to="/settings"
              className="text-sm text-blue-500 hover:text-blue-600 font-medium"
            >
              Upgrade to Pro for unlimited clients
            </Link>
          )}
          <button
            onClick={() => setShowModal(true)}
            disabled={atClientLimit}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          >
            <Plus className="h-4 w-4" />
            Add client
          </button>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 px-6 py-16 text-center">
          <div className="w-12 h-12 bg-blue-50 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Plus className="h-6 w-6 text-blue-500" />
          </div>
          <p className="text-gray-900 font-medium mb-1">No clients yet</p>
          <p className="text-gray-500 text-sm mb-4">Add your first client to get started</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Add client
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Name</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Goal</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Level</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Days/wk</th>
                <th className="text-left text-xs font-medium text-gray-500 uppercase tracking-wide px-6 py-3">Added</th>
                <th />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {clients.map(client => (
                <tr key={client.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                        {client.full_name.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-sm font-medium text-gray-900">{client.full_name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600 max-w-xs truncate">{client.goal}</td>
                  <td className="px-6 py-4">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${levelColor(client.level)}`}>
                      {client.level}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-600">{client.days_per_week}x</td>
                  <td className="px-6 py-4 text-sm text-gray-500">
                    {new Date(client.created_at).toLocaleDateString()}
                  </td>
                  <td className="px-6 py-4">
                    <Link to={`/clients/${client.id}`} className="text-gray-400 hover:text-gray-600">
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
