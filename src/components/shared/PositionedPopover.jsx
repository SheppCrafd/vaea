import { useEffect, useLayoutEffect, useRef, useState } from "react";
import Portal from "@/lib/Portal";
import { clampPositionToViewport } from "@/lib/viewportClamp";
import { FOCUSABLE_SELECTOR } from "@/hooks/useDialogA11y";

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

  // Tab-trap + initial focus — Escape and focus-restore-to-trigger already
  // live in usePositionedMenu.js (shared by every caller of this
  // component), since that hook already owns the trigger's own ref; this
  // only needs to own what requires the actual rendered panel content.
  useEffect(() => {
    if (!isOpen) return;
    const raf = requestAnimationFrame(() => {
      const root = panelRef.current;
      if (!root || root.contains(document.activeElement)) return; // an autoFocus field already claimed it
      const first = root.querySelector(FOCUSABLE_SELECTOR);
      (first || root).focus();
    });
    const handleKeyDown = (e) => {
      if (e.key !== "Tab") return;
      const root = panelRef.current;
      if (!root) return;
      const focusables = Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR));
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <Portal>
      <div className={overlayClassName} onClick={close}>
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          tabIndex={-1}
          // Marks the panel subtree so usePositionedMenu's close-on-scroll
          // can tell internal scrolls (this panel's own overflow list, a
          // text input's caret scrolling through overflowing content) from
          // page scrolls that actually de-anchor the trigger.
          data-popover-panel=""
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
