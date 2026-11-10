import type { MetadataRoute } from "next";

/** Search engines may read the public site; the dashboard, admin panel and API stay out of search results. */
export default function robots(): MetadataRoute.Robots {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/dashboard", "/admin", "/api", "/support/t/", "/reset-password", "/verify-email"] }],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
