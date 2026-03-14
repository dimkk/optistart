# ui-shell-002: OptiDev shell workspace

## summary
OptiDev is mounted into the existing `t3code` shell as a separate component surface, not as a rewrite of existing chat/thread UI. The shell exposes one integrated `/optidev` workspace with three stable tabs:

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
- Manifest-first workspace behavior is layered on top of this shell contract and documented separately under `ui-shell-003`.

## files tab
- Scope: current repository root resolved by the native OptiDev backend.
- Navigation: current-folder browser with directory stepping and breadcrumb navigation.
- Viewer modes:
  - markdown: rendered through the shared t3 markdown renderer or shown as source
  - images: inline preview
  - code: syntax-highlighted viewer
  - plain text: preformatted text
- Repository file browsing is read-only.

## optidev tab
- Shows structured native session state instead of only a formatted status string.
- Hosts the manifest-first workspace management flow documented in `ui-shell-003`.
- Keeps runtime controls, memory context, projects, status, and logs visible inside the same shell surface.

## plugins tab
- Shows a live native plugin inventory.
- Surfaces plugin category, enabled state, and key status details.
- Does not currently expose plugin file editing.

## backend endpoints
- `GET /api/optidev/state`
- `GET /api/optidev/manifest`
- `POST /api/optidev/manifest`
- `POST /api/optidev/manifest/impact`
- `GET /api/optidev/memory-graph`
- `GET /api/optidev/plugins`
- `GET /api/optidev/fs/list`
- `GET /api/optidev/fs/read`
- `GET /api/optidev/fs/raw`
- `POST /api/optidev/fs/write`
- Existing `POST /api/optidev/action` remains the mutation path for runtime and plugin actions.

## safety rules
- File access is repository-scoped or plugin-scope-scoped.
- Path traversal outside the allowed root is rejected.
- Repository files are not editable from this surface.
- Plugin inventory is read-only from this surface until a narrower editing contract is approved.
