# Sendable First Bill Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans (inline; operator delegated “独立开发”). Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** After Gmail `filter_ready`, any positive cash total can be sent; empty months point at paste-this-month, not a failed setup.

**Architecture:** Change `nextAction` so `missing` never blocks send. Adjust `/app` empty/`filter_ready` copy, a signed-in keys teaser, statement zero-total guards, and Settings Pro honesty. No schema or new inbox states.

**Tech Stack:** Next.js 15 App Router, React 19, existing i18n (`en`/`zh`), Vitest.

## Global Constraints

- Never: “set billing email on Cursor”, confirmation lives in the user’s Gmail, Windsurf test is a first receipt.
- Inbox address host is `1024ideas.com`.
- No Stripe Checkout, Gmail OAuth, or Plaid.
- `nextAction` ids remain `empty | missing | overlap | send`; `missing` is unused as a return when cash > 0.
- Overlap of two coding seats still blocks send. `seat_and_api` does not.

---

### Task 1: nextAction send rules

**Files:**
- Modify: `lib/next-action.ts`
- Test: `lib/next-action.test.ts`

**Interfaces:**
- Consumes: `nextAction(lines: Line[], totalCny: number, locale?: Locale): NextAction`
- Produces: same type; `empty` body is paste-first; cash > 0 without coding-seat overlap → `send`

- [ ] **Step 1: Write the failing tests**

In `lib/next-action.test.ts` add/replace:

```ts
it("refuses to send an empty total and points at paste", () => {
  const action = nextAction([], 0);
  expect(action.id).toBe("empty");
  expect(action.href).toBe("#inbox");
  expect(action.body.toLowerCase()).toMatch(/paste|贴/);
});

it("sends a one-seat bill instead of blocking on missing Claude or ChatGPT", () => {
  const action = nextAction([line({ id: "c", name: "Cursor Pro" })], 20);
  expect(action.id).toBe("send");
  expect(action.href).toBe("/app/statement");
});
```

Keep overlap and three-seat send tests.

- [ ] **Step 2: Run tests — expect fail**

Run: `npx vitest run lib/next-action.test.ts`

- [ ] **Step 3: Implement**

In `lib/next-action.ts`:
- `empty` body: EN “Paste this month’s receipts below, or wait for the next forwarded charge.” ZH “这个月已经扣过的，在下面贴收据；或者等下一次转发进来。”
- Delete the `missing` return block (keep import unused? remove `waitingSeats` import if unused).
- After overlap check, if cash.length > 0 return `send`.

- [ ] **Step 4: Run tests — expect pass**

Run: `npx vitest run lib/next-action.test.ts`

- [ ] **Step 5: Commit**

```bash
git add lib/next-action.ts lib/next-action.test.ts
git commit -m "Send any positive cash total; empty months point at paste."
```

---

### Task 2: i18n + /app framing

**Files:**
- Modify: `lib/i18n/messages/en.ts`, `lib/i18n/messages/zh.ts`
- Modify: `components/InboxCard.tsx` (`filter_ready` compact line)
- Modify: `components/BillApp.tsx` (keys teaser when signed in / cloud)
- Test: `lib/i18n/i18n.test.ts`

**Interfaces:**
- New keys: `inbox.rail.filterSet`, `bill.keysTeaser`, `bill.keysTeaserCta`
- `filter_ready` shows `filterSet` as the lead line; filter table stays below in a `<details>` so they can still copy fields.
- Keys teaser: button that calls existing `openKeys()`.

- [ ] **Step 1: Failing i18n honesty test**

```ts
it("empty-month and filter-set copy stay paste-first", () => {
  expect(t("en", "inbox.rail.filterSet").toLowerCase()).toMatch(/filter|forward/);
  expect(t("zh", "inbox.rail.filterSet")).toMatch(/过滤|转发/);
  expect(t("en", "bill.keysTeaser")).toMatch(/Admin Key|invoice/i);
});
```

- [ ] **Step 2: Add strings**

EN `inbox.rail.filterSet`: “Filter is set. The next Cursor charge will land here. This month: paste below.”  
ZH: “过滤已设好。下次 Cursor 扣款会自己进来。这个月已经扣过的，在下面贴收据。”  
EN `bill.keysTeaser`: “OpenAI or Anthropic invoice? A read-only Admin Key pulls the two invoices that exist.”  
ZH: “有 OpenAI 或 Anthropic 发票？只读 Admin Key 能拉仅有的两张发票。”  
EN `bill.keysTeaserCta`: “Add an Admin Key”  
ZH: “添加 Admin Key”

- [ ] **Step 3: InboxCard `filter_ready`**

Lead with `t("inbox.rail.filterSet")`. Wrap the existing filter table + Gmail link in `<details><summary>{t("inbox.rail.filterTitle")}</summary>…</details>`.

- [ ] **Step 4: BillApp keys teaser**

When `bill.mode === "cloud"` and `!showConnect`, render a paragraph + button above or just below inbox that calls `openKeys()`.

- [ ] **Step 5: Tests + commit**

```bash
npx vitest run lib/i18n/i18n.test.ts lib/next-action.test.ts
git add lib/i18n/messages/en.ts lib/i18n/messages/zh.ts lib/i18n/i18n.test.ts components/InboxCard.tsx components/BillApp.tsx
git commit -m "Frame filter-ready as waiting plus paste; tease Admin Keys."
```

---

### Task 3: Statement zero-total + Settings Pro honesty

**Files:**
- Modify: `components/StatementView.tsx`
- Modify: `components/SettingsPanel.tsx` (and settings copy in en/zh if the button label claims payment)
- Modify: `lib/i18n/messages/en.ts`, `lib/i18n/messages/zh.ts`

**Interfaces:**
- Statement: disable copy/share when `ledger.totalCny === 0`; show `statement.empty`.
- Settings: `settings.proOn` / become-pro button say preview, not paid.

- [ ] **Step 1: Add `statement.empty`**

EN: “There is no cash total to send. Paste a receipt on the bill first.”  
ZH: “还没有能发出去的现金合计。先回账单贴一张收据。”

EN settings become-pro / proOn: “Preview Pro is on. We are not charging yet.”  
ZH: “预览 Pro 已打开。现在还不收费。”

- [ ] **Step 2: StatementView**

If `ledger.totalCny === 0`, show `statement.empty`, `disabled` on copy and share buttons.

- [ ] **Step 3: Settings button label** uses the honest string.

- [ ] **Step 4: Run full suite and commit**

```bash
npx vitest run && npx tsc --noEmit
git add components/StatementView.tsx components/SettingsPanel.tsx lib/i18n/messages/en.ts lib/i18n/messages/zh.ts
git commit -m "Do not share a zero total; call Settings Pro a preview."
```

---

### Task 4: Verify and ship

- [ ] **Step 1:** `npx vitest run && npx tsc --noEmit`
- [ ] **Step 2:** Browser: signed-out `/app` still sign-in first; landing has no billing-email claim; `/app/statement` with empty bill disables share.
- [ ] **Step 3:** `git push origin main && npx vercel --prod --yes`
