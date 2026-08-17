# First-run Gmail setup (shippable)

Date: 2026-08-17  
Status: approved via “自动完成” after scope A.

## Goal

After sign-in, one path that actually works: **add a Gmail forwarding address → confirm Google’s mail on AI Bill → then create one filter**. Zero false claims. Success does **not** require a live Stripe charge.

## Non-goals

Gmail OAuth, Stripe $5 for AI Bill, Plaid, Cursor/Claude/ChatGPT “billing email” fields, pulling subscription invoices via vendor APIs (they do not exist).

## Hard facts

- Cursor has no billing-email box. Stripe’s customer portal does not let the customer change email on the no-code login link.
- Claude / ChatGPT receipts follow the **account** email. First-run does not teach those dashboards.
- Gmail will not offer “Forward it to” until the address is verified.
- Google sends the confirmation **to `token@inbox.1024ideas.com`**, not to the user’s Gmail.
- Filter-forwarded Stripe mail arrives **From the user**; the original Stripe headers are in the body.
- Filters apply to **new** mail only.

## User-visible rail (exclusive)

| State | User sees | Unlock |
|---|---|---|
| `unverified` | Copy address. Open Gmail **Forwarding and POP/IMAP** (`#settings/fwdandpop`). How to add the address. Waiting line: confirmation will **not** appear in their Gmail. | Confirm mail parsed |
| `confirm_received` | Copyable code and/or link. “This mail is not in your Gmail.” CTA: confirm in Gmail, then “I confirmed in Gmail.” No filter table. | Honor-system ack, only if code or link exists |
| `filter_ready` | **One** filter (Cursor first). From `stripe.com`, Has the words `Cursor`, other fields empty, next screen only Forward it to, do not apply to matching conversations. Claude/ChatGPT = same filter, different word. | Success can end here |
| `first_receipt` | Collapse rail to a one-line status. Next charge landed. | Real receipt-shaped inbound (not confirm, not Windsurf test) |

Paste stays a closed details: “Need this month’s number now.”

## Data

`UserSettings` splits time fields:

- `confirmCode`, `confirmLink`, `confirmReceivedAt` — Google verify mail
- `forwardingAckedAt` — user clicked “I confirmed”
- `lastReceiptAt` — cash receipt only
- `lastInboxAt` — stop using for receipt copy

`GET /api/inbox` returns `{ address, status, confirm, lastReceiptAt, waiting, seats }`. No `setup` billing-email strings. No `notice` blob.

`PATCH` with `{ ack: true }` sets `forwardingAckedAt`. `PATCH` rotate issues a new token and **clears** confirm + ack.

Inbound POST: confirm updates confirm fields only; receipt updates `lastReceiptAt` and `BillLine`. Gmail-forward From=user still allowed if body is a Stripe receipt.

Poll `GET` every 4s only while `unverified`, stop on confirm or after 10 minutes (then “Check again”).

## Copy rules

Never: “set billing email on Cursor”, “open that confirmation in your Gmail inbox”, “Last receipt” for a verify mail.

## Tests

Status derivation; confirm ≠ receipt; rotate resets; i18n has no Cursor billing-email claim; `fwdandpop` only in `unverified`.

## Self-review (2026-08-17)

Checked against the user’s first-run confusion (Cursor dashboard + Gmail filter form) and the hard facts above.

- **Order is locked.** Forwarding (`#settings/fwdandpop`) is the only CTA in `unverified`. Filters appear only after honor-system ack. Matches Google’s required verify-then-filter order.
- **No false Cursor billing-email path.** Landing `step2`, inbox leftover keys, README, and HUMAN-TODO no longer say “set this as the billing email.”
- **Confirm ≠ cash.** Google verify mail writes `confirm*` only. Windsurf test writes `lastInboxAt` only. `lastReceiptAt` is a real receipt-shaped inbound.
- **Paste and tap-plans are fallbacks.** Paste is a closed details on the inbox panel. Onboarding tap-plans is a closed details under the rail, not a peer hero.
- **`first_receipt` collapses** the filter table to a one-line status. Success does not require a live Stripe charge; `filter_ready` is enough to stop interviewing the user.
- **Known leftover, accepted.** `GET` still returns `lastInboxAt` for older clients. Confirm mail with neither code nor link stays in `confirm_received` and disables ack — rotate is the escape. No Gmail OAuth, no Stripe $5, no Plaid in this ship.
