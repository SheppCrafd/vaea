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
  createModalType: "task", // "task" | "project" | "product" | "area" | "csv"
  // Optional parent-id prefill for the form the modal opens on — e.g. the (+)
  // on a Product card opens the Project form with { parent_area_id,
  // parent_product_id } already filled. Cleared on close so a later plain
  // "Create new" starts blank.
  createModalPrefill: null,
  openCreateModal: (type = "task", prefill = null) =>
    set({ isCreateModalOpen: true, createModalType: type, createModalPrefill: prefill }),
  closeCreateModal: () => set({ isCreateModalOpen: false, createModalPrefill: null }),

  isCommandPaletteOpen: false,
  openCommandPalette: () => set({ isCommandPaletteOpen: true }),
  closeCommandPalette: () => set({ isCommandPaletteOpen: false }),
  toggleCommandPalette: () => set((s) => ({ isCommandPaletteOpen: !s.isCommandPaletteOpen })),

  // Backs entityUtils.js's confirmThen — every destructive/consequential
  // action in the app (delete an Area/Product/Project/Task/Department/
  // Stakeholder, switch storage backends, restore a backup) used to gate
  // itself on the native window.confirm(), an unstyled OS dialog completely
  // outside this app's own design system. confirmThen is a plain function
  // called from all over the codebase, not just components, so it can't
  // render JSX itself — it calls this store's vanilla getState().requestConfirm
  // instead, and the one <ConfirmDialog/> mounted in App.jsx (alongside
  // Toaster/CommandPalette) is what actually renders the real, styled Modal.
  confirmDialog: null, // { message, onConfirm } | null
  requestConfirm: (message, onConfirm) => set({ confirmDialog: { message, onConfirm } }),
  closeConfirmDialog: () => set({ confirmDialog: null }),

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

  // ChatBox (the floating draggable/resizable chat window) — used to be
  // mounted only inside AppShell (isChatMounted was a local useState there),
  // which meant the popout only existed on the Dashboard route. Moved here,
  // mounted once in AuthenticatedApp.jsx alongside every route, so it's
  // reachable everywhere — including from the OPEN_APP_SECTION chat tool
  // below, which needs to be able to pop it open from any page.
  isChatMounted: false,
  mountChat: () => set({ isChatMounted: true }),
  // ChatBox owns its own open/collapsed state locally; this is just a
  // signal it watches (any change, not the value itself) to know "something
  // else wants me open now" without this store needing to know ChatBox's
  // internal state shape.
  chatOpenSignal: 0,
  requestChatOpen: () => set((s) => ({ isChatMounted: true, chatOpenSignal: s.chatOpenSignal + 1 })),

  // OPEN_APP_SECTION (chatActions.js) — a plain module with no router or DOM
  // access of its own, so "go to this tab/section and highlight it" is a
  // request dropped here instead of acted on directly. AuthenticatedApp.jsx
  // (which has router context) is what actually calls navigate() and clears
  // pendingRoute; pendingHighlightId is read by SectionAnchor.jsx wherever
  // a tab/settings-section is rendered, and cleared once it's done
  // scrolling to and pulsing the match.
  pendingRoute: null,
  pendingHighlightId: null,
  openAppSection: (to, highlightId) => set((s) => ({
    pendingRoute: to,
    pendingHighlightId: highlightId || null,
    isChatMounted: true,
    chatOpenSignal: s.chatOpenSignal + 1,
  })),
  consumePendingRoute: () => set({ pendingRoute: null }),
  clearHighlight: () => set({ pendingHighlightId: null }),

  // Vault note paths Vaea is CURRENTLY proposing to write (a pending
  // WRITE_VAULT_NOTE the user hasn't confirmed/cancelled yet) — set by
  // useChatController.js whenever such a pending_action appears, read by
  // VaultGraph.jsx to render those as "new" nodes (grey — the opposite of
  // the existing-node accent color) even before the note is real, and
  // cleared the moment the user confirms or cancels. Global store, not
  // per-session chat state, since the whole point is the Mind Map page
  // (which has no chat context of its own) can react to it.
  pendingVaultProposals: [],
  setPendingVaultProposals: (paths) => set({ pendingVaultProposals: paths || [] }),
}));