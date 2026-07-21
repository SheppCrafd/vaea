import React, { createContext, useContext, useState, useCallback, useMemo } from "react";

const HighlightContext = createContext();

// Per spec, a stakeholder row has FOUR independent checkboxes — tasks,
// notes, projects, products — each toggling the highlight for that object
// type only ("clicking any of those will highlight the relevant object").
// So the highlight state isn't a flat list of stakeholder ids, it's a set of
// (stakeholderId, category) pairs: checking "tasks" for Alice must not also
// light up her products.
export const HIGHLIGHT_CATEGORIES = ["tasks", "notes", "projects", "products"];

export function HighlightProvider({ children }) {
  const [highlights, setHighlights] = useState([]); // [{ stakeholderId, category }]

  const toggleHighlight = useCallback((stakeholderId, category) => {
    setHighlights((prev) =>
      prev.some((h) => h.stakeholderId === stakeholderId && h.category === category)
        ? prev.filter((h) => !(h.stakeholderId === stakeholderId && h.category === category))
        : [...prev, { stakeholderId, category }]
    );
  }, []);

  const isHighlighted = useCallback(
    (stakeholderId, category) =>
      highlights.some((h) => h.stakeholderId === stakeholderId && h.category === category),
    [highlights]
  );

  // Memoized so every consumer of useHighlight() (every card/row across the
  // dashboard) only re-renders when `highlights` itself actually changes,
  // not whenever HighlightProvider happens to re-render for an unrelated
  // reason (a new object literal here would otherwise change context value
  // identity on every render, forcing all consumers to re-render too).
  const value = useMemo(() => ({ highlights, toggleHighlight, isHighlighted }), [highlights, toggleHighlight, isHighlighted]);

  return (
    <HighlightContext.Provider value={value}>
      {children}
    </HighlightContext.Provider>
  );
}

export function useHighlight() {
  const context = useContext(HighlightContext);
  if (!context) {
    throw new Error("useHighlight must be used within a HighlightProvider");
  }
  return context;
}
