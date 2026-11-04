"""Login code lifecycle for passwordless sign-in.

A login code is a short-lived, single-use, six-digit code sent to the email
address of a known identity. It authorizes exactly one sign-in and nothing
else: the code authorizes the *identity*, never a tenant, so the tenant choice
stays where it belongs, in the sign-in response.

The code is stored in Redis by hash. The raw code never leaves the server
except in the email.
"""

from __future__ import annotations

import hashlib
import json
import secrets
import uuid
from datetime import datetime, timedelta, timezone

from app.config import get_settings
from app.core.events import get_redis

# Redis key prefixes. One namespace per concern so a code never collides with
# an email-verification or password-reset token.
TOKEN_PREFIX = "login_code:token:"
IDENTITY_PREFIX = "login_code:identity:"
ATTEMPT_PREFIX = "login_code:attempt:"

CODE_LENGTH = 6
CODE_ALPHABET = "0123456789"


def _hash_code(code: str) -> str:
    """Hash a raw code before persistence or lookup."""
    return hashlib.sha256(code.encode("utf-8")).hexdigest()


def _normalize_email(email: str) -> str:
    return (email or "").strip().lower()


class LoginCodeService:
    """Create, deliver and consume one-time login codes."""

    async def create_login_code(self, identity_id: uuid.UUID, email: str) -> tuple[str, datetime]:
        """Create a fresh login code and store it under the identity.

        The previous unused code of the same identity is dropped, so only the
        newest email can sign in.
        """
        redis = await get_redis()
        identity_key = f"{IDENTITY_PREFIX}{identity_id}"

        old_code_hash = await redis.get(identity_key)
        if old_code_hash:
            await redis.delete(f"{TOKEN_PREFIX}{old_code_hash}")

        raw_code = "".join(secrets.choice(CODE_ALPHABET) for _ in range(CODE_LENGTH))
        code_hash = _hash_code(raw_code)

        now = datetime.now(timezone.utc)
        expiry_minutes = get_settings().LOGIN_CODE_EXPIRE_MINUTES
        expires_at = now + timedelta(minutes=expiry_minutes)
        ttl_seconds = int(expiry_minutes * 60)

        token_data = json.dumps({"identity_id": str(identity_id), "email": email})

        async with redis.pipeline(transaction=True) as pipe:
            pipe.setex(f"{TOKEN_PREFIX}{code_hash}", ttl_seconds, token_data)
            pipe.setex(identity_key, ttl_seconds, code_hash)
            pipe.delete(f"{ATTEMPT_PREFIX}{identity_key}")
            await pipe.execute()

        return raw_code, expires_at

    async def consume_login_code(self, raw_code: str) -> dict | None:
        """Consume a valid code and return its identity, or None.

        The delete is atomic with the read, so a code signs in exactly once
        even when two requests race.
        """
        redis = await get_redis()
        code_hash = _hash_code((raw_code or "").strip())
        token_key = f"{TOKEN_PREFIX}{code_hash}"

        token_data_str = await redis.get(token_key)
        if not token_data_str:
            return None

        try:
            token_data = json.loads(token_data_str)
            identity_id = uuid.UUID(token_data["identity_id"])
            email = token_data["email"]
        except (json.JSONDecodeError, KeyError, ValueError):
            return None

        identity_key = f"{IDENTITY_PREFIX}{identity_id}"
        async with redis.pipeline(transaction=True) as pipe:
            pipe.delete(token_key)
            pipe.delete(identity_key)
            await pipe.execute()

        return {"identity_id": identity_id, "email": email}

    async def record_failed_attempt(self, identity_id: uuid.UUID) -> int:
        """Count a failed code attempt and return the new count.

        The counter lives next to the identity so it expires with the code.
        """
        redis = await get_redis()
        key = f"{ATTEMPT_PREFIX}{IDENTITY_PREFIX}{identity_id}"
        count = await redis.incr(key)
        if count == 1:
            await redis.expire(key, get_settings().LOGIN_CODE_EXPIRE_MINUTES * 60)
        return int(count)

    async def clear_failed_attempts(self, identity_id: uuid.UUID) -> None:
        """Drop the attempt counter after a successful sign-in."""
        redis = await get_redis()
        await redis.delete(f"{ATTEMPT_PREFIX}{IDENTITY_PREFIX}{identity_id}")

    async def send_login_code_email(
        self,
        to: str,
        display_name: str,
        code: str,
        expiry_minutes: int,
    ) -> None:
        """Send the login code using the configured template."""
        from app.services.system_email_service import send_system_email, render_email_template

        variables = {
            "display_name": display_name,
            "login_code": code,
            "expiry_minutes": str(expiry_minutes),
        }
        subject, body = await render_email_template("login_code", variables)
        await send_system_email(to, subject, body)


# Global Instance
login_code_service = LoginCodeService()
