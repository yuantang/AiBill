"use client";

import { useEffect, useRef, useState } from "react";
import { sampleInboundLines } from "@/lib/inbox-sample";
import type { Line } from "@/lib/types";
import { BILLING_SEATS, GMAIL_FILTERS_URL } from "@/lib/vendors";
import { useI18n } from "./I18nProvider";

type InboxInfo = {
  address: string;
  lastInboxAt: string | null;
  filter: string;
  waiting?: string[];
  notice?: string | null;
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
  const [copied, setCopied] = useState<string | null>(null);
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

  async function copy(kind: string, value: string) {
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
      {info.notice ? (
        <p className="ok" role="status">
          {t("inbox.verifyTitle")} {info.notice}
        </p>
      ) : null}
      <ol className="setup-ol">
        <li>
          <strong>{t("inbox.guide.copy")}</strong>
          <div className="inbox-addr">
            <code>{info.address}</code>
            <button type="button" className="btn" onClick={() => void copy("addr", info.address)}>
              {copied === "addr" ? t("inbox.copied") : t("inbox.copy")}
            </button>
          </div>
        </li>
        <li>
          <strong>{t("inbox.guide.gmail")}</strong>
          <p className="hint">{t("inbox.guide.gmailWhy")}</p>
          <a className="btn" href={GMAIL_FILTERS_URL} target="_blank" rel="noopener noreferrer">
            {t("inbox.guide.openGmail")}
          </a>
        </li>
        <li>
          <strong>{t("inbox.guide.fill")}</strong>
          <p className="hint">{t("inbox.guide.fillHint")}</p>
          {BILLING_SEATS.map((seat, index) => (
            <details key={seat.id} className="setup-card" open={index === 0}>
              <summary>
                {index + 1}. {seat.name}
              </summary>
              <table className="setup-table">
                <tbody>
                  <tr>
                    <th>{t("inbox.guide.from")}</th>
                    <td>
                      <code>{seat.from}</code>
                      <button type="button" className="link" onClick={() => void copy(`from-${seat.id}`, seat.from)}>
                        {copied === `from-${seat.id}` ? t("inbox.copied") : t("inbox.copy")}
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <th>{t("inbox.guide.contains")}</th>
                    <td>
                      <code>{seat.contains}</code>
                      <button type="button" className="link" onClick={() => void copy(`has-${seat.id}`, seat.contains)}>
                        {copied === `has-${seat.id}` ? t("inbox.copied") : t("inbox.copy")}
                      </button>
                    </td>
                  </tr>
                  <tr>
                    <th>{t("inbox.guide.leave")}</th>
                    <td>{t("inbox.guide.leaveVal")}</td>
                  </tr>
                </tbody>
              </table>
              <p className="hint">{t("inbox.guide.next")}</p>
              <div className="inbox-addr">
                <code>{info.address}</code>
                <button type="button" className="link" onClick={() => void copy("addr", info.address)}>
                  {copied === "addr" ? t("inbox.copied") : t("inbox.copy")}
                </button>
              </div>
            </details>
          ))}
        </li>
        <li>
          <strong>{t("inbox.guide.wait")}</strong>
          <p className="hint">
            {info.lastInboxAt
              ? t("inbox.lastAt", { date: new Date(info.lastInboxAt).toLocaleString() })
              : info.waiting && info.waiting.length > 0
                ? t("inbox.stillWaiting", { names: info.waiting.join(", ") })
                : t("inbox.waiting")}
          </p>
        </li>
      </ol>
      <details className="inbox-more">
        <summary>{t("inbox.more")}</summary>
        <p className="hint">{t("inbox.moreFilter")}</p>
        <div className="vendor-row">
          {BILLING_SEATS.map((seat) => (
            <a key={seat.id} className="btn secondary" href={seat.href} target="_blank" rel="noopener noreferrer">
              {t("inbox.openVendor", { name: seat.name })}
            </a>
          ))}
        </div>
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
