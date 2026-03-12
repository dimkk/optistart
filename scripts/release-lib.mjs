import { spawnSync } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

export const RELEASE_MANIFEST_PATH = "scripts/release-manifest.json";

export const VERSIONED_PACKAGE_JSON_PATHS = [
  "ui/apps/server/package.json",
  "ui/apps/web/package.json",
  "ui/apps/desktop/package.json",
  "ui/apps/marketing/package.json",
  "ui/packages/contracts/package.json",
  "ui/packages/shared/package.json",
];

const SEMVER_PATTERN =
  /^(?<major>0|[1-9]\d*)\.(?<minor>0|[1-9]\d*)\.(?<patch>0|[1-9]\d*)(?:-(?<prerelease>[0-9A-Za-z.-]+))?$/;

export class ReleaseError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "ReleaseError";
    this.code = options.code ?? "RELEASE_ERROR";
    this.details = options.details ?? {};
  }
}

export function parseSemver(version) {
  const match = version.match(SEMVER_PATTERN);
  if (!match?.groups) {
    throw new ReleaseError(`invalid semver version: ${version}`, {
      code: "INVALID_VERSION",
    });
  }

  return {
    major: Number(match.groups.major),
    minor: Number(match.groups.minor),
    patch: Number(match.groups.patch),
    prerelease: match.groups.prerelease ?? null,
    raw: version,
  };
}

function compareIdentifiers(left, right) {
  const leftNumeric = /^\d+$/.test(left);
  const rightNumeric = /^\d+$/.test(right);

  if (leftNumeric && rightNumeric) {
    return Number(left) - Number(right);
  }
  if (leftNumeric) {
    return -1;
  }
  if (rightNumeric) {
    return 1;
  }
  return left.localeCompare(right);
}

export function compareVersions(left, right) {
  const parsedLeft = typeof left === "string" ? parseSemver(left) : left;
  const parsedRight = typeof right === "string" ? parseSemver(right) : right;

  for (const key of ["major", "minor", "patch"]) {
    const diff = parsedLeft[key] - parsedRight[key];
    if (diff !== 0) {
      return diff;
    }
  }

  if (parsedLeft.prerelease === parsedRight.prerelease) {
    return 0;
  }
  if (parsedLeft.prerelease === null) {
    return 1;
  }
  if (parsedRight.prerelease === null) {
    return -1;
  }

  const leftParts = parsedLeft.prerelease.split(".");
  const rightParts = parsedRight.prerelease.split(".");
  const maxLength = Math.max(leftParts.length, rightParts.length);
  for (let index = 0; index < maxLength; index += 1) {
    const leftPart = leftParts[index];
    const rightPart = rightParts[index];
    if (leftPart === undefined) {
      return -1;
    }
    if (rightPart === undefined) {
      return 1;
    }
    const diff = compareIdentifiers(leftPart, rightPart);
    if (diff !== 0) {
      return diff;
    }
  }

  return 0;
}

export function normalizeTag(versionOrTag) {
  return versionOrTag.startsWith("v") ? versionOrTag : `v${versionOrTag}`;
}

export function versionFromTag(versionOrTag) {
  return versionOrTag.startsWith("v") ? versionOrTag.slice(1) : versionOrTag;
}

export function bumpReleaseVersion(version) {
  return bumpChannelVersion(version, { channel: "stable" });
}

export function bumpChannelVersion(version, options = {}) {
  const parsed = parseSemver(version);
  const channel = options.channel ?? "stable";

  if (channel === "stable") {
    if (parsed.prerelease !== null) {
      return `${parsed.major}.${parsed.minor}.${parsed.patch}`;
    }

    return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}`;
  }

  if (channel === "nightly") {
    if (parsed.prerelease === null) {
      return `${parsed.major}.${parsed.minor}.${parsed.patch + 1}-alpha.1`;
    }

    const nightlyMatch = parsed.prerelease.match(/^alpha\.(\d+)$/);
    if (nightlyMatch) {
      return `${parsed.major}.${parsed.minor}.${parsed.patch}-alpha.${Number(nightlyMatch[1]) + 1}`;
    }

    return `${parsed.major}.${parsed.minor}.${parsed.patch}-alpha.1`;
  }

  throw new ReleaseError(`unsupported release channel: ${channel}`, {
    code: "INVALID_RELEASE_CHANNEL",
    details: { channel },
  });
}

export async function readReleaseManifest(repoRoot) {
  const manifestPath = path.join(repoRoot, RELEASE_MANIFEST_PATH);
  const payload = JSON.parse(await readFile(manifestPath, "utf8"));
  if (payload?.schemaVersion !== 1) {
    throw new ReleaseError(`unsupported release manifest schema version: ${payload?.schemaVersion}`, {
      code: "INVALID_MANIFEST",
    });
  }
  parseSemver(payload.version);
  return payload;
}

export async function writeReleaseManifest(repoRoot, manifest) {
  parseSemver(manifest.version);
  const manifestPath = path.join(repoRoot, RELEASE_MANIFEST_PATH);
  await mkdir(path.dirname(manifestPath), { recursive: true });
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

async function readJson(targetPath) {
  return JSON.parse(await readFile(targetPath, "utf8"));
}

async function writeJson(targetPath, value) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function syncVersionedPackageJsons(repoRoot, version) {
  parseSemver(version);
  const updatedPaths = [];

  for (const relativePath of VERSIONED_PACKAGE_JSON_PATHS) {
    const packageJsonPath = path.join(repoRoot, relativePath);
    const packageJson = await readJson(packageJsonPath);
    if (typeof packageJson.version !== "string") {
      continue;
    }
    if (packageJson.version === version) {
      continue;
    }
    packageJson.version = version;
    await writeJson(packageJsonPath, packageJson);
    updatedPaths.push(relativePath);
  }

  return updatedPaths;
}

function runGitLsRemote(repoUrl, timeoutMs) {
  const result = spawnSync("git", ["ls-remote", "--tags", "--refs", repoUrl], {
    encoding: "utf8",
    timeout: timeoutMs,
    maxBuffer: 10 * 1024 * 1024,
  });

  if (result.error) {
    throw new ReleaseError(`failed to query remote tags: ${result.error.message}`, {
      code: "REMOTE_TAG_QUERY_FAILED",
    });
  }

  if (result.status !== 0) {
    throw new ReleaseError(`failed to query remote tags for ${repoUrl}`, {
      code: "REMOTE_TAG_QUERY_FAILED",
      details: {
        stderr: result.stderr?.trim(),
        stdout: result.stdout?.trim(),
      },
    });
  }

  return result.stdout;
}

export function parseLatestTagFromLsRemoteOutput(stdout) {
  const versions = stdout
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.split("\t")[1] ?? "")
    .map((ref) => ref.replace("refs/tags/", ""))
    .filter((tag) => tag.startsWith("v"))
    .map(versionFromTag);

  let latest = null;
  for (const version of versions) {
    if (latest === null || compareVersions(version, latest) > 0) {
      latest = version;
    }
  }

  return latest;
}

export function resolveReleaseArchiveUrl(manifest, version) {
  const tag = normalizeTag(version);
  return `${manifest.install.archiveBaseUrl}/${tag}.tar.gz`;
}

export function resolveReleaseZipUrl(manifest, version) {
  const tag = normalizeTag(version);
  return `${manifest.install.archiveBaseUrl}/${tag}.zip`;
}

export function buildUpdateSuggestion({ currentVersion, latestVersion, manifest }) {
  const unixCommand = `curl -fsSL ${manifest.install.unixScriptUrl} | bash`;
  const powershellCommand = `irm ${manifest.install.windowsScriptUrl} | iex`;

  return [
    `Update available: v${currentVersion} -> v${latestVersion}`,
    `Unix/macOS: ${unixCommand}`,
    `Windows PowerShell: ${powershellCommand}`,
  ].join("\n");
}

export function resolveLatestRemoteVersion({ repositoryGitUrl, timeoutMs = 3000, lsRemoteOutput }) {
  const stdout =
    lsRemoteOutput ?? runGitLsRemote(repositoryGitUrl, timeoutMs);
  return parseLatestTagFromLsRemoteOutput(stdout);
}
