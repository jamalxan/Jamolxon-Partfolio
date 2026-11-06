"""Telegram Bot API and SMTP email (TZ 7)."""

import html
import logging
from email.message import EmailMessage
from typing import Any

import aiosmtplib
import httpx

from app.core.config import get_settings

log = logging.getLogger("app.notify")

STATUS_LABELS = {"new": "Yangi", "contacted": "Aloqada", "proposal_sent": "Taklif yuborildi", "won": "Kelishildi",
                 "lost": "Rad etildi", "spam": "Spam"}
BUDGET_LABELS = {"<500": "$500 gacha", "500-1000": "$500–1000", "1000-3000": "$1000–3000",
                 "3000-10000": "$3000–10000", "10000+": "$10000+", "aniq_emas": "aniq emas"}
DEADLINE_LABELS = {"shoshilinch": "shoshilinch", "1_oy": "1 oy", "3_oy": "3 oy", "aniq_emas": "aniq emas"}


class NotifyError(Exception):
    pass


def telegram_configured() -> bool:
    s = get_settings()
    return bool(s.telegram_bot_token and s.telegram_chat_id)


async def telegram_call(method: str, payload: dict[str, Any]) -> dict[str, Any]:
    s = get_settings()
    if not s.telegram_bot_token:
        raise NotifyError("telegram not configured")
    url = f"https://api.telegram.org/bot{s.telegram_bot_token.get_secret_value()}/{method}"
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.post(url, json=payload)
    except httpx.HTTPError as e:
        raise NotifyError(f"telegram network error: {type(e).__name__}") from None
    data: dict[str, Any] = r.json() if r.headers.get("content-type", "").startswith("application/json") else {}
    if r.status_code != 200 or not data.get("ok"):
        raise NotifyError(f"telegram error {r.status_code}: {data.get('description', '')}")
    return data


async def send_telegram(text: str, buttons: list[list[dict[str, str]]] | None = None) -> None:
    payload: dict[str, Any] = {"chat_id": get_settings().telegram_chat_id, "text": text, "parse_mode": "HTML",
                               "disable_web_page_preview": True}
    if buttons:
        payload["reply_markup"] = {"inline_keyboard": buttons}
    await telegram_call("sendMessage", payload)


def lead_message(lead: Any, service_title: str) -> tuple[str, list[list[dict[str, str]]]]:
    s = get_settings()
    e = html.escape
    contact_label = {"email": "Email", "telegram": "Telegram", "phone": "Telefon"}[lead.contact_type]
    utm = " · ".join(f"{k}={v}" for k, v in (lead.utm or {}).items())
    lines = [
        f"<b>Yangi taklif #{lead.number} — {e(service_title)}</b>",
        f"Ism: {e(lead.name)}",
        f"{contact_label}: {e(lead.contact_value)}",
    ]
    meta = []
    if lead.budget_range:
        meta.append(f"Byudjet: {BUDGET_LABELS.get(lead.budget_range, lead.budget_range)}")
    if lead.deadline:
        meta.append(f"Muddat: {DEADLINE_LABELS.get(lead.deadline, lead.deadline)}")
    if meta:
        lines.append(" · ".join(meta))
    msg = lead.message if len(lead.message) <= 600 else lead.message[:600] + "…"
    lines.append(f"Xabar: {e(msg)}")
    if lead.source_page or utm:
        lines.append("Manba: " + e(" · ".join(x for x in (lead.source_page, utm) if x)))
    buttons: list[list[dict[str, str]]] = []
    first: list[dict[str, str]] = []
    if lead.contact_type == "telegram":
        first.append({"text": "Yozish", "url": f"https://t.me/{lead.contact_value.lstrip('@')}"})
    first.append({"text": "Admin panelda ochish", "url": f"{s.admin_url}/leadlar/{lead.id}"})
    buttons.append(first)
    buttons.append([{"text": "Aloqada", "callback_data": f"lead:{lead.id}:contacted"},
                    {"text": "Spam", "callback_data": f"lead:{lead.id}:spam"}])
    return "\n".join(lines), buttons


def email_configured() -> bool:
    return bool(get_settings().smtp_host)


async def send_email(to: str, subject: str, body: str) -> None:
    s = get_settings()
    if not s.smtp_host:
        raise NotifyError("smtp not configured")
    msg = EmailMessage()
    msg["From"] = s.smtp_from
    msg["To"] = to
    msg["Subject"] = subject
    msg.set_content(body)
    try:
        await aiosmtplib.send(msg, hostname=s.smtp_host, port=s.smtp_port, username=s.smtp_user or None,
                              password=s.smtp_password.get_secret_value() if s.smtp_password else None,
                              start_tls=s.smtp_port == 587, use_tls=s.smtp_port == 465, timeout=15)
    except (aiosmtplib.SMTPException, OSError) as e:
        raise NotifyError(f"smtp error: {type(e).__name__}") from None
