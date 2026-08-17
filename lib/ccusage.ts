import type { Line, QuotaWindow } from "./types";
import { monthKey, newId, usdToCny } from "./ledger";
import type { FxQuote } from "./types";

type Loose = Record<string, unknown>;

function asNum(v: unknown): number {
  return typeof v === "number" && Number.isFinite(v) ? v : 0;
}

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function normalizeMonth(raw: string): string {
  const digits = raw.replace(/[^\d]/g, "");
  if (digits.length === 6) return `${digits.slice(0, 4)}-${digits.slice(4)}`;
  if (/^\d{4}-\d{2}$/.test(raw)) return raw;
  return raw;
}

function rowsFrom(payload: Loose, keys: string[]): Loose[] {
  for (const key of keys) {
    const v = payload[key];
    if (Array.isArray(v)) return v.filter((x): x is Loose => Boolean(x) && typeof x === "object");
  }
  return [];
}

function costOf(row: Loose): number {
  return asNum(row.totalCost) || asNum(row.costUSD) || asNum(row.cost);
}

export function parseCcusageMonthly(
  payload: unknown,
  month = monthKey(),
  fx: FxQuote | null = null,
): Line[] {
  if (!payload || typeof payload !== "object") return [];
  const root = payload as Loose;
  const rows = rowsFrom(root, ["monthly", "data"]);
  const match = rows.find((row) => {
    const m = normalizeMonth(asStr(row.month) || asStr(row.period));
    return m === month || m.replace("-", "") === month.replace("-", "");
  });
  const usd = match
    ? costOf(match)
    : asNum((root.totals as Loose | undefined)?.totalCost) ||
      asNum((root.summary as Loose | undefined)?.totalCostUSD);
  if (usd <= 0) return [];
  const agents = match && Array.isArray(match.agents) ? (match.agents as Loose[]) : [];
  if (agents.length > 0) {
    return agents
      .map((agent) => {
        const name = asStr(agent.agent) || "agent";
        const agentUsd = costOf(agent);
        if (agentUsd <= 0) return null;
        return estimateLine(`${name} (ccusage estimate)`, agentUsd, fx);
      })
      .filter((x): x is Line => x != null);
  }
  return [estimateLine("Local CLI usage (ccusage estimate)", usd, fx)];
}

function estimateLine(name: string, usd: number, fx: FxQuote | null): Line {
  return {
    id: newId(),
    name,
    kind: "api",
    amountUsd: usd,
    amountCny: fx ? usdToCny(usd, fx.rate) : 0,
    fxRate: fx?.rate,
    fxDate: fx?.date,
    source: "ccusage_estimate",
    includedInTotal: false,
    note: "Token × list price. Not a card charge. Not in the total.",
  };
}

export function parseCcusageDaily(payload: unknown): { date: string; usd: number }[] {
  if (!payload || typeof payload !== "object") return [];
  const rows = rowsFrom(payload as Loose, ["daily", "data"]);
  return rows
    .map((row) => ({
      date: asStr(row.date) || asStr(row.period),
      usd: costOf(row),
    }))
    .filter((d) => d.date && d.usd > 0);
}

export function parseCcusageBlocks(payload: unknown): QuotaWindow | null {
  if (!payload || typeof payload !== "object") return null;
  const rows = rowsFrom(payload as Loose, ["data", "blocks"]);
  const active =
    rows.find((row) => row.isActive === true) ??
    rows.find((row) => asStr(row.timeRemaining).length > 0);
  if (!active) return null;
  const remaining = asStr(active.timeRemaining);
  const start = asStr(active.blockStart);
  const end = asStr(active.blockEnd);
  let percent: number | undefined;
  const used = asNum(active.totalTokens);
  const projected = asNum(active.projectedTotal);
  if (used > 0 && projected > 0) percent = Math.min(100, Math.round((used / projected) * 100));
  return {
    label: "Claude Code 5-hour window",
    percent,
    remaining: remaining || undefined,
    endsAt: end || start || undefined,
    source: "ccusage",
  };
}

export function detectCcusageKind(payload: unknown): "monthly" | "daily" | "blocks" | "unknown" {
  if (!payload || typeof payload !== "object") return "unknown";
  const root = payload as Loose;
  if (root.type === "blocks" || Array.isArray(root.blocks)) return "blocks";
  if (root.type === "monthly" || Array.isArray(root.monthly)) return "monthly";
  if (root.type === "daily" || Array.isArray(root.daily)) return "daily";
  if (Array.isArray(root.data) && root.data[0] && typeof root.data[0] === "object") {
    const first = root.data[0] as Loose;
    if ("blockStart" in first || "isActive" in first) return "blocks";
    if ("month" in first) return "monthly";
    if ("date" in first) return "daily";
  }
  return "unknown";
}
