import { createContext, useContext, useState } from "react";

const STORAGE_KEY = "portfolio_tracker_card_view";

function loadView() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
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
      localStorage.setItem(STORAGE_KEY, view);
    } catch {
      // best-effort — the choice just won't survive a reload
    }
  };

  return <CardViewContext.Provider value={{ cardView, setCardView }}>{children}</CardViewContext.Provider>;
}

export function useCardView() {
  const ctx = useContext(CardViewContext);
  if (!ctx) throw new Error("useCardView must be used within a CardViewProvider");
  return ctx;
}
