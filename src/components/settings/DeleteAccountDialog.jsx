import { useState } from "react";
import { X } from "lucide-react";
import Portal from "@/lib/Portal";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/AuthContext";
import { base44 } from "@/api/base44Client";
import { useToast } from "@/components/ui/use-toast";

const CONFIRM_PHRASE = "DELETE";

// Best-effort account deletion — the Base44 SDK has no endpoint (even
// service-role) to remove the underlying login credential itself, so this
// disables the User record and clears the profile via the deactivateAccount
// backend function, then logs out client-side. Deliberately doesn't touch
// Projects/Tasks/Areas/Products — those are shared team data, not personal
// data, and must not disappear as a side effect of one person's account.
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
        description: error.message || "Something went wrong. Please try again.",
      });
    }
  };

  return (
    <Portal>
      <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50" onClick={onClose}>
        <div className="bg-card rounded-xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-heading font-semibold">Delete account</h3>
            <button onClick={onClose} aria-label="Close"><X className="w-4 h-4" /></button>
          </div>

          <div className="space-y-2 text-xs text-muted-foreground mb-4">
            <p>This disables your account, signs you out, and clears your profile name and photo.</p>
            <p>Your team's projects, tasks, and other shared data are <span className="font-medium text-foreground">not</span> affected or deleted.</p>
            <p>This doesn't remove your login from Base44 entirely — contact Base44 support for that.</p>
          </div>

          <label className="text-xs font-medium block mb-1">
            Type <span className="font-mono font-bold text-foreground">DELETE</span> to confirm
          </label>
          <input
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoFocus
            className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md mb-4"
          />

          <Button variant="destructive" className="w-full" disabled={!canDelete || isDeleting} onClick={handleDelete}>
            {isDeleting ? "Deleting..." : "Permanently delete account"}
          </Button>
        </div>
      </div>
    </Portal>
  );
}
