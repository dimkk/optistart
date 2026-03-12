#!/usr/bin/env node

import path from "node:path";

import {
  bumpChannelVersion,
  normalizeTag,
  readReleaseManifest,
  syncVersionedPackageJsons,
  writeReleaseManifest,
} from "./release-lib.mjs";

function usage() {
  return `Usage:
  node scripts/prepare-release.mjs show
  node scripts/prepare-release.mjs bump [--apply] [--version <version>] [--channel <stable|nightly>]`;
}

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const flags = {};
  for (let index = 0; index < rest.length; index += 1) {
    const token = rest[index];
    if (token === "--apply") {
      flags.apply = true;
      continue;
    }
    if (token === "--version") {
      flags.version = rest[index + 1];
      index += 1;
      continue;
    }
    if (token === "--channel") {
      flags.channel = rest[index + 1];
      index += 1;
      continue;
    }
    throw new Error(`unexpected argument: ${token}`);
  }
  return { command, flags };
}

async function main() {
  const { command, flags } = parseArgs(process.argv.slice(2));
  const repoRoot = process.cwd();
  const manifest = await readReleaseManifest(repoRoot);

  if (command === "show") {
    process.stdout.write(
      `${JSON.stringify({ version: manifest.version, tag: normalizeTag(manifest.version) }, null, 2)}\n`,
    );
    return;
  }

  if (command === "bump") {
    const channel = flags.channel ?? "stable";
    const nextVersion = flags.version ?? bumpChannelVersion(manifest.version, { channel });
    if (flags.apply) {
      manifest.version = nextVersion;
      await writeReleaseManifest(repoRoot, manifest);
      const updatedPackageJsons = await syncVersionedPackageJsons(repoRoot, nextVersion);
      process.stdout.write(
        `${JSON.stringify(
          {
            version: nextVersion,
            tag: normalizeTag(nextVersion),
            channel,
            updatedPackageJsons,
            updatedManifest: path.join("scripts", "release-manifest.json"),
          },
          null,
          2,
        )}\n`,
      );
      return;
    }

    process.stdout.write(
      `${JSON.stringify({ version: nextVersion, tag: normalizeTag(nextVersion), channel }, null, 2)}\n`,
    );
    return;
  }

  throw new Error(usage());
}

main().catch((error) => {
  process.stderr.write(`${error.message}\n`);
  process.exitCode = 1;
});
