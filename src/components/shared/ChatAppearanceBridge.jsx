import { useEffect } from "react";
import { useTheme } from "next-themes";
import { useAccentTheme } from "@/hooks/useAccentTheme";
import { APPEARANCE_CHANGE_EVENT } from "@/lib/appearanceConstants";

// Mounted once (App.jsx, alongside ConfirmDialog/ChatControllerProvider) so
// the AI chat's SET_APPEARANCE action can actually change the live theme —
// next-themes' setTheme and useAccentTheme's setAccent both only exist
// behind real React hooks, so chatActions.js (a plain, React-free module,
// same reason SET_CARD_VIEW uses a custom event instead of calling a setter
// directly) dispatches a window event instead and this component is the one
// real listener that turns it into the actual hook calls, keeping every
// other component that already reads these hooks (AppShell, AppearanceSection)
// in perfect sync — no separate DOM/localStorage-poking path to drift from
// what a real user's own click already does.
export default function ChatAppearanceBridge() {
  const { setTheme } = useTheme();
  const { setAccent } = useAccentTheme();

  useEffect(() => {
    function onChange(e) {
      const { mode, accent } = e.detail || {};
      if (mode) setTheme(mode);
      if (accent) setAccent(accent);
    }
    window.addEventListener(APPEARANCE_CHANGE_EVENT, onChange);
    return () => window.removeEventListener(APPEARANCE_CHANGE_EVENT, onChange);
  }, [setTheme, setAccent]);

  return null;
}
