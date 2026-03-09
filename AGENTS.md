# AGENTS

This repository is built with agent-driven development inside the OptiDev workspace.

The goal of this file is to keep control points strict while reducing documentation overhead.

## Repository Contract

Root markdown policy:
- allowed in root: `AGENTS.md`, `README.md`

Scripts:
- all executable or utility scripts must live in `./scripts/`

Agent assets:
```text
.agents/
  agents/
  skills/
  mcp/
```

Implementation reports:
- all task reports live in `./tasks-log/`

Task planning docs:
- all task dossiers live in `./docs/tasks/`

Obsolete docs:
- historical or superseded docs must move to `./docs/obsolete/`
- active contributor guidance should stay in live `./docs/` paths

## Current Release

Current approved release:
```text
docs/v1-2/features-matrix.md
docs/v1-2/test-matrix.md
```

Version rule:
- do not create a new release unless the user explicitly asks for it
- if the user does not specify a new release, continue appending to the current approved release

## Workflow

Compact workflow:
```text
task dossier -> approval -> atomic features -> tests -> report
```

For any non-trivial task, create or refresh one task dossier:
```text
docs/tasks/taskN.md
```

The task dossier must contain these sections:
- goal
- architecture
- atomic features
- test plan
- approvals / notes

This replaces the old split into:
- `*-arc.md`
- `*-features.md`
- `*-features-tests.md`

Those files are no longer required for new work.

Approval rule:
- human approval is required for the task dossier before implementation when the task is architectural, cross-cutting, or multi-feature
- for a small isolated fix, a separate approval round is not required if the user already clearly asked to proceed

Hard gate:
- do not start non-trivial implementation until the task dossier exists

## Source Of Truth

The current release matrices are the main execution control files:
```text
docs/v1-2/features-matrix.md
docs/v1-2/test-matrix.md
```

They define:
- atomic feature IDs
- feature status
- test mapping

If matrices and a feature doc disagree, matrices win.

## Atomic Feature Lifecycle

Default rule:
- implement one atomic feature lifecycle at a time unless the user explicitly asks for parallel work

Lifecycle:
1. pick a feature ID from `docs/v1-2/features-matrix.md`
2. set status to `DESCRIBING` or `DEVELOPING` as appropriate
3. create feature documentation only if the feature changes a durable contract
4. update `docs/v1-2/test-matrix.md`
5. implement
6. add or update tests
7. run tests until green
8. set status to `DONE`
9. write or update the task report in `tasks-log/`

## Feature Docs

Feature docs are now selective, not mandatory for every small change.

Create a feature doc when the change affects:
- plugin API
- manifest schema
- runner contract
- storage schema
- workspace layout contract
- external integration contract
- persistent repository process contract

Feature doc location:
```text
docs/features/<component-id>/<feature-id>/
```

Component ID rule:
- component ID is the prefix before the first `-`

Examples:
```text
runner-api-002 -> component runner
plugins-tele-002 -> component plugins
```

For small local fixes:
- update matrices and report
- skip feature doc unless it adds long-term architectural value

## Tests

Every implemented feature must map to tests in:
- unit
- integration
- e2e

Not every feature needs all three at the same weight, but risky runtime features must have strong e2e coverage.

Mandatory e2e emphasis for:
- Telegram / external messenger flows
- workspace startup / restore
- plugin lifecycle behavior
- runner bootstrap behavior
- manifest/session restore behavior
- report ingestion / memory continuity

## Reports

Write one report per task cycle unless the user asks for finer granularity.

Report path:
```text
tasks-log/task-xxx-<topic>-report.md
```

Reports must include:
- implemented behavior
- tests added or updated
- important decisions
- open loops or known limits

No placeholder reports.

## Skills, Agents, MCP

Skills:
- live in `.agents/skills/`
- if a relevant skill exists, follow it
- if a new durable workflow appears repeatedly, consider creating a skill

Agents:
- live in `.agents/agents/`

MCP configs:
- live in `.agents/mcp/`

## OptiDev Assumptions

Assume the repository is used inside OptiDev:
```text
optid start <project>
```

Default workspace mental model:
```text
chat
editor/code
tests
logs
```

Agents should behave as if they work in a coordinated runtime, not in a single isolated shell.

## Parallel Work

Parallel execution is allowed only when explicitly requested.

Rules:
- each worker owns a clear scope
- no overlapping write ownership unless coordinated
- one writer for shared control files

Single-writer control files:
```text
docs/v1-2/features-matrix.md
docs/v1-2/test-matrix.md
tasks-log/*
```

## Git / Release Notes

Expected long-lived branches:
```text
dev
test
prod
```

Release docs live in:
```text
docs/releases/
```

Release tags and promotions happen only when the user explicitly moves the release process forward.
