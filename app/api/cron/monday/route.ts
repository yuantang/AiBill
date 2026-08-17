import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { fetchFx } from "@/lib/fetch-costs";
import { parseLocale } from "@/lib/i18n/locales";
import { t } from "@/lib/i18n";
import { letterText } from "@/lib/insights";
import { budgetStatus, buildLedger, formatCny, monthKey, subtotals } from "@/lib/ledger";
import { toLine, toWindow } from "@/lib/lines";
import { syncSavedProviders } from "@/lib/sync";

export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization");
  if (!secret || header !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return NextResponse.json({ error: "mail is not configured" }, { status: 501 });
  }
  const fx = await fetchFx().catch(() => null);
  const users = await prisma.user.findMany({
    include: { lines: true, window: true, settings: true },
  });
  let sent = 0;
  for (const user of users) {
    if (!user.email) continue;
    const locale = parseLocale(user.settings && "locale" in user.settings ? user.settings.locale : "en");
    await syncSavedProviders(user.id).catch(() => undefined);
    const fresh = await prisma.billLine.findMany({ where: { userId: user.id }, orderBy: { createdAt: "asc" } });
    const ledger = buildLedger(fresh.map(toLine), toWindow(user.window), fx);
    const text = letterText(
      ledger,
      budgetStatus(ledger.totalCny, user.settings?.budgetCny ?? null, ledger.extrapolation?.cny ?? 0),
      new Date(),
      locale,
    );
    const sums = subtotals(fresh.map(toLine));
    await prisma.monthSnapshot.upsert({
      where: { userId_month: { userId: user.id, month: monthKey() } },
      create: {
        userId: user.id,
        month: monthKey(),
        totalCny: ledger.totalCny,
        subscriptionCny: sums.subscription,
        apiCny: sums.api,
        otherCny: sums.other,
        statement: text,
      },
      update: {
        totalCny: ledger.totalCny,
        subscriptionCny: sums.subscription,
        apiCny: sums.api,
        otherCny: sums.other,
        statement: text,
      },
    });
    if (user.settings && user.settings.emailEnabled === false) continue;
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: user.email,
        subject: t(locale, "generated.mailSubject", { amount: formatCny(ledger.totalCny, locale) }),
        text,
      }),
    });
    if (res.ok) sent += 1;
  }
  return NextResponse.json({ users: users.length, sent });
}
