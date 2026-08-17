export const GMAIL_FILTERS_URL = "https://mail.google.com/mail/u/0/#settings/filters";

export const BILLING_SEATS = [
  {
    id: "cursor",
    name: "Cursor",
    href: "https://cursor.com/dashboard/billing",
    how: "cursor",
    from: "stripe.com",
    contains: "Cursor",
  },
  {
    id: "claude",
    name: "Claude",
    href: "https://claude.ai/settings/billing",
    how: "claude",
    from: "stripe.com",
    contains: "Claude",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    href: "https://chatgpt.com/#settings",
    how: "chatgpt",
    from: "stripe.com",
    contains: "OpenAI",
  },
] as const;

export type BillingSeatId = (typeof BILLING_SEATS)[number]["id"];
