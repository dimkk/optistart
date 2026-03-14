export const OPTIDEV_TABS = ["files", "optidev", "plugins"] as const;
const OPTIDEV_TAB_STORAGE_KEY = "optidev:active-tab";
const OPTIDEV_TAB_EVENT = "optidev:tab-change";

export type OptiDevWorkspaceTab = (typeof OPTIDEV_TABS)[number];

export function normalizeOptiDevTab(value: unknown): OptiDevWorkspaceTab {
  if (value === "optidev" || value === "plugins") {
    return value;
  }
  return "files";
}

export function readStoredOptiDevTab(): OptiDevWorkspaceTab {
  if (typeof window === "undefined") {
    return "files";
  }
  return normalizeOptiDevTab(window.localStorage.getItem(OPTIDEV_TAB_STORAGE_KEY));
}

export function setStoredOptiDevTab(tab: OptiDevWorkspaceTab): void {
  if (typeof window === "undefined") {
    return;
  }
  window.localStorage.setItem(OPTIDEV_TAB_STORAGE_KEY, tab);
  window.dispatchEvent(new CustomEvent<OptiDevWorkspaceTab>(OPTIDEV_TAB_EVENT, { detail: tab }));
}

export function subscribeOptiDevTab(
  onTabChange: (tab: OptiDevWorkspaceTab) => void,
): () => void {
  if (typeof window === "undefined") {
    return () => {};
  }

  const handleTabChange = (event: Event) => {
    const nextTab = normalizeOptiDevTab((event as CustomEvent<OptiDevWorkspaceTab>).detail);
    onTabChange(nextTab);
  };

  window.addEventListener(OPTIDEV_TAB_EVENT, handleTabChange);
  return () => {
    window.removeEventListener(OPTIDEV_TAB_EVENT, handleTabChange);
  };
}
