"""Create (or reset) the owner account. 2FA is set up on first login.

Usage: uv run python -m scripts.create_owner --email you@example.com
The password is read interactively (or from OWNER_PASSWORD env) — never pass it on the command line.
"""

import argparse
import asyncio
import getpass
import os

from sqlalchemy import select

from app.core.db import dispose_engine, get_sessionmaker
from app.core.security import hash_password, validate_new_password
from app.models import User


async def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--email", required=True)
    ap.add_argument("--name", default="Jamolxon")
    ap.add_argument("--reset-2fa", action="store_true")
    args = ap.parse_args()
    password = os.environ.get("OWNER_PASSWORD") or getpass.getpass("Parol (kamida 12 belgi): ")
    err = await validate_new_password(password)
    if err:
        raise SystemExit(err)
    async with get_sessionmaker()() as session:
        user = await session.scalar(select(User).where(User.email == args.email.lower()))
        if user is None:
            user = User(email=args.email.lower(), name=args.name, role="owner", password_hash="")
            session.add(user)
        user.password_hash = hash_password(password)
        user.role = "owner"
        user.is_active = True
        if args.reset_2fa:
            user.totp_enabled = False
            user.totp_secret = None
            user.backup_codes = []
        await session.commit()
    await dispose_engine()
    print(f"owner tayyor: {args.email.lower()} — birinchi kirishda 2FA sozlanadi")


if __name__ == "__main__":
    asyncio.run(main())
