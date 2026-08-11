import { useEffect, useMemo, useState } from 'react'
import { Eye } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { ImpersonationLogEntry, Organization } from '../lib/supabase'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { formatDateTime } from '../lib/utils'

export function ActivityPage() {
  const [entries, setEntries] = useState<ImpersonationLogEntry[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [logRes, orgsRes] = await Promise.all([
        supabase.from('impersonation_log').select('*').order('started_at', { ascending: false }).limit(100),
        supabase.from('organizations').select('*'),
      ])
      setEntries(logRes.data || [])
      setOrgs(orgsRes.data || [])
      setLoading(false)
    })()
  }, [])

  const orgById = useMemo(() => new Map(orgs.map(o => [o.id, o])), [orgs])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>
  )

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <h1 className="font-display text-2xl font-bold text-ink mb-1">Activity</h1>
      <p className="text-sm text-ink-faint mb-8">Most recent 100 impersonation ("view as") sessions, append-only and logged server-side — this list can't be edited or skipped by the admin who triggered it.</p>

      <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {entries.length === 0 ? (
          <p className="text-center text-sm py-12 text-ink-muted">No impersonation activity yet.</p>
        ) : (
          <div className="divide-y divide-[var(--border)]">
            {entries.map((entry) => (
              <div key={entry.id} className="px-5 py-3.5 flex items-center gap-3">
                <Eye className="w-4 h-4 text-ink-faint shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-ink">
                    Viewed <span className="font-semibold">{entry.target_email}</span>
                    {orgById.get(entry.org_id) && <> at <span className="font-semibold">{orgById.get(entry.org_id)!.name}</span></>}
                  </p>
                </div>
                <p className="text-xs text-ink-faint shrink-0">{formatDateTime(entry.started_at)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
