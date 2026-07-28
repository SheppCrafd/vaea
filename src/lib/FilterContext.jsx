import { createContext, useContext, useState, useMemo, useCallback } from "react";

// Global exclusion filter: any Area/Product/Project ID pushed here is hidden
// from the dashboard views. Bulk operations rather than a one-id toggle —
// the filter UI's Excel-style tri-state behavior (uncheck a parent, its
// whole subtree unchecks with it; Select All flips everything) always acts
// on sets of ids in one state update, never a per-id loop of renders.
const FilterContext = createContext(null);

export function FilterProvider({ children }) {
  const [excludedIds, setExcludedIds] = useState([]);

  const excludeMany = useCallback((ids) => {
    setExcludedIds((prev) => [...new Set([...prev, ...ids])]);
  }, []);

  const includeMany = useCallback((ids) => {
    setExcludedIds((prev) => {
      const drop = new Set(ids);
      return prev.filter((id) => !drop.has(id));
    });
  }, []);

  const value = useMemo(() => ({ excludedIds, excludeMany, includeMany }), [excludedIds, excludeMany, includeMany]);

  return <FilterContext.Provider value={value}>{children}</FilterContext.Provider>;
}

export function useFilter() {
  const ctx = useContext(FilterContext);
  if (!ctx) throw new Error("useFilter must be used within a FilterProvider");
  return ctx;
}
