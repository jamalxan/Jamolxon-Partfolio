"""Public API + admin CRUD (TZ 4) + slug redirects, optimistic lock, sanitizing, media (TZ 8)."""

import io
import json
from pathlib import Path
from typing import Any

import pytest
from httpx import AsyncClient
from PIL import Image

from app.core.config import get_settings
from app.models import User
from tests.conftest import csrf, jobs

BACKEND = Path(__file__).resolve().parents[1]


async def test_health_ready_request_id(client: AsyncClient) -> None:
    r = await client.get("/api/v1/health")
    assert r.json() == {"status": "ok"} and len(r.headers["x-request-id"]) >= 8
    r = await client.get("/api/v1/ready")
    assert r.json() == {"status": "ok", "checks": {"db": "ok", "redis": "ok"}}


async def test_openapi_hidden_in_production(monkeypatch: pytest.MonkeyPatch) -> None:
    from app.main import create_app

    monkeypatch.setattr(get_settings(), "env", "production")
    prod = create_app()
    assert prod.openapi_url is None and prod.docs_url is None


async def test_public_lists_seed_content(client: AsyncClient, seeded: None) -> None:
    r = await client.get("/api/v1/projects?limit=50")
    body = r.json()
    assert body["total"] == 14 and len(body["items"]) == 14
    assert r.headers["cache-control"] == "public, max-age=60, stale-while-revalidate=600"
    etag = r.headers["etag"]
    assert (await client.get("/api/v1/projects?limit=50", headers={"If-None-Match": etag})).status_code == 304
    assert (await client.get("/api/v1/projects?limit=51")).status_code == 422  # limit max 50
    assert (await client.get("/api/v1/projects?category=prod&limit=50")).json()["total"] >= 1
    assert len((await client.get("/api/v1/services")).json()["items"]) == 6
    posts = (await client.get("/api/v1/posts")).json()
    assert posts["total"] == 4 and "body" not in posts["items"][0]
    site = (await client.get("/api/v1/site")).json()
    assert site["facts"][0]["n"] == 14 and site["contact"]["tg"] == "jamalxon"


async def test_post_search_and_tag_filter(client: AsyncClient, seeded: None) -> None:
    r = (await client.get("/api/v1/posts?q=webhook")).json()
    assert r["total"] >= 1 and any(p["slug"] == "comment-to-dm" for p in r["items"])
    assert (await client.get("/api/v1/posts?tag=xavfsizlik")).json()["total"] == 1


async def test_404_problem_details(client: AsyncClient) -> None:
    r = await client.get("/api/v1/projects/yoq")
    assert r.status_code == 404
    assert r.headers["content-type"].startswith("application/problem+json")
    assert r.json()["type"] == "not_found"


def project_body(**kw: Any) -> dict[str, Any]:
    return {"slug": "yangi-loyiha", "title": "Yangi loyiha", "category": "prod", "summary": "Qisqa",
            "sections": [{"h": "Muammo", "p": ["Matn"]}], "stack": ["FastAPI"], "results": ["Natija"],
            "links": [{"label": "sayt", "url": "https://example.uz"}], **kw}


async def test_project_lifecycle(client: AsyncClient, owner: User, seeded: None) -> None:
    h = csrf(client)
    r = await client.post("/api/v1/admin/projects", json=project_body(), headers=h)
    assert r.status_code == 201, r.text
    p = r.json()
    assert p["status"] == "draft"
    assert (await client.get("/api/v1/projects/yangi-loyiha")).status_code == 404  # drafts are not public
    r = await client.post(f"/api/v1/admin/projects/{p['id']}/publish", json={"status": "published"}, headers=h)
    assert r.json()["status"] == "published" and r.json()["published_at"]
    from app.api.v1.public.routes import invalidate_public_cache

    await invalidate_public_cache()
    assert (await client.get("/api/v1/projects/yangi-loyiha")).status_code == 200
    assert (await client.get("/api/v1/site")).json()["facts"][0]["n"] == 15  # stats follow projects
    assert jobs("rebuild_site")


async def test_slug_change_creates_301_redirect(client: AsyncClient, owner: User, seeded: None) -> None:
    h = csrf(client)
    p = (await client.post("/api/v1/admin/projects", json=project_body(), headers=h)).json()
    r = await client.patch(f"/api/v1/admin/projects/{p['id']}", headers=h,
                           json={"slug": "yangi-nom", "updated_at": p["updated_at"]})
    assert r.status_code == 200, r.text
    p2 = r.json()
    r = await client.patch(f"/api/v1/admin/projects/{p['id']}", headers=h,
                           json={"slug": "uchinchi-nom", "updated_at": p2["updated_at"]})
    redirects = (await client.get("/api/v1/admin/redirects")).json()["items"]
    pairs = {(x["from_path"], x["to_path"], x["code"]) for x in redirects}
    assert ("/loyihalar/yangi-loyiha/", "/loyihalar/uchinchi-nom/", 301) in pairs  # chain collapsed
    assert ("/loyihalar/yangi-nom/", "/loyihalar/uchinchi-nom/", 301) in pairs
    r = await client.get("/api/v1/resolve?path=/loyihalar/yangi-loyiha")
    assert r.status_code == 301 and r.headers["location"] == "/loyihalar/uchinchi-nom/"
    assert (await client.get("/api/v1/resolve?path=/yoq/")).status_code == 404


async def test_optimistic_lock_conflict(client: AsyncClient, owner: User, seeded: None) -> None:
    h = csrf(client)
    p = (await client.post("/api/v1/admin/projects", json=project_body(), headers=h)).json()
    ok = await client.patch(f"/api/v1/admin/projects/{p['id']}", headers=h,
                            json={"title": "Birinchi", "updated_at": p["updated_at"]})
    assert ok.status_code == 200
    stale = await client.patch(f"/api/v1/admin/projects/{p['id']}", headers=h,
                               json={"title": "Ikkinchi", "updated_at": p["updated_at"]})
    assert stale.status_code == 409 and stale.json()["title"] == "Bu yozuv o'zgargan, yangilang"


async def test_validation_and_unique_slug(client: AsyncClient, owner: User, seeded: None) -> None:
    h = csrf(client)
    r = await client.post("/api/v1/admin/projects", json=project_body(slug="Yomon Slug"), headers=h)
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "slug"
    r = await client.post("/api/v1/admin/projects", json=project_body(slug="socialauto"), headers=h)
    assert r.status_code == 422 and r.json()["errors"][0] == {"field": "slug", "msg": "Bu qiymat band"}
    r = await client.post("/api/v1/admin/projects", json=project_body(category="yoq"), headers=h)
    assert r.json()["errors"][0]["field"] == "category"
    r = await client.post("/api/v1/admin/projects", json=project_body(links=[{"label": "x", "url": "javascript:alert(1)"}]),
                          headers=h)
    assert r.status_code == 422


async def test_post_markdown_is_sanitized(client: AsyncClient, owner: User, seeded: None) -> None:
    h = csrf(client)
    md = "## Sarlavha\n\nMatn <script>alert(1)</script> <img src=x onerror=alert(1)> " \
         "<iframe src='https://evil'></iframe> [ok](https://jamolxon.uz) [bad](javascript:alert(1))"
    r = await client.post("/api/v1/admin/posts", headers=h,
                          json={"slug": "test-post", "title": "Test", "body_md": md, "tags": ["AI", "Yangi teg"]})
    assert r.status_code == 201, r.text
    html = r.json()["body_html"]
    assert "<h2>Sarlavha</h2>" in html and 'href="https://jamolxon.uz"' in html
    for bad in ("<script", "onerror", "<iframe", 'href="javascript:'):
        assert bad not in html
    assert r.json()["tags"] == ["AI", "Yangi teg"] and r.json()["reading_min"] == 1


async def test_soft_delete_and_reorder(client: AsyncClient, owner: User, seeded: None) -> None:
    h = csrf(client)
    items = (await client.get("/api/v1/admin/services?limit=50")).json()["items"]
    ids = [x["id"] for x in reversed(items)]
    assert (await client.post("/api/v1/admin/services/reorder", json={"ids": ids}, headers=h)).status_code == 204
    again = (await client.get("/api/v1/admin/services?limit=50")).json()["items"]
    assert [x["id"] for x in again] == ids
    assert (await client.delete(f"/api/v1/admin/services/{ids[0]}", headers=h)).status_code == 204
    assert (await client.get("/api/v1/admin/services?limit=50")).json()["total"] == 5


async def test_preview_token_renders_draft_noindex(client: AsyncClient, owner: User, seeded: None,
                                                   monkeypatch: pytest.MonkeyPatch) -> None:
    h = csrf(client)
    p = (await client.post("/api/v1/admin/projects", json=project_body(), headers=h)).json()
    url = (await client.post(f"/api/v1/admin/projects/{p['id']}/preview", headers=h)).json()["url"]
    assert url.startswith("https://jamolxon.test/preview/")
    token = url.rsplit("/", 1)[1]
    captured: dict[str, Any] = {}

    def fake_render_page(content: dict[str, Any], path: str, **kw: Any) -> str:
        captured.update(path=path, noindex=kw["noindex"], slugs=[x["slug"] for x in content["PROJECTS"]])
        return "<html>preview</html>"

    import app.render as render

    monkeypatch.setattr(render, "render_page", fake_render_page, raising=False)
    r = await client.get(f"/api/v1/preview/{token}")
    assert r.status_code == 200 and r.headers["x-robots-tag"] == "noindex, nofollow"
    assert captured["path"] == "/loyihalar/yangi-loyiha/" and captured["noindex"] is True
    assert "yangi-loyiha" in captured["slugs"]
    assert (await client.get("/api/v1/preview/notogri-token")).status_code == 404


def png(size: tuple[int, int] = (1200, 800), exif: bool = False) -> bytes:
    img = Image.new("RGB", size, (37, 1, 4))
    buf = io.BytesIO()
    if exif:
        ex = Image.Exif()
        ex[0x8825] = {2: (41.0, 18.0, 0.0)}  # GPS
        img.save(buf, "JPEG", exif=ex)
    else:
        img.save(buf, "PNG")
    return buf.getvalue()


async def test_media_upload_rules(client: AsyncClient, owner: User, tmp_path: Path,
                                  monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr(get_settings(), "media_dir", tmp_path)
    h = csrf(client)
    r = await client.post("/api/v1/admin/media", headers=h, data={"alt": " "},
                          files={"file": ("a.png", png(), "image/png")})
    assert r.status_code == 422 and r.json()["errors"][0]["field"] == "alt"
    svg = b'<?xml version="1.0"?><svg xmlns="http://www.w3.org/2000/svg"><script>alert(1)</script></svg>'
    r = await client.post("/api/v1/admin/media", headers=h, data={"alt": "logo"},
                          files={"file": ("logo.png", svg, "image/png")})  # lying content-type
    assert r.status_code == 415
    r = await client.post("/api/v1/admin/media", headers=h, data={"alt": "katta"},
                          files={"file": ("x.pdf", b"%PDF-" + b"0" * (10 * 1024 * 1024), "application/pdf")})
    assert r.status_code == 413
    r = await client.post("/api/v1/admin/media", headers=h, data={"alt": "Rasm"},
                          files={"file": ("../../etc/passwd.jpg", png(exif=True), "image/jpeg")})
    assert r.status_code == 201, r.text
    m = r.json()
    key = m["url"].rsplit("/", 1)[1]
    assert ".." not in key and "passwd" not in key and m["width"] == 1200
    assert set(m["variants"]["webp"]) == {"480", "960"}
    with Image.open(tmp_path / key) as stored:
        assert not stored.getexif().get_ifd(0x8825)  # GPS stripped
    p = (await client.post("/api/v1/admin/projects", json={"slug": "rasmli", "title": "R", "cover_id": m["id"]},
                           headers=h)).json()
    assert (await client.delete(f"/api/v1/admin/media/{m['id']}", headers=h)).status_code == 409  # in use
    await client.delete(f"/api/v1/admin/projects/{p['id']}", headers=h)
    assert (await client.delete(f"/api/v1/admin/media/{m['id']}", headers=h)).status_code == 204


async def test_settings_users_audit(client: AsyncClient, owner: User) -> None:
    h = csrf(client)
    r = await client.put("/api/v1/admin/settings", headers=h, json={"telegram": {"chat_id": "123"}})
    assert r.json()["telegram"] == {"chat_id": "123"}
    r = await client.post("/api/v1/admin/users", headers=h,
                          json={"email": "yordamchi@jamolxon.uz", "role": "editor", "password": "qisqa"})
    assert r.json()["errors"][0]["field"] == "password"
    r = await client.post("/api/v1/admin/users", headers=h,
                          json={"email": "yordamchi@jamolxon.uz", "role": "editor", "password": "uzun-xavfsiz-parol-1"})
    assert r.status_code == 201 and r.json()["totp_enabled"] is False
    r = await client.patch(f"/api/v1/admin/users/{owner.id}", headers=h, json={"role": "editor"})
    assert r.status_code == 422  # cannot demote yourself
    logs = (await client.get("/api/v1/admin/audit-logs")).json()["items"]
    assert {"settings", "user"} <= {x["entity"] for x in logs}
    assert all("password" not in json.dumps(x["diff"]) for x in logs)


async def test_dashboard(client: AsyncClient, owner: User, seeded: None) -> None:
    d = (await client.get("/api/v1/admin/dashboard")).json()
    assert set(d) == {"leads", "new_leads", "recent_publications", "system"}
    assert d["leads"] == {"today": 0, "week": 0, "month": 0}


async def test_seed_round_trip_matches_datajs(seeded: None) -> None:
    """DB content rebuilt for the generator equals the original data.js (visual parity depends on it)."""
    from app.core.db import get_sessionmaker
    from app.services.content import build_site_content

    original = json.loads((BACKEND / "seed" / "content.json").read_text(encoding="utf-8"))
    async with get_sessionmaker()() as s:
        built = await build_site_content(s)
    assert built["CATS"] == original["CATS"]
    assert [p["slug"] for p in built["PROJECTS"]] == [p["slug"] for p in original["PROJECTS"]]
    for b, o in zip(built["PROJECTS"], original["PROJECTS"], strict=True):
        for k in ("title", "tagline", "summary", "sections", "results", "links", "stack", "role", "illo", "cat"):
            assert b[k] == o[k], (o["slug"], k)
    for b, o in zip(built["SERVICES"], original["SERVICES"], strict=True):
        for k in ("title", "short", "who", "includes", "process", "examples", "faq", "timeline"):
            assert b[k] == o[k], (o["slug"], k)
    assert [p["slug"] for p in built["POSTS"]] == [p["slug"] for p in original["POSTS"]]
    assert built["POSTS"][0]["read"] == original["POSTS"][0]["read"]
    assert built["OFFERS"] == [{**o} for o in original["OFFERS"]]
    assert built["STEPS"] == original["STEPS"]
    assert built["CONTACT"] == original["CONTACT"]
    assert 'href="#taklif"' not in json.dumps(built["POSTS"])  # hash links migrated to clean URLs
