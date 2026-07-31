import { X } from "lucide-react";
import Modal from "@/components/shared/Modal";

// Mobile-only slide-in panel for a page's sidebar content — same
// Portal+focus-trap+Escape+backdrop behavior every modal/popover in the app
// already gets from Modal.jsx/useDialogA11y, just with drawer-shaped
// classNames instead of a centered card. Callers own isOpen/onClose (a
// page-local, non-persisted useState) — deliberately NOT the same
// localStorage-backed boolean the desktop docked panel uses, so a mobile
// visit never force-opens a full-screen drawer just because a previous
// desktop session left that sidebar open. Same bg-sidebar/text-sidebar-
// foreground token pair as the desktop docked panels (AppShell.jsx,
// ChatPage.jsx, SettingsPage.jsx all use it) — this is the same panel,
// just rendered as an overlay instead of a grid/flex column.
//
// z-[120], not Modal's usual z-50 default: AppShell's floating chat launcher/
// ChatBox sit at z-[110] in that exact bottom-right corner, which a `side=
// "right"` drawer (Focus & Stats) would otherwise render underneath — an
// open drawer should read as the topmost thing on screen, same as any other
// modal, not float behind a corner widget.
//
// AppShell's Stakeholders drawer wraps LeftSidebar, whose entries are real
// dnd-kit drag sources (dragged out onto a card in the main content area).
// That's not a supported interaction here on purpose, not an oversight: the
// backdrop dims (and a release over it counts as a backdrop-click-to-close)
// everything outside the drawer's own ~320px width, so there's nothing
// reliable to drag onto on a phone-width screen. StakeholderAssigner's
// tap-based "+" menu (already used elsewhere — ProductCard, TaskForm,
// ProjectForm, the detail modals) is the real mobile path for assigning a
// stakeholder; drag-and-drop stays a desktop-only affordance.
export default function MobileSidebarDrawer({ isOpen, onClose, label, side = "left", children }) {
  const isLeft = side === "left";
  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      label={label}
      overlayClassName="fixed inset-0 bg-black/40 z-[120]"
      panelClassName={`fixed inset-y-0 ${isLeft ? "left-0 rounded-r-2xl animate-in slide-in-from-left" : "right-0 rounded-l-2xl animate-in slide-in-from-right"} duration-200 w-[85vw] max-w-xs bg-sidebar text-sidebar-foreground shadow-2xl flex flex-col overflow-hidden outline-none`}
    >
      <div className={`h-14 shrink-0 flex items-center justify-between ${isLeft ? "pl-4 pr-3" : "pl-3 pr-4"}`}>
        {isLeft ? (
          <>
            <p className="text-sm font-semibold truncate">{label}</p>
            <button onClick={onClose} aria-label={`Close ${label} panel`} className="text-muted-foreground hover:text-foreground hover:bg-accent p-2.5 -m-1 rounded-md transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
          </>
        ) : (
          <>
            <button onClick={onClose} aria-label={`Close ${label} panel`} className="text-muted-foreground hover:text-foreground hover:bg-accent p-2.5 -m-1 rounded-md transition-colors shrink-0">
              <X className="w-4 h-4" />
            </button>
            <p className="text-sm font-semibold truncate">{label}</p>
          </>
        )}
      </div>
      {/* No forced padding/scroll here — desktop docked panels don't all
          share one shape (AppShell's sidebars are a single padded scroll
          region; ChatPage's is a pinned "New chat" button plus a separately
          scrolling list; SettingsPage's is just a nav list). Each caller
          reproduces its own desktop structure inside children instead. */}
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        {children}
      </div>
    </Modal>
  );
}
