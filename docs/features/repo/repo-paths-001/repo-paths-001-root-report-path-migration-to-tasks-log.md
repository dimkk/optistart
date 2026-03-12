# repo-paths-001: Root report path migration to tasks-log

## description
Rename the repository root report directory from `tasks/` to `tasks-log/` and update the runtime/documentation contract accordingly.

## current implementation state
- Repository reports live under `tasks-log/`.
- Memory-graph ingestion reads `tasks-log/task-*-report.md` and keeps a compatibility fallback for legacy `tasks/` projects.
- AGENTS, README, tests, and current release docs reference `tasks-log/`.

## implementation plan
1. Completed: migrate repository report files to `tasks-log/`.
2. Completed: update ingestion/tests/docs to the new path.
3. Completed: preserve fallback ingestion for older repositories still using `tasks/`.
