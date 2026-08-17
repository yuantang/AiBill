"use client";

import { useI18n } from "./I18nProvider";

export function PrivacyView() {
  const { t } = useI18n();
  return (
    <main className="narrow prose">
      <p className="kicker">{t("privacy.kicker")}</p>
      <h1>{t("privacy.title")}</h1>
      <h2>{t("privacy.keepTitle")}</h2>
      <p>{t("privacy.keep")}</p>
      <h2>{t("privacy.keysTitle")}</h2>
      <p>{t("privacy.keys")}</p>
      <h2>{t("privacy.pretendTitle")}</h2>
      <p>{t("privacy.pretend")}</p>
      <h2>{t("privacy.deleteTitle")}</h2>
      <p>{t("privacy.delete")}</p>
    </main>
  );
}
