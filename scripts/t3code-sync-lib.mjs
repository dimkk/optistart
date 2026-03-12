import { spawnSync } from "node:child_process";
import { access, copyFile, mkdir, mkdtemp, readFile, readdir, readlink, rm, stat, symlink, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

export const DEFAULT_UPSTREAM_URL = "https://github.com/pingdotgg/t3code";
export const DEFAULT_VENDOR_DIR = "ui";
export const DEFAULT_METADATA_PATH = "ui/.t3code-upstream.json";

const IGNORED_BASENAMES = new Set([
  ".DS_Store",
  ".astro",
  ".bun",
  ".git",
  ".logs",
  ".t3",
  ".turbo",
  "build",
  "node_modules",
  "playwright-report",
  "release",
]);

const IGNORED_EXACT_PATHS = new Set([
  ".t3code-upstream.json",
  "apps/web/.playwright",
  "apps/web/playwright-report",
  "apps/web/src/components/__screenshots__",
]);

const IGNORED_SUFFIXES = [".log", ".tsbuildinfo"];

export class T3CodeSyncError extends Error {
  constructor(message, options = {}) {
    super(message);
    this.name = "T3CodeSyncError";
    this.code = options.code ?? "T3CODE_SYNC_ERROR";
    this.details = options.details ?? {};
  }
}

export function shouldIgnoreVendorPath(relativePath) {
  if (!relativePath) {
    return false;
  }

  const normalized = relativePath.split(path.sep).join("/");
  if (IGNORED_EXACT_PATHS.has(normalized)) {
    return true;
  }

  const parts = normalized.split("/").filter(Boolean);
  if (parts.some((part) => IGNORED_BASENAMES.has(part))) {
    return true;
  }

  if (parts.length === 3 && parts[0] === "apps" && parts[2] === "dist") {
    return true;
  }

  if (parts.length === 3 && parts[0] === "packages" && parts[2] === "dist") {
    return true;
  }

  if (parts.length === 3 && parts[0] === "apps" && parts[2] === "dist-electron") {
    return true;
  }

  return IGNORED_SUFFIXES.some((suffix) => normalized.endsWith(suffix));
}

function run(command, args, { cwd, allowFailure = false } = {}) {
  const result = spawnSync(command, args, {
    cwd,
    encoding: "utf8",
    maxBuffer: 20 * 1024 * 1024,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0 && !allowFailure) {
    throw new T3CodeSyncError(
      [`command failed: ${command} ${args.join(" ")}`, result.stderr?.trim(), result.stdout?.trim()]
        .filter(Boolean)
        .join("\n"),
      {
        code: "COMMAND_FAILED",
        details: {
          command,
          args,
          cwd,
          exitCode: result.status,
          stderr: result.stderr,
          stdout: result.stdout,
        },
      },
    );
  }

  return {
    status: result.status ?? 0,
    stdout: result.stdout ?? "",
    stderr: result.stderr ?? "",
  };
}

function git(cwd, args, options = {}) {
  return run("git", args, { cwd, ...options });
}

async function pathExists(targetPath) {
  try {
    await access(targetPath);
    return true;
  } catch {
    return false;
  }
}

async function ensureDirectory(targetPath) {
  await mkdir(targetPath, { recursive: true });
}

async function readJson(targetPath) {
  const raw = await readFile(targetPath, "utf8");
  return JSON.parse(raw);
}

function ensureString(value, fieldName) {
  if (typeof value !== "string" || value.trim() === "") {
    throw new T3CodeSyncError(`invalid metadata field: ${fieldName}`, {
      code: "INVALID_METADATA",
    });
  }

  return value;
}

function validateMetadata(value) {
  if (!value || typeof value !== "object") {
    throw new T3CodeSyncError("invalid metadata: expected object", {
      code: "INVALID_METADATA",
    });
  }

  if (value.schemaVersion !== 1) {
    throw new T3CodeSyncError(`unsupported metadata schema version: ${value.schemaVersion}`, {
      code: "INVALID_METADATA",
    });
  }

  const upstream = value.upstream;
  const vendor = value.vendor;

  if (!upstream || typeof upstream !== "object" || !vendor || typeof vendor !== "object") {
    throw new T3CodeSyncError("invalid metadata: missing upstream/vendor sections", {
      code: "INVALID_METADATA",
    });
  }

  ensureString(upstream.url, "upstream.url");
  ensureString(upstream.baseRef, "upstream.baseRef");
  ensureString(upstream.baseCommit, "upstream.baseCommit");
  ensureString(upstream.baseCommitDate, "upstream.baseCommitDate");
  ensureString(upstream.baseCommitSubject, "upstream.baseCommitSubject");
  ensureString(vendor.path, "vendor.path");
  ensureString(vendor.metadataUpdatedAt, "vendor.metadataUpdatedAt");
  ensureString(vendor.metadataUpdatedFrom, "vendor.metadataUpdatedFrom");
  ensureString(vendor.bootstrapReason, "vendor.bootstrapReason");

  return value;
}

export async function readMetadata(metadataPath) {
  const payload = await readJson(metadataPath);
  return validateMetadata(payload);
}

export async function writeMetadata(metadataPath, metadata) {
  await ensureDirectory(path.dirname(metadataPath));
  await writeFile(metadataPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");
}

function resolveRelativePath(repoRoot, relativePath) {
  return path.resolve(repoRoot, relativePath);
}

function commitInfo(repoPath, ref) {
  const commit = git(repoPath, ["rev-parse", ref]).stdout.trim();
  const subject = git(repoPath, ["show", "-s", "--format=%s", commit]).stdout.trim();
  const date = git(repoPath, ["show", "-s", "--format=%cI", commit]).stdout.trim();
  return { commit, subject, date };
}

async function withTempDirectory(prefix, operation) {
  const tempDir = await mkdtemp(path.join(os.tmpdir(), prefix));
  try {
    return await operation(tempDir);
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
}

async function listEntries(targetPath) {
  if (!(await pathExists(targetPath))) {
    return [];
  }

  return readdir(targetPath, { withFileTypes: true });
}

async function clearMirroredDirectory(targetPath, relativePrefix = "") {
  const entries = await listEntries(targetPath);
  for (const entry of entries) {
    const relativePath = relativePrefix ? path.posix.join(relativePrefix, entry.name) : entry.name;
    if (shouldIgnoreVendorPath(relativePath)) {
      continue;
    }

    await rm(path.join(targetPath, entry.name), { recursive: true, force: true });
  }
}

async function copyMirroredTree(sourceRoot, destinationRoot, relativePrefix = "") {
  await ensureDirectory(destinationRoot);
  const sourceEntries = await listEntries(sourceRoot);
  const allowedSourceEntries = sourceEntries.filter((entry) => {
    const relativePath = relativePrefix ? path.posix.join(relativePrefix, entry.name) : entry.name;
    return !shouldIgnoreVendorPath(relativePath);
  });

  const sourceEntryNames = new Set(allowedSourceEntries.map((entry) => entry.name));
  const destinationEntries = await listEntries(destinationRoot);

  for (const destinationEntry of destinationEntries) {
    const relativePath = relativePrefix
      ? path.posix.join(relativePrefix, destinationEntry.name)
      : destinationEntry.name;

    if (shouldIgnoreVendorPath(relativePath)) {
      continue;
    }

    if (!sourceEntryNames.has(destinationEntry.name)) {
      await rm(path.join(destinationRoot, destinationEntry.name), { recursive: true, force: true });
    }
  }

  for (const sourceEntry of allowedSourceEntries) {
    const sourcePath = path.join(sourceRoot, sourceEntry.name);
    const destinationPath = path.join(destinationRoot, sourceEntry.name);
    const relativePath = relativePrefix ? path.posix.join(relativePrefix, sourceEntry.name) : sourceEntry.name;

    if (sourceEntry.isDirectory()) {
      await ensureDirectory(destinationPath);
      await copyMirroredTree(sourcePath, destinationPath, relativePath);
      continue;
    }

    if (sourceEntry.isSymbolicLink()) {
      const linkTarget = await readlink(sourcePath);
      await ensureDirectory(path.dirname(destinationPath));
      await rm(destinationPath, { recursive: true, force: true });
      await symlink(linkTarget, destinationPath);
      continue;
    }

    await ensureDirectory(path.dirname(destinationPath));
    const destinationExists = await pathExists(destinationPath);
    if (destinationExists) {
      const destinationStats = await stat(destinationPath);
      if (destinationStats.isDirectory()) {
        await rm(destinationPath, { recursive: true, force: true });
      }
    }
    await copyFile(sourcePath, destinationPath);
  }
}

async function cloneUpstream(url, destinationPath) {
  git(process.cwd(), ["clone", "--quiet", url, destinationPath]);
}

async function addWorktree(repoPath, worktreePath, ref) {
  git(repoPath, ["worktree", "add", "--quiet", "--detach", worktreePath, ref]);
}

async function removeWorktree(repoPath, worktreePath) {
  git(repoPath, ["worktree", "remove", "--force", worktreePath], { allowFailure: true });
}

async function createOverlayPatch({ upstreamRepoPath, baseRef, vendorPath, patchPath }) {
  const overlayPath = path.join(path.dirname(patchPath), "overlay");
  await addWorktree(upstreamRepoPath, overlayPath, baseRef);

  try {
    await clearMirroredDirectory(overlayPath);
    await copyMirroredTree(vendorPath, overlayPath);
    git(overlayPath, ["add", "-A"]);

    const overlayStat = git(overlayPath, ["diff", "--cached", "--shortstat", "HEAD"]).stdout.trim();
    const hasOverlay = overlayStat.length > 0;

    if (!hasOverlay) {
      return {
        hasOverlay: false,
        overlayStat: "no OptiDev overlay changes",
        patchPath: null,
      };
    }

    const patch = git(overlayPath, ["diff", "--cached", "--binary", "--full-index", "HEAD"]).stdout;
    await writeFile(patchPath, patch, "utf8");

    return {
      hasOverlay: true,
      overlayStat,
      patchPath,
    };
  } finally {
    await removeWorktree(upstreamRepoPath, overlayPath);
  }
}

function ensureImportLine(source, anchorLine, importLine) {
  if (source.includes(importLine)) {
    return source;
  }

  if (!source.includes(anchorLine)) {
    throw new T3CodeSyncError(`failed to insert import line; anchor not found: ${anchorLine}`, {
      code: "CONFLICT_RESOLUTION_FAILED",
    });
  }

  return source.replace(anchorLine, `${anchorLine}\n${importLine}`);
}

function ensureNamedImport(source, moduleName, importName, anchorName) {
  const importPattern = new RegExp(
    `import \\\\{([\\\\s\\\\S]*?)\\\\} from "${moduleName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}";`,
  );

  return source.replace(importPattern, (statement, membersBlock) => {
    if (membersBlock.includes(importName)) {
      return statement;
    }

    if (membersBlock.includes(anchorName)) {
      return statement.replace(`${anchorName},`, `${anchorName},\n  ${importName},`);
    }

    return statement.replace("{\n", `{\n  ${importName},\n`);
  });
}

function ensureLineAfter(source, anchorLine, lineToInsert) {
  if (source.includes(lineToInsert)) {
    return source;
  }

  if (!source.includes(anchorLine)) {
    throw new T3CodeSyncError(`failed to insert line; anchor not found: ${anchorLine}`, {
      code: "CONFLICT_RESOLUTION_FAILED",
    });
  }

  return source.replace(anchorLine, `${anchorLine}\n${lineToInsert}`);
}

function extractBetween(source, startMarker, endMarker) {
  const startIndex = source.indexOf(startMarker);
  if (startIndex === -1) {
    throw new T3CodeSyncError(`failed to extract snippet; missing start marker: ${startMarker}`, {
      code: "CONFLICT_RESOLUTION_FAILED",
    });
  }

  const contentStart = startIndex + startMarker.length;
  const endIndex = source.indexOf(endMarker, contentStart);
  if (endIndex === -1) {
    throw new T3CodeSyncError(`failed to extract snippet; missing end marker: ${endMarker}`, {
      code: "CONFLICT_RESOLUTION_FAILED",
    });
  }

  return source.slice(contentStart, endIndex);
}

function resolveWsServerConflict({ targetSource, overlaySource }) {
  const importAnchor = 'import { expandHomePath } from "./os-jank.ts";';
  const importLine = 'import { tryHandleOptiDevRequest } from "./optidevRoute";';
  const urlAnchor = 'const url = new URL(req.url ?? "/", `http://localhost:${port}`);';
  const faviconAnchor = "if (tryHandleProjectFaviconRequest(url, res)) {";

  const overlaySnippet = extractBetween(overlaySource, `${urlAnchor}\n`, faviconAnchor);
  let resolved = ensureImportLine(targetSource, importAnchor, importLine);

  if (!resolved.includes("tryHandleOptiDevRequest(")) {
    resolved = resolved.replace(urlAnchor, `${urlAnchor}\n${overlaySnippet.trimEnd()}`);
  }

  return resolved;
}

function resolveSidebarConflict({ targetSource, overlaySource }) {
  const navigateAnchor = "  const navigate = useNavigate();";
  const pathnameLine = '  const pathname = useLocation({ select: (loc) => loc.pathname });';
  const sidebarAnchor = '        <SidebarGroup className="px-2 py-2">';
  const blockStart = '        <SidebarGroup className="px-2 pb-0 pt-2">';

  let resolved = ensureNamedImport(targetSource, "lucide-react", "FolderOpenIcon", "FolderIcon");
  resolved = ensureLineAfter(resolved, navigateAnchor, pathnameLine);

  if (!resolved.includes('data-testid="sidebar-optidev"')) {
    const overlayBlock = extractBetween(overlaySource, `${blockStart}\n`, sidebarAnchor);
    const fullBlock = `${blockStart}\n${overlayBlock}`;
    if (!resolved.includes(sidebarAnchor)) {
      throw new T3CodeSyncError(`failed to resolve Sidebar conflict; anchor not found: ${sidebarAnchor}`, {
        code: "CONFLICT_RESOLUTION_FAILED",
      });
    }
    resolved = resolved.replace(sidebarAnchor, `${fullBlock}\n${sidebarAnchor}`);
  }

  return resolved;
}

function resolveVitestBrowserConfigConflict({ targetSource, overlaySource }) {
  const includePattern = /include:\s*\[([\s\S]*?)\],/;
  const targetMatch = targetSource.match(includePattern);
  const overlayMatch = overlaySource.match(includePattern);

  if (!targetMatch || !overlayMatch) {
    throw new T3CodeSyncError("failed to resolve vitest browser config include list", {
      code: "CONFLICT_RESOLUTION_FAILED",
    });
  }

  const readIncludes = (input) => Array.from(input.matchAll(/"([^"]+)"/g), (match) => match[1]);
  const targetIncludes = readIncludes(targetMatch[1]);
  const overlayIncludes = readIncludes(overlayMatch[1]);
  const mergedIncludes = [...targetIncludes];
  for (const include of overlayIncludes) {
    if (!mergedIncludes.includes(include)) {
      mergedIncludes.push(include);
    }
  }

  const rendered = `include: [\n${mergedIncludes
    .map((entry) => `        "${entry}",`)
    .join("\n")}\n      ],`;

  return targetSource.replace(includePattern, rendered);
}

const KNOWN_CONFLICT_RESOLVERS = new Map([
  ["apps/server/src/wsServer.ts", resolveWsServerConflict],
  ["apps/web/src/components/Sidebar.tsx", resolveSidebarConflict],
  ["apps/web/vitest.browser.config.ts", resolveVitestBrowserConfigConflict],
]);

async function resolveKnownConflicts({ targetPath, vendorPath, conflicts }) {
  const resolvedConflicts = [];

  for (const conflict of conflicts) {
    const resolver = KNOWN_CONFLICT_RESOLVERS.get(conflict);
    if (!resolver) {
      continue;
    }

    const overlayFilePath = path.join(vendorPath, conflict);
    const targetSource = git(targetPath, ["show", `HEAD:${conflict}`]).stdout;
    const overlaySource = await readFile(overlayFilePath, "utf8");
    const resolvedSource = resolver({ targetSource, overlaySource });
    await writeFile(path.join(targetPath, conflict), resolvedSource, "utf8");
    git(targetPath, ["add", conflict]);
    resolvedConflicts.push(conflict);
  }

  const remainingConflicts = git(targetPath, ["diff", "--name-only", "--diff-filter=U"], {
    allowFailure: true,
  })
    .stdout.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    resolvedConflicts,
    remainingConflicts,
  };
}

async function applyOverlayPatch({ upstreamRepoPath, targetRef, patchPath, worktreeRoot, vendorPath }) {
  const targetPath = path.join(worktreeRoot, "target");
  await addWorktree(upstreamRepoPath, targetPath, targetRef);

  try {
    let resolvedConflicts = [];
    if (patchPath) {
      const applyResult = git(targetPath, ["apply", "--3way", "--index", patchPath], {
        allowFailure: true,
      });

      if (applyResult.status !== 0) {
        const conflicts = git(targetPath, ["diff", "--name-only", "--diff-filter=U"], {
          allowFailure: true,
        })
          .stdout.split("\n")
          .map((line) => line.trim())
          .filter(Boolean);

        const resolution = await resolveKnownConflicts({
          targetPath,
          vendorPath,
          conflicts,
        });
        resolvedConflicts = resolution.resolvedConflicts;

        if (resolution.remainingConflicts.length > 0) {
          throw new T3CodeSyncError("failed to replay OptiDev overlay onto target upstream ref", {
            code: "OVERLAY_APPLY_FAILED",
            details: {
              conflicts: resolution.remainingConflicts,
              resolvedConflicts,
              stderr: applyResult.stderr.trim(),
              stdout: applyResult.stdout.trim(),
            },
          });
        }
      }
    }

    const mergedStat = git(targetPath, ["diff", "--cached", "--shortstat", "HEAD"]).stdout.trim();
    git(targetPath, ["reset", "--mixed", "HEAD"]);

    return {
      targetPath,
      mergedStat: mergedStat || "target matches upstream with no overlay changes",
      resolvedConflicts,
    };
  } catch (error) {
    await removeWorktree(upstreamRepoPath, targetPath);
    throw error;
  }
}

export async function bootstrapMetadata({
  repoRoot,
  vendorDir = DEFAULT_VENDOR_DIR,
  metadataPath = DEFAULT_METADATA_PATH,
  upstreamUrl = DEFAULT_UPSTREAM_URL,
  baseRef,
  bootstrapReason,
}) {
  if (!baseRef) {
    throw new T3CodeSyncError("bootstrap requires --base-ref", {
      code: "MISSING_BASE_REF",
    });
  }

  return withTempDirectory("t3code-bootstrap-", async (tempDir) => {
    const upstreamRepoPath = path.join(tempDir, "upstream");
    await cloneUpstream(upstreamUrl, upstreamRepoPath);

    const info = commitInfo(upstreamRepoPath, baseRef);
    const metadata = {
      schemaVersion: 1,
      upstream: {
        url: upstreamUrl,
        baseRef,
        baseCommit: info.commit,
        baseCommitDate: info.date,
        baseCommitSubject: info.subject,
      },
      vendor: {
        path: vendorDir,
        metadataUpdatedAt: new Date().toISOString(),
        metadataUpdatedFrom: "bootstrap",
        bootstrapReason,
      },
    };

    await writeMetadata(resolveRelativePath(repoRoot, metadataPath), metadata);
    return metadata;
  });
}

export async function currentStatus({
  repoRoot,
  vendorDir = DEFAULT_VENDOR_DIR,
  metadataPath = DEFAULT_METADATA_PATH,
}) {
  const absoluteMetadataPath = resolveRelativePath(repoRoot, metadataPath);
  const metadataExists = await pathExists(absoluteMetadataPath);
  const metadata = metadataExists ? await readMetadata(absoluteMetadataPath) : null;
  const dirtyPaths = git(repoRoot, ["status", "--porcelain", "--untracked-files=all", "--", vendorDir, metadataPath], {
    allowFailure: true,
  })
    .stdout.split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  return {
    repoRoot,
    vendorDir,
    metadataPath,
    metadata,
    dirtyPaths,
  };
}

function buildUpdatedMetadata({ existingMetadata, upstreamUrl, vendorDir, targetRef, commit }) {
  return {
    schemaVersion: 1,
    upstream: {
      url: upstreamUrl,
      baseRef: targetRef,
      baseCommit: commit.commit,
      baseCommitDate: commit.date,
      baseCommitSubject: commit.subject,
    },
    vendor: {
      path: vendorDir,
      metadataUpdatedAt: new Date().toISOString(),
      metadataUpdatedFrom: "refresh",
      bootstrapReason: existingMetadata?.vendor.bootstrapReason ?? "initialized from refresh",
    },
  };
}

export async function refreshVendor({
  repoRoot,
  vendorDir = DEFAULT_VENDOR_DIR,
  metadataPath = DEFAULT_METADATA_PATH,
  upstreamUrl = DEFAULT_UPSTREAM_URL,
  baseRef,
  targetRef = "main",
  dryRun = false,
  allowDirty = false,
}) {
  const status = await currentStatus({ repoRoot, vendorDir, metadataPath });
  const existingMetadata = status.metadata;
  const dirtyPaths = status.dirtyPaths;

  if (dirtyPaths.length > 0 && !allowDirty) {
    throw new T3CodeSyncError(
      `vendored tree is dirty; rerun with --allow-dirty or clean these paths:\n${dirtyPaths.join("\n")}`,
      {
        code: "DIRTY_VENDOR_TREE",
        details: {
          dirtyPaths,
        },
      },
    );
  }

  const effectiveBaseRef = existingMetadata?.upstream.baseCommit ?? baseRef;
  if (!effectiveBaseRef) {
    throw new T3CodeSyncError("refresh requires recorded metadata or an explicit --base-ref", {
      code: "MISSING_BASE_REF",
    });
  }

  return withTempDirectory("t3code-refresh-", async (tempDir) => {
    const upstreamRepoPath = path.join(tempDir, "upstream");
    await cloneUpstream(upstreamUrl, upstreamRepoPath);

    const vendorPath = resolveRelativePath(repoRoot, vendorDir);
    const patchPath = path.join(tempDir, "overlay.patch");
    const overlay = await createOverlayPatch({
      upstreamRepoPath,
      baseRef: effectiveBaseRef,
      vendorPath,
      patchPath,
    });

    const targetCommit = commitInfo(upstreamRepoPath, targetRef);
    const applied = await applyOverlayPatch({
      upstreamRepoPath,
      targetRef: targetCommit.commit,
      patchPath: overlay.patchPath,
      worktreeRoot: tempDir,
      vendorPath,
    });

    const result = {
      repoRoot,
      vendorDir,
      metadataPath,
      dryRun,
      targetRef,
      targetCommit,
      baseRef: effectiveBaseRef,
      overlayStat: overlay.overlayStat,
      mergedStat: applied.mergedStat,
      resolvedConflicts: applied.resolvedConflicts,
      dirtyPaths,
    };

    if (dryRun) {
      await removeWorktree(upstreamRepoPath, applied.targetPath);
      return result;
    }

    await copyMirroredTree(applied.targetPath, vendorPath);
    const metadata = buildUpdatedMetadata({
      existingMetadata,
      upstreamUrl,
      vendorDir,
      targetRef,
      commit: targetCommit,
    });

    await writeMetadata(resolveRelativePath(repoRoot, metadataPath), metadata);
    await removeWorktree(upstreamRepoPath, applied.targetPath);

    return {
      ...result,
      metadata,
    };
  });
}
