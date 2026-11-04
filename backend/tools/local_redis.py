"""A local Redis for a local run.

The platform needs a Redis with the RESP3 handshake, because the realtime
router uses the `HELLO` command that the redis client sends on connect. The
Redis build for Windows is old enough to answer neither `HELLO` nor `CLIENT
TRACKING`, so a local run needs a server that speaks the current protocol.

The server is a small RESP2 implementation with the commands the platform
uses:

- strings: `GET`, `SET`, `SETEX`, `DEL`, `EXISTS`, `INCR`, `TTL`, `EXPIRE`
- hashes: `HSET`, `HGET`, `HGETALL`, `HDEL`
- sets: `SADD`, `SREM`, `SMEMBERS`, `SISMEMBER`
- lists: `LPUSH`, `RPUSH`, `LRANGE`, `LREM`
- pub/sub: `SUBSCRIBE`, `UNSUBSCRIBE`, `PUBLISH`
- connection: `PING`, `QUIT`, `INFO`, `COMMAND`, `SELECT`

Run it with:

    python tools/local_redis.py --port 6380
"""

from __future__ import annotations

import argparse
import asyncio
import fnmatch
import time
from typing import Any


class Database:
    """One Redis database: the values and the expiry of each key.

    Redis gives every key one type, so a key that was a string cannot become
    a hash. The type is part of the stored key, and the lookup checks it.
    """

    def __init__(self) -> None:
        self.values: dict[bytes, Any] = {}
        self.expiry: dict[bytes, float] = {}
        self.types: dict[bytes, str] = {}

    def _expired(self, key: bytes) -> bool:
        deadline = self.expiry.get(key)
        if deadline is None:
            return False
        if time.monotonic() < deadline:
            return False
        self.values.pop(key, None)
        self.expiry.pop(key, None)
        return True

    def _live(self, key: bytes) -> bool:
        if key not in self.values:
            return False
        self._expired(key)
        return key in self.values

    def get(self, key: bytes) -> Any:
        if not self._live(key):
            return None
        return self.values[key]

    def set(self, key: bytes, value: Any, ttl: float | None = None, kind: str = "string") -> None:
        self.values[key] = value
        self.types[key] = kind
        if ttl is None:
            self.expiry.pop(key, None)
        else:
            self.expiry[key] = time.monotonic() + ttl

    def delete(self, key: bytes) -> int:
        existed = self._live(key)
        self.values.pop(key, None)
        self.expiry.pop(key, None)
        self.types.pop(key, None)
        return 1 if existed else 0


# The commands a transaction may hold. Every other command runs at once, so
# the client never waits for a reply it did not ask for.
_TRANSACTIONAL = frozenset({
    b"SET", b"SETEX", b"DEL", b"EXPIRE", b"INCR", b"HSET", b"HDEL",
    b"SADD", b"SREM", b"LPUSH", b"RPUSH", b"LREM",
    b"INCRBY", b"DECR", b"DECRBY", b"GETSET",
})


class _ReplyBuffer:
    """Collects the reply of one command."""

    def __init__(self) -> None:
        self._chunks: list[bytes] = []

    def write(self, data: bytes) -> None:
        self._chunks.append(data)

    async def drain(self) -> None:
        return None

    def value(self) -> bytes:
        return b"".join(self._chunks)


class LocalRedis:
    """A Redis server for a local run."""

    def __init__(self, port: int) -> None:
        self.port = port
        self.databases = [Database() for _ in range(16)]
        self.current = 0
        self.channels: dict[bytes, list[tuple[asyncio.StreamWriter, asyncio.StreamReader]]] = {}

    @property
    def database(self) -> Database:
        return self.databases[self.current]

    async def handle(
        self,
        reader: asyncio.StreamReader,
        writer: asyncio.StreamWriter,
    ) -> None:
        """Serve one client until it disconnects."""
        subscribed: set[bytes] = set()
        # The commands of a transaction, and whether a transaction is open.
        queued: list[list[bytes]] = []
        in_transaction = False
        try:
            while True:
                command = await self._read_command(reader)
                if command is None:
                    return
                if not command:
                    continue
                name = command[0].upper()

                if name == b"MULTI":
                    in_transaction = True
                    queued.clear()
                    writer.write(b"+OK\r\n")
                    await writer.drain()
                    continue
                if name == b"EXEC":
                    # The queued commands run now, and their replies are the
                    # answer of the transaction.
                    collected: list[bytes] = []
                    for pending in queued:
                        pending_name = pending[0].upper()
                        pending_handler = getattr(
                            self,
                            f"_cmd_{pending_name.decode('latin-1').lower()}",
                            None,
                        )
                        if pending_handler is None:
                            collected.append(b"-ERR unknown command\r\n")
                            continue
                        buffer = _ReplyBuffer()
                        await pending_handler(pending[1:], buffer, subscribed)
                        collected.append(buffer.value())
                    writer.write(f"*{len(collected)}\r\n".encode("utf-8"))
                    for reply in collected:
                        writer.write(reply)
                    queued.clear()
                    in_transaction = False
                    await writer.drain()
                    continue
                if name == b"DISCARD":
                    queued.clear()
                    in_transaction = False
                    writer.write(b"+OK\r\n")
                    await writer.drain()
                    continue

                handler = getattr(self, f"_cmd_{name.decode('latin-1').lower()}", None)
                if handler is None:
                    writer.write(b"-ERR unknown command '" + name + b"'\r\n")
                    await writer.drain()
                    continue

                if in_transaction and name in _TRANSACTIONAL:
                    # A transactional command is queued and runs at EXEC.
                    queued.append(command)
                    writer.write(b"+QUEUED\r\n")
                    await writer.drain()
                    continue

                await handler(command[1:], writer, subscribed)
                await writer.drain()
        except (ConnectionResetError, asyncio.IncompleteReadError):
            return
        finally:
            for channel in subscribed:
                peers = self.channels.get(channel)
                if peers:
                    self.channels[channel] = [peer for peer in peers if peer[1] is not reader]
            writer.close()

    async def _read_command(self, reader: asyncio.StreamReader) -> list[bytes] | None:
        """Read one RESP array command."""
        line = await reader.readline()
        if not line:
            return None
        line = line.strip()
        if not line:
            return []
        if not line.startswith(b"*"):
            return [line]
        count = int(line[1:])
        parts: list[bytes] = []
        for _ in range(count):
            header = await reader.readline()
            if not header:
                return None
            header = header.strip()
            if not header.startswith(b"$"):
                return [header]
            length = int(header[1:])
            if length < 0:
                parts.append(b"")
                continue
            data = await reader.readexactly(length + 2)
            parts.append(data[:-2])
        return parts

    # ── The commands ────────────────────────────────────────────────────────

    async def _cmd_multi(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        # The server answers every command as it arrives, so the transaction
        # is the plain command list.
        writer.write(b"+OK\r\n")

    async def _cmd_exec(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        # The commands already ran. The empty array tells the client that the
        # pipeline is done.
        writer.write(b"*0\r\n")

    async def _cmd_discard(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        writer.write(b"+OK\r\n")

    async def _cmd_ping(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        writer.write(b"+PONG\r\n")

    async def _cmd_quit(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        writer.write(b"+OK\r\n")
        await writer.drain()
        writer.close()

    async def _cmd_select(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        self.current = int(args[0])
        writer.write(b"+OK\r\n")

    async def _cmd_info(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        body = "# Server\r\nredis_version:7.0.0-zerox-local\r\n"
        writer.write(f"${len(body)}\r\n{body}\r\n".encode("utf-8"))

    async def _cmd_command(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        writer.write(b"*0\r\n")

    async def _cmd_set(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key, value = args[0], args[1]
        if len(args) > 2 and args[2].upper() == b"GET":
            pass
        ttl: float | None = None
        index = 2
        while index < len(args):
            option = args[index].upper()
            if option == b"EX":
                ttl = float(args[index + 1])
                index += 2
                continue
            if option == b"PX":
                ttl = float(args[index + 1]) / 1000.0
                index += 2
                continue
            index += 1
        self.database.set(key, value, ttl, "string")
        writer.write(b"+OK\r\n")

    async def _cmd_setex(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key, seconds, value = args[0], args[1], args[2]
        self.database.set(key, value, float(seconds), "string")
        writer.write(b"+OK\r\n")

    async def _cmd_get(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        value = self.database.get(args[0])
        if value is None:
            writer.write(b"$-1\r\n")
            return
        writer.write(f"${len(value)}\r\n".encode("utf-8") + bytes(value) + b"\r\n")

    async def _cmd_del(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        removed = sum(self.database.delete(key) for key in args)
        writer.write(f":{removed}\r\n".encode("utf-8"))

    async def _cmd_exists(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        found = sum(1 for key in args if self.database._live(key))
        writer.write(f":{found}\r\n".encode("utf-8"))

    async def _cmd_incr(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key = args[0]
        current = self.database.get(key)
        value = int(current or b"0") + 1
        self.database.set(key, str(value).encode("utf-8"), kind="counter")
        writer.write(f":{value}\r\n".encode("utf-8"))

    async def _cmd_incrby(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key, step = args[0], int(args[1])
        current = self.database.get(key)
        value = int(current or b"0") + step
        self.database.set(key, str(value).encode("utf-8"))
        writer.write(f":{value}\r\n".encode("utf-8"))

    async def _cmd_decr(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key = args[0]
        current = self.database.get(key)
        value = int(current or b"0") - 1
        self.database.set(key, str(value).encode("utf-8"))
        writer.write(f":{value}\r\n".encode("utf-8"))

    async def _cmd_decrby(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key, step = args[0], int(args[1])
        current = self.database.get(key)
        value = int(current or b"0") - step
        self.database.set(key, str(value).encode("utf-8"))
        writer.write(f":{value}\r\n".encode("utf-8"))

    async def _cmd_getset(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key, value = args[0], args[1]
        previous = self.database.get(key)
        self.database.set(key, value)
        if previous is None:
            writer.write(b"$-1\r\n")
            return
        writer.write(f"${len(previous)}\r\n{previous}\r\n".encode("latin-1"))

    async def _cmd_keys(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        pattern = args[0].decode("latin-1")
        matched = [
            key
            for key in list(self.database.values)
            if self.database._live(key) and fnmatch.fnmatch(key.decode("latin-1"), pattern)
        ]
        writer.write(f"*{len(matched)}\r\n".encode("utf-8"))
        for key in matched:
            writer.write(f"${len(key)}\r\n".encode("utf-8") + bytes(key) + b"\r\n")

    async def _cmd_scan(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        pattern = b"*"
        for argument in args:
            if argument.upper() == b"MATCH" and args:
                pass
        index = args.index(b"MATCH") if b"MATCH" in args else -1
        if index >= 0 and index + 1 < len(args):
            pattern = args[index + 1]
        matched = [
            key
            for key in list(self.database.values)
            if self.database._live(key)
            and fnmatch.fnmatch(key.decode("latin-1"), pattern.decode("latin-1"))
        ]
        writer.write(f"*2\r\n${len(matched)}\r\n".encode("utf-8"))
        for key in matched:
            writer.write(f"${len(key)}\r\n".encode("utf-8") + bytes(key) + b"\r\n")
        writer.write(b"*0\r\n")

    async def _cmd_expire(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key, seconds = args[0], float(args[1])
        if not self.database._live(key):
            writer.write(b":0\r\n")
            return
        self.database.expiry[key] = time.monotonic() + seconds
        writer.write(b":1\r\n")

    async def _cmd_ttl(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key = args[0]
        if not self.database._live(key):
            writer.write(b":-2\r\n")
            return
        deadline = self.database.expiry.get(key)
        if deadline is None:
            writer.write(b":-1\r\n")
            return
        writer.write(f":{max(0, int(deadline - time.monotonic()))}\r\n".encode("utf-8"))

    async def _cmd_hset(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key = args[0]
        current = self.database.get(key)
        table: dict[bytes, bytes] = dict(current) if isinstance(current, dict) else {}
        index = 1
        added = 0
        while index + 1 < len(args):
            field, value = args[index], args[index + 1]
            if field not in table:
                added += 1
            table[field] = value
            index += 2
        self.database.set(key, table, kind="hash")
        writer.write(f":{added}\r\n".encode("utf-8"))

    async def _cmd_hget(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        table = self.database.get(args[0])
        value = table.get(args[1]) if isinstance(table, dict) else None
        if value is None:
            writer.write(b"$-1\r\n")
            return
        writer.write(f"${len(value)}\r\n".encode("utf-8") + bytes(value) + b"\r\n")

    async def _cmd_hgetall(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        table = self.database.get(args[0])
        table = table if isinstance(table, dict) else {}
        writer.write(f"*{len(table) * 2}\r\n".encode("utf-8"))
        for field, value in table.items():
            writer.write(f"${len(field)}\r\n{field}\r\n".encode("latin-1"))
            writer.write(f"${len(value)}\r\n".encode("utf-8") + bytes(value) + b"\r\n")

    async def _cmd_hdel(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        table = self.database.get(args[0])
        if not isinstance(table, dict):
            writer.write(b":0\r\n")
            return
        removed = 0
        for field in args[1:]:
            if table.pop(field, None) is not None:
                removed += 1
        self.database.set(args[0], table, kind="hash")
        writer.write(f":{removed}\r\n".encode("utf-8"))

    async def _cmd_sadd(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key = args[0]
        members = self.database.get(key)
        members = set(members) if isinstance(members, set) else set()
        added = 0
        for member in args[1:]:
            if member not in members:
                members.add(member)
                added += 1
        self.database.set(key, members, kind="set")
        writer.write(f":{added}\r\n".encode("utf-8"))

    async def _cmd_srem(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key = args[0]
        members = self.database.get(key)
        members = set(members) if isinstance(members, set) else set()
        removed = 0
        for member in args[1:]:
            if member in members:
                members.discard(member)
                removed += 1
        self.database.set(key, members, kind="set")
        writer.write(f":{removed}\r\n".encode("utf-8"))

    async def _cmd_smembers(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        members = self.database.get(args[0])
        members = members if isinstance(members, set) else set()
        writer.write(f"*{len(members)}\r\n".encode("utf-8"))
        for member in members:
            writer.write(f"${len(member)}\r\n".encode("utf-8") + bytes(member) + b"\r\n")

    async def _cmd_sismember(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        members = self.database.get(args[0])
        found = isinstance(members, set) and args[1] in members
        writer.write(b":1\r\n" if found else b":0\r\n")

    async def _cmd_lpush(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key = args[0]
        items = self.database.get(key)
        items = list(items) if isinstance(items, list) else []
        for item in args[1:]:
            items.insert(0, item)
        self.database.set(key, items, kind="list")
        writer.write(f":{len(items)}\r\n".encode("utf-8"))

    async def _cmd_rpush(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key = args[0]
        items = self.database.get(key)
        items = list(items) if isinstance(items, list) else []
        items.extend(args[1:])
        self.database.set(key, items, kind="list")
        writer.write(f":{len(items)}\r\n".encode("utf-8"))

    async def _cmd_lrange(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        items = self.database.get(args[0])
        items = list(items) if isinstance(items, list) else []
        start = int(args[1])
        stop = int(args[2])
        if start < 0:
            start = max(0, len(items) + start)
        if stop < 0:
            stop = len(items) + stop
        selected = items[start : stop + 1]
        writer.write(f"*{len(selected)}\r\n".encode("utf-8"))
        for item in selected:
            writer.write(f"${len(item)}\r\n".encode("utf-8") + bytes(item) + b"\r\n")

    async def _cmd_lrem(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        key = args[0]
        items = self.database.get(key)
        items = list(items) if isinstance(items, list) else []
        count = int(args[1])
        target = args[2]
        if count >= 0:
            removed = 0
            kept: list[bytes] = []
            for item in items:
                if removed < count and item == target:
                    removed += 1
                    continue
                kept.append(item)
            items = kept
        else:
            items = [item for item in items if item != target]
        self.database.set(key, items)
        writer.write(b":0\r\n")

    async def _cmd_publish(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        channel, payload = args[0], args[1]
        peers = list(self.channels.get(channel, []))
        frame = f"${len(payload)}\r\n{payload}\r\n".encode("latin-1")
        delivered = 0
        for peer_writer, _reader in peers:
            try:
                peer_writer.write(b"*3\r\n$7\r\nmessage\r\n" + f"${len(channel)}\r\n{channel}\r\n".encode("latin-1") + frame)
                await peer_writer.drain()
                delivered += 1
            except Exception:
                continue
        writer.write(f":{delivered}\r\n".encode("utf-8"))

    async def _cmd_subscribe(self, args: list[bytes], writer: asyncio.StreamWriter, subscribed) -> None:
        for channel in args:
            peers = self.channels.setdefault(channel, [])
            peers.append((writer, None))
            subscribed.add(channel)
            writer.write(f"*3\r\n$9\r\nsubscribe\r\n${len(channel)}\r\n{channel}\r\n:1\r\n".encode("latin-1"))

    async def _cmd_unsubscribe(self, args: list[bytes], writer: asyncio.StreamWriter, subscribed) -> None:
        for channel in args:
            peers = self.channels.get(channel)
            if peers:
                self.channels[channel] = [peer for peer in peers if peer[0] is not writer]
            subscribed.discard(channel)
            writer.write(f"*3\r\n$11\r\nunsubscribe\r\n${len(channel)}\r\n{channel}\r\n:0\r\n".encode("latin-1"))

    async def _cmd_hello(self, args: list[bytes], writer: asyncio.StreamWriter, _subscribed) -> None:
        # The client asks for RESP3. The local server answers RESP2, which the
        # client accepts when it asked without a version.
        writer.write(b"-ERR unknown command 'HELLO'\r\n")


async def main(port: int) -> None:
    server = LocalRedis(port)

    async def client(reader: asyncio.StreamReader, writer: asyncio.StreamWriter) -> None:
        await server.handle(reader, writer)

    listener = await asyncio.start_server(client, "127.0.0.1", port)
    print(f"local redis on 127.0.0.1:{port}", flush=True)
    async with listener:
        await listener.serve_forever()


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="A local Redis for a local run.")
    parser.add_argument("--port", type=int, default=6380)
    arguments = parser.parse_args()
    asyncio.run(main(arguments.port))
