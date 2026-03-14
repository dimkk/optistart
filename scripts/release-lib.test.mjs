import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  buildReleaseBundleFileName,
  buildReleaseServerPackageJson,
  RELEASE_MANIFEST_PATH,
  buildUpdateSuggestion,
  bumpChannelVersion,
  bumpReleaseVersion,
  compareVersions,
  parseLatestTagFromLsRemoteOutput,
  parseSemver,
  readReleaseManifest,
  resolveReleaseArchiveUrl,
  syncVersionedPackageJsons,
  writeReleaseManifest,
} from "./release-lib.mjs";

async function withTempDirectory(prefix, operation) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await operation(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

test("compareVersions sorts prerelease and stable versions correctly", () => {
  assert.equal(compareVersions("0.0.4-alpha.1", "0.0.4"), -1);
  assert.equal(compareVersions("0.0.5", "0.0.4"), 1);
  assert.equal(compareVersions("1.2.3", "1.2.3"), 0);
});

test("bumpReleaseVersion promotes prerelease to stable and increments stable patch", () => {
  assert.equal(bumpReleaseVersion("0.0.4-alpha.1"), "0.0.4");
  assert.equal(bumpReleaseVersion("0.0.4"), "0.0.5");
});

test("bumpChannelVersion advances nightly prerelease versions", () => {
  assert.equal(bumpChannelVersion("0.0.4", { channel: "nightly" }), "0.0.5-alpha.1");
  assert.equal(bumpChannelVersion("0.0.4-alpha.1", { channel: "nightly" }), "0.0.4-alpha.2");
});

test("parseLatestTagFromLsRemoteOutput returns the greatest semver tag", () => {
  const stdout = [
    "deadbeef\trefs/tags/v0.0.4-alpha.1",
    "feedface\trefs/tags/v0.0.4",
    "cafebabe\trefs/tags/v0.0.5",
  ].join("\n");

  assert.equal(parseLatestTagFromLsRemoteOutput(stdout), "0.0.5");
});

test("release manifest read/write and package syncing use one source of truth", async () => {
  await withTempDirectory("optid-release-lib-", async (repoRoot) => {
    await mkdir(path.join(repoRoot, "scripts"), { recursive: true });
    await mkdir(path.join(repoRoot, "ui/apps/server"), { recursive: true });
    await mkdir(path.join(repoRoot, "ui/apps/web"), { recursive: true });
    await mkdir(path.join(repoRoot, "ui/apps/desktop"), { recursive: true });
    await mkdir(path.join(repoRoot, "ui/apps/marketing"), { recursive: true });
    await mkdir(path.join(repoRoot, "ui/packages/contracts"), { recursive: true });
    await mkdir(path.join(repoRoot, "ui/packages/shared"), { recursive: true });

    const initialManifest = {
      schemaVersion: 1,
      productName: "optid",
      version: "0.0.4-alpha.1",
      repository: {
        url: "https://github.com/dimkk/optistart",
        gitUrl: "https://github.com/dimkk/optistart.git",
      },
      install: {
        bundleBaseUrl: "https://github.com/dimkk/optistart/releases/download",
        unixScriptUrl: "https://example.invalid/install.sh",
        windowsScriptUrl: "https://example.invalid/install.ps1",
      },
      update: {
        checkIntervalMinutes: 720,
      },
    };

    await writeReleaseManifest(repoRoot, initialManifest);
    for (const relativePath of [
      "ui/apps/server/package.json",
      "ui/apps/web/package.json",
      "ui/apps/desktop/package.json",
      "ui/apps/marketing/package.json",
      "ui/packages/contracts/package.json",
      "ui/packages/shared/package.json",
    ]) {
      await writeFile(
        path.join(repoRoot, relativePath),
        JSON.stringify({ name: relativePath, version: "0.0.0" }, null, 2),
        "utf8",
      );
    }

    const nextVersion = bumpReleaseVersion(initialManifest.version);
    const manifest = await readReleaseManifest(repoRoot);
    manifest.version = nextVersion;
    await writeReleaseManifest(repoRoot, manifest);
    const updatedPaths = await syncVersionedPackageJsons(repoRoot, nextVersion);

    const savedManifest = await readReleaseManifest(repoRoot);
    assert.equal(savedManifest.version, "0.0.4");
    assert.equal(updatedPaths.length, 6);

    const serverPackage = JSON.parse(
      await readFile(path.join(repoRoot, "ui/apps/server/package.json"), "utf8"),
    );
    assert.equal(serverPackage.version, "0.0.4");
    assert.equal(
      resolveReleaseArchiveUrl(savedManifest, savedManifest.version),
      "https://github.com/dimkk/optistart/releases/download/v0.0.4/optid-0.0.4.tar.gz",
    );

    const suggestion = buildUpdateSuggestion({
      currentVersion: "0.0.4-alpha.1",
      latestVersion: "0.0.4",
      manifest: savedManifest,
    });
    assert.match(suggestion, /Update available/);
  });
});

test("parseSemver rejects invalid versions", () => {
  assert.throws(() => parseSemver("foo"));
});

test("buildUpdateSuggestion uses shell-appropriate install commands", () => {
  const suggestion = buildUpdateSuggestion({
    currentVersion: "0.0.4-alpha.1",
    latestVersion: "0.0.4",
    manifest: {
      install: {
        unixScriptUrl: "https://example.invalid/install.sh",
        windowsScriptUrl: "https://example.invalid/install.ps1",
      },
    },
  });

  assert.match(suggestion, /curl -fsSL https:\/\/example\.invalid\/install\.sh \| bash/);
  assert.match(suggestion, /irm https:\/\/example\.invalid\/install\.ps1 \| iex/);
});

test("buildReleaseBundleFileName uses the shipped version", () => {
  assert.equal(buildReleaseBundleFileName("0.0.4"), "optid-0.0.4.tar.gz");
});

test("buildReleaseServerPackageJson resolves catalog dependencies for installed runtime", () => {
  const releasePackage = buildReleaseServerPackageJson({
    version: "0.0.4",
    rootPackageJson: {
      workspaces: {
        catalog: {
          effect: "1.2.3",
          "@effect/platform-node": "2.3.4",
          "@effect/sql-sqlite-bun": "3.4.5",
        },
      },
    },
    serverPackageJson: {
      name: "t3",
      repository: { type: "git", url: "https://example.invalid/repo.git" },
      type: "module",
      engines: { node: ">=24" },
      dependencies: {
        effect: "catalog:",
        "@effect/platform-node": "catalog:",
        "@effect/sql-sqlite-bun": "catalog:",
        open: "^10.1.0",
      },
    },
  });

  assert.deepEqual(releasePackage.dependencies, {
    effect: "1.2.3",
    "@effect/platform-node": "2.3.4",
    "@effect/sql-sqlite-bun": "3.4.5",
    open: "^10.1.0",
  });
  assert.equal(releasePackage.scripts.start, "node dist/index.mjs");
  assert.equal(releasePackage.scripts["optidev:cli"], "node dist/optidevCli.mjs");
});
