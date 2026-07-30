import { useEffect, useRef } from "react";
import { pushOverlay, popOverlay, isTopOverlay } from "@/lib/overlayStack";

// Exported since CommandPalette.jsx needs the same set for its own Tab-trap
// logic — it can't use this hook wholesale (its Escape/open handling is
// already global and provider-specific: Ctrl/Cmd+K toggling, "/" opening),
// but shouldn't hand-roll a second copy of "what counts as focusable" either.
export const FOCUSABLE_SELECTOR =
  'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Shared keyboard/focus behavior for any full-screen overlay that behaves
// modally — a centered form modal, a full-screen detail view, or a
// positioned popover with its own click-away backdrop. None of this app's
// hand-rolled modals/popovers had it: Escape closes the overlay, Tab is
// trapped inside its content while open (so keyboard focus can't wander
// into the dimmed page behind it), and focus returns to whatever element
// opened it once it closes — the same behavior a native <dialog> gives you
// for free, reimplemented once here instead of missing from every caller.
//
// `containerRef` must point at the actual overlay content (the panel a
// screen reader/keyboard user should be scoped to), not the full-screen
// backdrop div — Modal.jsx and PositionedPopover.jsx both put it on their
// own inner panel.
export function useDialogA11y({ isOpen, onClose, containerRef }) {
  const triggerRef = useRef(null);
  const wasOpenRef = useRef(false);
  const idRef = useRef(null);
  if (idRef.current === null) idRef.current = Symbol("dialog");

  // Captured during render, deliberately NOT inside the effect below. A
  // form modal's own content often has a real autoFocus input (TaskForm,
  // AddStakeholderModal, ...), and React applies autoFocus during its
  // mutation commit phase — strictly before ANY effect (layout or passive)
  // runs. By the time a useEffect here could read document.activeElement,
  // that autoFocus input would already have stolen it, so this hook would
  // "restore focus" back to a field inside the dialog instead of the real
  // trigger that opened it. Render happens before that commit, so the
  // previous commit's real focus (the trigger button) is still active
  // here. This is a read, not a write, so doing it outside an effect has
  // no consistency cost despite the general "keep render pure" guidance.
  if (isOpen && !wasOpenRef.current) {
    triggerRef.current = document.activeElement;
  }
  wasOpenRef.current = isOpen;

  useEffect(() => {
    if (!isOpen) return;

    // Registers this dialog as the topmost overlay so Escape only closes
    // it, not some other modal/popover that happens to also be open
    // underneath (see overlayStack.js) — a popover opened from inside this
    // dialog, e.g. StakeholderAssigner inside ProjectDetailModal, pushes
    // its own id after this one and correctly takes priority.
    const id = idRef.current;
    pushOverlay(id);

    // Portal content mounts after this effect's own render pass (same
    // reasoning CommandPalette's pre-existing focus effect already
    // documents) — deferring a tick keeps focus from landing before the
    // panel exists in the DOM.
    const raf = requestAnimationFrame(() => {
      const root = containerRef.current;
      if (!root || root.contains(document.activeElement)) return; // an autoFocus input already claimed it
      const first = root.querySelector(FOCUSABLE_SELECTOR);
      (first || root).focus();
    });

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        if (!isTopOverlay(id)) return; // a nested overlay is on top; let its own handler take this
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab") return;
      const root = containerRef.current;
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
      popOverlay(id);
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", handleKeyDown);
      // Return focus to whatever opened this — nothing here had that
      // before; every modal/popover just left focus wherever the DOM
      // removal happened to drop it (usually document.body).
      triggerRef.current?.focus?.();
    };
  }, [isOpen, onClose, containerRef]);
}
