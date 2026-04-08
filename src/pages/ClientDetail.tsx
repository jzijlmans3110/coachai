import { useEffect, useState, useCallback } from 'react'
import { useParams, Link } from 'react-router-dom'
import { ArrowLeft, Zap, Calendar, ClipboardList, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client, Program, CheckIn } from '../lib/types'
import ProgramView from '../components/ProgramView'

export default function ClientDetail() {
  const { id } = useParams<{ id: string }>()
  const [client, setClient] = useState<Client | null>(null)
  const [programs, setPrograms] = useState<Program[]>([])
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [generating, setGenerating] = useState(false)
  const [generatedProgram, setGeneratedProgram] = useState<Program | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

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

    if (error || data?.error) {
      setError(data?.error || `Failed: ${error?.message}`)
    } else if (data?.program) {
      setGeneratedProgram(data.program)
      loadData()
    }

    setGenerating(false)
  }

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

  if (!client) return (
    <div className="p-8 text-center text-gray-500">Client not found.</div>
  )

  const checkinUrl = `${window.location.origin}/checkin/${client.id}`

  return (
    <div className="p-8 max-w-5xl">
      {/* Back */}
      <Link to="/clients" className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-6">
        <ArrowLeft className="h-4 w-4" />
        Back to clients
      </Link>

      {/* Client card */}
      <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-full bg-blue-500 flex items-center justify-center text-white text-xl font-bold">
              {client.full_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <h1 className="text-xl font-bold text-gray-900">{client.full_name}</h1>
              <p className="text-gray-500 text-sm mt-0.5">{client.goal}</p>
              <div className="flex items-center gap-2 mt-2">
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${levelColor(client.level)}`}>
                  {client.level}
                </span>
                <span className="text-xs text-gray-500">{client.days_per_week}x/week</span>
              </div>
            </div>
          </div>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="flex items-center gap-2 bg-blue-500 hover:bg-blue-600 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
          >
            {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
            {generating ? 'Generating...' : 'Generate program'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-5 pt-5 border-t border-gray-100">
          <div>
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Equipment</p>
            <div className="flex flex-wrap gap-1.5">
              {client.equipment.length > 0
                ? client.equipment.map(e => (
                    <span key={e} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">{e}</span>
                  ))
                : <span className="text-xs text-gray-400">None specified</span>
              }
            </div>
          </div>
          {client.injuries && (
            <div>
              <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Injuries / limitations</p>
              <p className="text-sm text-gray-600">{client.injuries}</p>
            </div>
          )}
        </div>

        <div className="mt-4 pt-4 border-t border-gray-100">
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">Check-in link (share with client)</p>
          <code className="text-xs bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-gray-700 break-all">
            {checkinUrl}
          </code>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-6">
          {error}
        </div>
      )}

      {/* Generated program (live editor) */}
      {generating && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl px-6 py-8 text-center mb-6">
          <Loader2 className="h-7 w-7 text-blue-500 animate-spin mx-auto mb-3" />
          <p className="text-blue-700 font-medium">AI is generating your program...</p>
          <p className="text-blue-500 text-sm mt-1">This usually takes 10–20 seconds</p>
        </div>
      )}

      {generatedProgram && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
            <Zap className="h-4 w-4 text-blue-500" />
            New program generated
          </h2>
          <ProgramView program={generatedProgram} onSaved={loadData} />
        </div>
      )}

      {/* Programs list */}
      <div className="mb-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-600" />
          Programs ({programs.length})
        </h2>
        {programs.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-8 text-center">
            <p className="text-gray-400 text-sm">No programs yet. Generate one above.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {programs.map(program => (
              <div key={program.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-gray-900 text-sm">{program.title}</p>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {program.weeks} weeks · Created {new Date(program.created_at).toLocaleDateString()}
                      {program.ai_generated && ' · AI generated'}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Check-ins */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3 flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-gray-600" />
          Check-ins ({checkIns.length})
        </h2>
        {checkIns.length === 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 px-6 py-8 text-center">
            <p className="text-gray-400 text-sm">No check-ins yet.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {checkIns.map(ci => (
              <div key={ci.id} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="flex items-start justify-between mb-2">
                  <p className="text-sm font-medium text-gray-900">Week {ci.week_number}</p>
                  <p className="text-xs text-gray-500">{new Date(ci.submitted_at).toLocaleDateString()}</p>
                </div>
                <div className="flex items-center gap-4 text-sm text-gray-600 mb-2">
                  {ci.weight_kg && <span>⚖️ {ci.weight_kg} kg</span>}
                  <span>⚡ Energy: {ci.energy}/10</span>
                  {ci.sleep_hrs && <span>😴 {ci.sleep_hrs}h sleep</span>}
                </div>
                {ci.notes && <p className="text-sm text-gray-600 mb-2">{ci.notes}</p>}
                {ci.ai_feedback && (
                  <div className="bg-blue-50 border border-blue-100 rounded-lg px-3 py-2">
                    <p className="text-xs font-medium text-blue-600 mb-1">AI feedback</p>
                    <p className="text-sm text-blue-800">{ci.ai_feedback}</p>
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
