import { useEffect, useState } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import type { Session } from '@supabase/supabase-js'
import { supabase } from './lib/supabase'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Clients from './pages/Clients'
import ClientDetail from './pages/ClientDetail'
import Settings from './pages/Settings'
import CheckIn from './pages/CheckIn'
import Pipeline from './pages/Pipeline'
import Calendar from './pages/Calendar'
import Templates from './pages/Templates'
import Invoices from './pages/Invoices'
import Challenges from './pages/Challenges'
import Business from './pages/Business'
import Intake from './pages/Intake'
import Portal from './pages/Portal'
import Layout from './components/Layout'

function ProtectedRoute({ session, children }: { session: Session | null; children: React.ReactNode }) {
  if (!session) return <Navigate to="/auth" replace />
  return <>{children}</>
}

export default function App() {
  const [session, setSession] = useState<Session | null | undefined>(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => setSession(session))
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session)
    })
    return () => subscription.unsubscribe()
  }, [])

  if (session === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-brand-600" />
      </div>
    )
  }

  return (
    <BrowserRouter>
      <Routes>
        {/* Public routes */}
        <Route path="/auth" element={session ? <Navigate to="/dashboard" replace /> : <Auth />} />
        <Route path="/checkin/:clientId" element={<CheckIn />} />
        <Route path="/intake/:token" element={<Intake />} />
        <Route path="/portal/:token" element={<Portal />} />

        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute session={session}>
              <Layout session={session!}>
                <Routes>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/clients" element={<Clients />} />
                  <Route path="/clients/:id" element={<ClientDetail />} />
                  <Route path="/pipeline" element={<Pipeline />} />
                  <Route path="/calendar" element={<Calendar />} />
                  <Route path="/templates" element={<Templates />} />
                  <Route path="/invoices" element={<Invoices />} />
                  <Route path="/challenges" element={<Challenges />} />
                  <Route path="/business" element={<Business />} />
                  <Route path="/settings" element={<Settings />} />
                  <Route path="*" element={<Navigate to="/dashboard" replace />} />
                </Routes>
              </Layout>
            </ProtectedRoute>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
