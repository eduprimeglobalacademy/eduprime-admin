# Feature: Organization directory & detail

`src/pages/Organizations.tsx` (list) and `src/pages/OrgDetail.tsx` (drill-in). This is the console's home screen and its single most-used feature.

## The directory (list view)

Four headline stats above the table: total organizations, how many are `active`, how many are on `trial`, and how many "need attention" (`past_due` or `suspended`). Below that, two more cards: **Monthly recurring revenue** (sum of every `active` org's plan price — trial orgs are deliberately excluded since they're unpaid) and **Plan distribution** (a count per plan name across all orgs).

The table itself: one row per org, with a status filter bar (`all` / `trial` / `active` / `past_due` / `suspended` / `cancelled`) and a free-text search over name and subdomain. Columns: organization (name + slug), status badge, plan (an inline `<select>` — changing it applies immediately, see "Changing an org's plan" below), custom domain (with a click-to-toggle live/pending pill, see [Custom domains](#custom-domain-live-pending-toggle)), teacher count, test count, next renewal date, created date, and an actions column (View as / Suspend / Reactivate). Clicking anywhere on a row (except the interactive cells) opens that org's detail page.

## The detail page

Everything from the row, plus editable cards:

- **General** — name and slug (subdomain). Changing the slug changes the org's live URL immediately; there's an inline warning that existing links to the old subdomain stop working. Slug is validated (lowercase letters/numbers/hyphens) and uniqueness is enforced by the database (a duplicate shows "That slug is already taken").
- **Plan & billing** — the same plan `<select>` as the list, plus a read-out of that plan's three limits (teachers / active tests / students-per-test, `∞` for unlimited) and the org's actual Razorpay subscription status and renewal date if one exists ("No Razorpay subscription on file — trial, or never billed" otherwise).
- **Add-on capacity** — read-only list of the org's currently-active capacity add-ons (extra teacher seats / active-test slots), with monthly or one-time pricing shown. Purchasing add-ons is self-serve from the org's own Billing page, not from here — this card is visibility only.
- **Trial & access** — the trial end date (editable — see "Extending or shortening a trial" below), and, if the org is currently in a payment grace period, when that grace period ends (this field is set automatically by the billing webhook, not editable here).
- **Custom domain** — the org's custom domain string and its live/pending pill (see below).
- **Branding** — logo URL and the two brand colors (primary/secondary), each with a live color-swatch preview. There is no image upload here (or anywhere in this app) — just a URL field. A note explicitly says paste a hosted image URL.
- **Admin contact** — read-only: the org's admin's name and email, or "No admin account found for this org" if somehow missing.
- **Recent impersonation activity** — the last 10 impersonation sessions for this specific org (a scoped view of the platform-wide [Activity log](activity-log.md)).

## Changing an org's plan

Selecting a different plan from the dropdown (in either the list or detail view) applies immediately — there's no separate "save" step, and it does **not** go through Razorpay at all; it's a direct write to `organizations.plan_id`. This is the mechanism for both self-serve-tier changes made on the org's behalf and assigning a negotiated/private plan.

**Downgrade guard:** before committing a plan change, the app checks whether the org's *current* usage already exceeds the *new* plan's limits (current teacher count vs. new `max_teachers`, and current active-test count via the `org_active_test_count` RPC vs. new `max_active_tests`). If it does, a confirmation dialog lists exactly which limits are already exceeded and explains: "Nothing existing is affected — they just won't be able to add more until they're back under the limit." This is a warning, not a block — the platform admin can always proceed.

## Suspending / reactivating an org

A confirmation dialog either way. **Suspend** ("This pauses new assessments and new educator tokens for this org. Existing tests, results, and students in progress are unaffected.") sets `status = 'suspended'`. **Reactivate** ("This restores full access immediately, bypassing any pending payment.") sets `status = 'active'` and clears `grace_ends_at`. Suspend is only offered when the org isn't already suspended/cancelled; Reactivate only when it's `suspended`, `past_due`, or `cancelled`.

## Extending or shortening a trial

A plain date picker on the org's `trial_ends_at`. There's no automated enforcement tied to this date changing (that lives in the main app's billing logic) — this is purely the platform admin adjusting the clock by hand, e.g. to give a promising prospect more evaluation time.

## Custom domain (live / pending) toggle

Distinct from the org admin setting the domain value itself (that happens in the main app's Billing page — see that repo's docs). What happens here is purely the **activation status**: a small pill next to the domain string reads "pending" or "live", and clicking it toggles `custom_domain_status` between the two. This is a communication step, not automation — the note directly under the field in the detail view is explicit about this: *"Vercel domain + customer's DNS still need to be set up by hand — this only reflects/communicates status."* Nothing in this app talks to Vercel's API. The actual sequence: the org admin sets the domain value on their end → it always starts `pending` → someone (this app's operator) manually adds the domain in the Vercel project dashboard and confirms the customer has pointed DNS at `cname.vercel-dns.com` → only then does clicking this toggle to `live` reflect reality.

## Starting an impersonation session

The "View as" button (list row or detail page) opens a picker: impersonate the org's **Admin**, or any of its registered **teachers** (fetched fresh into a dropdown when the picker opens; if the org has no teachers yet, the dropdown is empty and a note says only the admin account is available). Confirming opens a *new browser tab*, signed in as that account on the org's own subdomain — see [Impersonation](impersonation.md) for the full mechanism, which spans both repos.
