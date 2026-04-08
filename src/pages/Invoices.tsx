import { useEffect, useState } from 'react'
import { Plus, CheckCircle2, Clock, AlertCircle, Trash2, Euro } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client } from '../lib/types'

interface Invoice {
  id: string
  coach_id: string
  client_id: string | null
  amount_cents: number
  description: string
  status: 'open' | 'betaald' | 'verlopen'
  due_date: string | null
  paid_at: string | null
  created_at: string
}

export default function Invoices() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [coachId, setCoachId] = useState('')

  const [form, setForm] = useState({
    client_id: '', description: '', amount: '', due_date: '',
  })

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      setCoachId(user.id)
      const [{ data: inv }, { data: cli }] = await Promise.all([
        supabase.from('invoices').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
        supabase.from('clients').select('id, full_name').eq('coach_id', user.id).order('full_name'),
      ])
      setInvoices(inv ?? [])
      setClients(cli ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const createInvoice = async () => {
    if (!form.description || !form.amount) return
    const { data } = await supabase.from('invoices').insert({
      coach_id: coachId,
      client_id: form.client_id || null,
      description: form.description,
      amount_cents: Math.round(parseFloat(form.amount) * 100),
      due_date: form.due_date || null,
      status: 'open',
    }).select().single()
    if (data) {
      setInvoices(prev => [data, ...prev])
      setForm({ client_id: '', description: '', amount: '', due_date: '' })
      setShowForm(false)
    }
  }

  const markPaid = async (id: string) => {
    await supabase.from('invoices').update({ status: 'betaald', paid_at: new Date().toISOString() }).eq('id', id)
    setInvoices(prev => prev.map(inv => inv.id === id ? { ...inv, status: 'betaald', paid_at: new Date().toISOString() } : inv))
  }

  const deleteInvoice = async (id: string) => {
    await supabase.from('invoices').delete().eq('id', id)
    setInvoices(prev => prev.filter(inv => inv.id !== id))
  }

  const statusBadge = (status: string) => ({
    open: { bg: 'bg-amber-50', text: 'text-amber-700', label: 'Open', icon: <Clock className="h-3 w-3" /> },
    betaald: { bg: 'bg-emerald-50', text: 'text-emerald-700', label: 'Betaald', icon: <CheckCircle2 className="h-3 w-3" /> },
    verlopen: { bg: 'bg-rose-50', text: 'text-rose-700', label: 'Verlopen', icon: <AlertCircle className="h-3 w-3" /> },
  }[status] ?? { bg: 'bg-slate-50', text: 'text-slate-600', label: status, icon: null })

  const fmt = (cents: number) => `€${(cents / 100).toFixed(2).replace('.', ',')}`

  const totalOpen = invoices.filter(i => i.status === 'open').reduce((s, i) => s + i.amount_cents, 0)
  const totalPaid = invoices.filter(i => i.status === 'betaald').reduce((s, i) => s + i.amount_cents, 0)

  const inputCls = "w-full text-sm border border-slate-200 rounded-xl px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-brand-500/20 focus:border-brand-400 transition-colors"

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8 max-w-4xl">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Facturen</h1>
          <p className="text-slate-400 text-sm mt-0.5">Beheer betalingen van je clients</p>
        </div>
        <button onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2.5 rounded-xl transition-colors">
          <Plus className="h-4 w-4" /> Factuur aanmaken
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: 'Openstaand', value: fmt(totalOpen), color: 'text-amber-600', bg: 'bg-amber-50', icon: <Clock className="h-4 w-4" /> },
          { label: 'Ontvangen', value: fmt(totalPaid), color: 'text-emerald-600', bg: 'bg-emerald-50', icon: <CheckCircle2 className="h-4 w-4" /> },
          { label: 'Totaal facturen', value: invoices.length.toString(), color: 'text-brand-600', bg: 'bg-brand-50', icon: <Euro className="h-4 w-4" /> },
        ].map(({ label, value, color, bg, icon }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
              <div className={`${bg} rounded-xl p-2 ${color}`}>{icon}</div>
            </div>
            <p className={`text-2xl font-bold ${color}`}>{value}</p>
          </div>
        ))}
      </div>

      {/* Form */}
      {showForm && (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-5">
          <h3 className="font-bold text-slate-900 text-sm mb-4">Nieuwe factuur</h3>
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Client</label>
              <select value={form.client_id} onChange={e => setForm(f => ({ ...f, client_id: e.target.value }))} className={inputCls}>
                <option value="">Geen client / losse factuur</option>
                {clients.map(c => <option key={c.id} value={c.id}>{c.full_name}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Bedrag (€)</label>
              <input type="number" step="0.01" placeholder="89.00" value={form.amount} onChange={e => setForm(f => ({ ...f, amount: e.target.value }))} className={inputCls} />
            </div>
            <div className="col-span-2">
              <label className="text-xs font-semibold text-slate-500 block mb-1">Omschrijving</label>
              <input type="text" placeholder="Bijv. Personal training 1 maand, Programma pakket..." value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} className={inputCls} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-500 block mb-1">Vervaldatum</label>
              <input type="date" value={form.due_date} onChange={e => setForm(f => ({ ...f, due_date: e.target.value }))} className={inputCls} />
            </div>
          </div>
          <div className="flex gap-2">
            <button onClick={createInvoice} className="bg-brand-600 hover:bg-brand-700 text-white text-sm font-semibold px-4 py-2 rounded-xl transition-colors">Aanmaken</button>
            <button onClick={() => setShowForm(false)} className="text-sm text-slate-500 hover:text-slate-700 px-4 py-2 rounded-xl transition-colors">Annuleren</button>
          </div>
        </div>
      )}

      {/* List */}
      {invoices.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-10 text-center">
          <Euro className="h-8 w-8 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">Nog geen facturen. Maak je eerste factuur aan.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-100">
                {['Client', 'Omschrijving', 'Bedrag', 'Vervaldatum', 'Status', ''].map(h => (
                  <th key={h} className="text-left text-xs font-semibold text-slate-400 px-4 py-3">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {invoices.map(inv => {
                const client = clients.find(c => c.id === inv.client_id)
                const badge = statusBadge(inv.status)
                const isOverdue = inv.status === 'open' && inv.due_date && new Date(inv.due_date) < new Date()
                return (
                  <tr key={inv.id} className="hover:bg-slate-50/50">
                    <td className="px-4 py-3 text-xs font-semibold text-slate-700">{client?.full_name ?? '—'}</td>
                    <td className="px-4 py-3 text-xs text-slate-600 max-w-[180px] truncate">{inv.description}</td>
                    <td className="px-4 py-3 text-sm font-bold text-slate-900">{fmt(inv.amount_cents)}</td>
                    <td className="px-4 py-3 text-xs text-slate-500">
                      {inv.due_date
                        ? <span className={isOverdue ? 'text-rose-600 font-semibold' : ''}>{new Date(inv.due_date).toLocaleDateString('nl-NL')}</span>
                        : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center gap-1 text-xs font-semibold px-2 py-0.5 rounded-full ${badge.bg} ${badge.text}`}>
                        {badge.icon}{badge.label}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {inv.status === 'open' && (
                          <button onClick={() => markPaid(inv.id)}
                            className="text-xs font-semibold text-emerald-600 hover:text-emerald-700 bg-emerald-50 hover:bg-emerald-100 px-2 py-1 rounded-lg transition-colors">
                            Markeer betaald
                          </button>
                        )}
                        <button onClick={() => deleteInvoice(inv.id)} className="text-slate-300 hover:text-rose-400 transition-colors">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
