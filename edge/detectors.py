"""
Object detectors for the SMARTVISION Edge agent.

  yolox   — YOLOX (Megvii, Apache-2.0) ONNX model + ONNX Runtime (MIT) + the built-in ByteTrack-style
            tracker below (MIT-compatible, written for this project). Free for commercial use. DEFAULT.
  yolov8  — Ultralytics YOLOv8 + ByteTrack. AGPL-3.0: a paid Ultralytics licence is needed to sell it
            as a closed product. Kept only as a fallback (`--detector yolov8`).

Every detector returns the same thing per frame:  [(x1, y1, x2, y2, cls, conf, track_id), ...]
with COCO class ids, already filtered to `classes`.
"""

from __future__ import annotations

from pathlib import Path

import cv2
import numpy as np

Det = tuple[int, int, int, int, int, float, int]


# ───────────────────────── tracker (ByteTrack idea, no extra packages) ─────────────────────────
def iou_matrix(a: np.ndarray, b: np.ndarray) -> np.ndarray:
    """IoU between every box in a (N,4) and b (M,4), xyxy."""
    if len(a) == 0 or len(b) == 0:
        return np.zeros((len(a), len(b)), dtype=np.float32)
    x1 = np.maximum(a[:, None, 0], b[None, :, 0])
    y1 = np.maximum(a[:, None, 1], b[None, :, 1])
    x2 = np.minimum(a[:, None, 2], b[None, :, 2])
    y2 = np.minimum(a[:, None, 3], b[None, :, 3])
    inter = np.clip(x2 - x1, 0, None) * np.clip(y2 - y1, 0, None)
    area_a = (a[:, 2] - a[:, 0]) * (a[:, 3] - a[:, 1])
    area_b = (b[:, 2] - b[:, 0]) * (b[:, 3] - b[:, 1])
    return inter / np.maximum(area_a[:, None] + area_b[None, :] - inter, 1e-6)


def assign(cost: np.ndarray, max_cost: float) -> list[tuple[int, int]]:
    """Optimal assignment (lap if installed, else greedy). Returns matched (row, col) pairs under max_cost."""
    if cost.size == 0:
        return []
    try:
        import lap

        _, x, _ = lap.lapjv(cost, extend_cost=True, cost_limit=max_cost)
        return [(i, int(j)) for i, j in enumerate(x) if j >= 0]
    except ImportError:
        pairs, used_r, used_c = [], set(), set()
        for flat in np.argsort(cost, axis=None):
            i, j = divmod(int(flat), cost.shape[1])
            if cost[i, j] > max_cost:
                break
            if i not in used_r and j not in used_c:
                pairs.append((i, j))
                used_r.add(i)
                used_c.add(j)
        return pairs


class Track:
    __slots__ = ("id", "box", "vel", "cls", "conf", "age", "lost", "hits")

    def __init__(self, tid: int, box: np.ndarray, cls: int, conf: float):
        self.id, self.box, self.cls, self.conf = tid, box.astype(np.float32), cls, conf
        self.vel = np.zeros(4, dtype=np.float32)
        self.age = self.lost = 0
        self.hits = 1

    def predict(self):
        self.box = self.box + self.vel  # constant velocity between frames
        self.age += 1

    def update(self, box: np.ndarray, conf: float):
        box = box.astype(np.float32)
        self.vel = 0.6 * self.vel + 0.4 * (box - self.box)
        self.box, self.conf = box, conf
        self.lost = 0
        self.hits += 1


class ByteTracker:
    """
    Two-stage association like ByteTrack: confident detections first, then low-score detections
    rescue tracks that were briefly occluded. Same-class matching only. IDs are stable per camera.
    """

    def __init__(self, high: float = 0.45, low: float = 0.1, match_iou: float = 0.25, max_lost: int = 30):
        self.high, self.low, self.match_iou, self.max_lost = high, low, match_iou, max_lost
        self.tracks: list[Track] = []
        self.next_id = 1

    def update(self, boxes: np.ndarray, scores: np.ndarray, classes: np.ndarray) -> list[Det]:
        for t in self.tracks:
            t.predict()
        hi = scores >= self.high
        lo = (scores >= self.low) & ~hi
        unmatched = list(range(len(self.tracks)))
        out: list[Det] = []

        def match(det_idx: np.ndarray, track_idx: list[int], min_iou: float) -> tuple[list[int], list[int]]:
            if not len(det_idx) or not track_idx:
                return list(det_idx), track_idx
            tb = np.array([self.tracks[k].box for k in track_idx])
            iou = iou_matrix(boxes[det_idx], tb)
            # forbid cross-class matches
            same = classes[det_idx][:, None] == np.array([self.tracks[k].cls for k in track_idx])[None, :]
            cost = np.where(same, 1.0 - iou, 1.0)
            pairs = assign(cost, 1.0 - min_iou)
            used_d, used_t = set(), set()
            for i, j in pairs:
                d, k = int(det_idx[i]), track_idx[j]
                self.tracks[k].update(boxes[d], float(scores[d]))
                used_d.add(i)
                used_t.add(j)
            return [int(det_idx[i]) for i in range(len(det_idx)) if i not in used_d], [track_idx[j] for j in range(len(track_idx)) if j not in used_t]

        left_hi, unmatched = match(np.where(hi)[0], unmatched, self.match_iou)
        _, unmatched = match(np.where(lo)[0], unmatched, 0.4)

        for k in unmatched:
            self.tracks[k].lost += 1
        for d in left_hi:  # new objects start only from confident detections
            self.tracks.append(Track(self.next_id, boxes[d], int(classes[d]), float(scores[d])))
            self.next_id += 1
        self.tracks = [t for t in self.tracks if t.lost <= self.max_lost]

        for t in self.tracks:
            if t.lost == 0 and (t.hits >= 2 or t.conf >= 0.6):  # report confirmed, currently visible tracks
                x1, y1, x2, y2 = (int(v) for v in t.box)
                out.append((x1, y1, x2, y2, t.cls, t.conf, t.id))
        return out


# ───────────────────────── YOLOX (ONNX Runtime) ─────────────────────────
def nms(boxes: np.ndarray, scores: np.ndarray, thr: float) -> list[int]:
    order = scores.argsort()[::-1]
    keep = []
    while order.size:
        i = int(order[0])
        keep.append(i)
        if order.size == 1:
            break
        iou = iou_matrix(boxes[i : i + 1], boxes[order[1:]])[0]
        order = order[1:][iou < thr]
    return keep


class YoloxDetector:
    name = "YOLOX"

    def __init__(self, model_path: str | Path, conf: float, classes: list[int], threads: int = 0):
        import onnxruntime as ort

        so = ort.SessionOptions()
        if threads:
            so.intra_op_num_threads = threads
        self.sess = ort.InferenceSession(str(model_path), sess_options=so, providers=ort.get_available_providers())
        inp = self.sess.get_inputs()[0]
        self.input_name = inp.name
        self.h, self.w = int(inp.shape[2]), int(inp.shape[3])
        self.conf = conf
        self.classes = np.array(classes)
        self.tracker = ByteTracker(high=max(conf, 0.3), low=0.1)
        # decode grid for the stride-8/16/32 heads (the official ONNX export outputs raw offsets)
        grids, strides = [], []
        for s in (8, 16, 32):
            gh, gw = self.h // s, self.w // s
            xv, yv = np.meshgrid(np.arange(gw), np.arange(gh))
            grids.append(np.stack((xv, yv), 2).reshape(-1, 2))
            strides.append(np.full((gh * gw, 1), s))
        self.grid = np.concatenate(grids).astype(np.float32)
        self.stride = np.concatenate(strides).astype(np.float32)

    def detect(self, frame: np.ndarray) -> tuple[np.ndarray, np.ndarray, np.ndarray]:
        fh, fw = frame.shape[:2]
        r = min(self.h / fh, self.w / fw)
        nh, nw = int(fh * r), int(fw * r)
        padded = np.full((self.h, self.w, 3), 114, dtype=np.uint8)  # letterbox like YOLOX training
        padded[:nh, :nw] = cv2.resize(frame, (nw, nh), interpolation=cv2.INTER_LINEAR)
        blob = padded.transpose(2, 0, 1)[None].astype(np.float32)  # BGR, 0..255, CHW — as the model expects
        out = self.sess.run(None, {self.input_name: blob})[0][0]
        xy = (out[:, :2] + self.grid) * self.stride
        wh = np.exp(out[:, 2:4]) * self.stride
        scores_all = out[:, 4:5] * out[:, 5:]  # objectness × class probability
        cls = scores_all.argmax(1)
        score = scores_all[np.arange(len(cls)), cls]
        keep = (score >= 0.1) & np.isin(cls, self.classes)
        xy, wh, cls, score = xy[keep], wh[keep], cls[keep], score[keep]
        boxes = np.concatenate([xy - wh / 2, xy + wh / 2], 1) / r
        boxes[:, [0, 2]] = boxes[:, [0, 2]].clip(0, fw - 1)
        boxes[:, [1, 3]] = boxes[:, [1, 3]].clip(0, fh - 1)
        # class-aware NMS (offset boxes per class so classes never suppress each other)
        k = nms(boxes + cls[:, None] * 4096, score, 0.45) if len(boxes) else []
        return boxes[k], score[k], cls[k]

    def track(self, frame: np.ndarray) -> list[Det]:
        boxes, scores, cls = self.detect(frame)
        return self.tracker.update(boxes, scores, cls)


# ───────────────────────── YOLOv8 (Ultralytics, AGPL — fallback only) ─────────────────────────
class Yolov8Detector:
    name = "YOLOv8"

    def __init__(self, model_path: str, conf: float, classes: list[int], imgsz: int):
        from ultralytics import YOLO

        self.model = YOLO(model_path)
        self.conf, self.classes, self.imgsz = conf, classes, imgsz

    def track(self, frame: np.ndarray) -> list[Det]:
        res = self.model.track(frame, persist=True, classes=self.classes, conf=self.conf, imgsz=self.imgsz, verbose=False, tracker="bytetrack.yaml")[0]
        b = res.boxes
        if b is None or b.id is None:
            return []
        out: list[Det] = []
        for xyxy, c, s, t in zip(b.xyxy.cpu().numpy(), b.cls.cpu().numpy(), b.conf.cpu().numpy(), b.id.cpu().numpy()):
            x1, y1, x2, y2 = map(int, xyxy)
            out.append((x1, y1, x2, y2, int(c), float(s), int(t)))
        return out


# ───────────────────────── night vision ─────────────────────────
class NightVision:
    """
    Low-light enhancement for night cameras: local contrast (CLAHE on luminance), adaptive gamma that
    lifts shadows more the darker the scene is, light denoising. Turns on automatically when the scene is
    dark (and turns off again in daylight) — the detector also sees the enhanced image, so people are
    found in the dark much more reliably.
    """

    def __init__(self, on_below: float = 70.0, off_above: float = 95.0):
        self.on_below, self.off_above = on_below, off_above
        self.active = False
        self.brightness = 128.0
        self.clahe = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        self._lut_for: float | None = None
        self._lut = None

    def measure(self, frame: np.ndarray) -> float:
        small = cv2.resize(frame, (64, 36), interpolation=cv2.INTER_AREA)
        b = float(cv2.cvtColor(small, cv2.COLOR_BGR2GRAY).mean())
        self.brightness = 0.85 * self.brightness + 0.15 * b  # smooth: headlights / flicker don't toggle it
        # hysteresis so it does not flip on and off at dusk
        if not self.active and self.brightness < self.on_below:
            self.active = True
        elif self.active and self.brightness > self.off_above:
            self.active = False
        return self.brightness

    def enhance(self, frame: np.ndarray) -> np.ndarray:
        lab = cv2.cvtColor(frame, cv2.COLOR_BGR2LAB)
        l, a, b = cv2.split(lab)
        l = self.clahe.apply(l)
        # darker scene → stronger gamma (0.45 in near darkness … 0.8 at dusk)
        g = round(float(np.clip(0.45 + self.brightness / 200.0, 0.45, 0.8)), 2)
        if g != self._lut_for:
            self._lut = (np.power(np.arange(256) / 255.0, g) * 255).astype(np.uint8)
            self._lut_for = g
        l = cv2.LUT(l, self._lut)
        out = cv2.cvtColor(cv2.merge((l, a, b)), cv2.COLOR_LAB2BGR)
        return cv2.bilateralFilter(out, 5, 30, 5)  # tame the noise the boost brings up
