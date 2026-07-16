import React, { createContext, useContext, useState } from "react";

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

  const toggleHighlight = (stakeholderId, category) => {
    setHighlights((prev) =>
      prev.some((h) => h.stakeholderId === stakeholderId && h.category === category)
        ? prev.filter((h) => !(h.stakeholderId === stakeholderId && h.category === category))
        : [...prev, { stakeholderId, category }]
    );
  };

  const isHighlighted = (stakeholderId, category) =>
    highlights.some((h) => h.stakeholderId === stakeholderId && h.category === category);

  return (
    <HighlightContext.Provider value={{ highlights, toggleHighlight, isHighlighted }}>
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
