# Task 3 Architecture Proposal: Agent Memory Graph

## 1. Objective
Upgrade OptiDev memory from generic session/chat history to structured development memory.

The goal is to preserve not only what was said, but what was built, why decisions were made, what remains unresolved, and how work maps to features, tests, releases, and agents.

## 2. Architectural role
The Agent Memory Graph sits above the manifest runtime introduced in `v1-1`.

Current layers:
- workspace manifest
- runtime session restore
- plugin/runtime startup context

Task 3 adds:
- structured project memory model
- memory ingestion pipeline
- memory digest generation for startup
- lookup commands for tasks/features/releases/open loops/decisions

## 3. Design principle
This is not generic RAG and not raw chat history.

It is structured development memory with explicit entities and explicit relations.

Primary questions it must answer:
- what feature was worked on?
- what release includes it?
- what files/tests were related?
- what decision was made and why?
- what remains unresolved?
- what should the next agent know immediately on restore?

## 4. Storage architecture
The storage layer must be replaceable.

Proposed module split:
- `optidev/memory_graph/base.py`
  - graph store contract
- `optidev/memory_graph/sqlite.py`
  - SQLite implementation for MVP
- `optidev/memory_graph/ingest.py`
  - ingestion helpers from docs and reports
- `optidev/memory_graph/summary.py`
  - digest builder for runtime startup and CLI display

Why:
- SQLite is enough for MVP
- future graph DB or other storage can replace the backend without rewriting runtime or CLI behavior

## 5. MVP entity model
Core entities for MVP:
- `projects`
- `tasks`
- `features`
- `decisions`
- `open_loops`
- `releases`
- `sessions`
- `agents`

Useful first relations:
- `task -> feature`
- `feature -> decision`
- `feature -> release`
- `feature -> session`
- `session -> agent`

Optional but valuable if cheap in MVP:
- `feature -> file`
- `feature -> test`

## 6. Most important entity: decision
Decision memory is the most valuable continuity artifact.

Required fields:
- title
- decision
- rationale
- alternatives
- related feature
- created_at

This allows future agents to restore reasoning, not just results.

## 7. Open loops model
Open loops capture unresolved or postponed work.

Required fields:
- related feature
- description
- status
- created_at
- updated_at

Typical examples:
- flaky tests
- postponed auth flow
- incomplete restart policy
- deferred UX change

## 8. Ingestion model
For MVP, ingestion should be deterministic and explicit, not magical.

Primary sources:
- `docs/tasks/*.md`
- `docs/features/**`
- implementation reports in `tasks-log/task-*-report.md`

This means atomic feature completion can update both:
- report document
- graph memory entries

## 9. Runtime integration
On workspace start/restore:
1. load session
2. load memory graph summary
3. build a short startup digest
4. inject digest into startup context artifacts and CLI output

Target startup output shape:
- current release
- active feature
- last completed feature
- open loops
- key decisions
- suggested next action

## 10. CLI surface
Proposed memory commands:
- `optid memory`
- `optid memory show feature <id>`
- `optid memory show task <id>`
- `optid memory show release <id>`
- `optid memory open-loops`

These commands should read through the abstract graph store, not directly through SQLite code.

## 11. Compatibility and rollout
Task 3 must extend existing memory, not replace it destructively.

Compatibility rules:
- existing `memory.sqlite` session/message storage may coexist during migration
- graph storage can live in the same SQLite database or a dedicated file, but behind a graph storage contract
- runtime should tolerate empty graph state and still start successfully

## 12. Non-goals for MVP
Do not add yet:
- vector DB
- embeddings
- semantic retrieval
- fully automatic repo-wide knowledge mining
- external graph database dependency
- autonomous extraction from arbitrary conversations

## 13. Acceptance criteria for architecture phase
- graph model is clearly distinct from chat history
- storage abstraction is defined
- MVP entities and relations are explicit
- ingestion sources are explicit
- startup digest behavior is explicit
- CLI lookup surface is explicit
- atomic feature planning can proceed without ambiguity
