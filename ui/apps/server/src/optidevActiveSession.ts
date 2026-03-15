import fs from "node:fs/promises";
import path from "node:path";

import type { OptiDevRouteContext } from "./optidevContract";
import { resolveHomeDir } from "./optidevNative";

export interface OptiDevActiveSessionState {
  project: string | null;
  status: string | null;
  mux_backend: string | null;
  mux_session_name: string | null;
  updated_at: string | null;
  active_thread_id: string | null;
  active_thread_title: string | null;
  thread_updated_at: string | null;
}

function activeSessionPath(context: OptiDevRouteContext): string {
  return path.join(resolveHomeDir(context), "active_session.json");
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

export async function readOptiDevActiveSession(
  context: OptiDevRouteContext,
): Promise<OptiDevActiveSessionState | null> {
  const filePath = activeSessionPath(context);
  if (!(await fileExists(filePath))) {
    return null;
  }
  try {
    const data = await readJson<Record<string, unknown>>(filePath);
    return {
      project: typeof data.project === "string" ? data.project : null,
      status: typeof data.status === "string" ? data.status : null,
      mux_backend: typeof data.mux_backend === "string" ? data.mux_backend : null,
      mux_session_name: typeof data.mux_session_name === "string" ? data.mux_session_name : null,
      updated_at: typeof data.updated_at === "string" ? data.updated_at : null,
      active_thread_id:
        typeof data.active_thread_id === "string" ? data.active_thread_id : null,
      active_thread_title:
        typeof data.active_thread_title === "string" ? data.active_thread_title : null,
      thread_updated_at:
        typeof data.thread_updated_at === "string" ? data.thread_updated_at : null,
    };
  } catch {
    return null;
  }
}

export async function writeOptiDevWorkspaceSession(
  context: OptiDevRouteContext,
  input: {
    project: string;
    status: string;
    mux_backend: string;
    mux_session_name: string;
    updated_at: string;
  },
): Promise<void> {
  const current = await readOptiDevActiveSession(context);
  await writeJson(activeSessionPath(context), {
    project: input.project,
    status: input.status,
    mux_backend: input.mux_backend,
    mux_session_name: input.mux_session_name,
    updated_at: input.updated_at,
    active_thread_id: current?.active_thread_id ?? null,
    active_thread_title: current?.active_thread_title ?? null,
    thread_updated_at: current?.thread_updated_at ?? null,
  });
}

export async function recordOptiDevActiveThreadSelection(
  context: OptiDevRouteContext,
  input: {
    threadId: string | null;
    threadTitle?: string | null;
    updatedAt?: string;
  },
): Promise<void> {
  const current = await readOptiDevActiveSession(context);
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  await writeJson(activeSessionPath(context), {
    project: current?.project ?? null,
    status: current?.status ?? null,
    mux_backend: current?.mux_backend ?? null,
    mux_session_name: current?.mux_session_name ?? null,
    updated_at: current?.updated_at ?? updatedAt,
    active_thread_id: input.threadId,
    active_thread_title: input.threadId ? input.threadTitle ?? null : null,
    thread_updated_at: input.threadId ? updatedAt : null,
  });
}
