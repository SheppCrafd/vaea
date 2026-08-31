import { LayoutDashboard, MessageCircle, Settings as SettingsIcon, CalendarDays, Bell, Network, Inbox } from "lucide-react";

// Header.jsx's tab bar, factored out to its own dependency-free module —
// Header.jsx itself pulls in UserMenu.jsx (which touches `window` at
// module load, via utils.js's isIframe check), so importing TABS FROM
// Header.jsx into a plain logic module used in tests (chatActions.js,
// useCommandPaletteData.js) broke every test file that imports either of
// those in a node (non-jsdom) environment. lucide-react icon components
// have no such module-load side effect, so this file is safe to import
// anywhere. Header.jsx, useCommandPaletteData.js, and chatActions.js
// (OPEN_APP_SECTION) all import TABS from here now.
export const TABS = [
  { key: "dashboard", label: "Dashboard", to: "/app", Icon: LayoutDashboard, isActive: (path) => path === "/app" },
  { key: "chat", label: "Vaea Chat", to: "/app/chat", Icon: MessageCircle, isActive: (path) => path.startsWith("/app/chat") },
  { key: "calendar", label: "Vaea Calendar", to: "/app/calendar", Icon: CalendarDays, isActive: (path) => path.startsWith("/app/calendar") },
  { key: "vmail", label: "Vmail", to: "/app/vmail", Icon: Inbox, isActive: (path) => path.startsWith("/app/vmail") },
  { key: "notifications", label: "Notifications", to: "/app/notifications", Icon: Bell, isActive: (path) => path.startsWith("/app/notifications") },
  // Two tabs in one page (Vault | Workflows — see MindMapPage.jsx); no
  // separate "workflows" header tab anymore, folded in on request.
  { key: "mindmap", label: "Mind Map", to: "/app/mindmap", Icon: Network, isActive: (path) => path.startsWith("/app/mindmap") },
  { key: "settings", label: "Settings", to: "/app/settings", Icon: SettingsIcon, isActive: (path) => path.startsWith("/app/settings") },
];
