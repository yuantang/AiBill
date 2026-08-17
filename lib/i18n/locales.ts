export const LOCALES = ["en", "zh", "ja", "es", "pt", "de", "ko", "fr"] as const;

export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "en";

export const LOCALE_COOKIE = "aibill.locale";

export const LOCALE_META: Record<
  Locale,
  { label: string; native: string; html: string; intl: string }
> = {
  en: { label: "English", native: "English", html: "en", intl: "en-US" },
  zh: { label: "Chinese", native: "简体中文", html: "zh-CN", intl: "zh-CN" },
  ja: { label: "Japanese", native: "日本語", html: "ja", intl: "ja-JP" },
  es: { label: "Spanish", native: "Español", html: "es", intl: "es-ES" },
  pt: { label: "Portuguese", native: "Português", html: "pt-BR", intl: "pt-BR" },
  de: { label: "German", native: "Deutsch", html: "de", intl: "de-DE" },
  ko: { label: "Korean", native: "한국어", html: "ko", intl: "ko-KR" },
  fr: { label: "French", native: "Français", html: "fr", intl: "fr-FR" },
};

export function isLocale(value: unknown): value is Locale {
  return typeof value === "string" && (LOCALES as readonly string[]).includes(value);
}

export function parseLocale(value: unknown): Locale {
  if (typeof value !== "string") return DEFAULT_LOCALE;
  const lower = value.toLowerCase();
  if (isLocale(lower)) return lower;
  const base = lower.split("-")[0];
  if (isLocale(base)) return base;
  if (base === "zh") return "zh";
  if (base === "pt") return "pt";
  return DEFAULT_LOCALE;
}

export function detectBrowserLocale(languages: readonly string[] = []): Locale {
  for (const item of languages) {
    const hit = parseLocale(item);
    if (hit !== DEFAULT_LOCALE || item.toLowerCase().startsWith("en")) return hit;
  }
  return DEFAULT_LOCALE;
}
