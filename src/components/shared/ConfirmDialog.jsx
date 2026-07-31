import { useAppStore } from "@/lib/store";
import Modal from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";

// Every confirmThen(message, action) call in the app (entityUtils.js) ends
// up here — mounted once, alongside Toaster/CommandPalette in App.jsx — so
// every delete/switch/restore confirmation in the app gets the same real,
// styled dialog instead of the native window.confirm() they all used
// before. The button label is derived from the message's own leading verb
// (every existing message already reads "Delete area..."/"Switch to cloud
// storage?"/etc., per this app's own active-voice convention) rather than a
// generic "Confirm" — falls back to "Confirm" for the one message that
// doesn't start with a recognized verb ("Are you sure you want to...").
const ACTION_WORDS = ["Delete", "Remove", "Restore", "Archive", "Switch"];

export default function ConfirmDialog() {
  const confirmDialog = useAppStore((s) => s.confirmDialog);
  const closeConfirmDialog = useAppStore((s) => s.closeConfirmDialog);

  if (!confirmDialog) return null;
  const { message, onConfirm } = confirmDialog;

  const leadingWord = message.match(/^(\w+)/)?.[1];
  const label = ACTION_WORDS.includes(leadingWord) ? leadingWord : "Confirm";
  const isDestructive = label === "Delete" || label === "Remove" || message.includes("cannot be undone");

  const handleConfirm = () => {
    onConfirm();
    closeConfirmDialog();
  };

  return (
    <Modal isOpen onClose={closeConfirmDialog} label={label} panelClassName="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
      <p className="text-sm text-foreground leading-relaxed">{message}</p>
      <div className="flex justify-end gap-2 mt-5">
        <Button variant="outline" onClick={closeConfirmDialog}>Cancel</Button>
        <Button variant={isDestructive ? "destructive" : "default"} onClick={handleConfirm}>{label}</Button>
      </div>
    </Modal>
  );
}
