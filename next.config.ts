import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
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
      {
        source: "/(.*)",
        headers: [
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
