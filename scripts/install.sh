#!/usr/bin/env bash
set -euo pipefail

BIN_DIR="${OPTID_BIN_DIR:-$HOME/.local/bin}"
INSTALL_ROOT="${OPTID_INSTALL_DIR:-$HOME/.optidev/optistart}"
MANIFEST_URL="${OPTID_MANIFEST_URL:-https://raw.githubusercontent.com/dimkk/optistart/main/scripts/release-manifest.json}"
GIT_REF="${OPTID_GIT_REF:-}"
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

  printf 'Building bundled UI in: %s\n' "$ui_dir"
  (cd "$ui_dir" && bun run build)
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

require_build_cmds() {
  require_cmd bun
  require_cmd curl
  require_cmd tar
  require_cmd node
}

fetch_release_manifest() {
  local target="$1"
  curl -fsSL "$MANIFEST_URL" -o "$target"
}

sanitize_ref_name() {
  printf '%s' "$1" | tr '/:\\ ' '----'
}

json_field() {
  local file="$1"
  local expression="$2"
  bun -e "const data = JSON.parse(require('node:fs').readFileSync(process.argv[1], 'utf8')); const value = ${expression}; if (value === undefined || value === null) process.exit(1); process.stdout.write(String(value));" "$file"
}

resolve_release_version() {
  local manifest_file="$1"
  if [[ -n "${OPTID_VERSION:-}" ]]; then
    printf '%s' "$OPTID_VERSION"
    return 0
  fi
  json_field "$manifest_file" "data.version"
}

resolve_release_archive_url() {
  local manifest_file="$1"
  local version="$2"
  local archive_base_url
  archive_base_url="$(json_field "$manifest_file" "data.install.archiveBaseUrl")"
  printf '%s/v%s.tar.gz' "$archive_base_url" "$version"
}

install_remote_release() {
  local manifest_file="$1"
  local version="$2"
  local archive_url="$3"
  local releases_dir="$INSTALL_ROOT/releases"
  local release_dir="$releases_dir/v$version"
  local current_link="$INSTALL_ROOT/current"

  mkdir -p "$releases_dir"

  if [[ ! -d "$release_dir" ]]; then
    local tmp_dir archive_path
    tmp_dir="$(mktemp -d)"
    archive_path="$tmp_dir/optid-release.tar.gz"

    printf 'Downloading release archive: %s\n' "$archive_url"
    curl -fsSL "$archive_url" -o "$archive_path"
    mkdir -p "$release_dir"
    tar -xzf "$archive_path" -C "$release_dir" --strip-components=1
  else
    printf 'Using existing release directory: %s\n' "$release_dir"
  fi

  install_bun_deps "$release_dir"
  mkdir -p "$INSTALL_ROOT"
  ln -sfn "$release_dir" "$current_link"
  printf '%s' "$current_link"
}

resolve_branch_archive_url() {
  local manifest_file="$1"
  local git_ref="$2"
  local repository_url
  repository_url="$(json_field "$manifest_file" "data.repository.url")"
  printf '%s/archive/refs/heads/%s.tar.gz' "$repository_url" "$git_ref"
}

install_remote_branch_snapshot() {
  local manifest_file="$1"
  local git_ref="$2"
  local archive_url="$3"
  local branches_dir="$INSTALL_ROOT/branches"
  local safe_ref
  safe_ref="$(sanitize_ref_name "$git_ref")"
  local branch_dir="$branches_dir/$safe_ref"
  local current_link="$INSTALL_ROOT/current"

  mkdir -p "$branches_dir"

  if [[ ! -d "$branch_dir" ]]; then
    local tmp_dir archive_path
    tmp_dir="$(mktemp -d)"
    archive_path="$tmp_dir/optid-branch.tar.gz"

    printf 'Downloading branch snapshot: %s\n' "$archive_url"
    curl -fsSL "$archive_url" -o "$archive_path"
    mkdir -p "$branch_dir"
    tar -xzf "$archive_path" -C "$branch_dir" --strip-components=1
  else
    printf 'Using existing branch directory: %s\n' "$branch_dir"
  fi

  install_bun_deps "$branch_dir"
  mkdir -p "$INSTALL_ROOT"
  ln -sfn "$branch_dir" "$current_link"
  printf '%s' "$current_link"
}

main() {
  require_build_cmds

  local repo_dir
  local should_bootstrap_repo=1
  repo_dir="$(resolve_local_repo)"

  if [[ -n "$repo_dir" ]]; then
    printf 'Using local repository: %s\n' "$repo_dir"
  else
    local manifest_file version archive_url
    manifest_file="$(mktemp)"
    fetch_release_manifest "$manifest_file"
    if [[ -n "$GIT_REF" ]]; then
      archive_url="$(resolve_branch_archive_url "$manifest_file" "$GIT_REF")"
      printf 'Installing branch snapshot: %s\n' "$GIT_REF"
      repo_dir="$(install_remote_branch_snapshot "$manifest_file" "$GIT_REF" "$archive_url")"
    else
      version="$(resolve_release_version "$manifest_file")"
      archive_url="$(resolve_release_archive_url "$manifest_file" "$version")"
      printf 'Installing release version: v%s\n' "$version"
      repo_dir="$(install_remote_release "$manifest_file" "$version" "$archive_url")"
    fi
    should_bootstrap_repo=0
  fi

  [[ -f "$repo_dir/scripts/optid" && -d "$repo_dir/ui/apps/server" ]] || fail "invalid repository layout"
  if [[ "$should_bootstrap_repo" -eq 1 ]]; then
    install_bun_deps "$repo_dir"
  fi

  mkdir -p "$BIN_DIR"
  ln -sfn "$repo_dir/scripts/optid" "$BIN_DIR/optid"
  install_path_export

  printf 'Installed: %s\n' "$BIN_DIR/optid"
  if is_sourced; then
    export PATH="$BIN_DIR:$PATH"
    hash -r 2>/dev/null || true
  fi
  print_profile_instructions
  printf 'Then: optid\n'
}

main "$@"
