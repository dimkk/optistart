# plugins-advice-001: Repository advice startup plugin

## description
Add an advice plugin that can participate in workspace startup and inject an initial prompt for the runner when `optid start ... --advice` or `optid go ... --advice` is used.

The goal is to make advice an extension, not a hardcoded special case in the core CLI.

## current implementation state
- Startup plugin hook exists through `prepare_workspace_start(...)`.
- Advice plugin lives in `optidev/plugins/advice.py`.
- Repo analysis helper lives in `optidev/advice.py`.
- App aggregates plugin startup prompts and writes a session-local `startup-prompt.txt`.
- Chat bridge can consume `--initial-prompt-file` and send the prompt to the runner after startup.

## implementation plan
1. Add a plugin startup preparation hook in the plugin manager.
2. Implement repo summary generation as a reusable helper.
3. Implement advice plugin on top of the startup hook.
4. Extend `start/go` with `--advice`.
5. Pass startup prompt file into the chat bridge.
6. Cover repo summary, hook aggregation, and end-to-end startup prompt creation with tests.
