import fs from "node:fs/promises";
import path from "node:path";

import type {
  OptiDevActionResponse,
  OptiDevBuildInfoPayload,
  OptiDevRouteContext,
} from "./optidevContract";
import { resolveOptiDevProjectRoot } from "./optidevContract";

const BUILD_INFO_CACHE_TTL_MS = 5 * 60_000;
const REMOTE_MANIFEST_TIMEOUT_MS = 3_000;

interface ReleaseManifestRecord {
  version?: unknown;
  repository?: {
    url?: unknown;
  };
}

interface UpstreamMetadataRecord {
  upstream?: {
    url?: unknown;
    baseRef?: unknown;
    baseCommit?: unknown;
    baseCommitSubject?: unknown;
  };
}

const buildInfoCache = new Map<string, { expiresAt: number; payload: OptiDevBuildInfoPayload }>();

async function readJsonFile<T>(filePath: string): Promise<T | null> {
  try {
    return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
  } catch {
    return null;
  }
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.trim().length > 0 ? value : null;
}

function normalizeRawGithubBase(repositoryUrl: string | null): string | null {
  if (!repositoryUrl) {
    return null;
  }

  try {
    const parsed = new URL(repositoryUrl);
    if (parsed.hostname !== "github.com") {
      return null;
    }
    const slug = parsed.pathname.replace(/^\/+|\/+$/g, "");
    return slug.length > 0 ? `https://raw.githubusercontent.com/${slug}` : null;
  } catch {
    return null;
  }
}

function normalizeGithubRepoSlug(repositoryUrl: string | null): string | null {
  if (!repositoryUrl) {
    return null;
  }

  try {
    const parsed = new URL(repositoryUrl);
    if (parsed.hostname !== "github.com") {
      return null;
    }
    const slug = parsed.pathname.replace(/^\/+|\/+$/g, "").replace(/\.git$/i, "");
    return slug.length > 0 ? slug : null;
  } catch {
    return null;
  }
}

async function fetchRemoteManifestVersion(rawBaseUrl: string | null, branch: string): Promise<string | null> {
  if (!rawBaseUrl) {
    return null;
  }

  try {
    const response = await fetch(`${rawBaseUrl}/${branch}/scripts/release-manifest.json`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(REMOTE_MANIFEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { version?: unknown };
    return typeof body.version === "string" ? body.version : null;
  } catch {
    return null;
  }
}

async function fetchLatestGithubReleaseVersion(repositorySlug: string | null): Promise<string | null> {
  if (!repositorySlug) {
    return null;
  }

  try {
    const response = await fetch(`https://api.github.com/repos/${repositorySlug}/releases/latest`, {
      headers: { Accept: "application/vnd.github+json" },
      signal: AbortSignal.timeout(REMOTE_MANIFEST_TIMEOUT_MS),
    });
    if (!response.ok) {
      return null;
    }
    const body = (await response.json()) as { tag_name?: unknown; name?: unknown };
    const tagName = typeof body.tag_name === "string" ? body.tag_name.trim() : "";
    if (tagName.length > 0) {
      return tagName.replace(/^v(?=\d)/i, "");
    }
    const releaseName = typeof body.name === "string" ? body.name.trim() : "";
    return releaseName.length > 0 ? releaseName : null;
  } catch {
    return null;
  }
}

async function loadBuildInfo(repoRoot: string): Promise<OptiDevBuildInfoPayload> {
  const [serverPackage, upstreamMetadata, localManifest] = await Promise.all([
    readJsonFile<{ version?: unknown }>(path.join(repoRoot, "ui", "apps", "server", "package.json")),
    readJsonFile<UpstreamMetadataRecord>(path.join(repoRoot, "ui", ".t3code-upstream.json")),
    readJsonFile<ReleaseManifestRecord>(path.join(repoRoot, "scripts", "release-manifest.json")),
  ]);

  const rawGithubBase = normalizeRawGithubBase(asString(localManifest?.repository?.url));
  const upstreamRepositorySlug = normalizeGithubRepoSlug(asString(upstreamMetadata?.upstream?.url));
  const [prodVersion, nightlyVersion, upstreamReleaseVersion] = await Promise.all([
    fetchRemoteManifestVersion(rawGithubBase, "main"),
    fetchRemoteManifestVersion(rawGithubBase, "test"),
    fetchLatestGithubReleaseVersion(upstreamRepositorySlug),
  ]);

  return {
    localT3Version: asString(serverPackage?.version),
    upstreamT3Version:
      upstreamReleaseVersion ??
      asString(upstreamMetadata?.upstream?.baseRef) ??
      asString(upstreamMetadata?.upstream?.baseCommit),
    upstreamT3Subject: asString(upstreamMetadata?.upstream?.baseCommitSubject),
    optidProdVersion: prodVersion ?? "unpublished",
    optidNightlyVersion: nightlyVersion ?? asString(localManifest?.version),
  };
}

export async function nativeBuildInfoAction(
  context: OptiDevRouteContext,
): Promise<OptiDevActionResponse> {
  const repoRoot = resolveOptiDevProjectRoot(context.cwd);
  const now = Date.now();
  const cached = buildInfoCache.get(repoRoot);
  if (cached && cached.expiresAt > now) {
    return {
      ok: true,
      lines: [],
      data: cached.payload,
    };
  }

  const payload = await loadBuildInfo(repoRoot);
  buildInfoCache.set(repoRoot, {
    expiresAt: now + BUILD_INFO_CACHE_TTL_MS,
    payload,
  });

  return {
    ok: true,
    lines: [],
    data: payload,
  };
}
