"""A local run of the ZeroX server needs a mail server and a model server.

The script writes the mail configuration into the system settings, so the
platform sends its sign-in codes to the local catcher.

Run it with:

    python tools/configure_local_mail.py
"""

from __future__ import annotations

import asyncio
import json
import sys
from pathlib import Path

sys.path.insert(0, ".")

from sqlalchemy import select

from app.database import async_session
from app.models.system_settings import SystemSetting


KEY = "system_email_platform"
DEFAULT_CONFIG = {
    "SYSTEM_EMAIL_ENABLED": True,
    "SYSTEM_EMAIL_FROM_ADDRESS": "zerox@localhost",
    "SYSTEM_EMAIL_FROM_NAME": "ZeroX",
    "SYSTEM_SMTP_HOST": "127.0.0.1",
    "SYSTEM_SMTP_PORT": 1025,
    "SYSTEM_SMTP_USERNAME": "",
    "SYSTEM_SMTP_PASSWORD": "",
    "SYSTEM_SMTP_SSL": False,
    "SYSTEM_SMTP_TIMEOUT_SECONDS": 15,
}


async def configure(config: dict) -> dict:
    """Write the mail configuration into the system settings."""
    async with async_session() as db:
        setting = (
            await db.execute(select(SystemSetting).where(SystemSetting.key == KEY))
        ).scalar_one_or_none()
        if setting is None:
            setting = SystemSetting(key=KEY, value=config)
            db.add(setting)
        else:
            merged = dict(setting.value or {})
            merged.update(config)
            setting.value = merged
        await db.commit()
        return dict(setting.value)


async def main() -> None:
    path = Path(__file__).resolve().parents[2] / ".localdata" / "email_setting.json"
    config = dict(DEFAULT_CONFIG)
    if path.exists():
        config.update(json.loads(path.read_text(encoding="utf-8")))
    written = await configure(config)
    print(json.dumps(written, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    asyncio.run(main())
