# Feature: Promotions

`src/pages/Promotions.tsx` — discount codes that an org admin can redeem from their own Billing page.

## Creating a promotion

Fields: code (e.g. `LAUNCH25`), an internal description, a human-readable discount note (e.g. "25% off first 3 months" — this is display text only, not a computed discount; the actual discount logic lives entirely on Razorpay's side via the Offer), start/end dates (either can be left blank for no bound), and — the two fields that actually make it functional:

- **Organization**: leave as "Any org (generic code)" for a code any customer can redeem, or pick one specific org to scope it to a single customer (used for negotiated or founding-customer deals).
- **Razorpay offer id**: must already exist — created by hand on Razorpay's dashboard first, since **no API exists to create a Razorpay Offer programmatically**. This field just records the ID so the main app knows what to apply when a code is redeemed.

## What this screen actually is

Explicitly described in-product as *"Internal tracking list for the platform team's own record-keeping — not wired into Razorpay checkout yet"* in one sense (the discount-note text is just documentation, not a computed price adjustment applied automatically by this screen) — but the **code redemption itself is real and functional**: an org admin typing a valid, currently-active code into their Billing page does apply the linked Razorpay Offer to their subscription (either immediately, or queued for their next subscribe action). What's *not* automated is the offer's terms — those live entirely on Razorpay's side and just get referenced by ID here.

## Status lifecycle

Three statuses exist (`active` / `expired` / `archived`), filterable in the list. Only one transition is actually wired up in this screen: **Archive**, a manual one-way action from the Actions column (no "unarchive" back to active). `expired` is a valid stored value the database schema allows, but nothing in this app — no button, no automatic date-based check — ever sets a promotion to it; a promotion whose `ends_at` has passed still shows as `active` here unless someone archives it by hand. Don't rely on the end date alone to stop a code from displaying as active in this list (redemption on the main-app side does its own date validity check independently, regardless of what this admin screen shows).

Editing an existing promotion is always available regardless of status.
