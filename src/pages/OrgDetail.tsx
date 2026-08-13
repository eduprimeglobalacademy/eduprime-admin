import { useEffect, useState } from 'react'
import { ArrowLeft, Ban, RotateCcw, Eye, Save, ExternalLink } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Organization, Plan, Subscription, OrgStatus, AdminUser, ImpersonationLogEntry, CapacityAddon, AddonKind } from '../lib/supabase'
import { orgUrl, ROOT_DOMAIN } from '../lib/auth'
import { Button } from '../components/ui/Button'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { BadgeTone } from '../components/ui/StatusBadge'
import { formatDateTime } from '../lib/utils'

const STATUS_TONE: Record<OrgStatus, BadgeTone> = {
  trial: 'info',
  active: 'success',
  past_due: 'warning',
  suspended: 'danger',
  cancelled: 'neutral',
}

const SLUG_PATTERN = /^[a-z0-9]([a-z0-9-]{0,30}[a-z0-9])?$/

const ADDON_LABEL: Record<AddonKind, string> = {
  extra_teachers: 'teacher seats',
  extra_active_tests: 'active test slots',
  extra_students: 'students per test',
}

interface OrgRow extends Organization {
  teacherCount: number
  testCount: number
}

interface Props {
  org: OrgRow
  plans: Plan[]
  subscription: Subscription | undefined
  adminUser: AdminUser | undefined
  onBack: () => void
  onRefetch: () => Promise<void>
  onPlanChange: (org: OrgRow, planId: string) => Promise<void>
  onDomainStatusToggle: (org: OrgRow) => Promise<void>
  onRequestStatusChange: (nextStatus: OrgStatus, label: string) => void
  onOpenImpersonate: (org: OrgRow) => void
  savingOrgId: string | null
}

function Card({ label, children, className = '' }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={`stat-card ${className}`}>
      <p className="text-xs font-semibold uppercase tracking-wide text-ink-faint mb-3">{label}</p>
      {children}
    </div>
  )
}

export function OrgDetailPage({
  org, plans, subscription, adminUser,
  onBack, onRefetch, onPlanChange, onDomainStatusToggle, onRequestStatusChange, onOpenImpersonate,
  savingOrgId,
}: Props) {
  const [general, setGeneral] = useState({ name: org.name, slug: org.slug })
  const [generalError, setGeneralError] = useState('')
  const [savingGeneral, setSavingGeneral] = useState(false)

  const [trialEndsAt, setTrialEndsAt] = useState(org.trial_ends_at ? org.trial_ends_at.slice(0, 10) : '')
  const [savingTrial, setSavingTrial] = useState(false)

  const [domain, setDomain] = useState(org.custom_domain || '')
  const [savingDomain, setSavingDomain] = useState(false)

  const [branding, setBranding] = useState({ primary: org.primary_color, secondary: org.secondary_color })
  const [logoUrl, setLogoUrl] = useState(org.logo_url || '')
  const [savingBranding, setSavingBranding] = useState(false)

  const [log, setLog] = useState<ImpersonationLogEntry[]>([])
  const [addons, setAddons] = useState<CapacityAddon[]>([])

  useEffect(() => {
    setGeneral({ name: org.name, slug: org.slug })
    setTrialEndsAt(org.trial_ends_at ? org.trial_ends_at.slice(0, 10) : '')
    setDomain(org.custom_domain || '')
    setBranding({ primary: org.primary_color, secondary: org.secondary_color })
    setLogoUrl(org.logo_url || '')
  }, [org.id, org.name, org.slug, org.trial_ends_at, org.custom_domain, org.primary_color, org.secondary_color, org.logo_url])

  useEffect(() => {
    supabase
      .from('impersonation_log')
      .select('*')
      .eq('org_id', org.id)
      .order('started_at', { ascending: false })
      .limit(10)
      .then(({ data }) => setLog(data || []))

    supabase
      .from('org_capacity_addons')
      .select('*')
      .eq('org_id', org.id)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .then(({ data }) => setAddons(data || []))
  }, [org.id])

  const plan = plans.find(p => p.id === org.plan_id)

  const saveGeneral = async () => {
    setGeneralError('')
    const name = general.name.trim()
    const slug = general.slug.trim().toLowerCase()
    if (!name) { setGeneralError('Name is required.'); return }
    if (!SLUG_PATTERN.test(slug)) { setGeneralError('Slug must be lowercase letters, numbers, and dashes only.'); return }
    setSavingGeneral(true)
    const { error } = await supabase.from('organizations').update({ name, slug }).eq('id', org.id)
    if (error) setGeneralError(error.code === '23505' ? 'That slug is already taken.' : error.message)
    else await onRefetch()
    setSavingGeneral(false)
  }

  const saveTrial = async () => {
    setSavingTrial(true)
    await supabase.from('organizations').update({ trial_ends_at: trialEndsAt || null }).eq('id', org.id)
    await onRefetch()
    setSavingTrial(false)
  }

  const saveDomain = async () => {
    setSavingDomain(true)
    await supabase.from('organizations').update({ custom_domain: domain.trim() || null }).eq('id', org.id)
    await onRefetch()
    setSavingDomain(false)
  }

  const saveBranding = async () => {
    setSavingBranding(true)
    await supabase.from('organizations').update({
      primary_color: branding.primary, secondary_color: branding.secondary, logo_url: logoUrl.trim() || null,
    }).eq('id', org.id)
    await onRefetch()
    setSavingBranding(false)
  }

  return (
    <div className="p-8">
      <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-ink-faint hover:text-ink mb-6 transition-colors">
        <ArrowLeft className="w-4 h-4" />
        Organizations
      </button>

      <div className="flex items-start justify-between mb-8 flex-wrap gap-4">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="font-display text-2xl font-bold text-ink">{org.name}</h1>
            <StatusBadge tone={STATUS_TONE[org.status]}>{org.status.replace('_', ' ')}</StatusBadge>
          </div>
          <a href={orgUrl(org.slug)} target="_blank" rel="noopener" className="text-sm font-mono text-ink-faint hover:text-ink inline-flex items-center gap-1">
            {org.slug}.{ROOT_DOMAIN}
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => onOpenImpersonate(org)}>
            <Eye className="w-4 h-4" />
            View as
          </Button>
          {org.status !== 'suspended' && org.status !== 'cancelled' && (
            <Button variant="outline" className="text-red-400 hover:!bg-red-950" onClick={() => onRequestStatusChange('suspended', 'Suspend')}>
              <Ban className="w-4 h-4" />
              Suspend
            </Button>
          )}
          {(org.status === 'suspended' || org.status === 'past_due' || org.status === 'cancelled') && (
            <Button variant="outline" onClick={() => onRequestStatusChange('active', 'Reactivate')}>
              <RotateCcw className="w-4 h-4" />
              Reactivate
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Card label="Teachers"><p className="text-2xl font-bold text-ink tabular-nums">{org.teacherCount}</p></Card>
        <Card label="Tests"><p className="text-2xl font-bold text-ink tabular-nums">{org.testCount}</p></Card>
        <Card label="Created"><p className="text-lg font-semibold text-ink">{formatDateTime(org.created_at)}</p></Card>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-4">
        <Card label="General">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Name</label>
              <input value={general.name} onChange={(e) => setGeneral({ ...general, name: e.target.value })} className="input-base" />
            </div>
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Slug</label>
              <input value={general.slug} onChange={(e) => setGeneral({ ...general, slug: e.target.value })} className="input-base font-mono" />
              <p className="text-xs text-ink-faint mt-1">Changing this changes the org's URL — existing links to the old subdomain stop working.</p>
            </div>
            {generalError && <p className="text-sm text-red-400">{generalError}</p>}
            <Button size="sm" onClick={saveGeneral} loading={savingGeneral}><Save className="w-3.5 h-3.5" />Save</Button>
          </div>
        </Card>

        <Card label="Plan & billing">
          <div className="space-y-3">
            <select
              value={org.plan_id}
              disabled={savingOrgId === org.id}
              onChange={(e) => onPlanChange(org, e.target.value)}
              className="input-base"
            >
              {plans.map((p) => <option key={p.id} value={p.id}>{p.is_public ? '' : '🔒 '}{p.name}{p.price_inr != null ? ` — ₹${p.price_inr.toLocaleString('en-IN')}/mo` : ''}</option>)}
            </select>
            {plan && (
              <div className="grid grid-cols-3 gap-2 text-center">
                {[
                  { label: 'Teachers', value: plan.max_teachers ?? '∞' },
                  { label: 'Active tests', value: plan.max_active_tests ?? '∞' },
                  { label: 'Students/test', value: org.student_billing_mode === 'metered' ? 'Metered' : (plan.max_students_per_test ?? '∞') },
                ].map(({ label, value }) => (
                  <div key={label} className="rounded-lg py-2" style={{ background: 'var(--surface-2)' }}>
                    <p className="text-sm font-bold text-ink tabular-nums">{value}</p>
                    <p className="text-[10px] text-ink-faint uppercase tracking-wide">{label}</p>
                  </div>
                ))}
              </div>
            )}
            {org.student_billing_mode === 'metered' && (
              <p className="text-xs text-ink-faint">This org is on flexible/metered student billing — no per-test student cap, billed per actual student each cycle.</p>
            )}
            {subscription ? (
              <div className="text-sm space-y-1 pt-1">
                <div className="flex justify-between"><span className="text-ink-faint">Subscription</span><span className="text-ink font-semibold">{subscription.status}</span></div>
                <div className="flex justify-between"><span className="text-ink-faint">Renews</span><span className="text-ink">{subscription.current_period_end ? formatDateTime(subscription.current_period_end) : '—'}</span></div>
              </div>
            ) : (
              <p className="text-xs text-ink-muted">No Razorpay subscription on file — trial, or never billed.</p>
            )}
          </div>
        </Card>

        <Card label="Add-on capacity">
          {addons.length === 0 ? (
            <p className="text-sm text-ink-muted">No add-ons purchased — self-serve from the org's own Billing page.</p>
          ) : (
            <div className="space-y-2">
              {addons.map((addon) => (
                <div key={addon.id} className="flex items-center justify-between text-sm">
                  <span className="text-ink-soft">
                    +{addon.quantity} {ADDON_LABEL[addon.kind]}
                  </span>
                  <span className="text-ink-faint text-xs">
                    ₹{addon.unit_price_inr * addon.quantity}
                    {addon.mode === 'recurring' ? '/mo'
                      : addon.mode === 'metered' ? '/unit, billed for actual usage each cycle'
                      : addon.expires_at ? ` until ${formatDateTime(addon.expires_at)}` : ' this cycle'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card label="Trial & access">
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Trial ends</label>
              <input type="date" value={trialEndsAt} onChange={(e) => setTrialEndsAt(e.target.value)} className="input-base" />
            </div>
            {org.grace_ends_at && (
              <p className="text-xs text-ink-faint">Payment grace period ends {formatDateTime(org.grace_ends_at)} — set automatically when a payment goes past-due.</p>
            )}
            <Button size="sm" onClick={saveTrial} loading={savingTrial}><Save className="w-3.5 h-3.5" />Save</Button>
          </div>
        </Card>

        <Card label="Custom domain">
          <div className="space-y-3">
            <input value={domain} onChange={(e) => setDomain(e.target.value)} placeholder="quiz.customer.edu" className="input-base font-mono" />
            <div className="flex items-center justify-between">
              <Button size="sm" onClick={saveDomain} loading={savingDomain}><Save className="w-3.5 h-3.5" />Save</Button>
              {org.custom_domain && (
                <button onClick={() => onDomainStatusToggle(org)} disabled={savingOrgId === org.id} title="Click to toggle">
                  <StatusBadge tone={org.custom_domain_status === 'active' ? 'success' : 'warning'} className="cursor-pointer">
                    {org.custom_domain_status === 'active' ? 'live' : 'pending'}
                  </StatusBadge>
                </button>
              )}
            </div>
            <p className="text-xs text-ink-faint">Vercel domain + customer's DNS still need to be set up by hand — this only reflects/communicates status.</p>
          </div>
        </Card>

        <Card label="Branding">
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              {logoUrl ? (
                <img src={logoUrl} alt="" className="w-10 h-10 rounded-lg object-contain border border-app shrink-0" style={{ background: 'var(--surface-2)' }} onError={(e) => { e.currentTarget.style.visibility = 'hidden' }} />
              ) : (
                <div className="w-10 h-10 rounded-lg border border-app shrink-0 flex items-center justify-center text-[10px] text-ink-faint" style={{ background: 'var(--surface-2)' }}>none</div>
              )}
              <input
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
                placeholder="https://…/logo.png"
                className="input-base font-mono text-xs flex-1"
              />
            </div>
            <p className="text-xs text-ink-faint -mt-1">No upload storage wired up yet — paste a hosted image URL. Blank falls back to the default EduPrime mark everywhere the app shows a logo.</p>
            {(['primary', 'secondary'] as const).map((key) => (
              <div key={key} className="flex items-center gap-3">
                <input
                  type="color"
                  value={branding[key]}
                  onChange={(e) => setBranding({ ...branding, [key]: e.target.value })}
                  className="w-10 h-10 rounded-lg border border-app cursor-pointer shrink-0"
                  style={{ background: 'var(--surface-2)' }}
                />
                <div>
                  <p className="text-xs font-semibold text-ink-soft capitalize">{key}</p>
                  <p className="text-xs font-mono text-ink-faint">{branding[key]}</p>
                </div>
              </div>
            ))}
            <Button size="sm" onClick={saveBranding} loading={savingBranding}><Save className="w-3.5 h-3.5" />Save</Button>
          </div>
        </Card>

        <Card label="Admin contact">
          {adminUser ? (
            <div>
              <p className="font-semibold text-ink text-sm">{adminUser.name}</p>
              <p className="text-xs text-ink-faint">{adminUser.email}</p>
            </div>
          ) : <p className="text-sm text-ink-muted">No admin account found for this org.</p>}
        </Card>
      </div>

      <Card label="Recent impersonation activity">
        {log.length === 0 ? (
          <p className="text-sm text-ink-muted">No impersonation activity for this org.</p>
        ) : (
          <div className="space-y-1.5">
            {log.map((entry) => (
              <div key={entry.id} className="text-sm flex justify-between border-b border-app py-1.5 last:border-0">
                <span className="text-ink-soft">{entry.target_email}</span>
                <span className="text-ink-faint text-xs">{formatDateTime(entry.started_at)}</span>
              </div>
            ))}
          </div>
        )}
      </Card>
    </div>
  )
}
