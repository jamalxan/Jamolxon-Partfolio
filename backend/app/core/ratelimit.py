"""Redis fixed-window rate limits."""

from fastapi import Request

from app.core.errors import Problem
from app.core.redis import get_redis


async def hit(key: str, limit: int, window_seconds: int) -> tuple[bool, int]:
    """Counts one hit. Returns (allowed, retry_after_seconds)."""
    r = get_redis()
    full = f"rl:{key}"
    pipe = r.pipeline()
    pipe.incr(full)
    pipe.ttl(full)
    count, ttl = await pipe.execute()
    if int(ttl) < 0:
        await r.expire(full, window_seconds)
        ttl = window_seconds
    return int(count) <= limit, max(int(ttl), 1)


async def peek(key: str) -> int:
    value = await get_redis().get(f"rl:{key}")
    return int(value or 0)


async def reset(key: str) -> None:
    await get_redis().delete(f"rl:{key}")


async def enforce(key: str, limit: int, window_seconds: int) -> None:
    allowed, retry = await hit(key, limit, window_seconds)
    if not allowed:
        raise Problem(429, "rate_limited", headers={"Retry-After": str(retry)})


def client_ip(request: Request) -> str:
    # nginx resolves the real client IP (Cloudflare / Caddy aware) and uvicorn applies X-Forwarded-For.
    return request.client.host if request.client else "0.0.0.0"
