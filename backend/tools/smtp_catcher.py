"""A local SMTP server that keeps the mail it receives.

The server accepts every message and writes it to a file, so a local run can
read the sign-in code that the platform sent.

Run it with:

    python tools/smtp_catcher.py --port 1025 --out ../.localdata/mail
"""

from __future__ import annotations

import argparse
import asyncio
from email import message_from_bytes, policy
from email.utils import parseaddr
from pathlib import Path


class Handler:
    """One SMTP session."""

    def __init__(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter, out: Path):
        self.reader = reader
        self.writer = writer
        self.out = out
        self.mail_from = ""
        self.rcpt_to: list[str] = []

    async def run(self) -> None:
        await self.send(220, "zerox-local-smtp")
        while True:
            line = await self.reader.readline()
            if not line:
                return
            command = line.decode("utf-8", errors="replace").strip()
            upper = command.upper()
            if upper.startswith("EHLO") or upper.startswith("HELO"):
                await self.send(250, "zerox-local-smtp")
            elif upper.startswith("MAIL FROM"):
                self.mail_from = command.partition(":")[2].strip()
                await self.send(250, "ok")
            elif upper.startswith("RCPT TO"):
                self.rcpt_to.append(command.partition(":")[2].strip())
                await self.send(250, "ok")
            elif upper.startswith("DATA"):
                await self.send(354, "end with .")
                chunks: list[bytes] = []
                while True:
                    data = await self.reader.readline()
                    if not data or data.strip() == b".":
                        break
                    chunks.append(data)
                self.save(b"".join(chunks))
                await self.send(250, "ok")
            elif upper == "QUIT":
                await self.send(221, "bye")
                return
            elif upper == "RSET":
                self.mail_from = ""
                self.rcpt_to.clear()
                await self.send(250, "ok")
            else:
                await self.send(250, "ok")

    async def send(self, code: int, text: str) -> None:
        self.writer.write(f"{code} {text}\r\n".encode("utf-8"))
        await self.writer.drain()

    def save(self, raw: bytes) -> None:
        message = message_from_bytes(raw, policy=policy.default)
        subject = message.get("Subject", "")
        body = message.get_body(preferencelist=("plain", "html"))
        text = body.get_content() if body else ""
        self.out.mkdir(parents=True, exist_ok=True)
        name = f"{len(list(self.out.glob('*.eml'))):04d}.eml"
        (self.out / name).write_bytes(raw)
        (self.out / f"{name}.txt").write_text(
            f"From: {self.mail_from}\nTo: {', '.join(self.rcpt_to)}\n"
            f"Subject: {subject}\n\n{text}\n",
            encoding="utf-8",
        )
        print(f"mail saved: {subject} -> {', '.join(self.rcpt_to)}", flush=True)


async def main(port: int, out: Path) -> None:
    async def client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        handler = Handler(reader, writer, out)
        try:
            await handler.run()
        except (ConnectionResetError, asyncio.IncompleteReadError):
            return
        finally:
            writer.close()

    server = await asyncio.start_server(client, "127.0.0.1", port)
    print(f"smtp catcher on 127.0.0.1:{port}, mail in {out}", flush=True)
    async with server:
        await server.serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="A local SMTP catcher.")
    parser.add_argument("--port", type=int, default=1025)
    parser.add_argument("--out", default="../.localdata/mail")
    arguments = parser.parse_args()
    asyncio.run(main(arguments.port, Path(arguments.out)))
