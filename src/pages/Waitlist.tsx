import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, ChevronLeft, ChevronRight, X, Check } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useLanguage } from '../lib/LanguageContext'

interface Lead {
  id: string
  coach_id: string
  name: string
  email: string | null
  phone: string | null
  status: 'geinteresseerd' | 'intake_gepland' | 'offerte_gestuurd' | 'gewonnen' | 'verloren'
  source: string | null
  notes: string | null
  referred_by: string | null
  created_at: string
}

type LeadStatus = Lead['status']

const SOURCES = ['Socials', 'Website', 'Mond-tot-mond', 'Referral', 'Anders']

const emptyForm = {
  name: '',
  email: '',
  phone: '',
  source: '',
  referred_by: '',
  notes: '',
  status: 'geinteresseerd' as LeadStatus,
}

export default function Waitlist() {
  const { t } = useLanguage()
  const [leads, setLeads] = useState<Lead[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editingLead, setEditingLead] = useState<Lead | null>(null)
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [celebration, setCelebration] = useState<string | null>(null)

  const STATUSES: { key: LeadStatus; labelKey: string; color: string; bg: string; ring: string }[] = [
    { key: 'geinteresseerd',   labelKey: 'lead_geinteresseerd',   color: 'text-blue-700',   bg: 'bg-blue-50',   ring: 'ring-blue-200/60' },
    { key: 'intake_gepland',   labelKey: 'lead_intake_gepland',   color: 'text-amber-700',  bg: 'bg-amber-50',  ring: 'ring-amber-200/60' },
    { key: 'offerte_gestuurd', labelKey: 'lead_offerte_gestuurd', color: 'text-purple-700', bg: 'bg-purple-50', ring: 'ring-purple-200/60' },
    { key: 'gewonnen',         labelKey: 'lead_gewonnen',         color: 'text-emerald-700',bg: 'bg-emerald-50',ring: 'ring-emerald-200/60' },
    { key: 'verloren',         labelKey: 'lead_verloren',         color: 'text-slate-500',  bg: 'bg-slate-100', ring: 'ring-slate-200/60' },
  ]

  const loadLeads = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return
    const { data } = await supabase
      .from('leads')
      .select('*')
      .eq('coach_id', user.id)
      .order('created_at', { ascending: false })
    setLeads(data ?? [])
    setLoading(false)
  }

  useEffect(() => { loadLeads() }, [])

  useEffect(() => {
    if (!celebration) return
    const timer = setTimeout(() => setCelebration(null), 3000)
    return () => clearTimeout(timer)
  }, [celebration])

  const openNew = () => {
    setEditingLead(null)
    setForm(emptyForm)
    setShowForm(true)
  }

  const openEdit = (lead: Lead) => {
    setEditingLead(lead)
    setForm({
      name: lead.name,
      email: lead.email ?? '',
      phone: lead.phone ?? '',
      source: lead.source ?? '',
      referred_by: lead.referred_by ?? '',
      notes: lead.notes ?? '',
      status: lead.status,
    })
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setEditingLead(null)
    setForm(emptyForm)
  }

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.name.trim()) return
    setSaving(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setSaving(false); return }

    const payload = {
      coach_id: user.id,
      name: form.name.trim(),
      email: form.email.trim() || null,
      phone: form.phone.trim() || null,
      source: form.source || null,
      referred_by: form.referred_by.trim() || null,
      notes: form.notes.trim() || null,
      status: form.status,
    }

    if (editingLead) {
      const prevStatus = editingLead.status
      await supabase.from('leads').update(payload).eq('id', editingLead.id)
      if (prevStatus !== 'gewonnen' && form.status === 'gewonnen') {
        setCelebration(form.name.trim())
      }
    } else {
      await supabase.from('leads').insert(payload)
      if (form.status === 'gewonnen') setCelebration(form.name.trim())
    }

    setSaving(false)
    closeForm()
    loadLeads()
  }

  const handleDelete = async (lead: Lead) => {
    if (!window.confirm(t('confirm_delete_lead', { name: lead.name }))) return
    await supabase.from('leads').delete().eq('id', lead.id)
    loadLeads()
  }

  const moveStatus = async (lead: Lead, direction: 'prev' | 'next') => {
    const idx = STATUSES.findIndex(s => s.key === lead.status)
    const newIdx = direction === 'next' ? idx + 1 : idx - 1
    if (newIdx < 0 || newIdx >= STATUSES.length) return
    const newStatus = STATUSES[newIdx].key
    await supabase.from('leads').update({ status: newStatus }).eq('id', lead.id)
    if (lead.status !== 'gewonnen' && newStatus === 'gewonnen') {
      setCelebration(lead.name)
    }
    loadLeads()
  }

  const now = new Date()
  const thisMonthLeads = leads.filter(l => {
    const d = new Date(l.created_at)
    return d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth()
  })
  const gewonnen = leads.filter(l => l.status === 'gewonnen').length
  const verloren = leads.filter(l => l.status === 'verloren').length
  const inPipeline = leads.filter(l => l.status !== 'gewonnen' && l.status !== 'verloren').length
  const conversionRate = (gewonnen + verloren) > 0
    ? Math.round((gewonnen / (gewonnen + verloren)) * 100)
    : 0

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-6 md:p-8 max-w-full">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('waitlist_title')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t('waitlist_desc')}</p>
        </div>
        <button
          onClick={openNew}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          {t('new_lead')}
        </button>
      </div>

      {celebration && (
        <div className="mb-5 flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-3 text-emerald-800 font-semibold text-sm shadow-sm">
          <span className="text-xl">🎉</span>
          {t('celebration_text', { name: celebration })}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        {[
          { labelKey: 'stat_total_leads', value: leads.length },
          { labelKey: 'stat_in_pipeline', value: inPipeline },
          { labelKey: 'stat_conversion', value: `${conversionRate}%` },
          { labelKey: 'stat_this_month', value: thisMonthLeads.length },
        ].map(stat => (
          <div key={stat.labelKey} className="bg-white rounded-2xl border border-slate-100 shadow-card px-5 py-4">
            <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">{t(stat.labelKey)}</p>
            <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="flex gap-4 overflow-x-auto pb-4">
        {STATUSES.map(({ key, labelKey, color, bg, ring }) => {
          const colLeads = leads.filter(l => l.status === key)
          const statusIdx = STATUSES.findIndex(s => s.key === key)
          return (
            <div key={key} className="flex-shrink-0 w-72">
              <div className="flex items-center gap-2 mb-3">
                <span className={`text-xs font-bold px-2.5 py-1 rounded-full ${bg} ${color} ring-1 ${ring}`}>
                  {t(labelKey)}
                </span>
                <span className="text-xs text-slate-400 font-medium">{colLeads.length}</span>
              </div>

              <div className="space-y-3 min-h-16">
                {colLeads.length === 0 && (
                  <div className="border-2 border-dashed border-slate-200 rounded-2xl h-20 flex items-center justify-center">
                    <p className="text-xs text-slate-300 font-medium">{t('no_leads')}</p>
                  </div>
                )}
                {colLeads.map(lead => (
                  <div key={lead.id} className="bg-white border border-slate-100 rounded-2xl shadow-card p-4 group">
                    <div className="flex items-start gap-3 mb-3">
                      <div className="w-8 h-8 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                        {lead.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{lead.name}</p>
                        {lead.email && <p className="text-xs text-slate-400 truncate">{lead.email}</p>}
                        {!lead.email && lead.phone && <p className="text-xs text-slate-400 truncate">{lead.phone}</p>}
                      </div>
                    </div>

                    {lead.source && (
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 mb-2">
                        {t(`source_${lead.source}`) !== `source_${lead.source}` ? t(`source_${lead.source}`) : lead.source}
                      </span>
                    )}

                    {lead.notes && (
                      <p className="text-xs text-slate-400 leading-relaxed line-clamp-2 mb-3">{lead.notes}</p>
                    )}

                    <p className="text-xs text-slate-300 mb-3">
                      {new Date(lead.created_at).toLocaleDateString('nl-NL')}
                    </p>

                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => moveStatus(lead, 'prev')}
                        disabled={statusIdx === 0}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ChevronLeft className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => moveStatus(lead, 'next')}
                        disabled={statusIdx === STATUSES.length - 1}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
                      >
                        <ChevronRight className="h-3.5 w-3.5" />
                      </button>
                      <div className="flex-1" />
                      <button
                        onClick={() => openEdit(lead)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-brand-600 hover:bg-brand-50 transition-colors"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onClick={() => handleDelete(lead)}
                        className="p-1.5 rounded-lg text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-sm">
          <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
            <div className="flex items-center justify-between px-6 py-5 border-b border-slate-100">
              <h2 className="font-bold text-slate-900 text-base">
                {editingLead ? t('edit_lead_title') : t('new_lead')}
              </h2>
              <button onClick={closeForm} className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-50 transition-colors">
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSave} className="px-6 py-5 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('label_name_req')}</label>
                <input
                  value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                  required
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('label_email_wl')}</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={e => setForm(f => ({ ...f, email: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('label_phone_wl')}</label>
                  <input
                    value={form.phone}
                    onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                    className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('label_source')}</label>
                <select
                  value={form.source}
                  onChange={e => setForm(f => ({ ...f, source: e.target.value }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 bg-white"
                >
                  <option value="">{t('select_source')}</option>
                  {SOURCES.map(s => <option key={s} value={s}>{t(`source_${s}`) !== `source_${s}` ? t(`source_${s}`) : s}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('label_referred_by')}</label>
                <input
                  value={form.referred_by}
                  onChange={e => setForm(f => ({ ...f, referred_by: e.target.value }))}
                  placeholder={t('referred_placeholder')}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('label_status_wl')}</label>
                <select
                  value={form.status}
                  onChange={e => setForm(f => ({ ...f, status: e.target.value as LeadStatus }))}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 bg-white"
                >
                  {STATUSES.map(s => <option key={s.key} value={s.key}>{t(s.labelKey)}</option>)}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-500 mb-1.5">{t('label_notes')}</label>
                <textarea
                  value={form.notes}
                  onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder={t('notes_placeholder')}
                  rows={3}
                  className="w-full border border-slate-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500/30 focus:border-brand-400 resize-none"
                />
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={closeForm}
                  className="flex-1 border border-slate-200 text-slate-600 text-sm font-semibold py-2.5 rounded-xl hover:bg-slate-50 transition-colors"
                >
                  {t('cancel')}
                </button>
                <button
                  type="submit"
                  disabled={saving || !form.name.trim()}
                  className="flex-1 flex items-center justify-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold py-2.5 rounded-xl transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  {saving ? (
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <><Check className="h-4 w-4" />{editingLead ? t('save_changes') : t('add_client_confirm')}</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
