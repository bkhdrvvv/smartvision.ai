// Start everything the site needs, in order: PostgreSQL (if it is not running yet) → the site on port 3000.
// Used by .claude/launch.json and `npm run serve`. Ctrl+C stops the site and the database it started.
import { spawn } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import net from "node:net";
import { join } from "node:path";

const root = process.cwd();
const env = existsSync(join(root, ".env")) ? readFileSync(join(root, ".env"), "utf8") : "";
const dbPort = Number(/^PG_PORT="?(\d+)"?/m.exec(env)?.[1] || 54329);
const sitePort = Number(process.env.PORT || 3000);
const node = process.execPath;

const isOpen = (port) =>
  new Promise((res) => {
    const s = net.connect({ port, host: "127.0.0.1" }, () => (s.destroy(), res(true)));
    s.on("error", () => res(false));
    s.setTimeout(1000, () => (s.destroy(), res(false)));
  });

let db = null;
if (await isOpen(dbPort)) {
  console.log(`[serve] PostgreSQL already running on ${dbPort}`);
} else {
  console.log("[serve] starting PostgreSQL …");
  db = spawn(node, [join(root, "scripts", "db.mjs")], { stdio: "inherit" });
  for (let i = 0; i < 120 && !(await isOpen(dbPort)); i++) await new Promise((r) => setTimeout(r, 500));
  if (!(await isOpen(dbPort))) {
    console.error("[serve] PostgreSQL did not start — see the messages above");
    process.exit(1);
  }
}

console.log(`[serve] starting the site on http://localhost:${sitePort} …`);
const site = spawn(node, [join(root, "node_modules", "next", "dist", "bin", "next"), "start", "-p", String(sitePort)], { stdio: "inherit" });

let stopping = false;
async function stop() {
  if (stopping) return;
  stopping = true;
  site.kill();
  if (db) {
    // clean database shutdown (no stuck / corrupted data)
    await new Promise((r) => spawn(node, [join(root, "scripts", "db.mjs"), "stop"], { stdio: "inherit" }).on("exit", r));
    db.kill();
  }
  process.exit(0);
}
for (const s of ["SIGINT", "SIGTERM", "SIGBREAK"]) process.on(s, stop);
site.on("exit", (code) => {
  if (!stopping) {
    console.error(`[serve] the site stopped (code ${code})`);
    stop();
  }
});
