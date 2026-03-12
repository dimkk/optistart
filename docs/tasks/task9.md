# Task 9

## goal
Quarantine obsolete repository documentation under `docs/obsolete/`, keep only current operational docs in active `docs/`, and update repository guidance so contributors can tell which docs are live.

## architecture
- Keep active documentation in `docs/` limited to:
  - current release control files under `docs/v1-2/`
  - current task dossiers still relevant to active work
  - current feature docs that belong to the approved release
  - current guides and release notes
- Move older release matrices, historical task drafts, superseded feature docs, and old narrative docs into `docs/obsolete/` while preserving their relative structure for lookup.
- Add one lightweight repository verification script so the active-vs-obsolete split is testable.

## atomic features
- `repo-docs-002`:
  Quarantine obsolete documentation under `docs/obsolete/` and keep active `docs/` scoped to the current release and current operator guidance.

## test plan
- Unit:
  `scripts/verify-doc-layout.sh` checks that active control files remain in place and that obsolete docs no longer live in active paths.
- Integration:
  The same script verifies obsolete release/task/feature docs were moved into `docs/obsolete/` with expected structure.
- E2E:
  Manual path audit of README, AGENTS, and current guide paths confirms contributors are routed to active docs first.

## approvals / notes
- User explicitly requested moving old docs into `docs/obsolete/` on 2026-03-09 and asked for a commit afterward.
- This task changes repository documentation layout, not runtime behavior.
