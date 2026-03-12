$ErrorActionPreference = "Stop"

$ScriptPath = $MyInvocation.MyCommand.Path
while ((Get-Item $ScriptPath).LinkType) {
  $target = (Get-Item $ScriptPath).Target
  if ([System.IO.Path]::IsPathRooted($target)) {
    $ScriptPath = $target
  } else {
    $ScriptPath = Join-Path (Split-Path $ScriptPath -Parent) $target
  }
}

$RootDir = Resolve-Path (Join-Path (Split-Path $ScriptPath -Parent) "..")

if (-not (Get-Command bun -ErrorAction SilentlyContinue)) {
  Write-Error "optid error: missing required command: bun"
  exit 1
}

& bun (Join-Path $RootDir "scripts/optid-runner.mjs") --root $RootDir @args
exit $LASTEXITCODE
