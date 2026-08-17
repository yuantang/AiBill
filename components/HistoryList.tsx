"use client";

import { useEffect, useState } from "react";
import { formatCny } from "@/lib/ledger";
import type { MonthSnapshot } from "@/lib/types";
import { useI18n } from "./I18nProvider";

export function HistoryList() {
  const { t, locale } = useI18n();
  const [rows, setRows] = useState<MonthSnapshot[] | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/history")
      .then(async (res) => {
        if (res.status === 401) {
          if (!cancelled) setRows([]);
          return;
        }
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load history");
        if (!cancelled) setRows(data.snapshots ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return <p className="error">{error}</p>;
  }
  if (rows == null) {
    return <p className="hint">{t("history.opening")}</p>;
  }
  if (rows.length === 0) {
    return (
      <p className="hint">
        {t("history.empty")}
      </p>
    );
  }

  return (
    <ul className="history-list">
      {rows.map((row, index) => (
        <li key={row.id}>
          <button
            type="button"
            className="link"
            onClick={() => setOpenId(openId === row.id ? null : row.id)}
            aria-expanded={openId === row.id}
          >
            {row.month} · {formatCny(row.totalCny, locale)}
          </button>
          <p className="hint">
            {t("history.plans", {
              plans: formatCny(row.subscriptionCny, locale),
              api: formatCny(row.apiCny, locale),
              other: formatCny(row.otherCny, locale),
            })}
            {(() => {
              const older = rows[index + 1];
              if (!older) return "";
              const delta = Math.round((row.totalCny - older.totalCny) * 100) / 100;
              if (delta === 0) return t("history.flat");
              return delta > 0
                ? t("history.up", { amount: formatCny(delta, locale) })
                : t("history.down", { amount: formatCny(-delta, locale) });
            })()}
          </p>
          {openId === row.id ? <pre className="detail">{row.statement}</pre> : null}
        </li>
      ))}
    </ul>
  );
}
