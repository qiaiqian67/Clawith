"""Run the LangGraph checkpoint setup on a platform that needs it.

Windows cannot run psycopg in asynchronous mode on the default event loop, so
the setup runs on a selector loop there. The platform check is the only
difference: the setup itself is the same everywhere.
"""

from __future__ import annotations

import asyncio
import sys


def main() -> None:
    from app.scripts.setup_langgraph_checkpoints import setup_checkpoint_tables

    if sys.platform == "win32":
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(setup_checkpoint_tables())


if __name__ == "__main__":
    main()
