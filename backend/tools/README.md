# Running ZeroX locally on Windows

A local run needs four processes: the database, the cache, the server, and
the helpers the server talks to.

## What is needed

| Part | What it is | How to get it |
| --- | --- | --- |
| PostgreSQL | the product database | any PostgreSQL 14+ on port 5432 |
| Redis | the command inbox, the codes, the presence | `tools/local_redis.py`, or any Redis 6+ |
| The server | the API and the Runtime worker | `tools/run_local.py` |
| The mail catcher | the sign-in codes | `tools/smtp_catcher.py` |
| The model stub | the answers of the model | `tools/stub_model_server.py` |

The repository ships `tools/local_redis.py`, because the Redis build for
Windows is too old for the client the platform uses. The other three are
helpers for a local run.

## The steps

```powershell
# 1. The database.
$env:DATABASE_URL='postgresql+asyncpg://postgres:postgres@127.0.0.1:5432/clawith'
uv run alembic upgrade head
uv run python tools\setup_langgraph_checkpoints_win.py
uv run python seed.py

# 2. The cache.
python tools\local_redis.py --port 6380

# 3. The mail catcher.
python tools\smtp_catcher.py --port 1025 --out ..\.localdata\mail

# 4. The model stub.
python tools\stub_model_server.py --port 8099

# 5. The server.
. .localdata\env.ps1
uv run python tools\run_local.py --host 127.0.0.1 --port 8000
```

The environment of the server lives in `.localdata/env.ps1`. It names the
database, the cache, the data directory, and the secrets of the local run.

## The harness

The harness creates the facts a local run needs: a tenant, an identity, a
user, a model that points at the stub, and an agent.

```powershell
uv run python tools\local_harness.py
```

It prints the sign-in code of the identity and the access token. The mail
catcher receives the same code.

## The tests

```powershell
# The live test of the chat, with the code of the client.
cd ..\desktop
npm run test:e2e

# The live test of a group: create, send, read.
npm run test:e2e:group
```

The test signs in through the API, opens the chat socket, sends a message,
and waits for the terminal packet. It needs the server, the mail catcher and
the model stub to run.
