#!/usr/bin/env node

import { homedir } from "node:os";
import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

import {
  buildUpdateSuggestion,
  compareVersions,
  readReleaseManifest,
  resolveLatestRemoteVersion,
} from "./release-lib.mjs";

async function readJsonIfExists(targetPath) {
  try {
    return JSON.parse(await readFile(targetPath, "utf8"));
  } catch {
    return null;
  }
}

async function writeJson(targetPath, value) {
  await mkdir(path.dirname(targetPath), { recursive: true });
  await writeFile(targetPath, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

export async function checkForReleaseUpdate({
  repoRoot,
  optidevHome,
  force = false,
  now = new Date(),
}) {
  const manifest = await readReleaseManifest(repoRoot);
  const stateRoot = optidevHome?.trim() || path.join(homedir(), ".optidev");
  const cachePath = path.join(stateRoot, "update-check.json");
  const cache = await readJsonIfExists(cachePath);
  const ttlMs = (manifest.update.checkIntervalMinutes ?? 720) * 60 * 1000;
  const nowMs = now.getTime();

  if (
    !force &&
    cache &&
    cache.currentVersion === manifest.version &&
    cache.repositoryGitUrl === manifest.repository.gitUrl &&
    typeof cache.checkedAt === "string" &&
    nowMs - Date.parse(cache.checkedAt) < ttlMs
  ) {
    return cache;
  }

  try {
    const latestVersion = resolveLatestRemoteVersion({
      repositoryGitUrl: manifest.repository.gitUrl,
    });
    const updateAvailable =
      latestVersion !== null && compareVersions(latestVersion, manifest.version) > 0;

    const payload = {
      checkedAt: now.toISOString(),
      currentVersion: manifest.version,
      latestVersion,
      repositoryGitUrl: manifest.repository.gitUrl,
      updateAvailable,
      suggestion:
        latestVersion && updateAvailable
          ? buildUpdateSuggestion({
              currentVersion: manifest.version,
              latestVersion,
              manifest,
            })
          : null,
    };

    await writeJson(cachePath, payload);
    return payload;
  } catch {
    return {
      checkedAt: now.toISOString(),
      currentVersion: manifest.version,
      latestVersion: null,
      repositoryGitUrl: manifest.repository.gitUrl,
      updateAvailable: false,
      suggestion: null,
    };
  }
}

if (import.meta.main) {
  const result = await checkForReleaseUpdate({
    repoRoot: process.cwd(),
    optidevHome: process.env.OPTIDEV_HOME,
    force: process.argv.includes("--force"),
  });
  process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
}
