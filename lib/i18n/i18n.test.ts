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
    expect(t("zh", "inbox.how.cursor")).toContain("Manage Subscription");
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
