import { en, type Messages } from "./messages/en";
import { zh } from "./messages/zh";
import { ja } from "./messages/ja";
import { es } from "./messages/es";
import { pt } from "./messages/pt";
import { de } from "./messages/de";
import { ko } from "./messages/ko";
import { fr } from "./messages/fr";
import { DEFAULT_LOCALE, isLocale, type Locale } from "./locales";
import { interpolate, lookup, type MessageVars } from "./path";

type DeepPartial<T> = {
  [K in keyof T]?: T[K] extends string ? string : DeepPartial<T[K]>;
};

function deepMerge<T>(base: T, over: DeepPartial<T> | undefined): T {
  if (over == null || base == null || typeof base !== "object") return base;
  const out = { ...base } as T;
  for (const key of Object.keys(over) as (keyof T)[]) {
    const extra = over[key];
    const current = base[key];
    if (extra != null && typeof extra === "object" && current != null && typeof current === "object") {
      out[key] = deepMerge(current, extra as DeepPartial<typeof current>);
    } else if (extra !== undefined) {
      out[key] = extra as T[typeof key];
    }
  }
  return out;
}

export type { Locale } from "./locales";
export {
  DEFAULT_LOCALE,
  LOCALES,
  LOCALE_META,
  detectBrowserLocale,
  isLocale,
  parseLocale,
} from "./locales";

export type MessageKey = Paths<Messages>;

type Paths<T, Prefix extends string = ""> = {
  [K in keyof T & string]: T[K] extends string
    ? `${Prefix}${K}`
    : Paths<T[K], `${Prefix}${K}.`>;
}[keyof T & string];

export const catalogs: Record<Locale, Messages> = {
  en,
  zh: deepMerge(en, zh),
  ja: deepMerge(en, ja),
  es: deepMerge(en, es),
  pt: deepMerge(en, pt),
  de: deepMerge(en, de),
  ko: deepMerge(en, ko),
  fr: deepMerge(en, fr),
};

export function messagesFor(locale: Locale): Messages {
  return catalogs[isLocale(locale) ? locale : DEFAULT_LOCALE] ?? en;
}

export function t(locale: Locale, key: MessageKey, vars?: MessageVars): string {
  const found = lookup(messagesFor(locale), key) ?? lookup(en, key) ?? key;
  return interpolate(found, vars);
}

export function monthNames(locale: Locale): string[] {
  return [
    t(locale, "months.jan"),
    t(locale, "months.feb"),
    t(locale, "months.mar"),
    t(locale, "months.apr"),
    t(locale, "months.may"),
    t(locale, "months.jun"),
    t(locale, "months.jul"),
    t(locale, "months.aug"),
    t(locale, "months.sep"),
    t(locale, "months.oct"),
    t(locale, "months.nov"),
    t(locale, "months.dec"),
  ];
}
