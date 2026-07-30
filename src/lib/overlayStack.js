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

export function pushOverlay(id) {
  stack.push(id);
}

export function popOverlay(id) {
  stack = stack.filter((x) => x !== id);
}

export function isTopOverlay(id) {
  return stack.length > 0 && stack[stack.length - 1] === id;
}
