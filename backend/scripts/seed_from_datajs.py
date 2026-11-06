"""Seed the database from the legacy frontend data.js (TZ 3).

Reads backend/seed/content.json (regenerate it with `node scripts/export_datajs.mjs`; this script runs node
itself when --refresh is given and node is available). Idempotent: existing slugs are updated, not duplicated.

Usage: uv run python -m scripts.seed_from_datajs [--refresh] [--file path]
"""

import argparse
import asyncio
import json
import shutil
import subprocess
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import dispose_engine, get_sessionmaker
from app.models import Category, Offer, Post, ProcessStep, Project, Service, Setting, Tag
from app.services.markdown import plain_text, sanitize_html, sections_to_html

ROOT = Path(__file__).resolve().parents[2]
DEFAULT_FILE = ROOT / "backend" / "seed" / "content.json"


def slugify_tag(title: str) -> str:
    import re
    import unicodedata

    t = unicodedata.normalize("NFKD", title).encode("ascii", "ignore").decode().lower()
    return re.sub(r"[^a-z0-9]+", "-", t).strip("-") or "teg"


def legacy_links_to_paths(html: str) -> str:
    """Hash routes inside post bodies -> clean URLs (TZ 5)."""
    import re

    def repl(m: re.Match[str]) -> str:
        h = m.group(1)
        if h == "taklif":
            return 'href="/taklif/"'
        if h in ("loyihalar", "blog"):
            return f'href="/{h}/"'
        for prefix, base in (("loyiha-", "/loyihalar/"), ("xizmat-", "/xizmatlar/"), ("blog-", "/blog/")):
            if h.startswith(prefix):
                return f'href="{base}{h[len(prefix):]}/"'
        if h.startswith("s-"):
            return f'href="/#{h[2:]}"'
        return m.group(0)

    return re.sub(r'href="#([a-z0-9-]+)"', repl, html)


async def upsert(session: AsyncSession, model: Any, key: str, value: Any, fields: dict[str, Any]) -> Any:
    obj = await session.scalar(select(model).where(getattr(model, key) == value))
    if obj is None:
        obj = model(**{key: value})
        session.add(obj)
    for k, v in fields.items():
        setattr(obj, k, v)
    return obj


async def seed(data: dict[str, Any]) -> dict[str, int]:
    now = datetime.now(UTC)
    async with get_sessionmaker()() as session:
        cats: dict[str, Category] = {}
        for i, (slug, c) in enumerate(data["CATS"].items()):
            cats[slug] = await upsert(session, Category, "slug", slug, {
                "title": c["label"], "short": c.get("short", ""), "badge": c.get("badge", ""),
                "dot": c.get("dot", ""), "description": c.get("desc", ""), "sort_order": i})
        await session.flush()

        for i, p in enumerate(data["PROJECTS"]):
            await upsert(session, Project, "slug", p["slug"], {
                "title": p["title"], "subtitle": p.get("tagline", ""), "category_id": cats[p["cat"]].id,
                "url": p.get("url") or "", "year": str(p.get("year") or ""), "role": p.get("role", ""),
                "stack": p.get("stack", []), "summary": p.get("summary", ""), "sections": p.get("sections", []),
                "body_html": sections_to_html(p.get("sections", [])), "results": p.get("results", []),
                "links": p.get("links", []), "illo": p.get("illo") or "dashboard", "image": p.get("image"),
                "status": "published", "published_at": now, "sort_order": i + 1})

        for i, s in enumerate(data["SERVICES"]):
            await upsert(session, Service, "slug", s["slug"], {
                "title": s["title"], "icon": s.get("icon", ""), "illo": s.get("illo", ""), "short": s.get("short", ""),
                "who": s.get("who", []), "includes": s.get("includes", []), "process": s.get("process", []),
                "examples": s.get("examples", []), "stack": s.get("stack", []), "timeline": s.get("timeline", ""),
                "faq": s.get("faq", []), "status": "published", "published_at": now, "sort_order": i + 1})

        tags: dict[str, Tag] = {}
        for i, p in enumerate(data["POSTS"]):
            for title in p.get("tags", []):
                slug = slugify_tag(title)
                if slug not in tags:
                    tags[slug] = await upsert(session, Tag, "slug", slug, {"title": title})
            body = sanitize_html(legacy_links_to_paths(p["body"]))
            read = int(str(p.get("read", "1")).split()[0]) if str(p.get("read", "")).split() else 1
            post = await upsert(session, Post, "slug", p["slug"], {
                "title": p["title"], "excerpt": p.get("excerpt", ""), "body_md": body, "body_html": body,
                "reading_min": read, "status": "published", "sort_order": i + 1,
                "published_at": datetime.fromisoformat(p["date"]).replace(tzinfo=UTC)})
            await session.flush()
            await session.refresh(post, ["tags"])
            post.tags = [tags[slugify_tag(t)] for t in p.get("tags", [])]
            from sqlalchemy import func

            post.search_vector = func.to_tsvector("simple", f"{p['title']} {p.get('excerpt', '')} {plain_text(body)}")

        for i, o in enumerate(data["OFFERS"]):
            await upsert(session, Offer, "key", o["key"], {
                "title": o["title"], "icon": o.get("icon", ""), "problem": o.get("problem", ""),
                "solution": o.get("solution", ""), "examples": o.get("example", []), "sort_order": i + 1})

        for i, st in enumerate(data["STEPS"]):
            await upsert(session, ProcessStep, "title", st["h"], {"text": st.get("d", ""), "get": st.get("get", ""),
                                                                    "sort_order": i + 1})

        await upsert(session, Setting, "key", "contact", {"value": data["CONTACT"]})
        await session.commit()
    return {"categories": len(data["CATS"]), "projects": len(data["PROJECTS"]), "services": len(data["SERVICES"]),
            "posts": len(data["POSTS"]), "offers": len(data["OFFERS"]), "steps": len(data["STEPS"])}


def load(path: Path, refresh: bool) -> dict[str, Any]:
    if refresh:
        node = shutil.which("node")
        if not node:
            raise SystemExit("node topilmadi: --refresh uchun Node.js kerak")
        subprocess.run([node, str(ROOT / "scripts" / "export_datajs.mjs"), str(path)], check=True)  # noqa: S603 - fixed argv, no shell
    data: dict[str, Any] = json.loads(path.read_text(encoding="utf-8"))
    return data


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--file", type=Path, default=DEFAULT_FILE)
    ap.add_argument("--refresh", action="store_true")
    args = ap.parse_args()
    counts = await seed(load(args.file, args.refresh))
    await dispose_engine()
    print("seeded:", ", ".join(f"{k}={v}" for k, v in counts.items()))


if __name__ == "__main__":
    asyncio.run(main())
