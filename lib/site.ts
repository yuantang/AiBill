import type { Metadata } from "next";
import { PRODUCT } from "./product";

export function siteUrl(): URL {
  const fromEnv = process.env.AUTH_URL ?? process.env.NEXT_PUBLIC_SITE_URL;
  if (fromEnv) return new URL(fromEnv);
  if (process.env.VERCEL_URL) return new URL(`https://${process.env.VERCEL_URL}`);
  return new URL("http://localhost:3456");
}

export const SEO = {
  title: "AI Bill: what you actually paid this month",
  description:
    "One USD total across Claude, Cursor, ChatGPT, and API invoices. Subscriptions at the card charge. Not token × list price.",
  pricingTitle: "Pricing · $5/mo for a number you can send",
  pricingDescription: `Local is free. $${PRODUCT.priceUsd}/month keeps invoices refreshing overnight and mails Monday. Less than one forgotten API day.`,
  privacyTitle: "Privacy · what AI Bill keeps",
  privacyDescription:
    "Email, cash lines, and Admin Keys you choose to save. Keys are encrypted. Forwarded receipts are parsed and discarded. Not a bank statement.",
} as const;

export function pageMeta(input: {
  title: string;
  description: string;
  path: string;
  index?: boolean;
}): Metadata {
  const url = new URL(input.path, siteUrl()).toString();
  const index = input.index ?? true;
  return {
    title: input.title,
    description: input.description,
    alternates: { canonical: url },
    robots: index ? { index: true, follow: true } : { index: false, follow: false },
    openGraph: {
      title: input.title,
      description: input.description,
      url,
      siteName: PRODUCT.name,
      type: "website",
      locale: "en_US",
    },
    twitter: {
      card: "summary_large_image",
      title: input.title,
      description: input.description,
    },
  };
}

export function softwareJsonLd() {
  const url = siteUrl().toString();
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: PRODUCT.name,
    applicationCategory: "FinanceApplication",
    operatingSystem: "Web",
    url,
    description: SEO.description,
    offers: {
      "@type": "Offer",
      price: String(PRODUCT.priceUsd),
      priceCurrency: "USD",
      url: new URL("/pricing", url).toString(),
    },
  };
}
