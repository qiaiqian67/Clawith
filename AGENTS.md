# AGENTS.md - ZeroX root

## Repository layout

```text
backend/    The ZeroX server: the agent runtime, the product APIs, and the
            integrations. Internal rules: backend/AGENTS.md
frontend/   The web application of the platform.
            Internal rules: frontend/AGENTS.md
desktop/    The desktop client of the platform.
            Internal rules: desktop/AGENTS.md
helm/       The Kubernetes chart.
deploy/     The production deployment documentation and assets.
scripts/    The repository-wide development and validation tooling.
.github/    The GitHub workflows and the CI support scripts.
docker-compose*.yml  The local, CI, and production container topology.
```

The desktop client is a **client** of the backend. It never contains a copy
of the server, and the backend never contains a copy of the client. A fact
that both need has one owner, and the other asks for it.

## The product name

The product is **ZeroX**. The identifiers that came with the upstream code
keep their names: the `clawith` image tags, the `clawith` i18n keys, the
`clawith_sync` skill file, and the `ClawithChatbotHandler` class are
contracts with deployed agents and with import paths. A person never reads
them.

## Conventions

Each behavior-driving fact has one authoritative owner. Other layers may
submit commands, record outcomes, cache data, or build projections, but they
must not independently redefine that fact or become a second authority for it.

- **Lifecycle ownership is explicit.** Every registration, task, subscription,
  connection, or resource that outlives the current operation has one owner,
  defined termination conditions, and cleanup paths for success, failure, and
  cancellation.
- **Runtime responsibilities are documented.** Every capability or subsystem
  with an independent runtime responsibility must document the authoritative
  facts and relationships it owns, how those facts change, and how their
  correctness is verified.
- **State and protocol variants are explicit.** Treat internal lifecycle states
  and shared contracts as closed unless they are deliberately designed for
  extension.
- **Model-visible inputs are traceable.** Every input that can affect a model
  decision must have an identifiable source and be attributable to the
  corresponding Run.
- **Validate at trust boundaries.** Validate data when it enters from
  configuration, HTTP or WebSocket requests, model or Tool JSON, persistence,
  files, workers, processes, and external integrations.
- **Data access is bounded and evidence-driven.** Define the expected
  cardinality of every query and enforce filtering, pagination, batching, and
  result limits at the layer that owns the complete data operation.
- **Ignored failures are narrow and explained.** Catch only the single
  operation whose specific failure may be ignored.
- **Tests enforce behavior, not product truth.** A passing test proves that
  the implementation matches its asserted behavior; it does not prove that
  the asserted behavior matches the current product or architecture contract.
- **Non-trivial changes keep code, documentation, and commit history
  aligned.** A change to behavior, architecture, a shared contract, Runtime
  semantics, persistence, security, permissions, compatibility, or engineering
  process must add or update its owning documentation in the same change.

## Change Discipline

- Keep each change scoped to one intent. Do not mix structural refactoring,
  behavior changes, compatibility work, and unrelated cleanup.
- Preserve verified behavior unless the task explicitly changes the owning
  product or architecture contract.
- Before introducing an abstraction, identify the current owner and consumer.
  Delete obsolete code and reuse the existing owner when it already fits.
- Delete verified dead code in the same change.
- Preserve unrelated working-tree changes and user-owned files.
- Use repository-relative paths in code, documentation, and instructions.
- When ownership or a boundary changes, update the nearest path-specific
  `AGENTS.md` and the corresponding durable documentation.
- Do not add fallback or compatibility paths without a documented reason,
  regression coverage, and a removal condition.

## Type Checking

Everything compiles under `strict: true` with `noImplicitAny`; every remaining
`any` explains why narrowing is infeasible.

Public interfaces must be usable without reading their implementation. Types
define structure; owning documentation defines non-obvious behavior, failure,
side effects, ownership, timing, cancellation, and durability.

Every new or changed automated rule must include positive and negative
coverage: valid cases pass, and representative invalid cases fail for the
intended reason.

## Quick Command Reference

- Backend: `backend/AGENTS.md` (server start, Alembic migrations, Pytest, Ruff)
- Frontend: `frontend/AGENTS.md` (Vite dev server, type-check, lint, build)
- Desktop: `desktop/AGENTS.md` (Electron dev server, type-check, package)
- A local run on Windows: `backend/tools/README.md`

## Failure Diagnosis and Handling

When a command fails:

```text
Command fails
    -> Identify the failing layer
    -> Collect evidence from that layer
    -> Fix the layer that owns the failure
    -> Run the original command again
```

Do not modify product code to accommodate the current machine before evidence
shows that the environment is the failing layer. Do not dismiss a test failure
as an environment problem before collecting environment evidence.

## Verification

After code changes, verification scope is determined by the affected contracts
and consumers, not by the number of modified files. Cross-layer changes must
follow the real execution path and update and verify every affected layer;
local changes require only local evidence.

Match evidence to the surface. Start with focused checks and expand only when
the change crosses a documented boundary. Report only the commands and checks
actually run, together with the remaining verification gaps.

## Communication

- Lead with the conclusion, the result, or the blocker.
- Use direct, concrete language and name the actual actor, fact, file,
  command, API, state, or behavior.
- Separate verified repository facts, inference, and unverified live behavior.
- Report only commands and checks actually run.
- Keep responses concise unless risk, ambiguity, or the user requests more
  detail.
