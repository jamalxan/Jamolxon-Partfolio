from __future__ import annotations

import json
import re
import xml.etree.ElementTree as ET
from html.parser import HTMLParser
from pathlib import Path
from typing import Any

import pytest

from app.render import render_page, render_site
from app.render.site import Assets, legacy_hash_to_path, rewrite_hash_links


class Doc(HTMLParser):
    """Collects what the SEO / link assertions need."""

    def __init__(self, html: str) -> None:
        super().__init__(convert_charrefs=True)
        self.h1 = 0
        self.title = ""
        self.meta: dict[str, str] = {}
        self.links: list[tuple[str, dict[str, str]]] = []  # (href, attrs)
        self.ids: set[str] = set()
        self.canonical: list[str] = []
        self.jsonld: list[str] = []
        self._in: str | None = None
        self.feed(html)

    def handle_starttag(self, tag: str, attrs_list: list[tuple[str, str | None]]) -> None:
        attrs = {k: v or "" for k, v in attrs_list}
        if "id" in attrs:
            self.ids.add(attrs["id"])
        if tag == "h1":
            self.h1 += 1
        elif tag == "title":
            self._in = "title"
        elif tag == "meta":
            key = attrs.get("name") or attrs.get("property")
            if key:
                self.meta[key] = attrs.get("content", "")
        elif tag == "link" and attrs.get("rel") == "canonical":
            self.canonical.append(attrs.get("href", ""))
        elif tag == "a" and "href" in attrs:
            self.links.append((attrs["href"], attrs))
        elif tag == "script" and attrs.get("type") == "application/ld+json":
            self._in = "ld"
            self.jsonld.append("")

    def handle_endtag(self, tag: str) -> None:
        if tag in ("title", "script"):
            self._in = None

    def handle_data(self, data: str) -> None:
        if self._in == "title":
            self.title += data
        elif self._in == "ld":
            self.jsonld[-1] += data


def html_files(out: Path) -> list[Path]:
    return sorted(out.rglob("*.html"))


def parse(f: Path) -> Doc:
    return Doc(f.read_text(encoding="utf-8"))


# ------------------------------------------------------------------ structure
def test_all_pages_exist(site: tuple[Path, list[str]], seed_content: dict[str, Any]) -> None:
    out, paths = site
    assert len(seed_content["PROJECTS"]) == 14 and len(seed_content["SERVICES"]) == 6 and len(seed_content["POSTS"]) == 4
    for p in seed_content["PROJECTS"]:
        assert (out / "loyihalar" / p["slug"] / "index.html").is_file()
    for s in seed_content["SERVICES"]:
        assert (out / "xizmatlar" / s["slug"] / "index.html").is_file()
    for p in seed_content["POSTS"]:
        assert (out / "blog" / p["slug"] / "index.html").is_file()
    for f in ("index.html", "loyihalar/index.html", "blog/index.html", "taklif/index.html", "404.html",
              "sitemap.xml", "robots.txt", "rss.xml"):
        assert (out / f).is_file(), f
    assert len([p for p in paths if p.startswith("/loyihalar/") and p != "/loyihalar/"]) == 14
    assert len([p for p in paths if p.startswith("/xizmatlar/")]) == 6


def test_every_page_seo(site: tuple[Path, list[str]]) -> None:
    out, _ = site
    titles = set()
    for f in html_files(out):
        d = parse(f)
        assert d.h1 == 1, f"{f}: {d.h1} <h1>"
        assert len(d.canonical) == 1 and d.canonical[0].startswith("https://jamolxon.uz/"), f
        assert 0 < len(d.title) <= 60, (f, d.title)
        assert 0 < len(d.meta["description"]) <= 155, (f, d.meta["description"])
        for k in ("og:title", "og:description", "og:url", "og:image", "og:type", "twitter:card", "twitter:title"):
            assert d.meta.get(k), (f, k)
        for block in d.jsonld:
            data = json.loads(block)
            assert "@context" in data
        if f.name != "404.html":
            assert d.jsonld, f"{f}: no JSON-LD"
        titles.add(d.title)
    assert len(titles) == len(html_files(out)), "titles must be unique"


def jsonld_types(f: Path) -> set[str]:
    types: set[str] = set()
    for block in parse(f).jsonld:
        data = json.loads(block)
        for node in data.get("@graph", [data]):
            types.add(node["@type"])
    return types


def test_jsonld_types(site: tuple[Path, list[str]]) -> None:
    out, _ = site
    assert {"Person", "ProfessionalService"} <= jsonld_types(out / "index.html")
    assert {"CreativeWork", "BreadcrumbList"} <= jsonld_types(out / "loyihalar/socialauto/index.html")
    assert {"BlogPosting", "BreadcrumbList"} <= jsonld_types(out / "blog/ai-avval-backend/index.html")
    assert {"Service", "FAQPage", "BreadcrumbList"} <= jsonld_types(out / "xizmatlar/crm-erp/index.html")
    assert "BreadcrumbList" in jsonld_types(out / "loyihalar/index.html")
    assert "BreadcrumbList" in jsonld_types(out / "blog/index.html")


def test_no_hash_route_links(site: tuple[Path, list[str]]) -> None:
    out, _ = site
    for f in html_files(out):
        d = parse(f)
        for href, attrs in d.links:
            if not href.startswith("#"):
                continue
            if href == "#":
                assert "data-mail" in attrs or "data-tel" in attrs, (f, attrs)
                continue
            assert href[1:] in d.ids, f"{f}: hash route link {href}"
        raw = f.read_text(encoding="utf-8")
        assert not re.search(r'href="#(loyiha|xizmat|blog|taklif|s-)', raw), f


def test_post_body_links_rewritten(site: tuple[Path, list[str]]) -> None:
    out, _ = site
    html = (out / "blog/comment-to-dm/index.html").read_text(encoding="utf-8")
    assert 'href="/taklif/" class="link"' in html


def test_sitemap_lists_every_page(site: tuple[Path, list[str]]) -> None:
    out, paths = site
    ns = {"s": "http://www.sitemaps.org/schemas/sitemap/0.9"}
    root = ET.parse(out / "sitemap.xml").getroot()
    locs = {u.find("s:loc", ns).text: u.find("s:lastmod", ns) for u in root.findall("s:url", ns)}  # type: ignore[union-attr]
    pages = [p for p in paths if p.endswith("/")]
    assert len(pages) >= 1 + 1 + 14 + 6 + 1 + 4 + 1
    for p in pages:
        assert "https://jamolxon.uz" + p in locs, p
        assert locs["https://jamolxon.uz" + p] is not None, f"no lastmod for {p}"
    assert "https://jamolxon.uz/404.html" not in locs


def test_robots_and_rss(site: tuple[Path, list[str]]) -> None:
    out, _ = site
    robots = (out / "robots.txt").read_text(encoding="utf-8")
    assert "Disallow: /preview/" in robots and "Disallow: /api/" in robots
    assert "Sitemap: https://jamolxon.uz/sitemap.xml" in robots
    rss = ET.parse(out / "rss.xml").getroot()
    assert len(rss.findall("./channel/item")) == 4


def test_taklif_form_works_without_js(site: tuple[Path, list[str]]) -> None:
    out, _ = site
    html = (out / "taklif/index.html").read_text(encoding="utf-8")
    assert '<form class="form" id="takform" method="post" action="/api/v1/leads"' in html
    for name in ("name", "contact_type", "contact_value", "service", "budget_range", "deadline", "message",
                 "consent", "website", "elapsed_ms"):
        assert f'name="{name}"' in html, name
    assert 'value="boshqa"' in html
    assert "cf-turnstile" not in html  # no site key in seed


def test_turnstile_rendered_with_site_key(content: dict[str, Any]) -> None:
    content["SETTINGS"] = {"turnstile_site_key": "0x4AAAAtest", "seo": {}}
    html = render_page(content, "/taklif/")
    assert 'class="cf-turnstile" data-sitekey="0x4AAAAtest"' in html
    assert "challenges.cloudflare.com/turnstile/v0/api.js" in html


# ------------------------------------------------------------------ build mechanics
def test_atomic_swap_leaves_no_temp_dirs(tmp_path: Path, content: dict[str, Any]) -> None:
    out = tmp_path / "public"
    render_site(content, out)
    (out / "stale.txt").write_text("old build")
    render_site(content, out)
    assert not (out / "stale.txt").exists(), "out_dir must be replaced, not merged"
    assert sorted(p.name for p in tmp_path.iterdir()) == ["public"]


def test_render_is_idempotent(tmp_path: Path, content: dict[str, Any]) -> None:
    a, b = tmp_path / "a", tmp_path / "b"
    pa = render_site(content, a)
    pb = render_site(content, b)
    assert pa == pb
    fa = {p.relative_to(a).as_posix(): p.read_bytes() for p in a.rglob("*") if p.is_file()}
    fb = {p.relative_to(b).as_posix(): p.read_bytes() for p in b.rglob("*") if p.is_file()}
    assert fa == fb


def test_failed_render_keeps_previous_site(tmp_path: Path, content: dict[str, Any]) -> None:
    out = tmp_path / "public"
    render_site(content, out)
    before = (out / "index.html").read_bytes()
    broken = dict(content)
    broken["PROJECTS"] = [{"slug": "x"}]  # missing fields -> template error
    with pytest.raises(KeyError):
        render_site(broken, out)
    assert (out / "index.html").read_bytes() == before
    assert sorted(p.name for p in tmp_path.iterdir()) == ["public"]


def test_escaping(content: dict[str, Any], tmp_path: Path) -> None:
    content["PROJECTS"][0]["title"] = "<script>alert(1)</script>"
    out = tmp_path / "s"
    render_site(content, out)
    slug = content["PROJECTS"][0]["slug"]
    for f in (out / "loyihalar" / slug / "index.html", out / "index.html"):
        html = f.read_text(encoding="utf-8")
        assert "<script>alert(1)</script>" not in html
        assert "&lt;script&gt;alert(1)&lt;/script&gt;" in html
    # JSON-LD stays valid and cannot close the script element
    d = parse(out / "loyihalar" / slug / "index.html")
    assert json.loads(d.jsonld[0])["name"] == "<script>alert(1)</script>"


def test_preview_noindex_and_overrides(content: dict[str, Any]) -> None:
    p = content["PROJECTS"][0]
    p["seo_title"] = "Maxsus SEO sarlavha"
    p["seo_description"] = "Maxsus tavsif"
    p["updated_at"] = "2026-11-01T10:00:00Z"
    html = render_page(content, f"/loyihalar/{p['slug']}/", noindex=True)
    d = Doc(html)
    assert d.meta.get("robots") == "noindex"
    assert d.title == "Maxsus SEO sarlavha"
    assert d.meta["description"] == "Maxsus tavsif"
    assert "noindex" not in render_page(content, "/")


def test_unknown_path_renders_404(content: dict[str, Any]) -> None:
    html = render_page(content, "/yoq-sahifa/")
    assert "Sahifa topilmadi" in html and 'name="robots" content="noindex"' in html


def test_settings_seo_and_lastmod(content: dict[str, Any], tmp_path: Path) -> None:
    content["SETTINGS"] = {"seo": {"title": "Jamolxon — test", "description": "Test tavsif", "og_image": "/og.jpg"}}
    content["PROJECTS"][0]["updated_at"] = "2030-01-02T00:00:00Z"
    out = tmp_path / "s"
    render_site(content, out)
    d = parse(out / "index.html")
    assert d.title == "Jamolxon — test" and d.meta["og:image"] == "https://jamolxon.uz/og.jpg"
    sm = (out / "sitemap.xml").read_text(encoding="utf-8")
    assert f"/loyihalar/{content['PROJECTS'][0]['slug']}/</loc><lastmod>2030-01-02</lastmod>" in sm


def test_blog_pagination(content: dict[str, Any], tmp_path: Path) -> None:
    base = content["POSTS"][0]
    content["POSTS"] = [dict(base, slug=f"post-{i}", title=f"Post {i}") for i in range(30)]
    out = tmp_path / "s"
    paths = render_site(content, out)
    assert "/blog/sahifa/2/" in paths and "/blog/sahifa/3/" in paths
    d = parse(out / "blog/sahifa/2/index.html")
    assert d.h1 == 1 and d.canonical == ["https://jamolxon.uz/blog/sahifa/2/"]
    assert any(h == "/blog/sahifa/3/" for h, _ in d.links)


def test_facts_computed_from_projects(site: tuple[Path, list[str]]) -> None:
    out, _ = site
    html = (out / "index.html").read_text(encoding="utf-8")
    assert '<b data-count="14" data-suffix="">14</b>' in html


def test_legacy_mapping() -> None:
    assert legacy_hash_to_path("loyiha-x") == "/loyihalar/x/"
    assert legacy_hash_to_path("xizmat-y") == "/xizmatlar/y/"
    assert legacy_hash_to_path("blog") == "/blog/"
    assert legacy_hash_to_path("blog-z") == "/blog/z/"
    assert legacy_hash_to_path("loyihalar") == "/loyihalar/"
    assert legacy_hash_to_path("taklif") == "/taklif/"
    assert legacy_hash_to_path("s-xizmatlar") == "/#xizmatlar"
    assert legacy_hash_to_path("cat-prod") is None
    assert rewrite_hash_links('<a href="#taklif">x</a><a href="#cat-1">y</a>') == '<a href="/taklif/">x</a><a href="#cat-1">y</a>'


def test_assets_from_vite_manifest(tmp_path: Path, content: dict[str, Any]) -> None:
    dist = tmp_path / "dist"
    (dist / ".vite").mkdir(parents=True)
    (dist / "assets").mkdir()
    for f in ("app.abc.js", "vendor.def.js", "style.123.css", "unbounded-latin.f00.woff2"):
        (dist / "assets" / f).write_text("x")
    manifest = {
        "assets/js/main.js": {"file": "assets/app.abc.js", "isEntry": True, "imports": ["_vendor.def.js"]},
        "_vendor.def.js": {"file": "assets/vendor.def.js"},
        "assets/css/index.css": {"file": "assets/style.123.css", "isEntry": True},
        "assets/fonts/unbounded-latin.woff2": {"file": "assets/unbounded-latin.f00.woff2"},
    }
    (dist / ".vite" / "manifest.json").write_text(json.dumps(manifest))
    a = Assets.from_dist(dist)
    assert a.js == "/assets/app.abc.js" and a.css == ["/assets/style.123.css"]
    assert a.modulepreload == ["/assets/vendor.def.js"] and a.preload_fonts == ["/assets/unbounded-latin.f00.woff2"]
    out = tmp_path / "site"
    render_site(content, out, assets_dir=dist)
    assert (out / "assets/app.abc.js").is_file() and not (out / ".vite").exists()
    html = (out / "index.html").read_text(encoding="utf-8")
    assert '<script type="module" src="/assets/app.abc.js"></script>' in html
    assert '<link rel="stylesheet" href="/assets/style.123.css">' in html
    assert "fonts.googleapis.com" not in html
