# Production forward inbox

Date: 2026-08-17  
Status: implemented in app; mail DNS is operator-owned

## Boundary

The product sells one USD cash total. Subscriptions have no public billing API. The card email is the universal ingest.

**App:** unique address, parse, month filter, Message-Id idempotency, seat coverage, signed-in status.  
**Operator:** domain, MX, inbound provider, env secrets.  
**Out of scope:** Stripe for AI Bill, Gmail OAuth, Plaid, extra vendor cost APIs.

## Data flow

1. User signs in → `GET /api/inbox` allocates `inboxToken`, returns `token@INBOX_DOMAIN`.
2. Provider POSTs the raw receipt to `POST /api/inbox`.
3. Gates: webhook secret (required on Vercel), token on our domain, sender allowlist, receipt-shaped body.
4. Dedupe key = Message-Id, else hash of token+from+subject+body prefix. Repeat → `{ ignored: true }`.
5. `parseReceipts(..., "inbox")`. Explicit dates outside this LA month are dropped.
6. `saveReceiptLines` upserts `hand|receipt|inbox` of the same name+kind.
7. `lastInboxAt` updates. UI shows address, last receipt, seats still missing.

## Operator checklist

See README “What you need to do (production inbox)”.
