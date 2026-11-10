// Premium ad creatives: black, one big glowing shutter, few words.
// Instagram post 1080x1350 (4:5) and story 1080x1920.  Run: node brand/v2/make-ads-premium.mjs
import { writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const C = { site: "smartvisionai.uz", instagram: "bkhdrvvvv.7", telegram: "zxc_bkhdrvv", phone: "+998 99 140 20 60" };
const out = dirname(fileURLToPath(import.meta.url));
const F = `font-family="Segoe UI, Inter, Helvetica Neue, Arial, sans-serif"`;

const ICONS = {
  globe: `<circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20M2 12h20"/>`,
  instagram: `<rect x="2" y="2" width="20" height="20" rx="5.5"/><circle cx="12" cy="12" r="4.2"/><circle cx="17.6" cy="6.4" r=".6" fill="currentColor"/>`,
  telegram: `<path d="M21.5 3.5 2.8 10.7c-.9.4-.9 1.6 0 1.9l4.6 1.6 1.8 5.6c.3.8 1.3 1 1.9.4l2.6-2.5 4.8 3.5c.7.5 1.7.1 1.9-.7L23 4.9c.2-1-.7-1.8-1.5-1.4z"/><path d="m7.4 14.2 9.9-6.9-7 7.6"/>`,
  phone: `<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 1.9.7 2.8a2 2 0 0 1-.5 2.1L8 9.9a16 16 0 0 0 6 6l1.3-1.3a2 2 0 0 1 2.1-.4c.9.3 1.8.6 2.8.7a2 2 0 0 1 1.8 2z"/>`,
};
const ic = (n, x, y, s, c = "#c9cfdb") => `<use href="#i-${n}" x="${x}" y="${y}" width="${s}" height="${s}" style="color:${c}"/>`;

const defs = `<defs>
  ${Object.entries(ICONS).map(([k, d]) => `<symbol id="i-${k}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">${d}</symbol>`).join("")}
  <radialGradient id="vig" cx=".5" cy=".42" r=".75"><stop offset="0" stop-color="#0c1226"/><stop offset=".55" stop-color="#03040a"/><stop offset="1" stop-color="#000"/></radialGradient>
  <linearGradient id="metal" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#3a4258"/><stop offset=".35" stop-color="#171b27"/><stop offset="1" stop-color="#07080d"/></linearGradient>
  <linearGradient id="ring" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#67e8f9"/><stop offset=".5" stop-color="#3b82f6" stop-opacity=".5"/><stop offset="1" stop-color="#a78bfa"/></linearGradient>
  <linearGradient id="word" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#a5f3fc"/><stop offset=".5" stop-color="#ffffff"/><stop offset="1" stop-color="#c4b5fd"/></linearGradient>
  <linearGradient id="hair" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".5" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
  <radialGradient id="core" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#fff"/><stop offset=".3" stop-color="#cffafe"/><stop offset=".7" stop-color="#22d3ee" stop-opacity=".35"/><stop offset="1" stop-color="#22d3ee" stop-opacity="0"/></radialGradient>
  <radialGradient id="bloom" cx=".5" cy=".5" r=".5"><stop offset="0" stop-color="#38bdf8" stop-opacity=".55"/><stop offset=".4" stop-color="#3b82f6" stop-opacity=".18"/><stop offset="1" stop-color="#3b82f6" stop-opacity="0"/></radialGradient>
  <linearGradient id="flare" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#67e8f9" stop-opacity="0"/><stop offset=".5" stop-color="#e0fbff" stop-opacity=".9"/><stop offset="1" stop-color="#67e8f9" stop-opacity="0"/></linearGradient>
  <filter id="blur" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="6"/></filter>
  <filter id="soft" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="2"/></filter>
  <filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" stitchTiles="stitch"/><feColorMatrix values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 1  0 0 0 .05 0"/></filter>
  <path id="blade" d="M256 192L311.43 224L404.4 277.7A150 150 0 0 0 349 138.3Z"/>
</defs>`;

// the shutter, centred on (cx, cy) with lens radius r
const shutter = (cx, cy, r) => {
  const s = r / 150;
  return `<circle cx="${cx}" cy="${cy}" r="${r * 2.1}" fill="url(#bloom)"/>
  <g transform="translate(${cx - 256 * s} ${cy - 256 * s}) scale(${s})">
    <circle cx="256" cy="256" r="150" fill="#020309"/>
    <g fill="url(#metal)" stroke="#ffffff" stroke-opacity=".16" stroke-width="1.2" stroke-linejoin="round">
      ${[0, 60, 120, 180, 240, 300].map((a, i) => `<use href="#blade" transform="rotate(${a} 256 256)" opacity="${[1, .9, .8, .72, .82, .94][i]}"/>`).join("")}
    </g>
    <circle cx="256" cy="256" r="156" fill="none" stroke="url(#ring)" stroke-width="2.4" filter="url(#soft)"/>
    <circle cx="256" cy="256" r="156" fill="none" stroke="url(#ring)" stroke-width="1"/>
    <circle cx="256" cy="256" r="172" fill="none" stroke="#fff" stroke-opacity=".06" stroke-width="1"/>
    <circle cx="256" cy="256" r="60" fill="url(#core)"/>
    <circle cx="256" cy="256" r="13" fill="#fff" filter="url(#soft)"/>
  </g>
  <ellipse cx="${cx}" cy="${cy}" rx="${r * 1.9}" ry="3" fill="url(#flare)" filter="url(#soft)"/>
  <ellipse cx="${cx}" cy="${cy}" rx="${r * 1.1}" ry="1.2" fill="url(#flare)"/>`;
};

// contact "button": glassy pill, coloured icon, bright text
const pill = (x, y, w, n, v, c, h = 72) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${h / 2}" fill="#fff" fill-opacity=".07" stroke="${c}" stroke-opacity=".55" stroke-width="2"/>
  ${ic(n, x + 24, y + (h - 34) / 2, 34, c)}<text x="${x + 72}" y="${y + h / 2 + 10}" ${F} font-size="29" font-weight="600" fill="#ffffff">${v}</text>`;
const eyebrow =(cy) => `<text x="540" y="${cy}" ${F} font-size="21" font-weight="600" letter-spacing="9" fill="#e7ebf3" text-anchor="middle">SMARTVISION<tspan fill="url(#word)"> AI</tspan></text>`;

const post = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1350" width="1080" height="1350">${defs}
  <rect width="1080" height="1350" fill="url(#vig)"/>
  ${eyebrow(112)}
  ${shutter(540, 505, 265)}
  <text ${F} text-anchor="middle" font-size="84" letter-spacing="-1.5">
    <tspan x="540" y="950" font-weight="300" fill="#fff">Koʻradi. Tushunadi.</tspan>
    <tspan x="540" y="1044" font-weight="700" fill="url(#word)">Ogohlantiradi.</tspan>
  </text>
  <text x="540" y="1104" ${F} font-size="25" font-weight="400" fill="#8a93a8" text-anchor="middle" letter-spacing=".5">Sun'iy intellektli kuzatuv — maktab, uy va ferma uchun.</text>
  ${pill(70, 1150, 344, "globe", C.site, "#22d3ee")}${pill(430, 1150, 290, "instagram", C.instagram, "#f472b6")}${pill(736, 1150, 274, "telegram", C.telegram, "#38bdf8")}${C.phone ? pill(310, 1238, 460, "phone", C.phone, "#4ade80") : ""}
  <rect width="1080" height="1350" filter="url(#grain)"/>
</svg>`;

const rows = [["globe", C.site, "#22d3ee"], ["instagram", C.instagram, "#f472b6"], ["telegram", C.telegram, "#38bdf8"], ...(C.phone ? [["phone", C.phone, "#4ade80"]] : [])];
const story = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1080 1920" width="1080" height="1920">${defs}
  <rect width="1080" height="1920" fill="url(#vig)"/>
  ${eyebrow(190)}
  ${shutter(540, 640, 285)}
  <text ${F} text-anchor="middle" font-size="96" letter-spacing="-2">
    <tspan x="540" y="1130" font-weight="300" fill="#fff">Koʻradi.</tspan>
    <tspan x="540" y="1240" font-weight="300" fill="#fff">Tushunadi.</tspan>
    <tspan x="540" y="1350" font-weight="700" fill="url(#word)">Ogohlantiradi.</tspan>
  </text>
  <text x="540" y="1430" ${F} font-size="29" fill="#8a93a8" text-anchor="middle">Maktab, uy va ferma uchun aqlli kuzatuv.</text>
  ${rows.map(([n, v, c], i) => pill(270, 1490 + i * 86, 540, n, v, c, 70)).join("")}
  <rect width="1080" height="1920" filter="url(#grain)"/>
</svg>`;

// link preview (Telegram, Facebook, Google): 1200×630
const og = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630" width="1200" height="630">${defs}
  <rect width="1200" height="630" fill="url(#vig)"/>
  ${shutter(330, 315, 190)}
  <text x="640" y="190" ${F} font-size="22" font-weight="600" letter-spacing="8" fill="#e7ebf3">SMARTVISION<tspan fill="url(#word)"> AI</tspan></text>
  <text ${F} font-size="66" letter-spacing="-1">
    <tspan x="636" y="290" font-weight="300" fill="#fff">Koʻradi. Tushunadi.</tspan>
    <tspan x="636" y="372" font-weight="700" fill="url(#word)">Ogohlantiradi.</tspan>
  </text>
  <text x="640" y="430" ${F} font-size="24" fill="#8a93a8">Maktab, uy va ferma uchun aqlli video kuzatuv</text>
  ${pill(640, 470, 330, "globe", C.site, "#22d3ee", 60)}
  <rect width="1200" height="630" filter="url(#grain)"/>
</svg>`;
writeFileSync(join(out, "og-1200x630.svg"), og);
writeFileSync(join(out, "premium-post-1080x1350.svg"), post);
writeFileSync(join(out, "premium-story-1080x1920.svg"), story);
console.log("ok");
