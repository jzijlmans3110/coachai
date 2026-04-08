import { useEffect, useState } from 'react'
import { BookTemplate, Trash2, Zap, Users, Loader2 } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client } from '../lib/types'

interface Template {
  id: string
  coach_id: string
  title: string
  weeks: number
  content: object
  created_at: string
}

export default function Templates() {
  const [templates, setTemplates] = useState<Template[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [assigning, setAssigning] = useState<string | null>(null)
  const [selectedClients, setSelectedClients] = useState<Record<string, string[]>>({})
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const [{ data: tmpl }, { data: cli }] = await Promise.all([
        supabase.from('program_templates').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
        supabase.from('clients').select('id, full_name, goal, level').eq('coach_id', user.id).eq('status', 'actief').order('full_name'),
      ])
      setTemplates(tmpl ?? [])
      setClients(cli ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const deleteTemplate = async (id: string) => {
    await supabase.from('program_templates').delete().eq('id', id)
    setTemplates(prev => prev.filter(t => t.id !== id))
  }

  const toggleClient = (templateId: string, clientId: string) => {
    setSelectedClients(prev => {
      const current = prev[templateId] ?? []
      return {
        ...prev,
        [templateId]: current.includes(clientId) ? current.filter(id => id !== clientId) : [...current, clientId],
      }
    })
  }

  const assignToClients = async (template: Template) => {
    const clientIds = selectedClients[template.id] ?? []
    if (clientIds.length === 0) return
    setAssigning(template.id)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return

    const inserts = clientIds.map(cid => ({
      client_id: cid,
      coach_id: user.id,
      title: template.title.replace('Template: ', ''),
      weeks: template.weeks,
      content: template.content,
      ai_generated: false,
    }))

    await supabase.from('programs').insert(inserts)
    setAssigning(null)
    setSelectedClients(prev => ({ ...prev, [template.id]: [] }))
    setSuccess(`Programma toegewezen aan ${clientIds.length} client${clientIds.length !== 1 ? 's' : ''}`)
    setTimeout(() => setSuccess(null), 3000)
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-slate-900">Programma templates</h1>
        <p className="text-slate-400 text-sm mt-0.5">Hergebruik opgeslagen programma's en wijs ze toe aan meerdere clients</p>
      </div>

      {success && (
        <div className="bg-emerald-50 border border-emerald-100 text-emerald-700 text-sm rounded-xl px-4 py-3 mb-5">
          ✓ {success}
        </div>
      )}

      {templates.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-12 text-center">
          <BookTemplate className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm mb-2">Nog geen templates opgeslagen.</p>
          <p className="text-xs text-slate-300">Ga naar een client → Overzicht → klik "Template" op een programma om het op te slaan.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {templates.map(template => {
            const sel = selectedClients[template.id] ?? []
            const content = template.content as { weeks?: unknown[] }
            const daysCount = (content.weeks as Array<{ days: unknown[] }>)?.[0]?.days?.length ?? 0
            return (
              <div key={template.id} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
                <div className="flex items-start justify-between mb-4">
                  <div>
                    <h3 className="font-bold text-slate-900">{template.title}</h3>
                    <p className="text-xs text-slate-400 mt-1">
                      {template.weeks} weken · {daysCount} dagen/week · Opgeslagen {new Date(template.created_at).toLocaleDateString('nl-NL')}
                    </p>
                  </div>
                  <button onClick={() => deleteTemplate(template.id)}
                    className="text-slate-300 hover:text-rose-400 transition-colors p-1">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>

                {/* Client selection */}
                <div>
                  <p className="text-xs font-semibold text-slate-500 mb-2 flex items-center gap-1.5">
                    <Users className="h-3.5 w-3.5" /> Toewijzen aan clients:
                  </p>
                  <div className="flex flex-wrap gap-2 mb-3">
                    {clients.map(client => (
                      <button key={client.id} onClick={() => toggleClient(template.id, client.id)}
                        className={`flex items-center gap-1.5 text-xs font-semibold px-3 py-1.5 rounded-xl border transition-all ${
                          sel.includes(client.id)
                            ? 'bg-brand-600 text-white border-brand-600'
                            : 'bg-white text-slate-600 border-slate-200 hover:border-brand-300'
                        }`}>
                        <span className={`w-4 h-4 rounded-full flex items-center justify-center text-xs font-bold ${sel.includes(client.id) ? 'bg-white/20 text-white' : 'bg-brand-100 text-brand-600'}`}>
                          {client.full_name.charAt(0)}
                        </span>
                        {client.full_name.split(' ')[0]}
                      </button>
                    ))}
                    {clients.length === 0 && <p className="text-xs text-slate-300">Geen actieve clients</p>}
                  </div>
                  <button onClick={() => assignToClients(template)} disabled={sel.length === 0 || assigning === template.id}
                    className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors disabled:opacity-40">
                    {assigning === template.id ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
                    {sel.length > 0 ? `Toewijzen aan ${sel.length} client${sel.length !== 1 ? 's' : ''}` : 'Selecteer clients'}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
