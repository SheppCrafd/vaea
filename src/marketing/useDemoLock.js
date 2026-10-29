import { useEffect } from "react";

// Marketing demos are the real app components with sample data. Visitors can
// use them (hover, switch a folder, scroll, move the notes map), but can't
// change the data: text fields are read-only and editable titles aren't
// editable. Buttons that would change something are wired to do nothing by
// each demo.
//
// Demos also stay out of the Tab order: they're samples, and a keyboard user
// shouldn't have to tab through dozens of sample buttons to reach the page.
// They stay aria-hidden for the same reason.
//
// Applied to everything inside `ref`, and again whenever the demo renders new
// content (lazy-loaded parts, a typed message, a re-dropped board).
// Scroll areas count too: Chrome makes a scrollable box a Tab stop.
const FOCUSABLE = "a[href], button, input, textarea, select, [tabindex], [contenteditable], [class*='overflow-auto'], [class*='overflow-x-auto'], [class*='overflow-y-auto'], [class*='overflow-scroll']";

// Writes only what differs: setting an attribute to its current value still
// notifies the observer below, which would loop forever.
function lock(root) {
  for (const el of root.querySelectorAll(FOCUSABLE)) {
    if (el.getAttribute("tabindex") !== "-1") el.setAttribute("tabindex", "-1");
    if (el.hasAttribute("contenteditable") && el.getAttribute("contenteditable") !== "false") el.setAttribute("contenteditable", "false");
    if ((el.tagName === "INPUT" || el.tagName === "TEXTAREA") && !el.readOnly) el.readOnly = true;
  }
}

export function useDemoLock(ref) {
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    lock(root);
    if (typeof MutationObserver === "undefined") return;
    const mo = new MutationObserver(() => lock(root));
    mo.observe(root, { childList: true, subtree: true, attributes: true, attributeFilter: ["contenteditable", "tabindex"] });
    return () => mo.disconnect();
  }, [ref]);
}
