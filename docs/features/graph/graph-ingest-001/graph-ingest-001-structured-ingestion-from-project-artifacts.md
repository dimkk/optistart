# graph-ingest-001: Structured ingestion from project artifacts

## description
Ingest graph memory deterministically from task docs, feature docs, release matrices, reports, and project session state.

## current implementation state
- Implemented in `ui/apps/server/src/optidevMemory.ts`.
- Reads `docs/tasks`, `docs/features`, `docs/releases`, `docs/v*/features-matrix.md`, `tasks-log/task-*-report.md`, and `.optidev/session.json`.
- Rebuilds project graph on each lookup/start so memory stays consistent with repo artifacts.

## implementation plan
1. Completed: deterministic parsers for task, feature, release, and report sources.
2. Completed: session ingestion for active task, branch, head commit, runner, mode, and agents.
3. Completed: integration and e2e coverage for ingestion-driven memory queries.
