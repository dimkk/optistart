# plugins-tele-002: Plugin-owned Telegram transport

## description
Keep Telegram runtime behavior entirely inside the Telegram plugin instead of splitting it across plugin and core messenger modules.

## current implementation state
- Telegram lifecycle behavior now lives in `ui/apps/server/src/optidevPlugins.ts`.
- Telegram config, status commands, active-project gating, and workspace event logging all run natively in the TS/Bun runtime.
- Browser and CLI surfaces share the same Telegram integration contract.

## implementation plan
1. Completed: move bridge client helpers into the plugin module.
2. Completed: remove messenger package usage from chat bridge.
3. Completed: add unit and e2e coverage for plugin-owned Telegram bridge behavior.
