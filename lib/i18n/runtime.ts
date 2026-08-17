import { DEFAULT_LOCALE, LOCALE_COOKIE, isLocale, parseLocale, type Locale } from "./locales";
import { loadState, saveState } from "../store";

type Listener = (locale: Locale) => void;

const listeners = new Set<Listener>();
let current: Locale = DEFAULT_LOCALE;

export function getLocale(): Locale {
  return current;
}

export function subscribeLocale(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function readStoredLocale(): Locale {
  if (typeof window === "undefined") return DEFAULT_LOCALE;
  try {
    const fromCookie = document.cookie
      .split(";")
      .map((part) => part.trim())
      .find((part) => part.startsWith(`${LOCALE_COOKIE}=`));
    if (fromCookie) return parseLocale(decodeURIComponent(fromCookie.split("=")[1] ?? ""));
    const standalone = window.localStorage.getItem(LOCALE_COOKIE);
    if (standalone) return parseLocale(standalone);
    const settings = loadState().settings.locale;
    if (settings) return parseLocale(settings);
  } catch {
    /* ignore */
  }
  return parseLocale(window.navigator.language);
}

export function setAppLocale(locale: Locale): void {
  const next = isLocale(locale) ? locale : DEFAULT_LOCALE;
  if (next === current) {
    if (typeof document !== "undefined") document.documentElement.lang = next;
    return;
  }
  current = next;
  if (typeof document !== "undefined") {
    document.documentElement.lang = next;
    document.cookie = `${LOCALE_COOKIE}=${next};path=/;max-age=31536000;samesite=lax`;
    try {
      window.localStorage.setItem(LOCALE_COOKIE, next);
      const state = loadState();
      saveState({ ...state, settings: { ...state.settings, locale: next } });
    } catch {
      /* ignore */
    }
  }
  for (const listener of listeners) listener(next);
}

export function hydrateLocale(preferred?: string | null): Locale {
  const next = preferred && isLocale(preferred) ? preferred : readStoredLocale();
  current = next;
  if (typeof document !== "undefined") document.documentElement.lang = next;
  return next;
}
