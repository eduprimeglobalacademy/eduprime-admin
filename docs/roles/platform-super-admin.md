# Role: Platform Super Admin

## Who this is

EduPrime's own staff — not a customer. A platform admin is not tied to any organization; they see and can act on every customer org from one screen. There's no self-serve way to become one: someone with database access creates the person's Supabase auth user, then hand-inserts a row into `platform_admins` linking that auth user's id to their email/name. There's no UI for this on purpose — it's a rare, deliberate action, not a workflow.

## Signing in

A plain email/password form (`src/components/SignIn.tsx`) — no Google SSO, no registration link, nothing else. On submit, the app checks the signed-in auth user against `platform_admins`; if there's no matching row, it's treated exactly like a wrong password ("This account has no platform admin access") and the user is immediately signed back out. A correct password for a legitimate org admin or teacher account (someone who happens to reuse credentials) is rejected the same way — this app recognizes exactly one kind of account.

## What they can do (the whole app, one sidebar)

Six sections, all reachable from the left sidebar at all times — this is a small, dense internal tool, not a multi-level nav:

1. **Organizations** — the default landing page. Browse every customer, drill into one, change its plan/status/domain/trial/branding by hand, or start an impersonation session. See [Organizations](../features/organizations.md).
2. **Plans** — create and edit the pricing tiers (Starter/Growth/Institution, plus any negotiated one-off deals) that every org's self-serve Billing page reads from. See [Plans](../features/plans.md).
3. **Analytics** — acquisition, activation, conversion, retention, and revenue mix, computed live from current data. See [Analytics & Usage](../features/analytics-and-usage.md).
4. **Usage & Limits** — raw platform-wide row counts and database size, mainly to watch for approaching Supabase's own tier ceilings. Same doc as above.
5. **Activity** — the last 100 impersonation sessions across every org, append-only. See [Activity log](../features/activity-log.md).
6. **Promotions** — create and manage discount codes. See [Promotions](../features/promotions.md).

Signing out is a single button at the bottom of the sidebar, showing the signed-in admin's email above it.

## What they explicitly cannot see

By design, a platform admin's access does **not** extend to an org's actual test content or student data — no `test_attempts`, `student_answers`, or `questions` rows are ever queried by this app. Everything here is billing/support/ops scope: org metadata, subscription status, plan assignment, aggregate counts. The one way to see inside an org's real data is impersonation, which is a distinct, logged, deliberate action — not something browsing this console ever does incidentally.
