# SMARTVISION AI — Intelligent video monitoring platform

Full-stack Next.js 15 + React Three Fiber platform for **Smart School / Smart Home / Smart Farm** video analytics,
with a 3D marketing site, customer dashboard, live monitoring wall, manual-receipt subscription billing and an admin panel.
Interface languages: **O'zbekcha · Русский · English** (switcher in every header, stored in the `sv_lang` cookie).

## Stack

| Layer | Tech |
| --- | --- |
| Frontend | Next.js 15 (App Router), React 19, TypeScript, Tailwind CSS v4 |
| 3D | three.js, @react-three/fiber, @react-three/drei, @react-three/postprocessing (Bloom/Vignette) |
| Motion | GSAP + ScrollTrigger (scroll-driven 3D & section reveals), Framer Motion (UI) |
| Backend | Next.js Server Actions + Route Handlers, Prisma ORM, PostgreSQL |
| Auth | bcrypt password hashes, signed HS256 JWT in an httpOnly cookie (`jose`), role-based middleware |
| Validation | Zod (server), native constraints + React `useActionState` (client) |

## Quick start (local)

```bash
npm install
copy .env.example .env  # then set PG_PASSWORD, DATABASE_URL (same password) and AUTH_SECRET
npm run db              # real PostgreSQL 17 in ./.pgdata — keep this window open (Ctrl+C stops it cleanly)
npm run db:push         # create tables (second terminal)
npm run db:seed         # optional: plans, settings, admin (+ demo customers for a showcase)
npx next build && npx next start -p 3000
```

On Windows just double-click **`start.bat`** (database → site → AI agent, opens http://localhost:3000) and
**`stop.bat`** to shut everything down cleanly. `npm run dev` writes to `.next-dev`, so a dev server never breaks
the production build in `.next`.

### Sign-in & sign-up

* **Sign-up requires a real email:** step 1 sends a 6-digit code (10 min, 5 tries); only after the correct code the
  details form opens. A mistyped address never receives the code, so no account is created for it.
* **Sign-in:** password, a one-time **email code**, or **Google** (button appears once `GOOGLE_CLIENT_ID/SECRET` are set;
  redirect URI `<NEXT_PUBLIC_SITE_URL>/api/auth/google/callback`). A Google account with the same verified email is
  linked to the existing user. Admins can turn on TOTP 2FA, which applies to every sign-in method.
* Without SMTP settings emails are not delivered — they are visible in **Admin → Outbox**. For Gmail use an app password.
* **Admin → Customers → (name):** edit, reset password, sign out everywhere, **block / unblock** (no sign-in, Edge devices
  rejected, data kept) and **delete permanently**.
## What is real vs. simulated

* **Real:** accounts, roles, plans & prices (DB, editable by admin), coupons, subscription request → approval → payment →
  receipt upload → manual verification → activation flow, cameras CRUD with plan limits, event storage, charts and CSV exports,
  notifications, Edge-device registration & token auth, heartbeat / event ingestion API, audit log.
* **Payments are never auto-approved.** The customer transfers money to the card configured by the admin and uploads a receipt
  (JPG/PNG/PDF, magic-byte checked, ≤5 MB, stored privately in `./uploads`, served only via an authenticated route).
  An administrator must verify the transfer in the bank statement and press *Approve & activate*.
* **Simulated:** video frames. Browsers can't open RTSP, so a camera without a `streamUrl` renders a grey-scale 3D
  "CCTV" scene with animated AI overlays, clearly labelled *Simulated preview*. When the Edge gateway publishes a browser-playable
  stream (HLS/MP4/WebRTC→HLS), set `Camera.streamUrl` and the tile plays real video.

## Connecting a real camera (live video)

Browsers cannot open `rtsp://` directly. Run a small converter on a PC in the same network as the camera:

1. Download **MediaMTX** (https://github.com/bluenviron/mediamtx/releases) and add to `mediamtx.yml`:
   ```yaml
   paths:
     cam1:
       source: rtsp://admin:PASSWORD@192.168.1.20:554/stream1
   ```
2. Start `mediamtx.exe`. The camera is now available as `http://<PC-IP>:8888/cam1/index.m3u8`.
3. Dashboard → **Cameras → Add / Edit camera** → paste that link into *Video stream link (HLS)*.
4. Open **Live Monitoring** — the tile plays the real stream (hls.js), shows LIVE while frames arrive and
   *Connection lost* if the stream fails.

AI detections (people counting, alerts) still need the Edge AI server to push events to `/api/edge/events` (below).

## Edge AI agent (`edge/`)

YOLOv8 + ByteTrack running on the on-site PC. It reads each camera, tracks people / vehicles / animals,
sends events to the platform and serves an annotated MJPEG stream (boxes, IDs, counting line) to the dashboard.

```bash
cd edge
start.bat                                   # first run creates .venv and installs requirements
start.bat --source "Cam 01=path\to\video.mp4"   # test with a video file instead of the camera
```

Needs the **Microsoft Visual C++ Redistributable** (PyTorch). Device token: `edge/token.txt`
(Admin → Edge AI Devices, or `node scripts/edge-register.cjs "<Organization>" <SERIAL> edge/token.txt`).

| Mode (from the customer's service) | What it detects |
| --- | --- |
| **SCHOOL** | students in view, entry / exit at the counting line, classroom occupancy vs capacity, crowding (`--crowd`), running (safety), anyone present 19:00–07:00 → intrusion |
| **HOME** | entry / exit, people & vehicles, unknown visitor during the armed window (`--night "22:00-07:00"`), running |
| **FARM** | livestock head-count every minute, people 21:00–05:00 → intrusion, fire / smoke |

Options: `--mode`, `--night "HH:MM-HH:MM"|off`, `--crowd N`, `--line 0.55`, `--conf 0.4`, `--no-snapshots`, `--no-fire`.

Honest limits: fire / smoke uses an **experimental colour + flicker heuristic** (COCO models have no fire class) — use a
dedicated fire model for production. Face snapshots are crops from the camera image: on low-resolution video they show the
head & shoulders rather than a recognisable face. There is no face *recognition* (identity) — "unknown visitor" means
"a person during the armed window". For better face crops drop OpenCV's YuNet model into
`edge/models/face_detection_yunet_2023mar.onnx`.

**Security & privacy:** the MJPEG server requires a secret stream key (`edge/stream_key.txt`, sent to the platform
inside the stream URL, so only the camera's owner gets it). Raw video never leaves the site; only events and small face
crops are uploaded. Crops are served only to the owning organization and deleted after `SNAPSHOT_RETENTION_DAYS` (30).
Disable them entirely with `--no-snapshots`.

### Remote viewing (relay)

Cameras and the Edge PC must share the customer's Wi-Fi; the **viewer** does not. Two ways to watch:

| Source | Path | When |
| --- | --- | --- |
| **Wi-Fi** | browser → Edge agent `:8090` directly | viewer is on the site's network — lowest latency, 2-min replay, quality levels |
| **Relay** | Edge agent → `POST /api/edge/frame` → platform → `GET /api/cameras/:id/stream` | from anywhere (phone on mobile data, another city) |

The player starts on Wi-Fi when the dashboard is opened from a local address and switches to the relay automatically if
the Edge server isn't reachable; the Wi-Fi / Relay button in the player toggles manually. The agent uploads one small
frame every 3 s while nobody watches and `--relay-fps` (default 4) while someone does (~200–300 KB/s per watched camera).
Only outbound HTTPS from the site is needed — no port forwarding on the customer's router. Disable with `--no-relay`.
The relay keeps only the latest frame in memory (nothing on disk); for several app instances use Redis pub/sub.

### Onboarding a customer

1. Customer registers on the site and requests a plan (or Admin → Customers → **Activate free** for a trial).
2. Admin → Edge AI Devices → **Register device** for that customer → copy the token.
3. On the customer's mini-PC: copy the `edge/` folder, put the token in `edge/token.txt`, run `start.bat`.
4. Customer adds cameras in the dashboard (RTSP address), restarts the agent — live view, AI events and alerts appear.

### Dashboard player

Every camera with a stream has a DVR-style bar: **⟲10 s / ⏸ / 10 s⟳** (2-minute replay buffer on the agent),
**LIVE**, **zoom − / +** (up to 400 %, drag to pan, double-click, Ctrl+wheel), **quality** (Auto / HD / SD / data-saver),
**snapshot** and **fullscreen**. Streams reconnect automatically if the agent restarts.

## Edge AI server API

Register a device in **Admin → Edge AI Devices**; the token is shown once (only its SHA-256 is stored).
For the seeded device, issue a token locally with `node scripts/edge-token.cjs EDGE-SCH-0012`.

```bash
# heartbeat every 30–60 s
curl -X POST http://localhost:3000/api/edge/heartbeat \
  -H "Authorization: Bearer <DEVICE_TOKEN>" -H "Content-Type: application/json" \
  -d '{"cpu":41,"gpu":58,"firmware":"v1.4.2","cameras":[{"code":"Cam 05","status":"OFFLINE","signal":0}]}'

# push detections (max 500 per call)
curl -X POST http://localhost:3000/api/edge/events \
  -H "Authorization: Bearer <DEVICE_TOKEN>" -H "Content-Type: application/json" \
  -d '{"events":[{"camera":"Cam 01","type":"ENTRY","severity":"INFO","confidence":0.96,"trackId":"#0249"}]}'
```

Event types: `ENTRY EXIT PERSON UNKNOWN_PERSON OCCUPANCY SAFETY CAMERA_STATUS LIVESTOCK VEHICLE FIRE_SMOKE INTRUSION`.
A camera going ONLINE→OFFLINE in a heartbeat automatically creates a critical event and notifications.
The live wall polls `/api/events/recent` every 5 s, so pushed events appear without reload.

## Other HTTP endpoints

| Method | Path | Who |
| --- | --- | --- |
| GET | `/api/events/recent?after=ISO` | customer session |
| GET | `/api/reports/events?days=N` | customer session — CSV |
| POST | `/api/cameras/:id/diagnostics` | customer session |
| GET / POST | `/api/receipts/:paymentId` | owner or admin / owner (multipart `file`) |
| GET | `/api/admin/payments.csv?month=YYYY-M` | admin |

Everything else is a Server Action (`src/app/actions/*`), each re-checking the session and role.

## Project layout

```
prisma/              schema.prisma, seed.ts
src/app/(site)/      landing, pricing, solutions/[slug], about, contact, login, register, terms, privacy
src/app/dashboard/   overview, cameras, live, events, analytics, reports, notifications, subscription, payments, settings
src/app/admin/       overview, customers, requests, plans, payments, devices, messages, settings
src/app/api/         route handlers listed above
src/components/three models (procedural camera, server, buildings), scenes, lazy <Scene3D> wrapper
src/lib/i18n/        uz.ts, ru.ts, en.ts dictionaries (typed — a missing key fails type-check)
```

## 3D & performance notes

* Every scene goes through `Scene3D`: mounted only near the viewport, render loop paused off-screen, adaptive DPR via
  `PerformanceMonitor`, bloom disabled on low-tier devices (≤4 cores, small screens, Save-Data), WebGL fallback.
* Live monitoring renders all camera tiles through **one** WebGL context using drei `<View>`.
* `prefers-reduced-motion` disables float/parallax/auto-rotate and CSS animations.
* Models are procedural (no downloads). To use GLB assets, drop them in `public/models` and load with drei `useGLTF`
  (Draco: `useGLTF(url, true)`), compress with `npx gltfjsx model.glb --transform`.

## Production deployment

1. Provision PostgreSQL (Neon, Supabase, RDS…) and set `DATABASE_URL`.
2. Set a strong `AUTH_SECRET` (≥32 chars) and `NEXT_PUBLIC_SITE_URL`.
3. `npm ci && npx prisma migrate deploy` (create migrations locally with `npm run db:migrate`) — or `prisma db push` for a first deploy.
4. Seed once with your own `SEED_ADMIN_*` values: `npm run db:seed` (delete demo orgs afterwards if not wanted).
5. `npm run build && npm start` behind HTTPS. `./uploads` must be on persistent storage (or implement the Cloudinary driver in `src/lib/storage.ts`).
6. The login throttle is in-memory; use Redis or a gateway rate limit when running several instances.
