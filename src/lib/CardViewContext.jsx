import { createContext, useContext, useEffect, useMemo, useState } from "react";
import { CARD_VIEW_STORAGE_KEY, CARD_VIEW_CHANGE_EVENT } from "@/lib/cardViewConstants";

function loadView() {
  try {
    const stored = localStorage.getItem(CARD_VIEW_STORAGE_KEY);
    return stored === "full" ? "full" : "mini";
  } catch {
    return "mini";
  }
}

// Which ProjectCard face renders across the whole dashboard: "mini" (the
// small-square default) or "full" (the original always-editable card).
// A Context, not a plain hook, since AreaCard/ProductCard/Dashboard all need
// the same live value — a plain per-component localStorage-backed hook
// wouldn't share state across instances without a reload.
const CardViewContext = createContext(null);

export function CardViewProvider({ children }) {
  const [cardView, setCardViewState] = useState(loadView);

  const setCardView = (view) => {
    setCardViewState(view);
    try {
      localStorage.setItem(CARD_VIEW_STORAGE_KEY, view);
    } catch {
      // best-effort — the choice just won't survive a reload
    }
  };

  useEffect(() => {
    // Fired whenever something outside this Provider's own setCardView
    // changes the stored view (the AI chat's SET_CARD_VIEW action, run from
    // a plain module with no access to this context) so already-mounted
    // instances stay in sync without needing a reload.
    const onExternalChange = (e) => setCardViewState(e.detail);
    window.addEventListener(CARD_VIEW_CHANGE_EVENT, onExternalChange);
    return () => window.removeEventListener(CARD_VIEW_CHANGE_EVENT, onExternalChange);
  }, []);

  const value = useMemo(() => ({ cardView, setCardView }), [cardView]);

  return <CardViewContext.Provider value={value}>{children}</CardViewContext.Provider>;
}

export function useCardView() {
  const ctx = useContext(CardViewContext);
  if (!ctx) throw new Error("useCardView must be used within a CardViewProvider");
  return ctx;
}
