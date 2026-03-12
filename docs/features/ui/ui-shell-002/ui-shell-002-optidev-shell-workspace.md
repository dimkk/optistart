# ui-shell-002: OptiDev shell workspace

## summary
OptiDev is mounted into the existing `t3code` shell as a separate component surface, not as a rewrite of existing chat/thread UI. The shell now exposes one integrated `/optidev` workspace with three tabs:

- `Files`
- `OptiDev`
- `Plugins`

## integration contract
- Existing `t3` shell components remain authoritative.
- OptiDev only plugs in through:
  - one route mount
  - one sidebar entry
  - native `/api/optidev/*` HTTP endpoints
- New OptiDev UI code lives in OptiDev-owned components under `ui/apps/web/src/components/optidev/`.

## files tab
- Scope: current repository root resolved by the native OptiDev backend.
- Navigation: current-folder browser with directory stepping and breadcrumb navigation.
- Viewer modes:
  - markdown: rendered or source
  - images: inline preview
  - code: syntax-highlighted viewer
  - plain text: preformatted text
- Repository file browsing is read-only.

## optidev tab
- Shows structured native session state instead of only a formatted status string.
- Exposes runtime actions:
  - `start`
  - `go`
  - `resume`
  - `reset`
  - `stop`
  - `workspace clone`
- Keeps memory summary, open loops, advice, projects, and logs visible inside the same shell surface.

## plugins tab
- Browses and edits:
  - `.agents/agents`
  - `.agents/skills`
- Manages Telegram settings from the OptiDev home config.
- Plugin editing is text-only and scoped to OptiDev-owned plugin roots.

## backend endpoints
- `GET /api/optidev/state`
- `GET /api/optidev/fs/list`
- `GET /api/optidev/fs/read`
- `GET /api/optidev/fs/raw`
- `POST /api/optidev/fs/write`
- `GET /api/optidev/telegram-config`
- `POST /api/optidev/telegram-config`
- Existing `POST /api/optidev/action` remains the mutation path for runtime and plugin actions.

## safety rules
- File access is repository-scoped or plugin-scope-scoped.
- Path traversal outside the allowed root is rejected.
- Plugin editing is allowed only for `agents` and `skills`.
- Repository files are not editable from this surface.
