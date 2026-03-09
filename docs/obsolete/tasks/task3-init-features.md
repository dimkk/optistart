# Task 3 Atomic Feature Breakdown: Agent Memory Graph

## Release target
- Release: `v1-2`

## Architectural intent
Task 3 adds structured project memory on top of the manifest/runtime foundation from `v1-1`.

The implementation must be graph-model-first and storage-abstracted.

## Atomic features

### 1. `graph-store-001` — Memory graph storage abstraction
- Define backend-agnostic graph store contract.
- Keep runtime and CLI independent from SQLite specifics.

### 2. `graph-sqlite-001` — SQLite graph store implementation
- Implement graph store using SQLite for MVP.
- Handle schema init and relation persistence.

### 3. `graph-schema-001` — Agent memory graph schema and relations
- Define entities and relations for projects, tasks, features, decisions, open loops, releases, sessions, and agents.

### 4. `graph-ingest-001` — Structured ingestion from tasks/features/reports
- Ingest structured memory entries from task docs, feature docs, and implementation reports.
- Keep ingestion deterministic and parseable.

### 5. `graph-decisions-001` — Decision memory model
- Persist and query key development decisions with rationale and alternatives.

### 6. `graph-openloops-001` — Open loops memory model
- Persist unresolved work items and expose their status.

### 7. `graph-summary-001` — Startup memory digest generation
- Build compact restore digest from graph relations for workspace startup.

### 8. `cli-memory-001` — Memory inspection CLI
- Add `optid memory` command family.
- Support summary lookup and feature/task/release drilldown.

### 9. `runtime-memory-001` — Memory-aware workspace restore context
- Inject memory digest into runtime startup context and visible restore output.

### 10. `graph-release-001` — Release-feature memory linking
- Link features into releases and surface release scope in memory lookups and startup digest.

## Sequencing constraints
Implementation order should be:
1. `graph-store-001`
2. `graph-sqlite-001`
3. `graph-schema-001`
4. `graph-decisions-001`
5. `graph-openloops-001`
6. `graph-ingest-001`
7. `graph-summary-001`
8. `cli-memory-001`
9. `runtime-memory-001`
10. `graph-release-001`

## Notes
- Decision and open-loop support should not be delayed too long; they are the highest-value MVP memory objects.
- Runtime integration comes after graph storage/querying is stable.
- This release should avoid vector/RAG scope creep.

## Human approval needed
- This feature list requires approval before starting atomic implementation lifecycle.
