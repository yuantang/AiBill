"use client";

import { useI18n } from "./I18nProvider";

export function LoginCopy() {
  const { t } = useI18n();
  return (
    <>
      <p className="kicker">{t("login.kicker")}</p>
      <h1>{t("login.title")}</h1>
      <p className="lede">{t("login.lede")}</p>
    </>
  );
}
