# Task 13

## goal
Correct `optid runner ls` so it enumerates the actually open live runner sessions exposed by the running OptiDev server, not just persisted resumable bindings in local sqlite, while keeping `optid runner resume <id>` aligned with that live inventory.

## architecture
- Keep this feature in the outer OptiDev CLI layer, not in the vendored `t3code` launcher wrapper, because the command operates on native provider runtime state already owned by the Bun server code.
- Treat the running OptiDev server as the source of truth for "open runner sessions":
  - `optid runner ls` must query the live server rather than opening sqlite directly
  - seeded persistence remains useful only for recovery, not for the primary inventory of open sessions
- Build one repository-owned listing model that exposes, for each open runner session:
  - a stable ordinal alias scoped to the current `optid runner ls` output
  - the underlying provider/thread guid
  - the best available current working directory
  - the latest user-authored message snippet if one exists
- Enrich the live provider session list with projection snapshot data so message preview and cwd fallback still work when the provider session payload is partial.
- Keep `optid runner resume <id>` server-backed and alias-based:
  - resolves the small integer alias back to the underlying provider thread/session
  - resolves aliases from the same live inventory users just saw
  - may still accept a canonical guid for direct recovery when appropriate
  - resumes the resolved provider session through the existing provider/runtime contract
- Keep the alias ephemeral and operator-facing:
  - `1`, `2`, `3` are convenience ids from the latest inventory view
  - the real source of truth remains the underlying provider thread/session guid
- If no user-authored message exists for a session, listing should still work and clearly show an empty or fallback preview.
- The new command group should coexist with the existing workspace lifecycle CLI and should not alter `optid start/resume/go` semantics.
- The public CLI surface should stay runner-neutral:
  - `optid runner ls`
  - `optid runner resume <id>`
  - the current implementation may only surface the currently supported live Codex-backed runtime, but the command naming must not hard-code `codex`
- `runner ls` should no longer trigger sqlite migration work on the CLI path just to read inventory.

## atomic features
- `cli-runner-002`:
  Make `optid runner ls` list live open runner sessions from the running server with ordinal alias, real guid, cwd, runner type, and latest user message preview.
- `cli-runner-003`:
  Keep `optid runner resume <id>` resolving an operator alias from the live runner inventory and resuming the matching session safely.

## test plan
- Unit:
  Cover live session inventory shaping, alias numbering, runner labeling, preview truncation/fallback behavior, and alias parsing/resolution.
- Integration:
  Exercise the native CLI against mocked/live server responses so `optid runner ls` and `optid runner resume <id>` run through the real native/shipped entrypoints without local sqlite inventory reads.
- E2E:
  Validate the commands against live runner runtime metadata in a real or staged local environment where open sessions exist, confirming that the shown cwd and latest user text correspond to the live target.
- Regression:
  Cover empty live inventories, unreachable server responses, stale aliases, missing cwd, missing latest-user text, direct guid recovery, and sessions that disappear between `ls` and `resume`.

## approvals / notes
- User requested on 2026-03-12 that OptiDev should expose `optid runner ls` to show all running runner sessions with guid, latest user phrase, and working directory, plus `optid runner resume <id>` using small integer ids like `1`, `2`, `3`.
- User reported on 2026-03-12 that the shipped implementation returned no sessions while Codex showed live sessions; implementation must be corrected to match the explicit live-session requirement.
- User explicitly approved proceeding with the fix on 2026-03-12, so no separate approval round is required for this corrective implementation.
