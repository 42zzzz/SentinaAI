#!/usr/bin/env python3
"""Sanitize the sample telemetry stream.

Converts `shared/telemetry/telemetry_stream.jsonl` into a minimized,
anonymized file `shared/telemetry/telemetry_sanitized.jsonl`.

Why:
  - NFR-24: Prevent storage of facial/personal identifiers.
  - NFR-25: Store only what downstream services need.

Run:
  TELEMETRY_HMAC_KEY='change-me' python shared/telemetry/sanitize_existing_stream.py
"""

from __future__ import annotations

import os
from pathlib import Path

from sanitize import SanitizerConfig, sanitize_jsonl_stream


def main() -> int:
    key = os.environ.get("TELEMETRY_HMAC_KEY")
    if not key:
        raise SystemExit("Missing TELEMETRY_HMAC_KEY env var")

    here = Path(__file__).resolve().parent
    in_path = here / "telemetry_stream.jsonl"
    out_path = here / "telemetry_sanitized.jsonl"

    cfg = SanitizerConfig(hmac_key=key.encode("utf-8"), keep_reading_id=False, include_device_hash=True)
    summary = sanitize_jsonl_stream(in_path, out_path, cfg)

    print("Sanitization complete")
    for k, v in summary.items():
        print(f"  {k}: {v}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
