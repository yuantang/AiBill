export const BILLING_SEATS = [
  {
    id: "cursor",
    name: "Cursor",
    href: "https://cursor.com/dashboard/billing",
    how: "cursor",
  },
  {
    id: "claude",
    name: "Claude",
    href: "https://claude.ai/settings/billing",
    how: "claude",
  },
  {
    id: "chatgpt",
    name: "ChatGPT",
    href: "https://chatgpt.com/#settings",
    how: "chatgpt",
  },
] as const;

export type BillingSeatId = (typeof BILLING_SEATS)[number]["id"];
