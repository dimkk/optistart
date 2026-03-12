# Task 3 Feature Test Plan: Agent Memory Graph

## Test levels
- Unit: entity validation, graph writes/reads, digest rules.
- Integration: ingestion + storage + runtime boundaries.
- E2E: CLI memory commands and startup digest behavior.

## Mapping

### `graph-store-001`
- Unit:
  - backend contract conformance
- Integration:
  - graph operations route through abstract store interface
- E2E:
  - runtime and CLI behave the same regardless of selected store implementation

### `graph-sqlite-001`
- Unit:
  - SQLite CRUD for entities and relations
- Integration:
  - schema initialization and persistence lifecycle
- E2E:
  - memory graph survives restart and reload

### `graph-schema-001`
- Unit:
  - entity and relation validation
- Integration:
  - links between task/feature/release/decision/session/agent are persisted correctly
- E2E:
  - stored graph reflects completed work and related metadata

### `graph-ingest-001`
- Unit:
  - parsers/extractors for tasks/features/reports
- Integration:
  - ingestion pipeline writes graph entries from docs
- E2E:
  - completed task artifacts appear in memory graph after ingestion command or hook

### `graph-decisions-001`
- Unit:
  - decision field validation and formatting
- Integration:
  - feature-to-decision relation persistence
- E2E:
  - memory lookup surfaces decision, rationale, and alternatives

### `graph-openloops-001`
- Unit:
  - open loop validation and status transitions
- Integration:
  - open loop persistence and query behavior
- E2E:
  - `optid memory open-loops` shows unresolved work items correctly

### `graph-summary-001`
- Unit:
  - digest prioritization and formatting rules
- Integration:
  - digest builder composes data from multiple graph entities
- E2E:
  - startup summary shows release, active feature, open loops, decisions, and next action

### `cli-memory-001`
- Unit:
  - parsing for `memory` subcommands
- Integration:
  - CLI routes queries into graph store services
- E2E:
  - `optid memory`, `optid memory show ...`, and `optid memory open-loops` work end-to-end

### `runtime-memory-001`
- Unit:
  - startup context assembly from graph digest
- Integration:
  - runtime injects digest into startup context artifacts and visible restore output
- E2E:
  - start/restore includes graph summary in CLI output and runner context

### `graph-release-001`
- Unit:
  - release-feature relation validation
- Integration:
  - release scope persists and resolves through graph queries
- E2E:
  - release information is visible from memory summary and lookups

## Gate
- Optional human approval for this test plan before implementation.
- Mandatory: architecture + features approvals must exist before atomic feature coding begins.
