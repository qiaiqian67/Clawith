"""A live test of the ZeroX chat surface.

The script signs in with a one-time code, creates an agent that answers
through the stub model, opens the chat socket, sends a message, and prints
every packet the server sends.

It is the end-to-end proof that the client contract matches the server.
"""

from __future__ import annotations

import asyncio
import json
from pathlib import Path
import re
import sys

sys.path.insert(0, ".")

import httpx
import websockets

BASE = "http://127.0.0.1:8000"
API = f"{BASE}/api"


async def read_code(mail_dir: Path, before: int) -> str:
    """Wait for a new mail and return the sign-in code it carries."""
    for _ in range(40):
        files = sorted(mail_dir.glob("*.txt"))
        if len(files) > before:
            text = files[-1].read_text(encoding="utf-8")
            match = re.search(r"Sign-in code:\s*(\d{6})", text)
            if match:
                return match.group(1)
        await asyncio.sleep(0.25)
    raise RuntimeError("no sign-in code arrived")


async def main() -> None:
    local = Path("..") / ".localdata"
    facts = json.loads((local / "harness.json").read_text(encoding="utf-8-sig"))
    mail_dir = local / "mail"
    before = len(list(mail_dir.glob("*.txt")))

    async with httpx.AsyncClient(timeout=30) as client:
        # 1. The code.
        response = await client.post(f"{API}/auth/login/code", json={"email": facts["email"]})
        print("request code:", response.status_code, response.json())
        code = await read_code(mail_dir, before)
        print("code from mail:", code)

        # 2. The session.
        response = await client.post(
            f"{API}/auth/login/code/verify",
            json={"email": facts["email"], "code": code},
        )
        response.raise_for_status()
        token = response.json()["access_token"]
        headers = {"Authorization": f"Bearer {token}"}
        print("signed in")

        # 3. An agent that answers through the stub model.
        response = await client.get(f"{API}/agents/", headers=headers)
        agents = response.json()
        agent = next((item for item in agents if item.get("primary_model_id") == facts["model_id"]), None)
        if agent is None:
            response = await client.post(
                f"{API}/agents/",
                headers=headers,
                json={
                    "name": "Harness Agent",
                    "role_description": "A test agent that answers through the stub model.",
                    "primary_model_id": facts["model_id"],
                    "permission_scope_type": "company",
                    "permission_access_level": "manage",
                },
            )
            print("create agent:", response.status_code)
            response.raise_for_status()
            agent = response.json()
        agent_id = agent["id"]
        print("agent:", agent_id, agent["name"], agent["status"])

        # The agent starts on its own. The start endpoint waits for a
        # container, and a local run has no container, so the client does
        # not wait for it.
        print("agent status:", agent.get("status"))

        # 4. The session of the agent.
        response = await client.get(f"{API}/agents/{agent_id}/sessions", headers=headers)
        print("sessions:", response.status_code, response.text[:300])
        sessions = response.json()
        session_id = sessions[0]["id"] if sessions else None
        print("session:", session_id)

        # 5. The socket.
        url = f"ws://127.0.0.1:8000/ws/chat/{agent_id}?token={token}&lang=zh"
        if session_id:
            url += f"&session_id={session_id}"
        print("socket:", url.split("?")[0])
        received: list[dict] = []
        async with websockets.connect(url) as socket:
            first = await asyncio.wait_for(socket.recv(), timeout=20)
            print("<-", first)
            received.append(json.loads(first))

            await socket.send(json.dumps({"content": "Hello from the harness."}))
            print("-> content")

            try:
                while True:
                    raw = await asyncio.wait_for(socket.recv(), timeout=60)
                    packet = json.loads(raw)
                    received.append(packet)
                    summary = {
                        "type": packet.get("type"),
                        "content": (packet.get("content") or "")[:80],
                        "name": packet.get("name"),
                        "status": packet.get("status"),
                        "runtime_status": packet.get("runtime_status"),
                        "event_cursor": packet.get("event_cursor"),
                        "code": packet.get("code"),
                    }
                    print("<-", json.dumps(summary, ensure_ascii=False))
                    if packet.get("type") == "done":
                        break
            except asyncio.TimeoutError:
                print("!! no terminal packet within the timeout")

        # 6. The stored messages.
        if session_id:
            response = await client.get(
                f"{API}/agents/{agent_id}/sessions/{session_id}/messages?limit=20",
                headers=headers,
            )
            messages = response.json()
            print("messages:", response.status_code, "count", len(messages))
            for message in messages[-4:]:
                print(
                    "  ",
                    message.get("role"),
                    "|",
                    (message.get("content") or "")[:70].replace("\n", " "),
                )

        print("packet types:", [packet.get("type") for packet in received])


if __name__ == "__main__":
    asyncio.run(main())
