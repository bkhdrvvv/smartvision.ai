"""
SMARTVISION AI — Edge AI agent
==============================

Runs next to the cameras (on-site PC / mini-server):

  camera (RTSP / HLS / file) ──► [night vision] ──► YOLOX + ByteTrack ──► events ──► POST /api/edge/events
                                         │                              heartbeat ──► /api/edge/heartbeat
                                         └──► annotated MJPEG  http://<this-pc>:8090/<cam>.mjpg  ──► website live view

Raw video never leaves this machine; only events (time, type, confidence, track id) are sent.

Usage:
  python agent.py --token <DEVICE_TOKEN> [--server http://localhost:3000]
                  [--source "Cam 01=samples/vtest.avi"] [--port 8090] [--detector yolox|yolov8] [--night-vision auto|on|off]

The device token is issued in Admin → Edge AI Devices (or `node scripts/edge-token.cjs <SERIAL>`).
Environment variables SV_SERVER / SV_TOKEN work too. A token can also be put in edge/token.txt.
"""

from __future__ import annotations

import argparse
import base64
import collections
import json
import os
import queue
import socket
import sys
import threading
import time
import urllib.error
import urllib.request
from dataclasses import dataclass, field
from datetime import datetime, timezone
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path

import cv2
import numpy as np

from detectors import NightVision, Yolov8Detector, YoloxDetector

HERE = Path(__file__).resolve().parent

# Night vision is a feature of the top plan. The platform says per device whether it is included
# (GET /api/edge/config → nightVision); refreshed every minute, so an upgrade switches it on by itself.
FEATURES = {"nightVision": False}

# COCO class ids → platform event types
PERSON = 0
VEHICLES = {2: "car", 3: "motorcycle", 5: "bus", 7: "truck"}
ANIMALS = {15: "cat", 16: "dog", 17: "horse", 18: "sheep", 19: "cow"}
CLASSES = [PERSON, *VEHICLES, *ANIMALS]

COLORS = {"person": (255, 157, 91), "vehicle": (238, 211, 34), "animal": (129, 185, 16)}  # BGR

BUFFER_SEC = 120  # replay window for "10 s back" in the dashboard player
QUALITY = {"high": (None, 85), "medium": (960, 72), "low": (640, 55)}  # max width, JPEG quality

@dataclass
class Rules:
    """Industry-specific analytics, chosen from the customer's service (SCHOOL / HOME / FARM)."""

    mode: str = "SCHOOL"
    night: tuple[int, int] | None = None  # minutes of day (start, end) when presence = intrusion
    crowd: int = 15                       # persons in view → crowd / safety alert
    run_speed: float = 0.7                # frame-heights per second → "running" safety alert
    fire: bool = True                     # experimental flame-colour heuristic

    @property
    def person_label(self):
        return {"SCHOOL": "Student", "HOME": "Person", "FARM": "Person"}[self.mode]

    def apply_guard(self, guard: dict | None, cli_night: str | None) -> str:
        """Guard mode set in the dashboard (Settings → Guard mode). --night on the command line wins."""
        if cli_night is not None:
            self.night = parse_window(cli_night)
            return cli_night
        g = guard or {}
        m = g.get("mode", "auto")
        if m == "off":
            self.night = None
        elif m == "always":
            self.night = (0, 24 * 60)
        elif m == "custom" and g.get("from") and g.get("to"):
            self.night = parse_window(f"{g['from']}-{g['to']}")
        else:
            self.night = parse_window(DEFAULT_NIGHT[self.mode])
        return {"off": "off", "always": "always"}.get(m) or (f"{g.get('from')}-{g.get('to')}" if m == "custom" else DEFAULT_NIGHT[self.mode])

    def is_night(self, now: datetime | None = None) -> bool:
        if not self.night:
            return False
        if self.night == (0, 24 * 60):
            return True
        n = now or datetime.now()
        m = n.hour * 60 + n.minute
        s, e = self.night
        return s <= m < e if s < e else (m >= s or m < e)


def parse_window(v: str | None) -> tuple[int, int] | None:
    if not v or v.lower() in ("off", "none", "-"):
        return None
    a, b = v.split("-")
    to_m = lambda t: int(t.split(":")[0]) * 60 + int(t.split(":")[1])  # noqa: E731
    return to_m(a), to_m(b)


DEFAULT_NIGHT = {"SCHOOL": "19:00-07:00", "HOME": "off", "FARM": "21:00-05:00"}

# Face detector for snapshots, best available:
#  1. YuNet (cv2.FaceDetectorYN) if edge/models/face_detection_yunet_2023mar.onnx exists (OpenCV ≥4.5.4, incl. 5.x)
#  2. Haar cascade (OpenCV 4.x only — removed in OpenCV 5)
#  3. none → head & shoulders are cropped from the person box by proportion
YUNET_PATH = HERE / "models" / "face_detection_yunet_2023mar.onnx"
FACE_CASCADE = None
if not YUNET_PATH.exists() and hasattr(cv2, "CascadeClassifier") and hasattr(cv2, "data"):
    FACE_CASCADE = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")


def find_face(img: np.ndarray) -> tuple[int, int, int, int] | None:
    """Largest face in img as (x, y, w, h), or None."""
    h, w = img.shape[:2]
    if w < 24 or h < 24:
        return None
    if YUNET_PATH.exists() and hasattr(cv2, "FaceDetectorYN"):
        det = cv2.FaceDetectorYN.create(str(YUNET_PATH), "", (w, h), 0.6)
        _, faces = det.detect(img)
        if faces is not None and len(faces):
            f = max(faces, key=lambda f: f[2] * f[3])
            return int(f[0]), int(f[1]), int(f[2]), int(f[3])
        return None
    if FACE_CASCADE is not None:
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = FACE_CASCADE.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=4, minSize=(18, 18))
        if len(faces):
            return tuple(int(v) for v in max(faces, key=lambda f: f[2] * f[3]))
    return None


def log(*a):
    print(datetime.now().strftime("%H:%M:%S"), *a, flush=True)


# ───────────────────────── school attendance: face recognition ─────────────────────────
# OpenCV SFace (Apache-2.0) + YuNet (MIT) from opencv_zoo, both run on CPU.
SFACE_PATH = HERE / "models" / "face_recognition_sface_2021dec.onnx"
SFACE_MATCH = 0.40  # cosine similarity; OpenCV's recommended threshold is 0.363 — a little stricter = fewer wrong names


class FaceBank:
    """Face templates of the organization's students, built locally from their registered photos."""

    def __init__(self):
        self.ok = SFACE_PATH.exists() and SFACE_PATH.stat().st_size > 1_000_000 and YUNET_PATH.exists() and hasattr(cv2, "FaceRecognizerSF")
        self.rec = None
        if self.ok:
            try:
                self.rec = cv2.FaceRecognizerSF.create(str(SFACE_PATH), "")
            except cv2.error as e:
                log(f"face recognition model could not be loaded: {e}")
                self.ok = False
        self.lock = threading.Lock()
        self.items: dict[str, tuple[str, np.ndarray]] = {}  # id → (name, feature)
        self.versions: dict[str, str] = {}

    @staticmethod
    def _detect(img: np.ndarray):
        h, w = img.shape[:2]
        if w < 40 or h < 40:
            return None
        det = cv2.FaceDetectorYN.create(str(YUNET_PATH), "", (w, h), 0.7)
        _, faces = det.detect(img)
        if faces is None or not len(faces):
            return None
        return max(faces, key=lambda f: f[2] * f[3])

    def feature(self, img: np.ndarray) -> np.ndarray | None:
        if not self.ok:
            return None
        f = self._detect(img)
        if f is None or f[2] < 36:  # too small to recognise reliably
            return None
        with self.lock:
            aligned = self.rec.alignCrop(img, f)
            return self.rec.feature(aligned).copy()

    def sync(self, api: "Api", students: list[dict]):
        """Add new / changed students, drop removed ones (photo versions come from /api/edge/config)."""
        if not self.ok:
            return
        want = {s["id"]: s for s in students}
        if set(want) == set(self.versions) and all(self.versions[k] == want[k].get("v") for k in want):
            return  # nothing changed since the last config refresh
        for sid in list(self.items):
            if sid not in want:
                self.items.pop(sid, None)
                self.versions.pop(sid, None)
        for sid, s in want.items():
            if self.versions.get(sid) == s.get("v"):
                continue
            try:
                img = cv2.imdecode(np.frombuffer(api.face(sid), np.uint8), cv2.IMREAD_COLOR)
            except Exception as e:  # noqa: BLE001
                log(f"face photo of {s['name']} not loaded: {e}")
                continue
            feat = self.feature(img) if img is not None else None
            self.versions[sid] = s.get("v")
            if feat is None:
                log(f"no clear face in the photo of {s['name']} — upload a sharper front photo")
                continue
            self.items[sid] = (s["name"], feat)
        if want:
            log(f"face recognition: {len(self.items)}/{len(want)} students ready")

    def match(self, feat: np.ndarray) -> tuple[str, str, float] | None:
        best = None
        with self.lock:
            for sid, (name, ref) in self.items.items():
                score = float(self.rec.match(feat, ref, cv2.FaceRecognizerSF_FR_COSINE))
                if score >= SFACE_MATCH and (best is None or score > best[2]):
                    best = (sid, name, score)
        return best


FACES: FaceBank | None = None
PLATES = None  # plates.PlateReader when fast-alpr is installed
# Plan features from /api/edge/config ("zone", "fall", "tamper", "loiter", "plates", "corridorWatch", "animalPen",
# "fireSmoke", "heatmap", …). None = an older platform that sends no list → everything on.
PLAN: set | None = None
SCHOOL_HOURS = {"start": "08:00", "end": "14:00"}


def plan_has(key: str) -> bool:
    return PLAN is None or key in PLAN


def in_lessons(now: datetime | None = None) -> bool:
    n = now or datetime.now()
    if n.weekday() == 6:  # Sunday
        return False
    m = n.hour * 60 + n.minute
    to_m = lambda t: int(t.split(":")[0]) * 60 + int(t.split(":")[1])  # noqa: E731
    return to_m(SCHOOL_HOURS["start"]) <= m < to_m(SCHOOL_HOURS["end"])


def _b64(jpeg: bytes | None) -> str | None:
    return base64.b64encode(jpeg).decode() if jpeg else None


def plate_photo(car, box, text):
    from plates import photo  # noqa: PLC0415

    return photo(car, box, text)


def now_iso():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def lan_ip() -> str:
    try:
        s = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        s.connect(("8.8.8.8", 80))
        ip = s.getsockname()[0]
        s.close()
        return ip
    except OSError:
        return "127.0.0.1"


def slug(code: str) -> str:
    return "".join(c if c.isalnum() else "-" for c in code.lower()).strip("-")


# ───────────────────────── API client ─────────────────────────
class Api:
    def __init__(self, server: str, token: str):
        self.server = server.rstrip("/")
        self.token = token

    def _req(self, method: str, path: str, body: dict | None = None, timeout=15):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(
            self.server + path,
            data=data,
            method=method,
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "application/json", "User-Agent": "smartvision-edge/1.0"},
        )
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read() or b"{}")

    def config(self):
        return self._req("GET", "/api/edge/config")

    def events(self, events: list[dict]):
        return self._req("POST", "/api/edge/events", {"events": events})

    def heartbeat(self, body: dict):
        return self._req("POST", "/api/edge/heartbeat", body)

    def face(self, student_id: str) -> bytes:
        """Registered face photo of a student (school attendance)."""
        from urllib.parse import quote

        req = urllib.request.Request(f"{self.server}/api/edge/face?id={quote(student_id)}", headers={"Authorization": f"Bearer {self.token}", "User-Agent": "smartvision-edge/1.0"})
        with urllib.request.urlopen(req, timeout=20) as r:
            return r.read()

    def frame(self, code: str, jpeg: bytes) -> int:
        """Push one annotated frame to the platform relay; returns how many remote viewers are watching."""
        from urllib.parse import quote

        req = urllib.request.Request(
            f"{self.server}/api/edge/frame?camera={quote(code)}",
            data=jpeg,
            method="POST",
            headers={"Authorization": f"Bearer {self.token}", "Content-Type": "image/jpeg", "User-Agent": "smartvision-edge/1.0"},
        )
        with urllib.request.urlopen(req, timeout=10) as r:
            return int(json.loads(r.read() or b"{}").get("viewers", 0))


# ───────────────────────── Camera worker ─────────────────────────
@dataclass
class CamState:
    code: str
    name: str
    source: str
    capacity: int | None
    status: str = "OFFLINE"
    fps: float = 0.0
    jpeg: bytes | None = None
    frame_cond: threading.Condition = field(default_factory=threading.Condition)
    # replay buffer, hard-capped (≈ 8 fps × 120 s) so fast GPUs can't exhaust memory
    history: "collections.deque[tuple[float, bytes]]" = field(default_factory=lambda: collections.deque(maxlen=960))
    last_hist: float = 0.0
    entered: int = 0
    exited: int = 0
    in_view: int = 0
    night_vision: bool = False  # enhancement running right now (reported to the dashboard)
    night_mode: str = "auto"    # set per camera in the dashboard: auto | on | off
    zone: list | None = None    # forbidden zone drawn in the dashboard: [[x, y], …] in 0..1 of the frame
    min_conf: float = 0.0       # sensitivity from the dashboard (raised by "false alarm" marks)
    scene: str = "gate"         # gate | classroom | corridor | parking | house | barn
    pen: list | None = None     # farm: allowed area of the animals
    heat: "np.ndarray | None" = None  # 18×32 counts of where people walk (heatmap)


class CameraWorker(threading.Thread):
    def __init__(self, cam: CamState, detector, events: "queue.Queue[dict]", conf: float, line: float, imgsz: int, night_vision: str = "auto"):
        super().__init__(daemon=True, name=f"cam-{cam.code}")
        self.cam = cam
        self.detector = detector
        self.nv_mode = night_vision  # auto: when the scene is dark · on: always · off: never
        self.nv = NightVision()
        self.events = events
        self.conf = conf
        self.line = line  # counting line position (0..1 of frame height)
        self.imgsz = imgsz
        self.last_y: dict[int, float] = {}
        self.seen: set[int] = set()
        self.last_occ_sent = 0.0
        self.last_occ_value = -1
        self.model_lock = threading.Lock()
        self._ticks: list[float] = []
        self.pending: dict[int, float] = {}
        self.snapshots = True
        self.rules = Rules()
        self.track_pos: dict[int, tuple[float, float, float]] = {}  # tid → (cx, cy, t)
        self.cooldown: dict[str, float] = {}  # alert key → last time sent
        self.fire_hits = 0
        self.last_fire_check = 0.0
        self.last_livestock = (0.0, -1)
        self.posture: dict[int, tuple[float, float]] = {}  # tid → (last time seen upright, time lying down began)
        self.face_tries: dict[int, tuple[int, float]] = {}  # tid → (attempts, last attempt time)
        self.known: dict[int, str] = {}  # tid → recognised student name (drawn on the box)
        self.known_sid: dict[int, str] = {}  # tid → recognised student id
        self.plate_try: dict[int, tuple[int, float, tuple | None]] = {}  # tid → (attempts, last time, best read)
        self.plate_text: dict[int, str] = {}  # tid → plate shown on the box
        # camera checks (tamper / health): reference look of the scene + how long a problem lasts
        self.ref_hist: np.ndarray | None = None
        self.ref_time = 0.0
        self.last_check = 0.0
        self.bad_since: dict[str, float] = {}
        self.first_seen: dict[int, float] = {}  # tid → first time in view (loitering)
        self.std_hist: "collections.deque[float]" = collections.deque(maxlen=10)  # picture detail, last 10 s
        self.covered_seen = False

    def alert(self, key: str, every: float, type_: str, severity: str, **kw) -> bool:
        """Emit an alert at most once per `every` seconds for the same key."""
        t = time.time()
        if t - self.cooldown.get(key, 0) < every:
            return False
        self.cooldown[key] = t
        self.emit(type_, severity, **kw)
        return True

    def snapshot(self, frame: np.ndarray, box: tuple[int, int, int, int]) -> str | None:
        """Face crop if a face is found inside the person box, otherwise head & shoulders. Base64 JPEG."""
        if not self.snapshots:
            return None
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = box
        bw, bh = x2 - x1, y2 - y1
        person = frame[max(0, y1):min(h, y2), max(0, x1):min(w, x2)]
        if person.size == 0:
            return None
        crop = None
        upper = person[: max(1, int(bh * 0.45))]
        face = find_face(upper)
        if face:
            fx, fy, fw, fh = face
            pad = int(fw * 0.45)
            crop = upper[max(0, fy - pad):fy + fh + pad, max(0, fx - pad):fx + fw + pad]
        if crop is None or crop.size == 0:
            # no detectable face (small / turned away / no detector) → head & shoulders by body proportion
            head_h = max(1, int(bh * 0.30))
            side = max(1, min(bw, int(head_h * 1.15)))
            cx = bw // 2
            crop = person[:head_h, max(0, cx - side // 2):cx + side // 2]
        ch, cw = crop.shape[:2]
        scale = 220 / max(ch, cw)
        if scale > 1:  # upscale tiny crops so thumbnails aren't postage stamps
            crop = cv2.resize(crop, (int(cw * scale), int(ch * scale)), interpolation=cv2.INTER_CUBIC)
        elif scale < 1:
            crop = cv2.resize(crop, (int(cw * scale), int(ch * scale)), interpolation=cv2.INTER_AREA)
        ok, b = cv2.imencode(".jpg", crop, [cv2.IMWRITE_JPEG_QUALITY, 85])
        return base64.b64encode(b.tobytes()).decode() if ok else None

    def emit(self, type_: str, severity="INFO", confidence=None, track=None, value=None, snapshot: str | None = None, student: str | None = None, plate: str | None = None):
        ev = {"camera": self.cam.code, "type": type_, "severity": severity, "occurredAt": now_iso()}
        if student:
            ev["student"] = student
        if plate:
            ev["plate"] = plate
        if snapshot:
            ev["snapshot"] = snapshot
        if confidence is not None:
            ev["confidence"] = round(float(confidence), 3)
        if track is not None:
            ev["trackId"] = f"#{int(track):04d}"
        if value is not None:
            ev["value"] = int(value)
        try:
            self.events.put_nowait(ev)
        except queue.Full:  # long offline period: drop the newest rather than run out of memory
            pass

    def open(self):
        src = self.cam.source
        cap = cv2.VideoCapture(int(src) if src.isdigit() else src)
        if src.lower().startswith("rtsp"):
            cap.set(cv2.CAP_PROP_BUFFERSIZE, 1)
        return cap

    def run(self):
        is_file = Path(self.cam.source).exists()
        while True:
            cap = self.open()
            if not cap.isOpened():
                self.cam.status = "OFFLINE"
                log(f"[{self.cam.code}] cannot open source, retrying in 10s: {self.cam.source}")
                time.sleep(10)
                continue
            log(f"[{self.cam.code}] connected: {self.cam.source}")
            self.cam.status = "ONLINE"
            src_fps = cap.get(cv2.CAP_PROP_FPS) or 25
            frame_dt = 1.0 / src_fps if is_file else 0
            t_prev = time.time()
            fails = 0
            while True:
                t0 = time.time()
                ok, frame = cap.read()
                if not ok:
                    if is_file:  # loop sample videos
                        cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
                        self.last_y.clear()
                        continue
                    fails += 1
                    if fails > 50:
                        break
                    time.sleep(0.1)
                    continue
                fails = 0
                annotated = self.process(frame)
                ok, buf = cv2.imencode(".jpg", annotated, [cv2.IMWRITE_JPEG_QUALITY, 78])
                if ok:
                    jpg = buf.tobytes()
                    tnow_ = time.time()
                    with self.cam.frame_cond:
                        self.cam.jpeg = jpg
                        if tnow_ - self.cam.last_hist >= 0.125:  # store at most 8 fps for replay
                            self.cam.history.append((tnow_, jpg))
                            self.cam.last_hist = tnow_
                        while self.cam.history and tnow_ - self.cam.history[0][0] > BUFFER_SEC:
                            self.cam.history.popleft()
                        self.cam.frame_cond.notify_all()
                # analysed frames per second over a sliding 5 s window
                tnow = time.time()
                self._ticks.append(tnow)
                while self._ticks and tnow - self._ticks[0] > 5:
                    self._ticks.pop(0)
                span = tnow - self._ticks[0] if len(self._ticks) > 1 else 0
                self.cam.fps = (len(self._ticks) - 1) / span if span > 0 else 0.0
                # CPU inference is naturally slow (1–5 fps); only a stalled pipeline counts as weak
                self.cam.status = "ONLINE" if self.cam.fps >= 0.5 or len(self._ticks) < 3 else "WEAK"
                t_prev = tnow
                if frame_dt:
                    # files: skip ahead so playback keeps real-time pace even when inference is slow
                    spent = time.time() - t0
                    skip = int(spent / frame_dt) - 1
                    for _ in range(max(0, min(skip, 10))):
                        cap.grab()
            cap.release()
            self.cam.status = "OFFLINE"
            self.emit("CAMERA_STATUS", "CRITICAL")
            log(f"[{self.cam.code}] stream lost, reconnecting…")
            time.sleep(3)

    def process(self, frame: np.ndarray) -> np.ndarray:
        h, w = frame.shape[:2]
        line_y = int(h * self.line)
        # the detector works on the original frame (tests: it finds people in dark frames at least as well
        # as on a brightened copy); night vision (top plan only) brightens what the viewer sees
        with self.model_lock:
            dets = self.detector.track(frame)
        if self.cam.min_conf > self.conf:  # this camera's sensitivity was lowered after false alarms
            dets = [d for d in dets if d[5] >= self.cam.min_conf]
        self.camera_checks(frame)
        night_on = False
        # the dashboard setting decides (auto / on / off); "--night-vision off" on the command line overrides it
        mode = "off" if self.nv_mode == "off" else (self.cam.night_mode or "auto")
        if FEATURES["nightVision"] and mode != "off":
            self.nv.measure(frame)
            night_on = mode == "on" or self.nv.active
        self.cam.night_vision = night_on
        persons = 0
        animals = 0
        out = self.nv.enhance(frame) if night_on else frame.copy()
        if True:
            for x1, y1, x2, y2, cls, conf, tid in dets:
                cy = (y1 + y2) / 2
                if cls == PERSON:
                    kind, label = "person", self.rules.person_label
                    persons += 1
                    self.person_rules(frame, tid, conf, (x1, y1, x2, y2), h)
                    if tid not in self.seen:
                        # wait (max 3 s) until the person is big & confident enough for a useful snapshot
                        first = self.pending.setdefault(tid, time.time())
                        big = (y2 - y1) >= 0.18 * h and conf >= 0.55
                        if big or time.time() - first > 3:
                            self.seen.add(tid)
                            self.pending.pop(tid, None)
                            self.emit("PERSON", "INFO", conf, tid, snapshot=self.snapshot(frame, (x1, y1, x2, y2)))
                    prev = self.last_y.get(tid)
                    if prev is not None:
                        if prev < line_y <= cy:
                            self.cam.entered += 1
                            self.emit("ENTRY", "INFO", conf, tid)
                        elif prev > line_y >= cy:
                            self.cam.exited += 1
                            self.emit("EXIT", "INFO", conf, tid)
                            # a recognised student going out → "left school" message for the parents
                            if tid in self.known_sid:
                                self.alert(f"left-{self.known_sid[tid]}", 1800, "STUDENT", "INFO", confidence=conf, track=tid, value=2, student=self.known_sid[tid])
                    self.last_y[tid] = cy
                    # heatmap: where the feet are (18 × 32 grid)
                    if self.cam.heat is not None:
                        gx, gy = min(31, max(0, int((x1 + x2) / 2 / w * 32))), min(17, max(0, int(y2 / h * 18)))
                        self.cam.heat[gy, gx] += 1
                elif cls in VEHICLES:
                    kind, label = "vehicle", VEHICLES[cls].title()
                    if tid not in self.seen:
                        if PLATES and PLATES.ok and plan_has("plates"):
                            self.plate_rules(frame, tid, conf, (x1, y1, x2, y2))
                        else:
                            self.seen.add(tid)
                            self.emit("VEHICLE", "INFO", conf, tid)
                    if tid in self.plate_text:
                        label = self.plate_text[tid]
                else:
                    kind, label = "animal", ANIMALS[cls].title()
                    animals += 1
                    # farm: an animal outside its pen
                    pen = self.cam.pen
                    if pen and len(pen) >= 3 and plan_has("animalPen"):
                        poly = np.array([[px * w, py * h] for px, py in pen], np.float32)
                        if cv2.pointPolygonTest(poly, (float((x1 + x2) / 2), float(y2)), False) < 0:
                            self.alert(f"pen-{tid}", 300, "ANIMAL_OUT", "WARNING", confidence=conf, track=tid, snapshot=self.snapshot(frame, (x1, y1, x2, y2)))
                    if tid not in self.seen:
                        self.seen.add(tid)
                        if self.rules.mode != "FARM":  # on a farm animals are counted, not reported one by one
                            self.emit("LIVESTOCK", "INFO", conf, tid)
                color = COLORS[kind]
                # sizes scale with the frame so labels stay readable after the browser shrinks the video
                fs = max(0.6, w / 900)
                thick = max(2, int(w / 400))
                cv2.rectangle(out, (x1, y1), (x2, y2), color, thick)
                # corner brackets like the dashboard design
                L = max(10, (x2 - x1) // 5)
                for (cx, cy_, dx, dy) in ((x1, y1, 1, 1), (x2, y1, -1, 1), (x1, y2, 1, -1), (x2, y2, -1, -1)):
                    cv2.line(out, (cx, cy_), (cx + dx * L, cy_), color, thick + 2)
                    cv2.line(out, (cx, cy_), (cx, cy_ + dy * L), color, thick + 2)
                if kind == "person" and tid in self.known:
                    label = self.known[tid]
                tag = f"{label} {conf:.2f} | ID {tid}"
                (tw, th), base = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, fs, max(1, thick - 1))
                ty = y1 - 6 if y1 - th - 12 > 0 else y2 + th + 10  # flip below the box at the top edge
                cv2.rectangle(out, (x1 - 1, ty - th - 6), (x1 + tw + 10, ty + base), color, -1)
                cv2.putText(out, tag, (x1 + 5, ty), cv2.FONT_HERSHEY_SIMPLEX, fs, (10, 10, 10), max(1, thick - 1), cv2.LINE_AA)
        if len(self.seen) > 5000:  # bound memory on long runs
            self.seen = set(list(self.seen)[-1000:])
        if len(self.pending) > 500:
            self.pending.clear()

        self.cam.in_view = persons
        self.occupancy(persons)
        self.scene_rules(frame, persons, animals)

        # animal pen (green outline)
        if self.cam.pen and len(self.cam.pen) >= 3:
            poly = np.array([[int(x * w), int(y * h)] for x, y in self.cam.pen], np.int32)
            cv2.polylines(out, [poly], True, (80, 200, 60), max(2, int(w / 450)))
        # forbidden zone (red, semi-transparent)
        if self.cam.zone and len(self.cam.zone) >= 3:
            poly = np.array([[int(x * w), int(y * h)] for x, y in self.cam.zone], np.int32)
            layer = out.copy()
            cv2.fillPoly(layer, [poly], (94, 63, 244))
            cv2.addWeighted(layer, 0.22, out, 0.78, 0, out)
            cv2.polylines(out, [poly], True, (94, 63, 244), max(2, int(w / 450)))
        # counting line + HUD
        fs = max(0.6, w / 900)
        cv2.line(out, (0, line_y), (w, line_y), (11, 158, 245), max(2, int(w / 400)))
        hud = f"IN {self.cam.entered}   OUT {self.cam.exited}   IN VIEW {persons}   {self.cam.fps:.1f} fps"
        # counters at the TOP-left: the dashboard player's control bar covers the bottom of the frame
        (hw, hh), _ = cv2.getTextSize(hud, cv2.FONT_HERSHEY_SIMPLEX, fs * 0.85, 2)
        top = int(44 * fs)  # leave room for the camera-name chip the dashboard draws in the corner
        cv2.rectangle(out, (8, top), (8 + hw + 16, top + hh + 14), (12, 8, 4), -1)
        cv2.putText(out, hud, (16, top + hh + 6), cv2.FONT_HERSHEY_SIMPLEX, fs * 0.85, (240, 240, 240), 2, cv2.LINE_AA)
        stamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        (sw, _), _ = cv2.getTextSize(stamp, cv2.FONT_HERSHEY_SIMPLEX, fs * 0.9, 2)
        cv2.putText(out, stamp, (w - sw - 12, int(30 * fs)), cv2.FONT_HERSHEY_SIMPLEX, fs * 0.9, (240, 240, 240), 2, cv2.LINE_AA)
        if night_on:
            tag = "NIGHT VISION"
            (nw, nh), _ = cv2.getTextSize(tag, cv2.FONT_HERSHEY_SIMPLEX, fs * 0.8, 2)
            # left side under the counters — the dashboard draws its own chips in the top-right corner
            x0, y0 = 16, top + hh + 26
            cv2.rectangle(out, (x0 - 8, y0), (x0 + nw + 8, y0 + nh + 14), (60, 40, 10), -1)
            cv2.putText(out, tag, (x0, y0 + nh + 6), cv2.FONT_HERSHEY_SIMPLEX, fs * 0.8, (120, 255, 160), 2, cv2.LINE_AA)
        return out

    # ───── industry rules ─────
    def person_rules(self, frame, tid: int, conf: float, box, h: int):
        r = self.rules
        x1, y1, x2, y2 = box
        cx, cy, t = (x1 + x2) / 2, (y1 + y2) / 2, time.time()

        # presence outside working hours: intrusion (school/farm) or unknown visitor while armed (home)
        if r.is_night():
            if r.mode == "HOME":
                self.alert(f"visitor-{tid}", 120, "UNKNOWN_PERSON", "WARNING", confidence=conf, track=tid, snapshot=self.snapshot(frame, box))
            else:
                self.alert(f"intrude-{tid}", 120, "INTRUSION", "CRITICAL", confidence=conf, track=tid, snapshot=self.snapshot(frame, box))

        # running / rapid movement (safety) — speed in frame-heights per second over ≥0.5 s
        prev = self.track_pos.get(tid)
        if prev and t - prev[2] >= 0.5:
            speed = (((cx - prev[0]) ** 2 + (cy - prev[1]) ** 2) ** 0.5) / h / (t - prev[2])
            self.track_pos[tid] = (cx, cy, t)
            if speed > r.run_speed and r.mode in ("SCHOOL", "HOME"):
                self.alert(f"run-{tid}", 60, "SAFETY", "WARNING", confidence=conf, track=tid)
        elif not prev:
            self.track_pos[tid] = (cx, cy, t)
        if len(self.track_pos) > 2000:
            self.track_pos.clear()

        fw = frame.shape[1]
        # loitering: an unrecognised person stays in view ≥ 2 minutes during guard hours (farms: any time)
        first = self.first_seen.setdefault(tid, t)
        # school corridor camera: someone stays there ≥ 3 minutes during lesson hours (breaks are shorter)
        if r.mode == "SCHOOL" and self.cam.scene == "corridor" and plan_has("corridorWatch") and t - first >= 180 and in_lessons():
            self.alert(f"corridor-{tid}", 900, "CORRIDOR", "WARNING", confidence=conf, track=tid, value=int(t - first), snapshot=self.snapshot(frame, box))
        if plan_has("loiter") and t - first >= 120 and tid not in self.known and (r.is_night() or r.mode == "FARM"):
            self.alert(f"loiter-{tid}", 600, "LOITER", "WARNING", confidence=conf, track=tid, value=int(t - first), snapshot=self.snapshot(frame, box))
        if len(self.first_seen) > 3000:
            self.first_seen.clear()

        # forbidden zone (drawn in the dashboard): the person's feet are inside the polygon
        zone = self.cam.zone
        if zone and len(zone) >= 3 and plan_has("zone"):
            poly = np.array([[x * fw, y * h] for x, y in zone], np.float32)
            if cv2.pointPolygonTest(poly, (float(cx), float(y2)), False) >= 0:
                self.alert(f"zone-{tid}", 60, "ZONE", "CRITICAL", confidence=conf, track=tid, snapshot=self.snapshot(frame, box))

        # fall: the person was upright, then the box turns wide (lying) and stays so ≥ 1.5 s
        bw, bh = max(1, x2 - x1), max(1, y2 - y1)
        upright_t, lying_t = self.posture.get(tid, (0.0, 0.0))
        if not plan_has("fall"):
            pass
        elif bh / bw >= 1.5:
            self.posture[tid] = (t, 0.0)
        elif bw / bh >= 1.25 and upright_t and t - upright_t < 4:
            if not lying_t:
                self.posture[tid] = (upright_t, t)
            elif t - lying_t >= 1.5:
                self.alert(f"fall-{tid}", 120, "FALL", "CRITICAL", confidence=conf, track=tid, snapshot=self.snapshot(frame, box))
        if len(self.posture) > 2000:
            self.posture.clear()

        # school attendance: recognise the face (a few tries per person, once a second)
        if FACES and FACES.items and tid not in self.known:
            tries, last = self.face_tries.get(tid, (0, 0.0))
            if tries < 6 and t - last >= 1.0 and bh >= 0.15 * h:
                self.face_tries[tid] = (tries + 1, t)
                # the whole person box: works for full-body views (face near the top) and close-ups alike
                upper = frame[max(0, y1):min(h, y2), max(0, x1):min(fw, x2)]
                feat = FACES.feature(upper) if upper.size else None
                hit = FACES.match(feat) if feat is not None else None
                if hit:
                    sid, name, score = hit
                    self.known[tid] = name
                    self.known_sid[tid] = sid
                    # once per student per 30 min and camera — the server keeps the first / last time of the day
                    self.alert(f"student-{sid}", 1800, "STUDENT", "INFO", confidence=score, track=tid, snapshot=self.snapshot(frame, box), student=sid)
            if len(self.face_tries) > 2000:
                self.face_tries.clear()
                self.known.clear()

    def _bad(self, key: str, is_bad: bool, t: float) -> float:
        """How many seconds a problem has lasted (0 when it is gone)."""
        if not is_bad:
            self.bad_since.pop(key, None)
            return 0.0
        return t - self.bad_since.setdefault(key, t)

    def camera_checks(self, frame):
        """Once a second: covered / turned camera (TAMPER) and a blurred or too dark picture (CAMERA_HEALTH)."""
        t = time.time()
        if t - self.last_check < 1.0 or not plan_has("tamper"):
            return
        self.last_check = t
        g = cv2.cvtColor(cv2.resize(frame, (320, 240)), cv2.COLOR_BGR2GRAY)
        mean, std = float(g.mean()), float(g.std())
        thumb = cv2.resize(g, (32, 24)).astype(np.float32)
        hist = cv2.calcHist([g], [0], None, [32], [0, 256])
        cv2.normalize(hist, hist)
        if self.ref_hist is None:
            self.ref_hist, self.ref_thumb, self.ref_std, self.ref_time = hist, thumb, std, t
            return
        # compare the SHAPES of the scene (brightness removed), so day → dusk is not "turned"
        a = (thumb - thumb.mean()) / (thumb.std() + 1e-3)
        b = (self.ref_thumb - self.ref_thumb.mean()) / (self.ref_thumb.std() + 1e-3)
        shape_corr = float((a * b).mean())
        # covered: the picture became flat (hand, cloth, paint) within a few seconds — dusk is slow, covering is sudden
        hist_std = self.std_hist
        sudden = len(hist_std) >= 4 and max(list(hist_std)[:-2]) > 18
        if std >= 7:
            self.covered_seen = False
        covered = std < 7 and (sudden or self.covered_seen)
        self.covered_seen = covered
        hist_std.append(std)
        # turned / moved: the whole scene looks different from a minute ago, and stays so
        turned = std >= 10 and self.ref_std >= 10 and shape_corr < 0.3
        if self._bad("covered", covered, t) >= 5:
            self.alert("tamper-covered", 600, "TAMPER", "CRITICAL", value=1)
        if self._bad("turned", turned and not covered, t) >= 10:
            self.alert("tamper-turned", 600, "TAMPER", "CRITICAL", value=2)
            # accept the new view so one turn gives one alert
            self.ref_hist, self.ref_thumb, self.ref_std, self.ref_time = hist, thumb, std, t
            self.bad_since.pop("turned", None)
        # health: blurred (dirty / out of focus lens) or too dark without night vision, for a minute
        sharp = float(cv2.Laplacian(g, cv2.CV_64F).var())
        if self._bad("blur", sharp < 12 and not covered and mean > 30, t) >= 60:
            self.alert("health-blur", 3600, "CAMERA_HEALTH", "WARNING", value=1)
        if self._bad("dark", mean < 14 and not covered and not self.cam.night_vision, t) >= 60:
            self.alert("health-dark", 3600, "CAMERA_HEALTH", "WARNING", value=2)
        # slowly follow daylight changes while everything is fine
        if not self.bad_since and t - self.ref_time > 120:
            self.ref_hist, self.ref_thumb, self.ref_std, self.ref_time = hist, thumb, std, t

    def plate_rules(self, frame, tid: int, conf: float, box):
        """Read the licence plate a few times while the car is in view; report the best read once per car."""
        h, w = frame.shape[:2]
        x1, y1, x2, y2 = box
        t = time.time()
        tries, last, best = self.plate_try.get(tid, (0, 0.0, None))
        if t - last < 0.6:
            return
        if (x2 - x1) >= 0.10 * w:  # too small → the plate can't be read yet, wait for the car to come closer
            pad = int((x2 - x1) * 0.05)
            car = frame[max(0, y1 - pad):min(h, y2 + pad), max(0, x1 - pad):min(w, x2 + pad)]
            r = PLATES.read(car)
            if r and (best is None or r[1] > best[1]):
                best = (r[0], r[1], r[2], car.copy())
            tries += 1
        self.plate_try[tid] = (tries, t, best)
        done = (best and best[1] >= 0.85) or tries >= 8
        if not done:
            return
        self.seen.add(tid)
        self.plate_try.pop(tid, None)
        if best and best[1] >= 0.6:
            text, pconf, pbox, car = best
            self.plate_text[tid] = text
            if self.alert(f"plate-{text}", 300, "VEHICLE", "INFO", confidence=pconf, track=tid, snapshot=_b64(plate_photo(car, pbox, text)), plate=text):
                log(f"[{self.cam.code}] plate {text} ({pconf:.2f})")
        else:
            self.emit("VEHICLE", "INFO", conf, tid)
        if len(self.plate_text) > 2000:
            self.plate_text.clear()

    def scene_rules(self, frame, persons: int, animals: int):
        r = self.rules
        t = time.time()
        # crowding (school corridors / gates)
        if r.mode == "SCHOOL" and persons >= r.crowd:
            self.alert("crowd", 120, "SAFETY", "WARNING", value=persons)
        # farm: periodic livestock headcount (value = animals in view)
        if r.mode == "FARM":
            last_t, last_n = self.last_livestock
            if animals != last_n and t - last_t >= 60:
                self.last_livestock = (t, animals)
                self.emit("LIVESTOCK", "INFO", value=animals)
        # fire / smoke (experimental): sustained large flame-coloured area that flickers
        # (homes excluded: indoor lamps and skin tones fool this colour heuristic)
        if r.fire and r.mode in ("FARM", "SCHOOL") and t - self.last_fire_check >= 1.0:
            self.last_fire_check = t
            small = cv2.resize(frame, (160, 120))
            hsv = cv2.cvtColor(small, cv2.COLOR_BGR2HSV)
            mask = cv2.inRange(hsv, (0, 120, 210), (35, 255, 255))
            ratio = float(np.count_nonzero(mask)) / mask.size
            self.fire_hits = self.fire_hits + 1 if ratio > 0.015 else max(0, self.fire_hits - 1)
            if self.fire_hits >= 5:
                self.fire_hits = 0
                self.alert("fire", 300, "FIRE_SMOKE", "CRITICAL", value=int(ratio * 100))

    def occupancy(self, persons: int):
        t = time.time()
        if t - self.last_occ_sent < 30 or persons == self.last_occ_value:
            return
        self.last_occ_sent, self.last_occ_value = t, persons
        cap = self.cam.capacity
        sev = "WARNING" if cap and persons >= 0.85 * cap else "INFO"
        self.emit("OCCUPANCY", sev, None, None, persons)


# ───────────────────────── MJPEG server ─────────────────────────
def make_handler(cams: dict[str, CamState], stream_key: str):
    import hmac

    class Handler(BaseHTTPRequestHandler):
        def log_message(self, *a):
            pass

        def do_GET(self):
            from urllib.parse import parse_qs, urlsplit

            parts = urlsplit(self.path)
            name = parts.path.strip("/")
            qs = parse_qs(parts.query)
            try:
                delay = max(0.0, min(float(qs.get("delay", ["0"])[0]), BUFFER_SEC - 1))
            except ValueError:
                delay = 0.0
            quality = qs.get("q", ["high"])[0]
            if quality not in QUALITY:
                quality = "high"
            # every request needs the secret stream key (only logged-in owners get it from the dashboard)
            if not hmac.compare_digest(qs.get("k", [""])[0], stream_key):
                self._send(403, "text/plain", b"forbidden: missing or wrong stream key")
                return
            if name in ("", "index.html"):
                import html as _h

                body = "".join(f'<p><a href="/{k}.mjpg?k={stream_key}">{_h.escape(c.name)} ({_h.escape(c.code)})</a> — {c.status}</p>' for k, c in list(cams.items()))
                self._send(200, "text/html; charset=utf-8", f"<h3>SMARTVISION Edge AI</h3>{body}".encode())
                return
            key = name[:-5] if name.endswith(".mjpg") else name
            cam = cams.get(key)
            if not cam:
                self._send(404, "text/plain", b"unknown camera")
                return
            self.send_response(200)
            self.send_header("Content-Type", "multipart/x-mixed-replace; boundary=frame")
            self.send_header("Cache-Control", "no-cache, no-store")
            self.send_header("Access-Control-Allow-Origin", "*")
            self.end_headers()
            max_w, jq = QUALITY[quality]
            last_sent = 0.0
            try:
                while True:
                    if delay <= 0:
                        with cam.frame_cond:
                            cam.frame_cond.wait(timeout=5)
                            jpg = cam.jpeg
                    else:
                        # replay: newest buffered frame that is at least `delay` seconds old
                        target = time.time() - delay
                        with cam.frame_cond:
                            hist = list(cam.history)
                        jpg = None
                        for ts, frame in reversed(hist):
                            if ts <= target:
                                if ts > last_sent:
                                    jpg, last_sent = frame, ts
                                break
                        if jpg is None:
                            time.sleep(0.1)
                            continue
                    if not jpg:
                        continue
                    if max_w:  # lower quality → smaller frames for slow connections / phones
                        img = cv2.imdecode(np.frombuffer(jpg, np.uint8), cv2.IMREAD_COLOR)
                        if img is not None and img.shape[1] > max_w:
                            img = cv2.resize(img, (max_w, int(img.shape[0] * max_w / img.shape[1])), interpolation=cv2.INTER_AREA)
                        if img is not None:
                            ok, b = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, jq])
                            if ok:
                                jpg = b.tobytes()
                    self.wfile.write(b"--frame\r\nContent-Type: image/jpeg\r\nContent-Length: " + str(len(jpg)).encode() + b"\r\n\r\n" + jpg + b"\r\n")
            except (BrokenPipeError, ConnectionResetError, ConnectionAbortedError):
                pass

        def _send(self, code, ctype, body: bytes):
            self.send_response(code)
            self.send_header("Content-Type", ctype)
            self.send_header("Access-Control-Allow-Origin", "*")
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)

    return Handler


# ───────────────────────── main loops ─────────────────────────
def event_sender(api: Api, q: "queue.Queue[dict]"):
    pending: list[dict] = []
    while True:
        time.sleep(2)
        # smaller batches: events may carry snapshots (server accepts ≤50 snapshots / 12 MB per request)
        while not q.empty() and len(pending) < 100 and sum(1 for e in pending if "snapshot" in e) < 40:
            pending.append(q.get_nowait())
        if not pending:
            continue
        try:
            r = api.events(pending)
            log(f"→ sent {r.get('accepted', len(pending))} events")
            pending = []
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            # offline: keep buffering (bounded) and retry — the site syncs when the link returns
            if isinstance(e, urllib.error.HTTPError) and e.code in (400, 413):
                log(f"! server rejected a batch ({e.code}) — dropping {len(pending)} events")
                pending = []
            elif isinstance(e, urllib.error.HTTPError) and e.code == 402:
                log("! subscription inactive — events are not accepted until it is renewed")
                pending = []
            else:
                log(f"! server unreachable, buffering {len(pending)} events ({e})")
                pending = pending[-100:]  # keep the newest batch for when the link returns


def relay_loop(api: Api, cam: CamState, fps: float):
    """
    Remote viewing: push frames to the platform so the owner can watch from anywhere (outside this Wi-Fi).
    Idle (nobody watching) → one small frame every 3 s as a preview; viewers present → `fps` frames per second.
    Frames are downscaled (960 px, JPEG 70) to keep upload bandwidth low (~50–80 KB/frame).
    """
    viewers, backoff = 0, 0.0
    max_w, q = QUALITY["medium"]
    last = None
    while True:
        time.sleep(backoff or (1.0 / fps if viewers else 3.0))
        jpg = cam.jpeg
        if not jpg or jpg is last:
            continue
        last = jpg
        img = cv2.imdecode(np.frombuffer(jpg, np.uint8), cv2.IMREAD_COLOR)
        if img is None:
            continue
        if img.shape[1] > max_w:
            img = cv2.resize(img, (max_w, int(img.shape[0] * max_w / img.shape[1])), interpolation=cv2.INTER_AREA)
        ok, b = cv2.imencode(".jpg", img, [cv2.IMWRITE_JPEG_QUALITY, q])
        if not ok:
            continue
        try:
            viewers = api.frame(cam.code, b.tobytes())
            backoff = 0.0
        except urllib.error.HTTPError as e:
            # 402 = subscription inactive, 404 = camera removed: slow down, keep trying
            backoff = 30.0 if e.code in (402, 404) else 5.0
        except (urllib.error.URLError, TimeoutError, OSError):
            backoff = 5.0


def load_stream_key() -> str:
    """Secret for the MJPEG server; persisted so stream URLs saved on the platform survive restarts."""
    import secrets

    f = HERE / "stream_key.txt"
    if f.exists() and len(f.read_text().strip()) >= 24:
        return f.read_text().strip()
    key = secrets.token_urlsafe(24)
    f.write_text(key)
    return key


def heartbeat_loop(api: Api, cams: dict[str, CamState], public_base: str, stream_key: str):
    try:
        import psutil  # installed with ultralytics
    except ImportError:
        psutil = None
    last_heat = time.time()
    while True:
        # heatmap counts go up every 5 minutes (a 576-number grid per camera)
        send_heat = time.time() - last_heat >= 300 and plan_has("heatmap")
        cams_body = []
        for k, c in list(cams.items()):  # snapshot: cameras can be added while we iterate
            item = {"code": c.code, "status": c.status, "signal": 100 if c.status == "ONLINE" else 40 if c.status == "WEAK" else 0, "fps": max(1, int(round(c.fps))) if c.status != "OFFLINE" else 0, "streamUrl": f"{public_base}/{k}.mjpg?k={stream_key}", "nightVision": c.night_vision}
            if send_heat and c.heat is not None and float(c.heat.sum()) > 0:
                item["heat"] = [int(v) for v in c.heat.flatten()]
                c.heat[:] = 0
            cams_body.append(item)
        if send_heat:
            last_heat = time.time()
        body = {"firmware": "edge-1.1", "cameras": cams_body}
        if psutil:
            body["cpu"] = int(psutil.cpu_percent(interval=None))
            body["gpu"] = int(psutil.virtual_memory().percent)  # no GPU on CPU builds → report RAM load
        try:
            api.heartbeat(body)
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            log(f"! heartbeat failed: {e}")
        time.sleep(10)


def main():
    p = argparse.ArgumentParser(description="SMARTVISION Edge AI agent")
    p.add_argument("--server", default=os.environ.get("SV_SERVER", "http://localhost:3000"))
    p.add_argument("--token", default=os.environ.get("SV_TOKEN"))
    p.add_argument("--token-file", help="read the device token from this file (default: edge/token.txt)")
    p.add_argument("--source", action="append", default=[], help='override a camera source: "Cam 01=rtsp://…" or "Cam 01=samples/vtest.avi"')
    p.add_argument("--port", type=int, default=int(os.environ.get("SV_PORT", 8090)))
    p.add_argument("--host", default=os.environ.get("SV_PUBLIC_HOST") or lan_ip(), help="address browsers use to reach this PC")
    p.add_argument("--detector", choices=["yolox", "yolov8"], default=os.environ.get("SV_DETECTOR", "yolox"), help="yolox (default, Apache-2.0, free for commercial use) or yolov8 (Ultralytics, AGPL)")
    p.add_argument("--model", default=os.environ.get("SV_MODEL"), help="model file (default: models/yolox_nano.onnx — fastest on CPU; models/yolox_tiny.onnx is more accurate)")
    p.add_argument("--night-vision", choices=["auto", "on", "off"], default=os.environ.get("SV_NIGHT_VISION", "auto"), help="low-light enhancement (top plan only): auto = when the scene is dark")
    p.add_argument("--threads", type=int, default=0, help="CPU threads per camera for YOLOX (0 = automatic)")
    p.add_argument("--conf", type=float, default=0.4)
    p.add_argument("--line", type=float, default=0.55, help="counting line position, 0..1 of frame height")
    p.add_argument("--imgsz", type=int, default=640)
    p.add_argument("--no-snapshots", action="store_true", help="do not send face / head snapshots (privacy)")
    p.add_argument("--mode", choices=["SCHOOL", "HOME", "FARM"], help="override the analytics mode (default: the customer's service)")
    p.add_argument("--night", help='hours when presence is an alert, e.g. "19:00-07:00" or "off" (default depends on mode)')
    p.add_argument("--crowd", type=int, default=15, help="school: persons in view that count as crowding")
    p.add_argument("--no-fire", action="store_true", help="disable the experimental fire/smoke heuristic")
    p.add_argument("--no-plates", action="store_true", help="do not read licence plates")
    p.add_argument("--no-relay", action="store_true", help="do not push live frames to the platform (remote viewing off)")
    p.add_argument("--relay-fps", type=float, default=4.0, help="frames per second sent while someone watches remotely")
    a = p.parse_args()

    token = a.token
    tf = Path(a.token_file) if a.token_file else HERE / "token.txt"
    if not tf.is_absolute() and not tf.exists():
        tf = HERE / tf
    if not token and tf.exists():
        token = tf.read_text().strip()
    if not token:
        sys.exit("Device token required: --token <TOKEN> (Admin → Edge AI Devices), SV_TOKEN, or edge/token.txt")
    api = Api(a.server, token)

    # wait for the platform (it may still be starting, or the internet may be down)
    cfg = None
    while cfg is None:
        try:
            cfg = api.config()
        except urllib.error.HTTPError as e:
            if e.code == 402:
                log("subscription is not active — renew it in the dashboard; retrying in 60s")
                time.sleep(60)
                continue
            sys.exit(f"Server rejected the device token ({e.code}). Issue a new one in Admin → Edge AI Devices.")
        except (urllib.error.URLError, TimeoutError, OSError) as e:
            log(f"server {a.server} not reachable ({getattr(e, 'reason', e)}); retrying in 10s…")
            time.sleep(10)
    log(f"device {cfg['device']} · {cfg['organization']} · {len(cfg['cameras'])} camera(s)")

    overrides = dict(s.split("=", 1) for s in a.source)
    cams: dict[str, CamState] = {}
    skipped: set[str] = set()

    def resolve_source(c: dict) -> str | None:
        src = overrides.get(c["code"]) or c.get("sourceUrl")
        if not src and c.get("streamUrl") and "mjpg" not in c["streamUrl"]:
            src = c["streamUrl"]  # analyse the HLS stream if that's all we have
        if src and not src.startswith(("rtsp", "http")) and not Path(src).is_absolute():
            src = str((HERE / src).resolve()) if (HERE / src).exists() else src
        return src

    model_file = Path(a.model or (HERE / "models" / ("yolox_nano.onnx" if a.detector == "yolox" else "yolov8n.pt")))
    model_file.parent.mkdir(parents=True, exist_ok=True)
    if a.detector == "yolox":
        if not model_file.exists():
            sys.exit(f"YOLOX model not found: {model_file}\nDownload: https://github.com/Megvii-BaseDetection/YOLOX/releases/download/0.1.1rc0/yolox_nano.onnx (or yolox_tiny.onnx) → edge/models/")
        model_path = str(model_file)
        make_detector = lambda: YoloxDetector(model_path, a.conf, CLASSES, a.threads)  # noqa: E731
    else:
        if not model_file.exists():
            # ultralytics downloads official weights into the CWD on first use — keep them in edge/models
            os.chdir(model_file.parent)
            model_path = model_file.name
            log(f"downloading {model_path} (first run only) …")
        else:
            model_path = str(model_file)
        make_detector = lambda: Yolov8Detector(model_path, a.conf, CLASSES, a.imgsz)  # noqa: E731
    log(f"detector {a.detector.upper()} · model {model_path}")
    FEATURES["nightVision"] = bool(cfg.get("nightVision"))
    log(f"night vision: {('included in the plan · mode ' + a.night_vision) if FEATURES['nightVision'] else 'not in this plan (Pro only)'}")
    events: "queue.Queue[dict]" = queue.Queue(maxsize=5000)

    mode = a.mode or cfg.get("service") or "SCHOOL"
    rules = Rules(mode=mode, crowd=a.crowd, fire=not a.no_fire)
    guard_txt = rules.apply_guard(cfg.get("guard"), a.night)
    log(f"mode {mode} · guard hours {guard_txt} · crowd ≥{rules.crowd} · fire heuristic {'on' if rules.fire else 'off'}")

    global FACES, PLATES

    def apply_plan(c: dict):
        global PLAN
        new = set(c["features"]) if isinstance(c.get("features"), list) else None
        if new != PLAN:
            PLAN = new
            log("plan features: " + (", ".join(sorted(PLAN)) if PLAN is not None else "all (older platform)"))
        if isinstance(c.get("school"), dict):
            SCHOOL_HOURS.update({k: v for k, v in c["school"].items() if isinstance(v, str)})
        rules.fire = not a.no_fire and plan_has("fireSmoke")

    apply_plan(cfg)
    if not a.no_plates:
        from plates import PlateReader  # noqa: PLC0415

        PLATES = PlateReader()
        log("licence plates: " + ("reading on" if PLATES.ok else f"off ({PLATES.error[:120]}) — install: .venv\\Scripts\\pip install \"fast-alpr[onnx]\""))
    FACES = FaceBank()
    if FACES.ok:
        FACES.sync(api, cfg.get("students") or [])
    elif cfg.get("students"):
        log("face recognition off: put face_recognition_sface_2021dec.onnx and face_detection_yunet_2023mar.onnx into edge/models")

    public_base = f"http://{a.host}:{a.port}"
    relay_fps = max(0.5, min(a.relay_fps, 15))

    def start_camera(c: dict) -> bool:
        """Start analysing one camera from the platform config (no-op if it is already running)."""
        key = slug(c["code"])
        if key in cams:
            return False
        src = resolve_source(c)
        if not src:
            if c["code"] not in skipped:
                skipped.add(c["code"])
                log(f"[{c['code']}] no source yet (set the RTSP address in the dashboard) — will pick it up automatically")
            return False
        skipped.discard(c["code"])
        cam = CamState(code=c["code"], name=c["name"], source=src, capacity=c.get("capacity"), night_mode=c.get("nightMode") or "auto", zone=c.get("zone"), min_conf=float(c.get("minConf") or 0), scene=c.get("scene") or "gate", pen=c.get("pen"), heat=np.zeros((18, 32), np.float32))
        # one model instance per camera keeps ByteTrack state separate
        worker = CameraWorker(cam, make_detector(), events, a.conf, a.line, a.imgsz, a.night_vision)
        worker.snapshots = not a.no_snapshots
        worker.rules = rules
        worker.start()
        cams[key] = cam  # published after the worker exists, so the HTTP / heartbeat threads only see ready cameras
        if not a.no_relay:
            threading.Thread(target=relay_loop, args=(api, cam, relay_fps), daemon=True, name=f"relay-{cam.code}").start()
        log(f"[{cam.code}] AI stream → {public_base}/{key}.mjpg (protected by stream key, see edge/stream_key.txt)")
        return True

    for c in cfg["cameras"]:
        start_camera(c)
    if not cams:
        log("no cameras with a source yet — add one in the dashboard (Cameras → Add camera); this agent will start it automatically")

    def config_refresh():
        """Cameras added in the dashboard are picked up within a minute — no restart needed."""
        while True:
            time.sleep(15)  # dashboard changes (new camera, Night Vision mode) arrive within seconds
            try:
                fresh = api.config()
            except (urllib.error.URLError, TimeoutError, OSError):
                continue
            nv = bool(fresh.get("nightVision"))
            if nv != FEATURES["nightVision"]:
                FEATURES["nightVision"] = nv
                log(f"night vision {'enabled' if nv else 'disabled'} by the subscription plan")
            apply_plan(fresh)
            g = rules.apply_guard(fresh.get("guard"), a.night)
            nonlocal guard_txt
            if g != guard_txt:
                guard_txt = g
                log(f"guard hours → {g}")
            if FACES and FACES.ok:
                try:
                    FACES.sync(api, fresh.get("students") or [])
                except Exception as e:  # noqa: BLE001
                    log(f"face sync failed: {e}")
            for c in fresh.get("cameras", []):
                running = cams.get(slug(c["code"]))
                if running and running.night_mode != (c.get("nightMode") or "auto"):
                    running.night_mode = c.get("nightMode") or "auto"
                    log(f"[{c['code']}] night vision mode → {running.night_mode}")
                if running and abs(running.min_conf - float(c.get("minConf") or 0)) > 1e-6:
                    running.min_conf = float(c.get("minConf") or 0)
                    log(f"[{c['code']}] sensitivity → ignore below {running.min_conf:.2f}")
                if running and running.pen != c.get("pen"):
                    running.pen = c.get("pen")
                    log(f"[{c['code']}] animal pen {'set' if running.pen else 'removed'}")
                if running:
                    running.scene = c.get("scene") or running.scene
                if running and running.zone != c.get("zone"):
                    running.zone = c.get("zone")
                    log(f"[{c['code']}] forbidden zone {'set (' + str(len(running.zone)) + ' points)' if running.zone else 'removed'}")
                if start_camera(c):
                    log(f"[{c['code']}] new camera picked up from the dashboard")

    threading.Thread(target=event_sender, args=(api, events), daemon=True).start()
    threading.Thread(target=config_refresh, daemon=True, name="config-refresh").start()
    if not a.no_relay:
        log(f"remote viewing via platform relay: on ({a.relay_fps:g} fps while watched)")

    stream_key = load_stream_key()
    threading.Thread(target=heartbeat_loop, args=(api, cams, public_base, stream_key), daemon=True).start()

    srv = ThreadingHTTPServer(("0.0.0.0", a.port), make_handler(cams, stream_key))
    srv.daemon_threads = True
    log(f"MJPEG server on {public_base}  (Ctrl+C to stop)")
    try:
        srv.serve_forever()
    except KeyboardInterrupt:
        log("stopping")


if __name__ == "__main__":
    main()
