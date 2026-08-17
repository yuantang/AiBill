import { describe, expect, it } from "vitest";
import { t } from "./index";
import { detectBrowserLocale, parseLocale } from "./locales";

describe("i18n", () => {
  it("falls back to English for missing overlay keys", () => {
    expect(t("ja", "brand.name")).toBe("AI Bill");
  });

  it("translates Chinese product chrome", () => {
    expect(t("zh", "nav.forecast")).toBe("预测");
    expect(t("zh", "bill.title")).toBe("你真正付出去的");
    expect(t("en", "bill.sendNumber")).toBe("Send this number");
    expect(t("zh", "bill.invoicesTitle")).toContain("发票");
    expect(t("zh", "inbox.guide.from")).toBe("发件人");
    expect(t("zh", "inbox.guide.contains")).toBe("包含字词");
    expect(t("en", "inbox.openVendor", { name: "Cursor" })).toBe("Open Cursor billing");
    expect(t("en", "inbox.rail.unverifiedBody")).toContain("Forwarding");
    expect(t("zh", "inbox.rail.acked")).toBe("我已在 Gmail 里确认");
  });

  it("never tells users to set a Cursor billing email", () => {
    const keys = [
      "landing.step2",
      "inbox.signIn",
      "inbox.stepBilling",
      "inbox.copiedGo",
      "inbox.how.cursor",
      "inbox.how.claude",
      "inbox.how.chatgpt",
      "onboard.inboxHint",
    ] as const;
    for (const locale of ["en", "zh"] as const) {
      for (const key of keys) {
        const text = t(locale, key, { name: "Cursor" }).toLowerCase();
        expect(text).not.toMatch(/set it as the billing email/);
        expect(text).not.toMatch(/paste it as the billing email/);
        expect(text).not.toMatch(/把它设成账单邮箱/);
        expect(text).not.toMatch(/改成账单邮箱/);
        expect(text).not.toMatch(/贴成账单邮箱/);
      }
    }
    expect(t("en", "inbox.rail.unverifiedBody")).toMatch(/no billing-email field/i);
    expect(t("zh", "inbox.rail.unverifiedBody")).toContain("没有账单邮箱栏");
  });

  it("empty-month and filter-set copy stay paste-first", () => {
    expect(t("en", "inbox.rail.filterSet").toLowerCase()).toMatch(/filter|forward/);
    expect(t("zh", "inbox.rail.filterSet")).toMatch(/过滤|转发/);
    expect(t("en", "inbox.rail.forwardNow").toLowerCase()).toMatch(/forward|paste/);
    expect(t("zh", "inbox.rail.forwardNow")).toMatch(/转发|贴/);
    expect(t("en", "bill.keysTeaser")).toMatch(/Admin Key|invoice/i);
    expect(t("en", "statement.empty")).toMatch(/no cash total/i);
  });

  it("interpolates placeholders", () => {
    expect(t("en", "bill.signedIn", { email: "a@b.com" })).toContain("a@b.com");
    expect(t("zh", "bill.kicker", { month: "2026-08" })).toContain("2026-08");
  });

  it("parses browser languages", () => {
    expect(parseLocale("zh-CN")).toBe("zh");
    expect(parseLocale("pt-BR")).toBe("pt");
    expect(parseLocale("zz")).toBe("en");
    expect(detectBrowserLocale(["fr-FR", "en"])).toBe("fr");
  });
});
