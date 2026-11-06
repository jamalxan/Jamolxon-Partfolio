"""CLI: ``python -m app.render OUT_DIR [--content seed/content.json] [--assets ../frontend/dist]``."""

from __future__ import annotations

import argparse
import json
from pathlib import Path

from .site import render_site

BACKEND = Path(__file__).resolve().parents[2]


def main() -> None:
    ap = argparse.ArgumentParser(prog="python -m app.render", description="Render the static site")
    ap.add_argument("out", type=Path, help="output directory (replaced atomically)")
    ap.add_argument("--content", type=Path, default=BACKEND / "seed" / "content.json")
    ap.add_argument("--assets", type=Path, default=None, help="Vite dist/ directory (omit for dev assets)")
    ap.add_argument("--site-url", default="https://jamolxon.uz")
    a = ap.parse_args()
    content = json.loads(a.content.read_text(encoding="utf-8"))
    paths = render_site(content, a.out, site_url=a.site_url, assets_dir=a.assets)
    print(f"{len(paths)} files -> {a.out.resolve()}")


if __name__ == "__main__":
    main()
