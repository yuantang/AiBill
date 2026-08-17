import { monthKey, newId, usdToCny } from "./ledger";
import type { DailyUsd, FxQuote, Line } from "./types";

type Loose = Record<string, unknown>;

export function parseOpenAiCosts(payload: unknown, fx: FxQuote): Line | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as Loose).data;
  if (!Array.isArray(data)) return null;
  const daily = new Map<string, number>();
  for (const bucket of data) {
    if (!bucket || typeof bucket !== "object") continue;
    const b = bucket as Loose;
    const start = typeof b.start_time === "number" ? b.start_time : null;
    const date = start
      ? new Date(start * 1000).toISOString().slice(0, 10)
      : "";
    const results = Array.isArray(b.results) ? b.results : [];
    for (const item of results) {
      if (!item || typeof item !== "object") continue;
      const amount = (item as Loose).amount;
      const value =
        amount && typeof amount === "object"
          ? Number((amount as Loose).value)
          : Number(amount);
      if (!Number.isFinite(value) || !date) continue;
      daily.set(date, (daily.get(date) ?? 0) + value);
    }
  }
  const dailyUsd: DailyUsd[] = [...daily.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, usd]) => ({ date, usd }));
  const usd = dailyUsd.reduce((s, d) => s + d.usd, 0);
  if (usd <= 0) return null;
  return {
    id: newId(),
    name: "OpenAI API",
    kind: "api",
    amountUsd: Math.round(usd * 100) / 100,
    amountCny: usdToCny(usd, fx.rate),
    fxRate: fx.rate,
    fxDate: fx.date,
    source: "cost_api",
    includedInTotal: true,
    note: "From OpenAI organization/costs. Invoice, not ChatGPT Plus.",
    dailyUsd,
  };
}

/** Anthropic 的 amount 是最小货币单位（美分）的小数字符串。 */
export function anthropicAmountToUsd(amount: unknown): number {
  if (amount && typeof amount === "object") {
    const obj = amount as Loose;
    if (obj.value != null) {
      const v = Number(obj.value);
      return Number.isFinite(v) ? v : 0;
    }
    if (obj.amount != null) {
      const raw = Number(obj.amount);
      if (!Number.isFinite(raw)) return 0;
      return raw / 100;
    }
  }
  const raw = Number(amount);
  if (!Number.isFinite(raw)) return 0;
  return raw / 100;
}

export function parseAnthropicCosts(payload: unknown, fx: FxQuote): Line | null {
  if (!payload || typeof payload !== "object") return null;
  const data = (payload as Loose).data;
  if (!Array.isArray(data)) return null;
  const daily = new Map<string, number>();
  for (const bucket of data) {
    if (!bucket || typeof bucket !== "object") continue;
    const b = bucket as Loose;
    const date = typeof b.starting_at === "string" ? b.starting_at.slice(0, 10) : "";
    const results = Array.isArray(b.results) ? b.results : [];
    for (const item of results) {
      if (!item || typeof item !== "object") continue;
      const usd = anthropicAmountToUsd((item as Loose).amount);
      if (!date || usd === 0) continue;
      daily.set(date, (daily.get(date) ?? 0) + usd);
    }
  }
  const dailyUsd: DailyUsd[] = [...daily.entries()]
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, usd]) => ({ date, usd }));
  const usd = dailyUsd.reduce((s, d) => s + d.usd, 0);
  if (usd <= 0) return null;
  return {
    id: newId(),
    name: "Anthropic API",
    kind: "api",
    amountUsd: Math.round(usd * 100) / 100,
    amountCny: usdToCny(usd, fx.rate),
    fxRate: fx.rate,
    fxDate: fx.date,
    source: "cost_api",
    includedInTotal: true,
    note: `From Anthropic cost_report. Console prepaid, not a Claude subscription. ${monthKey()}.`,
    dailyUsd,
  };
}
