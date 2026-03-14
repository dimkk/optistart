$ErrorActionPreference = "Stop"

$BinDir = if ($env:OPTID_BIN_DIR) { $env:OPTID_BIN_DIR } else { Join-Path $env:LOCALAPPDATA "optid\bin" }
$InstallRoot = if ($env:OPTID_INSTALL_DIR) { $env:OPTID_INSTALL_DIR } else { Join-Path $HOME ".optidev\optistart" }
$GitRef = if ($env:OPTID_GIT_REF) { $env:OPTID_GIT_REF } else { $null }
$ManifestUrl = if ($env:OPTID_MANIFEST_URL) {
  $env:OPTID_MANIFEST_URL
} elseif ($GitRef) {
  "https://raw.githubusercontent.com/dimkk/optistart/$GitRef/scripts/release-manifest.json"
} else {
  "https://raw.githubusercontent.com/dimkk/optistart/main/scripts/release-manifest.json"
}

function Fail($Message) {
  throw "install.ps1 error: $Message"
}

function Require-Command($Name) {
  if (-not (Get-Command $Name -ErrorAction SilentlyContinue)) {
    Fail "missing required command: $Name"
  }
}

function Resolve-LocalRepo {
  if ((Test-Path ".\scripts\optid.ps1") -and (Test-Path ".\ui\apps\server")) {
    return (Resolve-Path ".").Path
  }

  if ($PSScriptRoot -and $PSScriptRoot.Trim().Length -gt 0) {
    $scriptRepo = Resolve-Path (Join-Path $PSScriptRoot "..")
    if ((Test-Path (Join-Path $scriptRepo "scripts\optid.ps1")) -and (Test-Path (Join-Path $scriptRepo "ui\apps\server"))) {
      return $scriptRepo.Path
    }
  }

  return $null
}

function Normalize-PathEntry {
  param([string]$PathEntry)

  if (-not $PathEntry) {
    return ""
  }

  return $PathEntry.Trim().TrimEnd("\")
}

function Path-ContainsEntry {
  param(
    [string]$PathValue,
    [string]$Entry
  )

  $normalizedEntry = Normalize-PathEntry $Entry
  if (-not $normalizedEntry) {
    return $false
  }

  foreach ($candidate in ($PathValue -split ";")) {
    if ((Normalize-PathEntry $candidate) -ieq $normalizedEntry) {
      return $true
    }
  }

  return $false
}

function Append-PathEntry {
  param(
    [string]$PathValue,
    [string]$Entry
  )

  if (-not $PathValue) {
    return $Entry
  }

  return "$PathValue;$Entry"
}

function Ensure-BinDirOnPath {
  param([string]$BinDir)

  $sessionPath = [string]$env:PATH
  if (-not (Path-ContainsEntry -PathValue $sessionPath -Entry $BinDir)) {
    $env:PATH = Append-PathEntry -PathValue $sessionPath -Entry $BinDir
    Write-Host "Updated current session PATH: $BinDir"
  }

  $userPath = [Environment]::GetEnvironmentVariable("Path", "User")
  if (-not (Path-ContainsEntry -PathValue $userPath -Entry $BinDir)) {
    [Environment]::SetEnvironmentVariable("Path", (Append-PathEntry -PathValue $userPath -Entry $BinDir), "User")
    Write-Host "Added to user PATH: $BinDir"
  }
}

function Install-SourceRuntime($RepoDir) {
  $uiDir = Join-Path $RepoDir "ui"
  if (-not (Test-Path (Join-Path $uiDir "package.json"))) {
    Fail "missing ui/package.json"
  }

  Write-Host "Installing Bun workspace dependencies in: $uiDir"
  & bun install --cwd $uiDir --frozen-lockfile --ignore-scripts
  if ($LASTEXITCODE -ne 0) {
    exit $LASTEXITCODE
  }

  Write-Host "Building runtime assets in: $uiDir"
  Push-Location $uiDir
  try {
    & bun run build:runtime
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } finally {
    Pop-Location
  }
}

function Install-ReleaseRuntimeDeps($RepoDir) {
  $serverDir = Join-Path $RepoDir "ui\apps\server"
  if (-not (Test-Path (Join-Path $serverDir "package.json"))) {
    Fail "missing ui/apps/server/package.json"
  }

  Write-Host "Installing production server dependencies in: $serverDir"
  Push-Location $serverDir
  try {
    & npm install --omit=dev --no-fund --no-audit
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } finally {
    Pop-Location
  }
}

function Install-ReleaseSnapshot {
  param(
    [string]$ManifestUrl,
    [string]$InstallRoot
  )

  $manifest = Invoke-RestMethod -Uri $ManifestUrl -UseBasicParsing
  $version = if ($env:OPTID_VERSION) { $env:OPTID_VERSION } else { $manifest.version }
  $releaseDir = Join-Path $InstallRoot "releases\v$version"
  $currentDir = Join-Path $InstallRoot "current"
  $bundleUrl = "$($manifest.install.bundleBaseUrl)/v$version/optid-$version.tar.gz"

  if (-not (Test-Path $releaseDir)) {
    $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("optid-release-" + [System.Guid]::NewGuid())
    $tarPath = Join-Path $tempDir "optid-release.tar.gz"
    New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
    New-Item -ItemType Directory -Force -Path $releaseDir | Out-Null

    Write-Host "Downloading release archive: $bundleUrl"
    Invoke-WebRequest -Uri $bundleUrl -OutFile $tarPath -UseBasicParsing
    & tar -xzf $tarPath -C $releaseDir --strip-components=1
    if ($LASTEXITCODE -ne 0) {
      exit $LASTEXITCODE
    }
  } else {
    Write-Host "Using existing release directory: $releaseDir"
  }

  Install-ReleaseRuntimeDeps $releaseDir

  New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
  if (Test-Path $currentDir) {
    Remove-Item $currentDir -Recurse -Force
  }
  New-Item -ItemType Junction -Path $currentDir -Target $releaseDir | Out-Null
  return $currentDir
}

function Get-SafeRefName {
  param([string]$RefName)

  return ($RefName -replace "[/\\:\s]", "-")
}

function Install-BranchSnapshot {
  param(
    [string]$ManifestUrl,
    [string]$InstallRoot,
    [string]$GitRef
  )

  $manifest = Invoke-RestMethod -Uri $ManifestUrl -UseBasicParsing
  $safeRef = Get-SafeRefName $GitRef
  $branchDir = Join-Path $InstallRoot "branches\$safeRef"
  $currentDir = Join-Path $InstallRoot "current"
  $zipUrl = "$($manifest.repository.url)/archive/refs/heads/$GitRef.zip"

  if (Test-Path $currentDir) {
    Remove-Item $currentDir -Recurse -Force
  }

  if (Test-Path $branchDir) {
    Write-Host "Refreshing existing branch directory: $branchDir"
    Remove-Item $branchDir -Recurse -Force
  }

  $tempDir = Join-Path ([System.IO.Path]::GetTempPath()) ("optid-branch-" + [System.Guid]::NewGuid())
  $zipPath = Join-Path $tempDir "optid-branch.zip"
  New-Item -ItemType Directory -Force -Path $tempDir | Out-Null
  New-Item -ItemType Directory -Force -Path $branchDir | Out-Null

  Write-Host "Downloading branch snapshot: $zipUrl"
  Invoke-WebRequest -Uri $zipUrl -OutFile $zipPath -UseBasicParsing
  Expand-Archive -Path $zipPath -DestinationPath $tempDir -Force

  $expandedRoot = Get-ChildItem $tempDir -Directory | Where-Object { $_.Name -ne "branches" } | Select-Object -First 1
  if (-not $expandedRoot) {
    Fail "failed to extract branch archive"
  }

  Get-ChildItem $expandedRoot.FullName -Force | ForEach-Object {
    Move-Item $_.FullName $branchDir -Force
  }

  Install-SourceRuntime $branchDir

  New-Item -ItemType Directory -Force -Path $InstallRoot | Out-Null
  New-Item -ItemType Junction -Path $currentDir -Target $branchDir | Out-Null
  return $currentDir
}

function Write-WindowsShim {
  param(
    [string]$CurrentDir,
    [string]$BinDir
  )

  New-Item -ItemType Directory -Force -Path $BinDir | Out-Null
  $cmdPath = Join-Path $BinDir "optid.cmd"
  $ps1Path = Join-Path $BinDir "optid.ps1"

  @"
@echo off
setlocal
where node >nul 2>nul
if errorlevel 1 (
  echo optid error: missing required command: node 1>&2
  exit /b 1
)
node "$CurrentDir\scripts\optid-runner.mjs" --root "$CurrentDir" %*
exit /b %errorlevel%
"@ | Set-Content -Path $cmdPath -Encoding ASCII

  @"
\$ErrorActionPreference = "Stop"
if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Write-Error "optid error: missing required command: node"
  exit 1
}
& node "$CurrentDir\scripts\optid-runner.mjs" --root "$CurrentDir" @args
exit \$LASTEXITCODE
"@ | Set-Content -Path $ps1Path -Encoding ASCII
}

Require-Command node

$repoDir = Resolve-LocalRepo
if ($repoDir) {
  Require-Command bun
  Write-Host "Using local repository: $repoDir"
  Install-SourceRuntime $repoDir
} else {
  if ($GitRef) {
    Require-Command bun
    Write-Host "Installing branch snapshot: $GitRef"
    $repoDir = Install-BranchSnapshot -ManifestUrl $ManifestUrl -InstallRoot $InstallRoot -GitRef $GitRef
  } else {
    Require-Command npm
    Require-Command tar
    $repoDir = Install-ReleaseSnapshot -ManifestUrl $ManifestUrl -InstallRoot $InstallRoot
  }
}

Write-WindowsShim -CurrentDir $repoDir -BinDir $BinDir
Ensure-BinDirOnPath -BinDir $BinDir
Write-Host "Installed: $(Join-Path $BinDir 'optid.cmd')"
Write-Host "Then: optid"
