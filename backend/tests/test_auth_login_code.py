"""Unit tests for the passwordless sign-in code endpoints (app/api/auth.py).

The contract under test: a code authorizes an identity and nothing else. The
tenant choice stays in the sign-in response, a code signs in exactly once, an
unknown address fails the same way as a wrong code, and a disabled account
never gets a session.
"""

import uuid
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import AsyncMock, patch

import pytest
from fastapi import HTTPException

from app.api import auth as auth_api


def _make_identity(*, email="test@example.com", is_active=True):
    return SimpleNamespace(
        id=uuid.uuid4(),
        email=email,
        username="testuser",
        phone=None,
        password_hash="hash",
        is_active=is_active,
        email_verified=True,
        created_at=datetime.now(timezone.utc),
        updated_at=datetime.now(timezone.utc),
        is_platform_admin=False,
    )


def _make_user(identity_id, *, role="member", tenant_id=None):
    return SimpleNamespace(
        id=uuid.uuid4(),
        identity_id=identity_id,
        role=role,
        tenant_id=tenant_id or uuid.uuid4(),
        username="testuser",
        email="test@example.com",
        display_name="Test User",
        avatar_url=None,
        title=None,
        primary_mobile=None,
        registration_source=None,
        is_active=True,
        email_verified=True,
        created_at=datetime.now(timezone.utc),
        identity=_make_identity(),
    )


def _make_request(*, email="test@example.com", code="123456", tenant_id=None):
    return SimpleNamespace(email=email, code=code, tenant_id=tenant_id)


# ---------------------------------------------------------------------------
# Requesting a code
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_request_login_code_unknown_email_looks_the_same():
    """An unknown address gets the same answer as a known one."""
    with patch.object(auth_api.identity_dao, "get_by_email", new_callable=AsyncMock, return_value=None):
        with patch(
            "app.services.system_email_service.resolve_email_config_async",
            new_callable=AsyncMock,
            return_value={"host": "localhost"},
        ):
            result = await auth_api.request_login_code(
                SimpleNamespace(email="nobody@example.com", tenant_id=None),
                AsyncMock(),
            )
    assert result.ok is True
    assert "sent" in result.message.lower()


@pytest.mark.asyncio
async def test_request_login_code_known_email_sends_one_code():
    """A known address gets exactly one code, queued for delivery."""
    identity = _make_identity()
    bg = AsyncMock()

    with patch.object(auth_api.identity_dao, "get_by_email", new_callable=AsyncMock, return_value=identity):
        with patch(
            "app.services.system_email_service.resolve_email_config_async",
            new_callable=AsyncMock,
            return_value={"host": "localhost"},
        ):
            with patch(
                "app.services.login_code_service.LoginCodeService.create_login_code",
                new_callable=AsyncMock,
                return_value=("123456", datetime.now(timezone.utc) + timedelta(minutes=10)),
            ) as create_code:
                await auth_api.request_login_code(
                    SimpleNamespace(email=identity.email, tenant_id=None),
                    bg,
                )

    create_code.assert_awaited_once()
    bg.add_task.assert_called_once()


@pytest.mark.asyncio
async def test_request_login_code_without_mail_server_is_refused():
    """No mail server means no code, and the client is told so."""
    with patch(
        "app.services.system_email_service.resolve_email_config_async",
        new_callable=AsyncMock,
        return_value=None,
    ):
        with pytest.raises(HTTPException) as exc:
            await auth_api.request_login_code(
                SimpleNamespace(email="test@example.com", tenant_id=None),
                AsyncMock(),
            )
    assert exc.value.status_code == 400


# ---------------------------------------------------------------------------
# Redeeming a code
# ---------------------------------------------------------------------------


@pytest.mark.asyncio
async def test_verify_login_code_unknown_email_is_invalid():
    """An unknown address fails like a wrong code, without naming the address."""
    with patch.object(auth_api.identity_dao, "get_by_email", new_callable=AsyncMock, return_value=None):
        with pytest.raises(HTTPException) as exc:
            await auth_api.verify_login_code(_make_request(email="nobody@example.com"))
    assert exc.value.status_code == 400
    assert "invalid" in str(exc.value.detail).lower()


@pytest.mark.asyncio
async def test_verify_login_code_wrong_code_is_invalid():
    """A wrong code never issues a session."""
    identity = _make_identity()

    with patch.object(auth_api.identity_dao, "get_by_email", new_callable=AsyncMock, return_value=identity):
        with patch(
            "app.services.login_code_service.LoginCodeService.record_failed_attempt",
            new_callable=AsyncMock,
            return_value=1,
        ):
            with patch(
                "app.services.login_code_service.LoginCodeService.consume_login_code",
                new_callable=AsyncMock,
                return_value=None,
            ):
                with pytest.raises(HTTPException) as exc:
                    await auth_api.verify_login_code(_make_request(email=identity.email))
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_verify_login_code_consumed_for_another_identity_is_invalid():
    """A code only works for the identity it was issued to."""
    identity = _make_identity()
    other = _make_identity(email="other@example.com")

    with patch.object(auth_api.identity_dao, "get_by_email", new_callable=AsyncMock, return_value=identity):
        with patch(
            "app.services.login_code_service.LoginCodeService.record_failed_attempt",
            new_callable=AsyncMock,
            return_value=1,
        ):
            with patch(
                "app.services.login_code_service.LoginCodeService.consume_login_code",
                new_callable=AsyncMock,
                return_value={"identity_id": other.id, "email": other.email},
            ):
                with pytest.raises(HTTPException) as exc:
                    await auth_api.verify_login_code(_make_request(email=identity.email))
    assert exc.value.status_code == 400


@pytest.mark.asyncio
async def test_verify_login_code_disabled_account_is_refused():
    """A disabled account never gets a session, even with a valid code."""
    identity = _make_identity(is_active=False)

    with patch.object(auth_api.identity_dao, "get_by_email", new_callable=AsyncMock, return_value=identity):
        with patch(
            "app.services.login_code_service.LoginCodeService.record_failed_attempt",
            new_callable=AsyncMock,
            return_value=1,
        ):
            with patch(
                "app.services.login_code_service.LoginCodeService.consume_login_code",
                new_callable=AsyncMock,
                return_value={"identity_id": identity.id, "email": identity.email},
            ):
                with patch(
                    "app.services.login_code_service.LoginCodeService.clear_failed_attempts",
                    new_callable=AsyncMock,
                ):
                    with pytest.raises(HTTPException) as exc:
                        await auth_api.verify_login_code(_make_request(email=identity.email))
    assert exc.value.status_code == 403


@pytest.mark.asyncio
async def test_verify_login_code_too_many_attempts_is_refused():
    """A code that is guessed too often is refused before it is consumed."""
    identity = _make_identity()

    with patch.object(auth_api.identity_dao, "get_by_email", new_callable=AsyncMock, return_value=identity):
        with patch(
            "app.services.login_code_service.LoginCodeService.record_failed_attempt",
            new_callable=AsyncMock,
            return_value=99,
        ):
            with pytest.raises(HTTPException) as exc:
                await auth_api.verify_login_code(_make_request(email=identity.email))
    assert exc.value.status_code == 429


@pytest.mark.asyncio
async def test_verify_login_code_single_tenant_issues_token():
    """One organization means one session, with no tenant question."""
    identity = _make_identity()
    user = _make_user(identity.id)

    with patch.object(auth_api.identity_dao, "get_by_email", new_callable=AsyncMock, return_value=identity):
        with patch(
            "app.services.login_code_service.LoginCodeService.record_failed_attempt",
            new_callable=AsyncMock,
            return_value=1,
        ):
            with patch(
                "app.services.login_code_service.LoginCodeService.consume_login_code",
                new_callable=AsyncMock,
                return_value={"identity_id": identity.id, "email": identity.email},
            ):
                with patch(
                    "app.services.login_code_service.LoginCodeService.clear_failed_attempts",
                    new_callable=AsyncMock,
                ) as clear_attempts:
                    with patch.object(
                        auth_api.user_dao,
                        "get_login_users_with_tenants",
                        new_callable=AsyncMock,
                        return_value=[(user, None)],
                    ):
                        result = await auth_api.verify_login_code(
                            _make_request(email=identity.email)
                        )

    clear_attempts.assert_awaited_once()
    assert result.access_token
    assert result.user.id == user.id


@pytest.mark.asyncio
async def test_verify_login_code_multiple_tenants_asks_for_a_choice():
    """Several organizations mean the client must choose, not the code."""
    identity = _make_identity()
    first = _make_user(identity.id)
    second = _make_user(identity.id)
    tenant_a = SimpleNamespace(name="Alpha", slug="alpha", logo_url=None)
    tenant_b = SimpleNamespace(name="Beta", slug="beta", logo_url=None)

    with patch.object(auth_api.identity_dao, "get_by_email", new_callable=AsyncMock, return_value=identity):
        with patch(
            "app.services.login_code_service.LoginCodeService.record_failed_attempt",
            new_callable=AsyncMock,
            return_value=1,
        ):
            with patch(
                "app.services.login_code_service.LoginCodeService.consume_login_code",
                new_callable=AsyncMock,
                return_value={"identity_id": identity.id, "email": identity.email},
            ):
                with patch(
                    "app.services.login_code_service.LoginCodeService.clear_failed_attempts",
                    new_callable=AsyncMock,
                ):
                    with patch.object(
                        auth_api.user_dao,
                        "get_login_users_with_tenants",
                        new_callable=AsyncMock,
                        return_value=[(first, tenant_a), (second, tenant_b)],
                    ):
                        result = await auth_api.verify_login_code(
                            _make_request(email=identity.email)
                        )

    assert result.requires_tenant_selection is True
    assert [choice.tenant_name for choice in result.tenants] == ["Alpha", "Beta"]
