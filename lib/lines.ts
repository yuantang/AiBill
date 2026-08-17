import type { BillLine, QuotaWindow as DbWindow } from "@prisma/client";
import type { Line, QuotaWindow } from "./types";

export function toLine(row: BillLine): Line {
  return {
    id: row.id,
    name: row.name,
    kind: row.kind as Line["kind"],
    amountCny: row.amountCny,
    amountUsd: row.amountUsd ?? undefined,
    fxRate: row.fxRate ?? undefined,
    fxDate: row.fxDate ?? undefined,
    source: row.source as Line["source"],
    includedInTotal: row.includedInTotal,
    chargeDay: row.chargeDay ?? undefined,
    note: row.note ?? undefined,
    dailyUsd: row.dailyUsd ? (JSON.parse(row.dailyUsd) as Line["dailyUsd"]) : undefined,
    category: (row.category as Line["category"]) || "work",
  };
}

export function toWindow(row: DbWindow | null): QuotaWindow | null {
  if (!row) return null;
  return {
    label: row.label,
    percent: row.percent ?? undefined,
    remaining: row.remaining ?? undefined,
    endsAt: row.endsAt ?? undefined,
    source: row.source as QuotaWindow["source"],
  };
}

export function lineWrite(line: Line) {
  return {
    name: line.name,
    kind: line.kind,
    amountCny: line.amountCny,
    amountUsd: line.amountUsd ?? null,
    fxRate: line.fxRate ?? null,
    fxDate: line.fxDate ?? null,
    source: line.source,
    includedInTotal: line.includedInTotal,
    chargeDay: line.chargeDay ?? null,
    note: line.note ?? null,
    dailyUsd: line.dailyUsd ? JSON.stringify(line.dailyUsd) : null,
    category: line.category ?? "work",
  };
}
