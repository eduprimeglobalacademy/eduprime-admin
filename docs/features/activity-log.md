# Feature: Activity log

`src/pages/Activity.tsx` — a platform-wide feed of the most recent 100 impersonation ("View as") sessions, newest first: which account was viewed, at which org, and when.

This is a read-only surface over the same `impersonation_log` table the Organizations page's per-org "Recent impersonation activity" card reads from (scoped to one org there vs. every org here). See [Impersonation](impersonation.md) for how entries get written.

Today, impersonation is the **only** action this app logs anywhere a platform admin can review — plan changes, status changes, branding edits, domain activation, and everything else done from the Organizations or Plans screens leave no audit trail visible in this console (they do still hit `updated_at`/`created_at` columns on the underlying rows, but there's no dedicated log of *who* made *which* change *when* for anything besides impersonation).
