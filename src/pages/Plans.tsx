import { useEffect, useMemo, useState } from 'react'
import { Plus, Pencil, Lock, Layers } from 'lucide-react'
import { supabase } from '../lib/supabase'
import type { Plan } from '../lib/supabase'
import { Button } from '../components/ui/Button'
import { LoadingSpinner } from '../components/ui/LoadingSpinner'
import { StatusBadge } from '../components/ui/StatusBadge'

const slugify = (s: string) =>
  s.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)

interface PlanForm {
  id: string
  name: string
  max_teachers: string
  max_active_tests: string
  max_students_per_test: string
  price_inr: string
  razorpay_plan_id: string
  is_public: boolean
  addon_teacher_price_inr: string
  addon_test_price_inr: string
}

const EMPTY_FORM: PlanForm = {
  id: '', name: '', max_teachers: '', max_active_tests: '', max_students_per_test: '',
  price_inr: '', razorpay_plan_id: '', is_public: false,
  addon_teacher_price_inr: '', addon_test_price_inr: '',
}

const toNumOrNull = (s: string) => (s.trim() === '' ? null : Number(s))

export function PlansPage() {
  const [plans, setPlans] = useState<Plan[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Plan | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState<PlanForm>(EMPTY_FORM)
  const [idTouched, setIdTouched] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => { fetchData() }, [])

  const fetchData = async () => {
    setLoading(true)
    const { data } = await supabase.from('plans').select('*').order('sort_order')
    setPlans(data || [])
    setLoading(false)
  }

  const existingIds = useMemo(() => new Set(plans.map(p => p.id)), [plans])

  const openCreate = () => {
    setEditing(null)
    setForm(EMPTY_FORM)
    setIdTouched(false)
    setError('')
    setShowForm(true)
  }

  const openEdit = (plan: Plan) => {
    setEditing(plan)
    setForm({
      id: plan.id,
      name: plan.name,
      max_teachers: plan.max_teachers?.toString() ?? '',
      max_active_tests: plan.max_active_tests?.toString() ?? '',
      max_students_per_test: plan.max_students_per_test?.toString() ?? '',
      price_inr: plan.price_inr?.toString() ?? '',
      razorpay_plan_id: plan.razorpay_plan_id ?? '',
      is_public: plan.is_public,
      addon_teacher_price_inr: plan.addon_teacher_price_inr?.toString() ?? '',
      addon_test_price_inr: plan.addon_test_price_inr?.toString() ?? '',
    })
    setIdTouched(true)
    setError('')
    setShowForm(true)
  }

  const handleNameChange = (name: string) => {
    setForm(f => ({ ...f, name, id: idTouched ? f.id : slugify(name) }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    const id = form.id.trim()
    const name = form.name.trim()
    if (!id || !name) { setError('Name and id are required.'); return }
    if (!editing && existingIds.has(id)) { setError('A plan with that id already exists.'); return }

    const payload = {
      id, name,
      max_teachers: toNumOrNull(form.max_teachers),
      max_active_tests: toNumOrNull(form.max_active_tests),
      max_students_per_test: toNumOrNull(form.max_students_per_test),
      price_inr: toNumOrNull(form.price_inr),
      razorpay_plan_id: form.razorpay_plan_id.trim() || null,
      is_public: form.is_public,
      addon_teacher_price_inr: toNumOrNull(form.addon_teacher_price_inr),
      addon_test_price_inr: toNumOrNull(form.addon_test_price_inr),
    }

    setSaving(true)
    const { error } = editing
      ? await supabase.from('plans').update(payload).eq('id', editing.id)
      : await supabase.from('plans').insert({ ...payload, sort_order: plans.length + 1 })
    setSaving(false)
    if (error) { setError(error.message); return }

    setShowForm(false)
    await fetchData()
  }

  if (loading) return (
    <div className="min-h-screen flex items-center justify-center"><LoadingSpinner size="lg" /></div>
  )

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-1 flex-wrap gap-3">
        <h1 className="font-display text-2xl font-bold text-ink">Plans</h1>
        <Button onClick={openCreate}><Plus className="w-4 h-4" />New plan</Button>
      </div>
      <p className="text-sm text-ink-faint mb-8">Canned tiers and negotiated/custom deals — a plan created here defaults to private (🔒) since the three self-serve tiers already exist.</p>

      <div className="rounded-2xl shadow-sm overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <div className="overflow-x-auto scrollbar-thin">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs font-bold uppercase tracking-wide text-ink-faint" style={{ borderBottom: '1px solid var(--border)' }}>
                <th className="px-5 py-3 font-bold">Plan</th>
                <th className="px-5 py-3 font-bold">Price</th>
                <th className="px-5 py-3 font-bold">Teachers</th>
                <th className="px-5 py-3 font-bold">Active tests</th>
                <th className="px-5 py-3 font-bold">Students/test</th>
                <th className="px-5 py-3 font-bold">Add-on price</th>
                <th className="px-5 py-3 font-bold">Razorpay plan</th>
                <th className="px-5 py-3 font-bold">Actions</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((plan) => (
                <tr key={plan.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <Layers className="w-3.5 h-3.5 text-ink-faint" />
                      <span className="font-semibold text-ink">{plan.name}</span>
                      {!plan.is_public && <StatusBadge tone="neutral"><Lock className="w-3 h-3" />private</StatusBadge>}
                    </div>
                    <p className="text-xs font-mono text-ink-faint mt-0.5">{plan.id}</p>
                  </td>
                  <td className="px-5 py-4 text-ink-soft tabular-nums">{plan.price_inr != null ? `₹${plan.price_inr.toLocaleString('en-IN')}/mo` : 'Custom'}</td>
                  <td className="px-5 py-4 text-ink-soft tabular-nums">{plan.max_teachers ?? '∞'}</td>
                  <td className="px-5 py-4 text-ink-soft tabular-nums">{plan.max_active_tests ?? '∞'}</td>
                  <td className="px-5 py-4 text-ink-soft tabular-nums">{plan.max_students_per_test ?? '∞'}</td>
                  <td className="px-5 py-4 text-ink-soft text-xs">
                    {plan.addon_teacher_price_inr != null && <div>₹{plan.addon_teacher_price_inr}/teacher</div>}
                    {plan.addon_test_price_inr != null && <div>₹{plan.addon_test_price_inr}/test</div>}
                    {plan.addon_teacher_price_inr == null && plan.addon_test_price_inr == null && '—'}
                  </td>
                  <td className="px-5 py-4 text-xs font-mono text-ink-faint">{plan.razorpay_plan_id || 'not set'}</td>
                  <td className="px-5 py-4">
                    <Button variant="outline" size="sm" onClick={() => openEdit(plan)}><Pencil className="w-3.5 h-3.5" /></Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <form onSubmit={handleSubmit} className="rounded-2xl shadow-2xl w-full max-w-md animate-in p-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <h3 className="text-lg font-bold mb-4 text-ink">{editing ? 'Edit plan' : 'New plan'}</h3>

            <div className="space-y-3">
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Name</label>
                <input required value={form.name} onChange={(e) => handleNameChange(e.target.value)} className="input-base" placeholder="Riverside Academy Deal" />
              </div>
              <div>
                <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Id</label>
                <input
                  required
                  value={form.id}
                  disabled={!!editing}
                  onChange={(e) => { setIdTouched(true); setForm(f => ({ ...f, id: slugify(e.target.value) })) }}
                  className="input-base font-mono disabled:opacity-60"
                />
                {editing && <p className="text-xs text-ink-faint mt-1">Id can't change once created — other rows reference it.</p>}
              </div>
              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Teachers</label>
                  <input type="number" min="0" value={form.max_teachers} onChange={(e) => setForm({ ...form, max_teachers: e.target.value })} className="input-base" placeholder="∞" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Active tests</label>
                  <input type="number" min="0" value={form.max_active_tests} onChange={(e) => setForm({ ...form, max_active_tests: e.target.value })} className="input-base" placeholder="∞" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Students/test</label>
                  <input type="number" min="0" value={form.max_students_per_test} onChange={(e) => setForm({ ...form, max_students_per_test: e.target.value })} className="input-base" placeholder="∞" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Price ₹/mo</label>
                  <input type="number" min="0" value={form.price_inr} onChange={(e) => setForm({ ...form, price_inr: e.target.value })} className="input-base" placeholder="blank = not self-serve" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Razorpay plan id</label>
                  <input value={form.razorpay_plan_id} onChange={(e) => setForm({ ...form, razorpay_plan_id: e.target.value })} className="input-base font-mono text-xs" placeholder="plan_xxxxx" />
                </div>
              </div>
              <p className="text-xs text-ink-faint">Create the plan on Razorpay's dashboard first, then paste its id here — nothing in this app talks to Razorpay's Plans API.</p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Add-on ₹/teacher</label>
                  <input type="number" min="0" value={form.addon_teacher_price_inr} onChange={(e) => setForm({ ...form, addon_teacher_price_inr: e.target.value })} className="input-base" placeholder="blank = not offered" />
                </div>
                <div>
                  <label className="block text-xs font-semibold mb-1.5 text-ink-soft">Add-on ₹/test slot</label>
                  <input type="number" min="0" value={form.addon_test_price_inr} onChange={(e) => setForm({ ...form, addon_test_price_inr: e.target.value })} className="input-base" placeholder="blank = not offered" />
                </div>
              </div>
              <p className="text-xs text-ink-faint -mt-1">Per-unit price orgs on this plan pay to buy extra teacher seats / active-test slots without upgrading tiers. Blank disables add-on purchasing for that dimension.</p>
              <label className="flex items-center gap-2 text-sm text-ink-soft cursor-pointer">
                <input type="checkbox" checked={form.is_public} onChange={(e) => setForm({ ...form, is_public: e.target.checked })} />
                Public — browsable/self-serve in every org's billing page
              </label>
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
