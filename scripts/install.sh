#!/usr/bin/env bash
set -euo pipefail

BIN_DIR="${OPTID_BIN_DIR:-$HOME/.local/bin}"
INSTALL_DIR="${OPTID_INSTALL_DIR:-$HOME/.optidev/optistart}"
GIT_URL="${OPTID_GIT_URL:-https://github.com/dimkk/optistart}"
SCRIPT_DIR="$(cd -P "$(dirname "${BASH_SOURCE[0]:-$0}")" && pwd)"
PROFILE_FILES=()

fail() {
  printf 'install.sh error: %s\n' "$1" >&2
  exit 1
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || fail "missing required command: $1"
}

install_bun_deps() {
  local repo_dir="$1"
  local ui_dir="$repo_dir/ui"

  [[ -f "$ui_dir/package.json" ]] || fail "missing ui/package.json"
  [[ -f "$ui_dir/bun.lock" ]] || fail "missing ui/bun.lock"

  printf 'Installing Bun workspace dependencies in: %s\n' "$ui_dir"
  bun install --cwd "$ui_dir" --frozen-lockfile --ignore-scripts
}

resolve_local_repo() {
  local candidate=""
  if [[ -f "./scripts/optid" && -d "./ui/apps/server" ]]; then
    candidate="$(pwd)"
  elif [[ -f "$SCRIPT_DIR/optid" && -d "$SCRIPT_DIR/../ui/apps/server" ]]; then
    candidate="$(cd "$SCRIPT_DIR/.." && pwd)"
  fi
  printf '%s' "$candidate"
}

install_path_export() {
  local shell_name path_line os_name
  shell_name="$(basename "${SHELL:-bash}")"
  os_name="$(uname -s)"
  path_line='export PATH="$HOME/.local/bin:$PATH"'

  append_once() {
    local file="$1"
    touch "$file"
    grep -Fq "$path_line" "$file" || printf '\n%s\n' "$path_line" >>"$file"
    PROFILE_FILES+=("$file")
  }

  case "$shell_name" in
    bash)
      # macOS commonly uses login shells with ~/.bash_profile
      if [[ "$os_name" == "Darwin" ]]; then
        append_once "$HOME/.bash_profile"
      else
        append_once "$HOME/.bashrc"
      fi
      ;;
    zsh)
      # Keep both interactive and login zsh startup files in sync.
      append_once "$HOME/.zshrc"
      append_once "$HOME/.zprofile"
      ;;
    *)
      append_once "$HOME/.profile"
      ;;
  esac
}

is_sourced() {
  # Bash-compatible check: script was loaded via `source` / `.`
  [[ -n "${BASH_SOURCE[0]:-}" && "${BASH_SOURCE[0]}" != "$0" ]]
}

print_profile_instructions() {
  local file
  [[ "${#PROFILE_FILES[@]}" -gt 0 ]] || return 0

  printf 'Profile file(s) updated:\n'
  for file in "${PROFILE_FILES[@]}"; do
    printf '  - %s\n' "$file"
  done

  if is_sourced; then
    printf 'Current shell updated: PATH reloaded in this session\n'
    return 0
  fi

  printf 'To apply now in current shell, run:\n'
  for file in "${PROFILE_FILES[@]}"; do
    printf '  source %s\n' "$file"
  done
  printf 'Or open a new terminal.\n'
}

main() {
  require_cmd bun

  local repo_dir
  repo_dir="$(resolve_local_repo)"

  if [[ -n "$repo_dir" ]]; then
    printf 'Using local repository: %s\n' "$repo_dir"
  else
    require_cmd git
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

  [[ -f "$repo_dir/scripts/optid" && -d "$repo_dir/ui/apps/server" ]] || fail "invalid repository layout"
  install_bun_deps "$repo_dir"

  mkdir -p "$BIN_DIR"
  ln -sfn "$repo_dir/scripts/optid" "$BIN_DIR/optid"
  install_path_export

  printf 'Installed: %s\n' "$BIN_DIR/optid"
  if is_sourced; then
    export PATH="$BIN_DIR:$PATH"
    hash -r 2>/dev/null || true
  fi
  print_profile_instructions
  printf 'Then: optid status\n'
}

main "$@"
