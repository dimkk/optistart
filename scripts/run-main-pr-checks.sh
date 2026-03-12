#!/usr/bin/env bash
set -euo pipefail

SOURCE="${BASH_SOURCE[0]}"
while [ -h "$SOURCE" ]; do
  DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
  SOURCE="$(readlink "$SOURCE")"
  [[ "$SOURCE" != /* ]] && SOURCE="$DIR/$SOURCE"
done
ROOT_DIR="$(cd -P "$(dirname "$SOURCE")" && pwd)"
ROOT_DIR="$(cd -P "$ROOT_DIR/.." && pwd)"

printf '==> Installing vendored UI dependencies\n'
bun install --cwd "$ROOT_DIR/ui" --frozen-lockfile

printf '==> Running repository-owned script tests\n'
(
  cd "$ROOT_DIR"
  node --test scripts/release-lib.test.mjs scripts/optid-launcher-lib.test.mjs scripts/t3code-sync.test.mjs
)

printf '==> Verifying repository layout and launcher shims\n'
(
  cd "$ROOT_DIR"
  bash scripts/verify-doc-layout.sh
  bash -n scripts/install.sh scripts/optid
)

printf '==> Running vendored UI lint and test suites\n'
(
  cd "$ROOT_DIR/ui"
  bun run lint
  bun run test
)

printf '==> Installing browser runtime for OptiDev route tests\n'
(
  cd "$ROOT_DIR/ui/apps/web"
  if ! bun run test:browser:install; then
    printf '==> Falling back to browser-only Playwright install without system package escalation\n'
    bun x playwright install chromium
  fi
)

printf '==> Running browser OptiDev route suite\n'
(
  cd "$ROOT_DIR/ui/apps/web"
  bun run test:browser -- src/routes/-optidev.browser.tsx
)
