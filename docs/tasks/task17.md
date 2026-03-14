# Task 17

## goal
Close the real Telegram bridge gap in the native OptiDev runtime so Telegram can attach to the active `t3code` chat thread, send user text into that thread through the standard orchestration/provider path, and deliver assistant replies back to the configured Telegram chat. Expose that runtime state in the UI with an explicit on/off control and make thread targeting deterministic when multiple chat sessions try to enable Telegram.
Continue the same task by tightening thread-switch UX: when the user changes sessions, the UI must acknowledge the action immediately with visible loading or error feedback, avoid dropping out of chat during slow restores, and keep Telegram pinned to the last explicitly selected thread instead of silently drifting to a fallback thread.

## architecture
- Keep Telegram behavior plugin-owned, but run the live bridge inside the long-lived server runtime instead of leaving `telegram start|status|stop` as config-only helpers.
- Restore persisted Codex provider sessions on server startup through the existing `ProviderService` recovery path so direct thread routes continue receiving live updates after backend restarts without requiring a fresh manual `codex_connect`.
- Reuse the existing `t3code` command path for inbound Telegram messages:
  - resolve the active OptiDev project from `active_session.json`
  - resolve the active thread for that project from the orchestration snapshot
  - dispatch `thread.turn.start` with a normal user message
- Reuse the existing `t3code` event path for outbound Telegram delivery:
  - observe live orchestration domain events
  - mirror matching thread messages to Telegram via `sendMessage`
  - avoid echoing Telegram-originated user turns back into the same chat
- Persist Telegram polling state locally so server restarts do not replay old updates.
- Keep CLI/UI config flow unchanged:
  - `telegram-config` still edits saved token/chat settings
  - `optid telegram start|status|stop` still owns enable/disable lifecycle
  - the bridge runtime reacts to that saved config inside the server process
- Extend the saved Telegram plugin config with the last explicitly enabled thread id.
  - Enabling Telegram from a thread-scoped UI control writes that thread id into plugin state.
  - If multiple sessions enable Telegram, the last enabled thread wins until another thread enables it or the bridge is stopped.
- Surface bridge status in the UI from the same persisted plugin/runtime contract instead of introducing a separate frontend-only toggle state.
- Reuse the existing thread route and snapshot hydration path instead of inventing a parallel frontend session loader:
  - keep the last successfully rendered thread visible while the next thread is resolving
  - show an explicit loading/error overlay during slow thread restores
  - do not silently navigate away from chat just because the target thread is still rehydrating
- Treat the saved Telegram target thread as authoritative:
  - when `target_thread_id` is set, the bridge must only use that thread
  - if that thread is temporarily unavailable, report that no Telegram target is available yet instead of falling back to another active thread

## atomic features
- `plugins-tele-002`:
  Complete the plugin-owned Telegram transport so it performs real inbound/outbound chat bridging instead of only config/state bookkeeping, and expose deterministic thread-scoped bridge control/status in the UI.

## test plan
- Unit:
  Cover Telegram config/runtime state resolution, explicit target-thread precedence, strict no-fallback behavior when the preferred thread is missing, inbound update filtering, outbound send filtering, update offset persistence, and provider session startup recovery.
- Integration:
  Validate the live server route/runtime with a fake Telegram HTTP API, including `telegram start`, assistant outbound delivery, inbound Telegram text dispatch into `thread.turn.start`, persisted Codex session recovery after server restart, and strict thread-target override when Telegram is enabled from different sessions.
- E2E:
  Validate the shipped Telegram bridge behavior end-to-end against a fake Telegram API from the running native server process, plus direct thread-route recovery after backend restart, visible UI status/toggle behavior, and visible loading feedback during thread switches.
- Live verification:
  Start the bridge with the user-provided bot token and chat id, confirm outbound replies mirror to Telegram from the selected thread, confirm the direct `/threadId` route keeps receiving live Codex updates after a backend restart without a manual reconnect, and confirm the UI shows whether Telegram is active for the current thread.

## approvals / notes
- User explicitly asked on 2026-03-13 to continue until the Telegram path is actually working and tested, not merely configured.
- Existing docs/tests overstated `plugins-tele-002`; the current code only covered config, status, and event logging, so this task completes the real transport contract.
- Live Telegram outbound and inbound are both confirmed against the real bot/chat. A real Telegram message (`пинг`) reached the active thread through the bridge and the assistant reply was mirrored back to Telegram.
- Follow-up approved on 2026-03-13: show Telegram runtime state in the UI, add an enable/disable switch, and keep the last enabled session as the active mirrored session when multiple sessions enable Telegram.
- Follow-up approved on 2026-03-13: finish the previous Build Info task first, then make slow thread switches visibly acknowledge the user action, stop dropping out of chat during restores, and codify feedback/state-preservation rules in `AGENTS.md`.
