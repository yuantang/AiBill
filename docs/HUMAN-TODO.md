# Human todo — make AI Bill receive real mail and stay useful

The app already turns a Stripe receipt into a cash line and tells you which number to send. It cannot receive live email until a person does the work below. Do these in order. Do not start Stripe or Gmail OAuth until 1–6 work.

## This week (you)

1. **Domain**  
   Pick a host for addresses like `ab12cd34ef@inbox.yourdomain.com`.  
   Set Vercel `INBOX_DOMAIN` to that host. It must match the address shown in `/app`.

2. **Inbound provider**  
   Create **Mailgun Inbound** (preferred) or Postmark Inbound.  
   Resend inbound is only OK if the webhook body includes the email text.

3. **MX**  
   Point the inbox subdomain at the provider’s inbound MX. Wait for DNS.

4. **Webhook**  
   Route inbound mail to `POST https://<production-host>/api/inbox`.  
   Mailgun: inbound parse. Fields we read: `recipient`, `from`, `subject`, `body-plain`, `Message-Id`.  
   Postmark: `To`, `From`, `Subject`, `TextBody`, `MessageID`.

5. **Secret**  
   Set `INBOX_WEBHOOK_SECRET` to a long random string.  
   Send it as header `x-inbox-secret`.  
   On Vercel, inbound is rejected if this is missing.

6. **Smoke**  
   Sign in on production → copy the address → “Drop a test Windsurf receipt”.  
   Then forward one real Stripe Cursor or Claude receipt.  
   Expect a line with source **Forwarded**, and the month total to move.  
   Forward the same email again: total must not double.

7. **Your own Gmail (once)**  
   Settings → Filters → the query on the bill page → Forward to your AI Bill address.  
   Or set that address as the billing email on Cursor / Claude / ChatGPT / Windsurf.

## Already done in the app (do not rebuild)

- Unique per-user inbox token and address  
- Receipt parser (Stripe text, bank CSV)  
- Other-month dates stay out of this month  
- Same Message-Id processed once  
- Hand / paste / forward of the same seat is one cash line  
- OpenAI / Anthropic Admin Key invoices  
- One number to send, overlap (“paying two IDEs”), Monday letter, share link  
- Demo: `/app?demo=1` → “Watch three receipts land”

## Later (only after mail works)

- Stripe Checkout for AI Bill itself ($5 / $48)  
- Gmail OAuth so users skip the filter  
- Plaid / bank feed  
- Extra vendor cost APIs (OpenRouter has no monthly invoice)

## How you know the product is solving the pain

A user who pays Claude + Cursor + ChatGPT + an OpenAI invoice should:

1. Open `/app` and see **one USD total** that matches the card, not ccusage.  
2. See **one next action**: send that number, cancel a duplicate seat, or add a missing receipt.  
3. After setup, **not paste every month**.
