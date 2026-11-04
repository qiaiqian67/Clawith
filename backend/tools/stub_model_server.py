"""A stub of an OpenAI-compatible model server.

The server answers every chat completion with a fixed answer, and it records
what it was asked. It exists so a local run can exercise the whole Runtime
without a real model provider.

Run it with:

    python tools/stub_model_server.py --port 8099
"""

from __future__ import annotations

import argparse
import json
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer


ANSWER = "Hello from the stub model. The ZeroX Runtime reached the model."


class Handler(BaseHTTPRequestHandler):
    """Answer one chat completion."""

    # The client reads the stream until the connection closes, so the server
    # answers with HTTP/1.0 and closes the connection after the last chunk.
    protocol_version = "HTTP/1.0"
    close_connection = True

    def log_message(self, format: str, *args) -> None:  # noqa: A002
        print(f"stub: {format % args}", flush=True)

    def do_POST(self) -> None:  # noqa: N802
        length = int(self.headers.get("Content-Length") or 0)
        body = self.rfile.read(length).decode("utf-8", errors="replace")
        try:
            payload = json.loads(body)
        except json.JSONDecodeError:
            payload = {}

        stream = bool(payload.get("stream"))
        print(
            f"stub: request {self.path} stream={stream} bytes={len(body)}",
            flush=True,
        )

        if stream:
            self.send_response(200)
            self.send_header("Content-Type", "text/event-stream")
            self.send_header("Cache-Control", "no-cache")
            self.send_header("Connection", "close")
            self.end_headers()

            first = {
                "id": "chatcmpl-stub",
                "object": "chat.completion.chunk",
                "created": 0,
                "model": payload.get("model") or "stub",
                "choices": [
                    {
                        "index": 0,
                        "delta": {"role": "assistant", "content": ANSWER},
                        "finish_reason": None,
                    }
                ],
            }
            last = {
                "id": "chatcmpl-stub",
                "object": "chat.completion.chunk",
                "created": 0,
                "model": payload.get("model") or "stub",
                "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}],
            }
            for chunk in (first, last):
                self.wfile.write(f"data: {json.dumps(chunk)}\n\n".encode("utf-8"))
            self.wfile.write(b"data: [DONE]\n\n")
            self.wfile.flush()
            return

        answer = {
            "id": "chatcmpl-stub",
            "object": "chat.completion",
            "created": 0,
            "model": payload.get("model") or "stub",
            "choices": [
                {
                    "index": 0,
                    "message": {"role": "assistant", "content": ANSWER},
                    "finish_reason": "stop",
                }
            ],
            "usage": {
                "prompt_tokens": 0,
                "completion_tokens": 0,
                "total_tokens": 0,
            },
        }
        body_bytes = json.dumps(answer).encode("utf-8")
        self.send_response(200)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body_bytes)))
        self.end_headers()
        self.wfile.write(body_bytes)


def main() -> None:
    parser = argparse.ArgumentParser(description="A stub model server for local runs.")
    parser.add_argument("--port", type=int, default=8099)
    args = parser.parse_args()
    server = ThreadingHTTPServer(("127.0.0.1", args.port), Handler)
    print(f"stub model server on http://127.0.0.1:{args.port}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
