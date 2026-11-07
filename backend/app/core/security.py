"""Passwords (argon2id), AES-GCM secrets, TOTP, access tokens, CSRF (TZ 8)."""

import base64
import hashlib
import hmac
import logging
import os
import secrets
import uuid
from datetime import UTC, datetime, timedelta
from typing import Any

import httpx
import jwt
import pyotp
from argon2 import PasswordHasher
from argon2.exceptions import InvalidHashError, VerificationError
from cryptography.hazmat.primitives.ciphers.aead import AESGCM

from app.core.config import get_settings

log = logging.getLogger("app.security")

# TZ 8: argon2id, time_cost=3, memory_cost=64 MB
_ph = PasswordHasher(time_cost=3, memory_cost=64 * 1024, parallelism=2)
MIN_PASSWORD_LEN = 12


def hash_password(password: str) -> str:
    return _ph.hash(password)


def verify_password(password_hash: str, password: str) -> bool:
    try:
        return _ph.verify(password_hash, password)
    except (VerificationError, InvalidHashError):
        return False


# Constant-time dummy verification so unknown emails cost the same as wrong passwords.
_DUMMY_HASH = _ph.hash(secrets.token_urlsafe(16))


def dummy_verify() -> None:
    verify_password(_DUMMY_HASH, "x")


async def password_is_pwned(password: str) -> bool:
    """HIBP k-anonymity range API. Fails open (returns False) if the service is unreachable."""
    if get_settings().env == "test":
        return password.lower() in {"password1234", "qwerty123456", "123456789012"}
    sha1 = hashlib.sha1(password.encode(), usedforsecurity=False).hexdigest().upper()
    prefix, suffix = sha1[:5], sha1[5:]
    try:
        async with httpx.AsyncClient(timeout=3) as client:
            r = await client.get(f"https://api.pwnedpasswords.com/range/{prefix}", headers={"Add-Padding": "true"})
            r.raise_for_status()
    except httpx.HTTPError:
        log.warning("hibp unavailable")
        return False
    return any(line.split(":")[0] == suffix and line.split(":")[1].strip() != "0" for line in r.text.splitlines())


async def validate_new_password(password: str) -> str | None:
    """Returns an Uzbek error message, or None if the password is acceptable."""
    if len(password) < MIN_PASSWORD_LEN:
        return f"Parol kamida {MIN_PASSWORD_LEN} belgidan iborat bo'lsin"
    if len(password) > 256:
        return "Parol juda uzun"
    if await password_is_pwned(password):
        return "Bu parol sizib chiqqan parollar ro'yxatida bor, boshqasini tanlang"
    return None


# ---- AES-GCM (TOTP secrets) -------------------------------------------------------------------


def _aes() -> AESGCM:
    key = base64.b64decode(get_settings().encryption_key.get_secret_value())
    if len(key) != 32:
        raise RuntimeError("ENCRYPTION_KEY must be base64 of 32 bytes")
    return AESGCM(key)


def encrypt(plaintext: str) -> str:
    nonce = os.urandom(12)
    ct = _aes().encrypt(nonce, plaintext.encode(), b"jamolxon")
    return base64.urlsafe_b64encode(nonce + ct).decode()


def decrypt(token: str) -> str:
    raw = base64.urlsafe_b64decode(token.encode())
    return _aes().decrypt(raw[:12], raw[12:], b"jamolxon").decode()


# ---- TOTP ---------------------------------------------------------------------------------------


def new_totp_secret() -> str:
    return pyotp.random_base32()


def totp_uri(secret: str, email: str) -> str:
    return pyotp.TOTP(secret).provisioning_uri(name=email, issuer_name="jamolxon.uz")


def verify_totp(secret: str, code: str) -> bool:
    code = code.strip().replace(" ", "")
    return code.isdigit() and len(code) == 6 and pyotp.TOTP(secret).verify(code, valid_window=1)


def new_backup_codes(n: int = 10) -> list[str]:
    alphabet = "abcdefghjkmnpqrstuvwxyz23456789"
    return ["".join(secrets.choice(alphabet) for _ in range(4)) + "-" + "".join(secrets.choice(alphabet) for _ in range(4))
            for _ in range(n)]


# ---- Tokens -------------------------------------------------------------------------------------


def create_access_token(user_id: uuid.UUID, role: str, session_family: uuid.UUID) -> str:
    s = get_settings()
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "role": role, "fam": str(session_family), "iat": now,
               "exp": now + timedelta(minutes=s.access_token_minutes), "typ": "access"}
    return jwt.encode(payload, s.jwt_key.get_secret_value(), algorithm="HS256")


def create_pre_auth_token(user_id: uuid.UUID) -> str:
    """Short-lived token between password check and 2FA."""
    s = get_settings()
    now = datetime.now(UTC)
    payload = {"sub": str(user_id), "iat": now, "exp": now + timedelta(minutes=5), "typ": "pre"}
    return jwt.encode(payload, s.jwt_key.get_secret_value(), algorithm="HS256")


def decode_token(token: str, typ: str) -> dict[str, Any] | None:
    try:
        data: dict[str, Any] = jwt.decode(token, get_settings().jwt_key.get_secret_value(), algorithms=["HS256"])
    except jwt.PyJWTError:
        return None
    return data if data.get("typ") == typ else None


def new_opaque_token() -> str:
    return secrets.token_urlsafe(48)


def sha256_hex(value: str) -> str:
    return hashlib.sha256(value.encode()).hexdigest()


def hash_ip(ip: str) -> str:
    salt = get_settings().ip_hash_salt.get_secret_value()
    return hmac.new(salt.encode(), ip.encode(), hashlib.sha256).hexdigest()


def csrf_token_for(session_family: uuid.UUID | str) -> str:
    """CSRF token bound to the login session (HMAC of its family id). The SPA reads it from the jx_csrf cookie
    and echoes it in X-CSRF-Token; a cookie planted by another subdomain cannot produce the right value."""
    return sign(f"csrf:{session_family}")


def csrf_valid(session_family: str | None, header_value: str | None) -> bool:
    if not session_family or not header_value:
        return False
    return hmac.compare_digest(csrf_token_for(session_family), header_value)


def sign(value: str) -> str:
    key = get_settings().secret_key.get_secret_value().encode()
    return hmac.new(key, value.encode(), hashlib.sha256).hexdigest()
