import csv
import io
import uuid
from datetime import date, datetime, time
from typing import Any

from fastapi import APIRouter, Query, Request
from fastapi.responses import StreamingResponse
from sqlalchemy import func, or_, select

from app.api.deps import DB, Owner, Staff
from app.core.errors import not_found
from app.models import Lead, LeadEvent, User
from app.schemas.lead import LeadEventCreate, LeadPatch
from app.services.audit import make_diff, record

router = APIRouter(prefix="/leads", tags=["admin-leads"])


def event_out(e: LeadEvent) -> dict[str, Any]:
    return {"id": e.id, "kind": e.kind, "payload": e.payload, "created_at": e.created_at,
            "actor": {"id": e.actor.id, "email": e.actor.email} if e.actor else None}


def lead_out(lead: Lead, with_events: bool = False) -> dict[str, Any]:
    out: dict[str, Any] = {
        "id": lead.id, "number": lead.number, "name": lead.name, "contact_type": lead.contact_type,
        "contact_value": lead.contact_value, "service": lead.service_slug, "budget_range": lead.budget_range,
        "deadline": lead.deadline, "message": lead.message, "status": lead.status, "source_page": lead.source_page,
        "utm": lead.utm, "spam_score": lead.spam_score, "assigned_to": lead.assigned_to,
        "created_at": lead.created_at, "updated_at": lead.updated_at,
    }
    if with_events:
        out["events"] = [event_out(e) for e in lead.events]
    return out


def _filtered(status: str | None, q: str | None, from_: date | None, to: date | None) -> Any:
    stmt = select(Lead)
    if status:
        stmt = stmt.where(Lead.status == status)
    if q:
        like = f"%{q}%"
        stmt = stmt.where(or_(Lead.name.ilike(like), Lead.contact_value.ilike(like), Lead.message.ilike(like)))
    if from_:
        stmt = stmt.where(Lead.created_at >= datetime.combine(from_, time.min))
    if to:
        stmt = stmt.where(Lead.created_at <= datetime.combine(to, time.max))
    return stmt


STATUS_RE = "^(new|contacted|proposal_sent|won|lost|spam)$"


@router.get("")
async def list_leads(session: DB, user: Staff, status: str | None = Query(None, pattern=STATUS_RE),
                     q: str | None = Query(None, max_length=100), from_: date | None = Query(None, alias="from"),
                     to: date | None = None, page: int = Query(1, ge=1),
                     limit: int = Query(12, ge=1, le=50)) -> dict[str, Any]:
    stmt = _filtered(status, q, from_, to)
    total = await session.scalar(select(func.count()).select_from(stmt.subquery())) or 0
    rows = (await session.scalars(stmt.order_by(Lead.created_at.desc()).offset((page - 1) * limit).limit(limit))).all()
    return {"items": [lead_out(r) for r in rows], "total": total, "page": page, "limit": limit}


@router.get("/export.csv")
async def export_csv(session: DB, user: Owner, status: str | None = Query(None, pattern=STATUS_RE),
                     q: str | None = Query(None, max_length=100), from_: date | None = Query(None, alias="from"),
                     to: date | None = None) -> StreamingResponse:
    rows = (await session.scalars(_filtered(status, q, from_, to).order_by(Lead.created_at.desc()))).all()
    buf = io.StringIO()
    buf.write("﻿")  # Excel-friendly UTF-8
    w = csv.writer(buf)
    w.writerow(["number", "created_at", "status", "name", "contact_type", "contact_value", "service", "budget_range",
                "deadline", "message", "source_page", "spam_score"])
    for r in rows:
        # Neutralize spreadsheet formula injection.
        cells = [r.number, r.created_at.isoformat(), r.status, r.name, r.contact_type, r.contact_value,
                 r.service_slug, r.budget_range or "", r.deadline or "", r.message, r.source_page, r.spam_score]
        w.writerow([_csv_safe(c) for c in cells])
    return StreamingResponse(iter([buf.getvalue()]), media_type="text/csv; charset=utf-8",
                             headers={"Content-Disposition": 'attachment; filename="leads.csv"'})


CSV_FORMULA_PREFIXES = ("=", "+", "-", "@", "\t", "\r")


def _csv_safe(value: object) -> object:
    """Neutralize spreadsheet formula injection in every text cell (phone numbers like +998... included:
    the leading apostrophe is hidden by Excel/Sheets and keeps the value as text)."""
    if isinstance(value, str) and value.startswith(CSV_FORMULA_PREFIXES):
        return "'" + value
    return value


async def _get(session: DB, lead_id: uuid.UUID) -> Lead:
    lead = await session.get(Lead, lead_id)
    if lead is None:
        raise not_found()
    return lead


@router.get("/{lead_id}")
async def get_lead(lead_id: uuid.UUID, session: DB, user: Staff) -> dict[str, Any]:
    return lead_out(await _get(session, lead_id), with_events=True)


@router.patch("/{lead_id}")
async def patch_lead(lead_id: uuid.UUID, body: LeadPatch, request: Request, session: DB,
                     user: Owner) -> dict[str, Any]:
    lead = await _get(session, lead_id)
    before = {"status": lead.status, "assigned_to": lead.assigned_to}
    data = body.model_dump(exclude_unset=True)
    if "assigned_to" in data and data["assigned_to"] is not None and await session.get(User, data["assigned_to"]) is None:
        from app.core.errors import field_error

        raise field_error("assigned_to", "Foydalanuvchi topilmadi")
    if data.get("status") and data["status"] != lead.status:
        session.add(LeadEvent(lead_id=lead.id, actor_id=user.id, kind="status_change",
                              payload={"from": lead.status, "to": data["status"]}))
    for k, v in data.items():
        setattr(lead, k, v)
    await record(session, actor_id=user.id, action="update", entity="lead", entity_id=lead.id,
                 diff=make_diff(before, {"status": lead.status, "assigned_to": lead.assigned_to}), request=request)
    await session.commit()
    session.expire(lead)
    return lead_out(await _get(session, lead_id), with_events=True)


@router.post("/{lead_id}/events", status_code=201)
async def add_event(lead_id: uuid.UUID, body: LeadEventCreate, request: Request, session: DB,
                    user: Staff) -> dict[str, Any]:
    lead = await _get(session, lead_id)
    ev = LeadEvent(lead_id=lead.id, actor_id=user.id, kind=body.kind, payload=dict(body.payload))
    session.add(ev)
    await record(session, actor_id=user.id, action="lead_event", entity="lead", entity_id=lead.id,
                 diff={"kind": body.kind}, request=request)
    await session.commit()
    await session.refresh(ev)
    return event_out(ev)
