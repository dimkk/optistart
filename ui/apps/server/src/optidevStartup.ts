import { spawn } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import type { OptiDevActionResponse, OptiDevRouteContext } from "./optidevContract";
import {
  type ProjectConfig,
  type WorkspaceManifest,
  asObject,
  asString,
  ensureDir,
  ensureWorkspaceManifest,
  exists,
  loadMapping,
  loadProjectConfig,
  manifestFingerprint,
} from "./optidevPersistence";
import { loadGlobalConfig, resolveHomeDir } from "./optidevNative";
import { nativeInitAction } from "./optidevPersistence";
import { nativeMemorySummary } from "./optidevMemory";
import { buildNativeRepoAdvice, recordNativeWorkspaceStarted } from "./optidevPlugins";

interface ProjectSession {
  project: string;
  manifest_fingerprint: string;
  active_task: string;
  branch: string;
  head_commit: string;
  agents: string[];
  status: string;
  runner: string;
  mux_session_name: string;
  layout_path: string;
  last_mode: string;
  started_at: string;
  stopped_at: string | null;
}

interface SessionState {
  project: string;
  status: string;
  started_at: string;
  stopped_at: string | null;
  mux_backend: string;
  mux_session_name: string;
  layout_path: string;
  restored: boolean;
}

interface HookState {
  group: string;
  command: string;
  pid: number | null;
  status: string;
}

interface StartupDeps {
  now: () => string;
  spawnDetached: (command: string, args: string[], cwd?: string) => number | null;
  spawnBackground: (command: string, args: string[], cwd?: string) => void;
}

const defaultDeps: StartupDeps = {
  now: () => new Date().toISOString(),
  spawnDetached: (command, args, cwd) => {
    const child = spawn(command, args, {
      cwd,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
    return child.pid ?? null;
  },
  spawnBackground: (command, args, cwd) => {
    const child = spawn(command, args, {
      cwd,
      detached: true,
      stdio: "ignore",
    });
    child.unref();
  },
};

const RUNNER_COMMANDS: Record<string, string[]> = {
  codex: ["codex", "--no-alt-screen", "-C", "{project_dir}"],
  claude: ["claude"],
};

const DEFAULT_LAYOUT_SPEC = {
  tabs: [
    { name: "Chat", root: { type: "pane", name: "chat", role: "chat" } },
    {
      name: "Editor",
      root: {
        type: "pane",
        name: "editor",
        command: ["fresh", "."],
      },
    },
    {
      name: "Logs",
      root: {
        type: "pane",
        name: "logs",
        command: ["bash"],
      },
    },
    {
      name: "Tests",
      root: {
        type: "pane",
        name: "tests",
        command: ["bash"],
      },
    },
  ],
};

function truthyEnv(name: string): boolean {
  const value = process.env[name];
  return value !== undefined && ["1", "true", "yes", "on"].includes(value.trim().toLowerCase());
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

async function loadProjectSession(projectPath: string): Promise<ProjectSession | null> {
  const sessionPath = path.join(projectPath, ".optidev", "session.json");
  if (!(await exists(sessionPath))) {
    return null;
  }
  return readJson<ProjectSession>(sessionPath);
}

function isSessionCompatible(manifest: WorkspaceManifest, session: ProjectSession | null): boolean {
  return session !== null && session.manifest_fingerprint === manifestFingerprint(manifest);
}

function decideRuntimeMode(
  manifest: WorkspaceManifest,
  session: ProjectSession | null,
  forceResume: boolean,
): "bootstrap" | "restore" | "missing" {
  if (forceResume) {
    return isSessionCompatible(manifest, session) ? "restore" : "missing";
  }
  return isSessionCompatible(manifest, session) ? "restore" : "bootstrap";
}

function primaryRunner(manifest: WorkspaceManifest, defaultRunner: string): string {
  return manifest.agents[0]?.runner || defaultRunner;
}

async function resolveAgents(projectPath: string, manifest: WorkspaceManifest): Promise<Array<{ name: string; runner: string; definition_path: string }>> {
  const agentsRoot = path.join(projectPath, manifest.context.agents_dir);
  const out: Array<{ name: string; runner: string; definition_path: string }> = [];
  for (const item of manifest.agents) {
    const definitionPath = path.join(agentsRoot, `${item.name}.md`);
    if (!(await exists(definitionPath))) {
      throw new Error(`manifest agent '${item.name}' not found in ${agentsRoot}`);
    }
    out.push({
      name: item.name,
      runner: item.runner,
      definition_path: definitionPath,
    });
  }
  return out;
}

function runnerCommand(projectPath: string, runnerName: string): string[] {
  const template = RUNNER_COMMANDS[runnerName];
  if (!template) {
    throw new Error(`unsupported runner: ${runnerName}`);
  }
  return template.map((item) => (item === "{project_dir}" ? projectPath : item));
}

function projectConfigFromManifest(manifest: WorkspaceManifest, fallback: ProjectConfig): ProjectConfig {
  const services = manifest.services.map((item) => item.command).filter((item) => item.trim().length > 0);
  const manifestTests = manifest.tests.command.trim();
  const manifestLogs = manifest.logs.command.trim();
  return {
    dev: {
      start: services.length > 0 ? services : fallback.dev.start,
    },
    tests: {
      command: manifestTests || fallback.tests.command,
      watch: manifestTests ? [manifestTests] : fallback.tests.watch,
    },
    logs: {
      sources: manifestLogs ? [manifestLogs] : fallback.logs.sources,
    },
  };
}

async function writeStartupPrompt(sessionDir: string, prompts: string[]): Promise<string | null> {
  const clean = prompts.map((item) => item.trim()).filter((item) => item.length > 0);
  if (clean.length === 0) {
    return null;
  }
  const promptPath = path.join(sessionDir, "startup-prompt.txt");
  await ensureDir(sessionDir);
  await fs.writeFile(promptPath, `${clean.join("\n\n")}\n`, "utf8");
  return promptPath;
}

function shellQuote(value: string): string {
  return `'${value.replaceAll("'", `'\\''`)}'`;
}

async function writeExecutableScript(filePath: string, body: string): Promise<void> {
  await ensureDir(path.dirname(filePath));
  await fs.writeFile(filePath, body, { encoding: "utf8", mode: 0o755 });
  await fs.chmod(filePath, 0o755);
}

async function writeChatScript(
  sessionDir: string,
  projectName: string,
  projectDir: string,
  runner: string,
  promptPath: string | null,
): Promise<string[]> {
  const command = runnerCommand(projectDir, runner);
  const scriptPath = path.join(sessionDir, "chat-pane.sh");
  const promptBlock = promptPath
    ? [
        `if [ -f ${shellQuote(promptPath)} ]; then`,
        '  printf "OptiDev startup prompt for ' + runner + '\\n\\n"',
        `  cat ${shellQuote(promptPath)}`,
        '  printf "\\n\\n"',
        "fi",
      ].join("\n")
    : "";
  await writeExecutableScript(
    scriptPath,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `cd ${shellQuote(projectDir)}`,
      'clear || true',
      promptBlock,
      `printf "Launching ${runner} for ${projectName} in %s\\n" ${shellQuote(projectDir)}`,
      `exec ${command.map((item) => shellQuote(item)).join(" ")}`,
      "",
    ]
      .filter((line) => line.length > 0)
      .join("\n"),
  );
  return ["bash", scriptPath];
}

async function writeConfiguredPaneScript(
  sessionDir: string,
  paneName: string,
  cwd: string,
  commandFile: string,
): Promise<string[]> {
  const scriptPath = path.join(sessionDir, `${paneName}-pane.sh`);
  await writeExecutableScript(
    scriptPath,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `cd ${shellQuote(cwd)}`,
      `COMMAND_FILE=${shellQuote(commandFile)}`,
      'if [ -s "$COMMAND_FILE" ]; then',
      '  COMMAND="$(head -n 1 "$COMMAND_FILE")"',
      `  printf "OptiDev ${paneName} command: %s\\n\\n" "$COMMAND"`,
      '  exec bash -lc "$COMMAND"',
      "fi",
      `printf "No ${paneName} command configured. Update %s and rerun this pane.\\n" "$COMMAND_FILE"`,
      "exec bash",
      "",
    ].join("\n"),
  );
  return ["bash", scriptPath];
}

async function writeEditorPaneScript(sessionDir: string, projectDir: string): Promise<string[]> {
  const scriptPath = path.join(sessionDir, "editor-pane.sh");
  await writeExecutableScript(
    scriptPath,
    [
      "#!/usr/bin/env bash",
      "set -euo pipefail",
      `cd ${shellQuote(projectDir)}`,
      "if command -v fresh >/dev/null 2>&1; then",
      '  exec fresh .',
      "fi",
      'printf "The `fresh` command is unavailable. Staying in a project shell.\\n"',
      "exec bash",
      "",
    ].join("\n"),
  );
  return ["bash", scriptPath];
}

async function collectPaths(root: string, fileName?: string): Promise<string[]> {
  if (!(await exists(root))) {
    return [];
  }
  const out: string[] = [];
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries.sort((left, right) => left.name.localeCompare(right.name))) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        queue.push(fullPath);
        continue;
      }
      if (!entry.isFile()) {
        continue;
      }
      if (!fileName || entry.name === fileName) {
        out.push(fullPath);
      }
    }
  }
  return out;
}

async function buildStartupArtifacts(
  context: OptiDevRouteContext,
  projectName: string,
  projectDir: string,
  sessionDir: string,
  runnerName: string,
  runtimeMode: string,
  manifest: WorkspaceManifest,
  projectConfig: ProjectConfig,
  activeAgents: string[],
  advice: boolean,
): Promise<{ messages: string[]; prompts: string[]; layout_spec: Record<string, unknown> }> {
  const logsCommandFile = path.join(sessionDir, "logs-command.sh");
  const testsCommandFile = path.join(sessionDir, "tests-command.sh");
  const runtimeConfig = projectConfigFromManifest(manifest, projectConfig);
  const logsCommand = manifest.services[0]?.command?.trim() || manifest.logs.command.trim() || runtimeConfig.dev.start[0] || "";
  const testsCommand = manifest.tests.command.trim() || runtimeConfig.tests.watch[0] || runtimeConfig.tests.command || "";
  await ensureDir(sessionDir);
  if (!(await exists(logsCommandFile))) {
    await fs.writeFile(logsCommandFile, logsCommand ? `${logsCommand}\n` : "", "utf8");
  }
  if (!(await exists(testsCommandFile))) {
    await fs.writeFile(testsCommandFile, testsCommand ? `${testsCommand}\n` : "", "utf8");
  }

  const homeDir = resolveHomeDir(context);
  const contextFile = path.join(sessionDir, "optid-context.md");
  const localSkills = await collectPaths(path.join(projectDir, ".agents", "skills"), "SKILL.md");
  const projectAgents = await collectPaths(path.join(projectDir, ".agents", "agents"));
  const memorySummary = await nativeMemorySummary(projectDir);
  const contextLines = [
    `# OptiDev Session Context: ${projectName}`,
    "",
    "## Runtime",
    `- project_root: ${projectDir}`,
    `- session_dir: ${sessionDir}`,
    `- runtime_mode: ${runtimeMode}`,
    `- logs_command_file: ${logsCommandFile}`,
    `- tests_command_file: ${testsCommandFile}`,
    `- global_optidev_home: ${homeDir}`,
    "",
    "## Manifest",
    `- active_task: ${manifest.workspace.active_task}`,
    `- branch: ${manifest.workspace.branch}`,
    `- head_commit: ${manifest.workspace.head_commit}`,
    `- declared_agents: ${activeAgents.join(", ") || "none"}`,
    "",
    "## Project Memory",
    ...memorySummary.lines.map((line) => (line.startsWith("-") ? line : `- ${line}`)),
    "",
    "## Skills Inventory",
    "### Project skills",
    ...(localSkills.length > 0 ? localSkills.map((item) => `- ${item}`) : ["- none"]),
    "",
    "## Agents Inventory",
    "### Project agents",
    ...(projectAgents.length > 0 ? projectAgents.map((item) => `- ${item}`) : ["- none"]),
    "",
  ];
  await fs.writeFile(contextFile, contextLines.join("\n"), "utf8");

  const prompts = [
    [
      `You are the primary ${runnerName} runner inside an OptiDev workspace for project '${projectName}'.`,
      "You are not working solo in a plain terminal. Treat OptiDev as your runtime environment.",
      "",
      "Operating rules:",
      `1. First read ${contextFile}.`,
      "2. Use the listed local skills and agents when they materially fit the repository.",
      "3. Use the memory snapshot from the context file before making startup assumptions.",
      "4. If logs/tests command files are empty, inspect the repository and choose the safest practical commands.",
      `5. Write the app/logs start command into ${logsCommandFile}.`,
      `6. Write the tests watch command into ${testsCommandFile}.`,
      "7. Explain which skills, agents, and memory signals you used before moving into feature work.",
      "",
      `Runtime mode: ${runtimeMode}`,
      `Declared active agents: ${activeAgents.join(", ") || "none"}`,
      `Project root: ${projectDir}`,
      `Session dir: ${sessionDir}`,
    ].join("\n"),
  ];
  const messages = ["Workspace bootstrap plugin configured tabs: Chat, Editor, Logs, Tests."];
  if (advice) {
    const repoAdvice = await buildNativeRepoAdvice(projectDir);
    prompts.push(repoAdvice.initial_prompt);
    messages.push("Advice mode: startup repo analysis prompt queued for the runner.");
  }

  const promptPath = await writeStartupPrompt(sessionDir, prompts);
  const chatCommand = await writeChatScript(sessionDir, projectName, projectDir, runnerName, promptPath);
  const editorCommand = await writeEditorPaneScript(sessionDir, projectDir);
  const logsPaneCommand = await writeConfiguredPaneScript(sessionDir, "logs", projectDir, logsCommandFile);
  const testsPaneCommand = await writeConfiguredPaneScript(sessionDir, "tests", projectDir, testsCommandFile);
  const layoutSpec: Record<string, unknown> = {
    tabs: (manifest.layout.length > 0 ? manifest.layout : DEFAULT_LAYOUT_SPEC.tabs).map((tab) => {
      const item = tab as { name: string; pane?: string; root?: unknown };
      const pane = item.pane ?? "";
      if (pane === "chat") {
        return { name: item.name, root: { type: "pane", name: "chat", role: "chat", command: chatCommand } };
      }
      if (pane === "editor") {
        return { name: item.name, root: { type: "pane", name: "editor", command: editorCommand } };
      }
      if (pane === "logs") {
        return { name: item.name, root: { type: "pane", name: "logs", command: logsPaneCommand } };
      }
      if (pane === "tests") {
        return { name: item.name, root: { type: "pane", name: "tests", command: testsPaneCommand } };
      }
      return item.root && typeof item.root === "object"
        ? { name: item.name, root: item.root }
        : { name: item.name, root: { type: "pane", name: pane || "shell", command: ["bash"] } };
    }),
  };
  return { messages, prompts, layout_spec: layoutSpec };
}

function zellijSessionName(projectName: string): string {
  const safe = projectName
    .trim()
    .replace(/[^A-Za-z0-9\-_]/g, "-")
    .replace(/^[\-_]+|[\-_]+$/g, "") || "project";
  return `optid-${safe}`;
}

function renderKdlPane(name: string, command: string[]): string {
  if (command.length === 1) {
    return `pane name=${JSON.stringify(name)} command=${JSON.stringify(command[0])}`;
  }
  return (
    `pane name=${JSON.stringify(name)} command=${JSON.stringify(command[0])} {\n` +
    `  args ${command.slice(1).map((item) => JSON.stringify(item)).join(" ")}\n` +
    "}"
  );
}

function renderKdlNode(node: Record<string, unknown>, indent: string): string {
  if (String(node.type ?? "") === "split") {
    const direction = String(node.direction ?? "vertical");
    const children = Array.isArray(node.children) ? node.children.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item)) : [];
    const renderedChildren = children.length > 0
      ? children.map((child) => renderKdlNode(child, `${indent}  `)).join("\n")
      : `${indent}  pane name="shell" command="bash"`;
    return `${indent}pane split_direction=${JSON.stringify(direction)} {\n${renderedChildren}\n${indent}}`;
  }
  const name = String(node.name ?? "pane");
  const command = Array.isArray(node.command) && node.command.length > 0 ? node.command.map((item) => String(item)) : ["bash"];
  return `${indent}${renderKdlPane(name, command)}`;
}

function renderZellijLayout(layoutSpec: Record<string, unknown>): string {
  const tabs = Array.isArray(layoutSpec.tabs)
    ? layoutSpec.tabs.filter((item): item is Record<string, unknown> => !!item && typeof item === "object" && !Array.isArray(item))
    : [];
  const renderedTabs = tabs.length > 0
    ? tabs.map((tab) => {
        const name = String(tab.name ?? "Workspace");
        const root = asObject(tab.root) ?? { type: "pane", name: "shell", command: ["bash"] };
        return `tab name=${JSON.stringify(name)} {\n${renderKdlNode(root, "  ")}\n}`;
      }).join("\n")
    : 'tab name="Workspace" {\n  pane name="shell" command="bash"\n}';
  return `layout {\n${renderedTabs
    .split("\n")
    .map((line) => `  ${line}`)
    .join("\n")}\n}\n`;
}

async function startMuxSession(
  projectName: string,
  projectDir: string,
  sessionDir: string,
  backend: string,
  layoutSpec: Record<string, unknown>,
  deps: StartupDeps,
): Promise<{ backend: string; session_name: string; layout_path: string }> {
  const sessionName = zellijSessionName(projectName);
  if (backend === "textual") {
    const layoutPath = path.join(sessionDir, "layout.textual.json");
    await fs.writeFile(layoutPath, JSON.stringify({
      project: projectName,
      project_dir: projectDir,
      session_name: sessionName,
      layout: layoutSpec,
    }, null, 2), "utf8");
    return {
      backend,
      session_name: sessionName,
      layout_path: layoutPath,
    };
  }
  const layoutPath = path.join(sessionDir, "layout.kdl");
  await fs.writeFile(layoutPath, renderZellijLayout(layoutSpec), "utf8");
  if (!truthyEnv("OPTIDEV_DISABLE_ZELLIJ")) {
    deps.spawnBackground("zellij", [
      "attach",
      "--create-background",
      sessionName,
      "options",
      "--default-layout",
      layoutPath,
      "--default-cwd",
      projectDir,
    ]);
  }
  return {
    backend: "zellij",
    session_name: sessionName,
    layout_path: layoutPath,
  };
}

async function startHooks(projectName: string, projectDir: string, projectConfig: ProjectConfig, homeDir: string, deps: StartupDeps): Promise<HookState[]> {
  const hooksPath = path.join(homeDir, "sessions", projectName, "hooks.json");
  const commands: Array<{ group: string; command: string }> = [];
  for (const command of projectConfig.dev.start) {
    commands.push({ group: "dev.start", command });
  }
  for (const command of projectConfig.tests.watch) {
    commands.push({ group: "tests.watch", command });
  }
  for (const command of projectConfig.logs.sources) {
    commands.push({ group: "logs.sources", command });
  }

  const hooks: HookState[] = [];
  if (!truthyEnv("OPTIDEV_DISABLE_HOOKS")) {
    for (const item of commands) {
      const pid = deps.spawnDetached("bash", ["-lc", item.command], projectDir);
      hooks.push({
        group: item.group,
        command: item.command,
        pid,
        status: pid === null ? "unknown" : "running",
      });
    }
  }
  await writeJson(hooksPath, hooks);
  return hooks;
}

async function saveRunnerBootstrap(homeDir: string, projectName: string, projectDir: string, runnerName: string, now: string): Promise<void> {
  await writeJson(path.join(homeDir, "sessions", projectName, "runner.json"), {
    project: projectName,
    runner: runnerName,
    command: runnerCommand(projectDir, runnerName),
    bootstrapped_at: now,
  });
}

async function currentHomeSession(homeDir: string, projectName: string): Promise<SessionState | null> {
  const sessionPath = path.join(homeDir, "sessions", projectName, "session.json");
  if (!(await exists(sessionPath))) {
    return null;
  }
  return readJson<SessionState>(sessionPath);
}

async function writeSessionState(homeDir: string, state: SessionState): Promise<void> {
  await writeJson(path.join(homeDir, "sessions", state.project, "session.json"), state);
  await writeJson(path.join(homeDir, "active_session.json"), {
    project: state.project,
    status: state.status,
    mux_backend: state.mux_backend,
    mux_session_name: state.mux_session_name,
    updated_at: new Date().toISOString(),
  });
}

async function writeProjectSession(projectDir: string, manifest: WorkspaceManifest, state: SessionState, runnerName: string, mode: string): Promise<void> {
  await writeJson(path.join(projectDir, ".optidev", "session.json"), {
    project: manifest.project,
    manifest_fingerprint: manifestFingerprint(manifest),
    active_task: manifest.workspace.active_task,
    branch: manifest.workspace.branch,
    head_commit: manifest.workspace.head_commit,
    agents: manifest.agents.map((item) => item.name),
    status: state.status,
    runner: runnerName,
    mux_session_name: state.mux_session_name,
    layout_path: state.layout_path,
    last_mode: mode,
    started_at: state.started_at,
    stopped_at: state.stopped_at,
  });
}

function attachHint(state: SessionState): string {
  if (state.mux_backend === "zellij") {
    return `Attach: zellij attach ${state.mux_session_name}`;
  }
  if (state.mux_backend === "textual") {
    return `Open /optidev in the forked t3 UI. Layout file: ${state.layout_path}`;
  }
  return `Attach: backend=${state.mux_backend} session=${state.mux_session_name}`;
}

async function startResolvedProject(
  context: OptiDevRouteContext,
  projectDir: string,
  advice: boolean,
  forceResume: boolean,
  deps: Partial<StartupDeps> = {},
): Promise<OptiDevActionResponse> {
  const mergedDeps: StartupDeps = { ...defaultDeps, ...deps };
  const homeDir = resolveHomeDir(context);
  const globalConfig = await loadGlobalConfig(context);
  const manifest = await ensureWorkspaceManifest(projectDir, globalConfig.defaultRunner);
  const projectConfig = await loadProjectConfig(projectDir);
  const projectSession = await loadProjectSession(projectDir);
  const runtimeMode = decideRuntimeMode(manifest, projectSession, forceResume);
  if (forceResume && runtimeMode === "missing") {
    return { ok: false, lines: ["No compatible workspace session to resume."] };
  }

  const projectName = manifest.project || path.basename(projectDir);
  const runnerName = primaryRunner(manifest, globalConfig.defaultRunner);
  const activeAgents = await resolveAgents(projectDir, manifest);
  const sessionDir = path.join(homeDir, "sessions", projectName);
  await ensureDir(sessionDir);
  const startup = await buildStartupArtifacts(
    context,
    projectName,
    projectDir,
    sessionDir,
    runnerName,
    runtimeMode,
    manifest,
    projectConfig,
    activeAgents.map((item) => item.name),
    advice,
  );

  const existing = await currentHomeSession(homeDir, projectName);
  let state: SessionState;
  if (existing && existing.status === "running") {
    state = {
      ...existing,
      restored: true,
    };
  } else {
    const mux = await startMuxSession(
      projectName,
      projectDir,
      sessionDir,
      globalConfig.muxBackend,
      startup.layout_spec,
      mergedDeps,
    );
    state = {
      project: projectName,
      status: "running",
      started_at: mergedDeps.now(),
      stopped_at: null,
      mux_backend: mux.backend,
      mux_session_name: mux.session_name,
      layout_path: mux.layout_path,
      restored: false,
    };
  }

  const runtimeConfig = projectConfigFromManifest(manifest, projectConfig);
  const hooks = await startHooks(projectName, projectDir, runtimeConfig, homeDir, mergedDeps);
  const now = mergedDeps.now();
  await saveRunnerBootstrap(homeDir, projectName, projectDir, runnerName, now);
  await writeJson(path.join(sessionDir, "agents.json"), activeAgents);
  await writeSessionState(homeDir, state);
  await writeProjectSession(projectDir, manifest, state, runnerName, runtimeMode);
  await recordNativeWorkspaceStarted(context, { project: projectName, status: state.status });

  const memorySummary = await nativeMemorySummary(projectDir);
  const lines = ["OptiDev workspace ready.", ...memorySummary.lines, `Runtime mode: ${runtimeMode}.`];
  if (manifest.workspace.active_task) {
    lines.push(`Active task: ${manifest.workspace.active_task}.`);
  }
  if (activeAgents.length > 0) {
    lines.push(`Declared agents: ${activeAgents.map((item) => item.name).join(", ")}.`);
  }
  if (state.restored) {
    lines.push("Session restored.");
    if (advice) {
      lines.push("Advice mode was requested, but the session was restored. Restart the workspace to inject the startup advice prompt.");
    }
  }
  if (hooks.length > 0) {
    lines.push(`Hooks started: ${hooks.length}.`);
  }
  lines.push(...startup.messages);
  lines.push(`Runner ready: ${runnerName}.`);
  lines.push(attachHint(state));
  lines.push("What are we doing today?");
  return { ok: true, lines };
}

export async function nativeStartAction(
  context: OptiDevRouteContext,
  projectDir: string,
  advice = false,
  deps: Partial<StartupDeps> = {},
): Promise<OptiDevActionResponse> {
  return startResolvedProject(context, path.resolve(projectDir), advice, false, deps);
}

export async function nativeResumeAction(
  context: OptiDevRouteContext,
  projectDir: string,
  deps: Partial<StartupDeps> = {},
): Promise<OptiDevActionResponse> {
  return startResolvedProject(context, path.resolve(projectDir), false, true, deps);
}

export async function nativeGoAction(
  context: OptiDevRouteContext,
  target: string,
  cwd: string,
  advice = false,
  deps: Partial<StartupDeps> = {},
): Promise<OptiDevActionResponse> {
  const initResult = await nativeInitAction(context, target, cwd);
  if (!initResult.ok) {
    return initResult;
  }
  const projectDir = target.trim() === "." ? path.resolve(cwd) : path.resolve(cwd, target.trim());
  const startResult = await startResolvedProject(context, projectDir, advice, false, deps);
  return {
    ok: startResult.ok,
    lines: [...initResult.lines, ...startResult.lines],
  };
}
