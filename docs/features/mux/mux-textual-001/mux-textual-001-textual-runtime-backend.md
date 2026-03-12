# mux-textual-001: Textual runtime backend

## Summary
Add a second workspace runtime backend implemented with `Textual`, while preserving the existing backend abstraction and `zellij` support.

## Behavior
- Global config accepts `mux_backend: textual`.
- Backend selection happens through the existing factory layer.
- Workspace startup still resolves the same backend-agnostic `layout_spec`.
- `zellij` continues to render `layout.kdl` and attach externally.
- `textual` writes a layout payload and launches a foreground terminal UI through the CLI attach path.
- Session metadata remains stored in the existing `mux_*` fields for compatibility in this cycle.

## Notes
- This feature intentionally avoids a broader persistence/schema rename.
- The `Textual` backend is a fallback runtime path for environments where the external multiplexer path is unreliable or unavailable.
