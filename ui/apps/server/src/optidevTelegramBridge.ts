import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { randomUUID } from "node:crypto";

import {
  CommandId,
  MessageId,
  type OrchestrationCommand,
  type OrchestrationEvent,
  type OrchestrationReadModel,
  type OrchestrationThread,
} from "@t3tools/contracts";

import type { OptiDevRouteContext } from "./optidevContract";
import { readOptiDevActiveSession } from "./optidevActiveSession";

interface TelegramConfig {
  enabled: boolean;
  token: string;
  chat_id: number | null;
  updated_at: string;
  target_thread_id: string | null;
  target_updated_at: string | null;
}

interface TelegramBridgePersistedState {
  lastUpdateId: number;
  updatedAt: string;
  availability: "unknown" | "available" | "unavailable";
  resolvedThreadId: string | null;
  resolvedThreadTitle: string | null;
  unavailableReplySent: boolean;
}

interface TelegramBridgeLockState {
  pid: number;
  ownerId: string;
  updatedAt: string;
  hostname: string;
}

interface TelegramUpdateMessage {
  message_id?: number;
  date?: number;
  text?: string;
  chat?: {
    id?: number;
  };
}

interface TelegramUpdate {
  update_id?: number;
  message?: TelegramUpdateMessage;
}

export interface OptiDevTelegramBridgeRuntimeDeps {
  readonly context: OptiDevRouteContext;
  readonly getSnapshot: () => Promise<OrchestrationReadModel>;
  readonly dispatchCommand: (command: OrchestrationCommand) => Promise<unknown>;
  readonly fetchImpl?: typeof fetch;
  readonly telegramBaseUrl?: string;
  readonly now?: () => string;
  readonly pollIntervalMs?: number;
  readonly requestTimeoutMs?: number;
  readonly logger?: (message: string, details?: Record<string, unknown>) => void;
  readonly currentPid?: number;
  readonly lockOwnerId?: string;
  readonly lockStaleMs?: number;
  readonly isProcessAlive?: (pid: number) => boolean;
}

export interface OptiDevTelegramBridgeRuntimeHandle {
  readonly requestReload: () => void;
  readonly handleDomainEvent: (event: OrchestrationEvent) => void;
  readonly stop: () => void;
}

const DEFAULT_POLL_INTERVAL_MS = 2_000;
const DEFAULT_REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_TELEGRAM_BASE_URL = "https://api.telegram.org";
const DEFAULT_LOCK_STALE_MS = 15_000;

let activeRuntime: OptiDevTelegramBridgeRuntimeHandle | null = null;

function resolveHomeDir(context: OptiDevRouteContext): string {
  return context.homeDir ?? path.join(os.homedir(), ".optidev");
}

function pluginsDir(context: OptiDevRouteContext): string {
  return path.join(resolveHomeDir(context), "plugins");
}

function telegramConfigPath(context: OptiDevRouteContext): string {
  return path.join(pluginsDir(context), "telegram-config.json");
}

function telegramBridgeStatePath(context: OptiDevRouteContext): string {
  return path.join(pluginsDir(context), "telegram-bridge-state.json");
}

function telegramBridgeLockPath(context: OptiDevRouteContext): string {
  return path.join(pluginsDir(context), "telegram-bridge-lock.json");
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.stat(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readJson<T>(filePath: string): Promise<T> {
  return JSON.parse(await fs.readFile(filePath, "utf8")) as T;
}

async function writeJson(filePath: string, payload: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(payload, null, 2), "utf8");
}

function defaultIsProcessAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return (error as NodeJS.ErrnoException).code !== "ESRCH";
  }
}

async function readBridgeLock(
  context: OptiDevRouteContext,
): Promise<TelegramBridgeLockState | null> {
  const filePath = telegramBridgeLockPath(context);
  if (!(await fileExists(filePath))) {
    return null;
  }
  try {
    const data = await readJson<Record<string, unknown>>(filePath);
    return typeof data.pid === "number" &&
      Number.isFinite(data.pid) &&
      typeof data.ownerId === "string" &&
      typeof data.updatedAt === "string" &&
      typeof data.hostname === "string"
      ? {
          pid: data.pid,
          ownerId: data.ownerId,
          updatedAt: data.updatedAt,
          hostname: data.hostname,
        }
      : null;
  } catch {
    return null;
  }
}

async function writeBridgeLock(
  context: OptiDevRouteContext,
  state: TelegramBridgeLockState,
): Promise<void> {
  await writeJson(telegramBridgeLockPath(context), state);
}

export async function tryAcquireOptiDevTelegramBridgeLock(input: {
  readonly context: OptiDevRouteContext;
  readonly pid: number;
  readonly ownerId: string;
  readonly now: string;
  readonly staleAfterMs?: number;
  readonly isProcessAlive?: (pid: number) => boolean;
}): Promise<{
  acquired: boolean;
  ownerPid: number | null;
  ownerId: string | null;
  stale: boolean;
}> {
  const current = await readBridgeLock(input.context);
  const staleAfterMs = input.staleAfterMs ?? DEFAULT_LOCK_STALE_MS;
  const isProcessAlive = input.isProcessAlive ?? defaultIsProcessAlive;
  if (
    current &&
    current.pid === input.pid &&
    current.ownerId === input.ownerId
  ) {
    await writeBridgeLock(input.context, {
      pid: input.pid,
      ownerId: input.ownerId,
      updatedAt: input.now,
      hostname: os.hostname(),
    });
    return {
      acquired: true,
      ownerPid: input.pid,
      ownerId: input.ownerId,
      stale: false,
    };
  }

  const currentUpdatedAt = current ? Date.parse(current.updatedAt) : Number.NaN;
  const nextUpdatedAt = Date.parse(input.now);
  const staleByTime =
    current &&
    Number.isFinite(currentUpdatedAt) &&
    Number.isFinite(nextUpdatedAt) &&
    nextUpdatedAt - currentUpdatedAt > staleAfterMs;
  const staleByProcess = current ? !isProcessAlive(current.pid) : false;
  const stale = Boolean(staleByTime || staleByProcess);

  if (!current || stale) {
    await writeBridgeLock(input.context, {
      pid: input.pid,
      ownerId: input.ownerId,
      updatedAt: input.now,
      hostname: os.hostname(),
    });
    return {
      acquired: true,
      ownerPid: input.pid,
      ownerId: input.ownerId,
      stale,
    };
  }

  return {
    acquired: false,
    ownerPid: current.pid,
    ownerId: current.ownerId,
    stale: false,
  };
}

export async function releaseOptiDevTelegramBridgeLock(input: {
  readonly context: OptiDevRouteContext;
  readonly pid: number;
  readonly ownerId: string;
}): Promise<void> {
  const current = await readBridgeLock(input.context);
  if (!current) {
    return;
  }
  if (current.pid !== input.pid || current.ownerId !== input.ownerId) {
    return;
  }
  await fs.rm(telegramBridgeLockPath(input.context), { force: true });
}

async function readTelegramConfig(context: OptiDevRouteContext): Promise<TelegramConfig> {
  const filePath = telegramConfigPath(context);
  if (!(await fileExists(filePath))) {
    return {
      enabled: false,
      token: "",
      chat_id: null,
      updated_at: "",
      target_thread_id: null,
      target_updated_at: null,
    };
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
    return {
      enabled: false,
      token: "",
      chat_id: null,
      updated_at: "",
      target_thread_id: null,
      target_updated_at: null,
    };
  }
}

async function readPersistedState(
  context: OptiDevRouteContext,
): Promise<TelegramBridgePersistedState> {
  const filePath = telegramBridgeStatePath(context);
  if (!(await fileExists(filePath))) {
    return {
      lastUpdateId: 0,
      updatedAt: "",
      availability: "unknown",
      resolvedThreadId: null,
      resolvedThreadTitle: null,
      unavailableReplySent: false,
    };
  }
  try {
    const data = await readJson<Record<string, unknown>>(filePath);
    return {
      lastUpdateId:
        typeof data.lastUpdateId === "number" && Number.isFinite(data.lastUpdateId)
          ? data.lastUpdateId
          : 0,
      updatedAt: typeof data.updatedAt === "string" ? data.updatedAt : "",
      availability:
        data.availability === "available" || data.availability === "unavailable"
          ? data.availability
          : "unknown",
      resolvedThreadId:
        typeof data.resolvedThreadId === "string" ? data.resolvedThreadId : null,
      resolvedThreadTitle:
        typeof data.resolvedThreadTitle === "string" ? data.resolvedThreadTitle : null,
      unavailableReplySent: Boolean(data.unavailableReplySent),
    };
  } catch {
    return {
      lastUpdateId: 0,
      updatedAt: "",
      availability: "unknown",
      resolvedThreadId: null,
      resolvedThreadTitle: null,
      unavailableReplySent: false,
    };
  }
}

async function writePersistedState(
  context: OptiDevRouteContext,
  state: TelegramBridgePersistedState,
): Promise<void> {
  await writeJson(telegramBridgeStatePath(context), state);
}

async function readActiveSession(context: OptiDevRouteContext): Promise<{
  project: string;
  status: string;
  activeThreadId: string | null;
} | null> {
  const data = await readOptiDevActiveSession(context);
  if (!data?.project || !data.status) {
    return null;
  }
  return {
    project: data.project,
    status: data.status,
    activeThreadId: data.active_thread_id,
  };
}

function isThreadSessionActive(status: string | null | undefined): boolean {
  return status === "running" || status === "ready" || status === "starting";
}

function projectNameMatchesThreadProject(
  projectName: string,
  project: OrchestrationReadModel["projects"][number],
): boolean {
  return project.title === projectName || path.basename(project.workspaceRoot) === projectName;
}

function compareThreadsByFreshness(a: OrchestrationThread, b: OrchestrationThread): number {
  const aActive = isThreadSessionActive(a.session?.status);
  const bActive = isThreadSessionActive(b.session?.status);
  if (aActive !== bActive) {
    return aActive ? -1 : 1;
  }
  return Date.parse(b.updatedAt) - Date.parse(a.updatedAt);
}

export async function resolveTelegramTargetThread(input: {
  readonly context: OptiDevRouteContext;
  readonly snapshot: OrchestrationReadModel;
  readonly preferredThreadId?: string | null;
}): Promise<OrchestrationThread | null> {
  const active = await readActiveSession(input.context);
  const threads = input.snapshot.threads.filter((thread) => thread.deletedAt === null);
  if (threads.length === 0) {
    return null;
  }

  if (input.preferredThreadId) {
    const preferred = threads.find((thread) => thread.id === input.preferredThreadId) ?? null;
    return preferred;
  }

  if (active?.activeThreadId) {
    const selected = threads.find((thread) => thread.id === active.activeThreadId) ?? null;
    if (selected) {
      return selected;
    }
  }

  if (active?.status === "running" || active?.status === "restored") {
    const matchingProjects = input.snapshot.projects.filter((project) =>
      project.deletedAt === null && projectNameMatchesThreadProject(active.project, project),
    );
    const matchingProjectIds = new Set(matchingProjects.map((project) => project.id));
    const matchingThreads = threads
      .filter((thread) => matchingProjectIds.has(thread.projectId))
      .sort(compareThreadsByFreshness);
    if (matchingThreads.length > 0) {
      return matchingThreads[0] ?? null;
    }
  }

  const activeThreads = threads.filter((thread) => isThreadSessionActive(thread.session?.status));
  if (activeThreads.length > 0) {
    return activeThreads.sort(compareThreadsByFreshness)[0] ?? null;
  }

  return threads.sort(compareThreadsByFreshness)[0] ?? null;
}

function sanitizeTelegramText(text: string | undefined): string | null {
  if (typeof text !== "string") {
    return null;
  }
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function isMatchingTelegramChat(update: TelegramUpdate, chatId: number): boolean {
  return update.message?.chat?.id === chatId;
}

function parseIsoMillis(value: string | undefined): number | null {
  if (typeof value !== "string" || value.trim().length === 0) {
    return null;
  }
  const millis = Date.parse(value);
  return Number.isFinite(millis) ? millis : null;
}

function telegramUpdateMillis(update: TelegramUpdate): number | null {
  const seconds = update.message?.date;
  if (typeof seconds !== "number" || !Number.isFinite(seconds)) {
    return null;
  }
  return seconds * 1000;
}

function telegramUpdateId(update: TelegramUpdate): number | null {
  const value = update.update_id;
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function telegramInboundCommandId(chatId: number, updateId: number): CommandId {
  return CommandId.makeUnsafe(`telegram:update:${chatId}:${updateId}`);
}

function telegramInboundMessageId(chatId: number, updateId: number): MessageId {
  return MessageId.makeUnsafe(`telegram:update:${chatId}:${updateId}:user`);
}

function maskTelegramToken(token: string): string {
  if (token.length < 8) {
    return token.length > 0 ? `${token.slice(0, 2)}***` : "";
  }
  return `${token.slice(0, 4)}***${token.slice(-2)}`;
}

async function telegramApi<T>(input: {
  readonly fetchImpl: typeof fetch;
  readonly telegramBaseUrl: string;
  readonly token: string;
  readonly method: string;
  readonly body: Record<string, unknown>;
  readonly requestTimeoutMs: number;
}): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => {
    controller.abort(new Error(`Telegram API ${input.method} timed out after ${input.requestTimeoutMs}ms.`));
  }, input.requestTimeoutMs);
  try {
    const response = await input.fetchImpl(
      `${input.telegramBaseUrl.replace(/\/+$/, "")}/bot${input.token}/${input.method}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(input.body),
        signal: controller.signal,
      },
    );
    if (!response.ok) {
      throw new Error(`Telegram API ${input.method} failed with HTTP ${response.status}.`);
    }
    const payload = (await response.json()) as { ok?: boolean; result?: T; description?: string };
    if (!payload.ok) {
      throw new Error(payload.description || `Telegram API ${input.method} failed.`);
    }
    return payload.result as T;
  } catch (error) {
    if (
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("timed out after"))
    ) {
      throw new Error(`Telegram API ${input.method} timed out after ${input.requestTimeoutMs}ms.`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function sendTelegramMessage(input: {
  readonly fetchImpl: typeof fetch;
  readonly telegramBaseUrl: string;
  readonly token: string;
  readonly chatId: number;
  readonly text: string;
  readonly requestTimeoutMs: number;
}): Promise<void> {
  await telegramApi({
    fetchImpl: input.fetchImpl,
    telegramBaseUrl: input.telegramBaseUrl,
    token: input.token,
    method: "sendMessage",
    requestTimeoutMs: input.requestTimeoutMs,
    body: {
      chat_id: input.chatId,
      text: input.text,
    },
  });
}

async function getTelegramUpdates(input: {
  readonly fetchImpl: typeof fetch;
  readonly telegramBaseUrl: string;
  readonly token: string;
  readonly offset: number;
  readonly requestTimeoutMs: number;
}): Promise<TelegramUpdate[]> {
  return telegramApi<TelegramUpdate[]>({
    fetchImpl: input.fetchImpl,
    telegramBaseUrl: input.telegramBaseUrl,
    token: input.token,
    method: "getUpdates",
    requestTimeoutMs: input.requestTimeoutMs,
    body: {
      offset: input.offset,
      timeout: 0,
      allowed_updates: ["message"],
    },
  });
}

export function requestOptiDevTelegramBridgeReload(): void {
  activeRuntime?.requestReload();
}

export function startOptiDevTelegramBridgeRuntime(
  deps: OptiDevTelegramBridgeRuntimeDeps,
): OptiDevTelegramBridgeRuntimeHandle {
  activeRuntime?.stop();

  const context = deps.context;
  const fetchImpl = deps.fetchImpl ?? fetch;
  const telegramBaseUrl = deps.telegramBaseUrl ?? DEFAULT_TELEGRAM_BASE_URL;
  const now = deps.now ?? (() => new Date().toISOString());
  const pollIntervalMs = deps.pollIntervalMs ?? DEFAULT_POLL_INTERVAL_MS;
  const requestTimeoutMs = deps.requestTimeoutMs ?? DEFAULT_REQUEST_TIMEOUT_MS;
  const log = deps.logger ?? (() => {});
  const currentPid = deps.currentPid ?? process.pid;
  const lockOwnerId = deps.lockOwnerId ?? `${currentPid}:${randomUUID()}`;
  const lockStaleMs = deps.lockStaleMs ?? DEFAULT_LOCK_STALE_MS;
  const isProcessAlive = deps.isProcessAlive ?? defaultIsProcessAlive;
  const telegramOriginMessageIds = new Set<string>();
  const outboundRelayMessageIds = new Set<string>();

  let stopped = false;
  let running = false;
  let ownsBridgeLock = false;
  let reloadRequested = true;
  let activeConfigKey = "";
  let persistedState: TelegramBridgePersistedState = {
    lastUpdateId: 0,
    updatedAt: "",
    availability: "unknown",
    resolvedThreadId: null,
    resolvedThreadTitle: null,
    unavailableReplySent: false,
  };

  const emitStatus = async (message: string): Promise<void> => {
    const config = await readTelegramConfig(context);
    if (!config.enabled || !config.token || config.chat_id === null) {
      return;
    }
    await sendTelegramMessage({
      fetchImpl,
      telegramBaseUrl,
      token: config.token,
      chatId: config.chat_id,
      text: message,
      requestTimeoutMs,
    });
  };

  const resolveCurrentConfig = async (): Promise<TelegramConfig | null> => {
    const config = await readTelegramConfig(context);
    if (!config.enabled || !config.token || config.chat_id === null) {
      activeConfigKey = "";
      return null;
    }
    const nextKey = `${config.token}:${config.chat_id}`;
    if (reloadRequested || activeConfigKey !== nextKey) {
      persistedState = await readPersistedState(context);
      activeConfigKey = nextKey;
      reloadRequested = false;
      log("telegram.bridge.config.loaded", {
        chatId: config.chat_id,
        tokenHint: maskTelegramToken(config.token),
        lastUpdateId: persistedState.lastUpdateId,
      });
    }
    return config;
  };

  const ensureBridgeLock = async (): Promise<boolean> => {
    const result = await tryAcquireOptiDevTelegramBridgeLock({
      context,
      pid: currentPid,
      ownerId: lockOwnerId,
      now: now(),
      staleAfterMs: lockStaleMs,
      isProcessAlive,
    });
    if (!result.acquired) {
      if (ownsBridgeLock) {
        log("telegram.bridge.lock.lost", {
          ownerPid: result.ownerPid,
          ownerId: result.ownerId,
        });
      }
      ownsBridgeLock = false;
      return false;
    }
    if (!ownsBridgeLock) {
      log("telegram.bridge.lock.acquired", {
        pid: currentPid,
        ownerId: lockOwnerId,
        staleRecovered: result.stale,
      });
    }
    ownsBridgeLock = true;
    return true;
  };

  const buildStatusMessage = async (): Promise<string> => {
    const snapshot = await deps.getSnapshot();
    const config = await readTelegramConfig(context);
    const thread = await resolveTelegramTargetThread({
      context,
      snapshot,
      preferredThreadId: config.target_thread_id,
    });
    if (!thread) {
      return "Telegram bridge is enabled, but no active t3 thread is available yet.";
    }
    return `Telegram bridge is attached to thread "${thread.title}" (${thread.id}).`;
  };

  const advancePersistedState = async (updateId: number): Promise<void> => {
    if (updateId <= persistedState.lastUpdateId) {
      return;
    }
    persistedState = {
      ...persistedState,
      lastUpdateId: updateId,
      updatedAt: now(),
    };
    await writePersistedState(context, persistedState);
  };

  const rememberOutboundRelay = (messageId: string): boolean => {
    if (outboundRelayMessageIds.has(messageId)) {
      return false;
    }
    outboundRelayMessageIds.add(messageId);
    if (outboundRelayMessageIds.size > 2048) {
      const first = outboundRelayMessageIds.values().next().value;
      if (typeof first === "string") {
        outboundRelayMessageIds.delete(first);
      }
    }
    return true;
  };

  const updateResolvedTargetState = async (thread: OrchestrationThread | null): Promise<void> => {
    const previousAvailability = persistedState.availability;
    const previousThreadId = persistedState.resolvedThreadId;
    let notice: string | null = null;

    if (previousAvailability !== "unknown") {
      if (!thread && previousAvailability === "available" && previousThreadId) {
        notice =
          `Telegram bridge lost its active t3 session target. Previous guid: ${previousThreadId}. ` +
          "Waiting for a new active thread.";
      } else if (
        thread &&
        previousAvailability === "available" &&
        previousThreadId &&
        previousThreadId !== thread.id
      ) {
        notice =
          `Telegram bridge session switched. Previous guid: ${previousThreadId}. ` +
          `Current guid: ${thread.id}.`;
      } else if (thread && previousAvailability === "unavailable") {
        notice = `Telegram bridge reattached. Current guid: ${thread.id}.`;
      }
    }

    persistedState = {
      ...persistedState,
      availability: thread ? "available" : "unavailable",
      resolvedThreadId: thread?.id ?? null,
      resolvedThreadTitle: thread?.title ?? null,
      unavailableReplySent: thread ? false : persistedState.unavailableReplySent,
    };
    await writePersistedState(context, persistedState);

    if (notice) {
      await emitStatus(notice);
    }
  };

  const resolveCurrentTarget = async (
    config: TelegramConfig,
    snapshot?: OrchestrationReadModel,
  ): Promise<OrchestrationThread | null> => {
    const effectiveSnapshot = snapshot ?? (await deps.getSnapshot());
    const thread = await resolveTelegramTargetThread({
      context,
      snapshot: effectiveSnapshot,
      preferredThreadId: config.target_thread_id,
    });
    await updateResolvedTargetState(thread);
    return thread;
  };

  const handleIncomingText = async (
    config: TelegramConfig,
    update: TelegramUpdate,
    text: string,
  ): Promise<void> => {
    if (stopped) {
      return;
    }
    const snapshot = await deps.getSnapshot();
    if (stopped) {
      return;
    }
    const thread = await resolveCurrentTarget(config, snapshot);
    const updateId = telegramUpdateId(update);
    if (!thread) {
      if (!persistedState.unavailableReplySent) {
        await sendTelegramMessage({
          fetchImpl,
          telegramBaseUrl,
          token: config.token,
          chatId: config.chat_id!,
          text: "No active t3 thread is available yet.",
          requestTimeoutMs,
        });
        persistedState = {
          ...persistedState,
          unavailableReplySent: true,
        };
        await writePersistedState(context, persistedState);
      }
      return;
    }
    if (updateId === null) {
      throw new Error("Telegram update is missing a valid update_id.");
    }

    const createdAt = now();
    const commandId = telegramInboundCommandId(config.chat_id!, updateId);
    const messageId = telegramInboundMessageId(config.chat_id!, updateId);
    telegramOriginMessageIds.add(messageId);
    await deps.dispatchCommand({
      type: "thread.turn.start",
      commandId,
      threadId: thread.id,
      message: {
        messageId,
        role: "user",
        text,
        attachments: [],
      },
      runtimeMode: thread.runtimeMode,
      interactionMode: thread.interactionMode,
      createdAt,
    });
    log("telegram.bridge.inbound.dispatched", {
      threadId: thread.id,
      updateId,
      commandId,
      messagePreview: text.slice(0, 120),
    });
  };

  const tick = async (): Promise<void> => {
    if (stopped || running) {
      return;
    }
    running = true;
    try {
      if (!(await ensureBridgeLock())) {
        return;
      }
      const config = await resolveCurrentConfig();
      if (stopped || !config) {
        return;
      }
      await resolveCurrentTarget(config);
      if (stopped) {
        return;
      }

      const updates = await getTelegramUpdates({
        fetchImpl,
        telegramBaseUrl,
        token: config.token,
        offset: persistedState.lastUpdateId > 0 ? persistedState.lastUpdateId + 1 : 0,
        requestTimeoutMs,
      });
      if (stopped || updates.length === 0) {
        return;
      }
      const configUpdatedAtMs = parseIsoMillis(config.updated_at);
      const shouldFilterBootstrapBacklog = persistedState.lastUpdateId === 0;
      let skippedBootstrapUpdates = 0;

      for (const update of updates) {
        if (stopped) {
          return;
        }
        const updateId = telegramUpdateId(update);
        if (updateId === null) {
          continue;
        }
        if (!isMatchingTelegramChat(update, config.chat_id!)) {
          await advancePersistedState(updateId);
          continue;
        }
        if (shouldFilterBootstrapBacklog && configUpdatedAtMs !== null) {
          const updateMillis = telegramUpdateMillis(update);
          if (updateMillis !== null && updateMillis < configUpdatedAtMs) {
            skippedBootstrapUpdates += 1;
            await advancePersistedState(updateId);
            continue;
          }
        }
        const text = sanitizeTelegramText(update.message?.text);
        if (!text) {
          await advancePersistedState(updateId);
          continue;
        }
        if (text === "/status") {
          await sendTelegramMessage({
            fetchImpl,
            telegramBaseUrl,
            token: config.token,
            chatId: config.chat_id!,
            text: await buildStatusMessage(),
            requestTimeoutMs,
          });
          await advancePersistedState(updateId);
          continue;
        }
        await handleIncomingText(config, update, text);
        await advancePersistedState(updateId);
      }
      if (shouldFilterBootstrapBacklog && skippedBootstrapUpdates > 0) {
        log("telegram.bridge.backlog.skipped", {
          skippedUpdates: skippedBootstrapUpdates,
          lastUpdateId: persistedState.lastUpdateId,
        });
      }
    } catch (error) {
      log("telegram.bridge.tick.failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    } finally {
      running = false;
    }
  };

  const handleDomainEvent = (event: OrchestrationEvent) => {
    if (stopped || !ownsBridgeLock || event.type !== "thread.message-sent") {
      return;
    }

    void (async () => {
      const config = await resolveCurrentConfig();
      if (stopped || !config) {
        return;
      }
      const snapshot = await deps.getSnapshot();
      if (stopped) {
        return;
      }
      const targetThread = await resolveCurrentTarget(config, snapshot);
      if (!targetThread || targetThread.id !== event.payload.threadId) {
        return;
      }
      const text = sanitizeTelegramText(event.payload.text);
      if (!text) {
        return;
      }
      if (!rememberOutboundRelay(event.payload.messageId)) {
        return;
      }
      if (event.payload.role === "user") {
        if (telegramOriginMessageIds.delete(event.payload.messageId)) {
          return;
        }
        await sendTelegramMessage({
          fetchImpl,
          telegramBaseUrl,
          token: config.token,
          chatId: config.chat_id!,
          text: `You: ${text}`,
          requestTimeoutMs,
        });
        log("telegram.bridge.outbound.sent", {
          threadId: event.payload.threadId,
          role: "user",
          messagePreview: text.slice(0, 120),
        });
        return;
      }
      if (event.payload.role !== "assistant") {
        return;
      }
      await sendTelegramMessage({
        fetchImpl,
        telegramBaseUrl,
        token: config.token,
        chatId: config.chat_id!,
        text,
        requestTimeoutMs,
      });
      log("telegram.bridge.outbound.sent", {
        threadId: event.payload.threadId,
        role: "assistant",
        messagePreview: text.slice(0, 120),
      });
    })().catch((error) => {
      log("telegram.bridge.outbound.failed", {
        error: error instanceof Error ? error.message : String(error),
      });
    });
  };

  const interval = setInterval(() => {
    void tick();
  }, pollIntervalMs);
  void tick();

  const handle: OptiDevTelegramBridgeRuntimeHandle = {
    requestReload: () => {
      reloadRequested = true;
      void tick();
    },
    handleDomainEvent,
    stop: () => {
      if (stopped) {
        return;
      }
      stopped = true;
      clearInterval(interval);
      void releaseOptiDevTelegramBridgeLock({
        context,
        pid: currentPid,
        ownerId: lockOwnerId,
      });
      if (activeRuntime === handle) {
        activeRuntime = null;
      }
    },
  };

  activeRuntime = handle;
  return handle;
}
