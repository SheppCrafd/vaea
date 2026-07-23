import { create } from "zustand";

const LEFT_SIDEBAR_STORAGE_KEY = "vaea_left_sidebar_open";
const RIGHT_SIDEBAR_STORAGE_KEY = "vaea_right_sidebar_open";
const CHAT_SIDEBAR_STORAGE_KEY = "vaea_chat_sidebar_open";
const SETTINGS_SIDEBAR_STORAGE_KEY = "vaea_settings_sidebar_open";
const OPEN_TABS_STORAGE_KEY = "vaea_open_tabs";

// Header.jsx's TABS list is the source of truth for what a key means (label/
// route/icon) — this is just the default set of keys open on a first visit.
const DEFAULT_TAB_KEYS = ["dashboard", "chat", "settings"];

const loadSidebarOpenState = (key) => {
  try {
    return localStorage.getItem(key) !== "false";
  } catch {
    return true;
  }
};

// Every page with a persistent left sidebar (Dashboard's stakeholders,
// Chat's session list, Settings' section nav) gets its own open/closed
// slice, all shaped identically, all localStorage-persisted, all toggled
// from the one shared button in Header — the same pattern Chat's sidebar
// already had, generalized so it isn't special-cased anymore. Returns
// { [isOpenKey]: bool, [toggleKey]: fn } to spread into the store below.
const sidebarSlice = (isOpenKey, toggleKey, storageKey) => (set) => ({
  [isOpenKey]: loadSidebarOpenState(storageKey),
  [toggleKey]: () => set((s) => {
    const next = !s[isOpenKey];
    try { localStorage.setItem(storageKey, String(next)); } catch { /* best-effort */ }
    return { [isOpenKey]: next };
  }),
});

const loadOpenTabKeys = () => {
  try {
    const raw = localStorage.getItem(OPEN_TABS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) && parsed.length ? parsed : [...DEFAULT_TAB_KEYS];
  } catch {
    return [...DEFAULT_TAB_KEYS];
  }
};

const saveOpenTabKeys = (keys) => {
  try {
    localStorage.setItem(OPEN_TABS_STORAGE_KEY, JSON.stringify(keys));
  } catch {
    // best-effort — the tab bar just won't remember this across a reload
  }
};

// Board data now lives in real Base44 entities, fetched/mutated via the
// React Query hooks in src/hooks. This store only holds transient UI state.
export const useAppStore = create((set) => ({
  isCreateModalOpen: false,
  createModalType: "task", // "task" | "project"
  openCreateModal: (type = "task") => set({ isCreateModalOpen: true, createModalType: type }),
  closeCreateModal: () => set({ isCreateModalOpen: false }),

  isCommandPaletteOpen: false,
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),

  // AppShell's stakeholders panel — moved here from AppShell's own useState
  // so Header can toggle it too, now that Header renders once above every
  // route (App.jsx) instead of inside AppShell.
  ...sidebarSlice("isLeftSidebarOpen", "toggleLeftSidebar", LEFT_SIDEBAR_STORAGE_KEY)(set),
  // AppShell's focus/stats panel — Dashboard-only, no equivalent elsewhere
  // (nothing else in the app has a *right* sidebar), so this one stays as
  // its own slice rather than joining Header's per-route left-sidebar lookup.
  ...sidebarSlice("isRightSidebarOpen", "toggleRightSidebar", RIGHT_SIDEBAR_STORAGE_KEY)(set),
  // Chat's session list and Settings' section nav — previously each owned
  // by a local useState with no persistence (Chat) or didn't exist at all
  // (Settings). Same shape as the dashboard's left sidebar above, so
  // Header's single left-toggle button can drive whichever one applies to
  // the current route.
  ...sidebarSlice("isChatSidebarOpen", "toggleChatSidebar", CHAT_SIDEBAR_STORAGE_KEY)(set),
  ...sidebarSlice("isSettingsSidebarOpen", "toggleSettingsSidebar", SETTINGS_SIDEBAR_STORAGE_KEY)(set),

  // Header's tab bar (Dashboard/Chat/Settings, and whatever gets added
  // later) — closable like real browser tabs, persisted across reloads.
  // Closing one only hides it from the bar; navigating to that route again
  // (a link elsewhere, the command palette's "Open Settings"/"Open full-page
  // chat", typing the URL) reopens it via ensureTabOpen, same as clicking a
  // link that targets an already-closed browser tab's page reopens it.
  // The last remaining open tab can't be closed — there must always be at
  // least one way back into the tab bar itself.
  openTabKeys: loadOpenTabKeys(),
  closeTab: (key) => set((s) => {
    if (s.openTabKeys.length <= 1) return s;
    const next = s.openTabKeys.filter((k) => k !== key);
    saveOpenTabKeys(next);
    return { openTabKeys: next };
  }),
  ensureTabOpen: (key) => set((s) => {
    if (s.openTabKeys.includes(key)) return s;
    const next = [...s.openTabKeys, key];
    saveOpenTabKeys(next);
    return { openTabKeys: next };
  }),
}));