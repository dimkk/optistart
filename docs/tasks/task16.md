# Task 16

## goal
Show all live Codex sessions in the left shell sidebar, mark sessions with `*` when they do not belong to an OptiDev workspace manifest on this machine, and allow clicking a listed Codex session to attach it into the native `t3code` chat surface.

## architecture
- Treat the local Codex state database on this machine (`~/.codex/state_*.sqlite`) as the source of truth for visible sidebar sessions.
- Keep CLI-compatible `runner_list` semantics unchanged and add a separate UI-only `codex_sessions` action for the shell sidebar.
- Read unarchived rows from the Codex `threads` table, sort by `updated_at desc`, and shape them into the existing session inventory payload used by the sidebar.
- Collapse subagent rows under the root Codex thread id so the sidebar shows one machine-local session row per root GUID.
- Derive manifest presence from the session cwd by searching upward for a valid `.optidev/workspace.yaml`:
  - valid workspace manifest found -> managed
  - no valid workspace manifest found -> missing
- Render the left sidebar from a lightweight query against `/api/optidev/action` `codex_sessions`, without replacing the existing thread/project navigation.
- Add a dedicated `/api/optidev/action` `codex_connect` action that attaches the selected Codex GUID into the existing orchestration model:
  - reuse or create the project for the session cwd
  - reuse or create the thread keyed by the root Codex GUID
  - start or reuse a live Codex provider session with the same resume cursor
  - route the shell into the standard thread chat view instead of introducing a parallel OptiDev-only conversation surface
- Keep attach behavior aligned with native `t3code` flows instead of introducing a separate transcript import path from the Codex sqlite state database.

## atomic features
- `runtime-session-003`:
  Surface machine-local Codex sessions in the left shell sidebar and mark sessions without an OptiDev workspace manifest with `*`.
- `runtime-session-004`:
  Attach a machine-local Codex session from the sidebar into the native `t3code` chat thread route.

## test plan
- Unit:
  Cover Codex sqlite session inventory shaping, manifest presence resolution, and attach orchestration/session dispatch.
- Integration:
  Validate `/api/optidev/action` `codex_sessions` returns the enriched session inventory through the live route/server path, and `/api/optidev/action` `codex_connect` forwards the attach payload through the mounted server route.
- E2E:
  Validate the left sidebar renders local Codex sessions, shows `*` when a session is unmanaged, and posts a `codex_connect` attach request when a machine-local session row is clicked.
- Regression:
  Cover missing Codex state DB, sessions without cwd, sessions outside any OptiDev project root, invalid manifests, matching managed manifests, and attach fallback when secondary snapshot refresh calls fail after the server attach already succeeded.

## approvals / notes
- User clarified on 2026-03-13 that the left sidebar should show all existing Codex sessions on this machine and only distinguish `manifest present / missing`, without creating any OptiDev files automatically.
- User clarified on 2026-03-13 that attach should follow the native `t3code` path rather than inventing custom transcript import behavior from the Codex sqlite state database.
