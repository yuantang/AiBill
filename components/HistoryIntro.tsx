"use client";

import { useI18n } from "./I18nProvider";

export function HistoryIntro() {
  const { t } = useI18n();
  return (
    <>
      <p className="kicker">{t("history.kicker")}</p>
      <h1>{t("history.title")}</h1>
      <p className="lede">{t("history.lede")}</p>
    </>
  );
}
