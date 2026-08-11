import { useEffect, useState } from 'react'
import { AlertCircle, Database, Users, Building2, GraduationCap, FileText, ClipboardList, MessageSquare } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { PlatformUsage } from '../lib/supabase'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { formatBytes } from '../lib/utils'

// Supabase Free tier reference ceilings, as published — not fetched live
// (no Management API token in this project, see repo notes). Purely a
// labeled reference point for "getting close to a plan limit," not a
// promise these numbers track Supabase's current pricing exactly.
const FREE_TIER_DB_BYTES = 500 * 1024 * 1024

export function UsagePage() {
  const [usage, setUsage] = useState<PlatformUsage | null>(null)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.rpc('get_platform_usage')
      if (error) setError(error.message)
      else setUsage(data as PlatformUsage)
      setLoading(false)
    })()
  }, [])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>
  )

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-bold text-ink mb-1">Usage & Limits</h1>
      <p className="text-sm text-ink-faint mb-8">Real, queryable Postgres metrics only. Storage, bandwidth, and function invocations are metered by Supabase's own billing system and aren't exposed here — check those in the Supabase dashboard.</p>

      {error && (
        <div className="stat-card mb-6 flex items-start gap-3 border-red-900">
          <AlertCircle className="w-4 h-4 text-red-400 mt-0.5 shrink-0" />
          <p className="text-sm text-red-400">Failed to load usage data: {error}</p>
        </div>
      )}

      {usage && (
        <>
          <div className="stat-card mb-6">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Database className="w-4 h-4 text-ink-faint" />
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Database size</p>
              </div>
              <p className="text-sm font-bold text-ink tabular-nums">{formatBytes(usage.db_size_bytes)} / {formatBytes(FREE_TIER_DB_BYTES)} (Free tier ref.)</p>
            </div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-2)' }}>
              <div
                className="h-full rounded-full"
                style={{
                  width: `${Math.min(100, (usage.db_size_bytes / FREE_TIER_DB_BYTES) * 100)}%`,
                  background: usage.db_size_bytes / FREE_TIER_DB_BYTES > 0.8 ? '#fca5a5' : 'var(--brand-primary)',
                }}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-4 mb-8">
            {[
              { label: 'Auth users', value: usage.auth_users_count, icon: Users },
              { label: 'Organizations', value: usage.organizations_count, icon: Building2 },
              { label: 'Teachers', value: usage.teachers_count, icon: GraduationCap },
              { label: 'Tests', value: usage.tests_count, icon: FileText },
              { label: 'Test attempts', value: usage.test_attempts_count, icon: ClipboardList },
              { label: 'Student answers', value: usage.student_answers_count, icon: MessageSquare },
            ].map(({ label, value, icon: Icon }) => (
              <div key={label} className="stat-card">
                <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
                <div className="flex items-center gap-2 mt-2">
                  <Icon className="w-4 h-4 text-ink-faint" />
                  <p className="text-2xl font-bold text-ink tabular-nums">{value.toLocaleString()}</p>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <div className="stat-card" style={{ borderStyle: 'dashed' }}>
        <p className="text-sm font-semibold text-ink-soft mb-1">Not available here</p>
        <p className="text-sm text-ink-faint">
          Storage bytes, bandwidth/egress, and Edge Function invocation counts are metered by Supabase's billing
          system, not queryable via SQL. This project has no Supabase Management API token configured — check the
          Supabase dashboard's Usage tab for those numbers.
        </p>
      </div>
    </div>
  )
}
