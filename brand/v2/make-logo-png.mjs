// Renders the full logo (icon + "SMARTVISION AI") to PNG with headless Edge.
// Usage: node brand/v2/make-logo-png.mjs  → brand/v2/logo-full-dark.png, logo-full-transparent.png, logo-icon-1024.png
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const dir = dirname(fileURLToPath(import.meta.url));
const icon = readFileSync(join(dir, "logo-icon.svg"), "utf8").replace(/<!--.*?-->/g, "");
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const page = (bg, w, h, iconOnly = false) => `<!doctype html><html><head><meta charset="utf-8">
<link href="https://fonts.googleapis.com/css2?family=Inter+Tight:wght@800;900&display=swap" rel="stylesheet">
<style>html,body{margin:0;width:${w}px;height:${h}px;background:${bg};overflow:hidden}
.wrap{width:100%;height:100%;display:flex;align-items:center;justify-content:center;gap:${iconOnly ? 0 : 56}px;font-family:'Inter Tight',sans-serif}
.ic{width:${iconOnly ? w : 300}px;height:${iconOnly ? h : 300}px;filter:${iconOnly ? "none" : "drop-shadow(0 0 40px rgba(59,130,246,.55))"}}
.ic svg{width:100%;height:100%}
.t{font-size:132px;font-weight:900;letter-spacing:2px;color:#fff;white-space:nowrap;line-height:1}
.ai{background:linear-gradient(90deg,#22d3ee,#a78bfa);-webkit-background-clip:text;background-clip:text;color:transparent;margin-left:28px}
.sub{font-size:34px;font-weight:800;letter-spacing:10px;color:#94a3b8;margin-top:22px}</style></head>
<body><div class="wrap"><div class="ic">${icon}</div>${iconOnly ? "" : `<div><div class="t">SMARTVISION<span class="ai">AI</span></div><div class="sub">AI VIDEO MONITORING</div></div>`}</div></body></html>`;

const proc = spawn("C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe", ["--headless=new", "--remote-debugging-port=9397", `--user-data-dir=${process.env.TEMP}\\svlogo`, "--no-first-run", "about:blank"], { stdio: "ignore" });
let wsUrl;
for (let i = 0; i < 60 && !wsUrl; i++) { await sleep(300); try { wsUrl = (await (await fetch("http://127.0.0.1:9397/json/list")).json()).find((x) => x.type === "page")?.webSocketDebuggerUrl; } catch {} }
const ws = new WebSocket(wsUrl);
await new Promise((r) => (ws.onopen = r));
let id = 0; const pend = new Map();
ws.onmessage = (m) => { const j = JSON.parse(m.data); if (j.id && pend.has(j.id)) pend.get(j.id)(j), pend.delete(j.id); };
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pend.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
await send("Page.enable");
const jobs = [
  ["logo-full-dark.png", "radial-gradient(ellipse at 30% 40%,#141c48,#070b16 70%)", 2000, 640, false],
  ["logo-full-transparent.png", "transparent", 2000, 640, false],
  ["logo-icon-1024.png", "transparent", 1024, 1024, true],
];
for (const [file, bg, w, h, iconOnly] of jobs) {
  const html = join(process.env.TEMP, "sv-logo.html");
  writeFileSync(html, page(bg, w, h, iconOnly));
  await send("Emulation.setDeviceMetricsOverride", { width: w, height: h, deviceScaleFactor: 1, mobile: false });
  await send("Emulation.setDefaultBackgroundColorOverride", { color: { r: 0, g: 0, b: 0, a: 0 } });
  await send("Page.navigate", { url: "file:///" + html.replace(/\\/g, "/") });
  await sleep(2500);
  const s = await send("Page.captureScreenshot", { format: "png" });
  writeFileSync(join(dir, file), Buffer.from(s.result.data, "base64"));
  console.log("wrote", file);
}
ws.close(); proc.kill(); process.exit(0);
