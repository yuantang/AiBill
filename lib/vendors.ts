export const BILLING_SEATS = [
  { id: "cursor", name: "Cursor", href: "https://cursor.com/dashboard" },
  { id: "claude", name: "Claude", href: "https://claude.ai/settings/billing" },
  { id: "chatgpt", name: "ChatGPT", href: "https://chatgpt.com/#settings" },
] as const;

export type BillingSeatId = (typeof BILLING_SEATS)[number]["id"];
