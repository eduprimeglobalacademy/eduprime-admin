import { supabase } from './supabase'
import type { PlatformAdmin } from './supabase'

export const ROOT_DOMAIN = (import.meta.env.VITE_ROOT_DOMAIN || 'eduprime.app').toLowerCase()

export function orgUrl(slug: string): string {
  return `https://${slug}.${ROOT_DOMAIN}`
}

export interface AuthResult {
  admin: PlatformAdmin | null
  error: string | null
}

/**
 * Only platform_admins can sign in here — this app has no other role.
 * A correct password for a non-platform-admin account (an org admin or
 * teacher who happens to reuse credentials) is rejected the same way an
 * unrecognized account is, same shape as getCurrentUser() in the main
 * app returning null for an auth user with no matching row.
 */
export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    return {
      admin: null,
      error: error.message.includes('Invalid login credentials')
        ? 'Invalid email or password.'
        : error.message,
    }
  }

  if (!data.user) return { admin: null, error: 'Sign-in failed.' }

  const { data: platformAdmin } = await supabase
    .from('platform_admins')
    .select('*')
    .eq('user_id', data.user.id)
    .maybeSingle()

  if (!platformAdmin) {
    await supabase.auth.signOut()
    return { admin: null, error: 'This account has no platform admin access.' }
  }

  return { admin: platformAdmin, error: null }
}

export async function getCurrentPlatformAdmin(): Promise<PlatformAdmin | null> {
  const { data: { user }, error } = await supabase.auth.getUser()
  if (error || !user) return null

  const { data: platformAdmin } = await supabase
    .from('platform_admins')
    .select('*')
    .eq('user_id', user.id)
    .maybeSingle()

  return platformAdmin ?? null
}

export async function signOut() {
  await supabase.auth.signOut()
}

/**
 * "View as" from this app can't just swap the local session the way the
 * old in-app console did — this app's origin (admin.*) is never the
 * org's own subdomain, so there's nothing useful to render here even if
 * it worked. Instead: mint the target session server-side, then hand the
 * tokens to the org's own subdomain via a URL hash fragment (consumed by
 * the main app's consumeSessionHandoff()), opened in a new tab so this
 * admin app's own session is untouched and stays logged in.
 *
 * The main app's ImpersonationBanner needs orgName/adminEmail to render
 * and exitImpersonation() needs to know there's no return session to
 * restore to (this admin's real session lives here, not there) — both
 * travel in the same hash fragment, see buildSessionHandoffUrl in the
 * main repo's src/lib/auth.ts.
 */
export async function impersonate(orgSlug: string, orgId: string, teacherId?: string): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession()
  if (!session) throw new Error('Not signed in.')

  const apiUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/impersonate-org`
  const response = await fetch(apiUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${session.access_token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ orgId, teacherId }),
  })
  const result = await response.json()
  if (!response.ok) throw new Error(result.error || 'Failed to start impersonation.')

  const hash =
    `handoff_access_token=${encodeURIComponent(result.accessToken)}` +
    `&handoff_refresh_token=${encodeURIComponent(result.refreshToken)}` +
    `&handoff_impersonating=1` +
    `&handoff_org_name=${encodeURIComponent(result.orgName)}` +
    `&handoff_admin_email=${encodeURIComponent(result.adminEmail)}`

  window.open(`${orgUrl(orgSlug)}#${hash}`, '_blank', 'noopener')
}
