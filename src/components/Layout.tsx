import { NavLink, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { LayoutDashboard, Users, Settings, LogOut, Zap, Kanban, Calendar, BookTemplate, Receipt } from 'lucide-react'
import { supabase } from '../lib/supabase'

interface LayoutProps {
  session: Session
  children: React.ReactNode
}

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/calendar', icon: Calendar, label: 'Kalender' },
  { to: '/templates', icon: BookTemplate, label: 'Templates' },
  { to: '/invoices', icon: Receipt, label: 'Facturen' },
  { to: '/settings', icon: Settings, label: 'Instellingen' },
]

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar */}
      <aside className="w-60 bg-sidebar flex flex-col fixed inset-y-0 left-0 z-10">
        {/* Logo */}
        <div className="flex items-center gap-2.5 px-5 py-6">
          <div className="bg-brand-600 rounded-lg p-1.5 flex items-center justify-center">
            <Zap className="h-4 w-4 text-white" fill="white" />
          </div>
          <div>
            <span className="font-bold text-white text-sm tracking-wide">COACH</span>
            <span className="font-bold text-brand-400 text-sm tracking-wide">AI</span>
          </div>
        </div>

        <div className="mx-5 h-px bg-white/5 mb-4" />

        {/* Nav */}
        <nav className="flex-1 px-3 space-y-0.5">
          {navItems.map(({ to, icon: Icon, label }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:bg-white/5 hover:text-slate-200'
                }`
              }
            >
              <Icon className="h-4 w-4 flex-shrink-0" />
              {label}
            </NavLink>
          ))}
        </nav>

        {/* Bottom */}
        <div className="px-3 pb-5 pt-4">
          <div className="mx-2 h-px bg-white/5 mb-4" />
          <button
            onClick={handleSignOut}
            className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:bg-white/5 hover:text-slate-200 transition-all w-full"
          >
            <LogOut className="h-4 w-4" />
            Uitloggen
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 ml-60 min-h-screen overflow-auto">
        {children}
      </main>
    </div>
  )
}
