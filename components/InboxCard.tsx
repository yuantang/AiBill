"use client";

import { useEffect, useRef, useState } from "react";
import { sampleInboundLines } from "@/lib/inbox-sample";
import type { Line } from "@/lib/types";
import { BILLING_SEATS } from "@/lib/vendors";
import { useI18n } from "./I18nProvider";

type InboxInfo = {
  address: string;
  lastInboxAt: string | null;
  filter: string;
  waiting?: string[];
};

export function InboxCard({
  mode,
  onLines,
}: {
  mode: "local" | "cloud";
  onLines?: (lines: Line[]) => void;
}) {
  const { t } = useI18n();
  const [info, setInfo] = useState<InboxInfo | null>(null);
  const [copied, setCopied] = useState<"addr" | "filter" | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [noteKind, setNoteKind] = useState<"ok" | "err" | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const copyTimer = useRef<number | null>(null);

  useEffect(() => {
    if (mode !== "cloud") return;
    let cancelled = false;
    void fetch("/api/inbox")
      .then(async (res) => {
        if (!res.ok) throw new Error(t("inbox.loadFail"));
        const data = (await res.json()) as InboxInfo;
        if (!cancelled) {
          setInfo(data);
          setLoadError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError(t("inbox.loadFail"));
      });
    return () => {
      cancelled = true;
      if (copyTimer.current != null) window.clearTimeout(copyTimer.current);
    };
  }, [mode, t]);

  async function copy(kind: "addr" | "filter", value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      if (copyTimer.current != null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(null), 1600);
      return true;
    } catch {
      setNoteKind("err");
      setNote(t("inbox.copyFail"));
      return false;
    }
  }

  async function openSeat(href: string, name: string) {
    if (!info) return;
    const ok = await copy("addr", info.address);
    if (ok) {
      setNoteKind("ok");
      setNote(t("inbox.copiedGo", { name }));
    }
    window.open(href, "_blank", "noopener,noreferrer");
  }

  function landDemo() {
    const lines = sampleInboundLines();
    onLines?.(lines);
    setNoteKind("ok");
    setNote(t("inbox.demoOk"));
  }

  async function sendTest() {
    if (!info) return;
    setBusy("test");
    setNote(null);
    try {
      const res = await fetch("/api/inbox/test", { method: "POST" });
      const data = (await res.json()) as { lines?: Line[]; saved?: boolean; error?: string };
      if (!res.ok || !data.saved) throw new Error(data.error ?? t("inbox.testFail"));
      if (data.lines?.length) onLines?.(data.lines);
      setInfo({ ...info, lastInboxAt: new Date().toISOString() });
      setNoteKind("ok");
      setNote(t("inbox.testOk"));
    } catch (err) {
      setNoteKind("err");
      setNote(err instanceof Error ? err.message : t("inbox.testFail"));
    } finally {
      setBusy(null);
    }
  }

  async function rotate() {
    if (!window.confirm(t("inbox.rotateConfirm"))) return;
    setBusy("rotate");
    try {
      const res = await fetch("/api/inbox", { method: "PATCH" });
      const data = (await res.json()) as InboxInfo;
      if (!res.ok) throw new Error(t("inbox.rotateFail"));
      setInfo(data);
      setNoteKind("ok");
      setNote(t("inbox.rotated"));
    } catch (err) {
      setNoteKind("err");
      setNote(err instanceof Error ? err.message : t("inbox.rotateFail"));
    } finally {
      setBusy(null);
    }
  }

  if (mode !== "cloud") {
    return (
      <div className="inbox-card">
        <p className="lede" style={{ marginTop: 0 }}>
          {t("inbox.oneStepGuest")}
        </p>
        <div className="actions">
          <a className="btn" href="/login">
            {t("nav.signIn")}
          </a>
          <button type="button" className="btn secondary" onClick={landDemo}>
            {t("inbox.demoLand")}
          </button>
        </div>
        {note ? (
          <p className={noteKind === "err" ? "error" : "ok"} role={noteKind === "err" ? "alert" : "status"}>
            {note}
          </p>
        ) : null}
      </div>
    );
  }

  if (loadError) {
    return (
      <p className="error" role="alert">
        {loadError}
      </p>
    );
  }

  if (!info) {
    return <p className="hint">{t("inbox.loading")}</p>;
  }

  return (
    <div className="inbox-card">
      <p className="lede" style={{ marginTop: 0 }}>
        {t("inbox.oneStep")}
      </p>
      <div className="inbox-addr">
        <code>{info.address}</code>
        <button type="button" className="btn" onClick={() => void copy("addr", info.address)}>
          {copied === "addr" ? t("inbox.copied") : t("inbox.copy")}
        </button>
      </div>
      <p className="hint">{t("inbox.vendorHint")}</p>
      <div className="vendor-row" role="group" aria-label={t("inbox.vendorHint")}>
        {BILLING_SEATS.map((seat) => (
          <button key={seat.id} type="button" className="btn secondary" onClick={() => void openSeat(seat.href, seat.name)}>
            {t("inbox.openVendor", { name: seat.name })}
          </button>
        ))}
      </div>
      {info.lastInboxAt ? (
        <p className="ok" role="status">
          {t("inbox.lastAt", { date: new Date(info.lastInboxAt).toLocaleString() })}
        </p>
      ) : (
        <p className="hint">{t("inbox.waiting")}</p>
      )}
      {info.waiting && info.waiting.length > 0 ? (
        <p className="hint">{t("inbox.stillWaiting", { names: info.waiting.join(", ") })}</p>
      ) : (
        <p className="hint">{t("inbox.seatsIn")}</p>
      )}
      <details className="inbox-more">
        <summary>{t("inbox.more")}</summary>
        <p className="hint">{t("inbox.moreFilter")}</p>
        <div className="inbox-filter">
          <code>{info.filter}</code>
          <button type="button" className="link" onClick={() => void copy("filter", info.filter)}>
            {copied === "filter" ? t("inbox.copied") : t("inbox.copyFilter")}
          </button>
        </div>
        <div className="actions" style={{ marginTop: 10 }}>
          <button type="button" className="btn secondary" disabled={busy != null} onClick={() => void sendTest()}>
            {busy === "test" ? t("inbox.testing") : t("inbox.test")}
          </button>
          <button type="button" className="btn ghost" disabled={busy != null} onClick={() => void rotate()}>
            {t("inbox.rotate")}
          </button>
        </div>
      </details>
      {note ? (
        <p className={noteKind === "err" ? "error" : "ok"} role={noteKind === "err" ? "alert" : "status"}>
          {note}
        </p>
      ) : null}
    </div>
  );
}
