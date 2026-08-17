"use client";

import { useEffect, useMemo, useState } from "react";
import { formatCny, monthKey, subtotals, yearKey, yearRollup } from "@/lib/ledger";
import type { MonthSnapshot } from "@/lib/types";
import { useI18n } from "./I18nProvider";
import { useBill } from "./useBill";

export function YearView() {
  const { t, locale, months } = useI18n();
  const { ledger, ready } = useBill();
  const [rows, setRows] = useState<MonthSnapshot[]>([]);
  const year = yearKey();
  const current = monthKey();
  const sums = subtotals(ledger.lines);

  useEffect(() => {
    fetch("/api/history")
      .then((res) => res.json())
      .then((data) => setRows(data.snapshots ?? []))
      .catch(() => undefined);
  }, []);

  const roll = useMemo(
    () =>
      yearRollup(
        rows,
        {
          month: current,
          totalCny: ledger.totalCny,
          subscriptionCny: sums.subscription,
          apiCny: sums.api,
          otherCny: sums.other,
        },
        year,
      ),
    [rows, current, ledger.totalCny, sums.subscription, sums.api, sums.other, year],
  );

  if (!ready) {
    return (
      <main className="page">
        <p className="hint">{t("year.opening")}</p>
      </main>
    );
  }

  return (
    <main className="page">
      <p className="kicker">{t("year.kicker", { year })}</p>
      <h1>{t("year.title")}</h1>
      <p className="lede">{t("year.lede")}</p>
      <section className="hero">
        <p className="kicker">{t("year.ytd")}</p>
        <p className="total">{formatCny(roll.totalCny, locale)}</p>
        <dl className="breakdown">
          <div>
            <dt>{t("year.plans")}</dt>
            <dd>{formatCny(roll.subscriptionCny, locale)}</dd>
          </div>
          <div>
            <dt>{t("year.api")}</dt>
            <dd>{formatCny(roll.apiCny, locale)}</dd>
          </div>
          <div>
            <dt>{t("year.ifPace")}</dt>
            <dd>
              {formatCny(roll.projectedYearCny, locale)}
              {t("year.perYear")}
            </dd>
          </div>
        </dl>
        <p className="hint">
          {t(roll.months.length === 1 ? "year.average" : "year.averageMany", {
            amount: formatCny(roll.averageCny, locale),
            n: roll.months.length,
          })}
        </p>
      </section>
      <div className="year-grid">
        {months.map((label, i) => {
          const key = `${year}-${String(i + 1).padStart(2, "0")}`;
          const hit = roll.months.find((m) => m.month === key);
          return (
            <article key={key} className="year-cell">
              <p className="kicker">{label}</p>
              <strong>{hit ? formatCny(hit.totalCny, locale) : "—"}</strong>
              {hit ? (
                <p className="hint">
                  {t("year.api")} {formatCny(hit.apiCny, locale)}
                  {key === current ? ` · ${t("year.live")}` : ""}
                </p>
              ) : (
                <p className="hint">{t("year.noArchive")}</p>
              )}
            </article>
          );
        })}
      </div>
    </main>
  );
}
