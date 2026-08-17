import { t, type Locale } from "./i18n";
import {
  countedAmount,
  daysInMonth,
  formatCny,
  monthKey,
  projectMonthApiCny,
  subscriptionDueThisMonth,
  totalCny,
} from "./ledger";
import type { FxQuote, Line } from "./types";

export type VendorFamily =
  | "anthropic"
  | "openai"
  | "google"
  | "cursor"
  | "windsurf"
  | "copilot"
  | "midjourney"
  | "perplexity"
  | "groq"
  | "openrouter"
  | "xai"
  | "other";

export type OverlapKind = "seat_and_api" | "duplicate_ides" | "duplicate_seats";

export type StackOverlap = {
  id: string;
  family: VendorFamily;
  kind: OverlapKind;
  title: string;
  body: string;
  amountCny: number;
  names: string[];
};

export type NextCardBill = {
  countedCny: number;
  remainingSubsCny: number;
  remainingApiCny: number;
  expectedMonthEndCny: number;
  committedMonthlyCny: number;
  variableSoFarCny: number;
  projectedMonthApiCny: number;
  annualRunRateCny: number;
  remainingCharges: Array<{ name: string; amountCny: number; chargeDay: number }>;
};

export type CancelImpact = {
  droppedIds: string[];
  savedCommittedCny: number;
  newCommittedCny: number;
  newThisMonthCny: number;
  newExpectedMonthEndCny: number;
};

const FAMILY_RULES: Array<{ family: Exclude<VendorFamily, "other">; pattern: RegExp }> = [
  { family: "anthropic", pattern: /claude|anthropic/i },
  { family: "openai", pattern: /chatgpt|openai|\bgpt\b|codex/i },
  { family: "google", pattern: /gemini|google\s*ai/i },
  { family: "cursor", pattern: /cursor/i },
  { family: "windsurf", pattern: /windsurf|codeium/i },
  { family: "copilot", pattern: /copilot/i },
  { family: "midjourney", pattern: /midjourney/i },
  { family: "perplexity", pattern: /perplexity/i },
  { family: "groq", pattern: /groq/i },
  { family: "openrouter", pattern: /openrouter/i },
  { family: "xai", pattern: /grok|\bxai\b/i },
];

const IDE_FAMILIES: VendorFamily[] = ["cursor", "windsurf", "copilot"];

function money(n: number): number {
  return Math.round(n * 100) / 100;
}

export function familyOf(name: string): VendorFamily {
  for (const rule of FAMILY_RULES) {
    if (rule.pattern.test(name)) return rule.family;
  }
  return "other";
}

export function familyLabel(family: VendorFamily, locale: Locale = "en"): string {
  return t(locale, `family.${family}`);
}

export function cashLines(lines: Line[]): Line[] {
  return lines.filter((line) => line.includedInTotal);
}

/** Full stack of plans, even if this month’s charge day has not hit yet. */
export function committedMonthly(lines: Line[]): number {
  return money(
    cashLines(lines)
      .filter((line) => line.kind === "subscription")
      .reduce((sum, line) => sum + line.amountCny, 0),
  );
}

export function variableSoFar(lines: Line[], now = new Date()): number {
  return money(
    cashLines(lines)
      .filter((line) => line.kind !== "subscription")
      .reduce((sum, line) => sum + line.amountCny, 0),
  );
}

export function remainingSubscriptions(lines: Line[], now = new Date()) {
  return cashLines(lines)
    .filter(
      (line) =>
        line.kind === "subscription" &&
        line.chargeDay != null &&
        !subscriptionDueThisMonth(line.chargeDay, now),
    )
    .map((line) => ({
      name: line.name,
      amountCny: line.amountCny,
      chargeDay: Math.min(line.chargeDay as number, daysInMonth(now)),
    }))
    .sort((a, b) => a.chargeDay - b.chargeDay);
}

export function nextCardBill(lines: Line[], fx: FxQuote | null, now = new Date()): NextCardBill {
  const countedCny = totalCny(lines, now);
  const remaining = remainingSubscriptions(lines, now);
  const remainingSubsCny = money(remaining.reduce((sum, row) => sum + row.amountCny, 0));
  const remainingApiCny = projectMonthApiCny(lines, fx, now)?.cny ?? 0;
  const variableSoFarCny = variableSoFar(lines, now);
  const projectedMonthApiCny = money(variableSoFarCny + remainingApiCny);
  const committedMonthlyCny = committedMonthly(lines);
  return {
    countedCny,
    remainingSubsCny,
    remainingApiCny,
    expectedMonthEndCny: money(countedCny + remainingSubsCny + remainingApiCny),
    committedMonthlyCny,
    variableSoFarCny,
    projectedMonthApiCny,
    annualRunRateCny: money(committedMonthlyCny * 12 + projectedMonthApiCny * 12),
    remainingCharges: remaining,
  };
}

export function cancelImpact(
  lines: Line[],
  droppedIds: string[],
  fx: FxQuote | null,
  now = new Date(),
): CancelImpact {
  const dropped = new Set(droppedIds);
  const withoutDropped = lines.filter((line) => !dropped.has(line.id));
  const thisMonth = lines.filter((line) => {
    if (!dropped.has(line.id)) return true;
    return (
      line.includedInTotal &&
      line.kind === "subscription" &&
      subscriptionDueThisMonth(line.chargeDay, now)
    );
  });
  const forecast = nextCardBill(thisMonth, fx, now);
  return {
    droppedIds,
    savedCommittedCny: money(committedMonthly(lines) - committedMonthly(withoutDropped)),
    newCommittedCny: committedMonthly(withoutDropped),
    newThisMonthCny: forecast.countedCny,
    newExpectedMonthEndCny: forecast.expectedMonthEndCny,
  };
}

export function findOverlaps(lines: Line[], locale: Locale = "en"): StackOverlap[] {
  const cash = cashLines(lines);
  const overlaps: StackOverlap[] = [];
  const byFamily = new Map<VendorFamily, Line[]>();
  for (const line of cash) {
    const family = familyOf(line.name);
    if (family === "other") continue;
    const bucket = byFamily.get(family) ?? [];
    bucket.push(line);
    byFamily.set(family, bucket);
  }

  for (const [family, rows] of byFamily) {
    const seats = rows.filter((line) => line.kind === "subscription");
    const apis = rows.filter((line) => line.kind === "api");
    if (seats.length > 0 && apis.length > 0) {
      const amountCny = money([...seats, ...apis].reduce((sum, line) => sum + line.amountCny, 0));
      const seatNames = seats.map((line) => line.name).join(", ");
      const apiNames = apis.map((line) => line.name).join(", ");
      overlaps.push({
        id: `seat-api-${family}`,
        family,
        kind: "seat_and_api",
        title: t(locale, "generated.seatApiTitle", { family: familyLabel(family, locale) }),
        body: t(locale, "generated.seatApiBody", {
          seats: seatNames,
          seatAmount: formatCny(money(seats.reduce((s, l) => s + l.amountCny, 0)), locale),
          apis: apiNames,
          apiAmount: formatCny(money(apis.reduce((s, l) => s + l.amountCny, 0)), locale),
        }),
        amountCny,
        names: [...seats, ...apis].map((line) => line.name),
      });
    }
    if (seats.length > 1) {
      overlaps.push({
        id: `dup-seats-${family}`,
        family,
        kind: "duplicate_seats",
        title: t(locale, "generated.dupSeatsTitle", { family: familyLabel(family, locale) }),
        body: t(locale, "generated.dupSeatsBody", {
          list: seats.map((line) => `${line.name} ${formatCny(line.amountCny, locale)}`).join(" · "),
        }),
        amountCny: money(seats.reduce((sum, line) => sum + line.amountCny, 0)),
        names: seats.map((line) => line.name),
      });
    }
  }

  const ides = cash.filter(
    (line) => line.kind === "subscription" && IDE_FAMILIES.includes(familyOf(line.name)),
  );
  const ideFamilies = new Set(ides.map((line) => familyOf(line.name)));
  if (ideFamilies.size >= 2) {
    overlaps.push({
      id: "duplicate-ides",
      family: "cursor",
      kind: "duplicate_ides",
      title: t(locale, "generated.dupIdesTitle", { n: ideFamilies.size }),
      body: t(locale, "generated.dupIdesBody", {
        list: ides.map((line) => `${line.name} ${formatCny(line.amountCny, locale)}`).join(", "),
      }),
      amountCny: money(ides.reduce((sum, line) => sum + line.amountCny, 0)),
      names: ides.map((line) => line.name),
    });
  }

  return overlaps;
}

export function familyMix(lines: Line[], locale: Locale = "en") {
  const groups = new Map<VendorFamily, { family: VendorFamily; label: string; amountCny: number; count: number }>();
  for (const line of cashLines(lines)) {
    const family = familyOf(line.name);
    const current = groups.get(family) ?? { family, label: familyLabel(family, locale), amountCny: 0, count: 0 };
    current.amountCny = money(current.amountCny + line.amountCny);
    current.count += 1;
    groups.set(family, current);
  }
  return [...groups.values()].sort((a, b) => b.amountCny - a.amountCny);
}

function icsText(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/;/g, "\\;").replace(/,/g, "\\,").replace(/\r?\n/g, "\\n");
}

function nextCalendarDay(year: number, month: number, day: number): string {
  const stamp = new Date(Date.UTC(year, month - 1, day + 1));
  const y = stamp.getUTCFullYear();
  const m = String(stamp.getUTCMonth() + 1).padStart(2, "0");
  const d = String(stamp.getUTCDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

export function icsCalendar(lines: Line[], now = new Date(), locale: Locale = "en"): string {
  const month = monthKey(now);
  const [year, mo] = month.split("-").map(Number);
  const last = daysInMonth(now);
  const generated = now.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
  const events = cashLines(lines)
    .filter((line) => line.kind === "subscription" && line.chargeDay != null)
    .map((line) => {
      const dayNum = Math.min(line.chargeDay as number, last);
      const day = String(dayNum).padStart(2, "0");
      const ymd = `${year}${String(mo).padStart(2, "0")}${day}`;
      const uid = `${line.id}@aibill`;
      return [
        "BEGIN:VEVENT",
        `UID:${uid}`,
        `DTSTAMP:${generated}`,
        `DTSTART;VALUE=DATE:${ymd}`,
        `DTEND;VALUE=DATE:${nextCalendarDay(year, mo, dayNum)}`,
        `SUMMARY:${icsText(t(locale, "generated.icsSummary", { name: line.name, amount: formatCny(line.amountCny, locale) }))}`,
        `DESCRIPTION:${icsText(t(locale, "generated.icsDesc", { name: line.name }))}`,
        "END:VEVENT",
      ].join("\r\n");
    });
  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//AI Bill//EN",
    "CALSCALE:GREGORIAN",
    ...events,
    "END:VCALENDAR",
  ].join("\r\n");
}

export function taxCsv(lines: Line[], now = new Date(), locale: Locale = "en"): string {
  const month = monthKey(now);
  const header = [
    t(locale, "generated.csvMonth"),
    t(locale, "generated.csvVendor"),
    t(locale, "generated.csvType"),
    t(locale, "generated.csvPurpose"),
    t(locale, "generated.csvCharged"),
    t(locale, "generated.csvAmount"),
    t(locale, "generated.csvTax"),
    t(locale, "generated.csvSource"),
    t(locale, "generated.csvNote"),
  ];
  const treatment: Record<NonNullable<Line["category"]>, string> = {
    work: t(locale, "generated.taxBusiness"),
    personal: t(locale, "generated.taxPersonal"),
    billable: t(locale, "generated.taxBillable"),
  };
  const rows = cashLines(lines).map((line) => {
    const counted = countedAmount(line, now);
    const charged = counted > 0;
    return [
      month,
      csvCell(line.name),
      line.kind,
      line.category ?? "work",
      charged ? t(locale, "generated.chargedYes") : t(locale, "generated.chargedNotYet"),
      String(counted),
      charged ? treatment[line.category ?? "work"] : t(locale, "generated.taxNotYet"),
      line.source,
      csvCell(line.note ?? ""),
    ].join(",");
  });
  return [header.join(","), ...rows].join("\n");
}

export function clientInvoiceText(lines: Line[], now = new Date(), locale: Locale = "en"): string {
  const billable = cashLines(lines).filter(
    (line) => line.category === "billable" && countedAmount(line, now) > 0,
  );
  const total = money(billable.reduce((sum, line) => sum + countedAmount(line, now), 0));
  const parts = [
    t(locale, "generated.invoiceTitle", { month: monthKey(now) }),
    t(locale, "generated.invoiceTotal", { amount: formatCny(total, locale) }),
    "",
  ];
  if (billable.length === 0) {
    parts.push(t(locale, "generated.invoiceEmpty"));
    return parts.join("\n");
  }
  for (const line of billable) {
    parts.push(`- ${line.name} ${formatCny(countedAmount(line, now), locale)}${line.note ? ` — ${line.note}` : ""}`);
  }
  parts.push("");
  parts.push(t(locale, "generated.invoiceFoot"));
  return parts.join("\n");
}

function lineReport(line: Line, now: Date, locale: Locale): string {
  const counted = countedAmount(line, now);
  if (counted > 0) return t(locale, "generated.reportLine", { name: line.name, amount: formatCny(counted, locale) });
  return t(locale, "generated.reportNotYet", { name: line.name, amount: formatCny(line.amountCny, locale) });
}

export function expenseReportText(lines: Line[], now = new Date(), locale: Locale = "en"): string {
  const cash = cashLines(lines);
  const work = cash.filter((line) => (line.category ?? "work") === "work");
  const personal = cash.filter((line) => line.category === "personal");
  const billable = cash.filter((line) => line.category === "billable");
  const sum = (rows: Line[]) => money(rows.reduce((s, line) => s + countedAmount(line, now), 0));
  const parts = [
    t(locale, "generated.reportTitle", { month: monthKey(now) }),
    t(locale, "generated.reportCounted", { amount: formatCny(totalCny(lines, now), locale) }),
    "",
    t(locale, "generated.reportWork", { amount: formatCny(sum(work), locale) }),
    ...work.map((line) => lineReport(line, now, locale)),
    "",
    t(locale, "generated.reportPersonal", { amount: formatCny(sum(personal), locale) }),
    ...(personal.length ? personal.map((line) => lineReport(line, now, locale)) : [t(locale, "generated.reportDash")]),
    "",
    t(locale, "generated.reportBillable", { amount: formatCny(sum(billable), locale) }),
    ...(billable.length ? billable.map((line) => lineReport(line, now, locale)) : [t(locale, "generated.reportDash")]),
    "",
    t(locale, "generated.reportFoot"),
  ];
  return parts.join("\n");
}

function csvCell(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replaceAll('"', '""')}"`;
  return value;
}
