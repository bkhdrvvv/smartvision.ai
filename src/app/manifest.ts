import type { MetadataRoute } from "next";

/** Installable app (PWA): "Install app" on Android / desktop Chrome, "Add to Home Screen" on iPhone. */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "SMARTVISION AI",
    short_name: "SmartVision",
    description: "AI video monitoring for schools, homes and farms",
    start_url: "/dashboard",
    scope: "/",
    display: "standalone",
    background_color: "#070b16",
    theme_color: "#070b16",
    orientation: "portrait",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icon.svg", sizes: "any", type: "image/svg+xml" },
    ],
  };
}
