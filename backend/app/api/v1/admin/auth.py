"""Admin auth (TZ 8): argon2id passwords, mandatory TOTP 2FA, HttpOnly cookie tokens,
refresh rotation with family revocation on reuse, login lockout + Telegram alerts."""

import uuid
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Request, Response
from sqlalchemy import select, update

from app.api.deps import (
    ACCESS_COOKIE,
    CSRF_COOKIE,
    DB,
    PRE_COOKIE,
    REFRESH_COOKIE,
    CurrentUser,
    csrf_protect,
    mark_family_revoked,
)
from app.core.config import get_settings
from app.core.errors import Problem, field_error
from app.core.ids import uuid7
from app.core.queue import enqueue
from app.core.ratelimit import client_ip, hit, peek, reset
from app.core.security import (
    create_access_token,
    create_pre_auth_token,
    decode_token,
    decrypt,
    dummy_verify,
    encrypt,
    hash_ip,
    hash_password,
    new_backup_codes,
    new_csrf_token,
    new_opaque_token,
    new_totp_secret,
    sha256_hex,
    totp_uri,
    validate_new_password,
    verify_password,
    verify_totp,
)
from app.models import RefreshToken, User
from app.schemas.system import LoginIn, PasswordChangeIn, UserOut, VerifyIn
from app.services.audit import record

router = APIRouter(prefix="/auth", tags=["admin-auth"])

BAD_CREDENTIALS = "Email yoki parol noto'g'ri"


def _cookie(response: Response, name: str, value: str, max_age: int, path: str, httponly: bool = True) -> None:
    response.set_cookie(name, value, max_age=max_age, path=path, httponly=httponly,
                        secure=get_settings().cookie_secure, samesite="strict")


def _clear(response: Response) -> None:
    s = get_settings()
    for name, path in ((ACCESS_COOKIE, "/api/v1/admin"), (REFRESH_COOKIE, "/api/v1/admin/auth"),
                       (CSRF_COOKIE, "/"), (PRE_COOKIE, "/api/v1/admin/auth")):
        response.delete_cookie(name, path=path, secure=s.cookie_secure, samesite="strict")


async def issue_session(session: DB, response: Response, user: User, request: Request,
                        family_id: uuid.UUID | None = None) -> None:
    s = get_settings()
    family = family_id or uuid7()
    raw = new_opaque_token()
    session.add(RefreshToken(user_id=user.id, family_id=family, token_hash=sha256_hex(raw),
                             expires_at=datetime.now(UTC) + timedelta(days=s.refresh_token_days),
                             user_agent=request.headers.get("user-agent", "")[:300]))
    _cookie(response, ACCESS_COOKIE, create_access_token(user.id, user.role, family), s.access_token_minutes * 60,
            "/api/v1/admin")
    _cookie(response, REFRESH_COOKIE, raw, s.refresh_token_days * 86400, "/api/v1/admin/auth")
    _cookie(response, CSRF_COOKIE, new_csrf_token(), s.refresh_token_days * 86400, "/", httponly=False)


async def revoke_user_sessions(session: DB, user_id: uuid.UUID) -> None:
    fams = (await session.scalars(select(RefreshToken.family_id).where(
        RefreshToken.user_id == user_id, RefreshToken.revoked_at.is_(None)).distinct())).all()
    await session.execute(update(RefreshToken).where(RefreshToken.user_id == user_id,
                                                     RefreshToken.revoked_at.is_(None))
                          .values(revoked_at=datetime.now(UTC)))
    for fam in fams:
        await mark_family_revoked(fam)


def _login_key(request: Request, email: str) -> str:
    return f"login:{hash_ip(client_ip(request))}:{email.lower()}"


@router.post("/login")
async def login(body: LoginIn, request: Request, response: Response, session: DB) -> dict[str, str]:
    s = get_settings()
    key = _login_key(request, body.email)
    lock_key = f"{key}:lock"
    if await peek(lock_key):
        raise Problem(423, "locked", headers={"Retry-After": str(s.login_window_minutes * 60)})

    user = await session.scalar(select(User).where(User.email == body.email.lower()))
    ok = verify_password(user.password_hash, body.password) if user else (dummy_verify() or False)
    if not ok or user is None or not user.is_active:
        allowed, _ = await hit(key, s.login_max_attempts, s.login_window_minutes * 60)
        if user is not None:
            user.failed_logins += 1
        if not allowed or await peek(key) >= s.login_max_attempts:
            await hit(lock_key, 1, s.login_window_minutes * 60)
            if user is not None:
                user.locked_until = datetime.now(UTC) + timedelta(minutes=s.login_window_minutes)
            await enqueue("send_alert", f"⚠️ Admin login bloklandi: {body.email.lower()} "
                                        f"({s.login_max_attempts} ta xato urinish)")
        await session.commit()
        raise Problem(401, "unauthorized", BAD_CREDENTIALS)

    await reset(key)
    _cookie(response, PRE_COOKIE, create_pre_auth_token(user.id), 300, "/api/v1/admin/auth")
    return {"status": "2fa_required" if user.totp_enabled else "2fa_setup_required"}


async def _pre_user(request: Request, session: DB) -> User:
    token = request.cookies.get(PRE_COOKIE)
    data = decode_token(token, "pre") if token else None
    if not data:
        raise Problem(401, "unauthorized")
    user = await session.get(User, uuid.UUID(data["sub"]))
    if user is None or not user.is_active:
        raise Problem(401, "unauthorized")
    return user


@router.post("/2fa/setup")
async def twofa_setup(request: Request, session: DB) -> dict[str, str]:
    user = await _pre_user(request, session)
    if user.totp_enabled:
        raise Problem(403, "forbidden")
    secret = new_totp_secret()
    user.totp_secret = encrypt(secret)
    await session.commit()
    return {"secret": secret, "otpauth_url": totp_uri(secret, user.email)}


@router.post("/2fa/verify")
async def twofa_verify(body: VerifyIn, request: Request, response: Response, session: DB) -> dict[str, object]:
    user = await _pre_user(request, session)
    key = f"2fa:{user.id}"
    allowed, retry = await hit(key, 5, 900)
    if not allowed:
        raise Problem(429, "rate_limited", headers={"Retry-After": str(retry)})
    if not user.totp_secret:
        raise field_error("code", "Avval 2FA'ni sozlang")
    ok = False
    if body.code:
        ok = verify_totp(decrypt(user.totp_secret), body.code)
    elif body.backup_code and user.totp_enabled:
        remaining = []
        for h in user.backup_codes:
            if not ok and verify_password(h, body.backup_code.strip().lower()):
                ok = True
                continue
            remaining.append(h)
        user.backup_codes = remaining
    if not ok:
        await session.commit()
        raise field_error("code", "Kod noto'g'ri")

    await reset(key)
    codes: list[str] | None = None
    if not user.totp_enabled:
        user.totp_enabled = True
        codes = new_backup_codes()
        user.backup_codes = [hash_password(c) for c in codes]

    device = sha256_hex(f"{request.headers.get('user-agent', '')}|{request.headers.get('cf-ipcountry', '')}")
    if device not in (user.known_devices or []):
        if user.known_devices:
            country = request.headers.get("cf-ipcountry", "?")
            await enqueue("send_alert", f"🔐 Yangi qurilma/mamlakatdan kirish: {user.email} ({country})")
        user.known_devices = [*(user.known_devices or []), device][-20:]
    user.failed_logins = 0
    user.locked_until = None
    user.last_login_at = datetime.now(UTC)
    await issue_session(session, response, user, request)
    await record(session, actor_id=user.id, action="login", entity="user", entity_id=user.id, request=request)
    await session.commit()
    response.delete_cookie(PRE_COOKIE, path="/api/v1/admin/auth")
    return {"user": UserOut.model_validate(user).model_dump(mode="json"), "backup_codes": codes}


@router.post("/refresh")
async def refresh(request: Request, response: Response, session: DB) -> dict[str, object]:
    raw = request.cookies.get(REFRESH_COOKIE)
    if not raw:
        raise Problem(401, "unauthorized")
    token = await session.scalar(select(RefreshToken).where(RefreshToken.token_hash == sha256_hex(raw)))
    now = datetime.now(UTC)
    if token is None:
        raise Problem(401, "unauthorized")
    if token.used_at is not None or token.revoked_at is not None:
        # Reuse of a rotated token: assume theft, kill every session of this user (TZ 8).
        await revoke_user_sessions(session, token.user_id)
        await record(session, actor_id=token.user_id, action="refresh_reuse", entity="user",
                     entity_id=token.user_id, request=request)
        await session.commit()
        await enqueue("send_alert", "🚨 Qayta ishlatilgan refresh token aniqlandi — barcha sessiyalar bekor qilindi")
        _clear(response)
        raise Problem(401, "unauthorized")
    if token.expires_at <= now:
        raise Problem(401, "unauthorized")
    user = await session.get(User, token.user_id)
    if user is None or not user.is_active or not user.totp_enabled:
        raise Problem(401, "unauthorized")
    token.used_at = now
    await issue_session(session, response, user, request, family_id=token.family_id)
    await session.commit()
    return {"user": UserOut.model_validate(user).model_dump(mode="json")}


@router.post("/logout", status_code=204, dependencies=[])
async def logout(request: Request, response: Response, session: DB) -> Response:
    raw = request.cookies.get(REFRESH_COOKIE)
    if raw:
        token = await session.scalar(select(RefreshToken).where(RefreshToken.token_hash == sha256_hex(raw)))
        if token is not None:
            await session.execute(update(RefreshToken).where(RefreshToken.family_id == token.family_id)
                                  .values(revoked_at=datetime.now(UTC)))
            await mark_family_revoked(token.family_id)
            await session.commit()
    out = Response(status_code=204)
    _clear(out)
    return out


@router.get("/me", response_model=UserOut)
async def me(user: CurrentUser) -> User:
    return user


@router.post("/password", status_code=204)
async def change_password(body: PasswordChangeIn, request: Request, user: CurrentUser, session: DB) -> Response:
    await csrf_protect(request)
    if not verify_password(user.password_hash, body.current_password):
        raise field_error("current_password", "Joriy parol noto'g'ri")
    err = await validate_new_password(body.new_password)
    if err:
        raise field_error("new_password", err)
    user.password_hash = hash_password(body.new_password)
    await revoke_user_sessions(session, user.id)
    await record(session, actor_id=user.id, action="password_change", entity="user", entity_id=user.id,
                 request=request)
    await session.commit()
    out = Response(status_code=204)
    _clear(out)
    return out
