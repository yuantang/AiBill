import { t, type Locale } from "./i18n";
import { categoryTotals, countedAmount, formatCny, monthKey, subtotals } from "./ledger";
import type { Ledger, Line } from "./types";

export const SOURCE_LABEL: Record<Line["source"], string> = {
  hand: "Entered",
  cost_api: "Vendor invoice",
  ccusage_estimate: "ccusage estimate",
  receipt: "Card receipt",
  inbox: "Forwarded",
};

export const KIND_LABEL: Record<Line["kind"], string> = {
  subscription: "Subscription",
  api: "API usage",
  other: "Other charge",
};

export const CATEGORY_LABEL: Record<NonNullable<Line["category"]>, string> = {
  work: "Work",
  personal: "Personal",
  billable: "Billable",
};

export function kindLabel(kind: Line["kind"], locale: Locale = "en"): string {
  return t(locale, `kind.${kind}`);
}

export function categoryLabel(category: NonNullable<Line["category"]>, locale: Locale = "en"): string {
  return t(locale, `category.${category}`);
}

export function sourceLabel(source: Line["source"], locale: Locale = "en"): string {
  return t(locale, `source.${source}`);
}

export const PRESETS: Array<{
  name: string;
  kind: Line["kind"];
  amountCny: number;
  chargeDay: number;
  group: "core" | "more";
}> = [
  { name: "Claude Max", kind: "subscription", amountCny: 100, chargeDay: 1, group: "core" },
  { name: "Claude Max 200", kind: "subscription", amountCny: 200, chargeDay: 1, group: "core" },
  { name: "Claude Pro", kind: "subscription", amountCny: 20, chargeDay: 1, group: "core" },
  { name: "Cursor Pro", kind: "subscription", amountCny: 20, chargeDay: 1, group: "core" },
  { name: "Cursor Ultra", kind: "subscription", amountCny: 200, chargeDay: 1, group: "core" },
  { name: "ChatGPT Plus", kind: "subscription", amountCny: 20, chargeDay: 1, group: "core" },
  { name: "ChatGPT Pro", kind: "subscription", amountCny: 200, chargeDay: 1, group: "more" },
  { name: "Gemini", kind: "subscription", amountCny: 20, chargeDay: 1, group: "more" },
  { name: "GitHub Copilot", kind: "subscription", amountCny: 10, chargeDay: 1, group: "more" },
  { name: "Perplexity Pro", kind: "subscription", amountCny: 20, chargeDay: 1, group: "more" },
  { name: "Midjourney", kind: "subscription", amountCny: 10, chargeDay: 1, group: "more" },
  { name: "v0", kind: "subscription", amountCny: 20, chargeDay: 1, group: "more" },
  { name: "OpenRouter", kind: "api", amountCny: 20, chargeDay: 1, group: "more" },
  { name: "Groq", kind: "api", amountCny: 10, chargeDay: 1, group: "more" },
  { name: "Windsurf", kind: "subscription", amountCny: 15, chargeDay: 1, group: "more" },
];

function lineText(line: Line, now: Date, locale: Locale): string {
  const pending = countedAmount(line, now) === 0 && line.includedInTotal;
  const amount = pending ? t(locale, "generated.notCharged") : formatCny(line.amountCny, locale);
  const usd =
    line.amountUsd != null && line.fxRate != null && line.fxRate !== 1
      ? t(locale, "generated.invoiceFx", { amount: line.amountUsd, rate: line.fxRate })
      : line.amountUsd != null
        ? t(locale, "generated.invoiceUsd", { amount: line.amountUsd })
        : "";
  return `- ${line.name} ${amount} (${sourceLabel(line.source, locale)}${usd})`;
}

export function statementText(ledger: Ledger, now = new Date(), locale: Locale = "en"): string {
  const money = (n: number) => formatCny(n, locale);
  const parts = [
    t(locale, "generated.spend", { amount: money(ledger.totalCny) }),
    t(locale, "generated.month", { month: monthKey(now) }),
  ];
  if (ledger.fx && ledger.fx.rate !== 1) {
    parts.push(t(locale, "generated.converted", { date: ledger.fx.date, rate: ledger.fx.rate }));
  }
  const groups: Line["kind"][] = ["subscription", "api", "other"];
  const sums = subtotals(ledger.lines, now);
  for (const kind of groups) {
    const rows = ledger.lines.filter((line) => line.kind === kind && line.includedInTotal);
    if (rows.length === 0) continue;
    parts.push("");
    parts.push(`${kindLabel(kind, locale)} ${money(sums[kind])}`);
    for (const line of rows) parts.push(lineText(line, now, locale));
  }
  const estimates = ledger.lines.filter((line) => !line.includedInTotal);
  if (estimates.length > 0) {
    parts.push("");
    parts.push(t(locale, "generated.notInTotal"));
    for (const line of estimates) parts.push(lineText(line, now, locale));
  }
  if (ledger.window) {
    parts.push("");
    parts.push(t(locale, "generated.windowTitle"));
    parts.push(
      `- ${ledger.window.label}${ledger.window.percent != null ? t(locale, "generated.windowUsed", { n: ledger.window.percent }) : ""}${ledger.window.remaining ? t(locale, "generated.windowLeft", { left: ledger.window.remaining }) : ""}`,
    );
  }
  if (ledger.extrapolation) {
    parts.push("");
    parts.push(
      t(locale, "generated.weekPace", {
        days: ledger.extrapolation.daysUsed,
        amount: money(ledger.extrapolation.cny),
      }),
    );
  }
  if (ledger.monthProjection) {
    parts.push(t(locale, "generated.monthPace", { amount: money(ledger.monthProjection.cny) }));
  }
  const cats = categoryTotals(ledger.lines, now);
  if (cats.personal + cats.billable > 0) {
    parts.push("");
    parts.push(
      t(locale, "generated.byPurpose", {
        work: money(cats.work),
        personal: money(cats.personal),
        billable: money(cats.billable),
      }),
    );
  }
  const estimateCny = estimates.reduce((sum, line) => sum + line.amountCny, 0);
  if (estimateCny > 0) {
    const gap = Math.round((estimateCny - ledger.totalCny) * 100) / 100;
    if (gap > 1) {
      parts.push("");
      parts.push(
        t(locale, "generated.gap", {
          estimate: money(estimateCny),
          cash: money(ledger.totalCny),
          gap: money(gap),
        }),
      );
    }
  }
  return parts.join("\n");
}

export function statementHeadline(totalCny: number, month: string, locale: Locale = "en"): string {
  return t(locale, "generated.headline", { month, amount: formatCny(totalCny, locale) });
}
