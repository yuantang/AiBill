export const PRODUCT = {
  name: "AI Bill",
  tagline: "What you actually paid this month, across every AI tool.",
  priceUsd: 5,
  priceYearUsd: 48,
  priceNote: "Cancel anytime",
} as const;

export const FREE_LIMITS = {
  localOnly: true,
  savedKeys: false,
  mondayEmail: false,
  historyMonths: 0,
} as const;

export const PRO_FEATURES = [
  {
    title: "One number you can send",
    body: "Subscriptions at what the card charged. APIs at the vendor invoice. Usage windows stay out of the total. Open any line to check the source.",
  },
  {
    title: "Every platform forwards itself",
    body: "Cursor, Claude Max, ChatGPT Plus, Windsurf have no billing API. They all email a Stripe receipt. One private inbox, one Gmail filter — then the card charges land without you.",
  },
  {
    title: "Invoices pull themselves",
    body: "Save a read-only Admin Key. We fetch OpenAI and Anthropic costs every night so you stop opening three dashboards.",
  },
  {
    title: "One email on Monday",
    body: "The total, and whether this week’s API burn blows the budget. No digest. No insights shop.",
  },
  {
    title: "A statement your cofounder can trust",
    body: "Share a read-only link, export CSV, or print. Token estimates sit next to the real number so nobody ships the wrong one.",
  },
  {
    title: "The ccusage gap, named",
    body: "Token × list price is not what you paid on Max or Cursor. We show both, and tell you which one to send.",
  },
  {
    title: "What still hits the card",
    body: "Plans not charged yet plus API at the last three-day pace. One expected month-end, not a token burn chart.",
  },
  {
    title: "Stop paying twice",
    body: "ChatGPT Plus plus an OpenAI invoice. Cursor plus Windsurf. We name the overlap so you can cancel the one you do not open.",
  },
] as const;
