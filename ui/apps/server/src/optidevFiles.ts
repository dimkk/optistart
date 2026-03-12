import fs from "node:fs/promises";
import path from "node:path";

import type {
  OptiDevDirectoryPayload,
  OptiDevFilePayload,
  OptiDevFileScope,
  OptiDevRouteContext,
} from "./optidevContract";
import { resolveOptiDevProjectRoot } from "./optidevContract";

const IMAGE_EXTENSIONS = new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".svg",
  ".avif",
]);
const MARKDOWN_EXTENSIONS = new Set([".md", ".mdown", ".markdown"]);
const TEXT_EXTENSIONS = new Set([".txt", ".log"]);
const LANGUAGE_BY_EXTENSION = new Map<string, string>([
  [".ts", "typescript"],
  [".tsx", "tsx"],
  [".js", "javascript"],
  [".jsx", "jsx"],
  [".json", "json"],
  [".yaml", "yaml"],
  [".yml", "yaml"],
  [".md", "markdown"],
  [".mdown", "markdown"],
  [".markdown", "markdown"],
  [".sh", "bash"],
  [".bash", "bash"],
  [".zsh", "bash"],
  [".py", "python"],
  [".css", "css"],
  [".html", "html"],
  [".sql", "sql"],
  [".toml", "toml"],
]);

async function ensureDirectory(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

function normalizeRelativePath(value: string | undefined): string {
  if (!value) {
    return "";
  }
  return value.replaceAll("\\", "/").replace(/^\/+/, "");
}

function ensureInsideRoot(root: string, relativePath: string): string {
  const resolved = path.resolve(root, relativePath);
  const relative = path.relative(root, resolved);
  if (relative.startsWith("..") || path.isAbsolute(relative)) {
    throw new Error("Path escapes the allowed OptiDev scope.");
  }
  return resolved;
}

async function resolveScopeRoot(
  context: OptiDevRouteContext,
  scope: OptiDevFileScope,
): Promise<string> {
  const repoRoot = resolveOptiDevProjectRoot(context.cwd);
  if (scope === "repo") {
    return repoRoot;
  }
  const scopedRoot = path.join(repoRoot, ".agents", scope);
  await ensureDirectory(scopedRoot);
  return scopedRoot;
}

function classifyBuffer(
  filePath: string,
  buffer: Buffer,
): Pick<OptiDevFilePayload, "kind" | "language" | "content"> {
  const ext = path.extname(filePath).toLowerCase();
  if (IMAGE_EXTENSIONS.has(ext)) {
    return {
      kind: "image",
      language: null,
      content: null,
    };
  }

  if (buffer.includes(0)) {
    return {
      kind: "binary",
      language: null,
      content: null,
    };
  }

  const content = buffer.toString("utf8");
  if (MARKDOWN_EXTENSIONS.has(ext)) {
    return {
      kind: "markdown",
      language: "markdown",
      content,
    };
  }
  if (TEXT_EXTENSIONS.has(ext)) {
    return {
      kind: "text",
      language: null,
      content,
    };
  }
  const language = LANGUAGE_BY_EXTENSION.get(ext) ?? null;
  return {
    kind: language ? "code" : "text",
    language,
    content,
  };
}

export function rawFileMimeType(filePath: string): string {
  const ext = path.extname(filePath).toLowerCase();
  switch (ext) {
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".gif":
      return "image/gif";
    case ".webp":
      return "image/webp";
    case ".svg":
      return "image/svg+xml";
    case ".avif":
      return "image/avif";
    default:
      return "application/octet-stream";
  }
}

export async function listScopedDirectory(
  context: OptiDevRouteContext,
  scope: OptiDevFileScope,
  relativePath: string,
): Promise<OptiDevDirectoryPayload> {
  const root = await resolveScopeRoot(context, scope);
  const normalizedPath = normalizeRelativePath(relativePath);
  const dirPath = ensureInsideRoot(root, normalizedPath);

  await ensureDirectory(dirPath);
  const entries = await fs.readdir(dirPath, { withFileTypes: true });
  const payloadEntries = await Promise.all(
    entries
      .filter((entry) => !entry.name.startsWith(".git"))
      .map(async (entry) => {
        const nextRelativePath = normalizeRelativePath(path.posix.join(normalizedPath, entry.name));
        const stat = await fs.stat(path.join(dirPath, entry.name));
        return {
          name: entry.name,
          path: nextRelativePath,
          kind: entry.isDirectory() ? "directory" : "file",
          size: entry.isDirectory() ? null : stat.size,
        } as const;
      }),
  );

  payloadEntries.sort((left, right) => {
    if (left.kind !== right.kind) {
      return left.kind === "directory" ? -1 : 1;
    }
    return left.name.localeCompare(right.name);
  });

  return {
    scope,
    path: normalizedPath,
    entries: payloadEntries,
  };
}

export async function readScopedFile(
  context: OptiDevRouteContext,
  scope: OptiDevFileScope,
  relativePath: string,
): Promise<OptiDevFilePayload> {
  const root = await resolveScopeRoot(context, scope);
  const normalizedPath = normalizeRelativePath(relativePath);
  if (!normalizedPath) {
    throw new Error("File path is required.");
  }
  const filePath = ensureInsideRoot(root, normalizedPath);
  const stat = await fs.stat(filePath);
  if (!stat.isFile()) {
    throw new Error("Requested path is not a file.");
  }

  const buffer = await fs.readFile(filePath);
  const classified = classifyBuffer(filePath, buffer);
  return {
    scope,
    path: normalizedPath,
    name: path.basename(filePath),
    kind: classified.kind,
    language: classified.language,
    content: classified.content,
    size: stat.size,
    editable: scope !== "repo" && classified.kind !== "binary" && classified.kind !== "image",
  };
}

export async function readScopedRawFile(
  context: OptiDevRouteContext,
  scope: OptiDevFileScope,
  relativePath: string,
): Promise<{ filePath: string; contentType: string }> {
  const root = await resolveScopeRoot(context, scope);
  const normalizedPath = normalizeRelativePath(relativePath);
  if (!normalizedPath) {
    throw new Error("File path is required.");
  }
  const filePath = ensureInsideRoot(root, normalizedPath);
  if (!(await exists(filePath))) {
    throw new Error("File not found.");
  }
  return {
    filePath,
    contentType: rawFileMimeType(filePath),
  };
}

export async function writeScopedTextFile(
  context: OptiDevRouteContext,
  scope: Exclude<OptiDevFileScope, "repo">,
  relativePath: string,
  content: string,
): Promise<OptiDevFilePayload> {
  const root = await resolveScopeRoot(context, scope);
  const normalizedPath = normalizeRelativePath(relativePath);
  if (!normalizedPath) {
    throw new Error("File path is required.");
  }
  const filePath = ensureInsideRoot(root, normalizedPath);
  await ensureDirectory(path.dirname(filePath));
  await fs.writeFile(filePath, content, "utf8");
  return readScopedFile(context, scope, normalizedPath);
}
