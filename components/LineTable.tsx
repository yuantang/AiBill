"use client";

import { countedAmount, formatCny } from "@/lib/ledger";
import { categoryLabel, kindLabel, sourceLabel } from "@/lib/statement";
import type { Line } from "@/lib/types";
import { useI18n } from "./I18nProvider";

export function LineTable({
  lines,
  openId,
  onToggle,
  onRemove,
  onEdit,
}: {
  lines: Line[];
  openId: string | null;
  onToggle: (id: string | null) => void;
  onRemove: (id: string) => void;
  onEdit?: (line: Line) => void;
}) {
  const { t, locale } = useI18n();
  return (
    <table className="lines">
      <thead>
        <tr>
          <th>{t("table.item")}</th>
          <th>{t("table.type")}</th>
          <th>{t("table.for")}</th>
          <th>{t("table.source")}</th>
          <th className="num">{t("table.usd")}</th>
          <th>
            <span className="sr-only">{t("table.actions")}</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {lines.map((line) => {
          const pending = line.includedInTotal && countedAmount(line) === 0;
          return (
            <tr key={line.id} className={line.includedInTotal ? undefined : "estimate"}>
              <td>
                <button
                  type="button"
                  className="link"
                  onClick={() => onToggle(openId === line.id ? null : line.id)}
                  aria-expanded={openId === line.id}
                >
                  {line.name}
                </button>
                {pending ? <div className="hint">{t("table.pending")}</div> : null}
                {openId === line.id ? <LineDetail line={line} locale={locale} t={t} /> : null}
              </td>
              <td>{kindLabel(line.kind, locale)}</td>
              <td>{categoryLabel(line.category ?? "work", locale)}</td>
              <td>
                <span className="pill">{sourceLabel(line.source, locale)}</span>
              </td>
              <td className="num">{pending ? "—" : formatCny(line.amountCny, locale)}</td>
              <td className="num">
                <div className="row-actions">
                  {onEdit ? (
                    <button type="button" className="link" onClick={() => onEdit(line)}>
                      {t("table.edit")}
                    </button>
                  ) : null}
                  <button type="button" className="link" onClick={() => onRemove(line.id)}>
                    {t("table.delete")}
                  </button>
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function LineDetail({
  line,
  locale,
  t,
}: {
  line: Line;
  locale: import("@/lib/i18n").Locale;
  t: (key: import("@/lib/i18n").MessageKey, vars?: Record<string, string | number>) => string;
}) {
  const max = Math.max(...(line.dailyUsd ?? []).map((d) => d.usd), 0.01);
  return (
    <div className="detail">
      {line.amountUsd != null ? <div>{t("table.invoice", { amount: line.amountUsd })}</div> : null}
      {line.fxRate != null && line.fxRate !== 1 ? (
        <div>
          {t("table.fx", { rate: line.fxRate, date: line.fxDate ?? "" })}
        </div>
      ) : null}
      {line.chargeDay != null ? <div>{t("table.chargesOn", { day: line.chargeDay })}</div> : null}
      {line.note ? <div>{line.note}</div> : null}
      <div>{t("table.sourceCheck", { source: sourceLabel(line.source, locale) })}</div>
      {line.dailyUsd && line.dailyUsd.length > 0 ? (
        <div className="bars" aria-label={t("table.dailyUsd")}>
          {line.dailyUsd.map((d) => (
            <div key={d.date} className="bar-col">
              <div
                className="bar"
                style={{ height: `${Math.max(4, (d.usd / max) * 56)}px` }}
                title={`${d.date} $${d.usd}`}
              />
              <span>{d.date.slice(5)}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
