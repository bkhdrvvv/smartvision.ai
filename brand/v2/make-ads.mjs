// Generates the ad creatives (Instagram post 1080x1080, story 1080x1920) as SVG.
// Change the contacts below, then run:  node brand/v2/make-ads.mjs   (then render to PNG)
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const C = {
  site: "smartvisionai.uz",
  instagram: "@bkhdrvvvv.7",
  telegram: "@zxc_bkhdrvv",
  phone: "+998 99 140 20 60", // e.g. "+998 90 123 45 67" — empty = not shown
};
const out = dirname(fileURLToPath(import.meta.url));
const F = `font-family="Segoe UI, Inter, Arial, sans-serif"`;

// simple line icons (24x24) instead of emoji — look the same on every phone
const ICONS = {
  globe: `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>`,
  instagram: `<rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.6" cy="6.4" r=".6" fill="currentColor"/>`,
  telegram: `<path d="M21.5 3.5 2.8 10.7c-.9.4-.9 1.6 0 1.9l4.6 1.6 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.8 3.5c.7.5 1.7.1 1.9-.7L23 4.9c.2-1-.7-1.8-1.5-1.4z"/><path d="m7.4 14.2 9.9-6.9-7 7.6"/>`,
  phone: `<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2z"/>`,
  school: `<path d="m4 6 8-4 8 4M18 10l4 2v8a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-8l4-2M6 5v17M18 5v17M14 22v-4a2 2 0 0 0-4 0v4"/><circle cx="12" cy="9" r="2"/>`,
  home: `<path d="M3 10.5 12 3l9 7.5V20a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><path d="M9 22v-8h6v8"/>`,
  farm: `<path d="M7 20h10M10 20c5.5-2.5.8-6.4 3-10"/><path d="M9.5 9.4c1.1.8 1.8 2.2 2.3 3.7-2 .4-3.5.4-4.8-.3-1.2-.6-2.3-1.9-3-4.2 2.8-.5 4.4 0 5.5.8zM14.1 6a7 7 0 0 0-1.1 4c1.9-.1 3.3-.6 4.3-1.4 1-1 1.6-2.3 1.7-4.6-2.7.1-4 1-4.9 2z"/>`,
  mobile: `<rect x="5" y="2" width="14" height="20" rx="2.5"/><path d="M11 18h2"/>`,
  user: `<circle cx="12" cy="8" r="4"/><path d="M4 21v-.5A6.5 6.5 0 0 1 10.5 14h3a6.5 6.5 0 0 1 6.5 6.5v.5"/>`,
  car: `<path d="M5 17H3v-4.5l2.2-5.1A2 2 0 0 1 7 6h10a2 2 0 0 1 1.8 1.4l2.2 5.1V17h-2M9 17h6"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M3.5 12h17"/>`,
  moon: `<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9z"/>`,
  alert: `<path d="M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0zM12 9v4M12 17h.01"/>`,
};
const ic = (name, x, y, s, color = "#e6edff") => `<use href="#i-${name}" x="${x}" y="${y}" width="${s}" height="${s}" color="${color}" style="color:${color}"/>`;

const defs = `<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#141b48"/><stop offset="1" stop-color="#05071a"/></linearGradient>
  <linearGradient id="ibg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#151b45"/><stop offset="1" stop-color="#070a1c"/></linearGradient>
  <linearGradient id="bl" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset=".55" stop-color="#3b82f6"/><stop offset="1" stop-color="#8b5cf6"/></linearGradient>
  <linearGradient id="hl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>
  <radialGradient id="core" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".45" stop-color="#a5f3fc"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
  <radialGradient id="halo" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#3b82f6" stop-opacity=".35"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></radialGradient>
  <linearGradient id="feed" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#0d1a3a"/><stop offset="1" stop-color="#050913"/></linearGradient>
  <pattern id="grid" width="36" height="36" patternUnits="userSpaceOnUse"><path d="M36 0H0V36" fill="none" stroke="#fff" stroke-opacity=".045"/></pattern>
  ${Object.entries(ICONS).map(([k, d]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${d}</symbol>`).join("")}
  <path id="blade" d="M256 192L311.43 224L404.4 277.7A150 150 0 0 0 349 138.3Z"/>
  <g id="icon">
    <rect width="512" height="512" rx="116" fill="url(#ibg)" stroke="#fff" stroke-opacity=".08" stroke-width="4"/>
    <g fill="url(#bl)" stroke="#0b0f26" stroke-width="7" stroke-linejoin="round">
      <use href="#blade"/><use href="#blade" transform="rotate(60 256 256)" opacity=".92"/><use href="#blade" transform="rotate(120 256 256)" opacity=".84"/>
      <use href="#blade" transform="rotate(180 256 256)" opacity=".76"/><use href="#blade" transform="rotate(240 256 256)" opacity=".86"/><use href="#blade" transform="rotate(300 256 256)" opacity=".95"/>
    </g>
    <circle cx="256" cy="256" r="46" fill="url(#core)"/><circle cx="256" cy="256" r="15" fill="#fff"/>
  </g>
</defs>`;

// fake live camera picture, local size 920x350
const feed = `<g>
  <rect width="920" height="350" rx="28" fill="url(#feed)" stroke="#fff" stroke-opacity=".12" stroke-width="2"/>
  <rect width="920" height="350" rx="28" fill="url(#grid)"/>
  <path d="M0 322H920" stroke="#3b82f6" stroke-opacity=".25" stroke-width="2"/>
  <rect x="26" y="24" width="96" height="36" rx="18" fill="#ef4444"/><circle cx="46" cy="42" r="6" fill="#fff"/>
  <text x="80" y="49" ${F} font-size="19" font-weight="800" fill="#fff" text-anchor="middle">LIVE</text>
  <text x="894" y="49" ${F} font-size="20" fill="#9fb0d8" text-anchor="end">Darvoza · Cam 02 · 02:14</text>
  <!-- person -->
  <circle cx="300" cy="150" r="25" fill="#2a3a6b"/><path d="M260 322V216q0-38 40-38t40 38V322Z" fill="#2a3a6b"/>
  <rect x="236" y="108" width="128" height="214" rx="6" fill="none" stroke="#22d3ee" stroke-width="4"/>
  <rect x="236" y="76" width="150" height="32" rx="6" fill="#22d3ee"/>
  <text x="248" y="99" ${F} font-size="19" font-weight="700" fill="#03121a">Odam · 97%</text>
  <!-- car -->
  <path d="M520 300v-38q0-14 14-16l46-6 40-34q10-8 24-8h96q14 0 24 10l34 32 28 6q14 4 14 18v36z" fill="#24305a"/>
  <circle cx="588" cy="304" r="22" fill="#0b1330" stroke="#3a4a80" stroke-width="5"/><circle cx="762" cy="304" r="22" fill="#0b1330" stroke="#3a4a80" stroke-width="5"/>
  <rect x="504" y="172" width="336" height="150" rx="6" fill="none" stroke="#a78bfa" stroke-width="4"/>
  <rect x="504" y="140" width="176" height="32" rx="6" fill="#a78bfa"/>
  <text x="516" y="163" ${F} font-size="19" font-weight="700" fill="#140a2e">Mashina · 94%</text>
  <rect x="26" y="290" width="168" height="36" rx="18" fill="#000" fill-opacity=".45" stroke="#5eead4" stroke-opacity=".6"/>
  ${ic("moon", 44, 298, 20, "#5eead4")}<text x="72" y="315" ${F} font-size="18" font-weight="600" fill="#ccfbf1">Night Vision</text>
</g>`;

// phone notification
const toast = (w = 620) => `<g>
  <rect width="${w}" height="104" rx="24" fill="#0b1226" fill-opacity=".96" stroke="#fff" stroke-opacity=".14" stroke-width="2"/>
  <use href="#icon" transform="translate(20 20) scale(.125)"/>
  ${ic("alert", 102, 24, 24, "#fbbf24")}<text x="134" y="44" ${F} font-size="22" font-weight="700" fill="#fff">Notanish odam aniqlandi</text>
  <text x="102" y="78" ${F} font-size="19" fill="#9fb0d8">Darvoza kamerasi · hozirgina · rasm bilan</text>
</g>`;

const contacts = (x, y, gap) => {
  const rows = [["globe", "", C.site, "#5eead4"], ["instagram", "Instagram ", C.instagram, "#f472b6"], ["telegram", "Telegram ", C.telegram, "#38bdf8"], ...(C.phone ? [["phone", "", C.phone, "#4ade80"]] : [])];
  return rows.map(([n, k, v, c], i) => `${ic(n, x, y + i * gap - 28, 34, c)}<text x="${x + 50}" y="${y + i * gap}" ${F} font-size="30" fill="#9fb0d8">${k}<tspan fill="#fff" font-weight="700">${v}</tspan></text>`).join("");
};
const brand = (x, y, s) => `<use href="#icon" transform="translate(${x} ${y}) scale(${s / 512})"/>
  <text x="${x + s + 22}" y="${y + s * 0.66}" ${F} font-size="${s * 0.42}" font-weight="800" letter-spacing="2" fill="#fff">SMARTVISION <tspan fill="url(#hl)">AI</tspan></text>`;
const chip = (x, y, icon, t, w, c) => `<rect x="${x}" y="${y}" width="${w}" height="58" rx="29" fill="#fff" fill-opacity=".06" stroke="#6aa8ff" stroke-opacity=".45" stroke-width="2"/>
  ${ic(icon, x + 22, y + 15, 28, c)}<text x="${x + 62}" y="${y + 38}" ${F} font-size="26" font-weight="600" fill="#e6edff">${t}</text>`;

const post = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1080" width="1080" height="1080">${defs}
  <rect width="1080" height="1080" fill="url(#sky)"/><rect width="1080" height="1080" fill="url(#grid)"/>
  <circle cx="900" cy="140" r="420" fill="url(#halo)"/>
  ${brand(80, 64, 84)}
  <text ${F} font-weight="800" fill="#fff"><tspan x="78" y="268" font-size="92">Kamerangiz endi</tspan><tspan x="78" y="370" font-size="92" fill="url(#hl)">o'ylaydi.</tspan></text>
  <text ${F} font-size="30" fill="#b8c7ea"><tspan x="80" y="422">Sun'iy intellekt odamni, mashinani va hayvonni taniydi —</tspan><tspan x="80" y="462">telefoningizga darhol xabar keladi.</tspan></text>
  <g transform="translate(80 500)">${feed}</g>
  <g transform="translate(440 796)">${toast(560)}</g>
  ${chip(80, 916, "school", "Maktab", 196, "#60a5fa")}${chip(292, 916, "home", "Uy", 132, "#5eead4")}${chip(440, 916, "farm", "Ferma", 172, "#4ade80")}${chip(628, 916, "mobile", "Telefondan", 232, "#a78bfa")}
  <path d="M80 1000H1000" stroke="#fff" stroke-opacity=".1" stroke-width="2"/>
  ${ic("globe", 80, 1024, 30, "#5eead4")}<text x="120" y="1048" ${F} font-size="27" font-weight="700" fill="#fff">${C.site}</text>
  ${ic("instagram", 392, 1024, 30, "#f472b6")}<text x="432" y="1048" ${F} font-size="27" font-weight="700" fill="#fff">${C.instagram}</text>
  ${ic("telegram", 662, 1024, 30, "#38bdf8")}<text x="702" y="1048" ${F} font-size="27" font-weight="700" fill="#fff">${C.telegram}</text>
</svg>`;

const feats = [
  ["user", "Notanish odam", "Begona kirsa — rasm bilan xabar", "#22d3ee"],
  ["car", "Mashina va hayvon", "Ferma va darvoza nazorati", "#a78bfa"],
  ["moon", "Night Vision", "Kechasi ham aniq ko'radi", "#5eead4"],
  ["mobile", "Istalgan joydan", "Jonli video telefoningizda", "#60a5fa"],
];
const story = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">${defs}
  <rect width="1080" height="1920" fill="url(#sky)"/><rect width="1080" height="1920" fill="url(#grid)"/>
  <circle cx="860" cy="260" r="520" fill="url(#halo)"/>
  ${brand(80, 130, 100)}
  <text ${F} font-weight="800" fill="#fff"><tspan x="76" y="400" font-size="112">Kamerangiz</tspan><tspan x="76" y="520" font-size="112">endi <tspan fill="url(#hl)">o'ylaydi.</tspan></tspan></text>
  <text ${F} font-size="36" fill="#b8c7ea"><tspan x="80" y="600">Maktab, uy va ferma uchun</tspan><tspan x="80" y="648">sun'iy intellektli kuzatuv.</tspan></text>
  <g transform="translate(80 720)">${feed}</g>
  <g transform="translate(300 1036)">${toast(700)}</g>
  ${feats.map(([e, t, s, c], i) => `<g transform="translate(80 ${1180 + i * 118})">
    <rect width="920" height="98" rx="24" fill="#fff" fill-opacity=".05" stroke="#fff" stroke-opacity=".1" stroke-width="2"/>
    <rect x="22" y="19" width="60" height="60" rx="16" fill="${c}" fill-opacity=".14"/>${ic(e, 36, 33, 32, c)}
    <text x="104" y="45" ${F} font-size="30" font-weight="700" fill="#fff">${t}</text>
    <text x="104" y="80" ${F} font-size="24" fill="#9fb0d8">${s}</text></g>`).join("")}
  <rect x="80" y="1670" width="920" height="${C.phone ? 200 : 170}" rx="28" fill="url(#bl)" fill-opacity=".14" stroke="#6aa8ff" stroke-opacity=".45" stroke-width="2"/>
  ${contacts(120, 1722, 46)}
</svg>`;

writeFileSync(join(out, "ad-post-1080.svg"), post);
writeFileSync(join(out, "ad-story-1080x1920.svg"), story);
console.log("ok");
