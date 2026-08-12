import { useEffect, useMemo, useState } from 'react'
import { Plus, Archive, Pencil, Tag } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Promotion, PromotionStatus, Organization } from '../lib/supabase'
import { getCurrentPlatformAdmin } from '../lib/auth'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { StatusBadge } from '../components/ui/StatusBadge'
import type { BadgeTone } from '../components/ui/StatusBadge'
import { formatDate } from '../lib/utils'

const STATUS_TONE: Record<PromotionStatus, BadgeTone> = {
  active: 'success',
  expired: 'neutral',
  archived: 'neutral',
}

const EMPTY_FORM = { code: '', description: '', discount_note: '', starts_at: '', ends_at: '', org_id: '', razorpay_offer_id: '' }

export function PromotionsPage() {
  const [promotions, setPromotions] = useState<Promotion[]>([])
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState<'all' | PromotionStatus>('all')
  const [editing, setEditing] = useState<Promotion | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const [{ data }, { data: orgsData }] = await Promise.all([
      supabase.from('promotions').select('*').order('created_at', { ascending: false }),
      supabase.from('organizations').select('*').order('name'),
    ])
    setPromotions(data || [])
    setOrgs(orgsData || [])
    setLoading(false)
  }

  const orgsById = useMemo(() => new Map(orgs.map(o => [o.id, o])), [orgs])

  const filtered = useMemo(
    () => statusFilter === 'all' ? promotions : promotions.filter(p => p.status === statusFilter),
    [promotions, statusFilter]
  )

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setError('')
    setShowForm(true)
  }

  const openEdit = (promo: Promotion) => {
    setEditing(promo)
    setForm({
      code: promo.code,
      description: promo.description || '',
      discount_note: promo.discount_note || '',
      starts_at: promo.starts_at ? promo.starts_at.slice(0, 10) : '',
      ends_at: promo.ends_at ? promo.ends_at.slice(0, 10) : '',
      org_id: promo.org_id || '',
      razorpay_offer_id: promo.razorpay_offer_id || '',
    })
    setError('')
    setShowForm(true)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setSaving(true)
    setError('')

    const payload = {
      code: form.code.trim(),
      description: form.description.trim() || null,
      discount_note: form.discount_note.trim() || null,
      starts_at: form.starts_at || null,
      ends_at: form.ends_at || null,
      org_id: form.org_id || null,
      razorpay_offer_id: form.razorpay_offer_id.trim() || null,
    }

    if (editing) {
      const { error } = await supabase.from('promotions').update(payload).eq('id', editing.id)
      if (error) { setError(error.message); setSaving(false); return }
    } else {
      const admin = await getCurrentPlatformAdmin()
      const { error } = await supabase.from('promotions').insert({ ...payload, created_by: admin?.id ?? null })
      if (error) { setError(error.message); setSaving(false); return }
    }

    setSaving(false)
    setShowForm(false)
    await fetchData()
  }

  const setStatus = async (promo: Promotion, status: PromotionStatus) => {
    await supabase.from('promotions').update({ status }).eq('id', promo.id)
    await fetchData()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Promotions</h1>
        <Button onClick={openCreate}><Plus className="w-4 h-4" />New promotion</Button>
      </div>
      <p className="text-sm text-ink-faint mb-8">Internal tracking list for the platform team's own record-keeping — not wired into Razorpay checkout yet.</p>

      <div className="flex gap-1.5 flex-wrap mb-4">
        {(['all', 'active', 'expired', 'archived'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors capitalize"
            style={statusFilter === s
              ? { background: 'var(--brand-primary)', color: 'var(--brand-on-primary)' }
              : { background: 'var(--surface)', color: 'var(--ink-soft)', border: '1px solid var(--border)' }}
          >
            {s === 'all' ? 'All' : s}
          </button>
        ))}
      </div>

      <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        {filtered.length === 0 ? (
          <p className="text-center text-sm py-12 text-ink-muted">No promotions match this filter.</p>
        ) : (
          <div className="overflow-x-auto scrollbar-thin">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs font-bold uppercase tracking-wide text-ink-faint" style={{ borderBottom: '1px solid var(--border)' }}>
                  <th className="px-5 py-3 font-bold">Code</th>
                  <th className="px-5 py-3 font-bold">Org</th>
                  <th className="px-5 py-3 font-bold">Discount</th>
                  <th className="px-5 py-3 font-bold">Status</th>
                  <th className="px-5 py-3 font-bold">Valid</th>
                  <th className="px-5 py-3 font-bold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((promo) => (
                  <tr key={promo.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-2">
                        <Tag className="w-3.5 h-3.5 text-ink-faint" />
                        <span className="font-mono font-semibold text-ink">{promo.code}</span>
                      </div>
                      {promo.description && <p className="text-xs text-ink-faint mt-0.5">{promo.description}</p>}
                    </td>
                    <td className="px-5 py-4 text-ink-soft text-xs">{promo.org_id ? orgsById.get(promo.org_id)?.name || 'Unknown org' : 'Any org'}</td>
                    <td className="px-5 py-4 text-ink-soft">{promo.discount_note || '—'}</td>
                    <td className="px-5 py-4"><StatusBadge tone={STATUS_TONE[promo.status]}>{promo.status}</StatusBadge></td>
                    <td className="px-5 py-4 text-xs text-ink-faint">
                      {promo.starts_at ? formatDate(promo.starts_at) : '—'} – {promo.ends_at ? formatDate(promo.ends_at) : '—'}
                    </td>
                    <td className="px-5 py-4">
                      <div className="flex gap-1.5">
                        <Button variant="outline" size="sm" onClick={() => openEdit(promo)}><Pencil className="w-3.5 h-3.5" /></Button>
                        {promo.status !== 'archived' && (
                          <Button variant="outline" size="sm" onClick={() => setStatus(promo, 'archived')}><Archive className="w-3.5 h-3.5" /></Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSubmit} className="rounded-2xl shadow-2xl w-full max-w-md animate-in p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-lg font-bold mb-4 text-ink">{editing ? 'Edit promotion' : 'New promotion'}</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Code</label>
                <input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} className="input-base" placeholder="LAUNCH25" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Description</label>
                <input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="input-base" placeholder="Founding cohort discount" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Discount note</label>
                <input value={form.discount_note} onChange={(e) => setForm({ ...form, discount_note: e.target.value })} className="input-base" placeholder="25% off first 3 months" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Organization</label>
                <select value={form.org_id} onChange={(e) => setForm({ ...form, org_id: e.target.value })} className="input-base">
                  <option value="">Any org (generic code)</option>
                  {orgs.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Razorpay offer id</label>
                <input value={form.razorpay_offer_id} onChange={(e) => setForm({ ...form, razorpay_offer_id: e.target.value })} className="input-base font-mono text-xs" placeholder="offer_xxxxx" />
                <p className="text-xs text-ink-faint mt-1">Create the offer on Razorpay's dashboard first (no create-offer API exists) — paste its id here so orgs can redeem it.</p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Starts</label>
                  <input type="date" value={form.starts_at} onChange={(e) => setForm({ ...form, starts_at: e.target.value })} className="input-base" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Ends</label>
                  <input type="date" value={form.ends_at} onChange={(e) => setForm({ ...form, ends_at: e.target.value })} className="input-base" />
                </div>
              </div>
            </div>

            {error && <p className="text-sm text-red-400 mt-3">{error}</p>}

            <div className="flex gap-3 mt-6">
              <Button type="button" variant="outline" onClick={() => setShowForm(false)} className="flex-1">Cancel</Button>
              <Button type="submit" loading={saving} className="flex-1">{editing ? 'Save' : 'Create'}</Button>
            </div>
          </form>
        </div>
      )}
    </div>
  )
}
