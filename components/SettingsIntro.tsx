"use client";

import { useI18n } from "./I18nProvider";

export function SettingsIntro() {
  const { t } = useI18n();
  return (
    <>
      <p className="kicker">{t("settings.kicker")}</p>
      <h1>{t("settings.title")}</h1>
      <p className="lede">{t("settings.lede")}</p>
    </>
  );
}
