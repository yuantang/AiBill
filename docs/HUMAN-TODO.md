# Human todo — operator of AI Bill

Mail, DNS, and first-run Gmail are live. Do not rebuild them. The product is Gmail forward + paste + two Admin Keys + a statement. Not in the product: vendor billing-email fields, Gmail OAuth, Plaid.

## Done (do not redo)

- Neon `aibill-db`, Vercel `aibill`, domain `aibill.1024ideas.com`
- `INBOX_DOMAIN=1024ideas.com`, receiving MX on apex `@` → `inbound-smtp.us-east-1.amazonaws.com`
- Resend sending + receiving **verified**; webhook `email.received` → `/api/inbox`
- First account: forwarding address confirmed, Cursor filter can be created
- Product: exclusive Gmail rail, paste-this-month, send any positive cash total, Admin Keys, statement

## This week (you — one action)

**Forward or paste one real Stripe receipt from this month** (Cursor, Claude, or ChatGPT) to the address shown on `/app`, or paste the email text there.

Expect a line with source **Forwarded** (or pasted), and the month total to move. Forward the same mail again: total must not double.

Optional: paste a read-only OpenAI / Anthropic Admin Key for the two invoices that exist.

Then open the statement and send the number if it matches the card.

## Later (business only)

- Stripe Checkout for AI Bill itself ($5 / $48) — subscription, not a user cash path
