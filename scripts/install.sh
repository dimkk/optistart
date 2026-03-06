#!/usr/bin/env bash
set -euo pipefail

BIN_DIR="${OPTID_BIN_DIR:-$HOME/.local/bin}"
INSTALL_DIR="${OPTID_INSTALL_DIR:-$HOME/.optidev/optistart}"
GIT_URL="${OPTID_GIT_URL:-}"
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"

fail() {
  printf 'install.sh error: %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

check_python() {
  python3 - <<'PY' || exit 1
import sys
if sys.version_info < (3, 12):
    raise SystemExit("Python 3.12+ is required")
print(f"Detected Python {sys.version.split()[0]}")
PY
}

resolve_local_repo() {
  local candidate=""
  if [[ -f "./scripts/optid" && -d "./optidev" ]]; then
    candidate="$(pwd)"
  elif [[ -f "$SCRIPT_DIR/optid" && -d "$SCRIPT_DIR/../optidev" ]]; then
    candidate="$(cd "$SCRIPT_DIR/.." && pwd)"
  fi
  printf '%s' "$candidate"
}

install_path_export() {
  local shell_name rc_file path_line
  shell_name="$(basename "${SHELL:-bash}")"
  path_line='export PATH="$HOME/.local/bin:$PATH"'
  case "$shell_name" in
    bash) rc_file="$HOME/.bashrc" ;;
    zsh) rc_file="$HOME/.zshrc" ;;
    *) rc_file="$HOME/.profile" ;;
  esac
  touch "$rc_file"
  grep -Fq "$path_line" "$rc_file" || printf '\n%s\n' "$path_line" >>"$rc_file"
}

main() {
  require_cmd python3
  check_python

  local repo_dir
  repo_dir="$(resolve_local_repo)"

  if [[ -n "$repo_dir" ]]; then
    printf 'Using local repository: %s\n' "$repo_dir"
  else
    require_cmd git
    [[ -n "$GIT_URL" ]] || fail "set OPTID_GIT_URL to clone from git"
    mkdir -p "$(dirname "$INSTALL_DIR")"
    if [[ -d "$INSTALL_DIR/.git" ]]; then
      printf 'Updating existing repository: %s\n' "$INSTALL_DIR"
      git -C "$INSTALL_DIR" pull --ff-only
    else
      printf 'Cloning repository to: %s\n' "$INSTALL_DIR"
      git clone "$GIT_URL" "$INSTALL_DIR"
    fi
    repo_dir="$INSTALL_DIR"
  fi

  [[ -f "$repo_dir/scripts/optid" && -d "$repo_dir/optidev" ]] || fail "invalid repository layout"

  mkdir -p "$BIN_DIR"
  ln -sfn "$repo_dir/scripts/optid" "$BIN_DIR/optid"
  install_path_export

  printf 'Installed: %s\n' "$BIN_DIR/optid"
  printf 'Next: restart shell or run: source ~/.bashrc\n'
  printf 'Then: optid status\n'
}

main "$@"
