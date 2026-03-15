# task23

## goal
- Eliminate Telegram/UI session drift so the bridge follows the currently selected `t3code` thread instead of a freshness-only guess.
- Surface explicit Telegram notices when the resolved target session guid changes.
- Harden the bridge against duplicate outbound relays and repeated "No active t3 thread is available yet." spam.

## architecture
- Reuse the existing OptiDev Telegram bridge in `ui/apps/server/src/optidevTelegramBridge.ts` rather than adding a second transport path.
- Persist the currently selected UI thread into the existing OptiDev runtime state so Telegram auto-target resolution has a runtime source of truth beyond `active_session.project`.
- Extend bridge state tracking so target resolution changes can emit one Telegram notice per actual transition instead of guessing every tick.
- Add outbound relay dedupe keyed by message id so repeated domain events do not produce repeated Telegram messages.
- Add a host-level bridge ownership lock so only one local server process can poll and relay Telegram traffic for the active OptiDev home.

## atomic features
- Record the active UI thread guid whenever the operator switches chat sessions.
- Prefer the recorded active thread guid during Telegram target resolution when no explicit pin is configured.
- Emit Telegram switch/lost-target notices with previous and current thread guid values.
- Suppress repeated unavailable-target notices until availability changes again.
- Dedupe repeated outbound relays for assistant and non-Telegram user messages.
- Prevent concurrent Telegram polling/relay ownership across multiple local server processes.

## test plan
- Add bridge tests for active-thread-guid targeting, switch notices, lost-target notice suppression, and outbound dedupe.
- Add bridge lock tests for second-process denial and stale-lock takeover.
- Add route tests for persisting the current active UI thread.
- Add browser coverage for UI-triggered active-thread persistence if the existing route/browser suite needs it.
- Re-run targeted Telegram bridge/route/browser coverage after implementation.

## approvals / notes
- User explicitly reported live Telegram/UI session drift, duplicated model messages, and missing switch feedback.
- User explicitly wants Telegram to report session guid changes when the active session changes.
