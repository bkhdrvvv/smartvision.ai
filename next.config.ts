import type { NextConfig } from "next";

const https = (process.env.NEXT_PUBLIC_SITE_URL ?? "").startsWith("https://");

// Content-Security-Policy: what the browser may load. Inline scripts are needed by Next.js itself;
// jsdelivr + Google storage only for the in-browser AI demo (TensorFlow.js + COCO-SSD model files).
// The AI demo page (/try) alone also gets 'unsafe-eval': TensorFlow.js compiles its kernels at runtime.
const csp = (evalOk = false) => [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${evalOk ? " 'unsafe-eval'" : ""} https://cdn.jsdelivr.net`,
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' data: https://fonts.gstatic.com",
  // http: — customers' own cameras on their local network (e.g. http://192.168.1.6:8097/cam-01.mjpg)
  "img-src 'self' data: blob: http: https:",
  "media-src 'self' blob:",
  "connect-src 'self' https://cdn.jsdelivr.net https://storage.googleapis.com https://tfhub.dev https://www.kaggle.com https://*.kaggle.com https://*.kaggleusercontent.com",
  "worker-src 'self' blob:",
  "frame-src https://www.openstreetmap.org", // the map on the contact page
  "frame-ancestors 'none'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self' https://accounts.google.com",
].join("; ");

const common = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // own pages only: microphone (voice messages in the support chat), camera (live AI demo); never in other sites' frames
  { key: "Permissions-Policy", value: "camera=(self), microphone=(self), geolocation=()" },
  // HTTPS only (behind a real domain): browsers must never use plain http for this site again
  ...(https ? [{ key: "Strict-Transport-Security", value: "max-age=31536000; includeSubDomains" }] : []),
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false, // don't tell attackers which framework runs the site
  // `next dev` writes to its own folder, so running it can never break the production build in .next
  // (NEXT_DIST_DIR overrides, e.g. .next-prod to build while the site keeps serving .next)
  distDir: process.env.NEXT_DIST_DIR || (process.env.NODE_ENV === "development" || process.argv.includes("dev") ? ".next-dev" : ".next"),
  outputFileTracingRoot: __dirname,
  transpilePackages: ["three"],
  experimental: {
    serverActions: { bodySizeLimit: "6mb" },
  },
  async headers() {
    return [
      // every page except /try: strict CSP
      { source: "/((?!try$).*)", headers: [...common, { key: "Content-Security-Policy", value: csp() }] },
      { source: "/try", headers: [...common, { key: "Content-Security-Policy", value: csp(true) }] },
    ];
  },
};

export default nextConfig;
