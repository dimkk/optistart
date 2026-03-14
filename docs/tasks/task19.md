# Task 19

## goal
Stabilize the native Telegram bridge so a message sent from Telegram into an active Codex thread is delivered exactly once, bridge reloads/restarts do not silently drop future messages, and the selected or auto-resolved thread target remains correct across the common runtime edge cases that happen during normal OptiDev use.

## architecture
- Keep the fix inside the existing native Telegram bridge path in `ui/apps/server/src/optidevTelegramBridge.ts` and the plugin-owned Telegram config in `ui/apps/server/src/optidevPlugins.ts`.
- Reuse the persisted bridge state file under `~/.optidev/plugins/telegram-bridge-state.json` instead of introducing a second store.
- Extend persisted bridge state with enough information to make inbound Telegram processing idempotent across:
  - tick retries after transient failures
  - bridge reloads after config changes
  - full server restarts before the last processed offset is flushed
- Preserve the current thread targeting model:
  - explicit `target_thread_id` wins when present
  - otherwise bridge auto-targets the best available active session
- Prefer correctness over optimistic progress:
  - if dispatch succeeds, mark the Telegram update as processed even if later side effects fail
  - never re-inject the same Telegram update into the thread because offset persistence or reload timing was imperfect
- Keep the bridge single-runtime from the server point of view and make reload behavior safe when a new tick begins before the previous configuration cycle fully settles.

## atomic features
- `plugins-tele-002`:
  Harden plugin-owned Telegram transport for duplicate update suppression, restart-safe inbound offset handling, and reload/reconnect continuity.

## test plan
- Unit:
  Extend `ui/apps/server/src/optidevTelegramBridge.test.ts` for duplicate Telegram update suppression, persisted-state recovery after restart, and reload behavior around active targeting.
- Integration:
  Extend `ui/apps/server/src/optidevRoute.test.ts` or adjacent native server coverage only if the bridge contract exposed by the live route changes.
- E2E/runtime:
  Run targeted native tests for Telegram plugin and bridge behavior, then verify the local dev server still starts cleanly with the bridge enabled.

## approvals / notes
- User explicitly asked on 2026-03-14 to fully finish the Telegram bridge behavior and verify edge cases after observing duplicate delivery and a broken reconnect path in session `019cec93-c17d-7122-b978-26fe8b16b04b`.
- Scope is a bugfix hardening pass, not a Telegram feature redesign.
