# Task 11

## goal
Establish and harden a repeatable integration workflow for the vendored `t3code` fork so OptiDev can pull a newer upstream build, replay the local OptiDev overlay onto it, resolve known refresh conflicts deterministically, and validate the refreshed product before shipping further work.

## architecture
- Treat upstream `pingdotgg/t3code` as an external source snapshot, not as a live nested git remote inside `./ui/`.
- Record the vendored upstream source metadata in-repo so the project always knows which upstream commit the current `./ui/` tree is based on.
- Build one repository-owned sync entrypoint under `./scripts/` that:
  - fetches or clones the upstream `t3code` source into a temporary workspace
  - reconstructs the current OptiDev overlay as the diff between the recorded upstream base and the current vendored `./ui/` tree
  - reapplies that overlay onto a newer upstream ref
  - reports conflicts clearly instead of silently overwriting local integration work
  - updates the recorded upstream metadata only after a successful replay
- Keep the vendored runtime path unchanged:
  - `./ui/` remains the shipped workspace
  - OptiDev continues integrating directly into the vendored web/server product
- Add a documented verification path so a refreshed vendor tree can be built and smoke-tested immediately after sync.
- Add repository-owned conflict resolution for known hotspot files where upstream `t3code` refactors intersect with stable OptiDev integration points.

## atomic features
- `repo-upstream-001`:
  Add a versioned upstream-refresh workflow for the vendored `t3code` fork, including source metadata, overlay replay, and post-refresh build verification guidance.
- `repo-upstream-002`:
  Add deterministic conflict resolution for known vendored refresh hotspots so the sync workflow can preserve OptiDev integration across upstream refactors without hand-editing the same files every refresh.
- `repo-upstream-003`:
  Expose the vendored `t3code` upstream refresh workflow through one stable user-facing command so operators can pull upstream deliberately without remembering internal script paths.

## test plan
- Unit:
  Cover metadata parsing, ref resolution, path filtering, and sync-plan shaping in colocated script tests.
- Integration:
  Exercise the sync workflow against a temporary local git repo that simulates upstream `t3code`, proving that the OptiDev overlay can be replayed onto a newer upstream commit and that metadata updates only on success.
- E2E:
  Run the real sync entrypoint in dry-run or staged mode against the actual `pingdotgg/t3code` upstream ref, then verify the refreshed vendored workspace can still start/build through the existing `ui` commands.
- Regression:
  Explicitly cover dirty-worktree protection, conflict reporting, and exclusion of transient workspace artifacts such as `node_modules`, `.turbo`, and build outputs.
  Add coverage for current real-world conflict hotspots in `wsServer.ts`, `Sidebar.tsx`, and `vitest.browser.config.ts`.

## approvals / notes
- User requested this integration workflow on 2026-03-11 with the concrete goal that the repository must be able to receive a new upstream `t3code` build and then embed OptiDev content into that refreshed base.
- User explicitly approved this dossier on 2026-03-11 before implementation started.
- User requested conflict resolution implementation on 2026-03-12 after the first dry-run surfaced concrete upstream replay conflicts.
- User requested on 2026-03-12 that upstream `t3code` refresh should also be available through a separate explicit command.
