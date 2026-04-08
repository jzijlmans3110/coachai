import { useEffect, useState } from 'react'
import { Trophy, Plus, Users, Calendar, Target, X, ChevronDown, ChevronUp } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Challenge, ChallengeEntry, Client } from '../lib/types'

interface LeaderboardEntry {
  client: Client
  entry: ChallengeEntry | null
  rank: number
}

export default function Challenges() {
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [entries, setEntries] = useState<ChallengeEntry[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    title: '',
    description: '',
    metric: '',
    target: '',
    start_date: new Date().toISOString().slice(0, 10),
    end_date: '',
  })

  useEffect(() => {
    load()
  }, [])

  const load = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: ch }, { data: cl }, { data: en }] = await Promise.all([
      supabase.from('challenges').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
      supabase.from('clients').select('*').eq('coach_id', user.id),
      supabase.from('challenge_entries').select('*'),
    ])
    setChallenges(ch ?? [])
    setClients(cl ?? [])
    setEntries(en ?? [])
    setLoading(false)
  }

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('challenges').insert({
      coach_id: user.id,
      title: form.title,
      description: form.description || null,
      metric: form.metric,
      target: parseFloat(form.target),
      start_date: form.start_date,
      end_date: form.end_date,
      active: true,
    })
    setForm({ title: '', description: '', metric: '', target: '', start_date: new Date().toISOString().slice(0, 10), end_date: '' })
    setShowForm(false)
    setSaving(false)
    load()
  }

  const handleToggleActive = async (challenge: Challenge) => {
    await supabase.from('challenges').update({ active: !challenge.active }).eq('id', challenge.id)
    load()
  }

  const handleDelete = async (id: string) => {
    await supabase.from('challenge_entries').delete().eq('challenge_id', id)
    await supabase.from('challenges').delete().eq('id', id)
    load()
  }

  const getLeaderboard = (challenge: Challenge): LeaderboardEntry[] => {
    const challengeEntries = entries.filter(e => e.challenge_id === challenge.id)
    const ranked = clients.map(client => ({
      client,
      entry: challengeEntries.find(e => e.client_id === client.id) ?? null,
    }))
      .sort((a, b) => (b.entry?.value ?? -1) - (a.entry?.value ?? -1))
      .map((item, i) => ({ ...item, rank: i + 1 }))
    return ranked
  }

  const daysLeft = (end: string) => {
    const diff = Math.ceil((new Date(end).getTime() - Date.now()) / 86400000)
    return diff
  }

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 md:p-8 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Groepsuitdagingen</h1>
          <p className="text-sm text-slate-400 mt-0.5">Motiveer clients met onderlinge competitie</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 bg-brand-600 text-white text-sm font-semibold px-4 py-2.5 rounded-xl hover:bg-brand-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nieuwe uitdaging
        </button>
      </div>

      {/* Create form */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900">Nieuwe uitdaging</h2>
              <button onClick={() => setShowForm(false)} className="p-1.5 hover:bg-slate-100 rounded-lg transition-colors">
                <X className="h-4 w-4 text-slate-500" />
              </button>
            </div>
            <form onSubmit={handleCreate} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Titel *</label>
                <input
                  required
                  value={form.title}
                  onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                  placeholder="bijv. 30-daagse stap challenge"
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">Beschrijving</label>
                <textarea
                  value={form.description}
                  onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
                  placeholder="Optionele uitleg voor de clients..."
                  rows={2}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 resize-none"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Meeteenheid *</label>
                  <input
                    required
                    value={form.metric}
                    onChange={e => setForm(f => ({ ...f, metric: e.target.value }))}
                    placeholder="bijv. kg, km, stappen"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Doel *</label>
                  <input
                    required
                    type="number"
                    min="0"
                    step="any"
                    value={form.target}
                    onChange={e => setForm(f => ({ ...f, target: e.target.value }))}
                    placeholder="bijv. 100"
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Startdatum *</label>
                  <input
                    required
                    type="date"
                    value={form.start_date}
                    onChange={e => setForm(f => ({ ...f, start_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1.5">Einddatum *</label>
                  <input
                    required
                    type="date"
                    value={form.end_date}
                    onChange={e => setForm(f => ({ ...f, end_date: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                  />
                </div>
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setShowForm(false)} className="flex-1 border border-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition-colors">
                  Annuleren
                </button>
                <button type="submit" disabled={saving} className="flex-1 bg-brand-600 text-white text-sm font-semibold py-2.5 rounded-xl hover:bg-brand-700 transition-colors disabled:opacity-50">
                  {saving ? 'Aanmaken...' : 'Aanmaken'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Challenge list */}
      {challenges.length === 0 ? (
        <div className="bg-white border border-slate-100 rounded-2xl shadow-card p-12 text-center">
          <Trophy className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-500 font-medium mb-1">Nog geen uitdagingen</p>
          <p className="text-slate-400 text-sm">Maak een groepsuitdaging aan om clients te motiveren.</p>
        </div>
      ) : (
        <div className="space-y-4">
          {challenges.map(challenge => {
            const leaderboard = getLeaderboard(challenge)
            const isExpanded = expandedId === challenge.id
            const days = daysLeft(challenge.end_date)
            const topEntry = leaderboard[0]?.entry

            return (
              <div key={challenge.id} className="bg-white border border-slate-100 rounded-2xl shadow-card overflow-hidden">
                {/* Challenge header */}
                <div
                  className="flex items-start gap-4 px-5 py-4 cursor-pointer hover:bg-slate-50/60 transition-colors"
                  onClick={() => setExpandedId(isExpanded ? null : challenge.id)}
                >
                  <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${challenge.active ? 'bg-brand-50' : 'bg-slate-100'}`}>
                    <Trophy className={`h-5 w-5 ${challenge.active ? 'text-brand-600' : 'text-slate-400'}`} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="font-bold text-slate-900 text-sm">{challenge.title}</h3>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${challenge.active ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200/60' : 'bg-slate-100 text-slate-500'}`}>
                        {challenge.active ? 'Actief' : 'Inactief'}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 mt-1 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Target className="h-3 w-3" /> Doel: {challenge.target} {challenge.metric}
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Users className="h-3 w-3" /> {leaderboard.filter(l => l.entry).length} deelnemers
                      </span>
                      <span className="flex items-center gap-1 text-xs text-slate-400">
                        <Calendar className="h-3 w-3" />
                        {days > 0 ? `${days} dagen over` : days === 0 ? 'Eindigt vandaag' : 'Afgelopen'}
                      </span>
                      {topEntry && (
                        <span className="flex items-center gap-1 text-xs font-semibold text-amber-600">
                          🥇 {leaderboard[0].client.full_name.split(' ')[0]}: {topEntry.value} {challenge.metric}
                        </span>
                      )}
                    </div>
                  </div>
                  {isExpanded ? <ChevronUp className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" /> : <ChevronDown className="h-4 w-4 text-slate-400 flex-shrink-0 mt-1" />}
                </div>

                {/* Leaderboard (expanded) */}
                {isExpanded && (
                  <div className="border-t border-slate-50">
                    {challenge.description && (
                      <p className="px-5 py-3 text-xs text-slate-500 bg-slate-50/50">{challenge.description}</p>
                    )}
                    <div className="px-5 py-3">
                      <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-3">Ranglijst</p>
                      {leaderboard.length === 0 ? (
                        <p className="text-xs text-slate-400">Nog geen deelnemers.</p>
                      ) : (
                        <div className="space-y-2">
                          {leaderboard.map(({ client, entry, rank }) => {
                            const pct = entry ? Math.min((entry.value / challenge.target) * 100, 100) : 0
                            const medal = rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `${rank}.`
                            return (
                              <div key={client.id} className="flex items-center gap-3">
                                <span className="w-6 text-sm text-center flex-shrink-0">{medal}</span>
                                <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {client.full_name.charAt(0)}
                                </div>
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center justify-between mb-0.5">
                                    <span className="text-xs font-semibold text-slate-700 truncate">{client.full_name}</span>
                                    <span className="text-xs text-slate-500 flex-shrink-0 ml-2">{entry ? `${entry.value} / ${challenge.target} ${challenge.metric}` : '—'}</span>
                                  </div>
                                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div
                                      className={`h-full rounded-full transition-all ${rank === 1 ? 'bg-amber-400' : rank === 2 ? 'bg-slate-400' : rank === 3 ? 'bg-orange-400' : 'bg-brand-400'}`}
                                      style={{ width: `${pct}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      )}
                    </div>
                    {/* Actions */}
                    <div className="flex items-center gap-2 px-5 py-3 border-t border-slate-50">
                      <button
                        onClick={() => handleToggleActive(challenge)}
                        className="text-xs font-semibold text-slate-600 hover:text-slate-900 transition-colors px-3 py-1.5 rounded-lg hover:bg-slate-100"
                      >
                        {challenge.active ? 'Deactiveren' : 'Activeren'}
                      </button>
                      <button
                        onClick={() => handleDelete(challenge.id)}
                        className="text-xs font-semibold text-rose-500 hover:text-rose-700 transition-colors px-3 py-1.5 rounded-lg hover:bg-rose-50 ml-auto"
                      >
                        Verwijderen
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
