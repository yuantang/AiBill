import { formatCny } from "./ledger";
import { findOverlaps } from "./stack";
import type { Locale } from "./i18n/locales";
import type { Line } from "./types";

export type NextAction = {
  id: "empty" | "missing" | "overlap" | "send";
  title: string;
  body: string;
  href: string;
  cta: string;
  saveCny?: number;
};

export function nextAction(lines: Line[], totalCny: number, locale: Locale = "en"): NextAction {
  const cash = lines.filter((line) => line.includedInTotal);
  const money = (n: number) => formatCny(n, locale);

  if (cash.length === 0) {
    return {
      id: "empty",
      title: locale === "zh" ? "这个月还是空的" : "This month is still empty",
      body:
        locale === "zh"
          ? "这个月已经扣过的，在下面贴收据；或者等下一次转发进来。空合计发不出去。"
          : "Paste this month’s receipts below, or wait for the next forwarded charge. An empty total is not a number you can send.",
      href: "#inbox",
      cta: locale === "zh" ? "转发或粘贴收据" : "Forward or paste a receipt",
    };
  }

  const overlap = findOverlaps(lines, locale)
    .filter((item) => item.kind !== "seat_and_api")
    .sort((a, b) => b.amountCny - a.amountCny)[0];
  if (overlap) {
    return {
      id: "overlap",
      title:
        locale === "zh"
          ? `同时在付 ${overlap.names.length} 个编程席位`
          : `Paying ${overlap.names.length} coding seats at once`,
      body: overlap.body,
      href: "/app/forecast",
      cta: locale === "zh" ? "看取消哪个" : "See what to drop",
      saveCny: overlap.amountCny,
    };
  }

  return {
    id: "send",
    title: locale === "zh" ? `发出 ${money(totalCny)}` : `Send ${money(totalCny)}`,
    body:
      locale === "zh"
        ? "这是卡 + 发票。不是 token 估算。发给自己或合伙人。"
        : "This is card + invoices. Not a token estimate. Send it to yourself or a cofounder.",
    href: "/app/statement",
    cta: locale === "zh" ? "打开对账单" : "Open the statement",
  };
}
