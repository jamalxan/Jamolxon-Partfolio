"""TZ 8 auth requirements + TZ 12 acceptance: login + 2FA, lockout on 6th attempt, editor restrictions."""

import pyotp
from httpx import AsyncClient
from sqlalchemy import select, text

from app.core.db import get_sessionmaker
from app.core.security import verify_password
from app.models import RefreshToken, User
from tests.conftest import PASSWORD, csrf, jobs, login, make_user


async def test_passwords_are_argon2id() -> None:
    u, _ = await make_user()
    assert u.password_hash.startswith("$argon2id$v=19$m=65536,t=3")
    assert verify_password(u.password_hash, PASSWORD)


async def test_login_requires_2fa_and_sets_httponly_cookies(client: AsyncClient) -> None:
    u, secret = await make_user()
    r = await client.post("/api/v1/admin/auth/login", json={"email": u.email, "password": PASSWORD})
    assert r.json() == {"status": "2fa_required"}
    assert client.cookies.get("jx_access") is None  # no session before 2FA
    r = await client.get("/api/v1/admin/auth/me")
    assert r.status_code == 401
    r = await client.post("/api/v1/admin/auth/2fa/verify", json={"code": pyotp.TOTP(secret).now()})
    assert r.status_code == 200
    cookies = r.headers.get_list("set-cookie")
    access = next(c for c in cookies if c.startswith("jx_access="))
    assert "HttpOnly" in access and "SameSite=strict" in access and "Path=/api/v1/admin" in access
    assert "HttpOnly" not in next(c for c in cookies if c.startswith("jx_csrf="))
    me = await client.get("/api/v1/admin/auth/me")
    assert me.json()["email"] == u.email
    assert "password_hash" not in me.text and "totp_secret" not in me.text


async def test_wrong_totp_rejected(client: AsyncClient) -> None:
    u, _ = await make_user()
    await client.post("/api/v1/admin/auth/login", json={"email": u.email, "password": PASSWORD})
    r = await client.post("/api/v1/admin/auth/2fa/verify", json={"code": "000000"})
    assert r.status_code == 422
    assert r.json()["errors"][0]["field"] == "code"


async def test_same_error_for_unknown_email_and_wrong_password(client: AsyncClient) -> None:
    await make_user()
    a = await client.post("/api/v1/admin/auth/login", json={"email": "owner@jamolxon.uz", "password": "noto'g'ri"})
    b = await client.post("/api/v1/admin/auth/login", json={"email": "yoq@jamolxon.uz", "password": "noto'g'ri"})
    assert a.status_code == b.status_code == 401
    assert a.json()["title"] == b.json()["title"] == "Email yoki parol noto'g'ri"


async def test_lockout_on_sixth_attempt_and_alert(client: AsyncClient) -> None:
    u, _ = await make_user()
    for _ in range(5):
        r = await client.post("/api/v1/admin/auth/login", json={"email": u.email, "password": "xato-parol"})
        assert r.status_code == 401
    r = await client.post("/api/v1/admin/auth/login", json={"email": u.email, "password": PASSWORD})
    assert r.status_code == 423  # even the correct password is blocked now
    assert r.headers["retry-after"] == "900"
    assert any("bloklandi" in a[0] for a in jobs("send_alert"))


async def test_first_login_2fa_setup_returns_backup_codes(client: AsyncClient) -> None:
    u, _ = await make_user(totp=False)
    r = await client.post("/api/v1/admin/auth/login", json={"email": u.email, "password": PASSWORD})
    assert r.json() == {"status": "2fa_setup_required"}
    setup = (await client.post("/api/v1/admin/auth/2fa/setup")).json()
    assert setup["otpauth_url"].startswith("otpauth://totp/")
    r = await client.post("/api/v1/admin/auth/2fa/verify", json={"code": pyotp.TOTP(setup["secret"]).now()})
    codes = r.json()["backup_codes"]
    assert len(codes) == 10 and len(set(codes)) == 10
    async with get_sessionmaker()() as s:
        row = await s.get(User, u.id)
        assert row is not None and row.totp_enabled
        assert row.totp_secret != setup["secret"]  # stored encrypted
    # backup code works once
    c2 = AsyncClient(transport=client._transport, base_url="http://test")
    await c2.post("/api/v1/admin/auth/login", json={"email": u.email, "password": PASSWORD})
    assert (await c2.post("/api/v1/admin/auth/2fa/verify", json={"backup_code": codes[0]})).status_code == 200
    await c2.post("/api/v1/admin/auth/login", json={"email": u.email, "password": PASSWORD})
    assert (await c2.post("/api/v1/admin/auth/2fa/verify", json={"backup_code": codes[0]})).status_code == 422
    await c2.aclose()


async def test_setup_not_allowed_when_2fa_enabled(client: AsyncClient) -> None:
    u, _ = await make_user()
    await client.post("/api/v1/admin/auth/login", json={"email": u.email, "password": PASSWORD})
    assert (await client.post("/api/v1/admin/auth/2fa/setup")).status_code == 403


async def test_refresh_rotation_and_reuse_revokes_all(client: AsyncClient) -> None:
    u, secret = await make_user()
    await login(client, u.email, secret)
    old = client.cookies.get("jx_refresh")
    r = await client.post("/api/v1/admin/auth/refresh")
    assert r.status_code == 200
    assert client.cookies.get("jx_refresh") != old
    # replay the old (already used) refresh token -> everything is revoked
    thief = AsyncClient(transport=client._transport, base_url="http://test", cookies={"jx_refresh": old or ""})
    assert (await thief.post("/api/v1/admin/auth/refresh")).status_code == 401
    await thief.aclose()
    assert (await client.post("/api/v1/admin/auth/refresh")).status_code == 401
    assert (await client.get("/api/v1/admin/auth/me")).status_code == 401  # access token family revoked too
    async with get_sessionmaker()() as s:
        live = (await s.scalars(select(RefreshToken).where(RefreshToken.revoked_at.is_(None)))).all()
        assert live == []


async def test_csrf_required_on_mutations(client: AsyncClient, owner: User) -> None:
    body = {"slug": "test", "title": "Test"}
    assert (await client.post("/api/v1/admin/categories", json=body)).json()["type"] == "csrf_failed"
    assert (await client.post("/api/v1/admin/categories", json=body,
                              headers={"X-CSRF-Token": "notogri"})).status_code == 403
    assert (await client.post("/api/v1/admin/categories", json=body, headers=csrf(client))).status_code == 201


async def test_logout_revokes_session(client: AsyncClient, owner: User) -> None:
    assert (await client.post("/api/v1/admin/auth/logout")).status_code == 204
    assert (await client.get("/api/v1/admin/auth/me")).status_code == 401


async def test_password_change_validates_and_revokes(client: AsyncClient, owner: User) -> None:
    r = await client.post("/api/v1/admin/auth/password", headers=csrf(client),
                          json={"current_password": PASSWORD, "new_password": "qisqa"})
    assert r.json()["errors"][0]["field"] == "new_password"
    r = await client.post("/api/v1/admin/auth/password", headers=csrf(client),
                          json={"current_password": PASSWORD, "new_password": "password1234"})
    assert "sizib" in r.json()["errors"][0]["msg"]  # HIBP check
    r = await client.post("/api/v1/admin/auth/password", headers=csrf(client),
                          json={"current_password": PASSWORD, "new_password": "yangi-uzun-parol-2026"})
    assert r.status_code == 204
    assert (await client.get("/api/v1/admin/auth/me")).status_code == 401


async def test_editor_forbidden_from_owner_endpoints(editor_client: AsyncClient) -> None:
    c = editor_client
    for path in ("/api/v1/admin/settings", "/api/v1/admin/users", "/api/v1/admin/audit-logs",
                 "/api/v1/admin/redirects", "/api/v1/admin/leads/export.csv"):
        assert (await c.get(path)).status_code == 403, path
    assert (await c.post("/api/v1/admin/site/rebuild", headers=csrf(c))).status_code == 403
    assert (await c.put("/api/v1/admin/settings", json={}, headers=csrf(c))).status_code == 403
    assert (await c.get("/api/v1/admin/dashboard")).status_code == 200
    assert (await c.get("/api/v1/admin/projects")).status_code == 200


async def test_audit_log_is_append_only(client: AsyncClient, owner: User) -> None:
    async with get_sessionmaker()() as s:
        n = await s.scalar(text("select count(*) from audit_logs"))
        assert n and n >= 1  # login recorded
        try:
            await s.execute(text("delete from audit_logs"))
            await s.commit()
            raise AssertionError("delete must fail")
        except Exception as e:
            assert "append-only" in str(e)
