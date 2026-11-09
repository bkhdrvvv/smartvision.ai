"use client";

import { useEffect } from "react";

/** Remembers ?ref=<code> (invite-a-friend link) for 30 days so the sign-up can credit the friend. */
export function RefCapture() {
  useEffect(() => {
    try {
      const ref = new URLSearchParams(window.location.search).get("ref");
      if (ref && /^[A-Za-z0-9_-]{4,40}$/.test(ref)) document.cookie = `sv_ref=${ref}; path=/; max-age=${30 * 86400}; samesite=lax`;
    } catch {}
  }, []);
  return null;
}
