import { X } from "lucide-react";
import Modal from "@/components/shared/Modal";
import ArchiveView from "@/components/archive/ArchiveView";

// Floats the Archive above the rest of the page, per spec, rather than
// navigating to a separate route. Triggered from the lower-left button in
// AppShell.
export default function ArchivePanel({ onClose }) {
  return (
    <Modal
      isOpen
      onClose={onClose}
      label="Archive"
      overlayClassName="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4"
      panelClassName="relative bg-card border border-border rounded-xl shadow-2xl w-full max-w-3xl max-h-[85vh] overflow-y-auto p-6 animate-in fade-in zoom-in-95 duration-200"
    >
      <button
        onClick={onClose}
        className="absolute top-4 right-4 p-2 hover:bg-secondary rounded-full transition-colors"
        aria-label="Close archive"
      >
        <X className="w-5 h-5 text-muted-foreground" />
      </button>
      <ArchiveView />
    </Modal>
  );
}
