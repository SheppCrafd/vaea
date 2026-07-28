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

  // Ref only — no setState per keystroke. Re-rendering the contentEditable's
  // text child mid-edit makes React replace the text node, which snaps the
  // caret back to position 0, so every following character lands at the
  // front and typed text comes out reversed. While the field is focused the
  // DOM is the source of truth; state only catches up on blur.
  const handleInput = (e) => {
    latest.current = e.currentTarget.textContent;
  };

  const handleBlur = () => {
    if (latest.current !== initialValue) onSave(latest.current);
    setValue(latest.current);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.currentTarget.blur();
    }
    if (e.key === "Escape") {
      latest.current = initialValue;
      setValue(initialValue);
      // React's vDOM never saw the typed text (handleInput doesn't set
      // state), so a state update alone can't repaint the revert — the DOM
      // has to be written back directly.
      e.currentTarget.textContent = initialValue;
      e.currentTarget.blur();
    }
  };

  return { value, handleInput, handleBlur, handleKeyDown };
}
