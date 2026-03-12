import { ThreadId, type OrchestrationReadModel, type ProviderSession } from "@t3tools/contracts";
import { Effect, Option } from "effect";

import { DEFAULT_PORT } from "./config";
import type {
  OptiDevActionResponse,
  OptiDevRouteContext,
  OptiDevRunnerInventoryEntry,
} from "./optidevContract";
import type { ProjectionSnapshotQueryShape } from "./orchestration/Services/ProjectionSnapshotQuery";
import type { ProviderSessionDirectoryShape } from "./provider/Services/ProviderSessionDirectory";
import type { ProviderServiceShape } from "./provider/Services/ProviderService";

const RUNNER_PREVIEW_LIMIT = 96;

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

function formatRunnerLine(entry: OptiDevRunnerInventoryEntry): string {
  const cwd = entry.cwd ?? "(cwd unavailable)";
  const phrase = entry.latestUserPhrase ?? "(no user phrase yet)";
  const sessionStatus = entry.sessionStatus ? ` | session=${entry.sessionStatus}` : "";
  return `${entry.alias}. runner=${entry.runner} | guid=${entry.guid} | cwd=${cwd} | user=${JSON.stringify(phrase)} | runtime=${entry.runtimeStatus}${sessionStatus}`;
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
    typeof candidate.lastSeenAt === "string"
  );
}

function parseRunnerInventoryData(data: unknown): OptiDevRunnerInventoryEntry[] {
  if (!Array.isArray(data)) {
    return [];
  }
  return data.filter(isRunnerInventoryEntry);
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

export async function runServerRunnerAction(input: {
  action: string;
  payload: { threadId?: string };
  providerService: ProviderServiceShape;
  providerSessionDirectory: ProviderSessionDirectoryShape;
  projectionSnapshotQuery: ProjectionSnapshotQueryShape;
}): Promise<OptiDevActionResponse | null> {
  if (input.action === "runner_list") {
    const [sessions, snapshot] = await Promise.all([
      Effect.runPromise(input.providerService.listSessions()),
      Effect.runPromise(input.projectionSnapshotQuery.getSnapshot()),
    ]);
    const entries = buildRunnerInventory({ snapshot, sessions });
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
