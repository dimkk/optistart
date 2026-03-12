import { spawnSync } from "node:child_process";
import fs from "node:fs/promises";
import path from "node:path";

import type { OptiDevActionResponse, OptiDevRouteContext } from "./optidevContract";
import { discoverProjectsNative, resolveHomeDir } from "./optidevNative";
import { recordNativeWorkspaceStopped } from "./optidevPlugins";

interface SessionState {
  project: string;
  status: string;
  started_at: string;
  stopped_at: string | null;
  mux_backend: string;
  mux_session_name: string;
  layout_path: string;
  restored?: boolean;
}

interface HookState {
  group: string;
  command: string;
  pid: number | null;
  status: string;
}

interface LifecycleDeps {
  now: () => string;
  killProcessGroup: (pid: number, signal: NodeJS.Signals) => void;
  killPid: (pid: number, signal: NodeJS.Signals) => void;
  runCommand: (command: string, args: string[]) => void;
}

const defaultDeps: LifecycleDeps = {
  now: () => new Date().toISOString(),
  killProcessGroup: (pid, signal) => {
    process.kill(-pid, signal);
  },
  killPid: (pid, signal) => {
    process.kill(pid, signal);
  },
  runCommand: (command, args) => {
    spawnSync(command, args, {
      stdio: "ignore",
    });
  },
};

async function exists(filePath: string): Promise<boolean> {
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

async function readActiveSession(context: OptiDevRouteContext): Promise<SessionState | null> {
  const homeDir = resolveHomeDir(context);
  const activePath = path.join(homeDir, "active_session.json");
  if (!(await exists(activePath))) {
    return null;
  }
  const active = await readJson<{ project?: unknown }>(activePath);
  if (typeof active.project !== "string" || active.project.length === 0) {
    return null;
  }
  const sessionPath = path.join(homeDir, "sessions", active.project, "session.json");
  if (!(await exists(sessionPath))) {
    return null;
  }
  return readJson<SessionState>(sessionPath);
}

async function stopHooks(
  context: OptiDevRouteContext,
  project: string,
  deps: LifecycleDeps,
): Promise<void> {
  const hooksPath = path.join(resolveHomeDir(context), "sessions", project, "hooks.json");
  if (!(await exists(hooksPath))) {
    return;
  }
  const hooks = await readJson<HookState[]>(hooksPath);
  for (const hook of hooks) {
    if (hook.pid == null || hook.status !== "running") {
      continue;
    }
    try {
      deps.killProcessGroup(hook.pid, "SIGTERM");
      hook.status = "stopped";
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ESRCH") {
        hook.status = "exited";
      } else {
        hook.status = "unknown";
      }
    }
  }
  await writeJson(hooksPath, hooks);
}

async function stopMux(session: SessionState, deps: LifecycleDeps): Promise<void> {
  if (session.mux_backend === "zellij") {
    deps.runCommand("zellij", ["kill-session", session.mux_session_name]);
    return;
  }
  if (session.mux_backend !== "textual") {
    return;
  }
  const pidPath = path.join(path.dirname(session.layout_path), "textual.pid");
  if (!(await exists(pidPath))) {
    return;
  }
  try {
    const pid = Number.parseInt((await fs.readFile(pidPath, "utf8")).trim(), 10);
    if (Number.isFinite(pid)) {
      deps.killPid(pid, "SIGTERM");
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
      throw error;
    }
  }
}

async function markProjectSessionStopped(
  context: OptiDevRouteContext,
  project: string,
  stoppedAt: string,
): Promise<void> {
  const projects = await discoverProjectsNative(context);
  const projectPath = projects.find((item) => item.name === project)?.path;
  if (!projectPath) {
    return;
  }
  const sessionPath = path.join(projectPath, ".optidev", "session.json");
  if (!(await exists(sessionPath))) {
    return;
  }
  const current = await readJson<Record<string, unknown>>(sessionPath);
  await writeJson(sessionPath, {
    ...current,
    status: "stopped",
    stopped_at: stoppedAt,
  });
}

export async function nativeStopAction(
  context: OptiDevRouteContext,
  deps: Partial<LifecycleDeps> = {},
): Promise<OptiDevActionResponse> {
  const mergedDeps: LifecycleDeps = { ...defaultDeps, ...deps };
  const active = await readActiveSession(context);
  if (!active) {
    return { ok: true, lines: ["No active session to stop."] };
  }

  await stopHooks(context, active.project, mergedDeps);
  await recordNativeWorkspaceStopped(context, { project: active.project, status: active.status });
  await stopMux(active, mergedDeps);
  const stoppedAt = mergedDeps.now();
  const stopped: SessionState = {
    ...active,
    status: "stopped",
    stopped_at: stoppedAt,
    restored: false,
  };
  await writeJson(
    path.join(resolveHomeDir(context), "sessions", active.project, "session.json"),
    stopped,
  );
  await writeJson(
    path.join(resolveHomeDir(context), "active_session.json"),
    {
      project: stopped.project,
      status: stopped.status,
      mux_backend: stopped.mux_backend,
      mux_session_name: stopped.mux_session_name,
      updated_at: stoppedAt,
    },
  );
  await markProjectSessionStopped(context, active.project, stoppedAt);
  return { ok: true, lines: [`Stopped session '${active.mux_session_name}'.`] };
}

export async function nativeResetAction(
  context: OptiDevRouteContext,
  projectPath: string,
  deps: Partial<LifecycleDeps> = {},
): Promise<OptiDevActionResponse> {
  const mergedDeps: LifecycleDeps = { ...defaultDeps, ...deps };
  const resolvedProjectPath = path.resolve(projectPath);
  const projectName = path.basename(resolvedProjectPath);
  const lines: string[] = [];
  const active = await readActiveSession(context);

  if (active && active.project === projectName && active.status === "running") {
    const stopResult = await nativeStopAction(context, mergedDeps);
    lines.push(...stopResult.lines);
  }

  await fs.rm(path.join(resolvedProjectPath, ".optidev", "session.json"), { force: true });
  await fs.rm(path.join(resolveHomeDir(context), "sessions", projectName), {
    recursive: true,
    force: true,
  });
  lines.push(`Workspace session reset for project '${projectName}'.`);
  return { ok: true, lines };
}
