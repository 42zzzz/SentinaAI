from __future__ import annotations

from pathlib import Path
from typing import Any, Dict
from jinja2 import Environment, FileSystemLoader, select_autoescape
import pdfkit



def _find_wkhtmltopdf() -> str:
    candidates = [
        "/usr/local/bin/wkhtmltopdf",     # Intel Homebrew
    ]
    for p in candidates:
        if Path(p).exists():
            return p
    return "wkhtmltopdf"

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

    # Pick cover image based on report/module
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
        # IMPORTANT: wkhtmltopdf needs this to load local images
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