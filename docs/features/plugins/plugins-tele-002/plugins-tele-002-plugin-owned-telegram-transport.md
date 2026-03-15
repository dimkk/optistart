# plugins-tele-002: Plugin-owned Telegram transport

## description
Keep Telegram runtime behavior entirely inside the Telegram plugin instead of splitting it across plugin and core messenger modules.

## current implementation state
- Telegram lifecycle behavior now lives in `ui/apps/server/src/optidevPlugins.ts`.
- Telegram config, status commands, active-project gating, and workspace event logging all run natively in the TS/Bun runtime.
- Browser and CLI surfaces share the same Telegram integration contract.
- `optid telegram start` without an explicit `threadId` now clears stale saved pins and returns Telegram to auto-target mode.
- Explicit session pinning remains supported when the UI starts Telegram with a concrete thread id.
- Auto-target mode now prefers the currently selected UI thread guid from OptiDev runtime state before falling back to project/freshness heuristics.
- The bridge emits Telegram notices when the resolved session guid changes or when it loses and later regains a valid target.
- Bridge runtime now uses deterministic inbound command/message ids plus persisted offset advancement so replayed Telegram updates do not create duplicate turns after reloads or restarts.
- Outbound relays are deduped by `messageId`, so repeated `thread.message-sent` events no longer produce repeated Telegram messages.
- Bridge polling and outbound Telegram calls are timeout-bounded so a hung network request cannot stall future bridge ticks indefinitely.
- Repeated inbound requests while no target is available now emit at most one `No active t3 thread is available yet.` reply per unavailable stretch.
- A host-level bridge lock ensures only one local server process owns Telegram polling/relay for an OptiDev home at a time; secondary processes stay passive until the owner disappears or the lock goes stale.

## implementation plan
1. Completed: move bridge client helpers into the plugin module.
2. Completed: remove messenger package usage from chat bridge.
3. Completed: add unit and e2e coverage for plugin-owned Telegram bridge behavior.
4. Completed: prefer auto-target correctness over hidden sticky session pins for plain CLI start.
5. Completed: harden duplicate suppression and recovery after reload/reconnect edge cases in the bridge runtime.
6. Completed: sync Telegram auto-targeting with the currently selected UI thread and surface guid-switch notices.
7. Completed: enforce single bridge ownership across local server processes with stale-lock takeover.
