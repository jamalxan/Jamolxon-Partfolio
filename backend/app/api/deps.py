"""Shared dependencies: DB session, current admin user, CSRF, role checks (default deny)."""

import uuid
from collections.abc import Awaitable, Callable
from typing import Annotated

from fastapi import Depends, Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.db import get_session
from app.core.errors import Problem
from app.core.logging import user_id_var
from app.core.redis import get_redis
from app.core.security import csrf_valid, decode_token
from app.models import User

DB = Annotated[AsyncSession, Depends(get_session)]

ACCESS_COOKIE = "jx_access"
REFRESH_COOKIE = "jx_refresh"
CSRF_COOKIE = "jx_csrf"
PRE_COOKIE = "jx_pre"
SAFE_METHODS = {"GET", "HEAD", "OPTIONS"}


async def family_revoked(family_id: str) -> bool:
    return bool(await get_redis().exists(f"fam:revoked:{family_id}"))


async def mark_family_revoked(family_id: uuid.UUID | str, ttl_seconds: int = 3600) -> None:
    await get_redis().set(f"fam:revoked:{family_id}", "1", ex=ttl_seconds)


async def current_user(request: Request, session: DB) -> User:
    token = request.cookies.get(ACCESS_COOKIE)
    data = decode_token(token, "access") if token else None
    if not data:
        raise Problem(401, "unauthorized")
    if await family_revoked(data["fam"]):
        raise Problem(401, "unauthorized")
    user = await session.get(User, uuid.UUID(data["sub"]))
    if user is None or not user.is_active or not user.totp_enabled:
        raise Problem(401, "unauthorized")
    request.state.user = user
    request.state.session_family = data["fam"]
    user_id_var.set(str(user.id))
    return user


CurrentUser = Annotated[User, Depends(current_user)]


async def csrf_protect(request: Request) -> None:
    """CSRF check on every state-changing admin request (TZ 8): the X-CSRF-Token header must equal the token
    derived from this session's family (signed double submit), not merely whatever the jx_csrf cookie holds."""
    if request.method in SAFE_METHODS:
        return
    token = request.cookies.get(ACCESS_COOKIE)
    data = decode_token(token, "access") if token else None
    if not csrf_valid(data["fam"] if data else None, request.headers.get("x-csrf-token")):
        raise Problem(403, "csrf_failed")


def require_role(*roles: str) -> Callable[[User], Awaitable[User]]:
    async def checker(user: CurrentUser) -> User:
        if user.role not in roles:
            raise Problem(403, "forbidden")
        return user

    return checker


Owner = Annotated[User, Depends(require_role("owner"))]
Staff = Annotated[User, Depends(require_role("owner", "editor"))]
