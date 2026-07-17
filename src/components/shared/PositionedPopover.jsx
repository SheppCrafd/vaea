import Portal from "@/lib/Portal";

// Shared Portal + full-screen-overlay + positioned-panel shell for every
// trigger-button-driven floating menu (StakeholderAssigner, ProductAssigner,
// ColumnFilterMenu, TaskAttachments, StatusDropdown, ProjectCard's links
// popover, ...). Pairs with usePositionedMenu's `{ isOpen, coords, close }` —
// exists purely so that same handful of lines (Portal, full-screen click-away
// overlay, fixed-positioned panel) isn't hand-copied into every menu.
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
  if (!isOpen) return null;

  return (
    <Portal>
      <div className={overlayClassName} onClick={close}>
        <div
          className={panelClassName}
          style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </Portal>
  );
}
