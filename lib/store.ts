import type { FxQuote, Line, QuotaWindow, UserSettings } from "./types";

const KEY = "aibill.v1";

export const DEFAULT_SETTINGS: UserSettings = {
  budgetCny: null,
  emailEnabled: true,
  plan: "free",
  theme: "light",
  cycleStartDay: 1,
  locale: "en",
};

export type Persisted = {
  lines: Line[];
  window: QuotaWindow | null;
  fx: FxQuote | null;
  settings: UserSettings;
};

function emptyState(): Persisted {
  return { lines: [], window: null, fx: null, settings: DEFAULT_SETTINGS };
}

export function loadState(): Persisted {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw) as Partial<Persisted>;
    return {
      lines: Array.isArray(parsed.lines) ? parsed.lines : [],
      window: parsed.window ?? null,
      fx: parsed.fx && parsed.fx.rate === 1 ? parsed.fx : null,
      settings: { ...DEFAULT_SETTINGS, ...parsed.settings },
    };
  } catch {
    return emptyState();
  }
}

export function saveState(state: Persisted): void {
  window.localStorage.setItem(KEY, JSON.stringify(state));
}

export const CASH_SOURCES: Line["source"][] = ["hand", "receipt", "inbox"];

export function sameCashLine(
  a: Pick<Line, "name" | "kind" | "source">,
  b: Pick<Line, "name" | "kind" | "source">,
): boolean {
  if (a.name !== b.name || a.kind !== b.kind) return false;
  const aCash = CASH_SOURCES.includes(a.source);
  const bCash = CASH_SOURCES.includes(b.source);
  if (aCash && bCash) return true;
  return a.source === b.source;
}

export function upsertLine(lines: Line[], next: Line): Line[] {
  const without = lines.filter((line) => !sameCashLine(line, next));
  return [...without, next];
}

export function removeBySource(lines: Line[], source: Line["source"]): Line[] {
  return lines.filter((line) => line.source !== source);
}
