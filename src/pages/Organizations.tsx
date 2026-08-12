import { useEffect, useMemo, useState } from 'react'
import { Building2, TrendingUp, Users, AlertTriangle, Ban, RotateCcw, Eye, Search } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Organization, Plan, Subscription, OrgStatus, AdminUser } from '../lib/supabase'
import { impersonate } from '../lib/auth'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { BadgeTone } from '../components/ui/StatusBadge'
import { formatDateTime } from '../lib/utils'
import { OrgDetailPage } from './OrgDetail'

const STATUS_TONE: Record<OrgStatus, BadgeTone> = {
  trial: 'info',
  active: 'success',
  past_due: 'warning',
  suspended: 'danger',
  cancelled: 'neutral',
}

interface OrgRow extends Organization {
  teacherCount: number
  testCount: number
}

export function OrganizationsPage() {
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [plans, setPlans] = useState<Plan[]>([])
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([])
  const [adminUsers, setAdminUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | OrgStatus>('all')
  const [search, setSearch] = useState('')
  const [savingOrgId, setSavingOrgId] = useState<string | null>(null)
  const [confirmAction, setConfirmAction] = useState<{ org: OrgRow; nextStatus: OrgStatus; label: string } | null>(null)
  const [impersonateTarget, setImpersonateTarget] = useState<OrgRow | null>(null)
  const [impersonating, setImpersonating] = useState(false)
  const [impersonateError, setImpersonateError] = useState('')
  const [impersonateAsTeacherId, setImpersonateAsTeacherId] = useState('')
  const [orgTeachers, setOrgTeachers] = useState<{ id: string; name: string; email: string }[]>([])
  const [detailOrgId, setDetailOrgId] = useState<string | null>(null)
  const [planDowngradeConfirm, setPlanDowngradeConfirm] = useState<{ org: OrgRow; planId: string; planName: string; reasons: string[] } | null>(null)

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const [orgsRes, plansRes, subsRes, teachersRes, testsRes, adminsRes] = await Promise.all([
      supabase.from('organizations').select('*').order('created_at', { ascending: false }),
      supabase.from('plans').select('*').order('sort_order'),
      supabase.from('subscriptions').select('*').order('created_at', { ascending: false }),
      supabase.from('teachers').select('org_id'),
      supabase.from('tests').select('org_id'),
      supabase.from('admin_users').select('*'),
    ])

    const teacherCounts = new Map<string, number>()
    for (const t of teachersRes.data || []) teacherCounts.set(t.org_id, (teacherCounts.get(t.org_id) || 0) + 1)
    const testCounts = new Map<string, number>()
    for (const t of testsRes.data || []) testCounts.set(t.org_id, (testCounts.get(t.org_id) || 0) + 1)

    const rows: OrgRow[] = (orgsRes.data || []).map((org) => ({
      ...org,
      teacherCount: teacherCounts.get(org.id) || 0,
      testCount: testCounts.get(org.id) || 0,
    }))

    setOrgs(rows)
    setPlans(plansRes.data || [])
    setSubscriptions(subsRes.data || [])
    setAdminUsers(adminsRes.data || [])
    setLoading(false)
  }

  const plansById = useMemo(() => new Map(plans.map(p => [p.id, p])), [plans])
  const latestSubByOrg = useMemo(() => {
    const map = new Map<string, Subscription>()
    for (const sub of subscriptions) if (!map.has(sub.org_id)) map.set(sub.org_id, sub)
    return map
  }, [subscriptions])
  const adminByOrg = useMemo(() => {
    const map = new Map<string, AdminUser>()
    for (const a of adminUsers) if (!map.has(a.org_id)) map.set(a.org_id, a)
    return map
  }, [adminUsers])

  const stats = useMemo(() => {
    const mrr = orgs
      .filter(o => o.status === 'active')
      .reduce((sum, o) => sum + (plansById.get(o.plan_id)?.price_inr || 0), 0)
    return {
      total: orgs.length,
      active: orgs.filter(o => o.status === 'active').length,
      trial: orgs.filter(o => o.status === 'trial').length,
      atRisk: orgs.filter(o => o.status === 'past_due' || o.status === 'suspended').length,
      mrr,
    }
  }, [orgs, plansById])

  const planDistribution = useMemo(() => {
    const counts = new Map<string, number>()
    for (const o of orgs) {
      const name = plansById.get(o.plan_id)?.name || 'Unknown'
      counts.set(name, (counts.get(name) || 0) + 1)
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1])
  }, [orgs, plansById])

  const filteredOrgs = useMemo(() => {
    let rows = statusFilter === 'all' ? orgs : orgs.filter(o => o.status === statusFilter)
    const q = search.trim().toLowerCase()
    if (q) rows = rows.filter(o => o.name.toLowerCase().includes(q) || o.slug.toLowerCase().includes(q))
    return rows
  }, [orgs, statusFilter, search])

  const commitPlanChange = async (org: OrgRow, planId: string) => {
    setSavingOrgId(org.id)
    await supabase.from('organizations').update({ plan_id: planId }).eq('id', org.id)
    setPlanDowngradeConfirm(null)
    await fetchData()
    setSavingOrgId(null)
  }

  // Warn, don't block, before an org is moved onto a plan with lower limits
  // than its current usage — the INSERT-time RLS checks (org_within_teacher_limit
  // etc.) only stop *new* writes going forward, nothing retroactively flags
  // an org that's already over a plan it's about to be moved onto.
  const handlePlanChange = async (org: OrgRow, planId: string) => {
    const newPlan = plansById.get(planId)
    if (!newPlan) { await commitPlanChange(org, planId); return }

    const reasons: string[] = []
    if (newPlan.max_teachers != null && org.teacherCount > newPlan.max_teachers) {
      reasons.push(`${org.teacherCount} educators, new plan allows ${newPlan.max_teachers}`)
    }
    if (newPlan.max_active_tests != null) {
      const { data: activeCount } = await supabase.rpc('org_active_test_count', { p_org_id: org.id })
      if (typeof activeCount === 'number' && activeCount > newPlan.max_active_tests) {
        reasons.push(`${activeCount} active tests, new plan allows ${newPlan.max_active_tests}`)
      }
    }

    if (reasons.length > 0) {
      setPlanDowngradeConfirm({ org, planId, planName: newPlan.name, reasons })
      return
    }
    await commitPlanChange(org, planId)
  }

  const handleDomainStatusToggle = async (org: OrgRow) => {
    setSavingOrgId(org.id)
    const next = org.custom_domain_status === 'active' ? 'pending' : 'active'
    await supabase.from('organizations').update({ custom_domain_status: next }).eq('id', org.id)
    await fetchData()
    setSavingOrgId(null)
  }

  const handleStatusChange = async () => {
    if (!confirmAction) return
    setSavingOrgId(confirmAction.org.id)
    await supabase.from('organizations').update({
      status: confirmAction.nextStatus,
      ...(confirmAction.nextStatus === 'active' ? { grace_ends_at: null } : {}),
    }).eq('id', confirmAction.org.id)
    setConfirmAction(null)
    await fetchData()
    setSavingOrgId(null)
  }

  const openImpersonate = async (org: OrgRow) => {
    setImpersonateTarget(org)
    setImpersonateAsTeacherId('')
    const { data } = await supabase.from('teachers').select('id, name, email').eq('org_id', org.id).order('name')
    setOrgTeachers(data || [])
  }

  const handleImpersonate = async () => {
    if (!impersonateTarget) return
    setImpersonating(true)
    setImpersonateError('')
    try {
      await impersonate(impersonateTarget.slug, impersonateTarget.id, impersonateAsTeacherId || undefined)
      setImpersonateTarget(null)
    } catch (err) {
      setImpersonateError(err instanceof Error ? err.message : 'Failed to start impersonation.')
    } finally {
      setImpersonating(false)
    }
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center">
      <LoadingSpinner size="lg" />
    </div>
  )

  const detailOrg = detailOrgId ? orgs.find(o => o.id === detailOrgId) : null
  if (detailOrg) {
    return (
      <>
        <OrgDetailPage
          org={detailOrg}
          plans={plans}
          subscription={latestSubByOrg.get(detailOrg.id)}
          adminUser={adminByOrg.get(detailOrg.id)}
          onBack={() => setDetailOrgId(null)}
          onRefetch={fetchData}
          onPlanChange={handlePlanChange}
          onDomainStatusToggle={handleDomainStatusToggle}
          onRequestStatusChange={(nextStatus, label) => setConfirmAction({ org: detailOrg, nextStatus, label })}
          onOpenImpersonate={openImpersonate}
          savingOrgId={savingOrgId}
        />
        {confirmAction && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="rounded-2xl shadow-2xl w-full max-w-md animate-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-2 text-ink">{confirmAction.label} {confirmAction.org.name}?</h3>
                <p className="text-sm mb-6 text-ink-faint">
                  {confirmAction.nextStatus === 'suspended'
                    ? 'This pauses new assessments and new educator tokens for this org. Existing tests, results, and students in progress are unaffected.'
                    : 'This restores full access immediately, bypassing any pending payment.'}
                </p>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setConfirmAction(null)} className="flex-1">Cancel</Button>
                  <Button
                    variant={confirmAction.nextStatus === 'suspended' ? 'danger' : 'primary'}
                    onClick={handleStatusChange}
                    loading={savingOrgId === confirmAction.org.id}
                    className="flex-1"
                  >
                    {confirmAction.label}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
        {impersonateTarget && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
            <div className="rounded-2xl shadow-2xl w-full max-w-md animate-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="p-6">
                <h3 className="text-lg font-bold mb-2 text-ink">View as — {impersonateTarget.name}</h3>
                <p className="text-sm mb-4 text-ink-faint">
                  This opens a new tab signed in as the selected account, without their password. It's logged — org id, account email, and timestamp. Exit from the amber banner in that tab at any point.
                </p>

                <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Account</label>
                <select
                  value={impersonateAsTeacherId}
                  onChange={(e) => setImpersonateAsTeacherId(e.target.value)}
                  className="input-base mb-4"
                >
                  <option value="">Org Admin</option>
                  {orgTeachers.map((t) => (
                    <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                  ))}
                </select>
                {orgTeachers.length === 0 && (
                  <p className="text-xs -mt-3 mb-4 text-ink-muted">No educators in this org yet — only the admin account is available.</p>
                )}

                {impersonateError && <p className="text-sm text-red-400 mb-4">{impersonateError}</p>}
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => { setImpersonateTarget(null); setImpersonateError('') }} className="flex-1">Cancel</Button>
                  <Button onClick={handleImpersonate} loading={impersonating} className="flex-1">View as</Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Organizations</h1>
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-ink-faint" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or slug…"
            className="input-base pl-9 w-64"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        {[
          { label: 'Organizations', value: stats.total, icon: Building2 },
          { label: 'Active', value: stats.active, icon: TrendingUp },
          { label: 'On trial', value: stats.trial, icon: Users },
          { label: 'Needs attention', value: stats.atRisk, icon: AlertTriangle },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="stat-card">
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">{label}</p>
            <div className="flex items-center gap-2 mt-2">
              <Icon className="w-4 h-4 text-ink-faint" />
              <p className="text-2xl font-bold text-ink tabular-nums">{value}</p>
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <div className="stat-card flex items-center justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint">Monthly recurring revenue</p>
            <p className="text-3xl font-bold text-ink mt-1 tabular-nums">₹{stats.mrr.toLocaleString('en-IN')}</p>
          </div>
          <p className="text-xs max-w-[10rem] text-right text-ink-faint">Sum of active orgs' plan price. Trial orgs excluded.</p>
        </div>
        <div className="stat-card">
          <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-3">Plan distribution</p>
          <div className="space-y-1.5">
            {planDistribution.map(([name, count]) => (
              <div key={name} className="flex items-center justify-between text-sm">
                <span className="text-ink-soft">{name}</span>
                <span className="font-semibold text-ink tabular-nums">{count}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 flex-wrap gap-3">
        <div className="flex gap-1.5 flex-wrap">
          {(['all', 'trial', 'active', 'past_due', 'suspended', 'cancelled'] as const).map((s) => (
            <button
              key={s}
              onClick={() => setStatusFilter(s)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize"
              style={statusFilter === s
                ? { background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }
                : { background: 'var(--surface)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}
            >
              {s === 'all' ? 'All' : s.replace('_', ' ')}
            </button>
          ))}
        </div>
      </div>

      <div className="rounded-2xl shadow-sm overflow-hidden border-app" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-ink-faint" style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="px-5 py-3 font-bold">Organization</th>
                <th className="px-5 py-3 font-bold">Status</th>
                <th className="px-5 py-3 font-bold">Plan</th>
                <th className="px-5 py-3 font-bold">Domain</th>
                <th className="px-5 py-3 font-bold">Teachers</th>
                <th className="px-5 py-3 font-bold">Tests</th>
                <th className="px-5 py-3 font-bold">Next renewal</th>
                <th className="px-5 py-3 font-bold">Created</th>
                <th className="px-5 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrgs.map((org) => {
                const sub = latestSubByOrg.get(org.id)
                return (
                  <tr
                    key={org.id}
                    className="transition-colors cursor-pointer hover:bg-surface-2"
                    style={{ borderBottom: '1px solid var(--border)' }}
                    onClick={() => setDetailOrgId(org.id)}
                  >
                    <td className="px-5 py-4">
                      <p className="font-semibold text-ink">{org.name}</p>
                      <p className="text-xs font-mono text-ink-faint">{org.slug}</p>
                    </td>
                    <td className="px-5 py-4">
                      <StatusBadge tone={STATUS_TONE[org.status]}>{org.status.replace('_', ' ')}</StatusBadge>
                    </td>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <select
                        value={org.plan_id}
                        disabled={savingOrgId === org.id}
                        onChange={(e) => handlePlanChange(org, e.target.value)}
                        className="text-xs rounded-lg px-2 py-1.5"
                        style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--ink)' }}
                      >
                        {plans.map((p) => <option key={p.id} value={p.id}>{p.is_public ? '' : '🔒 '}{p.name}</option>)}
                      </select>
                    </td>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      {org.custom_domain ? (
                        <div className="flex items-center gap-2">
                          <span className="text-xs font-mono text-ink-soft">{org.custom_domain}</span>
                          <button disabled={savingOrgId === org.id} onClick={() => handleDomainStatusToggle(org)} title="Click to toggle">
                            <StatusBadge tone={org.custom_domain_status === 'active' ? 'success' : 'warning'} className="cursor-pointer">
                              {org.custom_domain_status === 'active' ? 'live' : 'pending'}
                            </StatusBadge>
                          </button>
                        </div>
                      ) : <span className="text-xs text-ink-muted">—</span>}
                    </td>
                    <td className="px-5 py-4 text-ink-soft">{org.teacherCount}</td>
                    <td className="px-5 py-4 text-ink-soft">{org.testCount}</td>
                    <td className="px-5 py-4 text-xs text-ink-faint">{sub?.current_period_end ? formatDateTime(sub.current_period_end) : '—'}</td>
                    <td className="px-5 py-4 text-xs text-ink-faint">{formatDateTime(org.created_at)}</td>
                    <td className="px-5 py-4" onClick={(e) => e.stopPropagation()}>
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => openImpersonate(org)} title="View as this org's admin or an educator">
                          <Eye className="w-3.5 h-3.5" />
                        </Button>
                        {org.status !== 'suspended' && org.status !== 'cancelled' && (
                          <Button
                            variant="outline" size="sm"
                            onClick={() => setConfirmAction({ org, nextStatus: 'suspended', label: 'Suspend' })}
                            className="text-red-400 hover:!bg-red-950"
                          >
                            <Ban className="w-3.5 h-3.5" />
                          </Button>
                        )}
                        {(org.status === 'suspended' || org.status === 'past_due' || org.status === 'cancelled') && (
                          <Button variant="outline" size="sm" onClick={() => setConfirmAction({ org, nextStatus: 'active', label: 'Reactivate' })}>
                            <RotateCcw className="w-3.5 h-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {filteredOrgs.length === 0 && (
          <p className="text-center text-sm py-12 text-ink-muted">No organizations match this filter.</p>
        )}
      </div>

      {confirmAction && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl shadow-2xl w-full max-w-md animate-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2 text-ink">{confirmAction.label} {confirmAction.org.name}?</h3>
              <p className="text-sm mb-6 text-ink-faint">
                {confirmAction.nextStatus === 'suspended'
                  ? 'This pauses new assessments and new educator tokens for this org. Existing tests, results, and students in progress are unaffected.'
                  : 'This restores full access immediately, bypassing any pending payment.'}
              </p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setConfirmAction(null)} className="flex-1">Cancel</Button>
                <Button
                  variant={confirmAction.nextStatus === 'suspended' ? 'danger' : 'primary'}
                  onClick={handleStatusChange}
                  loading={savingOrgId === confirmAction.org.id}
                  className="flex-1"
                >
                  {confirmAction.label}
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {planDowngradeConfirm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl shadow-2xl w-full max-w-md animate-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2 text-ink">Move {planDowngradeConfirm.org.name} to {planDowngradeConfirm.planName}?</h3>
              <p className="text-sm mb-3 text-ink-faint">This org is already over the new plan's limits:</p>
              <ul className="text-sm mb-6 space-y-1 list-disc list-inside text-ink-soft">
                {planDowngradeConfirm.reasons.map((r) => <li key={r}>{r}</li>)}
              </ul>
              <p className="text-xs mb-6 text-ink-faint">Nothing existing is affected — they just won't be able to add more until they're back under the limit.</p>
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setPlanDowngradeConfirm(null)} className="flex-1">Cancel</Button>
                <Button
                  onClick={() => commitPlanChange(planDowngradeConfirm.org, planDowngradeConfirm.planId)}
                  loading={savingOrgId === planDowngradeConfirm.org.id}
                  className="flex-1"
                >
                  Move anyway
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {impersonateTarget && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="rounded-2xl shadow-2xl w-full max-w-md animate-in" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <div className="p-6">
              <h3 className="text-lg font-bold mb-2 text-ink">View as — {impersonateTarget.name}</h3>
              <p className="text-sm mb-4 text-ink-faint">
                This opens a new tab signed in as the selected account, without their password. It's logged — org id, account email, and timestamp. Exit from the amber banner in that tab at any point.
              </p>

              <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Account</label>
              <select
                value={impersonateAsTeacherId}
                onChange={(e) => setImpersonateAsTeacherId(e.target.value)}
                className="input-base mb-4"
              >
                <option value="">Org Admin</option>
                {orgTeachers.map((t) => (
                  <option key={t.id} value={t.id}>{t.name} ({t.email})</option>
                ))}
              </select>
              {orgTeachers.length === 0 && (
                <p className="text-xs -mt-3 mb-4 text-ink-muted">No educators in this org yet — only the admin account is available.</p>
              )}

              {impersonateError && <p className="text-sm text-red-400 mb-4">{impersonateError}</p>}
              <div className="flex gap-3">
                <Button variant="outline" onClick={() => { setImpersonateTarget(null); setImpersonateError('') }} className="flex-1">Cancel</Button>
                <Button onClick={handleImpersonate} loading={impersonating} className="flex-1">View as</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
