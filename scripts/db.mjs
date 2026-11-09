// Local PostgreSQL 17 (real server, many connections) — replaces `prisma dev` for local work.
// Usage:  node scripts/db.mjs          start (first run initialises ./.pgdata and creates the database)
// Stop with Ctrl+C — the server is shut down cleanly (no corrupted / stuck database).
// Connection: postgres://smartvision:<PG_PASSWORD>@127.0.0.1:54329/smartvision_utf8  (PG_PASSWORD from .env)
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
const env = existsSync(join(root, ".env")) ? readFileSync(join(root, ".env"), "utf8") : "";
const password = process.env.PG_PASSWORD || /^PG_PASSWORD="?([^"\n]+)"?/m.exec(env)?.[1];
if (!password) {
  console.error("PG_PASSWORD is missing in .env");
  process.exit(1);
}
const port = Number(process.env.PG_PORT || /^PG_PORT="?(\d+)"?/m.exec(env)?.[1] || 54329);
const dataDir = join(root, ".pgdata");

// `node scripts/db.mjs stop` — clean shutdown of a running server (used by stop.bat)
if (process.argv[2] === "stop") {
  const { execFileSync } = await import("node:child_process");
  const { createRequire } = await import("node:module");
  const bin = join(createRequire(import.meta.url).resolve("@embedded-postgres/windows-x64"), "..", "..", "native", "bin", "pg_ctl.exe");
  try {
    execFileSync(bin, ["stop", "-D", dataDir, "-m", "fast", "-w"], { stdio: "inherit" });
  } catch {
    console.log("PostgreSQL was not running");
  }
  process.exit(0);
}
const fresh = !existsSync(join(dataDir, "PG_VERSION"));

// UTF-8 always (a Windows default like WIN1251 cannot store emoji or many letters)
const pg = new EmbeddedPostgres({ databaseDir: dataDir, user: "smartvision", password, port, persistent: true, initdbFlags: ["--encoding=UTF8"], onLog: () => {}, onError: (e) => console.error("[pg]", String(e).trim()) });

let stopping = false;
async function shutdown() {
  if (stopping) return;
  stopping = true;
  console.log("stopping PostgreSQL…");
  await pg.stop().catch(() => {});
  console.log("PostgreSQL stopped cleanly");
  process.exit(0);
}
process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
process.on("SIGBREAK", shutdown); // Windows console close / Ctrl+Break

if (fresh) {
  console.log("initialising a new database cluster in .pgdata …");
  await pg.initialise();
}
await pg.start();
if (fresh) await pg.createDatabase("smartvision_utf8");
console.log(`PostgreSQL ready on localhost:${port} (database "smartvision"). Press Ctrl+C to stop.`);
setInterval(() => {}, 1 << 30); // keep running
