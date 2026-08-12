import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL,
  import.meta.env.VITE_SUPABASE_ANON_KEY
)

// Duplicated from the main app's src/lib/supabase.ts on purpose — this repo
// is deliberately independent (see eduprime-admin's project notes), not a
// shared package. Keep these in sync by hand if the main schema changes.

export type OrgStatus = 'trial' | 'active' | 'past_due' | 'suspended' | 'cancelled'

export interface Organization {
  id: string
  name: string
  slug: string
  logo_url?: string
  primary_color: string
  secondary_color: string
  status: OrgStatus
  plan_id: string
  trial_ends_at?: string
  grace_ends_at?: string
  razorpay_customer_id?: string
  custom_domain?: string
  custom_domain_status?: 'pending' | 'active'
  created_at: string
}

export interface Plan {
  id: string
  name: string
  max_teachers: number | null
  max_active_tests: number | null
  max_students_per_test: number | null
  razorpay_plan_id: string | null
  price_inr: number | null
  sort_order: number
  is_public: boolean
  addon_teacher_price_inr: number | null
  addon_test_price_inr: number | null
  addon_student_price_inr: number | null
  razorpay_addon_teacher_plan_id: string | null
  razorpay_addon_test_plan_id: string | null
  razorpay_addon_student_plan_id: string | null
}

export type AddonKind = 'extra_teachers' | 'extra_active_tests'

export interface CapacityAddon {
  id: string
  org_id: string
  kind: AddonKind
  quantity: number
  mode: 'recurring' | 'one_time'
  status: string
  unit_price_inr: number
  expires_at: string | null
  created_at: string
}

export type SubscriptionStatus = 'created' | 'authenticated' | 'active' | 'pending' | 'halted' | 'cancelled' | 'completed'

export interface Subscription {
  id: string
  org_id: string
  plan_id: string
  razorpay_subscription_id: string
  status: SubscriptionStatus
  current_period_end?: string
  created_at: string
  updated_at: string
}

export interface PlatformAdmin {
  id: string
  user_id: string
  email: string
  name: string
  created_at: string
}

export interface AdminUser {
  id: string
  user_id: string
  org_id: string
  email: string
  name: string
  created_at: string
}

export interface ImpersonationLogEntry {
  id: string
  platform_admin_id: string
  org_id: string
  target_email: string
  started_at: string
}

export type PromotionStatus = 'active' | 'expired' | 'archived'

export interface Promotion {
  id: string
  code: string
  description: string | null
  discount_note: string | null
  starts_at: string | null
  ends_at: string | null
  status: PromotionStatus
  org_id: string | null
  razorpay_offer_id: string | null
  created_by: string | null
  created_at: string
}

export interface PlatformUsage {
  db_size_bytes: number
  auth_users_count: number
  organizations_count: number
  teachers_count: number
  tests_count: number
  test_attempts_count: number
  student_answers_count: number
}
