# Feature: Plans catalogue

`src/pages/Plans.tsx` — the pricing tiers and add-on rates that every organization's own self-serve Billing page reads from. This is the source of truth for what an org sees and can subscribe to; nothing about pricing is hardcoded in the main product.

## What a plan is

`id` (a slug, immutable once created — other rows reference it, so it can't be changed on an existing plan, only set at creation), `name`, three limits (max teachers / max active tests / max students-per-test — blank means unlimited, shown as `∞`), a monthly price in ₹ (blank means "Custom," which switches the org-facing card to a "Contact us" button instead of a Subscribe button), a Razorpay plan ID, and a `Public` flag.

**Public** plans are browsable/self-serve on every org's Billing page. A plan created here defaults to **private** — since the three standard self-serve tiers already exist, anything created fresh in this screen is assumed to be a one-off negotiated deal for a specific customer (assigned to that org directly from the Organizations page) rather than a new public tier.

## Add-on pricing (per-unit capacity)

Each plan can independently offer per-unit add-on pricing on any of the three dimensions — ₹/extra teacher seat, ₹/extra active-test slot, ₹/extra student-per-test. Leaving a field blank disables add-on purchasing for that specific dimension on that plan (an org on that plan simply won't see the option to buy more of that thing). The student add-on price also powers flexible/metered student billing (pay-per-actual-student, no upfront purchase) — see the main app's billing docs for how orgs use this.

## Razorpay wiring — this app never talks to Razorpay's API for catalogue setup

Every Razorpay Plan ID field here (the main subscription plan, plus one more per add-on dimension) must be created **first, by hand, on Razorpay's own dashboard** — this console has no integration with Razorpay's Plans API at all, it only stores the IDs you paste in. This is explicitly because Razorpay's Subscription Add-ons API is deprecated; the product's workaround is that each recurring add-on is its own dedicated Razorpay subscription against its own dedicated Razorpay Plan, which is why there's a separate plan-id field per add-on dimension rather than one generic "add-on plan."

## Editing

The pricing/limit fields on an existing plan can be changed at any time — this takes effect for every org on that plan immediately (their Billing page just reflects whatever's here on next load). There's no versioning or "grandfather existing subscribers at the old price" mechanism — changing a live plan's price changes it for everyone on it.
