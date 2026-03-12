#!/usr/bin/env bash
set -euo pipefail

repo_root="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$repo_root"

require_path() {
  local target="$1"
  if [[ ! -e "$target" ]]; then
    echo "missing required path: $target" >&2
    exit 1
  fi
}

forbidden_active_path() {
  local target="$1"
  if [[ -e "$target" ]]; then
    echo "obsolete path still active: $target" >&2
    exit 1
  fi
}

require_path "docs/v1-2/features-matrix.md"
require_path "docs/v1-2/test-matrix.md"
require_path "docs/guides/optidev-ui-guide.md"
require_path "docs/tasks/task8.md"
require_path "docs/tasks/task9.md"
require_path "docs/releases/v1-2.md"
require_path "docs/features/repo/repo-docs-002/repo-docs-002-obsolete-docs-quarantine.md"

require_path "docs/obsolete/v1-0/features-matrix.md"
require_path "docs/obsolete/v1-1/features-matrix.md"
require_path "docs/obsolete/releases/v1-1.md"
require_path "docs/obsolete/sequence/optid-start-sequence.md"
require_path "docs/obsolete/tasks/task1-init.md"
require_path "docs/obsolete/tasks/task6.md"
require_path "docs/obsolete/features/cfg/cfg-load-001/cfg-load-001-config-loading-and-validation.md"
require_path "docs/obsolete/features/ws/ws-session-001/ws-session-001-workspace-session-restore-bootstrap.md"

forbidden_active_path "docs/v1-0"
forbidden_active_path "docs/v1-1"
forbidden_active_path "docs/releases/v1-1.md"
forbidden_active_path "docs/sequence"
forbidden_active_path "docs/task1-human.md"
forbidden_active_path "docs/task2-human.md"
forbidden_active_path "docs/task3-human.md"
forbidden_active_path "docs/tasks/task1-init.md"
forbidden_active_path "docs/tasks/task2-init.md"
forbidden_active_path "docs/tasks/task3-init.md"
forbidden_active_path "docs/tasks/task4-init.md"
forbidden_active_path "docs/tasks/task5.md"
forbidden_active_path "docs/tasks/task6.md"
forbidden_active_path "docs/features/cfg"
forbidden_active_path "docs/features/manifest"
forbidden_active_path "docs/features/ws"

echo "doc layout verified"
