import { useState, useRef, useEffect, useCallback } from "react";

// Shared mechanics for a trigger-button-driven floating menu: tracks
// open/closed state and computes fixed { top, left } coordinates from the
// trigger's bounding rect so the menu can render in a Portal without being
// clipped by a scrolling/overflow container.
//
// Rendering is left to the caller — the usual pattern is:
//   <Portal>
//     <div className="fixed inset-0 z-[60]" onClick={close}>
//       <div style={{ top: coords.top, left: coords.left }} onClick={(e) => e.stopPropagation()}>
//         ...menu content...
//       </div>
//     </div>
//   </Portal>
// The full-screen overlay's onClick doubles as the "close on outside click" handler.
export function usePositionedMenu({ closeOnScroll = false } = {}) {
  const [isOpen, setIsOpen] = useState(false);
  const [coords, setCoords] = useState({ top: 0, left: 0 });
  const triggerRef = useRef(null);

  // Reads the trigger's *current* on-screen position. Called both on open
  // and (below) on resize, so `coords` is always a live measurement of
  // where the trigger actually is right now, never a one-time snapshot that
  // can go stale.
  const measure = useCallback(() => {
    if (!triggerRef.current) return;
    const rect = triggerRef.current.getBoundingClientRect();
    setCoords({ top: rect.bottom + 4, left: rect.left });
  }, []);

  const open = () => {
    measure();
    setIsOpen(true);
  };

  const close = () => setIsOpen(false);
  const toggle = () => (isOpen ? close() : open());

  useEffect(() => {
    if (!isOpen || !closeOnScroll) return;
    const handleScroll = () => close();
    // Capture phase so a scroll on any internal container closes the menu too.
    window.addEventListener("scroll", handleScroll, true);
    return () => window.removeEventListener("scroll", handleScroll, true);
  }, [isOpen, closeOnScroll]);

  // A window resize moves the trigger, but the trigger itself is still
  // right there, still valid — there's a real correct position to
  // recompute, so re-measure it instead of abandoning the menu. This is the
  // same "re-measure the live position, don't just bail" approach
  // useWindowGeometry already uses to keep the chat panel on-screen across
  // a resize (`clampToViewport` there, `measure` here) rather than closing
  // it. Closing on resize was a workable stopgap but throws away a state
  // (the open menu) that a live re-anchor can just keep working.
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [isOpen, measure]);

  return { isOpen, coords, triggerRef, open, close, toggle };
}
