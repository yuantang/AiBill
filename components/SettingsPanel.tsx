"use client";

import { useState } from "react";
import { InboxCard } from "./InboxCard";
import { LanguageSwitch, useI18n } from "./I18nProvider";
import { useBill } from "./useBill";

export function SettingsPanel() {
  const { t } = useI18n();
  const bill = useBill();
  const [budget, setBudget] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  if (!bill.ready) {
    return <p className="hint">{t("settings.opening")}</p>;
  }

  async function save() {
    const value = budget.trim() === "" ? bill.settings.budgetCny : Number(budget);
    if (value != null && (!Number.isFinite(value) || value < 0)) {
      bill.setError(t("settings.errBudget"));
      return;
    }
    await bill.persistSettings({ ...bill.settings, budgetCny: value ?? null });
    setMessage(t("settings.budgetSaved"));
  }

  async function toggleEmail() {
    await bill.persistSettings({ ...bill.settings, emailEnabled: !bill.settings.emailEnabled });
    setMessage(bill.settings.emailEnabled ? t("settings.emailOff") : t("settings.emailOn"));
  }

  async function dropKey(provider: "openai" | "anthropic") {
    setBusy(provider);
    await fetch(`/api/keys?provider=${provider}`, { method: "DELETE" });
    if (provider === "openai") bill.setHasOpenai(false);
    else bill.setHasAnthropic(false);
    setBusy(null);
    setMessage(provider === "openai" ? t("settings.openaiGone") : t("settings.anthropicGone"));
  }

  async function wipe() {
    if (!window.confirm(t("settings.confirmClear"))) return;
    if (bill.mode === "cloud") {
      const res = await fetch("/api/ledger");
      const data = await res.json();
      for (const line of data.lines ?? []) {
        await fetch(`/api/lines?id=${encodeURIComponent(line.id)}`, { method: "DELETE" });
      }
      await fetch("/api/window", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ window: null }),
      });
    }
    window.localStorage.removeItem("aibill.v1");
    window.location.reload();
  }

  async function destroy() {
    if (!window.confirm(t("settings.confirmDelete"))) return;
    const res = await fetch("/api/account", { method: "DELETE" });
    if (!res.ok) {
      bill.setError(t("settings.deleteFail"));
      return;
    }
    window.localStorage.removeItem("aibill.v1");
    window.location.href = "/";
  }

  return (
    <div>
      <section className="section">
        <h2>{t("settings.account")}</h2>
        <p>{bill.email ?? t("settings.notSigned")}</p>
        <p className="hint">{bill.mode === "local" ? t("settings.signHint") : t("settings.signedHint")}</p>
      </section>

      <section className="section">
        <h2>{t("settings.budget")}</h2>
        <div className="form compact">
          <div className="field">
            <label htmlFor="set-budget">USD</label>
            <input
              id="set-budget"
              inputMode="decimal"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder={bill.settings.budgetCny != null ? String(bill.settings.budgetCny) : "200"}
            />
          </div>
          <button type="button" className="btn secondary" onClick={() => void save()}>
            {t("settings.save")}
          </button>
        </div>
      </section>

      <section className="section">
        <h2>{t("settings.language")}</h2>
        <p className="hint">{t("settings.languageHint")}</p>
        <LanguageSwitch />
      </section>

      <section className="section">
        <h2>{t("settings.appearance")}</h2>
        <div className="actions">
          <button
            type="button"
            className={bill.settings.theme === "light" ? "chip on" : "chip"}
            onClick={() => void bill.persistSettings({ ...bill.settings, theme: "light" })}
          >
            {t("settings.light")}
          </button>
          <button
            type="button"
            className={bill.settings.theme === "dark" ? "chip on" : "chip"}
            onClick={() => void bill.persistSettings({ ...bill.settings, theme: "dark" })}
          >
            {t("settings.dark")}
          </button>
        </div>
      </section>

      <section className="section">
        <h2>{t("settings.cycle")}</h2>
        <p className="hint">{t("settings.cycleHint")}</p>
        <div className="form compact">
          <div className="field">
            <label htmlFor="cycle">{t("settings.cycleDay")}</label>
            <input
              id="cycle"
              inputMode="numeric"
              defaultValue={String(bill.settings.cycleStartDay)}
              onBlur={(e) => {
                const n = Number(e.target.value);
                if (Number.isFinite(n)) void bill.persistSettings({ ...bill.settings, cycleStartDay: n });
              }}
            />
          </div>
        </div>
      </section>

      <section className="section">
        <h2>{t("inbox.title")}</h2>
        <InboxCard mode={bill.mode} />
      </section>

      <section className="section">
        <h2>{t("settings.monday")}</h2>
        <p className="hint">{t("settings.mondayHint")}</p>
        <button type="button" className="btn secondary" onClick={() => void toggleEmail()} disabled={bill.mode !== "cloud"}>
          {bill.settings.emailEnabled ? t("settings.mondayOff") : t("settings.mondayOn")}
        </button>
      </section>

      <section className="section">
        <h2>{t("settings.keys")}</h2>
        <p className="hint">{t("settings.keysHint")}</p>
        <ul className="charges">
          <li>
            <span>{bill.hasOpenai ? t("settings.openaiOn") : t("settings.openaiOff")}</span>
            {bill.hasOpenai ? (
              <button type="button" className="link" disabled={busy != null} onClick={() => void dropKey("openai")}>
                {t("settings.disconnect")}
              </button>
            ) : (
              <span className="hint">{t("settings.pasteMonth")}</span>
            )}
          </li>
          <li>
            <span>{bill.hasAnthropic ? t("settings.anthropicOn") : t("settings.anthropicOff")}</span>
            {bill.hasAnthropic ? (
              <button type="button" className="link" disabled={busy != null} onClick={() => void dropKey("anthropic")}>
                {t("settings.disconnect")}
              </button>
            ) : (
              <span className="hint">{t("settings.pasteMonth")}</span>
            )}
          </li>
        </ul>
      </section>

      <section className="section">
        <h2>{t("settings.danger")}</h2>
        <div className="actions">
          <button type="button" className="btn secondary" onClick={() => void wipe()}>
            {t("settings.clear")}
          </button>
          <button type="button" className="btn secondary" onClick={() => void destroy()}>
            {t("settings.deleteAccount")}
          </button>
        </div>
      </section>

      {message ? <p className="ok">{message}</p> : null}
      {bill.error ? (
        <p className="error" role="alert">
          {bill.error}
        </p>
      ) : null}
    </div>
  );
}
