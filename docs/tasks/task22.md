# task22

## goal
- Make startup advice enabled by default for OptiDev bootstrap flows.
- Keep `optid start` as the primary entry command for both repository roots and empty folders.
- Tighten the quick-start documentation so the first-run path is short, real, and already supported by the current runtime.

## architecture
- Reuse the existing native startup pipeline in `ui/apps/server/src/optidevStartup.ts` instead of adding a second bootstrap mechanism.
- Change the CLI and route-level advice default so `start` and `go` inject repo advice unless explicitly disabled.
- Add an explicit opt-out flag (`--no-advice`) rather than removing operator control.
- Preserve the existing UI-based Codex session attach path in the sidebar; `optid start` should reliably land the user in a workspace/UI state where that attach path is available.

## atomic features
- Enable advice by default for `optid start` and `optid go`.
- Add a way to disable advice explicitly.
- Remove the restored-session warning noise caused by default advice on already running workspaces.
- Update quick-start docs to use the real `optid start` happy path for repo roots and empty folders.

## test plan
- Update native CLI tests for default-advice startup behavior and explicit opt-out.
- Update startup/runtime tests so bootstrap and restore flows reflect the new default.
- Run targeted server CLI/startup tests plus the repository validation suite after the contract change.

## approvals / notes
- User explicitly requested advice-on-by-default.
- User explicitly wants `optid start` to be the main entry path from a repo root or an empty directory, with further Codex attach handled in the UI.
