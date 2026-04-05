from __future__ import annotations

from pathlib import Path
from typing import Any, Dict
from jinja2 import Environment, FileSystemLoader, select_autoescape
import pdfkit
import os
import shutil


def _find_wkhtmltopdf() -> str:
    env_path = os.getenv("WKHTMLTOPDF_PATH")
    if env_path and Path(env_path).exists():
        return env_path

    candidates = [
        r"C:\Program Files\wkhtmltopdf\bin\wkhtmltopdf.exe",
        r"C:\Program Files (x86)\wkhtmltopdf\bin\wkhtmltopdf.exe",
        "/usr/local/bin/wkhtmltopdf",
    ]
    for p in candidates:
        if Path(p).exists():
            return p

    found = shutil.which("wkhtmltopdf")
    if found:
        return found

    raise RuntimeError(
        "wkhtmltopdf not found. Install it or set WKHTMLTOPDF_PATH."
    )


WKHTMLTOPDF_PATH = _find_wkhtmltopdf()
PDFKIT_CONFIG = pdfkit.configuration(wkhtmltopdf=WKHTMLTOPDF_PATH)


def render_pdf(payload: Dict[str, Any], template_path: str) -> bytes:
    app_dir = Path(__file__).resolve().parents[2]

    templates_dir = app_dir / "templates"
    static_dir = app_dir / "statics"

    env = Environment(
        loader=FileSystemLoader(str(templates_dir)),
        autoescape=select_autoescape(["html", "xml"]),
    )

    template = env.get_template(template_path)

    meta = payload.get("meta", {}) or {}
    module = (meta.get("module") or meta.get("report_type") or meta.get("type") or "").strip().lower()

    cover_map = {
        "operations": "cover_operation.png",
        "sustainability": "cover_sustainability.png",
        "soc": "cover_soc.png",
        "exhibitor": "cover_exhibitor.png",
    }

    cover_filename = cover_map.get(module, "cover_default.png")
    cover = static_dir / cover_filename
    cover_uri = cover.resolve().as_uri()

    html = template.render(
        meta=payload.get("meta", {}),
        sections=payload.get("pdf_sections", []),
        assets={"cover_image": cover_uri}
    )

    options = {
        "enable-local-file-access": "",
        "allow": str(static_dir.resolve()),
    }

    pdf = pdfkit.from_string(
        html,
        output_path=False,
        options=options,
        configuration=PDFKIT_CONFIG,
    )

    if isinstance(pdf, (bytes, bytearray)):
        return bytes(pdf)

    raise RuntimeError(
        f"pdfkit did not return PDF bytes. wkhtmltopdf used: {WKHTMLTOPDF_PATH}"
    )