import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { Plus, ChevronRight, Crown, Megaphone, Send, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client, Coach, Broadcast } from '../lib/types'
import AddClientModal from '../components/AddClientModal'
import { useLanguage } from '../lib/LanguageContext'

export default function Clients() {
  const { t } = useLanguage()
  const [clients, setClients] = useState<Client[]>([])
  const [coach, setCoach] = useState<Coach | null>(null)
  const [broadcasts, setBroadcasts] = useState<Broadcast[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [broadcastTitle, setBroadcastTitle] = useState('')
  const [broadcastMessage, setBroadcastMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const sentTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => { if (sentTimerRef.current) clearTimeout(sentTimerRef.current) }, [])

  const loadData = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const [{ data: coachData }, { data: clientsData }, { data: broadcastsData }] = await Promise.all([
      supabase.from('coaches').select('*').eq('id', user.id).single(),
      supabase.from('clients').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
      supabase.from('broadcasts').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }).limit(5),
    ])
    setCoach(coachData)
    setClients(clientsData ?? [])
    setBroadcasts(broadcastsData ?? [])
    setLoading(false)
  }

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!broadcastTitle.trim() || !broadcastMessage.trim()) return
    setSending(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    await supabase.from('broadcasts').insert({
      coach_id: user.id,
      title: broadcastTitle.trim(),
      message: broadcastMessage.trim(),
    })
    setBroadcastTitle('')
    setBroadcastMessage('')
    setSending(false)
    setSent(true)
    if (sentTimerRef.current) clearTimeout(sentTimerRef.current)
    sentTimerRef.current = setTimeout(() => setSent(false), 3000)
    loadData()
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
          <h1 className="text-2xl font-bold text-slate-900">{t('clients_title')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">
            {coach?.plan === 'free'
              ? t('free_plan_sub', { n: clients.length })
              : t('pro_plan_sub', { n: clients.length, s: clients.length !== 1 ? 's' : '' })}
          </p>
        </div>
        <div className="flex items-center gap-3">
          {atLimit && (
            <Link to="/settings" className="flex items-center gap-1.5 text-xs font-semibold text-amber-600 hover:text-amber-700 transition-colors">
              <Crown className="h-3.5 w-3.5" />
              {t('upgrade_for_more')}
            </Link>
          )}
          <button
            onClick={() => setShowModal(true)}
            disabled={atLimit}
            className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <Plus className="h-4 w-4" />
            {t('add_client_btn')}
          </button>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-20 text-center">
          <div className="w-14 h-14 bg-brand-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plus className="h-6 w-6 text-brand-600" />
          </div>
          <p className="text-slate-900 font-semibold mb-1">{t('no_clients_empty_title')}</p>
          <p className="text-slate-400 text-sm mb-6">{t('no_clients_empty_desc')}</p>
          <button
            onClick={() => setShowModal(true)}
            className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-5 py-2.5 rounded-xl transition-colors shadow-sm"
          >
            {t('add_client_btn')}
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3.5">{t('table_client')}</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3.5">{t('table_goal')}</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3.5">{t('table_level')}</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3.5">{t('table_days_week')}</th>
                <th className="text-left text-xs font-semibold text-slate-400 uppercase tracking-wider px-6 py-3.5">{t('table_added')}</th>
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

      {/* Broadcast panel */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-5">
        <div className="bg-white border border-slate-100 rounded-2xl shadow-card p-5">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-brand-50 rounded-xl p-2">
              <Megaphone className="h-4 w-4 text-brand-600" />
            </div>
            <div>
              <h2 className="font-bold text-slate-900 text-sm">{t('broadcast_title')}</h2>
              <p className="text-xs text-slate-400">{t('broadcast_desc')}</p>
            </div>
          </div>
          <form onSubmit={handleBroadcast} className="space-y-3">
            <input
              value={broadcastTitle}
              onChange={e => setBroadcastTitle(e.target.value)}
              placeholder={t('broadcast_subject_placeholder')}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
            />
            <textarea
              value={broadcastMessage}
              onChange={e => setBroadcastMessage(e.target.value)}
              placeholder={t('broadcast_message_placeholder')}
              rows={4}
              className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 resize-none"
            />
            <button
              type="submit"
              disabled={sending || !broadcastTitle.trim() || !broadcastMessage.trim() || clients.length === 0}
              className={`w-full flex items-center justify-center gap-2 text-sm font-semibold py-2.5 rounded-xl transition-colors ${
                sent
                  ? 'bg-emerald-500 text-white'
                  : 'bg-brand-600 hover:bg-brand-700 text-white disabled:opacity-40 disabled:cursor-not-allowed'
              }`}
            >
              {sent ? (
                <><Check className="h-4 w-4" /> {t('broadcast_sent', { n: clients.length })}</>
              ) : sending ? (
                t('sending')
              ) : (
                <><Send className="h-4 w-4" /> {t('broadcast_send_btn', { n: clients.length, s: clients.length !== 1 ? 's' : '' })}</>
              )}
            </button>
          </form>
        </div>

        <div className="bg-white border border-slate-100 rounded-2xl shadow-card p-5">
          <h2 className="font-bold text-slate-900 text-sm mb-4">{t('recent_messages')}</h2>
          {broadcasts.length === 0 ? (
            <div className="text-center py-8">
              <Megaphone className="h-8 w-8 text-slate-200 mx-auto mb-2" />
              <p className="text-slate-400 text-sm">{t('no_messages')}</p>
            </div>
          ) : (
            <div className="space-y-3">
              {broadcasts.map(b => (
                <div key={b.id} className="bg-slate-50 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-1">
                    <p className="text-xs font-bold text-slate-800">{b.title}</p>
                    <p className="text-xs text-slate-400">{new Date(b.created_at).toLocaleDateString('nl-NL')}</p>
                  </div>
                  <p className="text-xs text-slate-500 leading-relaxed line-clamp-2">{b.message}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {showModal && (
        <AddClientModal
          onClose={() => setShowModal(false)}
          onSuccess={() => { setShowModal(false); loadData() }}
        />
      )}
    </div>
  )
}
