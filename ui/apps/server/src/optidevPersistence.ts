import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

import YAML from "yaml";

import type { OptiDevActionResponse, OptiDevRouteContext } from "./optidevContract";
import { loadGlobalConfig } from "./optidevNative";

export interface ProjectConfig {
  dev: {
    start: string[];
  };
  tests: {
    command: string | null;
    watch: string[];
  };
  logs: {
    sources: string[];
  };
}

export interface WorkspaceManifest {
  project: string;
  workspace: {
    active_task: string;
    branch: string;
    head_commit: string;
    mux: string;
  };
  agents: Array<{
    name: string;
    runner: string;
  }>;
  layout: Array<{
    name: string;
    pane: string;
  }>;
  services: Array<{
    name: string;
    command: string;
  }>;
  tests: {
    command: string;
  };
  logs: {
    command: string;
  };
  context: {
    agents_dir: string;
    skills_dir: string;
    mcp_dir: string;
  };
}

const DEFAULT_PROJECT_CONFIG: ProjectConfig = {
  dev: { start: [] },
  tests: { command: null, watch: [] },
  logs: { sources: [] },
};

const DEFAULT_LAYOUT = [
  { name: "Chat", pane: "chat" },
  { name: "Editor", pane: "editor" },
  { name: "Logs", pane: "logs" },
  { name: "Tests", pane: "tests" },
];

export async function exists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

export async function ensureDir(dirPath: string): Promise<void> {
  await fs.mkdir(dirPath, { recursive: true });
}

export async function loadMapping(filePath: string): Promise<Record<string, unknown>> {
  const text = await fs.readFile(filePath, "utf8");
  let parsed: unknown;
  try {
    parsed = YAML.parse(text);
  } catch {
    parsed = JSON.parse(text);
  }
  if (parsed == null) {
    return {};
  }
  if (typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error(`config root must be mapping: ${filePath}`);
  }
  return parsed as Record<string, unknown>;
}

export function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

export function asString(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}

export function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return [];
  }
  return value.filter((item): item is string => typeof item === "string");
}

export async function loadProjectConfig(projectPath: string): Promise<ProjectConfig> {
  const configPath = path.join(projectPath, ".project", "config.yaml");
  if (!(await exists(configPath))) {
    return structuredClone(DEFAULT_PROJECT_CONFIG);
  }
  const data = await loadMapping(configPath);
  const dev = asObject(data.dev);
  const tests = asObject(data.tests);
  const logs = asObject(data.logs);
  const testsCommand = tests?.command;
  return {
    dev: {
      start: asStringArray(dev?.start),
    },
    tests: {
      command: typeof testsCommand === "string" ? testsCommand : null,
      watch: asStringArray(tests?.watch),
    },
    logs: {
      sources: asStringArray(logs?.sources),
    },
  };
}

function gitValue(projectPath: string, args: string[], fallback: string): string {
  const result = spawnSync("git", args, {
    cwd: projectPath,
    encoding: "utf8",
  });
  const value = (result.stdout ?? "").trim();
  return result.status === 0 && value ? value : fallback;
}

async function discoverAgents(projectPath: string, defaultRunner: string): Promise<Array<{ name: string; runner: string }>> {
  const agentsDir = path.join(projectPath, ".agents", "agents");
  if (!(await exists(agentsDir))) {
    return [];
  }
  const entries = await fs.readdir(agentsDir, { withFileTypes: true });
  return entries
    .filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
    .sort((left, right) => left.name.localeCompare(right.name))
    .map((entry) => ({
      name: path.parse(entry.name).name,
      runner: defaultRunner,
    }));
}

async function buildDefaultManifest(projectPath: string, defaultRunner: string): Promise<WorkspaceManifest> {
  const projectConfig = await loadProjectConfig(projectPath);
  const testsCommand =
    projectConfig.tests.watch.find((item) => item.trim().length > 0) ??
    projectConfig.tests.command ??
    "";

  return {
    project: path.basename(projectPath),
    workspace: {
      active_task: "",
      branch: gitValue(projectPath, ["rev-parse", "--abbrev-ref", "HEAD"], "main"),
      head_commit: gitValue(projectPath, ["rev-parse", "HEAD"], ""),
      mux: "zellij",
    },
    agents: await discoverAgents(projectPath, defaultRunner),
    layout: DEFAULT_LAYOUT,
    services: projectConfig.dev.start.map((command, index) => ({
      name: `service-${index + 1}`,
      command,
    })),
    tests: {
      command: testsCommand,
    },
    logs: {
      command: projectConfig.logs.sources[0] ?? "",
    },
    context: {
      agents_dir: ".agents/agents",
      skills_dir: ".agents/skills",
      mcp_dir: ".agents/mcp",
    },
  };
}

export async function loadManifest(manifestPath: string): Promise<WorkspaceManifest> {
  const data = await loadMapping(manifestPath);
  const workspace = asObject(data.workspace);
  const tests = asObject(data.tests);
  const logs = asObject(data.logs);
  const context = asObject(data.context);
  return {
    project: asString(data.project, path.basename(path.dirname(manifestPath))),
    workspace: {
      active_task: asString(workspace?.active_task),
      branch: asString(workspace?.branch, "main"),
      head_commit: asString(workspace?.head_commit),
      mux: asString(workspace?.mux, "zellij"),
    },
    agents: Array.isArray(data.agents)
      ? data.agents
          .map((item) => asObject(item))
          .filter((item): item is Record<string, unknown> => item !== undefined)
          .map((item) => ({
            name: asString(item.name),
            runner: asString(item.runner, "codex"),
          }))
          .filter((item) => item.name.length > 0)
      : [],
    layout: Array.isArray(data.layout)
      ? data.layout
          .map((item) => asObject(item))
          .filter((item): item is Record<string, unknown> => item !== undefined)
          .map((item) => ({
            name: asString(item.name, "Workspace"),
            pane: asString(item.pane, "chat"),
          }))
      : DEFAULT_LAYOUT,
    services: Array.isArray(data.services)
      ? data.services
          .map((item) => asObject(item))
          .filter((item): item is Record<string, unknown> => item !== undefined)
          .map((item, index) => ({
            name: asString(item.name, `service-${index + 1}`),
            command: asString(item.command),
          }))
      : [],
    tests: {
      command: asString(tests?.command),
    },
    logs: {
      command: asString(logs?.command),
    },
    context: {
      agents_dir: asString(context?.agents_dir, ".agents/agents"),
      skills_dir: asString(context?.skills_dir, ".agents/skills"),
      mcp_dir: asString(context?.mcp_dir, ".agents/mcp"),
    },
  };
}

export async function writeYaml(filePath: string, payload: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, YAML.stringify(payload), "utf8");
}

export async function ensureWorkspaceManifest(projectPath: string, defaultRunner: string): Promise<WorkspaceManifest> {
  const manifestPath = path.join(projectPath, ".optidev", "workspace.yaml");
  if (await exists(manifestPath)) {
    return loadManifest(manifestPath);
  }
  const manifest = await buildDefaultManifest(projectPath, defaultRunner);
  await writeYaml(manifestPath, manifest);
  return manifest;
}

async function registerProject(
  context: OptiDevRouteContext,
  projectName: string,
  projectPath: string,
): Promise<string | null> {
  const globalConfig = await loadGlobalConfig(context);
  const projectsRoot = path.resolve(globalConfig.projectsPath);
  await ensureDir(projectsRoot);
  const registryEntry = path.join(projectsRoot, projectName);

  if (path.resolve(registryEntry) === path.resolve(projectPath)) {
    return `Project registry: ${registryEntry}`;
  }

  if (await exists(registryEntry)) {
    try {
      const resolved = await fs.realpath(registryEntry);
      if (resolved === path.resolve(projectPath)) {
        return `Project registry: ${registryEntry}`;
      }
    } catch {
      // continue to conflict path handling below
    }
    return `Project registry entry already exists: ${registryEntry}. Update it manually if you want to map to ${projectPath}.`;
  }

  try {
    await fs.symlink(projectPath, registryEntry, "dir");
    return `Project registry linked: ${registryEntry} -> ${projectPath}`;
  } catch {
    await ensureDir(registryEntry);
    const pointerPath = path.join(registryEntry, ".optid-target");
    await fs.writeFile(pointerPath, projectPath, "utf8");
    return `Project registry mapped via pointer file: ${pointerPath}`;
  }
}

export function manifestFingerprint(manifest: WorkspaceManifest): string {
  return JSON.stringify(manifest, Object.keys(manifest).sort()).length > 0
    ? createStableHash(stableJson(manifest))
    : createStableHash("{}");
}

function stableJson(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map((item) => stableJson(item)).join(",")}]`;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([left], [right]) => left.localeCompare(right));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${stableJson(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

function createStableHash(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export async function nativeInitAction(
  context: OptiDevRouteContext,
  target: string,
  cwd: string,
): Promise<OptiDevActionResponse> {
  const cleanTarget = target.trim();
  if (!cleanTarget) {
    return { ok: false, lines: ["Project name is required."] };
  }

  const workdir = path.resolve(cwd);
  const projectPath = cleanTarget === "."
    ? workdir
    : path.resolve(workdir, cleanTarget);
  const projectName = path.basename(projectPath);
  const projectConfigPath = path.join(projectPath, ".project", "config.yaml");
  const optidevDir = path.join(projectPath, ".optidev");
  const alreadyInitialized = await exists(projectConfigPath);

  await ensureDir(path.join(projectPath, ".project"));
  await ensureDir(optidevDir);

  if (!alreadyInitialized) {
    await ensureDir(path.join(projectPath, ".agents", "agents"));
    await ensureDir(path.join(projectPath, ".agents", "skills"));
    await ensureDir(path.join(projectPath, ".agents", "mcp"));
    await fs.writeFile(projectConfigPath, JSON.stringify(DEFAULT_PROJECT_CONFIG, null, 2), "utf8");
  }

  const globalConfig = await loadGlobalConfig(context);
  await ensureWorkspaceManifest(projectPath, globalConfig.defaultRunner);

  const registrationNote = alreadyInitialized
    ? null
    : await registerProject(context, projectName, projectPath);

  const lines = alreadyInitialized
    ? [`Project '${projectName}' is already initialized at ${projectPath}.`]
    : [`Initialized project '${projectName}' at ${projectPath}.`];

  if (registrationNote) {
    lines.push(registrationNote);
  }

  if (cleanTarget !== ".") {
    lines.push("Shell directory is unchanged: CLI cannot change your current shell.");
    lines.push(`All set. Next: cd ${path.relative(workdir, projectPath)} && optid start`);
  } else {
    lines.push("Shell directory is unchanged (already current directory).");
    lines.push("All set. Next: optid start .");
  }

  return { ok: true, lines };
}

export async function nativeWorkspaceCloneAction(
  context: OptiDevRouteContext,
  name: string,
  cwd: string,
): Promise<OptiDevActionResponse> {
  const cloneName = name.trim();
  if (!cloneName) {
    return { ok: false, lines: ["Workspace clone name is required."] };
  }
  const projectPath = path.resolve(cwd);
  const globalConfig = await loadGlobalConfig(context);
  const manifest = await ensureWorkspaceManifest(projectPath, globalConfig.defaultRunner);
  const cloneDir = path.join(projectPath, ".optidev", "workspaces", cloneName);
  const cloneManifest: WorkspaceManifest = {
    ...manifest,
    workspace: {
      ...manifest.workspace,
      branch: cloneName,
    },
  };
  await writeYaml(path.join(cloneDir, "workspace.yaml"), cloneManifest);
  return {
    ok: true,
    lines: [
      `Workspace clone created: ${cloneDir}`,
      `Manifest: ${path.join(cloneDir, "workspace.yaml")}`,
    ],
  };
}
