import { useEffect, useState } from "react";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

// Centralizes the bit of state every date input in the app needs: an ISO
// ("YYYY-MM-DD") string synced from an external value, a debounced save so
// typing/picking doesn't fire a mutation per keystroke, and a shared
// human-readable format for displaying that same value elsewhere (mirrors
// the formatting `projectUtils.formatDueDate` used to duplicate locally).
export function useDateSelector(value, onSave, { debounceMs = 400 } = {}) {
  const [date, setDate] = useState(value || "");

  useEffect(() => setDate(value || ""), [value]);

  const debouncedSave = useDebouncedCallback((v) => {
    if (v !== (value || "")) onSave(v || null);
  }, debounceMs);

  const handleChange = (e) => {
    const v = e.target.value;
    setDate(v);
    debouncedSave(v);
  };

  const displayValue = date
    ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Not set";

  return { date, displayValue, handleChange };
}
