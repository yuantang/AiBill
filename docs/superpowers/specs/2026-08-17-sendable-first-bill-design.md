# Sendable first bill (operator-complete loop)

Date: 2026-08-17  
Status: decided by operator delegation (“全部自己决定 / 独立开发独立运营”).  
Scope: one implementation cycle. Not a whole-site redesign.

## Goal

A signed-in user who finished Gmail setup (`filter_ready`) can leave `/app` with **one USD number they can send**. This month’s cash may come from paste or a real forwarded receipt. Success does **not** require Claude + Cursor + ChatGPT all present, a live next Stripe charge, or AI Bill’s own $5 Checkout.

## Why this, not a full audit

The product already sells one thing. Forecast, year, letter, history, and settings exist. They stay. This cycle closes the hole between “filter is set” and “I have a number I can stand behind.”

## Non-goals

Gmail OAuth, Stripe Checkout for AI Bill, Plaid, new vendor APIs, rewriting landing visual design, collapsing every secondary page into this spec.

## Hard facts (still true)

- Cursor has no billing-email field. First-run is Gmail Forwarding → confirm on `/app` → one filter.
- Receiving is on the apex: `token@1024ideas.com` (not `inbox.`). Old `inbox.` recipients still parse during cutover.
- Filters apply to **new** mail only. This month’s charges need paste (or wait).
- Windsurf test is not a first receipt.
- Only OpenAI and Anthropic have pullable org cost APIs.
- Login is currently Pro without charging. Settings “become Pro” must not look like a payment.

## Approaches considered

**A — Sendable first bill (chosen).** After `filter_ready`, one next action: get cash on the bill this month, then send. Missing watched seats are a hint. Overlap still blocks send if two coding seats are on the bill.

**B — Full UX audit of every page.** Forecast, history, year, letter, pricing, settings all in one spec. Too wide; ships nothing a user can send.

**C — Turn on Stripe $5 now.** Charges before the number is trustworthy. Operator rule: do not take money until the cash loop works.

## User-visible loop

| State | What `/app` does |
|---|---|
| Guest | Sign in. No fake “set billing email.” |
| `unverified` → `confirm_received` → `filter_ready` | Existing exclusive Gmail rail. Unchanged order. |
| `filter_ready` and **empty cash** | Rail collapses to a one-line “filter is set; next Cursor charge will land.” **This month** is the open paste details + optional tap-plans. Next action id `empty` points at paste, not “start setup again.” |
| Cash > 0 | Next action is **send** unless a coding-seat overlap exists. Watched seats still missing (Claude / Cursor / ChatGPT) show as a hint under the total, not a gate. |
| `first_receipt` | Existing one-line rail. Next action follows cash rules above. |
| Signed-in, invoices | One always-visible line: “OpenAI / Anthropic invoice? Add a read-only Admin Key.” Opens the existing keys panel. Not the hero. |

`nextAction` ids stay `empty | missing | overlap | send` with this change:

- `empty`: href `#inbox`, copy about **paste this month** (or wait). Never “set billing email.” Never imply setup failed after `filter_ready`.
- `missing`: **removed as a send-blocker.** Implementation: do not return `missing` when `cash.length > 0`. Keep `waitingSeats` for inbox hints only.
- `overlap`: unchanged (second IDE). `seat_and_api` still does not block send.
- `send`: any `includedInTotal` cash, no coding-seat overlap.

## Surfaces

**`/app` hero order (signed-in):** total → next action → inbox rail → paste → keys teaser → table.

**Statement `/app/statement`:** primary CTAs stay Copy and Share link. Empty cash cannot share a fake total (API already has the number; UI disables share/copy when total is 0).

**Settings:** “Pro” is labeled preview / not charged. No new Checkout.

**Landing / pricing:** no new claims. Existing honesty (“Stripe when we turn charges on”) stays.

## Data / API

No new tables. No new inbox states.

- `GET /api/inbox` already returns `status`, `waiting`, `lastReceiptAt`.
- `nextAction` becomes a pure function of lines + total (and may take `status` only to pick empty-state copy). Prefer: empty copy is always paste-first; `filter_ready` does not need a new field if paste-first is correct for guests too.
- Share and ingest unchanged.

## Errors

- Paste with no AI charges: existing “No AI card charges found.”
- Confirm mail without code/link: existing disable-ack + rotate.
- Keys: existing Admin Key errors stay visible when the keys panel is open.

## Tests

- `nextAction([])` → `empty`, href `#inbox`, body mentions paste / this month (en + zh).
- `nextAction([Cursor only])` → `send`, not `missing`.
- `nextAction([Cursor, Windsurf])` → `overlap`.
- `nextAction([Claude, Cursor, ChatGPT])` → `send`.
- i18n: no “set it as the billing email”; empty action does not say setup failed.
- Statement: share/copy controls disabled when `totalCny === 0`.

## Operator (this cycle, in product)

HUMAN-TODO item 5 (Gmail) is done for the first account. This spec does not add Stripe. Monday cron and magic links stay as they are.

## Self-review

- No TBD. Missing-as-blocker is explicitly removed.
- Does not contradict first-run spec: filter_ready is still success for setup; this spec starts *after* that.
- Address host in copy is `token@1024ideas.com`.
- One cycle: nextAction + `/app` empty/filter_ready framing + keys teaser + statement empty guard + honesty on fake Pro.
