import { useState, useEffect } from "react";

// Generic click-to-edit field — reused across Area/Product/Project/Task text
// fields so every "dead" text block on the page becomes editable. Saves on
// blur or Enter (not on every keystroke) so typing never fires a mutation
// per character.
export default function EditableText({ value, onSave, placeholder = "—", className = "", multiline = false }) {
  const [text, setText] = useState(value || "");

  useEffect(() => setText(value || ""), [value]);

  const commit = () => {
    if (text !== (value || "")) onSave(text);
  };

  const handleChange = (e) => setText(e.target.value);

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !multiline) {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      setText(value || "");
      e.currentTarget.blur();
    }
  };

  const Tag = multiline ? "textarea" : "input";

  return (
    <Tag
      value={text}
      onChange={handleChange}
      onBlur={commit}
      onKeyDown={handleKeyDown}
      placeholder={placeholder}
      rows={multiline ? 2 : undefined}
      className={`bg-transparent outline-none focus:ring-1 focus:ring-primary/40 rounded w-full min-w-0 break-words ${multiline ? "resize-none" : ""} ${className}`}
    />
  );
}