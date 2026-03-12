# Task 018 Report: Agent Memory Graph

## Scope
- Implemented structured project memory as release `v1-2`.
- Added graph storage abstraction and SQLite backend.
- Added deterministic ingestion from task docs, feature docs, release matrices, reports, and project session state.
- Added startup memory digest and `optid memory` CLI.

## Decisions
- Use a replaceable graph-store contract with SQLite as the MVP backend.
- Keep graph memory in the existing `~/.optidev/memory.sqlite` file to avoid another local state file.
- Rebuild per-project graph memory from repository artifacts on start and lookup for deterministic behavior.

## Open loops
- Feature/file and feature/test relations are still out of MVP scope and can be added in a later release.
- Report parsing is intentionally deterministic and simple; richer structured report fields can be added later without changing the storage contract.
