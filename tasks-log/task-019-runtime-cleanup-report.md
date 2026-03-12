# Task 019 Report: Runtime Cleanup and Coverage Expansion

## Scope
- Consolidated Telegram runtime transport into the Telegram plugin.
- Reworked `runners/` into runner specs with real default command ownership.
- Migrated repository implementation reports from `tasks/` to `tasks-log/`.
- Expanded e2e coverage, including a PTY-backed Telegram bridge flow against a fake Telegram API.

## Decisions
- Telegram stays plugin-owned until there is a real need for a generic cross-plugin messenger subsystem.
- Runner abstractions should model command resolution and bootstrap metadata, not placeholder run/resume/stop strings.
- Report-path migration keeps a compatibility fallback in ingestion so older projects are not broken.

## Open loops
- Historical architecture docs that discuss the old messenger seam were updated at the core points, but a broader docs cleanup can still tighten older narrative references.
- If more messengers appear later, introduce a plugin-level transport contract first, and only then consider a generalized core abstraction.
