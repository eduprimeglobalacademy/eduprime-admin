import { useEffect, useState } from 'react'
import { Building2, LineChart, Gauge, History, Tag, Layers, LogOut, Shield } from 'lucide-react'
import { getCurrentPlatformAdmin, signOut } from './lib/auth'
import type { PlatformAdmin } from './lib/supabase'
import { SignIn } from './components/SignIn'
import { LoadingSpinner } from './components/ui/LoadingSpinner'
import { OrganizationsPage } from './pages/Organizations'
import { AnalyticsPage } from './pages/Analytics'
import { UsagePage } from './pages/Usage'
import { ActivityPage } from './pages/Activity'
import { PromotionsPage } from './pages/Promotions'
import { PlansPage } from './pages/Plans'

type Page = 'organizations' | 'plans' | 'analytics' | 'usage' | 'activity' | 'promotions'

const NAV: { id: Page; label: string; icon: typeof Building2 }[] = [
  { id: 'organizations', label: 'Organizations', icon: Building2 },
  { id: 'plans', label: 'Plans', icon: Layers },
  { id: 'analytics', label: 'Analytics', icon: LineChart },
  { id: 'usage', label: 'Usage & Limits', icon: Gauge },
  { id: 'activity', label: 'Activity', icon: History },
  { id: 'promotions', label: 'Promotions', icon: Tag },
]

function App() {
  const [admin, setAdmin] = useState<PlatformAdmin | null>(null)
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState<Page>('organizations')

  useEffect(() => {
    getCurrentPlatformAdmin().then((a) => {
      setAdmin(a)
      setLoading(false)
    })
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-app">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!admin) {
    return <SignIn onSignedIn={() => getCurrentPlatformAdmin().then(setAdmin)} />
  }

  const handleSignOut = async () => {
    await signOut()
    setAdmin(null)
  }

  return (
    <div className="min-h-screen bg-app flex">
      <aside className="w-60 shrink-0 border-r border-app flex flex-col" style={{ background: 'var(--surface)' }}>
        <div className="flex items-center gap-2.5 px-5 h-16 border-b border-app">
          <div className="p-1.5 rounded-lg" style={{ background: 'var(--brand-primary)' }}>
            <Shield className="w-4 h-4" style={{ color: 'var(--brand-on-primary)' }} />
          </div>
          <span className="font-display font-bold text-ink text-sm">Platform Console</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1">
          {NAV.map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setPage(id)}
              className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold transition-colors"
              style={page === id
                ? { background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }
                : { color: 'var(--ink-soft)' }}
            >
              <Icon className="w-4 h-4" />
              {label}
            </button>
          ))}
        </nav>

        <div className="px-3 py-4 border-t border-app">
          <p className="px-3 text-xs text-ink-faint truncate mb-2">{admin.email}</p>
          <button
            onClick={handleSignOut}
            className="w-full flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm font-semibold text-ink-soft hover:bg-surface-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Sign out
          </button>
        </div>
      </aside>

      <main className="flex-1 min-w-0">
        {page === 'organizations' && <OrganizationsPage />}
        {page === 'plans' && <PlansPage />}
        {page === 'analytics' && <AnalyticsPage />}
        {page === 'usage' && <UsagePage />}
        {page === 'activity' && <ActivityPage />}
        {page === 'promotions' && <PromotionsPage />}
      </main>
    </div>
  )
}

export default App
