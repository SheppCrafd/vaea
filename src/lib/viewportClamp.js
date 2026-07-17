const DEFAULT_MARGIN = 8;

// Shared by every floating menu/panel in the app (PositionedPopover,
// ChatCommandMenu, ChatSessionList) — clamps a fixed-position box so it
// always stays fully within the viewport, leaving a small margin, instead
// of letting a popover near a screen edge render partially or fully
// off-page.
export function clampPositionToViewport({ top, left, width = 0, height = 0, margin = DEFAULT_MARGIN }) {
  const maxLeft = Math.max(margin, window.innerWidth - width - margin);
  const maxTop = Math.max(margin, window.innerHeight - height - margin);
  return {
    top: Math.min(Math.max(top, margin), maxTop),
    left: Math.min(Math.max(left, margin), maxLeft),
  };
}
