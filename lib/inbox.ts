import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { looksLikeReceipt } from "./receipts";

export function inboxDomain(): string {
  return (process.env.INBOX_DOMAIN ?? "inbox.aibill.dev").trim().toLowerCase() || "inbox.aibill.dev";
}

/** Primary host plus the inbox. sibling, so a pending apex-MX cutover still matches. */
export function inboxHosts(domain = inboxDomain()): string[] {
  const primary = domain.trim().toLowerCase();
  const hosts = new Set<string>([primary]);
  if (primary.startsWith("inbox.")) hosts.add(primary.slice("inbox.".length));
  else if (primary.includes(".")) hosts.add(`inbox.${primary}`);
  return [...hosts];
}

export function newInboxToken(): string {
  return randomBytes(9).toString("base64url").replace(/[^a-zA-Z0-9]/g, "x").toLowerCase();
}

export function inboxAddress(token: string): string {
  return `${token}@${inboxDomain()}`;
}

export function tokenFromRecipient(recipient: string, domain = inboxDomain()): string | null {
  const parts = recipient
    .split(/[,;]/)
    .map((part) => part.trim())
    .filter(Boolean);
  for (const part of parts) {
    const angle = part.match(/<([^>]+)>/);
    const addr = (angle?.[1] ?? part).trim().toLowerCase();
    const at = addr.lastIndexOf("@");
    if (at < 0) continue;
    const host = addr.slice(at + 1);
    if (!inboxHosts(domain).includes(host)) continue;
    const local = addr.slice(0, at);
    const plus = local.includes("+") ? local.slice(local.lastIndexOf("+") + 1) : local;
    const token = plus.replace(/[^a-z0-9]/g, "");
    if (token.length >= 8 && token.length <= 32) return token;
  }
  return null;
}

export type InboundMail = {
  token: string | null;
  recipient: string;
  from: string;
  subject: string;
  text: string;
  messageId: string;
};

function asString(value: unknown): string {
  if (typeof value === "string") return value;
  if (value == null) return "";
  return String(value);
}

function unwrapWebhook(body: Record<string, unknown>): Record<string, unknown> {
  const data = body.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    return { ...body, ...(data as Record<string, unknown>) };
  }
  const email = body.email;
  if (email && typeof email === "object" && !Array.isArray(email)) {
    return { ...body, ...(email as Record<string, unknown>) };
  }
  return body;
}

function collectAddresses(value: unknown, into: string[]): void {
  if (typeof value === "string") {
    into.push(value);
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) collectAddresses(item, into);
    return;
  }
  if (value && typeof value === "object") {
    const rec = value as Record<string, unknown>;
    const email = rec.email ?? rec.address ?? rec.value;
    if (typeof email === "string") into.push(email);
  }
}

function allAddresses(value: unknown): string {
  const found: string[] = [];
  collectAddresses(value, found);
  return found.join(", ");
}

export function mailFromObject(raw: Record<string, unknown>): InboundMail {
  const body = unwrapWebhook(raw);
  const recipient = allAddresses(
    body.recipient ?? body.to ?? body.To ?? body.envelope_to ?? body["envelope-to"],
  );
  const from = allAddresses(body.from ?? body.From ?? body.sender ?? body.Sender);
  const subject = asString(body.subject ?? body.Subject);
  const plain = [
    asString(body["stripped-text"]),
    asString(body["body-plain"]),
    asString(body.TextBody),
    asString(body.text),
    asString(body.body),
  ]
    .filter(Boolean)
    .join("\n\n");
  const html = asString(body["body-html"] ?? body.HtmlBody ?? body.html);
  const text = plain || html;
  const messageId = asString(
    body["Message-Id"] ?? body["Message-ID"] ?? body["message-id"] ?? body.MessageID ?? body.message_id,
  );
  return {
    recipient,
    from,
    subject,
    text: [subject, from, text].filter(Boolean).join("\n"),
    token: tokenFromRecipient(recipient),
    messageId: messageId.trim(),
  };
}

export function inboundDedupeKey(mail: InboundMail): string {
  const id = mail.messageId.replace(/^<|>$/g, "").trim().toLowerCase();
  if (id.length >= 8) return id.slice(0, 200);
  return createHash("sha256")
    .update(`${mail.token ?? ""}|${mail.from}|${mail.subject}|${mail.text.slice(0, 400)}`)
    .digest("hex");
}

export async function hydrateResendReceived(
  mail: InboundMail,
  raw: Record<string, unknown>,
): Promise<InboundMail> {
  const type = asString(raw.type);
  const data =
    raw.data && typeof raw.data === "object" && !Array.isArray(raw.data)
      ? (raw.data as Record<string, unknown>)
      : raw;
  const emailId = asString(data.email_id);
  if (type !== "email.received" || !emailId) return mail;
  const key = process.env.RESEND_API_KEY?.trim();
  if (!key) return mail;
  const res = await fetch(`https://api.resend.com/emails/receiving/${encodeURIComponent(emailId)}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  if (!res.ok) return mail;
  const full = (await res.json()) as Record<string, unknown>;
  return mailFromObject({ ...data, ...full });
}

export async function parseInboundRequest(request: Request): Promise<InboundMail> {
  const contentType = request.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await request.json()) as Record<string, unknown>;
    return hydrateResendReceived(mailFromObject(json ?? {}), json ?? {});
  }
  if (contentType.includes("form")) {
    const form = await request.formData();
    const obj: Record<string, unknown> = {};
    for (const [key, value] of form.entries()) {
      if (typeof value === "string") obj[key] = value;
    }
    return mailFromObject(obj);
  }
  const text = await request.text();
  if (!text.trim()) return mailFromObject({});
  try {
    const json = JSON.parse(text) as Record<string, unknown>;
    return hydrateResendReceived(mailFromObject(json), json);
  } catch {
    return mailFromObject({ text });
  }
}

export function inboundAuthorized(request: Request): boolean {
  const secret = process.env.INBOX_WEBHOOK_SECRET?.trim();
  if (!secret) return !process.env.VERCEL;
  const header = request.headers.get("x-inbox-secret") ?? "";
  const auth = request.headers.get("authorization") ?? "";
  const bearer = auth.toLowerCase().startsWith("bearer ") ? auth.slice(7).trim() : "";
  let query = "";
  try {
    query = new URL(request.url).searchParams.get("secret") ?? "";
  } catch {
    query = "";
  }
  return [header, bearer, query].some((candidate) => secretsEqual(candidate, secret));
}

function secretsEqual(candidate: string, secret: string): boolean {
  if (!candidate || candidate.length !== secret.length) return false;
  return timingSafeEqualString(candidate, secret);
}

function timingSafeEqualString(a: string, b: string): boolean {
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  if (left.length !== right.length) return false;
  return timingSafeEqual(left, right);
}

const SENDER_OK =
  /stripe\.com|cursor\.com|anthropic\.com|openai\.com|x\.ai|midjourney\.com|perplexity\.ai|github\.com|google\.com|groq\.com|openrouter\.ai|vercel\.com/i;

export function senderAllowed(from: string): boolean {
  return SENDER_OK.test(from);
}

export function gmailForwardConfirm(text: string): { code: string | null; link: string | null } | null {
  const blob = text.trim();
  if (
    !/forwarding-noreply@google\.com|gmail forwarding confirmation|confirmation code|转发确认|确认代码/i.test(
      blob,
    )
  ) {
    return null;
  }
  const code = blob.match(/(?:confirmation code|确认代码)[:\s#：]+([0-9]{6,12})/i)?.[1] ?? null;
  const link = blob.match(/https:\/\/mail(?:-settings)?\.google\.com\/[^\s"'<>]+/i)?.[0] ?? null;
  if (!code && !link) return { code: null, link: null };
  return { code, link };
}

/** Direct vendor mail, or a Gmail/Outlook forward that still contains the original receipt. */
export function inboundAllowed(mail: { from: string; text: string }): boolean {
  if (gmailForwardConfirm(`${mail.from}\n${mail.text}`)) return true;
  if (senderAllowed(mail.from)) return true;
  return senderAllowed(mail.text) && /receipt from|amount paid|invoice/i.test(mail.text);
}

export type InboundKind = "confirm" | "receipt" | "ignore";

export function classifyInbound(mail: { from: string; subject?: string; text: string }): InboundKind {
  const blob = `${mail.from}\n${mail.subject ?? ""}\n${mail.text}`;
  if (gmailForwardConfirm(blob)) return "confirm";
  if (!inboundAllowed(mail)) return "ignore";
  if (!looksLikeReceipt(mail.text)) return "ignore";
  return "receipt";
}

export type InboxStatus = "unverified" | "confirm_received" | "filter_ready" | "first_receipt";

export function inboxStatus(row: {
  confirmReceivedAt?: Date | string | null;
  forwardingAckedAt?: Date | string | null;
  lastReceiptAt?: Date | string | null;
}): InboxStatus {
  if (row.lastReceiptAt) return "first_receipt";
  if (row.forwardingAckedAt) return "filter_ready";
  if (row.confirmReceivedAt) return "confirm_received";
  return "unverified";
}

export function gmailFilterQuery(): string {
  return "from:(stripe.com OR invoice.stripe.com OR cursor.com OR anthropic.com OR openai.com OR mail.anthropic.com OR x.ai OR midjourney.com OR perplexity.ai) (subject:(receipt OR invoice OR payment OR charged) OR \"Amount paid\")";
}

