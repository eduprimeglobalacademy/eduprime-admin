# EduPrime Platform Console — Product Documentation

This is the internal staff console for EduPrime, the company running the white-label assessment platform (the customer-facing product lives in the separate `test.eduprime` repo — see its own `docs/` folder for the product every school/customer actually uses).

**Who uses this app:** EduPrime's own staff only — support, ops, and founders. There is exactly one role (`platform_admins`), no self-serve signup, and no customer ever sees this app. It's a separate deployment on its own subdomain (`admin.*`), so none of this code or its data-access patterns ship in the bundle any customer downloads.

**What it's for:** everything EduPrime staff need to run the business on top of the multi-tenant product — see which schools are on the platform and how healthy they are, adjust their plans and billing by hand when self-serve isn't enough, look into an org's account on their behalf, manage the pricing catalogue, run promotions, and keep an eye on overall platform usage and growth.

## Roles

- [Platform Super Admin](roles/platform-super-admin.md) — the only role. Everything below is scoped to this one role.

## Features

- [Organization directory & detail](features/organizations.md) — the home screen: every customer org, its health, and the levers to adjust it by hand.
- [Impersonation ("View as")](features/impersonation.md) — sign in as any org's admin or a specific teacher, without ever touching their password.
- [Plans catalogue](features/plans.md) — the pricing tiers and add-on rates every org's Billing page reads from.
- [Promotions](features/promotions.md) — discount codes, org-specific or platform-wide.
- [Analytics & Usage](features/analytics-and-usage.md) — acquisition/activation/conversion/retention metrics and raw platform-wide row counts.
- [Activity log](features/activity-log.md) — the append-only audit trail of every impersonation session.

## How this app relates to the main product

This console reads and writes the exact same Supabase database as `test.eduprime`, using the anon key and the signed-in platform admin's own RLS-scoped session — there is no separate backend and no service-role key in this app. It duplicates a handful of TypeScript types from the main repo's `src/lib/supabase.ts` by hand (see `src/lib/supabase.ts`'s own top-of-file note) because the two repos are deliberately independent deployments, not a shared package.

One feature spans both repos and can't be understood from this repo alone: **impersonation**. The *trigger* ("View as" button, target picker) lives here; the *experience* (the amber banner, the exit flow, the actual signed-in session) happens inside the main app on the org's own subdomain. See [Impersonation](features/impersonation.md) for the full round trip.
