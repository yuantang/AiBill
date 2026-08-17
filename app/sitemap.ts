import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  return [
    { url: new URL("/", base).toString(), changeFrequency: "weekly", priority: 1 },
    { url: new URL("/pricing", base).toString(), changeFrequency: "monthly", priority: 0.8 },
    { url: new URL("/privacy", base).toString(), changeFrequency: "yearly", priority: 0.3 },
  ];
}
