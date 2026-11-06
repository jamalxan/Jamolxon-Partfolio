"""ARQ job queue. In the test environment jobs are recorded in memory instead of Redis."""

from typing import Any

from arq import create_pool
from arq.connections import ArqRedis, RedisSettings

from app.core.config import get_settings

_pool: ArqRedis | None = None
test_jobs: list[tuple[str, tuple[Any, ...], dict[str, Any]]] = []


def redis_settings() -> RedisSettings:
    return RedisSettings.from_dsn(get_settings().redis_url)


async def get_pool() -> ArqRedis:
    global _pool
    if _pool is None:
        _pool = await create_pool(redis_settings())
    return _pool


async def enqueue(name: str, *args: Any, **kwargs: Any) -> str:
    if get_settings().env == "test":
        test_jobs.append((name, args, kwargs))
        return f"test-{len(test_jobs)}"
    job = await (await get_pool()).enqueue_job(name, *args, **kwargs)
    return job.job_id if job else "duplicate"


async def close_pool() -> None:
    global _pool
    if _pool is not None:
        await _pool.aclose()
    _pool = None
