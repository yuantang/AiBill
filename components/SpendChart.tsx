import { formatCny } from "@/lib/ledger";
import type { DailyUsd } from "@/lib/types";

export function SpendChart({ series }: { series: DailyUsd[] }) {
  if (series.length === 0) {
    return <p className="hint">Pull an API invoice and daily spend shows up here.</p>;
  }
  const max = Math.max(...series.map((d) => d.usd), 0.01);
  const last = series.slice(-14);
  return (
    <div className="bars" aria-label="API USD, last two weeks">
      {last.map((d) => (
        <div key={d.date} className="bar-col">
          <div
            className="bar"
            style={{ height: `${Math.max(6, (d.usd / max) * 68)}px` }}
            title={`${d.date} ${formatCny(d.usd)}`}
          />
          <span>{d.date.slice(8)}</span>
        </div>
      ))}
    </div>
  );
}
