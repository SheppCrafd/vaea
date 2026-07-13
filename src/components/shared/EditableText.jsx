import { useState, useEffect } from "react";
import { useDebouncedCallback } from "@/hooks/useDebouncedCallback";

// Generic debounced click-to-edit field — reused across Area/Product/Project/Task
// text fields so every "dead" text block on the page becomes editable.
export default function EditableText({ value, onSave, placeholder = "—", className = "", multiline = false }) {
  const [text, setText] = useState(value || "");

  useEffect(() => setText(value || ""), [value]);

  const debouncedSave = useDebouncedCallback((v) => {
    if (v !== (value || "")) onSave(v);
  }, 600);

  const handleChange = (e) => {
    const v = e.target.value;
    setText(v);
    debouncedSave(v);
  };

  const Tag = multiline ? "textarea" : "input";

  return (
    <Tag
      value={text}
      onChange={handleChange}
      placeholder={placeholder}
      rows={multiline ? 2 : undefined}
      className={`bg-transparent outline-none focus:ring-1 focus:ring-primary/40 rounded w-full min-w-0 break-words ${className}`}
    />
  );
}