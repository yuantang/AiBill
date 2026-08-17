"use client";

import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { monthNames, t, type MessageKey } from "@/lib/i18n";
import { LOCALES, LOCALE_META, type Locale } from "@/lib/i18n/locales";
import { getLocale, hydrateLocale, setAppLocale, subscribeLocale } from "@/lib/i18n/runtime";
import type { MessageVars } from "@/lib/i18n/path";

type I18nValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: MessageKey, vars?: MessageVars) => string;
  months: string[];
};

const I18nContext = createContext<I18nValue | null>(null);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(getLocale);

  useEffect(() => {
    setLocaleState(hydrateLocale());
    return subscribeLocale(setLocaleState);
  }, []);

  const value = useMemo<I18nValue>(
    () => ({
      locale,
      setLocale: setAppLocale,
      t: (key, vars) => t(locale, key, vars),
      months: monthNames(locale),
    }),
    [locale],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nValue {
  const ctx = useContext(I18nContext);
  if (!ctx) {
    return {
      locale: "en",
      setLocale: setAppLocale,
      t: (key, vars) => t("en", key, vars),
      months: monthNames("en"),
    };
  }
  return ctx;
}

export function LanguageSwitch({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t: tr } = useI18n();
  return (
    <label className={compact ? "lang-switch compact" : "lang-switch"}>
      <span className="sr-only">{tr("language.choose")}</span>
      <select
        value={locale}
        aria-label={tr("language.label")}
        onChange={(event) => setLocale(event.target.value as Locale)}
      >
        {LOCALES.map((code) => (
          <option key={code} value={code}>
            {LOCALE_META[code].native}
          </option>
        ))}
      </select>
    </label>
  );
}
