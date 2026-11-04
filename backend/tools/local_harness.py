"""A local test harness for the ZeroX server.

The harness stands up the pieces a real sign-in needs, without a real mail
server and without a real model:

- a tenant, an identity, and a user,
- an LLM model that points at a local stub,
- the login code of that identity, taken straight from the store.

It prints the facts the client needs, so a test can sign in without reading
the database by hand.
"""

from __future__ import annotations

import asyncio
import json
import os
import sys
from typing import Any

sys.path.insert(0, ".")

from sqlalchemy import select

from app.core.security import create_access_token, encrypt_data, hash_password
from app.database import async_session
from app.models.llm import LLMModel
from app.models.tenant import Tenant
from app.models.user import Identity, User
from app.services.login_code_service import login_code_service


TEST_EMAIL = "harness@example.com"
TEST_PASSWORD = "harness-password-123"
TEST_TENANT_SLUG = "harness"
STUB_MODEL_BASE_URL = "http://127.0.0.1:8099/v1"


async def _ensure_tenant(db) -> Tenant:
    tenant = (
        await db.execute(select(Tenant).where(Tenant.slug == TEST_TENANT_SLUG))
    ).scalar_one_or_none()
    if tenant is not None:
        return tenant
    tenant = Tenant(name="Harness", slug=TEST_TENANT_SLUG, im_provider="web_only")
    db.add(tenant)
    await db.flush()
    return tenant


async def _ensure_identity(db) -> Identity:
    identity = (
        await db.execute(select(Identity).where(Identity.email == TEST_EMAIL))
    ).scalar_one_or_none()
    if identity is not None:
        return identity
    # The username is unique too, so the harness takes the next free one.
    username = "harness"
    for attempt in range(50):
        taken = (
            await db.execute(select(Identity).where(Identity.username == username))
        ).scalar_one_or_none()
        if taken is None:
            break
        username = f"harness-{attempt}"
    identity = Identity(
        email=TEST_EMAIL,
        username=username,
        password_hash=hash_password(TEST_PASSWORD),
        is_active=True,
        email_verified=True,
    )
    db.add(identity)
    await db.flush()
    return identity


async def _ensure_user(db, identity: Identity, tenant: Tenant) -> User:
    user = (
        await db.execute(
            select(User).where(
                User.identity_id == identity.id,
                User.tenant_id == tenant.id,
            )
        )
    ).scalar_one_or_none()
    if user is not None:
        return user
    user = User(
        identity_id=identity.id,
        tenant_id=tenant.id,
        display_name="Harness User",
        role="member",
        is_active=True,
    )
    db.add(user)
    await db.flush()
    return user


async def _ensure_model(db, tenant: Tenant) -> LLMModel:
    model = (
        await db.execute(
            select(LLMModel).where(
                LLMModel.tenant_id == tenant.id,
                LLMModel.model == "harness-stub",
            )
        )
    ).scalar_one_or_none()
    if model is not None:
        # The address of the stub server changes when it moves, so the record
        # follows it.
        model.base_url = STUB_MODEL_BASE_URL
        await db.flush()
        return model
    model = LLMModel(
        tenant_id=tenant.id,
        provider="custom",
        model="harness-stub",
        api_key_encrypted=encrypt_data(
            "harness-key",
            os.environ.get("SECRET_KEY", "change-me-in-production"),
        ),
        base_url=STUB_MODEL_BASE_URL,
        label="Harness stub",
        enabled=True,
        supports_tool_calling=True,
        supports_vision=True,
    )
    db.add(model)
    await db.flush()
    return model


async def _ensure_agent(db, tenant: Tenant, user: User, model: LLMModel):
    """The agent of the harness.

    A native agent answers through the platform, so it needs a model and a
    status the Runtime accepts. Its status is `idle`, because a local run has
    no container to run.
    """
    from app.models.agent import Agent

    agent = (
        await db.execute(
            select(Agent).where(
                Agent.tenant_id == tenant.id,
                Agent.creator_id == user.id,
                Agent.name == "Harness Agent",
                Agent.deleted_at.is_(None),
            )
        )
    ).scalar_one_or_none()
    if agent is not None:
        agent.status = "idle"
        agent.primary_model_id = model.id
        agent.is_expired = False
        await db.flush()
        return agent

    agent = Agent(
        name="Harness Agent",
        role_description="A test agent that answers through the stub model.",
        creator_id=user.id,
        tenant_id=tenant.id,
        agent_type="native",
        status="idle",
        primary_model_id=model.id,
        access_mode="company",
    )
    db.add(agent)
    await db.flush()
    return agent


async def build() -> dict[str, Any]:
    """Create the harness facts and return them."""
    async with async_session() as db:
        tenant = await _ensure_tenant(db)
        identity = await _ensure_identity(db)
        user = await _ensure_user(db, identity, tenant)
        model = await _ensure_model(db, tenant)
        agent = await _ensure_agent(db, tenant, user, model)
        await db.commit()
        tenant_id = tenant.id
        user_id = user.id
        model_id = model.id
        agent_id = agent.id

    # A code for the identity, taken from the store the login path reads.
    code, expires_at = await login_code_service.create_login_code(identity.id, identity.email)

    token = create_access_token(str(user_id), "member", tenant_id=str(tenant_id))

    return {
        "email": TEST_EMAIL,
        "password": TEST_PASSWORD,
        "code": code,
        "code_expires_at": expires_at.isoformat(),
        "tenant_id": str(tenant_id),
        "user_id": str(user_id),
        "model_id": str(model_id),
        "agent_id": str(agent_id),
        "access_token": token,
        "stub_model_base_url": STUB_MODEL_BASE_URL,
    }


async def main() -> None:
    facts = await build()
    print(json.dumps(facts, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    asyncio.run(main())
