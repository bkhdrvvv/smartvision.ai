import type { MetadataRoute } from "next";

/** Public pages for search engines (Google, Yandex). Private pages (dashboard, admin) are never listed. */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();
  const pages: [string, number, MetadataRoute.Sitemap[number]["changeFrequency"]][] = [
    ["/", 1, "weekly"],
    ["/pricing", 0.9, "weekly"],
    ["/solutions/school", 0.9, "monthly"],
    ["/solutions/home", 0.9, "monthly"],
    ["/solutions/farm", 0.9, "monthly"],
    ["/demo", 0.8, "monthly"],
    ["/try", 0.8, "monthly"],
    ["/test", 0.7, "monthly"],
    ["/about", 0.6, "monthly"],
    ["/contact", 0.6, "monthly"],
    ["/support", 0.5, "monthly"],
    ["/register", 0.5, "yearly"],
    ["/terms", 0.3, "yearly"],
    ["/privacy", 0.3, "yearly"],
  ];
  return pages.map(([path, priority, changeFrequency]) => ({ url: `${base}${path}`, lastModified: now, changeFrequency, priority }));
}
