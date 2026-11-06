"""Audit log (append-only) for every admin action (TZ 8)."""

import uuid
from datetime import date, datetime
from typing import Any

from fastapi import Request
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.ratelimit import client_ip
from app.models import AuditLog

SENSITIVE = {"password", "password_hash", "totp_secret", "backup_codes", "token_hash"}


def _jsonable(v: Any) -> Any:
    if isinstance(v, (datetime, date)):
        return v.isoformat()
    if isinstance(v, uuid.UUID):
        return str(v)
    if isinstance(v, (list, tuple)):
        return [_jsonable(x) for x in v]
    if isinstance(v, dict):
        return {str(k): _jsonable(x) for k, x in v.items()}
    return v


def make_diff(before: dict[str, Any], after: dict[str, Any]) -> dict[str, Any]:
    diff = {}
    for key in sorted(set(before) | set(after)):
        if key in SENSITIVE or key in ("updated_at", "created_at"):
            continue
        b, a = _jsonable(before.get(key)), _jsonable(after.get(key))
        if b != a:
            diff[key] = {"from": b, "to": a}
    return diff


async def record(session: AsyncSession, *, actor_id: uuid.UUID | None, action: str, entity: str,
                 entity_id: Any = None, diff: dict[str, Any] | None = None, request: Request | None = None) -> None:
    session.add(AuditLog(
        actor_id=actor_id, action=action, entity=entity,
        entity_id=str(entity_id) if entity_id is not None else None,
        diff=_jsonable(diff or {}),
        ip=client_ip(request) if request else "",
        user_agent=(request.headers.get("user-agent", "")[:300] if request else ""),
    ))
