"""shared.telemetry.sanitize

Security utilities for IoT telemetry.

Implements:
- NFR-24: Anonymize people counting data and never persist facial/personal identifiers.
- NFR-25: Data-minimization via strict allow-lists and field dropping.

This module is intentionally strict:
  * Unknown fields are dropped.
  * Potentially identifying payloads (faces, tracks, embeddings, bboxes, frames, etc.)
    are never written out.

The primary output format is a sanitized JSONL stream where `deviceId` is replaced
with a deterministic HMAC hash (`deviceHash`).
"""

from __future__ import annotations

import hashlib
import hmac
import json
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Dict, Optional


DISALLOWED_KEYS_SUBSTR = (
    # biometric / identity-ish
    "face",
    "faces",
    "embedding",
    "embeddings",
    "reid",
    "personid",
    "person_id",
    "track",
    "tracks",
    "trackid",
    "track_id",
    # raw video / images
    "frame",
    "frames",
    "image",
    "images",
    "jpeg",
    "png",
    "base64",
    "bbox",
    "bboxes",
    "bounding",
    # device/network identifiers that shouldn't be persisted for analytics
    "mac",
    "ip",
)


ALLOWED_VALUES_FIELDS: Dict[str, tuple[str, ...]] = {
    # minimal health
    "heartbeat": ("health", "lastHeartbeat"),
    "edge_status": ("cpuPct", "memPct", "queueDepth"),
    # people counting (anonymized)
    "occupancy": ("occupancyCount", "occupancyRate"),
    "video_analytics": ("estimatedCount", "inflow", "outflow"),
    # environment
    "temp_humidity": ("temperatureC", "humidityPct"),
    "environment": ("co2ppm", "noiseDb"),
}


@dataclass(frozen=True)
class SanitizerConfig:
    """Configuration for telemetry sanitization."""

    hmac_key: bytes
    # which reading types are permitted to be stored
    allow_types: tuple[str, ...] = tuple(ALLOWED_VALUES_FIELDS.keys())
    # whether to include deviceHash at all (some deployments may omit)
    include_device_hash: bool = True
    # whether to keep `readingId` (default: drop for minimization)
    keep_reading_id: bool = False


def _hmac_sha256_hex(key: bytes, value: str) -> str:
    return hmac.new(key, value.encode("utf-8"), hashlib.sha256).hexdigest()


def _contains_disallowed_key(obj: Any) -> bool:
    """Best-effort scan for disallowed keys in nested dict/list payloads."""
    if isinstance(obj, dict):
        for k, v in obj.items():
            lk = str(k).lower()
            if any(s in lk for s in DISALLOWED_KEYS_SUBSTR):
                return True
            if _contains_disallowed_key(v):
                return True
    elif isinstance(obj, list):
        return any(_contains_disallowed_key(v) for v in obj)
    return False


def sanitize_record(record: Dict[str, Any], cfg: SanitizerConfig) -> Optional[Dict[str, Any]]:
    """Return a sanitized telemetry record or None if it should be dropped."""
    if not isinstance(record, dict):
        return None

    reading_type = str(record.get("readingType") or "").strip()
    if reading_type not in cfg.allow_types:
        return None

    # Immediately reject any record containing suspicious payload keys.
    # This prevents accidental storage of facial identifiers or raw frames.
    if _contains_disallowed_key(record):
        return None

    zone_id = record.get("zoneId")
    hall_id = record.get("hallId")
    ts = record.get("timestamp")
    quality = record.get("quality")
    data_source = record.get("dataSource")

    # Values allow-list by type
    allowed_vals = ALLOWED_VALUES_FIELDS.get(reading_type, ())
    in_vals = record.get("values") if isinstance(record.get("values"), dict) else {}
    out_vals: Dict[str, Any] = {}
    for k in allowed_vals:
        if k in in_vals:
            v = in_vals.get(k)
            # only allow primitive values for minimization
            if isinstance(v, (int, float, str, bool)) or v is None:
                out_vals[k] = v

    out: Dict[str, Any] = {
        "zoneId": zone_id,
        "hallId": hall_id,
        "timestamp": ts,
        "readingType": reading_type,
        "values": out_vals,
    }

    if quality is not None:
        out["quality"] = quality
    if data_source is not None:
        out["dataSource"] = data_source

    if cfg.keep_reading_id and record.get("readingId"):
        out["readingId"] = str(record.get("readingId"))

    if cfg.include_device_hash:
        device_id = str(record.get("deviceId") or "").strip()
        out["deviceHash"] = _hmac_sha256_hex(cfg.hmac_key, device_id) if device_id else None

    # Drop empty keys (data minimization)
    for k in ["zoneId", "hallId", "timestamp"]:
        if out.get(k) in ("", None):
            out.pop(k, None)

    return out


def sanitize_jsonl_stream(
    in_path: str | Path,
    out_path: str | Path,
    cfg: SanitizerConfig,
    *,
    max_lines: Optional[int] = None,
) -> dict:
    """Sanitize a JSONL stream file.

    Returns a summary dict.
    """
    in_path = Path(in_path)
    out_path = Path(out_path)
    out_path.parent.mkdir(parents=True, exist_ok=True)

    kept = 0
    dropped = 0
    total = 0

    with in_path.open("r", encoding="utf-8") as fin, out_path.open("w", encoding="utf-8") as fout:
        for line in fin:
            if max_lines is not None and total >= max_lines:
                break
            total += 1
            line = line.strip()
            if not line:
                continue
            try:
                rec = json.loads(line)
            except Exception:
                dropped += 1
                continue
            out_rec = sanitize_record(rec, cfg)
            if out_rec is None:
                dropped += 1
                continue
            fout.write(json.dumps(out_rec, ensure_ascii=False) + "\n")
            kept += 1

    return {"in": str(in_path), "out": str(out_path), "total": total, "kept": kept, "dropped": dropped}
