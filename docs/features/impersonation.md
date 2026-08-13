# Feature: Impersonation ("View as")

Lets a platform admin see and act inside an organization's account — as that org's admin, or as one specific teacher — for support purposes, without ever touching that person's password. This feature genuinely spans two repos: the trigger lives in this console, the actual signed-in experience happens in the main `test.eduprime` app on the org's own subdomain. Both halves are documented here since neither makes sense alone.

## Starting a session (this app)

From the Organizations list or detail page, "View as" opens a modal: pick **Org Admin** (default) or a specific teacher from a dropdown of that org's registered teachers. Confirming calls `impersonate(orgSlug, orgId, teacherId?)` (`src/lib/auth.ts`), which:

1. Sends the current admin's own access token, plus the target `orgId` and optional `teacherId`, to the `impersonate-org` Supabase Edge Function.
2. The function (running with the service-role key, in the main repo's `supabase/functions/impersonate-org/`) verifies the caller really is a platform admin, looks up the target account's email (the org's admin, or the specific teacher — rejecting a `teacherId` that belongs to a different org rather than silently ignoring it), and mints a real Supabase session for that email via `auth.admin.generateLink({type:'magiclink'})` immediately redeemed server-side with `verifyOtp`. **No email is ever sent** — `generateLink` only creates the token, nothing dispatches it. The target's password is never read, checked, or reset.
3. The function logs the attempt to `impersonation_log` (append-only — this table's INSERT policy only permits the service role, so a platform admin cannot skip or fake an entry) and returns the minted session's tokens plus the org name and target's display name/email.
4. This app opens a **new browser tab** at the org's own subdomain with those tokens (plus the org name/admin email for the banner) attached as a URL hash fragment — never a query string, so nothing is ever sent to a server or logged anywhere. This app's own tab and session are completely untouched; the admin stays logged in here.

Why a new tab and a hash fragment specifically: this console's own origin (`admin.*`) is never the org's own subdomain, so there's nothing useful to render here even if the session swap happened locally — the target session has to actually live on the org's own origin to work at all.

## The experience (main app, on the org's subdomain)

The main app's `AuthProvider` calls `consumeSessionHandoff()` on load, which reads the hash fragment, calls `supabase.auth.setSession()` with the handed-off tokens, and — because this specific handoff came from the standalone admin app rather than the main app's own root-domain org-signup flow — stashes `{orgName, adminEmail, returnAccessToken: '', returnRefreshToken: ''}` in `sessionStorage` under a fixed key. The empty return-token fields matter: they tell the exit flow there's no local session to restore to, because the platform admin's real session lives on the *other* origin (this console), in the tab that's still open and untouched.

A persistent amber `ImpersonationBanner`, mounted at the very top of the main app (outside its normal role-based view switch, so it's visible no matter what screen renders under it) reads that stashed state and shows: *"Viewing as **{orgName}** ({adminEmail}) — support session"* with an **Exit** button. Signed in as the target account, the platform admin genuinely sees and can act on everything that account can — RLS scopes all data correctly because it keys off the impersonated `admin_users`/`teachers` row, not the browser session's origin.

**Known limitation, accepted deliberately:** the org's own branding (logo, colors) does not apply during an impersonation session — the tenant resolution in the main app is keyed off the hostname, and this session is happening on whatever host the platform admin was already on (their tab from this console's redirect target, not literally the org's branded subdomain the org's own users see... actually it *is* the org's own subdomain by construction of step 4 above, so branding generally does apply correctly in the common case; treat any exception you observe as worth a closer look rather than assuming it's expected).

## Exiting

Clicking **Exit** in the banner calls `exitImpersonation()`: it clears the stashed state, and — since there's no return session for a console-originated handoff — simply signs out of the org session. The platform admin doesn't end up "back" anywhere in this tab; they return to their still-open console tab in the other window, which was never touched.

## What gets logged

Every impersonation start (never the exit) writes one row to `impersonation_log`: which platform admin, which org, which target email, and when. This is what powers both the org detail page's "Recent impersonation activity" card (scoped to one org) and the console-wide [Activity log](activity-log.md) page. It cannot be edited, deleted, or skipped by the admin who triggered it — only the Edge Function's service-role client can insert into that table.

## Scope

Only the org's **admin** account or a specific **teacher** account can be impersonated — never a student (students never authenticate at all, so there's no account to impersonate) and never another platform admin.
