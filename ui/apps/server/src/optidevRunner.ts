import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";

import {
  CommandId,
  MessageId,
  ProjectId,
  ThreadId,
  type OrchestrationReadModel,
  type ProviderSession,
} from "@t3tools/contracts";
import { Effect, Option } from "effect";

import { DEFAULT_PORT } from "./config";
import type {
  OptiDevActionResponse,
  OptiDevRouteContext,
  OptiDevRunnerInventoryEntry,
} from "./optidevContract";
import { exists, loadManifest } from "./optidevPersistence";
import type { OrchestrationEngineShape } from "./orchestration/Services/OrchestrationEngine";
import type { ProjectionSnapshotQueryShape } from "./orchestration/Services/ProjectionSnapshotQuery";
import type { ProviderSessionDirectoryShape } from "./provider/Services/ProviderSessionDirectory";
import type { ProviderServiceShape } from "./provider/Services/ProviderService";

const RUNNER_PREVIEW_LIMIT = 96;
const DEFAULT_CODEX_MODEL = "gpt-5-codex";
const DEFAULT_RUNTIME_MODE = "full-access";

interface RunnerManifestState {
  manifestStatus: "present" | "missing";
  manifestNote: string | null;
}

interface CodexThreadRow {
  id: string;
  cwd: string;
  title: string;
  first_user_message: string;
  updated_at: number;
  source: string;
}

interface ReadOnlySqliteDatabase {
  all<T>(sql: string): T[];
  close(): void;
}

interface ImportedCodexMessage {
  readonly messageId: MessageId;
  readonly role: "user" | "assistant";
  readonly text: string;
  readonly turnId: string | null;
}

interface SyncCodexTranscriptInput {
  readonly threadId: ThreadId;
  readonly providerService: ProviderServiceShape;
  readonly projectionSnapshotQuery: ProjectionSnapshotQueryShape;
  readonly orchestrationEngine: OrchestrationEngineShape;
}

interface SyncCodexTranscriptResult {
  readonly importedMessageCount: number;
  readonly warning: string | null;
}

function normalizeServerHost(rawHost: string | undefined): string {
  const trimmed = rawHost?.trim();
  if (!trimmed || trimmed === "0.0.0.0" || trimmed === "::" || trimmed === "[::]") {
    return "127.0.0.1";
  }
  return trimmed;
}

function formatHostForUrl(host: string): string {
  return host.includes(":") && !host.startsWith("[") ? `[${host}]` : host;
}

function resolveRunnerServerBaseUrl(env: NodeJS.ProcessEnv): string {
  const explicit = env.OPTID_SERVER_URL?.trim();
  if (explicit) {
    return explicit.replace(/\/+$/, "");
  }
  const host = normalizeServerHost(env.T3CODE_HOST);
  const parsedPort = Number.parseInt(env.T3CODE_PORT ?? "", 10);
  const port = Number.isFinite(parsedPort) && parsedPort > 0 ? parsedPort : DEFAULT_PORT;
  return `http://${formatHostForUrl(host)}:${port}`;
}

function readRuntimePayloadCwd(runtimePayload: unknown): string | null {
  if (!runtimePayload || typeof runtimePayload !== "object" || Array.isArray(runtimePayload)) {
    return null;
  }
  const rawCwd = "cwd" in runtimePayload ? runtimePayload.cwd : undefined;
  if (typeof rawCwd !== "string") {
    return null;
  }
  const trimmed = rawCwd.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function truncateUserPreview(text: string): string {
  const compact = text.replace(/\s+/g, " ").trim();
  if (compact.length <= RUNNER_PREVIEW_LIMIT) {
    return compact;
  }
  return `${compact.slice(0, RUNNER_PREVIEW_LIMIT - 1).trimEnd()}…`;
}

function trimToNull(value: string | null | undefined): string | null {
  if (typeof value !== "string") {
    return null;
  }
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function extractCodexItemText(item: unknown): string | null {
  const record = asRecord(item);
  if (!record) {
    return null;
  }

  if (typeof record.text === "string") {
    const trimmed = record.text.trim();
    if (trimmed.length > 0) {
      return trimmed;
    }
  }

  if (!Array.isArray(record.content)) {
    return null;
  }

  const parts = record.content
    .map((entry) => {
      const contentRecord = asRecord(entry);
      return typeof contentRecord?.text === "string" ? contentRecord.text.trim() : "";
    })
    .filter((entry) => entry.length > 0);

  if (parts.length === 0) {
    return null;
  }

  return parts.join("\n\n");
}

function collectImportedCodexMessages(input: {
  readonly turns: ReadonlyArray<{
    readonly id: string;
    readonly items: ReadonlyArray<unknown>;
  }>;
}): ImportedCodexMessage[] {
  const messages: ImportedCodexMessage[] = [];

  for (const turn of input.turns) {
    for (const [itemIndex, item] of turn.items.entries()) {
      const itemRecord = asRecord(item);
      if (!itemRecord || typeof itemRecord.type !== "string") {
        continue;
      }

      const role =
        itemRecord.type === "userMessage"
          ? "user"
          : itemRecord.type === "agentMessage" || itemRecord.type === "assistantMessage"
            ? "assistant"
            : null;
      if (!role) {
        continue;
      }

      const text = extractCodexItemText(itemRecord);
      if (!text) {
        continue;
      }

      const rawItemId =
        typeof itemRecord.id === "string" && itemRecord.id.trim().length > 0
          ? itemRecord.id.trim()
          : `${turn.id}:${itemIndex + 1}`;
      messages.push({
        messageId: MessageId.makeUnsafe(`${role}:${rawItemId}`),
        role,
        text,
        turnId: role === "assistant" ? turn.id : null,
      });
    }
  }

  return messages;
}

function formatCodexTimestamp(seconds: number): string {
  const millis = Number.isFinite(seconds) ? seconds * 1000 : 0;
  return new Date(millis).toISOString();
}

function mapProviderSessionStatusToOrchestrationStatus(
  status: "connecting" | "ready" | "running" | "error" | "closed",
): "starting" | "ready" | "running" | "error" | "stopped" {
  switch (status) {
    case "connecting":
      return "starting";
    case "running":
      return "running";
    case "error":
      return "error";
    case "closed":
      return "stopped";
    case "ready":
    default:
      return "ready";
  }
}

function defaultProjectTitle(cwd: string): string {
  const name = path.basename(cwd.trim());
  return name.length > 0 ? name : "project";
}

function defaultThreadTitle(entry: OptiDevRunnerInventoryEntry): string {
  return entry.latestUserPhrase ?? defaultProjectTitle(entry.cwd ?? "");
}

async function syncCodexTranscript(
  input: SyncCodexTranscriptInput,
): Promise<SyncCodexTranscriptResult> {
  const snapshot = await Effect.runPromise(input.projectionSnapshotQuery.getSnapshot());
  const existingThread = snapshot.threads.find(
    (thread) => thread.id === input.threadId && thread.deletedAt === null,
  );

  try {
    const providerThread = await Effect.runPromise(input.providerService.readThread(input.threadId));
    const importedMessages = collectImportedCodexMessages({
      turns: providerThread.turns.map((turn) => ({
        id: turn.id,
        items: turn.items,
      })),
    });
    if (importedMessages.length === 0) {
      return {
        importedMessageCount: 0,
        warning: "Provider thread read succeeded, but it returned no importable chat messages.",
      };
    }

    const existingMessageIds = new Set((existingThread?.messages ?? []).map((message) => message.id));
    const missingMessages = importedMessages.filter((message) => !existingMessageIds.has(message.messageId));

    for (const message of missingMessages) {
      await Effect.runPromise(
        input.orchestrationEngine.dispatch({
          type: "thread.message.import",
          commandId: CommandId.makeUnsafe(crypto.randomUUID()),
          threadId: input.threadId,
          message: {
            messageId: message.messageId,
            role: message.role,
            text: message.text,
            turnId: message.turnId,
          },
          createdAt: new Date().toISOString(),
        }),
      );
    }

    return {
      importedMessageCount: missingMessages.length,
      warning: null,
    };
  } catch (error) {
    return {
      importedMessageCount: 0,
      warning:
        error instanceof Error
          ? `Transcript import failed: ${error.message}`
          : `Transcript import failed: ${String(error)}`,
    };
  }
}

function parseCodexRootGuid(row: CodexThreadRow): string {
  const trimmedSource = row.source.trim();
  if (trimmedSource.length === 0 || !trimmedSource.startsWith("{")) {
    return row.id;
  }

  try {
    const parsed = JSON.parse(trimmedSource) as {
      subagent?: { thread_spawn?: { parent_thread_id?: unknown } };
    };
    const parentThreadId = parsed.subagent?.thread_spawn?.parent_thread_id;
    return typeof parentThreadId === "string" && parentThreadId.trim().length > 0
      ? parentThreadId.trim()
      : row.id;
  } catch {
    return row.id;
  }
}

function collapseCodexThreads(rows: ReadonlyArray<CodexThreadRow>): OptiDevRunnerInventoryEntry[] {
  const grouped = new Map<string, {
    guid: string;
    cwd: string | null;
    latestUserPhrase: string | null;
    updatedAt: number;
    hasRootThread: boolean;
  }>();

  for (const row of rows) {
    const rootGuid = parseCodexRootGuid(row);
    const latestPhrase = trimToNull(row.first_user_message) ?? trimToNull(row.title);
    const existing = grouped.get(rootGuid);
    const isRootThread = row.id === rootGuid;

    if (!existing) {
      grouped.set(rootGuid, {
        guid: rootGuid,
        cwd: trimToNull(row.cwd),
        latestUserPhrase: latestPhrase,
        updatedAt: row.updated_at,
        hasRootThread: isRootThread,
      });
      continue;
    }

    const nextUpdatedAt = Math.max(existing.updatedAt, row.updated_at);
    const shouldReplaceIdentity =
      isRootThread && !existing.hasRootThread;

    grouped.set(rootGuid, {
      guid: rootGuid,
      cwd:
        shouldReplaceIdentity
          ? trimToNull(row.cwd) ?? existing.cwd
          : row.updated_at >= existing.updatedAt
            ? trimToNull(row.cwd) ?? existing.cwd
            : existing.cwd,
      latestUserPhrase:
        row.updated_at >= existing.updatedAt
          ? latestPhrase ?? existing.latestUserPhrase
          : existing.latestUserPhrase,
      updatedAt: nextUpdatedAt,
      hasRootThread: existing.hasRootThread || isRootThread,
    });
  }

  return [...grouped.values()]
    .sort((left, right) => {
      if (left.updatedAt !== right.updatedAt) {
        return right.updatedAt - left.updatedAt;
      }
      return left.guid.localeCompare(right.guid);
    })
    .map((entry, index) => ({
      alias: index + 1,
      runner: "codex",
      guid: entry.guid,
      cwd: entry.cwd,
      latestUserPhrase: entry.latestUserPhrase ? truncateUserPreview(entry.latestUserPhrase) : null,
      runtimeStatus: "available",
      sessionStatus: null,
      lastSeenAt: formatCodexTimestamp(entry.updatedAt),
      manifestStatus: "present",
      manifestNote: null,
    }) satisfies OptiDevRunnerInventoryEntry);
}

function latestUserPhrase(snapshot: OrchestrationReadModel, threadId: string): string | null {
  const thread = snapshot.threads.find((item) => item.id === threadId && item.deletedAt === null);
  if (!thread) {
    return null;
  }
  for (let index = thread.messages.length - 1; index >= 0; index -= 1) {
    const message = thread.messages[index];
    if (message?.role !== "user") {
      continue;
    }
    const text = truncateUserPreview(message.text ?? "");
    if (text.length > 0) {
      return text;
    }
  }
  return null;
}

function resolveThreadCwd(snapshot: OrchestrationReadModel, threadId: string): string | null {
  const thread = snapshot.threads.find((item) => item.id === threadId && item.deletedAt === null);
  if (!thread?.worktreePath) {
    return null;
  }
  const trimmed = thread.worktreePath.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export function buildRunnerInventory(input: {
  snapshot: OrchestrationReadModel;
  sessions: ReadonlyArray<ProviderSession>;
}): OptiDevRunnerInventoryEntry[] {
  const entries = input.sessions
    .filter((session) => session.provider.trim().length > 0 && session.status !== "closed")
    .map((session) => {
      const snapshotThread = input.snapshot.threads.find(
        (thread) => thread.id === session.threadId && thread.deletedAt === null,
      );
      const runner = session.provider.trim();
      const cwd = session.cwd ?? resolveThreadCwd(input.snapshot, session.threadId);
      const phrase = latestUserPhrase(input.snapshot, session.threadId);
      return {
        alias: 0,
        runner,
        guid: session.threadId,
        cwd,
        latestUserPhrase: phrase,
        runtimeStatus: session.status,
        sessionStatus: snapshotThread?.session?.status ?? null,
        lastSeenAt: session.updatedAt,
        manifestStatus: "present",
        manifestNote: null,
      } satisfies OptiDevRunnerInventoryEntry;
    })
    .sort((left, right) => {
      if (left.lastSeenAt !== right.lastSeenAt) {
        return right.lastSeenAt.localeCompare(left.lastSeenAt);
      }
      if (left.guid !== right.guid) {
        return left.guid.localeCompare(right.guid);
      }
      return left.runner.localeCompare(right.runner);
    });

  return entries.map((entry, index) => ({
    ...entry,
    alias: index + 1,
  }));
}

async function resolveCodexStateDbPath(env: NodeJS.ProcessEnv): Promise<string | null> {
  const codexHome = trimToNull(env.CODEX_HOME) ?? path.join(os.homedir(), ".codex");
  let entries: string[];
  try {
    entries = await fs.readdir(codexHome);
  } catch {
    return null;
  }

  const candidates = entries
    .map((name) => {
      const match = /^state_(\d+)\.sqlite$/u.exec(name);
      if (!match) {
        return null;
      }
      return {
        name,
        version: Number.parseInt(match[1] ?? "", 10),
      };
    })
    .filter((entry): entry is { name: string; version: number } => entry !== null)
    .sort((left, right) => right.version - left.version);

  if (candidates.length === 0) {
    return null;
  }

  return path.join(codexHome, candidates[0].name);
}

export async function readCodexSessionInventory(
  env: NodeJS.ProcessEnv = process.env,
): Promise<OptiDevRunnerInventoryEntry[]> {
  const stateDbPath = await resolveCodexStateDbPath(env);
  if (!stateDbPath) {
    return [];
  }

  const db = await openReadOnlySqliteDatabase(stateDbPath);
  try {
    const rows = db.all<CodexThreadRow>(`
      SELECT id, cwd, title, first_user_message, updated_at, source
      FROM threads
      WHERE archived = 0
      ORDER BY updated_at DESC, id ASC
    `);

    return collapseCodexThreads(rows);
  } finally {
    db.close();
  }
}

async function openReadOnlySqliteDatabase(filename: string): Promise<ReadOnlySqliteDatabase> {
  if (typeof process.versions.bun === "string") {
    const sqlite = await import("bun:sqlite");
    const db = new sqlite.Database(filename, { readonly: true });
    return {
      all<T>(sql: string) {
        return db.query(sql).all() as T[];
      },
      close() {
        db.close();
      },
    };
  }

  const sqlite = await import("node:sqlite");
  const db = new sqlite.DatabaseSync(filename, { readOnly: true });
  return {
    all<T>(sql: string) {
      return db.prepare(sql).all() as T[];
    },
    close() {
      db.close();
    },
  };
}

async function findOptiDevWorkspaceRoot(startPath: string): Promise<string | null> {
  let current = path.resolve(startPath);
  for (;;) {
    const manifestPath = path.join(current, ".optidev", "workspace.yaml");
    if (await exists(manifestPath)) {
      return current;
    }
    const parent = path.dirname(current);
    if (parent === current) {
      return null;
    }
    current = parent;
  }
}

async function resolveRunnerManifestState(cwd: string | null): Promise<RunnerManifestState> {
  if (!cwd) {
    return {
      manifestStatus: "missing",
      manifestNote: "Session cwd is unavailable.",
    };
  }

  const workspaceRoot = await findOptiDevWorkspaceRoot(cwd);
  if (!workspaceRoot) {
    return {
      manifestStatus: "missing",
      manifestNote: "No OptiDev workspace manifest found for this session.",
    };
  }

  const manifestPath = path.join(workspaceRoot, ".optidev", "workspace.yaml");
  try {
    await loadManifest(manifestPath);
  } catch {
    return {
      manifestStatus: "missing",
      manifestNote: "OptiDev workspace manifest is missing or invalid.",
    };
  }

  return {
    manifestStatus: "present",
    manifestNote: null,
  };
}

export async function enrichRunnerInventoryManifestStatus(
  entries: ReadonlyArray<OptiDevRunnerInventoryEntry>,
): Promise<OptiDevRunnerInventoryEntry[]> {
  return Promise.all(
    entries.map(async (entry) => {
      const manifestState = await resolveRunnerManifestState(entry.cwd);
      return {
        ...entry,
        ...manifestState,
      };
    }),
  );
}

function formatRunnerLine(entry: OptiDevRunnerInventoryEntry): string {
  const cwd = entry.cwd ?? "(cwd unavailable)";
  const phrase = entry.latestUserPhrase ?? "(no user phrase yet)";
  const sessionStatus = entry.sessionStatus ? ` | session=${entry.sessionStatus}` : "";
  return `${entry.alias}. runner=${entry.runner} | guid=${entry.guid} | cwd=${cwd} | user=${JSON.stringify(phrase)} | runtime=${entry.runtimeStatus}${sessionStatus}`;
}

function formatCodexSessionLine(entry: OptiDevRunnerInventoryEntry): string {
  const cwd = entry.cwd ?? "(cwd unavailable)";
  const phrase = entry.latestUserPhrase ?? "(no user phrase yet)";
  const manifestSuffix =
    entry.manifestStatus === "missing" ? " | manifest=missing" : " | manifest=present";
  return `${entry.alias}. guid=${entry.guid} | cwd=${cwd} | user=${JSON.stringify(phrase)}${manifestSuffix}`;
}

function isRunnerInventoryEntry(value: unknown): value is OptiDevRunnerInventoryEntry {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.alias === "number" &&
    typeof candidate.runner === "string" &&
    typeof candidate.guid === "string" &&
    (typeof candidate.cwd === "string" || candidate.cwd === null) &&
    (typeof candidate.latestUserPhrase === "string" || candidate.latestUserPhrase === null) &&
    typeof candidate.runtimeStatus === "string" &&
    (typeof candidate.sessionStatus === "string" || candidate.sessionStatus === null) &&
    typeof candidate.lastSeenAt === "string" &&
    (candidate.manifestStatus === undefined ||
      candidate.manifestStatus === "present" ||
      candidate.manifestStatus === "missing") &&
    (candidate.manifestNote === undefined ||
      typeof candidate.manifestNote === "string" ||
      candidate.manifestNote === null)
  );
}

function parseRunnerInventoryData(data: unknown): OptiDevRunnerInventoryEntry[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isRunnerInventoryEntry).map((entry) => ({
    ...entry,
    manifestStatus: entry.manifestStatus ?? "present",
    manifestNote: entry.manifestNote ?? null,
  }));
}

async function postRunnerListRequest(env: NodeJS.ProcessEnv): Promise<OptiDevActionResponse> {
  const baseUrl = resolveRunnerServerBaseUrl(env);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/optidev/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "runner_list",
      }),
    });
  } catch {
    return {
      ok: false,
      lines: [
        `OptiDev server is not reachable at ${baseUrl}.`,
        "Start it with `optid` or `optid ui`, then rerun `optid runner ls`.",
      ],
    };
  }

  const payload = (await response.json()) as OptiDevActionResponse;
  if (!response.ok) {
    return {
      ok: false,
      lines: payload.lines.length > 0 ? payload.lines : [`Runner inventory failed at ${baseUrl}.`],
      data: payload.data,
    };
  }

  return payload;
}

function resolveInventoryEntry(
  entries: ReadonlyArray<OptiDevRunnerInventoryEntry>,
  rawIdentifier: string,
): OptiDevRunnerInventoryEntry | null {
  const trimmed = rawIdentifier.trim();
  if (trimmed.length === 0) {
    return null;
  }

  const alias = Number.parseInt(trimmed, 10);
  if (Number.isInteger(alias) && alias > 0) {
    return entries.find((entry) => entry.alias === alias) ?? null;
  }

  return entries.find((entry) => entry.guid === trimmed) ?? null;
}

async function postRunnerResumeRequest(env: NodeJS.ProcessEnv, threadId: string): Promise<OptiDevActionResponse> {
  const baseUrl = resolveRunnerServerBaseUrl(env);
  let response: Response;
  try {
    response = await fetch(`${baseUrl}/api/optidev/action`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        action: "runner_resume",
        threadId,
      }),
    });
  } catch {
    return {
      ok: false,
      lines: [
        `OptiDev server is not reachable at ${baseUrl}.`,
        "Start it with `optid` or `optid ui`, then rerun `optid runner resume <id>`.",
      ],
    };
  }

  const payload = (await response.json()) as OptiDevActionResponse;
  if (!response.ok) {
    return {
      ok: false,
      lines: payload.lines.length > 0 ? payload.lines : [`Runner resume failed at ${baseUrl}.`],
      data: payload.data,
    };
  }

  return payload;
}

export async function nativeRunnerListAction(
  _context: OptiDevRouteContext,
  env: NodeJS.ProcessEnv = process.env,
): Promise<OptiDevActionResponse> {
  return postRunnerListRequest(env);
}

export async function nativeRunnerResumeAction(
  _context: OptiDevRouteContext,
  rawIdentifier: string,
  env: NodeJS.ProcessEnv = process.env,
): Promise<OptiDevActionResponse> {
  const trimmed = rawIdentifier.trim();
  if (trimmed.length === 0) {
    return {
      ok: false,
      lines: ["Runner id is required."],
    };
  }

  const listed = await postRunnerListRequest(env);
  if (!listed.ok) {
    return listed;
  }

  const entries = parseRunnerInventoryData(listed.data);
  const entry = resolveInventoryEntry(entries, trimmed);
  if (entry) {
    const resumed = await postRunnerResumeRequest(env, entry.guid);
    return {
      ok: resumed.ok,
      lines: [
        `Resolved runner ${entry.alias} -> ${entry.guid}.`,
        ...resumed.lines,
      ],
      data: resumed.data,
    };
  }

  const alias = Number.parseInt(trimmed, 10);
  if (Number.isInteger(alias) && alias > 0) {
    return {
      ok: false,
      lines: [`Unknown runner id: ${rawIdentifier}. Run \`optid runner ls\` first.`],
    };
  }

  return postRunnerResumeRequest(env, trimmed);
}

function readBindingCwd(runtimePayload: unknown): string | undefined {
  const cwd = readRuntimePayloadCwd(runtimePayload);
  return cwd ?? undefined;
}

async function connectCodexSession(input: {
  guid: string;
  providerService: ProviderServiceShape;
  projectionSnapshotQuery: ProjectionSnapshotQueryShape;
  orchestrationEngine: OrchestrationEngineShape;
  env?: NodeJS.ProcessEnv;
}): Promise<OptiDevActionResponse> {
  const entries = await readCodexSessionInventory(input.env);
  const entry = entries.find((candidate) => candidate.guid === input.guid);
  if (!entry) {
    return {
      ok: false,
      lines: [`Unknown Codex session: ${input.guid}.`],
    };
  }
  if (!entry.cwd) {
    return {
      ok: false,
      lines: [`Codex session '${input.guid}' has no cwd, so it cannot be attached to t3code.`],
    };
  }

  const createdAt = new Date().toISOString();
  const snapshot = await Effect.runPromise(input.projectionSnapshotQuery.getSnapshot());
  const existingProject = snapshot.projects.find(
    (project) => project.workspaceRoot === entry.cwd && project.deletedAt === null,
  );
  const projectId = existingProject
    ? existingProject.id
    : ProjectId.makeUnsafe(crypto.randomUUID());

  if (!existingProject) {
    await Effect.runPromise(
      input.orchestrationEngine.dispatch({
        type: "project.create",
        commandId: CommandId.makeUnsafe(crypto.randomUUID()),
        projectId,
        title: defaultProjectTitle(entry.cwd),
        workspaceRoot: entry.cwd,
        defaultModel: DEFAULT_CODEX_MODEL,
        createdAt,
      }),
    );
  }

  const existingThread = snapshot.threads.find(
    (thread) => thread.id === entry.guid && thread.deletedAt === null,
  );
  const threadId = ThreadId.makeUnsafe(entry.guid);

  if (!existingThread) {
    await Effect.runPromise(
      input.orchestrationEngine.dispatch({
        type: "thread.create",
        commandId: CommandId.makeUnsafe(crypto.randomUUID()),
        threadId,
        projectId,
        title: defaultThreadTitle(entry),
        model: existingProject?.defaultModel ?? DEFAULT_CODEX_MODEL,
        runtimeMode: DEFAULT_RUNTIME_MODE,
        interactionMode: "default",
        branch: null,
        worktreePath: entry.cwd,
        createdAt,
      }),
    );
  } else if (
    existingThread.worktreePath !== entry.cwd ||
    existingThread.title !== defaultThreadTitle(entry)
  ) {
    await Effect.runPromise(
      input.orchestrationEngine.dispatch({
        type: "thread.meta.update",
        commandId: CommandId.makeUnsafe(crypto.randomUUID()),
        threadId,
        ...(existingThread.title !== defaultThreadTitle(entry)
          ? { title: defaultThreadTitle(entry) }
          : {}),
        ...(existingThread.worktreePath !== entry.cwd ? { worktreePath: entry.cwd } : {}),
      }),
    );
  }

  const activeSession = (await Effect.runPromise(input.providerService.listSessions())).find(
    (session) => session.threadId === threadId,
  );
  const session =
    activeSession ??
    (await Effect.runPromise(
      input.providerService.startSession(threadId, {
        threadId,
        provider: "codex",
        cwd: entry.cwd,
        model: existingThread?.model ?? existingProject?.defaultModel ?? DEFAULT_CODEX_MODEL,
        runtimeMode: existingThread?.runtimeMode ?? DEFAULT_RUNTIME_MODE,
        resumeCursor: { threadId: entry.guid },
      }),
    ));

  await Effect.runPromise(
    input.orchestrationEngine.dispatch({
      type: "thread.session.set",
      commandId: CommandId.makeUnsafe(crypto.randomUUID()),
      threadId,
      session: {
        threadId,
        status: mapProviderSessionStatusToOrchestrationStatus(session.status),
        providerName: session.provider,
        runtimeMode: session.runtimeMode,
        activeTurnId: null,
        lastError: session.lastError ?? null,
        updatedAt: session.updatedAt,
      },
      createdAt: new Date().toISOString(),
    }),
  );

  const transcriptSync = await syncCodexTranscript({
    threadId,
    providerService: input.providerService,
    projectionSnapshotQuery: input.projectionSnapshotQuery,
    orchestrationEngine: input.orchestrationEngine,
  });

  return {
    ok: true,
    lines: [
      `Connected Codex session ${entry.guid}.`,
      `Thread: ${threadId}.`,
      `Cwd: ${entry.cwd}.`,
      `Imported transcript messages: ${transcriptSync.importedMessageCount}.`,
      ...(transcriptSync.warning ? [transcriptSync.warning] : []),
    ],
    data: {
      threadId,
      projectId,
      guid: entry.guid,
      cwd: entry.cwd,
    },
  };
}

export async function runServerRunnerAction(input: {
  action: string;
  payload: { threadId?: string };
  providerService: ProviderServiceShape;
  providerSessionDirectory: ProviderSessionDirectoryShape;
  projectionSnapshotQuery: ProjectionSnapshotQueryShape;
  orchestrationEngine?: OrchestrationEngineShape;
  env?: NodeJS.ProcessEnv;
}): Promise<OptiDevActionResponse | null> {
  if (input.action === "codex_sessions") {
    const entries = await enrichRunnerInventoryManifestStatus(await readCodexSessionInventory(input.env));
    if (entries.length === 0) {
      return {
        ok: true,
        lines: ["No Codex sessions found on this machine."],
        data: [],
      };
    }
    return {
      ok: true,
      lines: entries.map(formatCodexSessionLine),
      data: entries,
    };
  }

  if (input.action === "codex_connect") {
    const guid = input.payload.threadId?.trim();
    if (!guid) {
      return {
        ok: false,
        lines: ["Codex session guid is required."],
      };
    }
    if (!input.orchestrationEngine) {
      return {
        ok: false,
        lines: ["Codex session attach is unavailable because orchestration is not mounted."],
      };
    }
    return connectCodexSession({
      guid,
      providerService: input.providerService,
      projectionSnapshotQuery: input.projectionSnapshotQuery,
      orchestrationEngine: input.orchestrationEngine,
      env: input.env,
    });
  }

  if (input.action === "runner_list") {
    const [sessions, snapshot] = await Promise.all([
      Effect.runPromise(input.providerService.listSessions()),
      Effect.runPromise(input.projectionSnapshotQuery.getSnapshot()),
    ]);
    const entries = await enrichRunnerInventoryManifestStatus(buildRunnerInventory({ snapshot, sessions }));
    if (entries.length === 0) {
      return {
        ok: true,
        lines: ["No open runner sessions found."],
        data: [],
      };
    }
    return {
      ok: true,
      lines: entries.map(formatRunnerLine),
      data: entries,
    };
  }

  if (input.action !== "runner_resume") {
    return null;
  }

  const rawThreadId = input.payload.threadId?.trim();
  if (!rawThreadId) {
    return {
      ok: false,
      lines: ["Runner threadId is required."],
    };
  }

  const activeSessions = await Effect.runPromise(input.providerService.listSessions());
  const activeSession = activeSessions.find((session) => session.threadId === rawThreadId);
  if (activeSession) {
    return {
      ok: true,
      lines: [
        `Runner session already active: ${activeSession.provider} ${rawThreadId}.`,
        `Cwd: ${activeSession.cwd ?? "(cwd unavailable)"}.`,
      ],
      data: {
        threadId: rawThreadId,
        provider: activeSession.provider,
        cwd: activeSession.cwd ?? null,
      },
    };
  }

  const threadId = ThreadId.makeUnsafe(rawThreadId);
  const bindingOption = await Effect.runPromise(
    input.providerSessionDirectory.getBinding(threadId),
  );
  const binding = Option.getOrUndefined(bindingOption);
  if (!binding) {
    return {
      ok: false,
      lines: [`No persisted runner binding found for thread '${rawThreadId}'.`],
    };
  }
  if (binding.resumeCursor === null || binding.resumeCursor === undefined) {
    return {
      ok: false,
      lines: [`Thread '${rawThreadId}' has no persisted resume cursor.`],
    };
  }

  const resumed = await Effect.runPromise(
    input.providerService.startSession(threadId, {
      threadId,
      provider: binding.provider,
      ...(readBindingCwd(binding.runtimePayload) ? { cwd: readBindingCwd(binding.runtimePayload) } : {}),
      resumeCursor: binding.resumeCursor,
      runtimeMode: binding.runtimeMode ?? "full-access",
    }),
  );

  return {
    ok: true,
    lines: [
      `Runner session resumed: ${resumed.provider} ${rawThreadId}.`,
      `Cwd: ${resumed.cwd ?? readBindingCwd(binding.runtimePayload) ?? "(cwd unavailable)"}.`,
    ],
    data: {
      threadId: rawThreadId,
      provider: resumed.provider,
      cwd: resumed.cwd ?? readBindingCwd(binding.runtimePayload) ?? null,
    },
  };
}
