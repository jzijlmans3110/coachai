import { useEffect, useState } from 'react'
import { TrendingUp, Users, UserPlus, Activity, Euro, Award, PieChart, Clock } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client, Invoice, CheckIn } from '../lib/types'

// ─── helpers ────────────────────────────────────────────────────────────────

const fmt = (cents: number) =>
  new Intl.NumberFormat('nl-NL', { style: 'currency', currency: 'EUR' }).format(cents / 100)

const MONTH_NAMES = ['Jan', 'Feb', 'Mrt', 'Apr', 'Mei', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dec']

function monthKey(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

// ─── derived data types ──────────────────────────────────────────────────────

interface MonthRevenue {
  key: string
  label: string
  total: number // cents
}

interface TopClient {
  client_id: string | null
  name: string
  total: number // cents
}

interface RetentionRow {
  client: Client
  daysSinceLastCheckIn: number | null
  totalCheckIns: number
  avgEnergy: number | null
}

// ─── component ───────────────────────────────────────────────────────────────

export default function Business() {
  const [clients, setClients] = useState<Client[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [checkIns, setCheckIns] = useState<CheckIn[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return

      const [{ data: clientsData }, { data: invoicesData }, { data: checkInsData }] = await Promise.all([
        supabase.from('clients').select('*').eq('coach_id', user.id),
        supabase.from('invoices').select('*').eq('coach_id', user.id).order('created_at', { ascending: false }),
        supabase
          .from('check_ins')
          .select('*, clients!inner(coach_id)')
          .eq('clients.coach_id', user.id)
          .order('submitted_at', { ascending: false }),
      ])

      setClients(clientsData ?? [])
      setInvoices(invoicesData ?? [])
      setCheckIns(checkInsData ?? [])
      setLoading(false)
    }
    load()
  }, [])

  // ── derived metrics ────────────────────────────────────────────────────────

  const now = new Date()
  const thisMonthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)

  const paidInvoices = invoices.filter(inv => inv.status === 'betaald')

  // MRR — paid invoices in current month
  const mrr = paidInvoices
    .filter(inv => {
      const d = new Date(inv.paid_at ?? inv.created_at)
      return d >= thisMonthStart
    })
    .reduce((sum, inv) => sum + inv.amount_cents, 0)

  // Active clients
  const activeClients = clients.filter(c => c.status === 'actief' || (c.status !== 'gestopt' && c.status !== null))

  // New clients this month
  const newClientsThisMonth = clients.filter(c => new Date(c.created_at) >= thisMonthStart).length

  // Gem. check-in rate (last 30 days / active clients)
  const checkInsLast30 = checkIns.filter(c => new Date(c.submitted_at) >= thirtyDaysAgo).length
  const avgCheckInRate = activeClients.length > 0
    ? (checkInsLast30 / activeClients.length).toFixed(1)
    : '0.0'

  // ── Revenue per month (last 6 months) ─────────────────────────────────────

  const last6MonthKeys: string[] = []
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    last6MonthKeys.push(monthKey(d))
  }

  const revenueByMonth: Record<string, number> = {}
  last6MonthKeys.forEach(k => { revenueByMonth[k] = 0 })
  paidInvoices.forEach(inv => {
    const k = monthKey(new Date(inv.paid_at ?? inv.created_at))
    if (k in revenueByMonth) revenueByMonth[k] += inv.amount_cents
  })

  const monthRevenues: MonthRevenue[] = last6MonthKeys.map(k => {
    const [year, month] = k.split('-').map(Number)
    return { key: k, label: MONTH_NAMES[month - 1], total: revenueByMonth[k] }
  })

  const maxMonthRevenue = Math.max(...monthRevenues.map(m => m.total), 1)

  // ── Top clients by revenue ─────────────────────────────────────────────────

  const revenueByClient: Record<string, number> = {}
  paidInvoices.forEach(inv => {
    const key = inv.client_id ?? '__none__'
    revenueByClient[key] = (revenueByClient[key] ?? 0) + inv.amount_cents
  })

  const topClients: TopClient[] = Object.entries(revenueByClient)
    .map(([client_id, total]) => {
      const c = clients.find(cl => cl.id === client_id)
      return { client_id, name: c?.full_name ?? 'Onbekend', total }
    })
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)

  const maxTopRevenue = Math.max(...topClients.map(t => t.total), 1)

  // ── Client status distribution ─────────────────────────────────────────────

  const statusGroups: { label: string; key: string; color: string; dotColor: string }[] = [
    { label: 'Actief',   key: 'actief',   color: 'bg-emerald-50 text-emerald-700', dotColor: 'bg-emerald-500' },
    { label: 'Intake',   key: 'intake',   color: 'bg-brand-50 text-brand-700',     dotColor: 'bg-brand-500' },
    { label: 'Inactief', key: 'inactief', color: 'bg-amber-50 text-amber-700',     dotColor: 'bg-amber-400' },
    { label: 'Gestopt',  key: 'gestopt',  color: 'bg-rose-50 text-rose-700',       dotColor: 'bg-rose-400' },
  ]

  const statusCounts: Record<string, number> = { actief: 0, intake: 0, inactief: 0, gestopt: 0 }
  clients.forEach(c => {
    const s = c.status ?? 'inactief'
    if (s in statusCounts) statusCounts[s]++
  })
  const totalClients = clients.length || 1

  // ── Retention table ────────────────────────────────────────────────────────

  const retentionRows: RetentionRow[] = clients
    .map(client => {
      const clientCheckIns = checkIns.filter(c => c.client_id === client.id)
      const sorted = [...clientCheckIns].sort(
        (a, b) => new Date(b.submitted_at).getTime() - new Date(a.submitted_at).getTime()
      )

      const daysSinceLastCheckIn =
        sorted.length > 0
          ? Math.floor((Date.now() - new Date(sorted[0].submitted_at).getTime()) / 86400000)
          : null

      const avgEnergy =
        sorted.length > 0
          ? sorted.reduce((s, c) => s + c.energy, 0) / sorted.length
          : null

      return { client, daysSinceLastCheckIn, totalCheckIns: sorted.length, avgEnergy }
    })
    .sort((a, b) => {
      // Null (never checked in) goes first, then longest ago
      if (a.daysSinceLastCheckIn === null && b.daysSinceLastCheckIn === null) return 0
      if (a.daysSinceLastCheckIn === null) return -1
      if (b.daysSinceLastCheckIn === null) return 1
      return b.daysSinceLastCheckIn - a.daysSinceLastCheckIn
    })

  // ── loading ────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  // ── render ─────────────────────────────────────────────────────────────────

  return (
    <div className="p-8 max-w-6xl">
      {/* Header */}
      <div className="mb-8">
        <p className="text-slate-400 text-sm font-medium mb-0.5">Overzicht</p>
        <h1 className="text-2xl font-bold text-slate-900">Business Dashboard</h1>
      </div>

      {/* ── Row 1: KPI cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-4 gap-4 mb-5">
        {[
          {
            label: 'MRR',
            value: fmt(mrr),
            icon: Euro,
            iconColor: 'text-emerald-600',
            iconBg: 'bg-emerald-50',
            valueColor: 'text-slate-900',
            sub: 'Omzet deze maand',
          },
          {
            label: 'Actieve clients',
            value: activeClients.length,
            icon: Users,
            iconColor: 'text-brand-600',
            iconBg: 'bg-brand-50',
            valueColor: 'text-slate-900',
            sub: `${clients.length} totaal`,
          },
          {
            label: 'Nieuwe clients',
            value: newClientsThisMonth,
            icon: UserPlus,
            iconColor: 'text-amber-600',
            iconBg: 'bg-amber-50',
            valueColor: 'text-slate-900',
            sub: 'Ingeschreven deze maand',
          },
          {
            label: 'Gem. check-in rate',
            value: `${avgCheckInRate}x`,
            icon: Activity,
            iconColor: 'text-rose-500',
            iconBg: 'bg-rose-50',
            valueColor: 'text-slate-900',
            sub: 'Per actieve client (30 dgn)',
          },
        ].map(({ label, value, icon: Icon, iconColor, iconBg, valueColor, sub }) => (
          <div key={label} className="bg-white rounded-2xl border border-slate-100 shadow-card p-5">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-semibold text-slate-400 uppercase tracking-wide">{label}</p>
              <div className={`${iconBg} rounded-xl p-2`}>
                <Icon className={`h-4 w-4 ${iconColor}`} />
              </div>
            </div>
            <p className={`text-3xl font-bold mb-0.5 ${valueColor}`}>{value}</p>
            <p className="text-xs text-slate-400">{sub}</p>
          </div>
        ))}
      </div>

      {/* ── Row 2: Revenue chart ─────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card p-5 mb-5">
        <div className="flex items-center gap-2 mb-5">
          <TrendingUp className="h-4 w-4 text-brand-600" />
          <h2 className="font-bold text-slate-900 text-sm">Omzet per maand</h2>
          <span className="ml-auto text-xs text-slate-400 font-medium">Laatste 6 maanden</span>
        </div>

        {paidInvoices.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-8">Nog geen betaalde facturen</p>
        ) : (
          <div className="space-y-3">
            {monthRevenues.map(m => (
              <div key={m.key} className="flex items-center gap-3">
                <span className="text-xs font-semibold text-slate-500 w-8 flex-shrink-0">{m.label}</span>
                <div className="flex-1 h-7 bg-slate-50 rounded-lg overflow-hidden">
                  <div
                    className="h-full bg-brand-500 rounded-lg transition-all duration-500 flex items-center px-2"
                    style={{ width: m.total === 0 ? '0%' : `${Math.max((m.total / maxMonthRevenue) * 100, 4)}%` }}
                  >
                    {m.total > 0 && (
                      <span className="text-white text-xs font-semibold whitespace-nowrap">
                        {fmt(m.total)}
                      </span>
                    )}
                  </div>
                </div>
                {m.total === 0 && (
                  <span className="text-xs text-slate-300 font-medium">€0</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Row 3: Top clients + Status distribution ─────────────────────── */}
      <div className="grid grid-cols-2 gap-5 mb-5">
        {/* Top clients by revenue */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-50">
            <Award className="h-4 w-4 text-gold-500" />
            <h2 className="font-bold text-slate-900 text-sm">Top clients op omzet</h2>
          </div>
          {topClients.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">Nog geen factuurdata</p>
          ) : (
            <div className="p-4 space-y-3">
              {topClients.map((tc, i) => (
                <div key={tc.client_id ?? i} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-slate-300 w-4 flex-shrink-0">{i + 1}</span>
                  <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                    {tc.name.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-semibold text-slate-800 truncate">{tc.name}</p>
                    <div className="mt-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gold-500 rounded-full"
                        style={{ width: `${(tc.total / maxTopRevenue) * 100}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-xs font-bold text-slate-700 flex-shrink-0">{fmt(tc.total)}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Client status distribution */}
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
          <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-50">
            <PieChart className="h-4 w-4 text-slate-500" />
            <h2 className="font-bold text-slate-900 text-sm">Client status verdeling</h2>
          </div>
          {clients.length === 0 ? (
            <p className="text-sm text-slate-400 text-center py-10">Nog geen clients</p>
          ) : (
            <div className="p-5 space-y-3">
              {statusGroups.map(sg => {
                const count = statusCounts[sg.key] ?? 0
                const pct = Math.round((count / totalClients) * 100)
                return (
                  <div key={sg.key} className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${sg.dotColor}`} />
                    <span className="text-sm font-medium text-slate-700 w-20">{sg.label}</span>
                    <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${sg.dotColor}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-slate-500 w-12 text-right">
                      {count} <span className="text-slate-300 font-normal">({pct}%)</span>
                    </span>
                  </div>
                )
              })}

              {/* Total */}
              <div className="pt-3 mt-3 border-t border-slate-50 flex items-center justify-between">
                <span className="text-xs text-slate-400 font-medium">Totaal</span>
                <span className="text-xs font-bold text-slate-700">{clients.length} clients</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Row 4: Retention table ───────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-slate-100 shadow-card">
        <div className="flex items-center gap-2 px-5 py-4 border-b border-slate-50">
          <Clock className="h-4 w-4 text-slate-500" />
          <h2 className="font-bold text-slate-900 text-sm">Retentie — Tijd sinds laatste check-in</h2>
          <span className="ml-auto text-xs text-slate-400 font-medium">Laagste activiteit bovenaan</span>
        </div>

        {clients.length === 0 ? (
          <p className="text-sm text-slate-400 text-center py-10">Nog geen clients</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Client</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Dagen geleden</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Totaal check-ins</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Gem. energie</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-slate-400 uppercase tracking-wide">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {retentionRows.map(row => {
                  const days = row.daysSinceLastCheckIn
                  const daysBadgeColor =
                    days === null ? 'bg-slate-100 text-slate-500' :
                    days > 21    ? 'bg-rose-50 text-rose-600' :
                    days > 10    ? 'bg-amber-50 text-amber-600' :
                                   'bg-emerald-50 text-emerald-600'

                  const energyColor =
                    row.avgEnergy === null           ? 'text-slate-300' :
                    row.avgEnergy >= 7               ? 'text-emerald-600' :
                    row.avgEnergy >= 5               ? 'text-amber-600' :
                                                       'text-rose-600'

                  const statusDot =
                    row.client.status === 'actief'   ? 'bg-emerald-500' :
                    row.client.status === 'intake'   ? 'bg-brand-500' :
                    row.client.status === 'inactief' ? 'bg-amber-400' :
                    row.client.status === 'gestopt'  ? 'bg-rose-400' :
                                                       'bg-slate-300'

                  return (
                    <tr key={row.client.id} className="hover:bg-slate-50/60 transition-colors">
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <div className="w-7 h-7 rounded-full bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                            {row.client.full_name.charAt(0).toUpperCase()}
                          </div>
                          <span className="font-semibold text-slate-800">{row.client.full_name}</span>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${daysBadgeColor}`}>
                          {days === null ? 'Nooit' : `${days}d`}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <span className="font-semibold text-slate-700">{row.totalCheckIns}</span>
                      </td>
                      <td className="px-5 py-3">
                        <span className={`font-semibold ${energyColor}`}>
                          {row.avgEnergy !== null ? `${row.avgEnergy.toFixed(1)}/10` : '—'}
                        </span>
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className={`w-2 h-2 rounded-full flex-shrink-0 ${statusDot}`} />
                          <span className="text-xs font-medium text-slate-600 capitalize">
                            {row.client.status ?? 'onbekend'}
                          </span>
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
    </div>
  )
}
