import { useState, useEffect, useRef } from "react";

// Wires up a contentEditable element to a save-on-blur-or-Enter pattern:
// keeps local state in sync with the source value, and fires `onSave` only
// once the user clicks out or hits Enter, not on every keystroke. Pair with
// `<Tag contentEditable suppressContentEditableWarning onInput={handleInput}
// onBlur={handleBlur} onKeyDown={handleKeyDown}>{value}</Tag>`.
export function useEditableField(initialValue, onSave) {
  const [value, setValue] = useState(initialValue);
  const latest = useRef(initialValue);

  useEffect(() => {
    setValue(initialValue);
    latest.current = initialValue;
  }, [initialValue]);

  const handleInput = (e) => {
    latest.current = e.currentTarget.textContent;
    setValue(latest.current);
  };

  const handleBlur = () => {
    if (latest.current !== initialValue) onSave(latest.current);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      latest.current = initialValue;
      setValue(initialValue);
      e.currentTarget.blur();
    }
  };

  return { value, handleInput, handleBlur, handleKeyDown };
}
