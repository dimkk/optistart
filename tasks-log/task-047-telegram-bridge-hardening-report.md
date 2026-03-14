# Task 047 Report

## Implemented Behavior

- hardened the native Telegram bridge so inbound Telegram updates use deterministic command and message ids, which keeps replayed updates from creating duplicate turns after reloads or restarts
- changed bridge offset handling to advance persisted Telegram state incrementally per consumed update instead of only once at the end of a full batch
- added timeout-bounded Telegram API polling and send operations so a hung network call cannot stall the bridge forever
- made bridge startup single-runtime in-process and ensured a stopped runtime ignores late poll results after a replacement runtime has already taken over

## Tests Added Or Updated

- extended `ui/apps/server/src/optidevTelegramBridge.test.ts` for:
  - stable inbound ids across replayed updates
  - recovery after a timed out Telegram poll
  - ignoring late poll completions from a stopped runtime
- re-ran the targeted Telegram slice:
  - `bun run test src/optidevPlugins.test.ts src/optidevRoute.test.ts src/optidevTelegramBridge.test.ts`

## Important Decisions

- used deterministic `commandId` and `messageId` values derived from Telegram `chat_id` and `update_id` so the existing orchestration command-receipt layer can supply durable deduplication
- kept explicit thread pinning semantics unchanged; the hardening work focuses on delivery correctness and runtime recovery, not target-selection redesign
- treated hung network calls as a bridge reliability bug and bounded them with request timeouts instead of relying on the underlying fetch to recover promptly

## Open Loops Or Known Limits

- explicit `target_thread_id` still intentionally does not auto-fallback if that exact thread is gone; this remains a deliberate pinning contract rather than part of the recovery fix
