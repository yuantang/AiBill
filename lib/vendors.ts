export const GMAIL_FORWARDING_URL = "https://mail.google.com/mail/u/0/#settings/fwdandpop";
export const GMAIL_FILTERS_URL = "https://mail.google.com/mail/u/0/#settings/filters";

export const BILLING_SEATS = [
  { id: "cursor", name: "Cursor", from: "stripe.com", contains: "Cursor" },
  { id: "claude", name: "Claude", from: "stripe.com", contains: "Claude" },
  { id: "chatgpt", name: "ChatGPT", from: "stripe.com", contains: "OpenAI" },
] as const;

export type BillingSeatId = (typeof BILLING_SEATS)[number]["id"];
