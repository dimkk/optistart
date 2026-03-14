# plugins-tele-002: Plugin-owned Telegram transport

## description
Keep Telegram runtime behavior entirely inside the Telegram plugin instead of splitting it across plugin and core messenger modules.

## current implementation state
- Telegram lifecycle behavior now lives in `ui/apps/server/src/optidevPlugins.ts`.
- Telegram config, status commands, active-project gating, and workspace event logging all run natively in the TS/Bun runtime.
- Browser and CLI surfaces share the same Telegram integration contract.
- `optid telegram start` without an explicit `threadId` now clears stale saved pins and returns Telegram to auto-target mode.
- Explicit session pinning remains supported when the UI starts Telegram with a concrete thread id.
- Bridge runtime now uses deterministic inbound command/message ids plus persisted offset advancement so replayed Telegram updates do not create duplicate turns after reloads or restarts.
- Bridge polling and outbound Telegram calls are timeout-bounded so a hung network request cannot stall future bridge ticks indefinitely.

## implementation plan
1. Completed: move bridge client helpers into the plugin module.
2. Completed: remove messenger package usage from chat bridge.
3. Completed: add unit and e2e coverage for plugin-owned Telegram bridge behavior.
4. Completed: prefer auto-target correctness over hidden sticky session pins for plain CLI start.
5. Completed: harden duplicate suppression and recovery after reload/reconnect edge cases in the bridge runtime.
