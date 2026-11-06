"""Media storage: Cloudflare R2 (S3) when configured, else a local directory.

Uploads (TZ 8): max 10 MB, type detected from content (not the filename/Content-Type),
JPEG/PNG/WebP/AVIF/PDF only, SVG rejected, images re-encoded with Pillow (EXIF/GPS dropped),
file name replaced with a UUID. Variants: WebP + AVIF at 480/960/1440/2048 px.
"""

import asyncio
import io
import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from PIL import Image, ImageOps, UnidentifiedImageError

from app.core.config import get_settings
from app.core.errors import Problem
from app.core.ids import uuid7

log = logging.getLogger("app.storage")

MAX_BYTES = 10 * 1024 * 1024
WIDTHS = (480, 960, 1440, 2048)
IMAGE_FORMATS = {"JPEG": ("image/jpeg", "jpg"), "PNG": ("image/png", "png"), "WEBP": ("image/webp", "webp"),
                 "AVIF": ("image/avif", "avif")}
Image.MAX_IMAGE_PIXELS = 40_000_000  # decompression-bomb guard


@dataclass
class Stored:
    storage_key: str
    mime: str
    size_bytes: int
    width: int | None = None
    height: int | None = None
    variants: dict[str, Any] = field(default_factory=dict)


def sniff(data: bytes) -> str:
    """Returns 'pdf', 'image' or raises 415. Detection uses file content only."""
    if data[:5] == b"%PDF-":
        return "pdf"
    head = data[:512].lstrip().lower()
    if head.startswith(b"<?xml") or b"<svg" in head:
        raise Problem(415, "unsupported_media")
    if data[:3] == b"\xff\xd8\xff" or data[:8] == b"\x89PNG\r\n\x1a\n" or (data[:4] == b"RIFF" and data[8:12] == b"WEBP") \
            or (data[4:8] == b"ftyp" and data[8:12] in (b"avif", b"avis")):
        return "image"
    raise Problem(415, "unsupported_media")


def _encode(img: Image.Image, fmt: str) -> bytes:
    buf = io.BytesIO()
    if fmt == "JPEG":
        img.convert("RGB").save(buf, "JPEG", quality=85, optimize=True, progressive=True)
    elif fmt == "PNG":
        img.save(buf, "PNG", optimize=True)
    elif fmt == "WEBP":
        img.save(buf, "WEBP", quality=82, method=5)
    elif fmt == "AVIF":
        img.save(buf, "AVIF", quality=60)
    return buf.getvalue()


def process_image(data: bytes) -> tuple[str, bytes, int, int, dict[str, bytes]]:
    """Re-encodes the image (drops EXIF/metadata) and builds variants. Returns (fmt, main, w, h, variants)."""
    try:
        probe = Image.open(io.BytesIO(data))
        probe.verify()
        src = Image.open(io.BytesIO(data))
        fmt = src.format or ""
        src.load()
    except (UnidentifiedImageError, OSError, Image.DecompressionBombError) as e:
        raise Problem(415, "unsupported_media") from e
    if fmt not in IMAGE_FORMATS:
        raise Problem(415, "unsupported_media")
    img: Image.Image = ImageOps.exif_transpose(src)  # apply orientation, then metadata is not copied on save
    if img.mode not in ("RGB", "RGBA"):
        img = img.convert("RGBA" if "A" in img.getbands() else "RGB")
    clean = Image.new(img.mode, img.size)
    clean.paste(img)
    main = _encode(clean, fmt)
    variants: dict[str, bytes] = {}
    for w in WIDTHS:
        if w >= clean.width and w != WIDTHS[0]:
            continue
        target = clean if w >= clean.width else clean.resize((w, round(clean.height * w / clean.width)),
                                                              Image.Resampling.LANCZOS)
        variants[f"webp/{w}"] = _encode(target, "WEBP")
        try:
            variants[f"avif/{w}"] = _encode(target, "AVIF")
        except (KeyError, OSError):  # Pillow built without AVIF
            pass
    return fmt, main, clean.width, clean.height, variants


class Backend:
    async def put(self, key: str, data: bytes, mime: str) -> None:
        raise NotImplementedError

    async def delete(self, key: str) -> None:
        raise NotImplementedError

    def url(self, key: str) -> str:
        return f"{get_settings().media_public_url.rstrip('/')}/{key}"


class LocalBackend(Backend):
    def __init__(self, root: Path) -> None:
        self.root = root

    async def put(self, key: str, data: bytes, mime: str) -> None:
        path = self.root / key
        path.parent.mkdir(parents=True, exist_ok=True)
        await asyncio.to_thread(path.write_bytes, data)

    async def delete(self, key: str) -> None:
        for p in [self.root / key, *(self.root / key).parent.glob(f"{Path(key).stem}-*")]:
            p.unlink(missing_ok=True)


class S3Backend(Backend):
    def __init__(self) -> None:
        import boto3

        s = get_settings()
        self.bucket = s.s3_bucket
        self.client = boto3.client("s3", endpoint_url=s.s3_endpoint, aws_access_key_id=s.s3_access_key,
                                   aws_secret_access_key=s.s3_secret_key.get_secret_value() if s.s3_secret_key else None,
                                   region_name="auto")

    async def put(self, key: str, data: bytes, mime: str) -> None:
        await asyncio.to_thread(self.client.put_object, Bucket=self.bucket, Key=key, Body=data, ContentType=mime,
                                CacheControl="public, max-age=31536000, immutable")

    async def delete(self, key: str) -> None:
        prefix = key.rsplit(".", 1)[0]
        resp = await asyncio.to_thread(self.client.list_objects_v2, Bucket=self.bucket, Prefix=prefix)
        for obj in resp.get("Contents", []):
            await asyncio.to_thread(self.client.delete_object, Bucket=self.bucket, Key=obj["Key"])


def get_backend() -> Backend:
    s = get_settings()
    if s.s3_endpoint and s.s3_bucket:
        return S3Backend()
    return LocalBackend(s.media_dir)


async def store_upload(data: bytes) -> Stored:
    if len(data) > MAX_BYTES:
        raise Problem(413, "payload_too_large")
    if not data:
        raise Problem(422, "validation_error", errors=[{"field": "file", "msg": "Fayl bo'sh"}])
    kind = sniff(data)
    backend = get_backend()
    base = f"{uuid7()}"
    if kind == "pdf":
        key = f"{base}.pdf"
        await backend.put(key, data, "application/pdf")
        return Stored(key, "application/pdf", len(data))
    fmt, main, w, h, variants = await asyncio.to_thread(process_image, data)
    mime, ext = IMAGE_FORMATS[fmt]
    key = f"{base}.{ext}"
    await backend.put(key, main, mime)
    out: dict[str, dict[str, str]] = {}
    for vkey, vdata in variants.items():
        vfmt, width = vkey.split("/")
        vname = f"{base}-{width}.{vfmt}"
        await backend.put(vname, vdata, f"image/{vfmt}")
        out.setdefault(vfmt, {})[width] = backend.url(vname)
    return Stored(key, mime, len(main), w, h, out)
