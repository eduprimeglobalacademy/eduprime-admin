# Feature: Analytics & Usage

Two separate screens, both computed live from current data — neither reads from any historical snapshot table, so anything framed as "over time" is reconstructed from timestamps on current rows, not a stored time series.

## Analytics (`src/pages/Analytics.tsx`)

Platform-wide growth and revenue metrics, all derived from `organizations`, `plans`, `teachers`, and `tests`:

- **Acquisition** — a bar chart of organization signups bucketed by week (Monday-anchored), built purely from each org's `created_at`.
- **Activation** — % of all orgs that have at least one teacher *and* at least one test. A blunt but simple proxy for "did this org actually start using the product."
- **Conversion** — of orgs whose trial has already ended (`trial_ends_at` in the past), what % are currently `active`. Explicitly labeled "as of now" / "a snapshot, not a trend" in the UI — because org status changes aren't logged historically, this can't show a conversion-rate-over-time chart, only today's cross-section.
- **Retention** — % of all orgs ever created that have *not* cancelled. Note this counts every org ever created, including ones still on trial (never lost, since never "retained" from anything yet) — read it as a rough churn proxy, not a cohort-based retention curve.
- **Revenue mix** — a pie chart of org count per plan, plus current MRR (sum of `active` orgs' plan price — trial orgs excluded since they're unpaid).

## Usage & Limits (`src/pages/Usage.tsx`)

Real Postgres metrics only, via the `get_platform_usage` RPC: database size (compared against a hardcoded Supabase Free-tier reference ceiling — a labeled reference point, not a live-fetched value, since this project has no Supabase Management API token configured) plus raw row counts (auth users, organizations, teachers, tests, test attempts, student answers).

**Explicitly out of scope on this screen** (and called out as such in the UI itself): storage bytes, bandwidth/egress, and Edge Function invocation counts. Those are metered by Supabase's own billing system, aren't queryable via plain SQL, and have to be checked directly in the Supabase dashboard instead.
