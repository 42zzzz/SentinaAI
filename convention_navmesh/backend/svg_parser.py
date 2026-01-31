"""backend.svg_parser

SVG Parser Module

Extracts ONLY the 26 destination halls + corridor polygons from an SVG.

Room/Hall detection (STRICT):
- Element label/id contains "hall" (case-insensitive)
- AND fill is one of the allowed hall colors (HALL_FILLS)
- Supports halls as <rect>, <path>, and <polygon>

Corridor detection:
- Fill matches CORRIDOR_FILL (#9e2a2b), also tolerates #RRGGBBAA
- Supports <rect>, <path>, and <polygon>
- Path parsing supports M, L, l, H, h, V, v, Z, C, c. If curves exist, convert to polygons in Inkscape.

Return structure (matches backend expectations):
{
  "dimensions": {"width": ..., "height": ...},
  "rooms": [...],
  "corridors": [...]
}
"""

from __future__ import annotations

import re
import xml.etree.ElementTree as ET
from typing import Dict, List, Optional, Tuple


SVG_NS = "http://www.w3.org/2000/svg"

# Only these fills are considered halls (your provided hall colors)
HALL_FILLS = {
    "#1f3a5f",
    "#2f8f9d",
    "#e09f3e",
    "#9e2a2b",
}


# Corridor fill (alpha tolerated via normalization)
CORRIDOR_FILL = "#ff00ff"

TARGET_HALL_COUNT = 26


def _strip_ns(tag: str) -> str:
    return tag.split("}", 1)[1] if "}" in tag else tag


def _parse_floats(s: str) -> List[float]:
    return [float(x) for x in re.findall(r"-?\d+(?:\.\d+)?", s or "")]


def _get_style_attr(el: ET.Element, key: str) -> Optional[str]:
    style = el.get("style", "") or ""
    m = re.search(rf"{re.escape(key)}\s*:\s*([^;]+)", style, flags=re.IGNORECASE)
    return m.group(1).strip() if m else None


def _normalize_hex_color(s: str) -> Optional[str]:
    """
    Normalizes:
      - #rrggbbaa -> #rrggbb
      - keeps #rrggbb
    Rejects:
      - rgb()/rgba()
      - url(...)
      - named colors
    """
    if not s:
        return None
    s = s.strip().lower()
    if s == "none":
        return None
    if re.fullmatch(r"#([0-9a-f]{8})", s):
        s = s[:7]
    if re.fullmatch(r"#([0-9a-f]{6})", s):
        return s
    return None


def get_normalized_fill(el: ET.Element) -> Optional[str]:
    fill = el.get("fill")
    if not fill:
        fill = _get_style_attr(el, "fill")
    return _normalize_hex_color(fill)


def get_label_text(el: ET.Element) -> str:
    """
    Best-effort label/id detection (Inkscape commonly stores labels in inkscape:label).
    """
    parts: List[str] = []
    if el.get("id"):
        parts.append(el.get("id"))  # type: ignore[arg-type]

    # inkscape:label and other *:label attributes
    for k, v in el.attrib.items():
        if k.lower().endswith("label") and v:
            parts.append(v)

    if el.get("aria-label"):
        parts.append(el.get("aria-label"))  # type: ignore[arg-type]

    return " ".join(parts).strip().lower()


def _rect_to_poly(x: float, y: float, w: float, h: float) -> List[List[float]]:
    return [[x, y], [x + w, y], [x + w, y + h], [x, y + h]]


def _poly_area(poly: List[List[float]]) -> float:
    """Shoelace area (absolute)."""
    if len(poly) < 3:
        return 0.0
    a = 0.0
    n = len(poly)
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        a += x1 * y2 - x2 * y1
    return abs(a) * 0.5


def _poly_bbox(poly: List[List[float]]) -> Dict[str, float]:
    xs = [p[0] for p in poly]
    ys = [p[1] for p in poly]
    return {
        "x": float(min(xs)),
        "y": float(min(ys)),
        "width": float(max(xs) - min(xs)),
        "height": float(max(ys) - min(ys)),
    }


def _poly_centroid(poly: List[List[float]]) -> Dict[str, float]:
    """
    Centroid of polygon; falls back to average of points if degenerate.
    """
    n = len(poly)
    if n == 0:
        return {"x": 0.0, "y": 0.0}

    a2 = 0.0
    cx = 0.0
    cy = 0.0
    for i in range(n):
        x1, y1 = poly[i]
        x2, y2 = poly[(i + 1) % n]
        cross = x1 * y2 - x2 * y1
        a2 += cross
        cx += (x1 + x2) * cross
        cy += (y1 + y2) * cross

    if abs(a2) < 1e-9:
        sx = sum(p[0] for p in poly)
        sy = sum(p[1] for p in poly)
        return {"x": sx / n, "y": sy / n}

    a = a2 * 0.5
    cx /= (6.0 * a)
    cy /= (6.0 * a)
    return {"x": float(cx), "y": float(cy)}


class SVGParser:
    """Parse SVG files to extract geometric data for navigation mesh."""

    def __init__(self, svg_path: str):
        self.svg_path = svg_path
        self.tree = ET.parse(svg_path)
        self.root = self.tree.getroot()

        # viewBox is the most reliable canvas size
        viewbox = self.root.get("viewBox", "0 0 5600 3200")
        try:
            _, _, self.width, self.height = map(float, viewbox.split())
        except Exception:
            self.width, self.height = 5600.0, 3200.0

    # -------------------------
    # Halls (destinations)
    # -------------------------

    def extract_rooms(self) -> List[Dict]:
        """
        Extract ONLY the 26 halls as destination "rooms".

        Strict criteria:
        - tag in (rect, path, polygon)
        - label/id contains "hall"
        - fill is one of HALL_FILLS
        """
        candidates: List[Dict] = []

        for el in self.root.iter():
            tag = _strip_ns(el.tag)
            if tag not in ("rect", "path", "polygon"):
                continue

            fill = get_normalized_fill(el)
            if fill not in HALL_FILLS:
                continue

            label = get_label_text(el)
            if "hall" not in label:
                continue

            poly: Optional[List[List[float]]] = None

            if tag == "rect":
                x = float(el.get("x", 0))
                y = float(el.get("y", 0))
                w = float(el.get("width", 0))
                h = float(el.get("height", 0))
                if w <= 0 or h <= 0:
                    continue
                poly = _rect_to_poly(x, y, w, h)

            elif tag == "polygon":
                poly = self._parse_polygon_points(el.get("points", ""))

            elif tag == "path":
                poly = self._parse_path_to_points(el.get("d", ""))

            if not poly or len(poly) < 3:
                continue

            area = _poly_area(poly)
            if area <= 0:
                continue

            candidates.append(
                {
                    "type": "room",
                    "name": el.get("id", "") or label or "hall",
                    "bounds": _poly_bbox(poly),
                    "center": _poly_centroid(poly),
                    "polygon": poly,
                    "_area": area,
                }
            )

        # Enforce exactly 26 halls
        if len(candidates) > TARGET_HALL_COUNT:
            candidates.sort(key=lambda r: r["_area"], reverse=True)
            candidates = candidates[:TARGET_HALL_COUNT]

        for r in candidates:
            r.pop("_area", None)

        return candidates

    # -------------------------
    # Corridors (walkable)
    # -------------------------

    def extract_corridors(self) -> List[Dict]:
        """
        Extract corridor polygons (red #9e2a2b). Supports:
        - rect corridors
        - path corridors (M/L/l/H/V/Z)
        - polygon corridors
        Fill may be #9e2a2b or #9e2a2bff, and may be stored in style.
        """
        corridors: List[Dict] = []

        for el in self.root.iter():
            tag = _strip_ns(el.tag)
            if tag not in ("rect", "path", "polygon"):
                continue

            fill = get_normalized_fill(el)
            if fill != CORRIDOR_FILL:
                continue

            if tag == "rect":
                x = float(el.get("x", 0))
                y = float(el.get("y", 0))
                w = float(el.get("width", 0))
                h = float(el.get("height", 0))
                if w <= 0 or h <= 0:
                    continue
                poly = _rect_to_poly(x, y, w, h)
                corridors.append(self._poly_to_corridor(poly))

            elif tag == "polygon":
                pts = self._parse_polygon_points(el.get("points", ""))
                if pts and len(pts) >= 3:
                    corridors.append(self._poly_to_corridor(pts))

            elif tag == "path":
                pts = self._parse_path_to_points(el.get("d", ""))
                if pts and len(pts) >= 3:
                    corridors.append(self._poly_to_corridor(pts))

        return corridors

    def _poly_to_corridor(self, pts: List[List[float]]) -> Dict:
        return {
            "type": "corridor",
            "bounds": _poly_bbox(pts),
            "polygon": pts,
        }

    def _parse_polygon_points(self, points_str: str) -> Optional[List[List[float]]]:
        if not points_str:
            return None
        nums = re.findall(r"-?\d+\.?\d*", points_str)
        if len(nums) < 6:
            return None
        pts: List[List[float]] = []
        for i in range(0, len(nums), 2):
            if i + 1 < len(nums):
                pts.append([float(nums[i]), float(nums[i + 1])])
        return pts if len(pts) >= 3 else None

    def _parse_path_to_points(self, d: str) -> Optional[List[List[float]]]:
        """Convert an SVG path `d` string into a polyline.

        Supported commands:
        - M/m, L/l, H/h, V/v, Z/z
        - C/c cubic Beziers (approximated by sampling)
        """
        if not d:
            return None

        # Include all command letters so unsupported commands don't get silently dropped.
        # If a command letter is dropped, its numeric params can be mis-associated with the
        # previous command, producing broken geometry.
        tokens = re.findall(r"[A-Za-z]|-?\d+(?:\.\d+)?", d)
        if not tokens:
            return None

        pts: List[List[float]] = []
        i = [0]  # mutable index into tokens
        cmd: Optional[str] = None
        cur = [0.0, 0.0]
        start: Optional[List[float]] = None

        def cubic_bezier(p0, p1, p2, p3, t: float):
            mt = 1.0 - t
            return (
                (mt ** 3) * p0[0]
                + 3 * (mt ** 2) * t * p1[0]
                + 3 * mt * (t ** 2) * p2[0]
                + (t ** 3) * p3[0],
                (mt ** 3) * p0[1]
                + 3 * (mt ** 2) * t * p1[1]
                + 3 * mt * (t ** 2) * p2[1]
                + (t ** 3) * p3[1],
            )

        def read_num() -> float:
            if i[0] >= len(tokens):
                raise ValueError("Unexpected end of path data")
            val = float(tokens[i[0]])
            i[0] += 1
            return val

        while i[0] < len(tokens):
            t = tokens[i[0]]

            # Command letter
            if re.fullmatch(r"[A-Za-z]", t):
                cmd = t
                i[0] += 1
                if cmd in ("Z", "z") and start is not None:
                    pts.append([start[0], start[1]])
                continue

            if cmd is None:
                # Malformed path: numeric token before any command
                i[0] += 1
                continue

            if cmd == "M":
                x = read_num()
                y = read_num()
                cur = [x, y]
                start = [x, y]
                pts.append([x, y])
                cmd = "L"  # subsequent pairs are treated as implicit "L"

            elif cmd == "m":
                x = cur[0] + read_num()
                y = cur[1] + read_num()
                cur = [x, y]
                start = [x, y]
                pts.append([x, y])
                cmd = "l"

            elif cmd == "L":
                x = read_num()
                y = read_num()
                cur = [x, y]
                pts.append([x, y])

            elif cmd == "l":
                x = cur[0] + read_num()
                y = cur[1] + read_num()
                cur = [x, y]
                pts.append([x, y])

            elif cmd == "H":
                x = read_num()
                cur = [x, cur[1]]
                pts.append([cur[0], cur[1]])

            elif cmd == "h":
                x = cur[0] + read_num()
                cur = [x, cur[1]]
                pts.append([cur[0], cur[1]])

            elif cmd == "V":
                y = read_num()
                cur = [cur[0], y]
                pts.append([cur[0], cur[1]])

            elif cmd == "v":
                y = cur[1] + read_num()
                cur = [cur[0], y]
                pts.append([cur[0], cur[1]])

            elif cmd == "C":
                x1 = read_num()
                y1 = read_num()
                x2 = read_num()
                y2 = read_num()
                x = read_num()
                y = read_num()

                p0 = (cur[0], cur[1])
                p1 = (x1, y1)
                p2 = (x2, y2)
                p3 = (x, y)

                # Sample the curve into straight segments
                for step in range(1, 11):
                    tt = step / 10.0
                    bx, by = cubic_bezier(p0, p1, p2, p3, tt)
                    pts.append([float(bx), float(by)])

                cur = [x, y]

            elif cmd == "c":
                x1 = cur[0] + read_num()
                y1 = cur[1] + read_num()
                x2 = cur[0] + read_num()
                y2 = cur[1] + read_num()
                x = cur[0] + read_num()
                y = cur[1] + read_num()

                p0 = (cur[0], cur[1])
                p1 = (x1, y1)
                p2 = (x2, y2)
                p3 = (x, y)

                for step in range(1, 11):
                    tt = step / 10.0
                    bx, by = cubic_bezier(p0, p1, p2, p3, tt)
                    pts.append([float(bx), float(by)])

                cur = [x, y]

            else:
                # Unsupported command: safest is to bail out.
                return None

        # De-duplicate consecutive points
        cleaned: List[List[float]] = []
        for p in pts:
            if not cleaned or cleaned[-1] != p:
                cleaned.append(p)

        return cleaned if len(cleaned) >= 3 else None


    # -------------------------
    # API helpers
    # -------------------------

    def get_dimensions(self) -> Tuple[float, float]:
        return self.width, self.height

    def extract_all(self) -> Dict:
        return {
            "dimensions": {"width": self.width, "height": self.height},
            "rooms": self.extract_rooms(),
            "corridors": self.extract_corridors(),
        }
