import { NavLink, useNavigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { LayoutDashboard, Users, Settings, LogOut, Zap, Kanban, Calendar, BookTemplate, Receipt, Trophy } from 'lucide-react'
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
  { to: '/challenges', icon: Trophy, label: 'Challenges' },
  { to: '/templates', icon: BookTemplate, label: 'Templates' },
  { to: '/invoices', icon: Receipt, label: 'Facturen' },
  { to: '/settings', icon: Settings, label: 'Instellingen' },
]

// Bottom nav shows only the 4 most important items on mobile
const bottomNavItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/clients', icon: Users, label: 'Clients' },
  { to: '/pipeline', icon: Kanban, label: 'Pipeline' },
  { to: '/calendar', icon: Calendar, label: 'Kalender' },
]

export default function Layout({ children }: LayoutProps) {
  const navigate = useNavigate()

  const handleSignOut = async () => {
    await supabase.auth.signOut()
    navigate('/auth')
  }

  return (
    <div className="flex min-h-screen bg-slate-50">
      {/* Sidebar — desktop only */}
      <aside className="w-60 bg-sidebar flex-col fixed inset-y-0 left-0 z-10 hidden md:flex">
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

      {/* Mobile top bar */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-10 bg-sidebar flex items-center justify-between px-4 h-14" style={{ paddingTop: 'env(safe-area-inset-top)' }}>
        <div className="flex items-center gap-2">
          <div className="bg-brand-600 rounded-lg p-1 flex items-center justify-center">
            <Zap className="h-3.5 w-3.5 text-white" fill="white" />
          </div>
          <span className="font-bold text-white text-sm tracking-wide">COACH<span className="text-brand-400">AI</span></span>
        </div>
        <NavLink to="/settings" className={({ isActive }) =>
          `p-2 rounded-lg transition-all ${isActive ? 'text-white' : 'text-slate-400'}`
        }>
          <Settings className="h-4.5 w-4.5" />
        </NavLink>
      </header>

      {/* Main content */}
      <main className="flex-1 md:ml-60 min-h-screen overflow-auto pb-20 md:pb-0 pt-14 md:pt-0">
        {children}
      </main>

      {/* Bottom nav — mobile only */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-sidebar border-t border-white/5 flex" style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}>
        {bottomNavItems.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-all ${
                isActive ? 'text-white' : 'text-slate-500'
              }`
            }
          >
            {({ isActive }) => (
              <>
                <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-white/10' : ''}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <span>{label}</span>
              </>
            )}
          </NavLink>
        ))}
        {/* More button that links to invoices/templates via settings */}
        <NavLink
          to="/invoices"
          className={({ isActive }) =>
            `flex-1 flex flex-col items-center gap-1 py-2.5 text-xs font-medium transition-all ${
              isActive ? 'text-white' : 'text-slate-500'
            }`
          }
        >
          {({ isActive }) => (
            <>
              <div className={`p-1.5 rounded-lg transition-all ${isActive ? 'bg-white/10' : ''}`}>
                <Receipt className="h-5 w-5" />
              </div>
              <span>Facturen</span>
            </>
          )}
        </NavLink>
      </nav>
    </div>
  )
}
