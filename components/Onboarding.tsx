"use client";

import { useState } from "react";
import { formatCny, newId } from "@/lib/ledger";
import { PRESETS } from "@/lib/statement";
import type { Line } from "@/lib/types";
import { useI18n } from "./I18nProvider";

export function Onboarding({
  onDone,
  onDemo,
}: {
  onDone: (lines: Line[], budgetCny: number | null) => void;
  onDemo: () => void;
}) {
  const [step, setStep] = useState(1);
  const [picked, setPicked] = useState<string[]>([]);
  const [apiName, setApiName] = useState("OpenAI API");
  const [apiCny, setApiCny] = useState("");
  const { t, locale } = useI18n();
  const [budget, setBudget] = useState("200");

  function toggle(name: string) {
    setPicked((prev) => (prev.includes(name) ? prev.filter((n) => n !== name) : [...prev, name]));
  }

  function finish() {
    const lines: Line[] = [];
    for (const name of picked) {
      const preset = PRESETS.find((item) => item.name === name);
      if (!preset) continue;
      lines.push({
        id: newId(),
        name: preset.name,
        kind: preset.kind,
        amountCny: preset.amountCny,
        source: "hand",
        includedInTotal: true,
        chargeDay: preset.chargeDay,
        category: "work",
        note: t("onboard.notePreset"),
      });
    }
    const amount = Number(apiCny);
    if (apiName.trim() && Number.isFinite(amount) && amount > 0) {
      lines.push({
        id: newId(),
        name: apiName.trim(),
        kind: "api",
        amountCny: amount,
        source: "hand",
        includedInTotal: true,
        note: t("onboard.noteApi"),
      });
    }
    const budgetCny = Number(budget);
    onDone(lines, Number.isFinite(budgetCny) && budgetCny > 0 ? budgetCny : null);
  }

  return (
    <section className="wizard">
      <p className="kicker">{t("onboard.kicker", { step })}</p>
      <h2 className="wizard-title">{t("onboard.title")}</h2>
      {step === 1 ? (
        <>
          <p className="hint">{t("onboard.inboxHint")}</p>
          <div className="actions" style={{ marginBottom: 12 }}>
            <button
              type="button"
              className="btn"
              onClick={() => setPicked(["Claude Max", "Cursor Pro", "ChatGPT Plus"])}
            >
              {t("onboard.usualThree")}
            </button>
          </div>
          <p className="hint">{t("onboard.pickHint")}</p>
          <div className="presets">
            {PRESETS.filter((p) => p.group === "core").map((preset) => (
              <button
                key={preset.name}
                type="button"
                className={picked.includes(preset.name) ? "chip on" : "chip"}
                onClick={() => toggle(preset.name)}
              >
                {preset.name} {formatCny(preset.amountCny, locale)}
              </button>
            ))}
          </div>
          <p className="hint">{t("onboard.also")}</p>
          <div className="presets">
            {PRESETS.filter((p) => p.group === "more").map((preset) => (
              <button
                key={preset.name}
                type="button"
                className={picked.includes(preset.name) ? "chip on" : "chip"}
                onClick={() => toggle(preset.name)}
              >
                {preset.name} {formatCny(preset.amountCny, locale)}
              </button>
            ))}
          </div>
        </>
      ) : null}
      {step === 2 ? (
        <>
          <p className="hint">
            {t("onboard.apiHint")}
          </p>
          <div className="form" style={{ gridTemplateColumns: "1fr 140px" }}>
            <div className="field">
              <label htmlFor="api-name">{t("onboard.apiName")}</label>
              <input id="api-name" value={apiName} onChange={(e) => setApiName(e.target.value)} />
            </div>
            <div className="field">
              <label htmlFor="api-cny">{t("onboard.apiUsd")}</label>
              <input id="api-cny" inputMode="decimal" value={apiCny} onChange={(e) => setApiCny(e.target.value)} />
            </div>
          </div>
        </>
      ) : null}
      {step === 3 ? (
        <>
          <p className="hint">{t("onboard.budgetHint")}</p>
          <div className="field" style={{ maxWidth: 200 }}>
            <label htmlFor="wiz-budget">{t("onboard.budgetUsd")}</label>
            <input id="wiz-budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} />
          </div>
        </>
      ) : null}
      <div className="actions">
        {step > 1 ? (
          <button type="button" className="btn secondary" onClick={() => setStep((n) => n - 1)}>
            {t("onboard.back")}
          </button>
        ) : null}
        {step < 3 ? (
          <button type="button" className="btn" onClick={() => setStep((n) => n + 1)}>
            {t("onboard.next")}
          </button>
        ) : (
          <button type="button" className="btn" onClick={finish}>
            {t("onboard.showTotal")}
          </button>
        )}
        <button type="button" className="btn ghost" onClick={onDemo}>
          {t("onboard.sample")}
        </button>
      </div>
    </section>
  );
}
