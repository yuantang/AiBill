"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useI18n } from "./I18nProvider";

export function Shortcuts() {
  const router = useRouter();
  const { t } = useI18n();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const typing =
        target &&
        (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.tagName === "SELECT" || target.isContentEditable);
      if (event.key === "?" && !typing) {
        event.preventDefault();
        setOpen((v) => !v);
        return;
      }
      if (event.key === "Escape") {
        setOpen(false);
        return;
      }
      if (typing) return;
      if (event.key === "s") router.push("/app/statement");
      if (event.key === "f") router.push("/app/forecast");
      if (event.key === "y") router.push("/app/year");
      if (event.key === "m") router.push("/app/letter");
      if (event.key === "h") router.push("/app/history");
      if (event.key === ",") router.push("/app/settings");
      if (event.key === "b") router.push("/app");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [router]);

  if (!open) return null;
  return (
    <div className="shortcuts" role="dialog" aria-label="Keyboard shortcuts" onClick={() => setOpen(false)}>
      <div className="shortcuts-card" onClick={(e) => e.stopPropagation()}>
        <p className="kicker">{t("shortcuts.kicker")}</p>
        <h2 className="wizard-title">{t("shortcuts.title")}</h2>
        <dl>
          <dt>?</dt>
          <dd>{t("shortcuts.thisList")}</dd>
          <dt>b</dt>
          <dd>{t("shortcuts.month")}</dd>
          <dt>s</dt>
          <dd>{t("shortcuts.statement")}</dd>
          <dt>f</dt>
          <dd>{t("shortcuts.forecast")}</dd>
          <dt>y</dt>
          <dd>{t("shortcuts.year")}</dd>
          <dt>m</dt>
          <dd>{t("shortcuts.letter")}</dd>
          <dt>h</dt>
          <dd>{t("shortcuts.history")}</dd>
          <dt>,</dt>
          <dd>{t("shortcuts.settings")}</dd>
        </dl>
      </div>
    </div>
  );
}
