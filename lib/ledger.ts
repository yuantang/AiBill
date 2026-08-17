import { LOCALE_META, parseLocale, type Locale } from "./i18n/locales";
import type {
  BudgetStatus,
  DailyUsd,
  FxQuote,
  Ledger,
  Line,
  QuotaWindow,
  UpcomingCharge,
} from "./types";

const TZ = "America/Los_Angeles";

export function formatCny(n: number, locale: Locale | string = "en"): string {
  const rounded = Math.round(n * 100) / 100;
  const intl = LOCALE_META[parseLocale(locale)].intl;
  return rounded.toLocaleString(intl, {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: rounded % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  });
}

export function usdToCny(usd: number, rate: number): number {
  return Math.round(usd * rate * 100) / 100;
}

export function prevMonthKey(now = new Date(), timeZone = TZ): string {
  const key = monthKey(now, timeZone);
  const [year, month] = key.split("-").map(Number);
  if (month === 1) return `${year - 1}-12`;
  return `${year}-${String(month - 1).padStart(2, "0")}`;
}

export function monthKey(now = new Date(), timeZone = TZ): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
  }).formatToParts(now);
  const year = parts.find((p) => p.type === "year")?.value;
  const month = parts.find((p) => p.type === "month")?.value;
  return `${year}-${month}`;
}

export function dayKey(now = new Date(), timeZone = TZ): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function dayOfMonth(now = new Date(), timeZone = TZ): number {
  const day = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    day: "2-digit",
  }).format(now);
  return Number(day);
}

/** 从明天到本周日（上海）还剩几天。周日当天为 0。 */
export function daysLeftInWeek(now = new Date(), timeZone = TZ): number {
  const weekday = new Intl.DateTimeFormat("en-US", {
    timeZone,
    weekday: "short",
  }).format(now);
  const map: Record<string, number> = {
    Sun: 0,
    Mon: 6,
    Tue: 5,
    Wed: 4,
    Thu: 3,
    Fri: 2,
    Sat: 1,
  };
  return map[weekday] ?? 0;
}

export function subscriptionDueThisMonth(
  chargeDay: number | undefined,
  now = new Date(),
  cycleStartDay = 1,
): boolean {
  if (chargeDay == null) return true;
  const today = dayOfMonth(now);
  const day = Math.min(chargeDay, daysInMonth(now));
  const start = Math.min(28, Math.max(1, cycleStartDay));
  if (start <= 1) return today >= day;
  if (today >= start) return day >= start && day <= today;
  return day >= start || day <= today;
}

export function totalCny(lines: Line[], now = new Date(), cycleStartDay = 1): number {
  return Math.round(
    lines.reduce((sum, line) => {
      if (!line.includedInTotal) return sum;
      if (line.kind === "subscription" && !subscriptionDueThisMonth(line.chargeDay, now, cycleStartDay)) {
        return sum;
      }
      return sum + line.amountCny;
    }, 0) * 100,
  ) / 100;
}

export function lastThreeDayApiUsd(lines: Line[], now = new Date()): DailyUsd[] {
  const byDate = new Map<string, number>();
  for (const line of lines) {
    if (line.kind !== "api" || !line.includedInTotal || !line.dailyUsd) continue;
    for (const d of line.dailyUsd) {
      byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.usd);
    }
  }
  const today = dayKey(now);
  return [...byDate.entries()]
    .filter(([date]) => date <= today)
    .sort(([a], [b]) => (a < b ? 1 : -1))
    .slice(0, 3)
    .map(([date, usd]) => ({ date, usd }))
    .reverse();
}

function projectApiCny(
  lines: Line[],
  fx: FxQuote | null,
  daysLeft: number,
  now = new Date(),
): { cny: number; daysUsed: number; daysLeft: number } | null {
  if (daysLeft <= 0) return null;
  const recent = lastThreeDayApiUsd(lines, now);
  if (recent.length === 0) return null;
  const rate = fx?.rate;
  if (rate == null) return null;
  const avgUsd = recent.reduce((s, d) => s + d.usd, 0) / recent.length;
  return {
    cny: usdToCny(avgUsd * daysLeft, rate),
    daysUsed: recent.length,
    daysLeft,
  };
}

export function extrapolateApiCny(
  lines: Line[],
  fx: FxQuote | null,
  now = new Date(),
): Ledger["extrapolation"] {
  return projectApiCny(lines, fx, daysLeftInWeek(now), now);
}

export function daysInMonth(now = new Date(), timeZone = TZ): number {
  const key = monthKey(now, timeZone);
  const [year, month] = key.split("-").map(Number);
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

export function daysLeftInMonth(now = new Date(), timeZone = TZ): number {
  const remaining = daysInMonth(now, timeZone) - dayOfMonth(now, timeZone);
  return remaining > 0 ? remaining : 0;
}

export function projectMonthApiCny(
  lines: Line[],
  fx: FxQuote | null,
  now = new Date(),
): Ledger["monthProjection"] {
  return projectApiCny(lines, fx, daysLeftInMonth(now), now);
}

export function upcomingCharges(lines: Line[], now = new Date()): UpcomingCharge[] {
  const today = dayOfMonth(now);
  const last = daysInMonth(now);
  return lines
    .filter(
      (line) =>
        line.includedInTotal && line.kind === "subscription" && line.chargeDay != null,
    )
    .map((line) => {
      const chargeDay = Math.min(line.chargeDay as number, last);
      const due = today >= chargeDay;
      return {
        name: line.name,
        amountCny: line.amountCny,
        chargeDay,
        daysUntil: due ? 0 : chargeDay - today,
        due,
      };
    })
    .sort((a, b) => a.chargeDay - b.chargeDay);
}

export function dailyApiCny(lines: Line[], fx: FxQuote | null): DailyUsd[] {
  const rate = fx?.rate;
  if (rate == null) return [];
  const byDate = new Map<string, number>();
  for (const line of lines) {
    if (line.kind !== "api" || !line.includedInTotal || !line.dailyUsd) continue;
    for (const d of line.dailyUsd) {
      byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.usd);
    }
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, usd]) => ({ date, usd: usdToCny(usd, rate) }));
}

export function budgetStatus(
  spentCny: number,
  budgetCny: number | null | undefined,
  weekExtraCny = 0,
  dailyApiCnyAvg = 0,
): BudgetStatus | null {
  if (budgetCny == null || !Number.isFinite(budgetCny) || budgetCny <= 0) return null;
  const remainingCny = Math.round((budgetCny - spentCny) * 100) / 100;
  let daysToEmpty: number | null = null;
  if (remainingCny > 0 && dailyApiCnyAvg > 0) {
    daysToEmpty = Math.max(1, Math.round(remainingCny / dailyApiCnyAvg));
  } else if (remainingCny <= 0) {
    daysToEmpty = 0;
  }
  return {
    budgetCny,
    spentCny,
    remainingCny,
    ratio: budgetCny === 0 ? 0 : spentCny / budgetCny,
    over: spentCny > budgetCny,
    weekOver: spentCny + weekExtraCny > budgetCny,
    daysToEmpty,
  };
}

export function categoryTotals(lines: Line[], now = new Date()) {
  const groups = { work: 0, personal: 0, billable: 0 };
  for (const line of lines) {
    const bucket = line.category ?? "work";
    groups[bucket] += countedAmount(line, now);
  }
  return {
    work: Math.round(groups.work * 100) / 100,
    personal: Math.round(groups.personal * 100) / 100,
    billable: Math.round(groups.billable * 100) / 100,
  };
}

export function unusualApiDays(lines: Line[], now = new Date()): DailyUsd[] {
  const series = lastThreeDayApiUsd(lines, now);
  // lastThreeDay is only 3 days — use all daily instead
  const byDate = new Map<string, number>();
  for (const line of lines) {
    if (line.kind !== "api" || !line.includedInTotal || !line.dailyUsd) continue;
    for (const d of line.dailyUsd) {
      if (d.date > dayKey(now)) continue;
      byDate.set(d.date, (byDate.get(d.date) ?? 0) + d.usd);
    }
  }
  const days = [...byDate.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, usd]) => ({ date, usd }));
  if (days.length < 4) return [];
  const values = days.map((d) => d.usd).sort((a, b) => a - b);
  const median = values[Math.floor(values.length / 2)] ?? 0;
  if (median <= 0) return [];
  return days.filter((d) => d.usd >= median * 2.5 && d.usd >= 5);
}

export function avgDailyApiCny(lines: Line[], fx: FxQuote | null, now = new Date()): number {
  const recent = lastThreeDayApiUsd(lines, now);
  if (recent.length === 0 || fx?.rate == null) return 0;
  const avgUsd = recent.reduce((s, d) => s + d.usd, 0) / recent.length;
  return usdToCny(avgUsd, fx.rate);
}

export function yearKey(now = new Date(), timeZone = TZ): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric" }).format(now);
}

export function yearRollup(
  snapshots: Array<{ month: string; totalCny: number; subscriptionCny: number; apiCny: number; otherCny: number }>,
  current: { month: string; totalCny: number; subscriptionCny: number; apiCny: number; otherCny: number },
  year: string,
) {
  const byMonth = new Map<string, typeof current>();
  for (const row of snapshots) {
    if (row.month.startsWith(year)) byMonth.set(row.month, row);
  }
  if (current.month.startsWith(year)) byMonth.set(current.month, current);
  const months = [...byMonth.values()].sort((a, b) => (a.month < b.month ? -1 : 1));
  const totalCny = Math.round(months.reduce((s, m) => s + m.totalCny, 0) * 100) / 100;
  const apiCny = Math.round(months.reduce((s, m) => s + m.apiCny, 0) * 100) / 100;
  const subscriptionCny = Math.round(months.reduce((s, m) => s + m.subscriptionCny, 0) * 100) / 100;
  const pace = months.length > 0 ? totalCny / months.length : 0;
  return {
    year,
    months,
    totalCny,
    apiCny,
    subscriptionCny,
    averageCny: Math.round(pace * 100) / 100,
    projectedYearCny: Math.round(pace * 12 * 100) / 100,
  };
}

export function countedAmount(line: Line, now = new Date(), cycleStartDay = 1): number {
  if (!line.includedInTotal) return 0;
  if (line.kind === "subscription" && !subscriptionDueThisMonth(line.chargeDay, now, cycleStartDay)) {
    return 0;
  }
  return line.amountCny;
}

export function subtotals(lines: Line[], now = new Date()) {
  const groups = {
    subscription: 0,
    api: 0,
    other: 0,
  };
  for (const line of lines) {
    groups[line.kind] += countedAmount(line, now);
  }
  return {
    subscription: Math.round(groups.subscription * 100) / 100,
    api: Math.round(groups.api * 100) / 100,
    other: Math.round(groups.other * 100) / 100,
  };
}

export function buildLedger(
  lines: Line[],
  window: QuotaWindow | null,
  fx: FxQuote | null,
  now = new Date(),
): Ledger {
  return {
    totalCny: totalCny(lines, now),
    lines,
    window,
    fx,
    extrapolation: extrapolateApiCny(lines, fx, now),
    monthProjection: projectMonthApiCny(lines, fx, now),
  };
}

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
