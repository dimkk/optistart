# qa-e2e-001: Expanded end-to-end runtime coverage

## description
Increase OptiDev end-to-end coverage for real runtime seams, with Telegram bridge flow as the primary target.

## current implementation state
- E2E now covers Telegram `start/status/stop` plus a plugin-local chat bridge flow against a fake Telegram API.
- The Telegram bridge e2e verifies runner output mirroring, Telegram-to-runner input, local input mirroring, and `/status` handling.
- Existing runtime e2e coverage continues to cover start/resume/reset/clone, layout generation, plugins, skills, agents, memory, and hooks.

## implementation plan
1. Completed: add fake Telegram API test fixture.
2. Completed: add PTY-based chat bridge e2e.
3. Completed: keep runtime e2e coverage green after refactors.
