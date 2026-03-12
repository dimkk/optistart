# Task 032 Report

## Implemented behavior
- Moved obsolete release matrices, historical task drafts, older narrative docs, and superseded feature docs under `docs/obsolete/`.
- Left active `docs/` scoped to:
  - `docs/v1-2/`
  - current feature docs for the approved release
  - current task dossiers (`task7`, `task8`, `task9`)
  - current guide and current release note
- Added `scripts/verify-doc-layout.sh` to verify the active-vs-obsolete split.
- Updated `AGENTS.md` and `README.md` so contributors are pointed to active docs first and know where historical material lives.

## Tests added or updated
- Added `scripts/verify-doc-layout.sh`.
- Updated `docs/v1-2/test-matrix.md` with `repo-docs-002`.
- Verified:
  - `scripts/verify-doc-layout.sh`
  - manual path audit of `AGENTS.md`
  - manual path audit of `README.md`

## Important decisions
- Preserved old docs instead of deleting them, but moved them out of active contributor paths.
- Kept only release-relevant feature docs active in `docs/features/`.
- Kept `task7`, `task8`, and `task9` active because they still explain the current runtime and docs cleanup direction.

## Open loops or known limits
- Historical reports in `tasks-log/` still reference old paths where that history matters; they were not rewritten.
- `docs/obsolete/` is intentionally archival and may contain pre-current conventions.
