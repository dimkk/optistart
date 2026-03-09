# plugins-tele-001: Telegram chat bridge plugin

## Goal
Allow OptiDev users to enable or disable Telegram access with a CLI command and mirror the active workspace `chat` pane in both directions:

- local terminal input -> runner -> Telegram
- Telegram input -> active `chat` pane
- runner output -> terminal + Telegram

## Final behavior

- `optid telegram start --token <token> --chat-id <chat-id>` saves Telegram configuration in `~/.optidev/plugins/telegram-config.json`
- `optid telegram stop` disables Telegram without deleting the saved token/chat id
- `optid telegram status` reports whether the bridge is enabled and which active workspace will use it
- the `chat` pane now starts a dedicated bridge runtime instead of a plain `bash`
- the bridge launches the configured runner locally and mirrors terminal traffic to Telegram
- only the active running workspace is allowed to poll Telegram updates, preventing multiple workspaces from fighting over the same bot
- Telegram-specific transport now lives directly in the Telegram plugin module used by the chat bridge

## Implementation notes

1. Persist Telegram configuration in OptiDev home rather than relying only on process env vars.
2. Start the `chat` pane with `python -m optidev.chat_bridge ...` through the `zellij` layout.
3. Keep Telegram transport helpers inside `optidev/plugins/telegram.py`.
4. Mirror local input lines as `[you] ...` and terminal output as `[chat] ...`.
5. Support Telegram control commands: `/help`, `/esc`, `/ctrlc`, `/enter`, `/status`, `/stop`.
6. Keep `init` idempotent so project structure is not rewritten on repeated initialization.

## Validation

- unit tests for Telegram config lifecycle
- unit tests for zellij chat bridge layout rendering
- integration/e2e tests for idempotent `init`
- live smoke for `optid telegram start/status/stop`
