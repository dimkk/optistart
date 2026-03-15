interface ErrorEnvelope {
  ok?: boolean;
  lines?: string[];
}

export async function syncActiveOptiDevThread(input: {
  threadId: string | null;
  threadTitle?: string | null;
}): Promise<void> {
  const response = await fetch("/api/optidev/active-thread", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      threadId: input.threadId ?? undefined,
      threadTitle: input.threadTitle ?? undefined,
    }),
  });
  if (!response.ok) {
    const body = (await response.json().catch(() => ({}))) as ErrorEnvelope;
    throw new Error(body.lines?.join("\n") || `Request failed: ${response.status}`);
  }
}
