/**
 * Runs once when the server starts. Starts a light scheduler that calls the internal /api/cron route
 * every 10 minutes: subscription expiry, the "3 days left" reminder emails, snapshot retention and the daily DB backup
 * now happen on time even if nobody opens the site.
 * (Uses the global Web Crypto API — a `node:crypto` import here would break the edge build of this file.)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  const digest = await globalThis.crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${process.env.AUTH_SECRET}:cron`));
  const key = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
  const port = process.env.PORT || "3000";
  const tick = () =>
    fetch(`http://127.0.0.1:${port}/api/cron`, { method: "POST", headers: { "x-cron-key": key } })
      .then((r) => (r.ok ? null : console.error("[cron]", r.status)))
      .catch(() => {}); // server not listening yet on the first tick — the next one will work
  setTimeout(tick, 30_000);
  setInterval(tick, 10 * 60_000);
  // Telegram bot: read new /start and /stop messages (no-op until the admin adds a bot token)
  const tg = () => fetch(`http://127.0.0.1:${port}/api/telegram/poll`, { method: "POST", headers: { "x-cron-key": key } }).catch(() => {});
  setInterval(tg, 4_000);
}
