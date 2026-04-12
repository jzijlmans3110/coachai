import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Users } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Client } from '../lib/types'
import { useLanguage } from '../lib/LanguageContext'

// Keep Dutch day names for DB matching (stored as Dutch strings)
const DAYS_NL = ['Maandag', 'Dinsdag', 'Woensdag', 'Donderdag', 'Vrijdag', 'Zaterdag', 'Zondag']

export default function Calendar() {
  const { t } = useLanguage()
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [weekOffset, setWeekOffset] = useState(0)

  useEffect(() => {
    const load = async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) return
      const { data } = await supabase.from('clients').select('*').eq('coach_id', user.id).eq('status', 'actief').order('full_name')
      setClients(data ?? [])
      setLoading(false)
    }
    load()
  }, [])

  const getWeekDates = () => {
    const now = new Date()
    const day = now.getDay()
    const monday = new Date(now)
    monday.setDate(now.getDate() - (day === 0 ? 6 : day - 1) + weekOffset * 7)
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(monday)
      d.setDate(monday.getDate() + i)
      return d
    })
  }

  const weekDates = getWeekDates()
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const clientsForDay = (dayName: string) => {
    return clients.filter(c => {
      const td = (c.training_days ?? []) as string[]
      return td.map(d => d.toLowerCase()).includes(dayName.toLowerCase())
    })
  }

  const getAutoClients = (dayIndex: number) => {
    return clients.filter(c => {
      const td = (c.training_days ?? []) as string[]
      if (td.length > 0) return false
      const patterns: Record<number, number[]> = {
        1: [0], 2: [0, 3], 3: [0, 2, 4], 4: [0, 1, 3, 4], 5: [0, 1, 2, 3, 4],
        6: [0, 1, 2, 3, 4, 5], 7: [0, 1, 2, 3, 4, 5, 6],
      }
      const pattern = patterns[c.days_per_week] ?? patterns[3]
      return pattern.includes(dayIndex)
    })
  }

  const formatWeekRange = () => {
    const first = weekDates[0]
    const last = weekDates[6]
    return `${first.getDate()} ${first.toLocaleDateString('nl-NL', { month: 'short' })} – ${last.getDate()} ${last.toLocaleDateString('nl-NL', { month: 'short', year: 'numeric' })}`
  }

  const levelColor = (level: string) => ({
    beginner: 'bg-emerald-100 text-emerald-700',
    intermediate: 'bg-amber-100 text-amber-700',
    advanced: 'bg-rose-100 text-rose-700',
  }[level] ?? 'bg-slate-100 text-slate-600')

  if (loading) return (
    <div className="flex items-center justify-center h-screen">
      <div className="w-8 h-8 border-2 border-brand-600 border-t-transparent rounded-full animate-spin" />
    </div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">{t('calendar_title')}</h1>
          <p className="text-slate-400 text-sm mt-0.5">{t('calendar_desc')}</p>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1 bg-white border border-slate-200 rounded-xl p-1">
            <button onClick={() => setWeekOffset(w => w - 1)} className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
              <ChevronLeft className="h-4 w-4 text-slate-500" />
            </button>
            <button onClick={() => setWeekOffset(0)} className="px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50 rounded-lg transition-colors">
              {t('today_btn')}
            </button>
            <button onClick={() => setWeekOffset(w => w + 1)} className="p-1.5 hover:bg-slate-50 rounded-lg transition-colors">
              <ChevronRight className="h-4 w-4 text-slate-500" />
            </button>
          </div>
          <p className="text-sm font-semibold text-slate-700">{formatWeekRange()}</p>
        </div>
      </div>

      {clients.length === 0 ? (
        <div className="bg-white rounded-2xl border border-slate-100 shadow-card px-6 py-12 text-center">
          <Users className="h-10 w-10 text-slate-200 mx-auto mb-3" />
          <p className="text-slate-400 text-sm">{t('no_active_clients_cal')}</p>
        </div>
      ) : (
        <div className="grid grid-cols-7 gap-3">
          {weekDates.map((date, i) => {
            const dayName = DAYS_NL[i]
            const isToday = date.getTime() === today.getTime()
            const isPast = date.getTime() < today.getTime()
            const scheduled = clientsForDay(dayName)
            const auto = getAutoClients(i)
            const allClients = scheduled.length > 0 ? scheduled : auto

            return (
              <div key={i} className={`rounded-2xl border transition-all ${isToday ? 'border-brand-300 bg-brand-50/30 shadow-card' : isPast ? 'border-slate-100 bg-slate-50/50 opacity-70' : 'border-slate-100 bg-white shadow-sm'}`}>
                <div className={`px-3 py-3 text-center border-b ${isToday ? 'border-brand-200' : 'border-slate-100'}`}>
                  <p className={`text-xs font-semibold ${isToday ? 'text-brand-600' : 'text-slate-400'}`}>{t(`days_short_${i}`)}</p>
                  <p className={`text-lg font-bold mt-0.5 ${isToday ? 'text-brand-600' : isPast ? 'text-slate-400' : 'text-slate-900'}`}>{date.getDate()}</p>
                  {allClients.length > 0 && (
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full mt-1 inline-block ${isToday ? 'bg-brand-600 text-white' : 'bg-slate-100 text-slate-600'}`}>
                      {allClients.length}
                    </span>
                  )}
                </div>

                <div className="p-2 space-y-1.5 min-h-[120px]">
                  {allClients.map(client => (
                    <Link key={client.id} to={`/clients/${client.id}`}
                      className="block p-2 rounded-xl hover:bg-white/80 transition-colors">
                      <div className="flex items-center gap-1.5">
                        <div className="w-5 h-5 rounded-md bg-brand-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                          {client.full_name.charAt(0)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-slate-700 truncate">{client.full_name.split(' ')[0]}</p>
                          <span className={`text-xs px-1.5 rounded-full ${levelColor(client.level)}`}>{client.level.slice(0, 3)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {allClients.length === 0 && (
                    <div className="flex items-center justify-center h-16">
                      <p className="text-xs text-slate-200">—</p>
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}

      <div className="mt-5 bg-white border border-slate-100 rounded-2xl p-4 flex items-center gap-6">
        <p className="text-xs font-semibold text-slate-400">{t('legend_label')}</p>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-brand-600" />
          <span className="text-xs text-slate-600">{t('legend_today')}</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded bg-slate-200" />
          <span className="text-xs text-slate-600">{t('legend_past')}</span>
        </div>
        <p className="text-xs text-slate-400 ml-2">{t('legend_note')}</p>
      </div>
    </div>
  )
}
