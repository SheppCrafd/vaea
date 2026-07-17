import { useEffect, useState } from "react";

// Centralizes the bit of state every date input in the app needs: an ISO
// ("YYYY-MM-DD") string synced from an external value, a save-on-blur-or-Enter
// commit (matching EditableText/useEditableField — no per-keystroke or
// per-pick mutation), and a shared human-readable format for displaying that
// same value elsewhere (mirrors the formatting `projectUtils.formatDueDate`
// used to duplicate locally).
export function useDateSelector(value, onSave) {
  const [date, setDate] = useState(value || "");

  useEffect(() => setDate(value || ""), [value]);

  const commit = () => {
    if (date !== (value || "")) onSave(date || null);
  };

  const handleChange = (e) => setDate(e.target.value);

  const handleBlur = () => commit();

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      setDate(value || "");
      e.currentTarget.blur();
    }
  };

  const displayValue = date
    ? new Date(date).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })
    : "Not set";

  return { date, displayValue, handleChange, handleBlur, handleKeyDown };
}
