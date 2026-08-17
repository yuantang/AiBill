"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { isLocale } from "@/lib/i18n/locales";
import { setAppLocale, subscribeLocale } from "@/lib/i18n/runtime";
import { buildLedger } from "@/lib/ledger";
import { DEFAULT_SETTINGS, loadState, saveState, upsertLine } from "@/lib/store";
import type { FxQuote, Line, QuotaWindow, UserSettings } from "@/lib/types";

type Mode = "local" | "cloud";

type LedgerPayload = {
  email?: string;
  lines: Line[];
  window: QuotaWindow | null;
  fx: FxQuote | null;
  hasOpenai?: boolean;
  hasAnthropic?: boolean;
  hosted?: boolean;
  lastInvoiceAt?: string | null;
  settings?: UserSettings;
};

export function useBill() {
  const [lines, setLines] = useState<Line[]>([]);
  const [windowState, setWindow] = useState<QuotaWindow | null>(null);
  const [fx, setFx] = useState<FxQuote | null>(null);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [email, setEmail] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>("local");
  const [hasOpenai, setHasOpenai] = useState(false);
  const [hasAnthropic, setHasAnthropic] = useState(false);
  const [lastInvoiceAt, setLastInvoiceAt] = useState<string | null>(null);
  const [hosted, setHosted] = useState(false);
  const [ready, setReady] = useState(false);
  const refreshed = useRef(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const applyPayload = useCallback((data: LedgerPayload, nextMode: Mode) => {
    setLines(data.lines ?? []);
    setWindow(data.window ?? null);
    if (data.fx) setFx(data.fx);
    if (data.settings) {
      const next = { ...DEFAULT_SETTINGS, ...data.settings };
      setSettings(next);
      if (typeof document !== "undefined") {
        document.documentElement.dataset.theme = next.theme;
      }
      if (isLocale(next.locale)) setAppLocale(next.locale);
    }
    setHasOpenai(Boolean(data.hasOpenai));
    setHasAnthropic(Boolean(data.hasAnthropic));
    if (data.lastInvoiceAt !== undefined) setLastInvoiceAt(data.lastInvoiceAt ?? null);
    setHosted(Boolean(data.hosted));
    setEmail(data.email ?? null);
    setMode(nextMode);
  }, []);

  useEffect(() => {
    let cancelled = false;
    applyPayload(loadState(), "local");
    setReady(true);
    (async () => {
      try {
        const res = await fetch("/api/ledger");
        if (!res.ok) return;
        const data = (await res.json()) as LedgerPayload & { guest?: boolean };
        if (!data.guest && !cancelled) applyPayload(data, "cloud");
      } catch {
        /* stay on local */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [applyPayload]);

  useEffect(() => {
    if (!ready || mode !== "local") return;
    saveState({ lines, window: windowState, fx, settings });
  }, [lines, windowState, fx, settings, ready, mode]);

  useEffect(() => {
    return subscribeLocale((locale) => {
      setSettings((prev) => {
        if (prev.locale === locale) return prev;
        const next = { ...prev, locale };
        if (mode === "cloud") {
          void fetch("/api/settings", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(next),
          });
        }
        return next;
      });
    });
  }, [mode]);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/fx")
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "Could not load FX");
        if (!cancelled) setFx({ rate: data.rate, date: data.date });
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const ledger = useMemo(() => buildLedger(lines, windowState, fx), [lines, windowState, fx]);

  async function refreshInvoices() {
    const res = await fetch("/api/sync", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ provider: "all" }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error ?? "Sync failed");
    const incoming = (data.lines ?? []) as Line[];
    if (incoming.length > 0) {
      setLines((prev) => incoming.reduce((next, line) => upsertLine(next, line), prev));
      setLastInvoiceAt(new Date().toISOString());
    }
    return incoming;
  }

  useEffect(() => {
    if (mode !== "cloud" || !ready || refreshed.current) return;
    if (!hasOpenai && !hasAnthropic) return;
    refreshed.current = true;
    setBusy("sync");
    void refreshInvoices()
      .catch((err: Error) => setError(err.message))
      .finally(() => setBusy(null));
  }, [mode, ready, hasOpenai, hasAnthropic]);

  async function persistLine(line: Line) {
    if (mode !== "cloud") return;
    const res = await fetch("/api/lines", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ line }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "没存上");
    }
  }

  async function persistWindow(next: QuotaWindow | null) {
    if (mode !== "cloud") return;
    const res = await fetch("/api/window", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ window: next }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "窗口没存上");
    }
  }

  async function persistSettings(next: UserSettings) {
    setSettings(next);
    if (typeof document !== "undefined") {
      document.documentElement.dataset.theme = next.theme;
    }
    if (mode !== "cloud") return;
    const res = await fetch("/api/settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(next),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "设置没存上");
    }
  }

  function putLine(next: Line) {
    setLines((prev) => upsertLine(prev, next));
    void persistLine(next).catch((err: Error) => setError(err.message));
  }

  function dropLine(id: string) {
    setLines((prev) => prev.filter((line) => line.id !== id));
    if (mode === "cloud") {
      void fetch(`/api/lines?id=${encodeURIComponent(id)}`, { method: "DELETE" });
    }
  }

  function replaceLines(updater: (prev: Line[]) => Line[]) {
    setLines((prev) => {
      const next = updater(prev);
      if (mode === "cloud") {
        for (const line of next) {
          if (!prev.some((old) => old.id === line.id && old === line)) {
            void persistLine(line).catch((err: Error) => setError(err.message));
          }
        }
      }
      return next;
    });
  }

  function loadBundle(next: { lines: Line[]; window?: QuotaWindow | null; settings?: UserSettings }) {
    setLines(next.lines);
    if (next.window !== undefined) setWindow(next.window);
    if (next.settings) setSettings(next.settings);
    if (mode === "cloud") {
      for (const line of next.lines) {
        void persistLine(line).catch((err: Error) => setError(err.message));
      }
      if (next.window !== undefined) void persistWindow(next.window);
      if (next.settings) {
        void fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(next.settings),
        });
      }
    }
  }

  async function saveWindow(next: QuotaWindow | null) {
    setWindow(next);
    try {
      await persistWindow(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "窗口没存上");
    }
  }

  return {
    lines,
    windowState,
    fx,
    settings,
    email,
    mode,
    hasOpenai,
    hasAnthropic,
    lastInvoiceAt,
    hosted,
    ready,
    busy,
    error,
    ledger,
    setBusy,
    setError,
    setHasOpenai,
    setHasAnthropic,
    putLine,
    dropLine,
    replaceLines,
    saveWindow,
    persistSettings,
    loadBundle,
    refreshInvoices,
  };
}
