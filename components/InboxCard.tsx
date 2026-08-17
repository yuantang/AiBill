"use client";

import { useEffect, useRef, useState } from "react";
import { sampleInboundLines } from "@/lib/inbox-sample";
import type { InboxStatus } from "@/lib/inbox";
import type { Line } from "@/lib/types";
import { BILLING_SEATS, GMAIL_FILTERS_URL, GMAIL_FORWARDING_URL } from "@/lib/vendors";
import { useI18n } from "./I18nProvider";

type InboxInfo = {
  address: string;
  status: InboxStatus;
  confirm: { code: string | null; link: string | null; receivedAt: string } | null;
  lastReceiptAt: string | null;
  waiting?: string[];
  seats?: { id: string; name: string; from: string; contains: string }[];
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
  const [waitedOut, setWaitedOut] = useState(false);
  const [pollGen, setPollGen] = useState(0);
  const copyTimer = useRef<number | null>(null);

  async function load() {
    const res = await fetch("/api/inbox");
    if (!res.ok) throw new Error(t("inbox.loadFail"));
    return (await res.json()) as InboxInfo;
  }

  useEffect(() => {
    if (mode !== "cloud") return;
    let cancelled = false;
    void load()
      .then((data) => {
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, t]);

  useEffect(() => {
    if (mode !== "cloud" || info?.status !== "unverified") return;
    const started = Date.now();
    const tick = window.setInterval(() => {
      if (Date.now() - started > 10 * 60 * 1000) {
        setWaitedOut(true);
        window.clearInterval(tick);
        return;
      }
      void load()
        .then((data) => setInfo(data))
        .catch(() => undefined);
    }, 4000);
    return () => window.clearInterval(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, info?.status, pollGen]);

  async function copy(kind: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      if (copyTimer.current != null) window.clearTimeout(copyTimer.current);
      copyTimer.current = window.setTimeout(() => setCopied(null), 1600);
    } catch {
      setNoteKind("err");
      setNote(t("inbox.copyFail"));
    }
  }

  function landDemo() {
    onLines?.(sampleInboundLines());
    setNoteKind("ok");
    setNote(t("inbox.demoOk"));
  }

  async function ack() {
    setBusy("ack");
    try {
      const res = await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ack: true }),
      });
      const data = (await res.json()) as InboxInfo & { error?: string };
      if (!res.ok) throw new Error(data.error ?? t("inbox.ackFail"));
      setInfo(data);
      setNoteKind("ok");
      setNote(t("inbox.acked"));
    } catch (err) {
      setNoteKind("err");
      setNote(err instanceof Error ? err.message : t("inbox.ackFail"));
    } finally {
      setBusy(null);
    }
  }

  async function sendTest() {
    setBusy("test");
    try {
      const res = await fetch("/api/inbox/test", { method: "POST" });
      const data = (await res.json()) as { lines?: Line[]; saved?: boolean; error?: string };
      if (!res.ok || !data.saved) throw new Error(data.error ?? t("inbox.testFail"));
      if (data.lines?.length) onLines?.(data.lines);
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
      const res = await fetch("/api/inbox", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rotate: true }),
      });
      const data = (await res.json()) as InboxInfo;
      if (!res.ok) throw new Error(t("inbox.rotateFail"));
      setInfo(data);
      setWaitedOut(false);
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

  const seats = info.seats?.length ? info.seats : BILLING_SEATS;
  const cursor = seats[0];
  const status = info.status ?? "unverified";

  return (
    <div className="inbox-card">
      <div className="inbox-addr">
        <code>{info.address}</code>
        <button type="button" className="btn" onClick={() => void copy("addr", info.address)}>
          {copied === "addr" ? t("inbox.copied") : t("inbox.copy")}
        </button>
      </div>

      {status === "unverified" ? (
        <>
          <h3 className="setup-h">{t("inbox.rail.unverifiedTitle")}</h3>
          <p className="hint">{t("inbox.rail.unverifiedBody")}</p>
          <a className="btn" href={GMAIL_FORWARDING_URL} target="_blank" rel="noopener noreferrer">
            {t("inbox.rail.openForwarding")}
          </a>
          <ol className="setup-ol">
            <li>{t("inbox.rail.addStep1")}</li>
            <li>{t("inbox.rail.addStep2")}</li>
            <li>{t("inbox.rail.addStep3")}</li>
          </ol>
          <p className="hint">{waitedOut ? t("inbox.rail.stillWaiting") : t("inbox.rail.waitingConfirm")}</p>
          {waitedOut ? (
            <button
              type="button"
              className="btn secondary"
              onClick={() => {
                setWaitedOut(false);
                setPollGen((n) => n + 1);
                void load()
                  .then(setInfo)
                  .catch(() => undefined);
              }}
            >
              {t("inbox.rail.checkAgain")}
            </button>
          ) : null}
        </>
      ) : null}

      {status === "confirm_received" ? (
        <>
          <h3 className="setup-h">{t("inbox.rail.confirmTitle")}</h3>
          <p className="hint">{t("inbox.rail.confirmBody")}</p>
          {info.confirm?.code ? (
            <div className="inbox-addr">
              <code>{info.confirm.code}</code>
              <button type="button" className="btn" onClick={() => void copy("code", info.confirm!.code!)}>
                {copied === "code" ? t("inbox.copied") : t("inbox.rail.copyCode")}
              </button>
            </div>
          ) : null}
          {info.confirm?.link ? (
            <p>
              <a className="btn secondary" href={info.confirm.link} target="_blank" rel="noopener noreferrer">
                {t("inbox.rail.openLink")}
              </a>
            </p>
          ) : null}
          {!info.confirm?.code && !info.confirm?.link ? <p className="error">{t("inbox.rail.confirmEmpty")}</p> : null}
          <button
            type="button"
            className="btn"
            disabled={busy != null || (!info.confirm?.code && !info.confirm?.link)}
            onClick={() => void ack()}
          >
            {busy === "ack" ? t("inbox.rail.acking") : t("inbox.rail.acked")}
          </button>
        </>
      ) : null}

      {status === "first_receipt" ? (
        <>
          <h3 className="setup-h">{t("inbox.rail.doneTitle")}</h3>
          <p className="ok" role="status">
            {info.lastReceiptAt
              ? t("inbox.lastAt", { date: new Date(info.lastReceiptAt).toLocaleString() })
              : t("inbox.rail.doneBody")}
          </p>
          {info.waiting && info.waiting.length > 0 ? (
            <p className="hint">{t("inbox.stillWaiting", { names: info.waiting.join(", ") })}</p>
          ) : (
            <p className="hint">{t("inbox.seatsIn")}</p>
          )}
        </>
      ) : null}

      {status === "filter_ready" ? (
        <>
          <h3 className="setup-h">{t("inbox.rail.filterTitle")}</h3>
          <p className="hint">{t("inbox.rail.filterBody")}</p>
          <a className="btn" href={GMAIL_FILTERS_URL} target="_blank" rel="noopener noreferrer">
            {t("inbox.guide.openGmail")}
          </a>
          {cursor ? (
            <table className="setup-table">
              <tbody>
                <tr>
                  <th>{t("inbox.guide.from")}</th>
                  <td>
                    <code>{cursor.from}</code>
                    <button type="button" className="link" onClick={() => void copy("from", cursor.from)}>
                      {copied === "from" ? t("inbox.copied") : t("inbox.copy")}
                    </button>
                  </td>
                </tr>
                <tr>
                  <th>{t("inbox.guide.contains")}</th>
                  <td>
                    <code>{cursor.contains}</code>
                    <button type="button" className="link" onClick={() => void copy("has", cursor.contains)}>
                      {copied === "has" ? t("inbox.copied") : t("inbox.copy")}
                    </button>
                  </td>
                </tr>
                <tr>
                  <th>{t("inbox.guide.leave")}</th>
                  <td>{t("inbox.guide.leaveVal")}</td>
                </tr>
              </tbody>
            </table>
          ) : null}
          <p className="hint">{t("inbox.rail.filterNext")}</p>
          <p className="hint">{t("inbox.rail.filterOthers")}</p>
          {info.waiting && info.waiting.length > 0 ? (
            <p className="hint">{t("inbox.stillWaiting", { names: info.waiting.join(", ") })}</p>
          ) : (
            <p className="hint">{t("inbox.seatsIn")}</p>
          )}
        </>
      ) : null}

      <details className="inbox-more">
        <summary>{t("inbox.more")}</summary>
        <p className="hint">{t("inbox.moreFilter")}</p>
        <div className="actions">
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
