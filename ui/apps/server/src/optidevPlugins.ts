import { execFile } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { promisify } from "node:util";

import type {
  OptiDevActionPayload,
  OptiDevActionResponse,
  OptiDevPluginInventoryEntryPayload,
  OptiDevRouteContext,
  OptiDevTelegramBridgeStatusPayload,
} from "./optidevContract";
import { loadGlobalConfig, resolveHomeDir } from "./optidevNative";
import { exists, loadMapping, writeYaml } from "./optidevPersistence";
import { requestOptiDevTelegramBridgeReload } from "./optidevTelegramBridge";

const execFileAsync = promisify(execFile);

interface TelegramConfig {
  enabled: boolean;
  token: string;
  chat_id: number | null;
  updated_at: string;
  target_thread_id: string | null;
  target_updated_at: string | null;
}

export interface OptiDevPluginInventoryEntry {
  id: "advice" | "telegram" | "skills" | "agents";
  label: string;
  scope: "native";
  status: string;
  detail: string;
}

function maskToken(token: string): string {
  if (token.length <= 8) {
    return token ? `${token.slice(0, 2)}***` : "";
  }
  return `${token.slice(0, 4)}***${token.slice(-2)}`;
}

function stripAnsi(text: string): string[] {
  const clean = text.replace(/\x1b\[[0-9;]*m/g, "");
  return clean.split(/\r?\n/).map((line) => line.trimEnd()).filter((line) => line.trim().length > 0);
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function detectLanguages(projectDir: string, files: string[]): string[] {
  const found = new Set<string>();
  for (const file of files) {
    const rel = path.relative(projectDir, file);
    if (rel.includes(`node_modules${path.sep}`) || rel.includes(`.git${path.sep}`)) {
      continue;
    }
    const ext = path.extname(file).toLowerCase();
    const language = {
      ".py": "python",
      ".ts": "typescript",
      ".tsx": "typescript",
      ".js": "javascript",
      ".jsx": "javascript",
      ".go": "go",
      ".rs": "rust",
      ".java": "java",
      ".rb": "ruby",
    }[ext];
    if (language) {
      found.add(language);
    }
    if (found.size >= 6) {
      break;
    }
  }
  return [...found].sort();
}

async function walkFiles(root: string): Promise<string[]> {
  if (!(await exists(root))) {
    return [];
  }
  const out: string[] = [];
  const queue = [root];
  while (queue.length > 0) {
    const current = queue.shift()!;
    const entries = await fs.readdir(current, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(current, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "node_modules" || entry.name === ".git") {
          continue;
        }
        queue.push(fullPath);
        continue;
      }
      if (entry.isFile()) {
        out.push(fullPath);
      }
    }
  }
  return out;
}

export async function buildNativeRepoAdvice(projectDir: string): Promise<{ repo_summary: string; initial_prompt: string }> {
  const markers = [
    "package.json",
    "pnpm-lock.yaml",
    "yarn.lock",
    "package-lock.json",
    "pyproject.toml",
    "requirements.txt",
    "poetry.lock",
    "go.mod",
    "Cargo.toml",
    "Dockerfile",
    "docker-compose.yml",
    "docker-compose.yaml",
    ".github/workflows",
    "Makefile",
    "README.md",
    "AGENTS.md",
    ".agents",
  ];
  const present: string[] = [];
  for (const marker of markers) {
    if (await exists(path.join(projectDir, marker))) {
      present.push(marker);
    }
  }

  const topDirs = (await fs.readdir(projectDir, { withFileTypes: true }))
    .filter((item) => item.isDirectory() && (!item.name.startsWith(".") || item.name === ".agents" || item.name === ".project"))
    .slice(0, 8)
    .map((item) => item.name);
  const files = await walkFiles(projectDir);
  const languages = detectLanguages(projectDir, files);

  const frameworks = new Set<string>();
  const packageJsonPath = path.join(projectDir, "package.json");
  if (await exists(packageJsonPath)) {
    try {
      const packageJson = await readJson<Record<string, Record<string, string>>>(packageJsonPath);
      const deps = new Set([
        ...Object.keys(packageJson.dependencies ?? {}),
        ...Object.keys(packageJson.devDependencies ?? {}),
      ]);
      if (deps.has("react")) frameworks.add("react");
      if (deps.has("next")) frameworks.add("nextjs");
      if (deps.has("vue")) frameworks.add("vue");
      if (deps.has("vite")) frameworks.add("vite");
      if (deps.has("typescript")) frameworks.add("typescript");
    } catch {
      // ignore malformed package.json in summary helper
    }
  }
  const pyprojectPath = path.join(projectDir, "pyproject.toml");
  if (await exists(pyprojectPath)) {
    const pyproject = (await fs.readFile(pyprojectPath, "utf8")).toLowerCase();
    for (const [token, label] of [["fastapi", "fastapi"], ["django", "django"], ["flask", "flask"], ["pytest", "pytest"]] as const) {
      if (pyproject.includes(token)) {
        frameworks.add(label);
      }
    }
  }

  const summary = [
    `- root: ${projectDir}`,
    `- top directories: ${topDirs.join(", ") || "none"}`,
    `- detected languages: ${languages.join(", ") || "unknown"}`,
    `- detected frameworks/tooling: ${[...frameworks].sort().join(", ") || "unknown"}`,
    `- markers: ${present.sort().join(", ") || "none"}`,
  ].join("\n");

  return {
    repo_summary: summary,
    initial_prompt:
      "Study this repository first and respond with practical setup advice.\n\n" +
      "Tasks:\n" +
      "1. Inspect the repo structure and detect the main stack, tooling, and workflows.\n" +
      "2. Suggest the most useful skills for this repo.\n" +
      "3. Suggest the most useful agents for this repo.\n" +
      "4. Keep the answer concise and actionable.\n" +
      "5. If useful, run `optid skills search ...` and `optid agents search ...` with focused queries.\n\n" +
      `Repository summary from OptiDev:\n${summary}\n`,
  };
}

function skillNameFromSpec(spec: string): string {
  if (spec.includes("@")) {
    return spec.split("@").at(-1) || "skill";
  }
  return spec.split("/").at(-1) || "skill";
}

function safeName(value: string): string {
  return value.replaceAll(":", "-").replaceAll("/", "-").trim() || "skill";
}

async function nativeSkillsSearch(args: string[]): Promise<OptiDevActionResponse> {
  if (args.length === 0) {
    return { ok: false, lines: ["Usage: optid skills search <query...>"] };
  }
  const executable = process.env.OPTIDEV_SKILLS_NPX || "npx";
  try {
    const result = await execFileAsync(executable, ["--yes", "skills", "find", args.join(" ")], {
      encoding: "utf8",
    });
    const lines = stripAnsi((result.stdout || "") + (result.stderr || ""));
    return { ok: true, lines: lines.length > 0 ? lines : ["No skills found."] };
  } catch (error) {
    const lines = stripAnsi(
      `${(error as { stdout?: string }).stdout ?? ""}${(error as { stderr?: string }).stderr ?? ""}` || "Skills search failed.",
    );
    return { ok: false, lines: lines.length > 0 ? lines : ["Skills search failed."] };
  }
}

async function nativeSkillsInstall(args: string[], cwd: string): Promise<OptiDevActionResponse> {
  if (args.length === 0) {
    return { ok: false, lines: ["Usage: optid skills install <owner/repo@skill>"] };
  }
  const spec = args[0].trim();
  const destinationRoot = path.join(path.resolve(cwd), ".agents", "skills");
  const desiredName = safeName(skillNameFromSpec(spec));
  const desiredPath = path.join(destinationRoot, desiredName);
  if (await exists(desiredPath)) {
    return { ok: true, lines: [`Skill already present: ${desiredPath}`, "Nothing to do."] };
  }
  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "optidev-skills-"));
  try {
    const executable = process.env.OPTIDEV_SKILLS_NPX || "npx";
    const env = {
      ...process.env,
      CODEX_HOME: tempRoot,
    };
    try {
      await execFileAsync(executable, ["--yes", "skills", "add", spec, "-g", "-y"], {
        encoding: "utf8",
        env,
      });
    } catch (error) {
      const lines = stripAnsi(
        `${(error as { stdout?: string }).stdout ?? ""}${(error as { stderr?: string }).stderr ?? ""}` || "Skill install failed.",
      );
      return { ok: false, lines: lines.length > 0 ? lines : ["Skill install failed."] };
    }
    const skillsRoot = path.join(tempRoot, "skills");
    if (!(await exists(skillsRoot))) {
      return { ok: false, lines: ["Skills CLI did not produce any installable files."] };
    }
    const entries = await fs.readdir(skillsRoot);
    if (entries.length === 0) {
      return { ok: false, lines: ["Skills CLI did not produce any installable files."] };
    }
    await fs.mkdir(destinationRoot, { recursive: true });
    await fs.cp(path.join(skillsRoot, entries[0]!), desiredPath, { recursive: true });
    return { ok: true, lines: [`Installed skill: ${spec}`, `Project path: ${desiredPath}`] };
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

function sanitizeCategory(value: string): string {
  const clean = value.toLowerCase().replaceAll("&", "and").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
  return clean || "imported-agent";
}

interface AgentMeta {
  slug: string;
  name: string;
  description: string;
  website: string;
  source: string;
  category: string;
}

async function fetchText(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { "User-Agent": "Mozilla/5.0" },
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.text();
}

async function fetchAgentMeta(url: string, baseUrl: string): Promise<AgentMeta> {
  const body = await fetchText(url);
  const matches = [...body.matchAll(/<script type="application\/ld\+json">(.*?)<\/script>/gs)];
  for (const match of matches) {
    try {
      const loaded = JSON.parse(match[1]!);
      if (loaded && typeof loaded === "object" && loaded["@type"] === "SoftwareApplication") {
        const slug = url.replace(/\/+$/, "").split("/").at(-1) || "agent";
        return {
          slug,
          name: typeof loaded.name === "string" ? loaded.name : slug,
          description: typeof loaded.description === "string" ? loaded.description : "Imported from AI Agents List.",
          website: typeof loaded.url === "string" ? loaded.url : "",
          source: url,
          category: sanitizeCategory(typeof loaded.applicationCategory === "string" ? loaded.applicationCategory : "imported-agent"),
        };
      }
    } catch {
      continue;
    }
  }
  throw new Error(`Unable to parse agent metadata from ${url.startsWith("http") ? url : `${baseUrl}/agents/${url}`}`);
}

function renderAgent(meta: AgentMeta): string {
  return (
    `Agent: ${meta.name}\n\n` +
    "Role:\nImported agent definition from AI Agents List.\n\n" +
    "Responsibilities:\n" +
    "- follow local AGENTS.md and repository rules\n" +
    "- adapt behavior to the current project context\n" +
    "- review the imported source before autonomous execution\n\n" +
    "Skills:\n" +
    `- ${meta.category}\n` +
    "- imported-agent\n\n" +
    "Source:\n" +
    `- ${meta.source}\n\n` +
    "Website:\n" +
    `- ${meta.website || "n/a"}\n\n` +
    "Description:\n" +
    `${meta.description}\n`
  );
}

async function nativeAgentsSearch(args: string[]): Promise<OptiDevActionResponse> {
  if (args.length === 0) {
    return { ok: false, lines: ["Usage: optid agents search <query...>"] };
  }
  const baseUrl = (process.env.OPTIDEV_AGENTS_BASE_URL || "https://aiagentslist.com").replace(/\/+$/, "");
  const body = await fetchText(`${baseUrl}/agents?q=${encodeURIComponent(args.join(" "))}`);
  const slugs: string[] = [];
  for (const match of body.matchAll(/href="\/agents\/([^"/?#]+)"/g)) {
    const slug = match[1]!;
    if (!slugs.includes(slug)) {
      slugs.push(slug);
    }
  }
  if (slugs.length === 0) {
    return { ok: true, lines: ["No agents found."] };
  }
  const lines: string[] = [];
  for (const slug of slugs.slice(0, 5)) {
    const meta = await fetchAgentMeta(`${baseUrl}/agents/${slug}`, baseUrl);
    lines.push(`${meta.slug} - ${meta.name}`);
    lines.push(`  ${meta.description}`);
  }
  return { ok: true, lines };
}

async function nativeAgentsInstall(args: string[], cwd: string): Promise<OptiDevActionResponse> {
  if (args.length === 0) {
    return { ok: false, lines: ["Usage: optid agents install <slug|url>"] };
  }
  const baseUrl = (process.env.OPTIDEV_AGENTS_BASE_URL || "https://aiagentslist.com").replace(/\/+$/, "");
  const raw = args[0]!.trim();
  const url = raw.startsWith("http") ? raw : `${baseUrl}/agents/${raw}`;
  const meta = await fetchAgentMeta(url, baseUrl);
  const destinationRoot = path.join(path.resolve(cwd), ".agents", "agents");
  const destinationPath = path.join(destinationRoot, `${meta.slug}.md`);
  if (await exists(destinationPath)) {
    return { ok: true, lines: [`Agent already present: ${destinationPath}`, "Nothing to do."] };
  }
  await fs.mkdir(destinationRoot, { recursive: true });
  await fs.writeFile(destinationPath, renderAgent(meta), "utf8");
  return { ok: true, lines: [`Installed agent: ${meta.name}`, `Project path: ${destinationPath}`] };
}

function pluginsDir(context: OptiDevRouteContext): string {
  return path.join(resolveHomeDir(context), "plugins");
}

async function telegramConfigPath(context: OptiDevRouteContext): Promise<string> {
  const dir = pluginsDir(context);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, "telegram-config.json");
}

async function telegramEventsPath(context: OptiDevRouteContext): Promise<string> {
  const dir = pluginsDir(context);
  await fs.mkdir(dir, { recursive: true });
  return path.join(dir, "telegram-events.jsonl");
}

async function loadTelegramConfig(context: OptiDevRouteContext): Promise<TelegramConfig> {
  const filePath = await telegramConfigPath(context);
  if (!(await exists(filePath))) {
    return { enabled: false, token: "", chat_id: null, updated_at: "", target_thread_id: null, target_updated_at: null };
  }
  try {
    const data = await readJson<Record<string, unknown>>(filePath);
    return {
      enabled: Boolean(data.enabled),
      token: typeof data.token === "string" ? data.token : "",
      chat_id: typeof data.chat_id === "number" ? data.chat_id : null,
      updated_at: typeof data.updated_at === "string" ? data.updated_at : "",
      target_thread_id: typeof data.target_thread_id === "string" ? data.target_thread_id : null,
      target_updated_at: typeof data.target_updated_at === "string" ? data.target_updated_at : null,
    };
  } catch {
    return { enabled: false, token: "", chat_id: null, updated_at: "", target_thread_id: null, target_updated_at: null };
  }
}

async function saveTelegramConfig(context: OptiDevRouteContext, config: TelegramConfig): Promise<void> {
  await writeJson(await telegramConfigPath(context), config);
  requestOptiDevTelegramBridgeReload();
}

export async function readTelegramBridgeStatus(
  context: OptiDevRouteContext,
): Promise<OptiDevTelegramBridgeStatusPayload> {
  const config = await loadTelegramConfig(context);
  const tokenHint = maskToken(config.token);
  const chatId = config.chat_id !== null ? String(config.chat_id) : "";
  if (!config.enabled) {
    return {
      enabled: false,
      chatId,
      tokenHint,
      targetThreadId: config.target_thread_id,
      targetUpdatedAt: config.target_updated_at,
      statusLine:
        config.chat_id !== null
          ? `Telegram bridge is disabled. Saved chat id: ${config.chat_id}.`
          : "Telegram bridge is disabled.",
    };
  }

  const targetLabel = config.target_thread_id ? ` Selected session: ${config.target_thread_id}.` : "";
  return {
    enabled: true,
    chatId,
    tokenHint,
    targetThreadId: config.target_thread_id,
    targetUpdatedAt: config.target_updated_at,
    statusLine: `Telegram bridge is enabled for chat ${config.chat_id} (token ${tokenHint}).${targetLabel}`,
  };
}

export async function readPluginInventory(
  context: OptiDevRouteContext,
): Promise<OptiDevPluginInventoryEntry[]> {
  const telegram = await readTelegramBridgeStatus(context);
  return [
    {
      id: "advice",
      label: "Repo Advice",
      scope: "native",
      status: "available",
      detail: "Builds a repository summary and bootstrap prompt from the current project.",
    },
    {
      id: "telegram",
      label: "Telegram Bridge",
      scope: "native",
      status: telegram.enabled ? "enabled" : "disabled",
      detail: telegram.statusLine,
    },
    {
      id: "skills",
      label: "Skills Catalog",
      scope: "native",
      status: "available",
      detail: "Searches and installs skills into the repo-local .agents/skills path.",
    },
    {
      id: "agents",
      label: "Agents Catalog",
      scope: "native",
      status: "available",
      detail: "Searches and installs agent specs into the repo-local .agents/agents path.",
    },
  ];
}

async function appendTelegramEvent(context: OptiDevRouteContext, event: Record<string, unknown>): Promise<void> {
  const filePath = await telegramEventsPath(context);
  await fs.appendFile(filePath, `${JSON.stringify(event)}\n`, "utf8");
}

async function readActiveSession(context: OptiDevRouteContext): Promise<Record<string, unknown> | null> {
  const filePath = path.join(resolveHomeDir(context), "active_session.json");
  if (!(await exists(filePath))) {
    return null;
  }
  try {
    const data = await readJson<Record<string, unknown>>(filePath);
    return typeof data === "object" && data !== null ? data : null;
  } catch {
    return null;
  }
}

async function saveGlobalTelegramDefaults(context: OptiDevRouteContext, token: string, chatId: number): Promise<void> {
  const configPath = path.join(resolveHomeDir(context), "config.yaml");
  const data = await (await exists(configPath) ? loadMapping(configPath) : Promise.resolve({}));
  data.telegram_bot_token = token;
  data.telegram_chat_id = chatId;
  await writeYaml(configPath, data);
}

async function telegramStatus(context: OptiDevRouteContext): Promise<OptiDevActionResponse> {
  const status = await readTelegramBridgeStatus(context);
  if (!status.enabled && status.chatId) {
    return {
      ok: true,
      lines: [
        `${status.statusLine} Run \`optid telegram start --token <token> --chat-id <chat-id>\` to enable it.`,
      ],
      data: status,
    };
  }
  return { ok: true, lines: [status.statusLine], data: status };
}

function parseTelegramFlags(args: string[]): { token?: string; chat_id?: string } | null {
  const out: { token?: string; chat_id?: string } = {};
  let index = 0;
  while (index < args.length) {
    const flag = args[index];
    if ((flag !== "--token" && flag !== "--chat-id") || index + 1 >= args.length) {
      return null;
    }
    out[flag === "--token" ? "token" : "chat_id"] = args[index + 1].trim();
    index += 2;
  }
  return out;
}

async function telegramStart(
  context: OptiDevRouteContext,
  args: string[],
  payload?: Pick<OptiDevActionPayload, "threadId">,
): Promise<OptiDevActionResponse> {
  const current = await loadTelegramConfig(context);
  const parsed = parseTelegramFlags(args);
  if (parsed === null) {
    return { ok: false, lines: ["Usage: optid telegram [start --token <token> --chat-id <chat-id>|stop|status]"] };
  }
  const globalConfig = await loadGlobalConfig(context);
  const token =
    parsed.token ||
    current.token ||
    globalConfig.telegramBotToken ||
    process.env.OPTIDEV_TELEGRAM_BOT_TOKEN?.trim() ||
    "";
  const globalChatId = globalConfig.telegramChatId ?? null;
  const chatIdRaw =
    parsed.chat_id ||
    (current.chat_id !== null ? String(current.chat_id) : "") ||
    (globalChatId !== null ? String(globalChatId) : "") ||
    process.env.OPTIDEV_TELEGRAM_CHAT_ID?.trim() ||
    "";
  if (!token) {
    return { ok: false, lines: ["Missing Telegram bot token. Use: optid telegram start --token <token> --chat-id <chat-id>"] };
  }
  const chatId = Number.parseInt(chatIdRaw, 10);
  if (!Number.isFinite(chatId)) {
    return { ok: false, lines: ["Invalid Telegram chat id. Use a numeric value."] };
  }
  if (parsed.token || parsed.chat_id) {
    await saveGlobalTelegramDefaults(context, token, chatId);
  }
  const explicitThreadId = payload?.threadId?.trim() ? payload.threadId.trim() : null;
  const updatedAt = new Date().toISOString();
  await saveTelegramConfig(context, {
    enabled: true,
    token,
    chat_id: chatId,
    updated_at: updatedAt,
    target_thread_id: explicitThreadId,
    target_updated_at: explicitThreadId ? updatedAt : null,
  });
  const targetLine = explicitThreadId
    ? `Telegram is now pinned to session ${explicitThreadId}.`
    : "Telegram will attach to the best available active session until one is explicitly selected.";
  return {
    ok: true,
    lines: [
      `Telegram bridge enabled for chat ${chatId}.`,
      targetLine,
      "Telegram messages will be injected into the selected chat session.",
    ],
  };
}

async function telegramStop(context: OptiDevRouteContext): Promise<OptiDevActionResponse> {
  const current = await loadTelegramConfig(context);
  if (!current.token && current.chat_id === null && !current.enabled) {
    return { ok: true, lines: ["Telegram bridge is already disabled."] };
  }
  await saveTelegramConfig(context, {
    enabled: false,
    token: current.token,
    chat_id: current.chat_id,
    updated_at: new Date().toISOString(),
    target_thread_id: current.target_thread_id,
    target_updated_at: current.target_updated_at,
  });
  return { ok: true, lines: ["Telegram bridge disabled."] };
}

export async function recordNativeWorkspaceStarted(
  context: OptiDevRouteContext,
  event: { project: string; status: string },
): Promise<void> {
  await appendTelegramEvent(context, { type: "workspace_start", context: event });
  requestOptiDevTelegramBridgeReload();
}

export async function recordNativeWorkspaceStopped(
  context: OptiDevRouteContext,
  event: { project: string; status: string },
): Promise<void> {
  await appendTelegramEvent(context, { type: "workspace_stop", context: event });
  requestOptiDevTelegramBridgeReload();
}

export async function readNativePluginInventory(
  context: OptiDevRouteContext,
  cwd: string,
): Promise<OptiDevPluginInventoryEntryPayload[]> {
  const telegram = await readTelegramBridgeStatus(context);
  const advice = await buildNativeRepoAdvice(path.resolve(cwd));
  return [
    {
      id: "advice",
      title: "Advice",
      category: "analysis",
      enabled: true,
      summary: "Repository bootstrap analysis that prepares a concise repo summary for the runner.",
      details: advice.repo_summary.split("\n").filter((line) => line.trim().length > 0),
    },
    {
      id: "telegram",
      title: "Telegram",
      category: "integration",
      enabled: telegram.enabled,
      summary: telegram.statusLine,
      details: [
        `chat: ${telegram.chatId || "unset"}`,
        `token: ${telegram.tokenHint || "unset"}`,
        `target session: ${telegram.targetThreadId ?? "auto"}`,
      ],
    },
    {
      id: "skills",
      title: "Skills",
      category: "catalog",
      enabled: true,
      summary: "Searches for installable skills and writes selected ones into .agents/skills.",
      details: [
        "command: optid skills search <query...>",
        "command: optid skills install <owner/repo@skill>",
      ],
    },
    {
      id: "agents",
      title: "Agents",
      category: "catalog",
      enabled: true,
      summary: "Searches and installs agent definitions into .agents/agents.",
      details: [
        "command: optid agents search <query...>",
        "command: optid agents install <slug|url>",
      ],
    },
  ];
}

export function supportsNativePluginCommand(command: string, args: string[]): boolean {
  return command === "advice" || command === "telegram" || command === "skills" || command === "agents";
}

export async function nativePluginAction(
  context: OptiDevRouteContext,
  command: string,
  args: string[],
  cwd: string,
  payload?: Pick<OptiDevActionPayload, "threadId">,
): Promise<OptiDevActionResponse> {
  if (command === "advice") {
    const advice = await buildNativeRepoAdvice(path.resolve(cwd));
    return { ok: true, lines: [advice.repo_summary] };
  }
  if (command === "telegram") {
    const subcommand = args[0] ?? "";
    if (!subcommand) {
      return { ok: false, lines: ["Usage: optid telegram [start --token <token> --chat-id <chat-id>|stop|status]"] };
    }
    if (subcommand === "status") {
      return telegramStatus(context);
    }
    if (subcommand === "start") {
      return telegramStart(context, args.slice(1), payload);
    }
    if (subcommand === "stop") {
      return telegramStop(context);
    }
    return { ok: false, lines: ["Usage: optid telegram [start --token <token> --chat-id <chat-id>|stop|status]"] };
  }
  if (command === "skills") {
    const subcommand = args[0] ?? "";
    if (!subcommand) {
      return { ok: true, lines: ["Usage: optid skills [search <query...>|install <owner/repo@skill>]"] };
    }
    if (subcommand === "search") {
      return nativeSkillsSearch(args.slice(1));
    }
    if (subcommand === "install") {
      return nativeSkillsInstall(args.slice(1), cwd);
    }
    return { ok: false, lines: ["Usage: optid skills [search <query...>|install <owner/repo@skill>]"] };
  }
  if (command === "agents") {
    const subcommand = args[0] ?? "";
    if (!subcommand) {
      return { ok: true, lines: ["Usage: optid agents [search <query...>|install <slug|url>]"] };
    }
    if (subcommand === "search") {
      return nativeAgentsSearch(args.slice(1));
    }
    if (subcommand === "install") {
      return nativeAgentsInstall(args.slice(1), cwd);
    }
    return { ok: false, lines: ["Usage: optid agents [search <query...>|install <slug|url>]"] };
  }
  return { ok: false, lines: [`Unsupported plugin command: ${command}`] };
}
