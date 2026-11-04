"""Start the ZeroX server for a local run.

Windows cannot run psycopg in asynchronous mode on the default event loop, so
the local run asks uvicorn for the selector loop there. The server itself is
the same everywhere.
"""

from __future__ import annotations

import argparse
import asyncio
import os
import sys


def _windows_loop():
    """The selector loop, which psycopg needs on Windows."""
    import selectors

    return asyncio.SelectorEventLoop(selectors.SelectSelector())


def main() -> None:
    parser = argparse.ArgumentParser(description="Start the ZeroX server locally.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true")
    args = parser.parse_args()

    os.environ.setdefault("PYTHONIOENCODING", "utf-8")

    import uvicorn

    loop = "asyncio"
    if sys.platform == "win32":
        loop = _windows_loop

    if args.reload:
        uvicorn.run(
            "app.main:app",
            host=args.host,
            port=args.port,
            reload=True,
            loop=loop,
        )
        return
    uvicorn.run(
        "app.main:app",
        host=args.host,
        port=args.port,
        loop=loop,
    )


if __name__ == "__main__":
    sys.exit(main())
