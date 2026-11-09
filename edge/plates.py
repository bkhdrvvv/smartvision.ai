"""
Licence-plate reading for SMARTVISION Edge (free, runs on CPU).

fast-alpr (MIT) = plate detector (open-image-models, YOLOv9, MIT) + plate OCR (fast-plate-ocr, MIT).
Install:  .venv\\Scripts\\pip install "fast-alpr[onnx]"   (models download once into the user cache)

read(car_crop) → (text, confidence, plate box) ; photo(...) → sharp JPEG: the car with the plate marked
and the plate itself enlarged and sharpened underneath, so the number is readable on a phone.
"""

from __future__ import annotations

import re

import cv2
import numpy as np

PLATE_RE = re.compile(r"^[A-Z0-9]{5,10}$")


class PlateReader:
    def __init__(self):
        self.ok = False
        self.error = ""
        try:
            from fast_alpr import ALPR  # noqa: PLC0415

            self.alpr = ALPR(detector_model="yolo-v9-t-384-license-plate-end2end", ocr_model="cct-xs-v1-global-model")
            self.ok = True
        except Exception as e:  # noqa: BLE001 — library missing / model download failed → feature off
            self.error = str(e)

    def read(self, img: np.ndarray) -> tuple[str, float, tuple[int, int, int, int]] | None:
        """Best plate in the image: (text, mean character confidence 0..1, (x1, y1, x2, y2))."""
        if not self.ok or img is None or img.size == 0:
            return None
        best = None
        for r in self.alpr.predict(img):
            ocr = getattr(r, "ocr", None)
            if not ocr or not ocr.text:
                continue
            text = re.sub(r"[^A-Z0-9]", "", ocr.text.upper())
            conf = ocr.confidence
            conf = float(np.mean(conf)) if isinstance(conf, (list, tuple, np.ndarray)) else float(conf or 0)
            if not PLATE_RE.match(text):
                continue
            b = r.detection.bounding_box
            box = (int(b.x1), int(b.y1), int(b.x2), int(b.y2))
            if best is None or conf > best[1]:
                best = (text, conf, box)
        return best


def _sharpen(img: np.ndarray) -> np.ndarray:
    blur = cv2.GaussianBlur(img, (0, 0), 1.2)
    return cv2.addWeighted(img, 1.6, blur, -0.6, 0)


def photo(car: np.ndarray, box: tuple[int, int, int, int], text: str) -> bytes | None:
    """Car (plate framed in green) + the plate enlarged ×4 and sharpened with the read number."""
    h, w = car.shape[:2]
    x1, y1, x2, y2 = max(0, box[0]), max(0, box[1]), min(w, box[2]), min(h, box[3])
    if x2 - x1 < 4 or y2 - y1 < 4:
        return None
    W = 720
    scale = W / w
    top = cv2.resize(car, (W, max(1, int(h * scale))), interpolation=cv2.INTER_CUBIC if scale > 1 else cv2.INTER_AREA)
    top = _sharpen(top) if scale > 1 else top
    cv2.rectangle(top, (int(x1 * scale), int(y1 * scale)), (int(x2 * scale), int(y2 * scale)), (60, 220, 60), 3)
    # the plate: pad a little, enlarge to the full width, sharpen
    px, py = int((x2 - x1) * 0.08), int((y2 - y1) * 0.15)
    plate = car[max(0, y1 - py):min(h, y2 + py), max(0, x1 - px):min(w, x2 + px)]
    ph = max(1, int(plate.shape[0] * (W - 40) / plate.shape[1]))
    big = _sharpen(cv2.resize(plate, (W - 40, min(ph, 260)), interpolation=cv2.INTER_CUBIC))
    strip_h = big.shape[0] + 90
    strip = np.full((strip_h, W, 3), 18, np.uint8)
    strip[20:20 + big.shape[0], 20:20 + big.shape[1]] = big
    fs = 1.3
    (tw, th), _ = cv2.getTextSize(text, cv2.FONT_HERSHEY_DUPLEX, fs, 2)
    cv2.putText(strip, text, ((W - tw) // 2, 20 + big.shape[0] + 30 + th // 2), cv2.FONT_HERSHEY_DUPLEX, fs, (255, 255, 255), 2, cv2.LINE_AA)
    out = np.vstack([top, strip])
    ok, b = cv2.imencode(".jpg", out, [cv2.IMWRITE_JPEG_QUALITY, 92])
    return b.tobytes() if ok else None
