import { useState } from "react";
import { X } from "lucide-react";
import Modal from "@/components/shared/Modal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const CONFIRM_PHRASE = "DELETE";

// Account deletion: the deactivateAccount function deletes this person's
// chat history and any board kept in cloud storage, then disables the
// account (the hosting platform has no API to remove the login itself).
// A board saved in a folder on this device is the person's own file and
// isn't touched; the dialog says so.
export default function DeleteAccountDialog({ onClose }) {
  const { logout } = useAuth();
  const { toast } = useToast();
  const [confirmText, setConfirmText] = useState("");
  const [isDeleting, setIsDeleting] = useState(false);

  const canDelete = confirmText === CONFIRM_PHRASE;

  const handleDelete = async () => {
    if (!canDelete) return;
    setIsDeleting(true);
    try {
      const res = await base44.functions.invoke("deactivateAccount", {});
      if (res.data?.error) throw new Error(res.data.error);
      logout();
    } catch (error) {
      setIsDeleting(false);
      toast({
        variant: "destructive",
        title: "Couldn't delete account",
        description: error.message || "Your account is unchanged. Try again in a moment.",
      });
    }
  };

  return (
    <Modal isOpen onClose={onClose} label="Delete account" panelClassName="bg-card rounded-xl shadow-xl w-full max-w-sm p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-heading font-semibold">Delete account</h3>
        <button onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
      </div>

      <div className="space-y-2 text-xs text-muted-foreground mb-4">
        <p>This deletes your chat history and any board saved in cloud storage, then signs you out. It can't be undone.</p>
        <p>A board saved in a folder on this device stays there. Delete the folder yourself if you want it gone too.</p>
        <p>Your sign-in email stays on record with our hosting provider. To have it removed as well, contact us from the About page.</p>
      </div>

      <label htmlFor="delete-confirm" className="text-xs font-medium block mb-1">
        Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm
      </label>
      <Input
        id="delete-confirm"
        value={confirmText}
        onChange={(e) => setConfirmText(e.target.value)}
        autoFocus
        className="bg-background mb-4"
      />

      <Button variant="destructive" className="w-full" disabled={!canDelete || isDeleting} onClick={handleDelete}>
        {isDeleting ? "Deleting…" : "Delete my account"}
      </Button>
    </Modal>
  );
}
