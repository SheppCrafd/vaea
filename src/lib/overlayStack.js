// A modal and a popover each listen for Escape independently, on
// `document`, with no parent/child relationship between the listeners
// (they're not nested DOM event handlers — Portal renders both straight
// onto document.body). Without this, opening a popover (e.g.
// StakeholderAssigner) from inside a modal (e.g. ProjectDetailModal) and
// pressing Escape once closes BOTH at the same time, since both handlers
// fire for the same keydown — not the standard "Escape closes only the
// thing on top" behavior every user expects from nested overlays.
//
// This is a plain module-level stack (not React state — nothing here ever
// needs to trigger a re-render, it's purely "who gets first refusal on the
// next Escape"), in open order. useDialogA11y and usePositionedMenu each
// push their own id when they open and pop it on close; their Escape
// handlers only act if they're currently on top.
let stack = [];

// Mirrors "is any overlay open" onto <body data-overlay="open"> so plain CSS
// can react — the floating chat button hides under it on a phone, where it
// otherwise sits on top of a modal's footer buttons (ChatLauncherButton).
function syncBodyFlag() {
  if (typeof document === "undefined") return;
  if (stack.length) document.body.dataset.overlay = "open";
  else delete document.body.dataset.overlay;
}

export function pushOverlay(id) {
  stack.push(id);
  syncBodyFlag();
}

export function popOverlay(id) {
  stack = stack.filter((x) => x !== id);
  syncBodyFlag();
}

export function isTopOverlay(id) {
  return stack.length > 0 && stack[stack.length - 1] === id;
}
