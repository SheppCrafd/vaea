import { useState, useRef, useEffect } from "react";

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

  const open = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setCoords({ top: rect.bottom + 4, left: rect.left });
    }
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

  // `coords` is a one-time snapshot of the trigger's position taken at
  // open() time — nothing re-measures it afterward. A window resize (or a
  // devtools panel/browser chrome toggle, or an OS-level display change)
  // moves the trigger but leaves `coords` pointing at the old pixel
  // position, so the menu visibly detaches from its trigger — sometimes
  // clear across the page — instead of closing or re-anchoring. Closing on
  // resize (unconditionally, unlike the opt-in `closeOnScroll`) is simplest
  // and matches how every consumer already handles "the anchor point is no
  // longer valid".
  useEffect(() => {
    if (!isOpen) return;
    window.addEventListener("resize", close);
    return () => window.removeEventListener("resize", close);
  }, [isOpen]);

  return { isOpen, coords, triggerRef, open, close, toggle };
}
