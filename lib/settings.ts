import type { UserSettings as DbSettings } from "@prisma/client";
import { parseLocale } from "./i18n/locales";
import { DEFAULT_SETTINGS } from "./store";
import type { UserSettings } from "./types";

export function toSettings(row: DbSettings | null): UserSettings {
  if (!row) return DEFAULT_SETTINGS;
  return {
    budgetCny: row.budgetCny,
    emailEnabled: row.emailEnabled,
    plan: row.plan === "pro" ? "pro" : "free",
    theme: row.theme === "dark" ? "dark" : "light",
    cycleStartDay: row.cycleStartDay >= 1 && row.cycleStartDay <= 28 ? row.cycleStartDay : 1,
    locale: parseLocale((row as { locale?: string }).locale),
  };
}

export function settingsWrite(settings: Partial<UserSettings>) {
  return {
    budgetCny:
      settings.budgetCny === undefined
        ? undefined
        : settings.budgetCny == null || !Number.isFinite(settings.budgetCny)
          ? null
          : settings.budgetCny,
    emailEnabled: settings.emailEnabled,
    plan: settings.plan === "pro" || settings.plan === "free" ? settings.plan : undefined,
    theme: settings.theme === "dark" || settings.theme === "light" ? settings.theme : undefined,
    cycleStartDay:
      settings.cycleStartDay == null
        ? undefined
        : Math.min(28, Math.max(1, Math.round(settings.cycleStartDay))),
    locale: settings.locale ? parseLocale(settings.locale) : undefined,
  };
}
