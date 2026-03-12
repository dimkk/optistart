import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import YAML from "yaml";

import type {
  OptiDevActionPayload,
  OptiDevActionResponse,
  OptiDevProjectRecord,
  OptiDevRouteContext,
  OptiDevSessionPayload,
} from "./optidevContract";
import { resolveOptiDevProjectRoot } from "./optidevContract";

export interface NativeGlobalConfig {
  defaultRunner: string;
  projectsPath: string;
  scanPaths: string[];
  muxBackend: string;
  telegramBotToken: string;
  telegramChatId: number | null;
}

interface NativeSessionState {
  project: string;
  status: string;
  mux_backend: string;
  mux_session_name: string;
}

interface NativeProjectSession {
  active_task?: string;
  branch?: string;
  head_commit?: string;
  agents?: unknown[];
  last_mode?: string;
}

const SUPPORTED_NATIVE_ACTIONS = new Set(["status", "logs", "projects"]);

function expandHomePath(input: string, homeDir: string): string {
  if (input === "~") {
    return homeDir;
  }
  if (input.startsWith("~/")) {
    return path.join(homeDir, input.slice(2));
  }
  return input;
}

async function readJsonFile(filePath: string): Promise<unknown> {
  return JSON.parse(await fs.readFile(filePath, "utf8"));
}

async function loadMapping(filePath: string): Promise<Record<string, unknown>> {
  const text = await fs.readFile(filePath, "utf8");

  let loaded: unknown;
  try {
    loaded = YAML.parse(text);
  } catch {
    loaded = JSON.parse(text);
  }

  if (loaded == null) {
    return {};
  }
  if (typeof loaded !== "object" || Array.isArray(loaded)) {
    throw new Error(`config root must be mapping: ${filePath}`);
  }
  return loaded as Record<string, unknown>;
}

function asObject(value: unknown): Record<string, unknown> | undefined {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return undefined;
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function asStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value) || value.some((item) => typeof item !== "string")) {
    return undefined;
  }
  return value as string[];
}

async function existsDirectory(dirPath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(dirPath);
    return stat.isDirectory();
  } catch {
    return false;
  }
}

async function existsFile(filePath: string): Promise<boolean> {
  try {
    const stat = await fs.stat(filePath);
    return stat.isFile();
  } catch {
    return false;
  }
}

export function resolveHomeDir(context: OptiDevRouteContext): string {
  return context.homeDir ?? path.join(os.homedir(), ".optidev");
}

export async function loadGlobalConfig(context: OptiDevRouteContext): Promise<NativeGlobalConfig> {
  const homeDir = resolveHomeDir(context);
  const userHome = os.homedir();
  const defaults = {
    defaultRunner: "codex",
    projectsPath: path.join(homeDir, "projects"),
    scanPaths: [path.join(userHome, "dev"), path.join(userHome, "projects")],
    muxBackend: "zellij",
    telegramBotToken: "",
    telegramChatId: null as number | null,
  };

  const configPath = path.join(homeDir, "config.yaml");
  if (!(await existsFile(configPath))) {
    return defaults;
  }

  const data = await loadMapping(configPath);
  const defaultRunner = asString(data.default_runner) ?? defaults.defaultRunner;
  const muxBackend = asString(data.mux_backend) ?? defaults.muxBackend;
  const telegramBotToken = asString(data.telegram_bot_token) ?? defaults.telegramBotToken;
  const telegramChatId = typeof data.telegram_chat_id === "number" ? data.telegram_chat_id : defaults.telegramChatId;
  if (!["codex", "claude"].includes(defaultRunner)) {
    throw new Error("global config field 'default_runner' supports only 'codex' or 'claude'");
  }
  if (!["zellij", "textual"].includes(muxBackend)) {
    throw new Error("global config field 'mux_backend' supports only 'zellij' or 'textual'");
  }

  const rawProjectsPath = asString(data.projects_path) ?? defaults.projectsPath;
  const rawScanPaths = asStringArray(data.scan_paths) ?? defaults.scanPaths;

  return {
    defaultRunner,
    projectsPath: path.resolve(expandHomePath(rawProjectsPath, userHome)),
    scanPaths: rawScanPaths.map((item) => path.resolve(expandHomePath(item, userHome))),
    muxBackend,
    telegramBotToken,
    telegramChatId,
  };
}

function uniqueRoots(paths: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const item of paths) {
    const key = path.resolve(item);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    result.push(key);
  }
  return result;
}

async function resolveProjectEntry(entryPath: string): Promise<string | null> {
  if (!(await existsDirectory(entryPath))) {
    return null;
  }
  const pointerPath = path.join(entryPath, ".optid-target");
  if (!(await existsFile(pointerPath))) {
    return entryPath;
  }
  const targetRaw = (await fs.readFile(pointerPath, "utf8")).trim();
  if (!targetRaw) {
    return null;
  }
  const targetPath = path.resolve(expandHomePath(targetRaw, os.homedir()));
  return (await existsDirectory(targetPath)) ? targetPath : null;
}

export async function discoverProjectsNative(
  context: OptiDevRouteContext,
): Promise<OptiDevProjectRecord[]> {
  const homeDir = resolveHomeDir(context);
  const globalConfig = await loadGlobalConfig(context);
  const roots = uniqueRoots([globalConfig.projectsPath, ...globalConfig.scanPaths]);
  const discovered = new Map<string, OptiDevProjectRecord>();

  for (const root of roots) {
    if (!(await existsDirectory(root))) {
      continue;
    }
    const entries = await fs.readdir(root, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }
      if (discovered.has(entry.name)) {
        continue;
      }
      const resolved = await resolveProjectEntry(path.join(root, entry.name));
      if (!resolved) {
        continue;
      }
      discovered.set(entry.name, {
        name: entry.name,
        path: resolved,
      });
    }
  }

  return [...discovered.values()].sort((left, right) => left.name.localeCompare(right.name));
}

async function resolveProjectPath(
  context: OptiDevRouteContext,
  projectName: string,
): Promise<string | null> {
  const projects = await discoverProjectsNative(context);
  return projects.find((item) => item.name === projectName)?.path ?? null;
}

async function readCurrentSession(context: OptiDevRouteContext): Promise<NativeSessionState | null> {
  const homeDir = resolveHomeDir(context);
  const activeSessionPath = path.join(homeDir, "active_session.json");
  if (!(await existsFile(activeSessionPath))) {
    return null;
  }
  const active = asObject(await readJsonFile(activeSessionPath));
  const project = asString(active?.project);
  if (!project) {
    return null;
  }
  const sessionPath = path.join(homeDir, "sessions", project, "session.json");
  if (!(await existsFile(sessionPath))) {
    return null;
  }
  const session = asObject(await readJsonFile(sessionPath));
  if (!session) {
    return null;
  }
  return {
    project,
    status: asString(session.status) ?? "unknown",
    mux_backend: asString(session.mux_backend) ?? "unknown",
    mux_session_name: asString(session.mux_session_name) ?? "unknown",
  };
}

async function readRunnerName(context: OptiDevRouteContext, project: string): Promise<string> {
  const homeDir = resolveHomeDir(context);
  const runnerPath = path.join(homeDir, "sessions", project, "runner.json");
  if (!(await existsFile(runnerPath))) {
    return "unknown";
  }
  const runner = asObject(await readJsonFile(runnerPath));
  return asString(runner?.runner) ?? "unknown";
}

async function readHooksSummary(
  context: OptiDevRouteContext,
  project: string,
): Promise<{ total: number; running: number }> {
  const homeDir = resolveHomeDir(context);
  const hooksPath = path.join(homeDir, "sessions", project, "hooks.json");
  if (!(await existsFile(hooksPath))) {
    return { total: 0, running: 0 };
  }
  const hooks = await readJsonFile(hooksPath);
  if (!Array.isArray(hooks)) {
    return { total: 0, running: 0 };
  }
  return {
    total: hooks.length,
    running: hooks.filter((item) => asObject(item)?.status === "running").length,
  };
}

async function readProjectSession(projectPath: string): Promise<NativeProjectSession | null> {
  const sessionPath = path.join(projectPath, ".optidev", "session.json");
  if (!(await existsFile(sessionPath))) {
    return null;
  }
  const session = asObject(await readJsonFile(sessionPath));
  return session ?? null;
}

async function validateManifest(projectPath: string): Promise<boolean> {
  const manifestPath = path.join(projectPath, ".optidev", "workspace.yaml");
  if (!(await existsFile(manifestPath))) {
    return false;
  }
  await loadMapping(manifestPath);
  return true;
}

export async function nativeSessionPayload(
  context: OptiDevRouteContext,
): Promise<OptiDevSessionPayload> {
  const status = await readCurrentSession(context);
  if (!status) {
    return {
      project: null,
      projectPath: null,
      status: "inactive",
      muxBackend: null,
      sessionName: null,
      runner: null,
      hooksRunning: 0,
      hooksTotal: 0,
      mode: null,
      branch: null,
      headCommit: null,
      activeTask: null,
      agentsCount: 0,
      manifestValid: false,
    };
  }

  const runner = await readRunnerName(context, status.project);
  const hooks = await readHooksSummary(context, status.project);
  const resolvedProjectPath = await resolveProjectPath(context, status.project);
  const projectSession = resolvedProjectPath ? await readProjectSession(resolvedProjectPath) : null;
  const manifestValid = resolvedProjectPath ? await validateManifest(resolvedProjectPath) : false;

  return {
    project: status.project,
    projectPath: resolvedProjectPath,
    status: status.status,
    muxBackend: status.mux_backend,
    sessionName: status.mux_session_name,
    runner,
    hooksRunning: hooks.running,
    hooksTotal: hooks.total,
    mode: typeof projectSession?.last_mode === "string" ? projectSession.last_mode : null,
    branch: typeof projectSession?.branch === "string" ? projectSession.branch : null,
    headCommit: typeof projectSession?.head_commit === "string" ? projectSession.head_commit : null,
    activeTask: typeof projectSession?.active_task === "string" ? projectSession.active_task : null,
    agentsCount: Array.isArray(projectSession?.agents) ? projectSession.agents.length : 0,
    manifestValid,
  };
}

export async function nativeStatusText(context: OptiDevRouteContext): Promise<string> {
  const session = await nativeSessionPayload(context);
  if (!session.project || !session.sessionName || !session.muxBackend || !session.runner) {
    return "No active session.";
  }
  let suffix = "";
  if (session.manifestValid) {
    suffix =
      ` | Mode: ${session.mode ?? ""}` +
      ` | Branch: ${session.branch ?? ""}` +
      ` | Agents: ${session.agentsCount}`;
    if (session.headCommit && session.headCommit.length > 0) {
      suffix += ` | Head: ${session.headCommit.slice(0, 12)}`;
    }
    if (session.activeTask && session.activeTask.length > 0) {
      suffix += ` | Task: ${session.activeTask}`;
    }
  }

  return (
    `Project: ${session.project} | Status: ${session.status} | ` +
    `Mux: ${session.muxBackend} | Session: ${session.sessionName} | ` +
    `Runner: ${session.runner} | Hooks: ${session.hooksRunning}/${session.hooksTotal} running` +
    suffix
  );
}

export async function nativeLogsText(context: OptiDevRouteContext): Promise<string> {
  const status = await readCurrentSession(context);
  if (!status) {
    return "No active session.";
  }
  const homeDir = resolveHomeDir(context);
  const hooksPath = path.join(homeDir, "sessions", status.project, "hooks.json");
  if (!(await existsFile(hooksPath))) {
    return "No logs sources configured.";
  }
  const hooks = await readJsonFile(hooksPath);
  if (!Array.isArray(hooks)) {
    return "No logs sources configured.";
  }
  const lines = hooks
    .map((item) => asObject(item))
    .filter((item): item is Record<string, unknown> => item !== undefined)
    .filter((item) => item.group === "logs.sources")
    .map((item) => `${String(item.command ?? "")} [${String(item.status ?? "")}]`)
    .filter((item) => item.trim().length > 0);

  if (lines.length === 0) {
    return "No logs sources configured.";
  }
  return `Log sources:\n${lines.join("\n")}`;
}

export async function nativeProjectsAction(
  context: OptiDevRouteContext,
): Promise<OptiDevActionResponse> {
  const projects = await discoverProjectsNative(context);
  return {
    ok: true,
    lines: projects.length > 0 ? projects.map((item) => item.name) : ["No projects found."],
    data: projects,
  };
}

export async function nativeStatusAction(
  context: OptiDevRouteContext,
): Promise<OptiDevActionResponse> {
  return {
    ok: true,
    lines: [await nativeStatusText(context)],
  };
}

export async function nativeLogsAction(
  context: OptiDevRouteContext,
): Promise<OptiDevActionResponse> {
  return {
    ok: true,
    lines: [await nativeLogsText(context)],
  };
}

export async function buildNativeState(
  context: OptiDevRouteContext,
  memorySummaryLoader: () => Promise<OptiDevActionResponse>,
): Promise<OptiDevActionResponse> {
  const [status, logs, projectsAction, memory, session] = await Promise.all([
    nativeStatusText(context),
    nativeLogsText(context),
    discoverProjectsNative(context),
    memorySummaryLoader(),
    nativeSessionPayload(context),
  ]);

  const warnings = memory.ok ? [] : memory.lines;
  return {
    ok: true,
    lines: warnings,
    state: {
      repoRoot: resolveOptiDevProjectRoot(context.cwd),
      status,
      logs,
      projects: projectsAction,
      memorySummary: memory.ok ? memory.lines : memory.lines,
      session,
    },
  };
}

export function supportsNativeReadOnlyAction(action: string): boolean {
  return SUPPORTED_NATIVE_ACTIONS.has(action);
}
