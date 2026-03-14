# Features v1-2

| Feature ID | Title | Status |
| --- | --- | --- |
| graph-store-001 | Memory graph storage abstraction | DONE |
| graph-sqlite-001 | SQLite graph store implementation | DONE |
| graph-schema-001 | Agent memory graph schema and relations | DONE |
| graph-ingest-001 | Structured ingestion from tasks/features/reports | DONE |
| graph-decisions-001 | Decision memory model | DONE |
| graph-openloops-001 | Open loops memory model | DONE |
| graph-summary-001 | Startup memory digest generation | DONE |
| cli-core-001 | Core CLI command surface | DONE |
| cli-memory-001 | Memory inspection CLI | DONE |
| cli-runtime-002 | Manifest lifecycle CLI | DONE |
| runtime-memory-001 | Memory-aware workspace restore context | DONE |
| graph-release-001 | Release-feature memory linking | DONE |
| plugins-tele-002 | Telegram transport consolidated into plugin layer | DONE |
| runner-api-002 | Runner specs and command resolution cleanup | DONE |
| repo-paths-001 | Root report path migration to `tasks-log` | DONE |
| qa-e2e-001 | Expanded end-to-end runtime coverage | DONE |
| mux-textual-001 | Textual runtime backend fallback | DONE |
| ui-t3code-001 | Upstream `t3code` fork integrated with OptiDev runtime surfaces | DONE |
| runtime-ts-002 | Staged TypeScript/Bun migration of OptiDev runtime core into the forked `t3` product | DONE |
| runtime-ts-003 | Native-only repository cleanup after TS/Bun OptiDev cutover | DONE |
| repo-docs-002 | Obsolete docs quarantine under `docs/obsolete/` | DONE |
| repo-upstream-001 | Vendored `t3code` upstream refresh and overlay replay workflow | DONE |
| repo-upstream-002 | Deterministic conflict resolution for vendored `t3code` refresh hotspots | DONE |
| repo-upstream-003 | Explicit operator command for vendored `t3code` upstream refresh | DONE |
| repo-release-001 | Merge-to-main release bump and repository-owned tag/build automation | DONE |
| repo-release-002 | Full repository validation on pull requests targeting `main`, including CI-safe fallback when PTY native bindings are unavailable | DONE |
| cli-update-001 | Installed CLI update check against the latest tagged release | DONE |
| cli-launch-001 | Installed `optid` launcher for the shipped vendored `t3code` + OptiDev product | DONE |
| cli-runner-002 | Runner session inventory through `optid runner ls` | DONE |
| cli-runner-003 | Alias-based runner session resume through `optid runner resume <id>` | DONE |
| ui-shell-002 | OptiDev first-class `t3code` shell integration and stable route UX | DONE |
| repo-files-002 | Repository file explorer and typed file viewer inside OptiDev | DEVELOPING |
| runtime-session-002 | Session and restore management surface inside the integrated OptiDev UI | DEVELOPING |
| runtime-session-003 | Machine-local Codex session inventory with manifest presence markers in the shell sidebar | DONE |
| runtime-session-004 | Machine-local Codex session attach from the shell sidebar into native `t3code` chat | DONE |
| plugins-config-001 | Integrated editing for agents, skills, and Telegram configuration | DEVELOPING |
| ui-shell-003 | Manifest-first OptiDev workspace management surface | DONE |
