import { monthKey, newId } from "./ledger";
import { PRESETS } from "./statement";
import type { Line, LineKind, LineSource } from "./types";

export type MerchantId =
  | "anthropic"
  | "openai"
  | "cursor"
  | "windsurf"
  | "copilot"
  | "google"
  | "midjourney"
  | "perplexity"
  | "groq"
  | "openrouter"
  | "xai"
  | "v0";

type Merchant = {
  id: MerchantId;
  name: string;
  kind: LineKind;
  pattern: RegExp;
};

export const MERCHANTS: Merchant[] = [
  { id: "cursor", name: "Cursor", kind: "subscription", pattern: /cursor/i },
  { id: "anthropic", name: "Claude", kind: "subscription", pattern: /anthropic|claude\.ai|\bclaude\b/i },
  { id: "openai", name: "ChatGPT", kind: "subscription", pattern: /openai|chatgpt|\bchat gpt\b/i },
  { id: "windsurf", name: "Windsurf", kind: "subscription", pattern: /windsurf|codeium/i },
  { id: "copilot", name: "GitHub Copilot", kind: "subscription", pattern: /copilot|github\s*copilot/i },
  { id: "google", name: "Gemini", kind: "subscription", pattern: /gemini|google\s*one\s*ai|google\s*ai/i },
  { id: "midjourney", name: "Midjourney", kind: "subscription", pattern: /midjourney/i },
  { id: "perplexity", name: "Perplexity", kind: "subscription", pattern: /perplexity/i },
  { id: "groq", name: "Groq", kind: "api", pattern: /\bgroq\b/i },
  { id: "openrouter", name: "OpenRouter", kind: "api", pattern: /openrouter/i },
  { id: "xai", name: "xAI", kind: "subscription", pattern: /\bxai\b|\bx\.ai\b|\bgrok\b/i },
  { id: "v0", name: "v0", kind: "subscription", pattern: /\bv0\b|vercel/i },
];

const MONEY =
  /(?:usd|us\$|\$)\s*([0-9]{1,5}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)|([0-9]{1,5}(?:,[0-9]{3})*(?:\.[0-9]{1,2})?)\s*(?:usd|us\$)/gi;

const ISO_DATE = /(20\d{2})-(\d{2})-(\d{2})/;
const US_DATE = /(\d{1,2})[/-](\d{1,2})[/-](20\d{2})/;
const TEXT_DATE =
  /(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{1,2}),?\s+(20\d{2})/i;

const MONTHS: Record<string, string> = {
  january: "01",
  february: "02",
  march: "03",
  april: "04",
  may: "05",
  june: "06",
  july: "07",
  august: "08",
  september: "09",
  october: "10",
  november: "11",
  december: "12",
};

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

function parseAmount(raw: string): number | null {
  const n = Number(raw.replaceAll(",", ""));
  if (!Number.isFinite(n) || n <= 0 || n > 20000) return null;
  return money(n);
}

export function parseReceiptDate(
  text: string,
  now = new Date(),
): { iso: string; day: number; explicit: boolean } {
  const iso = text.match(ISO_DATE);
  if (iso) return { iso: `${iso[1]}-${iso[2]}-${iso[3]}`, day: Number(iso[3]), explicit: true };
  const named = text.match(TEXT_DATE);
  if (named) {
    const month = MONTHS[named[1].toLowerCase()];
    const day = String(named[2]).padStart(2, "0");
    return { iso: `${named[3]}-${month}-${day}`, day: Number(named[2]), explicit: true };
  }
  const us = text.match(US_DATE);
  if (us) {
    const month = String(us[1]).padStart(2, "0");
    const day = String(us[2]).padStart(2, "0");
    return { iso: `${us[3]}-${month}-${day}`, day: Number(us[2]), explicit: true };
  }
  return { iso: monthKey(now) + "-01", day: 1, explicit: false };
}

function inCurrentMonth(when: { iso: string; explicit: boolean }, now: Date, dateText = ""): boolean {
  if (!when.explicit && !dateText) return true;
  return when.iso.startsWith(monthKey(now));
}

export function merchantOf(text: string): Merchant | null {
  for (const merchant of MERCHANTS) {
    if (merchant.pattern.test(text)) return merchant;
  }
  return null;
}

function displayName(merchant: Merchant, amount: number): string {
  const hits = PRESETS.filter((preset) => merchant.pattern.test(preset.name) && preset.kind === merchant.kind);
  const exact = hits.find((preset) => preset.amountCny === amount);
  if (exact) return exact.name;
  if (hits.length === 1) return hits[0].name;
  return merchant.name;
}

function amountsIn(text: string): number[] {
  const found: number[] = [];
  for (const match of text.matchAll(MONEY)) {
    const parsed = parseAmount(match[1] ?? match[2] ?? "");
    if (parsed != null) found.push(parsed);
  }
  return found;
}

function splitBlocks(text: string): string[] {
  const chunks = text
    .split(/\n{2,}|(?=^From:)|(?=^Subject:)|(?=Receipt from)|(?=Amount paid)/im)
    .map((part) => part.trim())
    .filter((part) => part.length > 8);
  return chunks.length > 0 ? chunks : [text];
}

function looksLikeCsv(text: string): boolean {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return false;
  const header = lines[0].toLowerCase();
  return header.includes(",") && /(desc|merchant|name|vendor|memo|payee)/.test(header);
}

function parseCsv(text: string, now = new Date()): Line[] {
  const rows = text.trim().split(/\r?\n/).filter(Boolean);
  const header = rows[0].split(",").map((cell) => cell.trim().toLowerCase().replace(/^"|"$/g, ""));
  const idx = {
    date: header.findIndex((h) => /date|posted|time/.test(h)),
    desc: header.findIndex((h) => /desc|merchant|name|vendor|memo|payee|product/.test(h)),
    amount: header.findIndex((h) => /amount|usd|total|cost|price|debit/.test(h)),
  };
  if (idx.desc < 0 || idx.amount < 0) return [];
  const lines: Line[] = [];
  for (const row of rows.slice(1)) {
    const cells = row.split(",").map((cell) => cell.trim().replace(/^"|"$/g, ""));
    const desc = cells[idx.desc] ?? "";
    const merchant = merchantOf(desc);
    const amount = parseAmount((cells[idx.amount] ?? "").replace(/[^0-9.]/g, ""));
    if (!merchant || amount == null) continue;
    const dateText = idx.date >= 0 ? cells[idx.date] ?? "" : "";
    const when = parseReceiptDate(dateText || now.toISOString().slice(0, 10), now);
    if (when && !inCurrentMonth(when, now, dateText)) continue;
    lines.push(toLine(merchant, amount, when?.day ?? 1));
  }
  return dedupe(lines);
}

function toLine(merchant: Merchant, amount: number, chargeDay: number, source: LineSource = "receipt"): Line {
  const name = displayName(merchant, amount);
  const kind = /api|credits|usage|invoice/i.test(name) || merchant.kind === "api" ? merchant.kind : "subscription";
  return {
    id: newId(),
    name,
    kind,
    amountCny: amount,
    amountUsd: amount,
    fxRate: 1,
    source,
    includedInTotal: true,
    chargeDay: kind === "subscription" ? chargeDay : undefined,
    category: "work",
    note:
      source === "inbox"
        ? `Forwarded to your AI Bill inbox. ${name} ${amount}.`
        : `From a card receipt / statement. ${name} ${amount}.`,
  };
}

function fromBlock(block: string, now: Date): Line | null {
  const merchant = merchantOf(block);
  if (!merchant) return null;
  const paid = block.match(/amount paid[^$0-9]{0,12}(?:usd|us\$|\$)?\s*([0-9,.]+)/i);
  const total = block.match(/total[^$0-9]{0,12}(?:usd|us\$|\$)?\s*([0-9,.]+)/i);
  const explicit = paid?.[1] ?? total?.[1];
  const amount = explicit ? parseAmount(explicit) : amountsIn(block).sort((a, b) => b - a)[0] ?? null;
  if (amount == null) return null;
  const when = parseReceiptDate(block, now);
  if (!inCurrentMonth(when, now)) return null;
  return toLine(merchant, amount, when.day);
}

function fromPlain(text: string, now: Date): Line[] {
  const lines: Line[] = [];
  for (const block of splitBlocks(text)) {
    const hit = fromBlock(block, now);
    if (hit) lines.push(hit);
  }
  if (lines.length === 0) {
    const merchant = merchantOf(text);
    const amount = amountsIn(text).sort((a, b) => b - a)[0];
    if (merchant && amount != null) {
      const when = parseReceiptDate(text, now);
      if (inCurrentMonth(when, now)) lines.push(toLine(merchant, amount, when.day));
    }
  }
  return dedupe(lines);
}

function dedupe(lines: Line[]): Line[] {
  const seen = new Set<string>();
  const out: Line[] = [];
  for (const line of lines) {
    const key = `${line.name}|${line.amountCny}|${line.chargeDay ?? ""}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(line);
  }
  return out;
}

export function looksLikeReceipt(text: string): boolean {
  return /amount paid|date paid|receipt from|you paid|you were charged|invoice|payment received|charged \$/i.test(
    text,
  );
}

export function parseReceipts(text: string, now = new Date(), source: LineSource = "receipt"): Line[] {
  const trimmed = text.replace(/^\uFEFF/, "").trim();
  if (!trimmed) return [];
  const lines = looksLikeCsv(trimmed) ? parseCsv(trimmed, now) : fromPlain(trimmed, now);
  return lines.map((line) =>
    source === line.source
      ? line
      : {
          ...line,
          source,
          note:
            source === "inbox"
              ? `Forwarded to your AI Bill inbox. ${line.name} ${line.amountCny}.`
              : line.note,
        },
  );
}
