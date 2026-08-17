import { describe, expect, it } from "vitest";
import { pageMeta, SEO, softwareJsonLd } from "./site";

describe("SEO helpers", () => {
  it("builds indexable public metadata with a canonical", () => {
    const meta = pageMeta({ title: SEO.title, description: SEO.description, path: "/" });
    expect(meta.alternates?.canonical).toMatch(/\/$/);
    expect(meta.robots).toEqual({ index: true, follow: true });
    expect(meta.openGraph?.title).toBe(SEO.title);
  });

  it("keeps private surfaces out of the index", () => {
    const meta = pageMeta({
      title: "This month",
      description: "Private bill",
      path: "/app",
      index: false,
    });
    expect(meta.robots).toEqual({ index: false, follow: false });
  });

  it("describes a finance app with a USD offer", () => {
    const json = softwareJsonLd();
    expect(json["@type"]).toBe("SoftwareApplication");
    expect(json.offers.priceCurrency).toBe("USD");
    expect(json.offers.price).toBe("5");
  });
});
