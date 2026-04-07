import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Users, BarChart2, ChevronRight } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client, Program } from '../lib/types'

export default function Dashboard() {
  const [clients, setClients] = useState<Client[]>([])
  const [programs, setPrograms] = useState<Program[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: clientsData }, { data: programsData }] = await Promise.all([
        supabase.from('clients').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
        supabase.from('programs').select('*').eq('coach_id', user.id),
      ])

      setClients(clientsData ?? [])
      setPrograms(programsData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const thisMonth = new Date()
  thisMonth.setDate(1)
  const programsThisMonth = programs.filter(p => new Date(p.created_at) >= thisMonth).length

  const levelColor = (level: string) => ({
    beginner: 'bg-green-100 text-green-700',
    intermediate: 'bg-yellow-100 text-yellow-700',
    advanced: 'bg-red-100 text-red-700',
  }[level] ?? 'bg-gray-100 text-gray-600')

  if (loading) return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500" />
    </div>
  )

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">Welcome back — here's your overview.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-50 rounded-lg p-2">
              <Users className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-gray-600">Total clients</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{clients.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-center gap-3 mb-3">
            <div className="bg-blue-50 rounded-lg p-2">
              <BarChart2 className="h-5 w-5 text-blue-500" />
            </div>
            <span className="text-sm font-medium text-gray-600">Programs this month</span>
          </div>
          <p className="text-3xl font-bold text-gray-900">{programsThisMonth}</p>
        </div>
      </div>

      {/* Recent clients */}
      <div className="bg-white rounded-xl border border-gray-200">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Recent clients</h2>
          <Link to="/clients" className="text-sm text-blue-500 hover:text-blue-600 font-medium">
            View all
          </Link>
        </div>
        {clients.length === 0 ? (
          <div className="px-6 py-12 text-center">
            <p className="text-gray-400 text-sm">No clients yet.</p>
            <Link to="/clients" className="text-blue-500 hover:text-blue-600 text-sm font-medium mt-1 inline-block">
              Add your first client →
            </Link>
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {clients.slice(0, 5).map(client => (
              <li key={client.id}>
                <Link
                  to={`/clients/${client.id}`}
                  className="flex items-center justify-between px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-blue-500 flex items-center justify-center text-white text-sm font-medium">
                      {client.full_name.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <p className="text-sm font-medium text-gray-900">{client.full_name}</p>
                      <p className="text-xs text-gray-500">{client.goal}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${levelColor(client.level)}`}>
                      {client.level}
                    </span>
                    <ChevronRight className="h-4 w-4 text-gray-400" />
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
