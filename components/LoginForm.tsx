"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useI18n } from "./I18nProvider";

export function LoginForm() {
  const { t } = useI18n();
  const [email, setEmail] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!email.trim()) {
      setError(t("login.needEmail"));
      return;
    }
    setBusy(true);
    setError(null);
    const res = await signIn("email", {
      email: email.trim(),
      callbackUrl: "/app",
      redirect: false,
    });
    setBusy(false);
    if (res?.error) {
      setError(t("login.sendFail"));
      return;
    }
    setSent(true);
  }

  if (sent) {
    return (
      <p className="ok" role="status">
        {t("login.sent")}
      </p>
    );
  }

  return (
    <form className="login-form" onSubmit={(event) => void onSubmit(event)}>
      <div className="field">
        <label htmlFor="email">{t("login.email")}</label>
        <input
          id="email"
          type="email"
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@studio.com"
        />
      </div>
      <button type="submit" className="btn" disabled={busy}>
        {busy ? t("login.sending") : t("login.send")}
      </button>
      {error ? (
        <p className="error" role="alert">
          {error}
        </p>
      ) : null}
    </form>
  );
}
