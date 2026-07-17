import { useLayoutEffect, useRef, useState } from "react";
import Portal from "@/lib/Portal";
import { clampPositionToViewport } from "@/lib/viewportClamp";

// Shared Portal + full-screen-overlay + positioned-panel shell for every
// trigger-button-driven floating menu (StakeholderAssigner, ProductAssigner,
// ColumnFilterMenu, TaskAttachments, StatusDropdown, ProjectCard's links
// popover, ChatIconPicker, UserMenu, ...). Pairs with usePositionedMenu's
// `{ isOpen, coords, close }` — exists purely so that same handful of lines
// (Portal, full-screen click-away overlay, fixed-positioned panel) isn't
// hand-copied into every menu.
// `panelClassName` always varies per consumer (width, padding, animation);
// `overlayClassName` defaults to the common case and is overridable for the
// rare consumer that needs a different overlay z-index.
export default function PositionedPopover({
  isOpen,
  coords,
  close,
  panelClassName,
  overlayClassName = "fixed inset-0 z-[9999]",
  children,
}) {
  const panelRef = useRef(null);
  const [position, setPosition] = useState(coords);

  // Re-anchor to the trigger's freshly-computed position whenever the menu
  // (re)opens, then immediately measure the panel's actual rendered size and
  // clamp it fully inside the viewport — a popover's width/height isn't
  // knowable until it actually exists in the DOM, so this can only happen
  // after mount. This is a single layout effect (synchronous, pre-paint) so
  // the corrected position is what actually gets painted, never a visible
  // jump from an off-screen starting spot.
  //
  // Deliberately NOT split into two effects (sync-to-coords, then a
  // separate clamp-based-on-position effect): both would run off the same
  // stale `position` closure within one commit, and the clamp effect's
  // setPosition call — computed from the OLD position, not the fresh
  // `coords` — would run second and silently win, discarding the correct
  // anchor. That's exactly how this used to fail: `position` starts at
  // `{top: 0, left: 0}` on mount, so the very first open (or the first open
  // after any remount, e.g. navigating back to a page that recreates this
  // component) would get "clamped" from that stale zero position into a
  // top-left corner instead of the real trigger location.
  useLayoutEffect(() => {
    if (!isOpen) return;
    const rect = panelRef.current?.getBoundingClientRect();
    setPosition(
      rect
        ? clampPositionToViewport({ top: coords.top, left: coords.left, width: rect.width, height: rect.height })
        : coords
    );
  }, [isOpen, coords]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div className={overlayClassName} onClick={close}>
        <div
          ref={panelRef}
          className={panelClassName}
          style={{ top: `${position.top}px`, left: `${position.left}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
