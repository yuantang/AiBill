# AI Bill

One USD total for what you actually paid this month across Claude, Cursor, ChatGPT, and API invoices. Subscriptions come from the card (a private forward inbox, or a pasted Stripe receipt / bank CSV). APIs come from the two vendor invoices that exist (OpenAI and Anthropic Admin Keys). Usage windows stay out of the money. Built on top of [ccusage](https://github.com/ryoppippi/ccusage) for the estimate layer — we do not reparse tokens.

## Local

```bash
cd aibill
cp .env.example .env
# AUTH_SECRET and ENCRYPTION_KEY (openssl, see below)
npm install
npx prisma db push
npm test
npm run dev
```

Open http://localhost:3456 . Landing is the pitch; `/app` is the bill; `/pricing` is $5/mo. Email sign-in. Without Resend, the magic link prints in the terminal. Signed-out bills stay in the browser.

`openssl rand -base64 32` → `AUTH_SECRET`  
`openssl rand -hex 32` → `ENCRYPTION_KEY`

## Deploy (Vercel)

1. Use `aibill` as the project root, or set Root Directory to `aibill`.
2. Production DB: Postgres. Switch `provider` in `prisma/schema.prisma`, set `DATABASE_URL`, then `npx prisma db push`.
3. Env: `DATABASE_URL`, `AUTH_SECRET`, `AUTH_URL`, `ENCRYPTION_KEY`, `CRON_SECRET`.
4. Mail: `RESEND_API_KEY`, `EMAIL_FROM`. Then sign-in and Monday cron work.
5. Inbound receipts: follow **What you need to do** below.
6. Vercel Cron hits `/api/cron/daily` and `/api/cron/monday` with `Authorization: Bearer $CRON_SECRET`.

## What you need to do (production inbox)

The app already turns a Stripe receipt into a cash line. It cannot receive real mail until you point a domain at it.

1. **Buy or pick a domain** for addresses like `token@inbox.yourdomain.com`.
2. **Create a Mailgun (preferred) or Postmark inbound route.** Resend inbound works only if the webhook includes the email body.
3. **MX records** — the inbound host Mailgun/Postmark gives you, on the inbox subdomain.
4. **Route inbound mail to** `POST https://<your-app>/api/inbox`  
   Mailgun: inbound parse (form fields `recipient`, `from`, `subject`, `body-plain`, `Message-Id`).  
   Postmark: inbound webhook (`To`, `From`, `Subject`, `TextBody`, `MessageID`).
5. **Env on Vercel**
   - `INBOX_DOMAIN` = `inbox.yourdomain.com` (must match the address we show users)
   - `INBOX_WEBHOOK_SECRET` = a long random string; send it as header `x-inbox-secret`  
     On Vercel this secret is required. Locally, inbound works without it so you can test.
6. **Each user, once:** copy their address → Gmail **Forwarding and POP/IMAP** → confirm Google’s mail on `/app` (it never arrives in their Gmail) → then one Cursor filter (From `stripe.com`, Has the words `Cursor`). Cursor has no billing-email field.
7. **Smoke test:** signed-in → “Drop a test Windsurf receipt”. Then forward one real Stripe mail and confirm a `Forwarded` line.

Not in this list: Stripe for AI Bill’s own $5, Gmail OAuth, Plaid. Those are separate.

The same list, written for a person doing the work: [`docs/HUMAN-TODO.md`](docs/HUMAN-TODO.md).

Hosted cannot read Claude logs on a laptop. Export ccusage JSON locally and import.

## What the total means

- Total = subscriptions whose charge day has passed + vendor cost APIs + other entered charges
- ccusage token × list price is not in the total
- Usage windows are not money
- Admin Keys stay on the server, AES-256-GCM, never returned to the page
