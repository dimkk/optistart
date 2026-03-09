import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";

import { Button } from "../components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";

interface OptiDevProjectRecord {
  name: string;
  path: string;
}

interface OptiDevState {
  status: string;
  logs: string;
  projects: OptiDevProjectRecord[];
  memorySummary: string[];
}

interface ActionResponse {
  ok: boolean;
  lines: string[];
}

async function getState(): Promise<OptiDevState> {
  const response = await fetch("/api/optidev/state");
  const body = (await response.json()) as { ok?: boolean; lines?: string[]; state?: OptiDevState };
  if (!response.ok || !body.state) {
    throw new Error(body.lines?.join("\n") || `Failed to load OptiDev state: ${response.status}`);
  }
  return body.state;
}

async function runAction(payload: Record<string, unknown>): Promise<ActionResponse> {
  const response = await fetch("/api/optidev/action", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const body = (await response.json()) as ActionResponse;
  if (!response.ok) {
    throw new Error(body.lines.join("\n") || `Action failed: ${response.status}`);
  }
  return body;
}

function OptiDevRouteView() {
  const [state, setState] = useState<OptiDevState>({
    status: "Loading...",
    logs: "Loading...",
    projects: [],
    memorySummary: [],
  });
  const [target, setTarget] = useState(".");
  const [cloneName, setCloneName] = useState("feature-sandbox");
  const [memoryKind, setMemoryKind] = useState("feature");
  const [memoryIdentifier, setMemoryIdentifier] = useState("ui-t3code-001");
  const [output, setOutput] = useState("No action yet.");
  const [busy, setBusy] = useState(false);

  const refresh = async () => {
    setBusy(true);
    try {
      setState(await getState());
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const act = async (payload: Record<string, unknown>) => {
    setBusy(true);
    try {
      const result = await runAction(payload);
      setOutput(result.lines.join("\n") || "Command completed without output.");
      setState(await getState());
    } catch (error) {
      setOutput(error instanceof Error ? error.message : String(error));
    } finally {
      setBusy(false);
    }
  };

  const resolvedTarget = target.trim() || ".";

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="border-b border-border px-5 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4">
          <div>
            <p className="text-xs font-semibold tracking-[0.2em] text-muted-foreground uppercase">
              Upstream Fork
            </p>
            <h1 className="mt-1 text-2xl font-semibold">OptiDev In T3</h1>
            <p className="mt-2 text-sm text-muted-foreground">
              Runtime, memory, plugins, and workspace controls wired into the forked t3 product.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" render={<Link to="/_chat/" />}>
              Back To Threads
            </Button>
            <Button onClick={() => void refresh()}>{busy ? "Refreshing..." : "Refresh"}</Button>
          </div>
        </div>
      </header>

      <main className="mx-auto grid w-full max-w-7xl gap-4 p-5 lg:grid-cols-2">
        <Card data-testid="optidev-state-card">
          <CardHeader>
            <CardTitle>Status</CardTitle>
            <CardDescription>Current OptiDev runtime status from the integrated backend.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap break-words text-sm" data-testid="optidev-status">
              {state.status}
            </pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Runtime Target</CardTitle>
            <CardDescription>
              Use `.` for the current repository or a discovered project name for registry-backed actions.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="optidev-target">Project Target</Label>
              <Input
                id="optidev-target"
                data-testid="optidev-target"
                value={target}
                onChange={(event) => setTarget(event.currentTarget.value)}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button data-testid="optidev-start" onClick={() => void act({ action: "start", target: resolvedTarget })}>
                Start
              </Button>
              <Button variant="outline" onClick={() => void act({ action: "go", target: resolvedTarget })}>
                Go
              </Button>
              <Button variant="outline" onClick={() => void act({ action: "resume", target: resolvedTarget })}>
                Resume
              </Button>
              <Button variant="outline" onClick={() => void act({ action: "reset", target: resolvedTarget })}>
                Reset
              </Button>
              <Button variant="outline" data-testid="optidev-stop" onClick={() => void act({ action: "stop" })}>
                Stop
              </Button>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void act({ action: "init", target: resolvedTarget })}>
                Init
              </Button>
              <Button variant="outline" onClick={() => void act({ action: "start", target: resolvedTarget, advice: true })}>
                Start With Advice
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Projects</CardTitle>
            <CardDescription>Discovered OptiDev projects with resolved paths.</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3 text-sm" data-testid="optidev-projects">
              {state.projects.length === 0 ? (
                <li>No discovered projects.</li>
              ) : (
                state.projects.map((item) => (
                  <li key={`${item.name}:${item.path}`} className="rounded-lg border border-border p-3">
                    <div className="font-medium text-foreground">{item.name}</div>
                    <div className="mt-1 break-all text-muted-foreground">{item.path || "No path resolved."}</div>
                  </li>
                ))
              )}
            </ul>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Workspace Clone</CardTitle>
            <CardDescription>Create an additional workspace through the OptiDev backend.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="optidev-clone-name">Clone Name</Label>
              <Input
                id="optidev-clone-name"
                data-testid="optidev-clone-name"
                value={cloneName}
                onChange={(event) => setCloneName(event.currentTarget.value)}
              />
            </div>
            <Button
              variant="outline"
              onClick={() =>
                void act({
                  action: "workspace_clone",
                  name: cloneName.trim(),
                  target: resolvedTarget,
                })
              }
            >
              Clone Workspace
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Memory</CardTitle>
            <CardDescription>Digest, open loops, and typed memory lookups through OptiDev memory commands.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="optidev-memory-kind">Kind</Label>
                <Input
                  id="optidev-memory-kind"
                  value={memoryKind}
                  onChange={(event) => setMemoryKind(event.currentTarget.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="optidev-memory-id">Identifier</Label>
                <Input
                  id="optidev-memory-id"
                  data-testid="optidev-memory-id"
                  value={memoryIdentifier}
                  onChange={(event) => setMemoryIdentifier(event.currentTarget.value)}
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" onClick={() => void act({ action: "memory_summary", target: resolvedTarget })}>
                Summary
              </Button>
              <Button
                variant="outline"
                data-testid="optidev-open-loops"
                onClick={() => void act({ action: "memory_open_loops", target: resolvedTarget })}
              >
                Open Loops
              </Button>
              <Button
                variant="outline"
                onClick={() =>
                  void act({
                    action: "memory_show",
                    target: resolvedTarget,
                    kind: memoryKind.trim(),
                    identifier: memoryIdentifier.trim(),
                  })
                }
              >
                Show Memory
              </Button>
            </div>
            <pre className="whitespace-pre-wrap break-words text-sm">{state.memorySummary.join("\n")}</pre>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Integrations</CardTitle>
            <CardDescription>Plugin-backed commands executed natively inside the forked t3 runtime.</CardDescription>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button
              variant="outline"
              data-testid="optidev-advice"
              onClick={() => void act({ action: "plugin", command: "advice", args: [] })}
            >
              Advice
            </Button>
            <Button
              variant="outline"
              onClick={() => void act({ action: "plugin", command: "telegram", args: ["status"] })}
            >
              Telegram
            </Button>
            <Button
              variant="outline"
              onClick={() => void act({ action: "plugin", command: "skills", args: ["search", "react"] })}
            >
              Skills
            </Button>
            <Button
              variant="outline"
              onClick={() => void act({ action: "plugin", command: "agents", args: ["search", "code"] })}
            >
              Agents
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Logs</CardTitle>
            <CardDescription>Current log surface returned by OptiDev.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap break-words text-sm">{state.logs}</pre>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle>Action Output</CardTitle>
            <CardDescription>Result of the last OptiDev command invoked through the t3 fork.</CardDescription>
          </CardHeader>
          <CardContent>
            <pre className="whitespace-pre-wrap break-words text-sm" data-testid="optidev-output">
              {output}
            </pre>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

export const Route = createFileRoute("/optidev")({
  component: OptiDevRouteView,
});
