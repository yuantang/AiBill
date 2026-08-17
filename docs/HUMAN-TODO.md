# Human todo — make AI Bill receive real mail and stay useful

The app already turns a Stripe receipt into a cash line and tells you which number to send. It cannot receive live email until a person does the work below. Do these in order. Do not start Stripe or Gmail OAuth until 1–6 work.

## This week (you)

Done in Vercel (do not redo): Neon `aibill-db`, `INBOX_DOMAIN=inbox.1024ideas.com`, `INBOX_WEBHOOK_SECRET`, `EMAIL_FROM=AI Bill <noreply@1024ideas.com>`, Resend resource `aibill-mail` (free, still **Onboarding** until DNS verifies).

1. **Verify sending domain** (Namecheap DNS for `1024ideas.com`)  
   Open the Resend resource (Vercel → Storage → `aibill-mail`, or the SSO link from `vercel integration open resend aibill-mail`).  
   Add the DKIM / SPF / MX records Resend shows. Do **not** replace the root MX if you already receive mail at `@1024ideas.com` — only add the records Resend lists (usually on `send` / `_domainkey`).  
   Wait until the resource status is Available.

2. **Inbound MX**  
   Keep receiving on the subdomain only:  
   `inbox.1024ideas.com` → provider inbound MX (Resend receiving MX from that same dashboard, or Mailgun inbound if you prefer).  
   Do not point the root domain MX here.

3. **Webhook**  
   Route inbound mail to  
   `POST https://aibill.1024ideas.com/api/inbox?secret=<INBOX_WEBHOOK_SECRET>`  
   (same secret is also accepted as header `x-inbox-secret` or `Authorization: Bearer …`).  
   Mailgun fields: `recipient`, `from`, `subject`, `body-plain`, `Message-Id`.  
   Resend JSON `email.received` is already parsed.

4. **Smoke**  
   Sign in on https://aibill.1024ideas.com → copy the address → “Drop a test Windsurf receipt”.  
   Then forward one real Stripe Cursor or Claude receipt.  
   Expect a line with source **Forwarded**, and the month total to move.  
   Forward the same email again: total must not double.

5. **Your own Gmail (once)**  
   Settings → **Forwarding and POP/IMAP** (`#settings/fwdandpop`) → add the AI Bill address.  
   Google’s confirmation mail goes to that address, **not** your Gmail. Confirm the code/link on `/app`, then click “I confirmed in Gmail.”  
   Only after that: Settings → Filters → From `stripe.com`, Has the words `Cursor` → next screen only **Forward it to**. Do not apply to matching conversations.  
   Cursor has no billing-email box. Do not teach users to change email on Stripe’s customer portal.

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
