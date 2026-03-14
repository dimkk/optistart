# task-051 start default advice report

## implemented behavior
- Enabled startup advice by default for native `optid start` and `optid go` flows.
- Added `--no-advice` as the explicit CLI opt-out while keeping `--advice` accepted for compatibility.
- Removed the restored-session warning noise that became misleading once advice is default-on.
- Kept `optid start` as the primary bootstrap path for both repository roots and empty folders; existing Codex session attach remains a UI/sidebar action after the workspace opens.
- Tightened the README quick start so the real first-run path is `optid start`, with Telegram called out separately as a credentialed follow-up flow.

## tests added or updated
- Updated `ui/apps/server/src/optidevStartup.test.ts` for advice-on-by-default bootstrap, quiet opt-out, and restore behavior.
- Updated `ui/apps/server/src/optidevCli.test.ts` so native CLI startup expects advice by default and verifies `--no-advice`.
- Updated `ui/apps/server/src/optidevRoute.test.ts` so embedded `/api/optidev/action` callers inherit advice by default unless they send `advice: false`.
- Verified `optid start` manually from both an empty directory and a repository-style directory through `scripts/optid-runner.mjs`.

## important decisions
- The change reuses the existing native startup pipeline instead of adding a second bootstrap mechanism or a new CLI attach picker.
- UI/API callers with no explicit `advice` field now inherit the same default-on behavior as the CLI, so the contract is consistent across entrypoints.
- The current attach model stays split on purpose: CLI gets you into a running OptiDev workspace quickly, and attaching to a concrete Codex session continues in the UI.

## open loops or known limits
- `optid start` still boots or restores the workspace; it does not yet auto-discover and attach to an already open machine-local Codex session from the CLI path.
