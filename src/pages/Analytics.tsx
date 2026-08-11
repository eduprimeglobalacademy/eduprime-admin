import { useEffect, useMemo, useState } from 'react'
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, PieChart, Pie, Cell } from 'recharts'
import { supabase } from '../lib/supabase'
import type { Organization, Plan } from '../lib/supabase'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'

const PIE_COLORS = ['#c6ff3d', '#93c5fd', '#fcd34d', '#fca5a5', '#b8bec7']

function weekKey(dateString: string): string {
  const d = new Date(dateString)
  const day = d.getUTCDay()
  const monday = new Date(d)
  monday.setUTCDate(d.getUTCDate() - ((day + 6) % 7))
  return monday.toISOString().slice(0, 10)
}

export function AnalyticsPage() {
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [teacherOrgIds, setTeacherOrgIds] = useState<string[]>([])
  const [testOrgIds, setTestOrgIds] = useState<string[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    (async () => {
      const [orgsRes, plansRes, teachersRes, testsRes] = await Promise.all([
        supabase.from('organizations').select('*').order('created_at'),
        supabase.from('plans').select('*').order('sort_order'),
        supabase.from('teachers').select('org_id'),
        supabase.from('tests').select('org_id'),
      ])
      setOrgs(orgsRes.data || [])
      setPlans(plansRes.data || [])
      setTeacherOrgIds((teachersRes.data || []).map(t => t.org_id))
      setTestOrgIds((testsRes.data || []).map(t => t.org_id))
      setLoading(false)
    })()
  }, [])

  const acquisition = useMemo(() => {
    const counts = new Map<string, number>()
    for (const org of orgs) counts.set(weekKey(org.created_at), (counts.get(weekKey(org.created_at)) || 0) + 1)
    return Array.from(counts.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([week, count]) => ({ week: week.slice(5), count }))
  }, [orgs])

  const activation = useMemo(() => {
    if (orgs.length === 0) return { pct: 0, activated: 0, total: 0 }
    const teacherSet = new Set(teacherOrgIds)
    const testSet = new Set(testOrgIds)
    const activated = orgs.filter(o => teacherSet.has(o.id) && testSet.has(o.id)).length
    return { pct: Math.round((activated / orgs.length) * 100), activated, total: orgs.length }
  }, [orgs, teacherOrgIds, testOrgIds])

  const conversion = useMemo(() => {
    const now = Date.now()
    const pastTrial = orgs.filter(o => o.trial_ends_at && new Date(o.trial_ends_at).getTime() < now)
    if (pastTrial.length === 0) return { pct: 0, converted: 0, total: 0 }
    const converted = pastTrial.filter(o => o.status === 'active').length
    return { pct: Math.round((converted / pastTrial.length) * 100), converted, total: pastTrial.length }
  }, [orgs])

  const retention = useMemo(() => {
    if (orgs.length === 0) return { pct: 0, cancelled: 0, total: 0 }
    const cancelled = orgs.filter(o => o.status === 'cancelled').length
    return { pct: Math.round(((orgs.length - cancelled) / orgs.length) * 100), cancelled, total: orgs.length }
  }, [orgs])

  const plansById = useMemo(() => new Map(plans.map(p => [p.id, p])), [plans])
  const mrr = useMemo(() => orgs.filter(o => o.status === 'active').reduce((sum, o) => sum + (plansById.get(o.plan_id)?.price_inr || 0), 0), [orgs, plansById])
  const revenueMix = useMemo(() => {
    const counts = new Map<string, number>()
    for (const o of orgs) {
      const name = plansById.get(o.plan_id)?.name || 'Unknown'
      counts.set(name, (counts.get(name) || 0) + 1)
    }
    return Array.from(counts.entries()).map(([name, value]) => ({ name, value }))
  }, [orgs, plansById])

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>
  )

  return (
    <div className="p-8">
      <h1 className="font-display text-2xl font-bold text-ink mb-1">Analytics</h1>
      <p className="text-sm text-ink-faint mb-8">Computed live from current organization, teacher, test, and subscription data. No historical snapshots exist yet — see notes on each metric.</p>

      <div className="stat-card mb-8">
        <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-4">Acquisition — signups by week ({orgUnit(orgs.length)})</p>
        {acquisition.length === 0 ? (
          <p className="text-sm text-ink-muted">No organizations yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={acquisition}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
              <XAxis dataKey="week" tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} axisLine={{ stroke: 'var(--border)' }} tickLine={false} />
              <YAxis allowDecimals={false} tick={{ fill: 'var(--ink-faint)', fontSize: 11 }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--ink)' }} />
              <Bar dataKey="count" fill="var(--brand-primary)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <MetricCard
          label="Activation"
          pct={activation.pct}
          note={`${activation.activated} of ${activation.total} orgs have ≥1 teacher and ≥1 test`}
        />
        <MetricCard
          label="Conversion (as of now)"
          pct={conversion.pct}
          note={conversion.total === 0
            ? 'No orgs past their trial yet'
            : `${conversion.converted} of ${conversion.total} past-trial orgs are active — a snapshot, not a trend (status changes aren't logged historically)`}
        />
        <MetricCard
          label="Retention"
          pct={retention.pct}
          note={`${retention.cancelled} of ${retention.total} orgs ever created have cancelled`}
        />
      </div>

      <div className="stat-card">
        <div className="flex items-center justify-between mb-4">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Revenue mix</p>
          <p className="text-sm font-bold text-ink tabular-nums">MRR ₹{mrr.toLocaleString('en-IN')}</p>
        </div>
        <div className="flex items-center gap-6 flex-wrap">
          <ResponsiveContainer width={180} height={180}>
            <PieChart>
              <Pie data={revenueMix} dataKey="value" nameKey="name" innerRadius={45} outerRadius={80} paddingAngle={2}>
                {revenueMix.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip contentStyle={{ background: 'var(--surface-2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12, color: 'var(--ink)' }} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5">
            {revenueMix.map(({ name, value }, i) => (
              <div key={name} className="flex items-center gap-2 text-sm">
                <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                <span className="text-ink-soft">{name}</span>
                <span className="text-ink-faint">·</span>
                <span className="font-semibold text-ink tabular-nums">{value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  )
}

function orgUnit(n: number): string {
  return `${n} org${n === 1 ? '' : 's'} total`
}

function MetricCard({ label, pct, note }: { label: string; pct: number; note: string }) {
  return (
    <div className="stat-card">
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
      <p className="text-3xl font-bold text-ink mt-2 tabular-nums">{pct}%</p>
      <p className="text-xs text-ink-faint mt-2">{note}</p>
    </div>
  )
}
