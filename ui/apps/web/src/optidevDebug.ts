function shouldLogOptiDevDebug(): boolean {
  if (import.meta.env.DEV) {
    return true;
  }
  if (typeof window === "undefined") {
    return false;
  }
  try {
    return window.localStorage.getItem("t3code:debug:optidev") === "1";
  } catch {
    return false;
  }
}

export function debugOptiDev(label: string, payload?: unknown): void {
  if (!shouldLogOptiDevDebug()) {
    return;
  }

  if (typeof window !== "undefined") {
    const target = window as Window & {
      __OPTIDEV_DEBUG__?: Record<string, unknown>;
    };
    const current = target.__OPTIDEV_DEBUG__ ?? {};
    target.__OPTIDEV_DEBUG__ = {
      ...current,
      [label]: payload ?? null,
      updatedAt: new Date().toISOString(),
    };
  }

  if (payload === undefined) {
    console.debug(`[optidev] ${label}`);
    return;
  }
  console.debug(`[optidev] ${label}`, payload);
}
