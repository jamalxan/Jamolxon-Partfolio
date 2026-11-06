
"""Port of frontend/assets/js/illustrations.js (IL.draw) — SVG "product shots".

Output is byte-for-byte what the JS produced (numbers are formatted the way JS
prints them), except the ``portfolio`` kind, whose random dots use a seeded RNG so
that rendering is deterministic (idempotent builds).
"""

from __future__ import annotations

import math
import random
from collections.abc import Callable

M, R, Y, C, M2 = "#250104", "#D71A06", "#CDF73D", "#FFF1DC", "#3a0509"

PAL: dict[str, dict[str, str]] = {
    "red": {"bg": R, "win": M, "win2": M2, "a": Y, "b": C, "txt": C},
    "maroon": {"bg": M, "win": M2, "win2": "#4a070c", "a": Y, "b": R, "txt": C},
    "yellow": {"bg": Y, "win": M, "win2": M2, "a": R, "b": C, "txt": C},
    "cream": {"bg": C, "win": M, "win2": M2, "a": R, "b": Y, "txt": C},
}
THEMES = list(PAL)


def n(x: float) -> str:
    """Format a number like JavaScript's String(number)."""
    if isinstance(x, bool):
        return "true" if x else "false"
    if isinstance(x, int):
        return str(x)
    if x.is_integer():
        return str(int(x))
    r = repr(x)
    if r.startswith("0."):
        return r
    if r.startswith("-0."):
        return r
    return r


def _open(p: dict[str, str]) -> str:
    return (
        '<svg viewBox="0 0 640 400" xmlns="http://www.w3.org/2000/svg" role="img" aria-hidden="true">'
        f'<rect width="640" height="400" fill="{p["bg"]}"/>'
    )


def _close() -> str:
    return "</svg>"


def win(p: dict[str, str], x: float, y: float, w: float, h: float, r: float = 18) -> str:
    return (
        f'<g><rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}" rx="{n(r)}" fill="{p["win"]}"/>'
        f'<rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="34" rx="{n(r)}" fill="{p["win2"]}"/>'
        f'<rect x="{n(x)}" y="{n(y + 18)}" width="{n(w)}" height="16" fill="{p["win2"]}"/>'
        f'<circle cx="{n(x + 20)}" cy="{n(y + 17)}" r="5" fill="{p["a"]}"/>'
        f'<circle cx="{n(x + 36)}" cy="{n(y + 17)}" r="5" fill="{p["b"]}" opacity=".8"/>'
        f'<circle cx="{n(x + 52)}" cy="{n(y + 17)}" r="5" fill="{p["txt"]}" opacity=".35"/>'
        f'<rect x="{n(x + w / 2 - 70)}" y="{n(y + 10)}" width="140" height="14" rx="7" fill="{p["txt"]}" opacity=".12"/></g>'
    )


def phone(p: dict[str, str], x: float, y: float, w: float, h: float) -> str:
    return (
        f'<g><rect x="{n(x)}" y="{n(y)}" width="{n(w)}" height="{n(h)}" rx="34" fill="{p["win"]}"/>'
        f'<rect x="{n(x + 8)}" y="{n(y + 8)}" width="{n(w - 16)}" height="{n(h - 16)}" rx="28" fill="{p["win2"]}"/>'
        f'<rect x="{n(x + w / 2 - 34)}" y="{n(y + 16)}" width="68" height="10" rx="5" fill="{p["win"]}"/></g>'
    )


def lines(
    p: dict[str, str], x: float, y: float, ws: list[float], gap: float = 12, h: float = 8, op: float = 0.35
) -> str:
    return "".join(
        f'<rect x="{n(x)}" y="{n(y + i * gap)}" width="{n(w)}" height="{n(h)}" rx="4" fill="{p["txt"]}" opacity="{n(op)}"/>'
        for i, w in enumerate(ws)
    )


def blob(p: dict[str, str], cx: float, cy: float, r: float, fill: str, op: float = 1) -> str:
    return f'<circle cx="{n(cx)}" cy="{n(cy)}" r="{n(r)}" fill="{fill}" opacity="{n(op)}"/>'


def sticker(p: dict[str, str], x: float, y: float, txt: str, fill: str, col: str, rot: float = -6) -> str:
    L = len(txt)
    return (
        f'<g transform="rotate({n(rot)} {n(x)} {n(y)})"><rect x="{n(x - 10)}" y="{n(y - 18)}" width="{n(L * 11 + 22)}" height="34" rx="17" fill="{fill}"/>'
        f'<text x="{n(x + L * 5.5 + 1)}" y="{n(y + 5)}" text-anchor="middle" font-family="Unbounded,Inter,sans-serif" font-weight="700" font-size="14" fill="{col}">{txt}</text></g>'
    )


def dashboard(p: dict[str, str]) -> str:
    s = win(p, 60, 50, 520, 320)
    s += f'<rect x="60" y="84" width="110" height="286" fill="{p["win2"]}" opacity=".6"/>' + lines(
        p, 78, 110, [70, 54, 64, 48, 60], 22, 9, 0.3
    )
    s += f'<rect x="78" y="100" width="74" height="12" rx="6" fill="{p["a"]}"/>'
    for i, (x, y) in enumerate([(190, 100), (316, 100), (442, 100)]):
        s += (
            f'<rect x="{x}" y="{y}" width="112" height="64" rx="12" fill="{p["win2"]}"/>'
            f'<rect x="{x + 12}" y="{y + 12}" width="44" height="7" rx="3" fill="{p["txt"]}" opacity=".35"/>'
            f'<rect x="{x + 12}" y="{y + 30}" width="{[70, 52, 80][i]}" height="16" rx="4" fill="{[p["a"], p["b"], p["a"]][i]}"/>'
        )
    s += f'<rect x="190" y="180" width="364" height="170" rx="14" fill="{p["win2"]}"/>'
    bars = [40, 70, 55, 95, 80, 120, 100, 135, 110, 150]
    for i, h in enumerate(bars):
        s += (
            f'<rect class="il-bar" style="animation-delay:{n(i * 0.12)}s" x="{210 + i * 34}" y="{330 - h}" width="20" '
            f'height="{h}" rx="6" fill="{p["b"] if i % 3 == 2 else p["a"]}" opacity="{"0.9" if i % 3 == 2 else "1"}"/>'
        )
    pts = " ".join(f"{n(220 + i * 34)},{n(310 - h * 0.7)}" for i, h in enumerate(bars))
    s += f'<polyline points="{pts}" fill="none" stroke="{p["txt"]}" stroke-width="3" opacity=".55" stroke-linecap="round" stroke-linejoin="round"/>'
    s += sticker(p, 470, 70, "Live", p["a"], M, 6)
    return _open(p) + s + _close()


def chat(p: dict[str, str]) -> str:
    s = blob(p, 520, 90, 90, p["a"], 0.9) + blob(p, 110, 330, 60, p["b"], 0.8)
    s += phone(p, 220, 30, 200, 360)
    msgs = [(1, 120), (0, 150), (1, 90), (0, 130), (1, 150)]
    y = 66
    for i, (me, w) in enumerate(msgs):
        x = 408 - w - 0 if me else 236
        inner = (
            f'<rect x="{x + 12}" y="{y + 13}" width="{w - 24}" height="8" rx="4" fill="{M}" opacity=".7"/>'
            if me
            else f'<rect x="{x + 12}" y="{y + 13}" width="{w - 24}" height="8" rx="4" fill="{p["txt"]}" opacity=".5"/>'
        )
        s += (
            f'<g class="il-float" style="animation-delay:{n(i * 0.4)}s"><rect x="{x}" y="{y}" width="{w}" height="34" rx="14" '
            f'fill="{p["a"] if me else p["txt"]}" opacity="{"1" if me else "0.22"}"/>{inner}</g>'
        )
        y += 46
    s += (
        f'<rect x="236" y="330" width="140" height="36" rx="18" fill="{p["txt"]}" opacity=".12"/>'
        f'<circle cx="392" cy="348" r="18" fill="{p["b"]}"/><path d="M386 348l10-6-2 6 2 6z" fill="{M}"/>'
    )
    s += sticker(p, 60, 70, "aiogram", p["a"], M, -8) + sticker(p, 470, 320, "24/7", p["b"], C, 6)
    return _open(p) + s + _close()


def cards(p: dict[str, str]) -> str:
    s = ""
    cs = [(80, 110, -8, p["b"]), (200, 80, -3, p["txt"]), (330, 60, 3, p["a"]), (460, 90, 8, p["b"])]
    for i, (x, y, r, f) in enumerate(cs):
        s += (
            f'<g class="il-float" style="animation-delay:{n(i * 0.5)}s" transform="rotate({r} {x + 70} {y + 120})">'
            f'<rect x="{x}" y="{y}" width="140" height="240" rx="20" fill="{f}" opacity="{"0.9" if f == p["txt"] else "1"}"/>'
            f'<rect x="{x + 20}" y="{y + 28}" width="60" height="12" rx="6" fill="{M}" opacity=".6"/>'
            f'<rect x="{x + 20}" y="{y + 60}" width="100" height="26" rx="8" fill="{M}" opacity=".85"/>'
            f'<rect x="{x + 20}" y="{y + 100}" width="88" height="8" rx="4" fill="{M}" opacity=".35"/>'
            f'<rect x="{x + 20}" y="{y + 116}" width="70" height="8" rx="4" fill="{M}" opacity=".35"/>'
            f'<circle cx="{x + 40}" cy="{y + 200}" r="14" fill="{M}" opacity=".9"/>'
            f'<path d="M{x + 33} {y + 200}l5 5 9-10" stroke="{p["a"] if f == p["a"] else C}" stroke-width="3" fill="none" stroke-linecap="round"/></g>'
        )
    s += sticker(p, 60, 50, "14 rejim", p["a"], M, -6) + sticker(p, 470, 350, "AI chat", M, C, 5)
    return _open(p) + s + _close()


def exam(p: dict[str, str]) -> str:
    s = f'<rect x="90" y="40" width="300" height="340" rx="16" fill="{p["txt"]}"/>' + lines(
        {"txt": M}, 120, 80, [200, 240, 180, 230, 210, 160, 220, 190, 240, 170], 20, 8, 0.25
    )
    s += f'<rect x="120" y="300" width="180" height="40" rx="10" fill="{p["a"]}" opacity=".9"/>'
    s += (
        f'<g class="il-float"><rect x="360" y="110" width="220" height="210" rx="18" fill="{p["win"]}"/>'
        f'<text x="470" y="180" text-anchor="middle" font-family="Unbounded,Inter,sans-serif" font-weight="900" font-size="64" fill="{p["a"]}">7.5</text>'
        f'<rect x="390" y="200" width="160" height="8" rx="4" fill="{p["txt"]}" opacity=".25"/>'
    )
    hs = [60, 50, 70, 45]
    for i in range(4):
        s += (
            f'<rect x="{390 + i * 40}" y="225" width="30" height="{hs[i]}" rx="6" fill="{p["b"] if i == 2 else p["a"]}" '
            f'class="il-bar" style="animation-delay:{n(i * 0.2)}s" transform="translate(0 {70 - hs[i]})"/>'
        )
    s += "</g>" + sticker(p, 60, 360, "IELTS Writing", p["b"], C, -4)
    return _open(p) + s + _close()


def site(p: dict[str, str]) -> str:
    s = win(p, 50, 40, 540, 330)
    t = p["txt"]
    s += (
        f'<rect x="80" y="100" width="260" height="30" rx="8" fill="{t}"/><rect x="80" y="140" width="200" height="30" rx="8" fill="{t}"/>'
        f'<rect x="80" y="190" width="180" height="10" rx="5" fill="{t}" opacity=".4"/><rect x="80" y="206" width="140" height="10" rx="5" fill="{t}" opacity=".4"/>'
        f'<rect x="80" y="240" width="130" height="40" rx="20" fill="{p["a"]}"/>'
    )
    s += (
        f'<rect x="380" y="100" width="180" height="180" rx="18" fill="{p["a"]}" opacity=".9"/><circle cx="470" cy="190" r="50" fill="{p["win"]}"/>'
        f'<path d="M450 190l12 12 28-28" stroke="{p["a"]}" stroke-width="8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>'
    )
    for x in (80, 250, 420):
        s += (
            f'<rect x="{x}" y="305" width="140" height="44" rx="10" fill="{p["win2"]}"/>'
            f'<rect x="{x + 14}" y="320" width="80" height="8" rx="4" fill="{t}" opacity=".4"/>'
        )
    s += sticker(p, 470, 60, "promtchi", M, C, 6)
    return _open(p) + s + _close()


def brand(p: dict[str, str]) -> str:
    s = f'<rect x="70" y="60" width="300" height="280" rx="24" fill="{p["win"]}"/>'
    s += f'<g class="il-spin"><path d="M220 110l70 80-70 80-70-80z" fill="{p["a"]}"/><circle cx="220" cy="190" r="26" fill="{p["win"]}"/></g>'
    s += f'<rect x="100" y="300" width="120" height="12" rx="6" fill="{p["txt"]}" opacity=".5"/>'
    for i, (f, t) in enumerate([(p["a"], M), (p["b"], M), (C, M), (M2, p["a"])]):
        s += (
            f'<rect x="400" y="{70 + i * 68}" width="170" height="56" rx="14" fill="{f}"/>'
            f'<rect x="416" y="{90 + i * 68}" width="60" height="8" rx="4" fill="{t}" opacity=".6"/>'
            f'<rect x="416" y="{104 + i * 68}" width="36" height="8" rx="4" fill="{t}" opacity=".35"/>'
        )
    s += sticker(p, 70, 370, "27 slayd", p["b"], C, -4)
    return _open(p) + s + _close()


def office(p: dict[str, str]) -> str:
    def iso(x: float, y: float, w: float, h: float, d: float, f1: str, f2: str, f3: str) -> str:
        return (
            f'<g transform="translate({n(x)} {n(y)})"><path d="M0 0l{n(w)} {n(-w / 2)}l{n(d)} {n(d / 2)}l{n(-w)} {n(w / 2)}z" fill="{f1}"/>'
            f'<path d="M0 0v{n(h)}l{n(d)} {n(d / 2)}v{n(-h)}z" fill="{f2}"/>'
            f'<path d="M{n(d)} {n(d / 2)}v{n(h)}l{n(w)} {n(-w / 2)}v{n(-h)}z" fill="{f3}"/></g>'
        )

    s = f'<path d="M320 60l260 130-260 130L60 190z" fill="{p["win"]}"/>'
    s += (
        iso(150, 180, 70, 60, 40, p["a"], M2, p["b"])
        + iso(300, 120, 70, 80, 40, p["b"], M2, p["a"])
        + iso(400, 190, 70, 50, 40, C, M2, p["a"])
        + iso(250, 230, 70, 40, 40, p["a"], M2, C)
    )
    xs, ys = [120, 300, 420, 230], [150, 95, 165, 210]
    for i, t in enumerate(["Tadqiqot", "Reja", "Senariy", "Tarjima"]):
        s += f'<g class="il-float" style="animation-delay:{n(i * 0.6)}s">{sticker(p, xs[i], ys[i], t, M, C, 0)}</g>'
    s += f'<path d="M190 150 Q300 60 330 95 M370 110 Q420 120 440 160 M440 200 Q360 230 300 215" stroke="{p["a"]}" stroke-width="3" fill="none" class="il-dash"/>'
    return _open(p) + s + _close()


def shop(p: dict[str, str]) -> str:
    s = win(p, 60, 40, 520, 330)
    s += (
        f'<rect x="90" y="100" width="200" height="240" rx="18" fill="{p["win2"]}"/><rect x="130" y="130" width="120" height="180" rx="22" fill="{p["a"]}"/>'
        f'<rect x="150" y="150" width="80" height="120" rx="8" fill="{M}" opacity=".85"/>'
    )
    s += (
        f'<rect x="320" y="110" width="220" height="22" rx="8" fill="{p["txt"]}"/>'
        f'<rect x="320" y="142" width="140" height="10" rx="5" fill="{p["txt"]}" opacity=".4"/>'
    )
    for i, f in enumerate([p["a"], p["b"], C, p["txt"]]):
        s += f'<circle cx="{338 + i * 34}" cy="190" r="12" fill="{f}" opacity="{"0.4" if i == 3 else "1"}"/>'
    s += f'<circle cx="338" cy="190" r="16" fill="none" stroke="{p["txt"]}" stroke-width="2"/>'
    for i, t in enumerate(["128", "256", "512"]):
        s += (
            f'<rect x="{320 + i * 70}" y="215" width="60" height="30" rx="10" fill="{p["a"] if i == 1 else p["win2"]}"/>'
            f'<text x="{350 + i * 70}" y="235" text-anchor="middle" font-family="Inter,sans-serif" font-weight="700" font-size="12" fill="{M if i == 1 else p["txt"]}">{t}</text>'
        )
    s += (
        f'<rect x="320" y="270" width="110" height="26" rx="6" fill="{p["a"]}" opacity=".9"/>'
        f'<rect x="320" y="310" width="200" height="40" rx="20" fill="{p["b"]}"/>'
        f'<rect x="380" y="326" width="80" height="8" rx="4" fill="{C}" opacity=".9"/>'
    )
    return _open(p) + s + _close()


def ai(p: dict[str, str]) -> str:
    s = ""
    nodes = [(120, 120), (120, 200), (120, 280), (300, 90), (300, 170), (300, 250), (300, 330), (480, 140), (480, 260)]
    edges = [(0, 3), (0, 4), (1, 4), (1, 5), (2, 5), (2, 6), (3, 7), (4, 7), (4, 8), (5, 8), (6, 8), (3, 8)]
    for a, b in edges:
        s += (
            f'<line x1="{nodes[a][0]}" y1="{nodes[a][1]}" x2="{nodes[b][0]}" y2="{nodes[b][1]}" '
            f'stroke="{p["txt"]}" stroke-width="2" opacity=".3"/>'
        )
    for i, (x, y) in enumerate(nodes):
        fill = p["a"] if i >= 7 else (p["b"] if i >= 3 else p["txt"])
        s += f'<circle class="il-pulse" style="animation-delay:{n(i * 0.2)}s" cx="{x}" cy="{y}" r="{22 if i >= 7 else 14}" fill="{fill}"/>'
    s += f'<rect x="520" y="90" width="80" height="220" rx="18" fill="{p["win"]}"/>' + lines(
        p, 536, 112, [48, 36, 44, 30, 46, 40, 34], 24, 9, 0.4
    )
    s += sticker(p, 70, 360, "AI mahsulot", p["a"], M, -5)
    return _open(p) + s + _close()


def bot(p: dict[str, str]) -> str:
    s = phone(p, 100, 30, 200, 360)
    t = p["txt"]
    s += (
        f'<rect x="118" y="70" width="164" height="110" rx="16" fill="{p["a"]}"/><path d="M190 110l26 15-26 15z" fill="{M}"/>'
        f'<rect x="118" y="196" width="164" height="36" rx="14" fill="{t}" opacity=".18"/>'
        f'<rect x="118" y="244" width="120" height="36" rx="14" fill="{t}" opacity=".18"/>'
        f'<rect x="160" y="292" width="122" height="36" rx="14" fill="{p["b"]}"/>'
    )
    s += (
        f'<g class="il-float"><rect x="360" y="90" width="220" height="150" rx="20" fill="{p["win"]}"/>'
        f'<circle cx="420" cy="165" r="34" fill="{p["a"]}"/><path d="M414 150v26a8 8 0 1 1-6-8V146l22-6v24a8 8 0 1 1-6-8" fill="{M}"/>'
        f'<rect x="470" y="140" width="90" height="12" rx="6" fill="{t}" opacity=".8"/>'
        f'<rect x="470" y="162" width="60" height="10" rx="5" fill="{t}" opacity=".4"/>'
        f'<rect x="470" y="190" width="80" height="22" rx="11" fill="{p["b"]}"/></g>'
    )
    s += sticker(p, 380, 300, "2 GB", p["a"], M, 6) + sticker(p, 470, 350, "yt-dlp · shazam", M, C, -4)
    return _open(p) + s + _close()


def portfolio(p: dict[str, str]) -> str:
    rnd = random.Random(20251102)  # deterministic: identical output on every build
    s = win(p, 60, 40, 520, 330)
    dots = ""
    for _ in range(220):
        a = rnd.random() * math.pi * 2
        r = math.sqrt(rnd.random()) * 85
        x = 200 + math.cos(a) * r
        y = 170 + math.sin(a) * r * 1.15
        rad = 1.5 + rnd.random() * 2.5
        fill = p["a"] if rnd.random() < 0.8 else p["b"]
        op = 0.5 + rnd.random() * 0.5
        dots += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rad:.1f}" fill="{fill}" opacity="{op:.2f}"/>'
    for _ in range(120):
        x = 120 + rnd.random() * 160
        y = 280 + rnd.random() * 60
        rad = 1.5 + rnd.random() * 2
        op = 0.3 + rnd.random() * 0.5
        dots += f'<circle cx="{x:.1f}" cy="{y:.1f}" r="{rad:.1f}" fill="{p["a"]}" opacity="{op:.2f}"/>'
    s += f'<g class="il-float">{dots}</g>'
    t = p["txt"]
    s += (
        f'<rect x="340" y="110" width="200" height="26" rx="8" fill="{t}"/><rect x="340" y="146" width="150" height="26" rx="8" fill="{p["a"]}"/>'
        f'<rect x="340" y="190" width="180" height="9" rx="4" fill="{t}" opacity=".4"/>'
        f'<rect x="340" y="206" width="140" height="9" rx="4" fill="{t}" opacity=".4"/>'
        f'<rect x="340" y="240" width="140" height="38" rx="19" fill="{p["b"]}"/>'
    )
    return _open(p) + s + _close()


KINDS: dict[str, Callable[[dict[str, str]], str]] = {
    "dashboard": dashboard,
    "chat": chat,
    "cards": cards,
    "exam": exam,
    "site": site,
    "brand": brand,
    "office": office,
    "shop": shop,
    "ai": ai,
    "bot": bot,
    "portfolio": portfolio,
}


def draw(kind: str | None, theme: str) -> str:
    p = PAL.get(theme) or PAL["red"]
    return KINDS.get(kind or "", site)(p)
