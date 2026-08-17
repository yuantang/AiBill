import { waitingSeats } from "./coverage";
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
          ? "卡上已经扣过的，点选 Claude / Cursor / ChatGPT。或者看三封收据自己进来。空合计发不出去。"
          : "Tap Claude / Cursor / ChatGPT if the card already charged. Or watch three receipts land. An empty total is not a number you can send.",
      href: "#inbox",
      cta: locale === "zh" ? "去入账" : "Get charges in",
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

  const missing = waitingSeats(cash);
  if (missing.length > 0) {
    return {
      id: "missing",
      title: locale === "zh" ? `还缺 ${missing.join("、")}` : `Still missing ${missing.join(", ")}`,
      body:
        locale === "zh"
          ? "合计里没有这些席位。转发收据，或在下面点选已经扣过的。缺一行，发出去的数就不对。"
          : "Those seats are not in the total. Forward the receipt, or tap a plan the card already charged. A missing line is a number you cannot stand behind.",
      href: "#inbox",
      cta: locale === "zh" ? "补上收据" : "Add the receipt",
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
