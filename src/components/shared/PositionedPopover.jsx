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
  // after mount. Both effects are layout effects (synchronous, pre-paint),
  // so the corrected position is what actually gets painted, never a
  // visible jump from an off-screen starting spot.
  useLayoutEffect(() => {
    if (isOpen) setPosition(coords);
  }, [isOpen, coords]);

  useLayoutEffect(() => {
    if (!isOpen || !panelRef.current) return;
    const rect = panelRef.current.getBoundingClientRect();
    const clamped = clampPositionToViewport({ top: position.top, left: position.left, width: rect.width, height: rect.height });
    if (clamped.top !== position.top || clamped.left !== position.left) {
      setPosition(clamped);
    }
  }, [isOpen, position]);

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
