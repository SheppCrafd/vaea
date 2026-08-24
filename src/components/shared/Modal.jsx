import { useRef } from "react";
import Portal from "@/lib/Portal";
import { useDialogA11y } from "@/hooks/useDialogA11y";

// Shared centered/full-screen modal shell — Portal + backdrop + the real
// dialog semantics (role, aria-modal, Escape, focus trap, focus restore)
// every hand-rolled modal in this app was missing (each one independently
// reimplemented Portal+backdrop+stopPropagation, but none of them added
// this layer). Callers keep their own exact overlay/panel classNames
// (size, radius, shadow, animation, z-index) passed straight through —
// this only ever owns the behavior layer, never the visual one, so it
// can't drift any of the "luxury" surface treatment already tuned per
// modal.
//
// `closeOnBackdropClick` defaults on for the normal centered-card modals,
// but a couple of callers (ProjectDetailModal, full-screen detail views)
// deliberately never closed on an outside click even before this existed —
// preserved here as an explicit opt-out rather than silently changed.
export default function Modal({
  isOpen,
  onClose,
  panelClassName,
  // p-4: the four callers that never override this (CreateModal, FilterModal,
  // DeleteAccountDialog, AddStakeholderModal) all use a `w-full max-w-*`
  // panel with no gutter of their own — below that max-width (i.e. on any
  // mobile viewport) the panel sat flush against both screen edges. Most
  // other callers already added their own p-4/p-6 to their overlay override;
  // this just gives the ones that don't override at all the same floor.
  overlayClassName = "fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50",
  closeOnBackdropClick = true,
  label,
  children,
}) {
  const panelRef = useRef(null);
  useDialogA11y({ isOpen, onClose, containerRef: panelRef });

  if (!isOpen) return null;

  return (
    <Portal>
      <div
        className={`animate-in fade-in duration-[time:var(--motion-base)] ${overlayClassName}`}
        onClick={closeOnBackdropClick ? onClose : undefined}
      >
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label={label}
          tabIndex={-1}
          className={`animate-in fade-in zoom-in-95 duration-[time:var(--motion-base)] ${panelClassName}`}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
