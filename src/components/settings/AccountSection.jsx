import { useState } from "react";
import { LogOut, LogIn, AlertTriangle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/AuthContext";
import { Button } from "@/components/ui/button";
import Avatar from "@/components/shared/Avatar";
import DeleteAccountDialog from "@/components/settings/DeleteAccountDialog";

export default function AccountSection() {
  const { user, isAuthenticated, logout, navigateToLogin } = useAuth();
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Same shape as Zmanim Today's Settings.jsx handleLogout: a loading state
  // set right before the call, since base44.auth.logout()'s redirect can
  // take a moment to actually navigate away.
  const handleLogout = async () => {
    setLoggingOut(true);
    await logout();
  };

  // The dashboard itself works fully signed-out (all data is local — see
  // AuthContext.jsx) so this used to render as if `user` were always
  // populated: "Unnamed user" plus a Log out / Delete account danger zone
  // that had nothing real to act on. Only chat actually needs sign-in.
  if (!isAuthenticated) {
    return (
      <div className="bg-card border border-border rounded-xl p-6">
        <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">Account</p>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-sm font-medium">You're not signed in</p>
            <p className="text-xs text-muted-foreground mt-0.5">Your dashboard data stays on this device either way — signing in only enables the AI chat.</p>
          </div>
          <Button variant="outline" onClick={navigateToLogin} className="gap-2 shrink-0">
            <LogIn className="w-4 h-4" />
            Sign in
          </Button>
        </div>
      </div>
    );
  }

  const displayName = user?.full_name || user?.email || "Unnamed user";

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <p className="text-xs font-medium text-muted-foreground mb-4 uppercase tracking-wider">Account</p>

      <div className="flex items-center justify-between gap-3 pb-6 mb-6 border-b border-border">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={displayName} avatarUrl={user?.avatar_url} />
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{displayName}</p>
            {user?.full_name && <p className="text-xs text-muted-foreground truncate">{user.email}</p>}
          </div>
        </div>
        <Button variant="outline" onClick={handleLogout} disabled={loggingOut} className="gap-2 shrink-0">
          {loggingOut ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
          {loggingOut ? "Logging out…" : "Log out"}
        </Button>
      </div>

      <div className="bg-destructive/5 border border-destructive/15 rounded-lg p-4">
        <p className="flex items-center gap-1.5 text-sm font-medium text-destructive mb-1">
          <AlertTriangle className="w-4 h-4" />
          Danger zone
        </p>
        <p className="text-xs text-muted-foreground mb-3">
          Permanently disable your account. This can't be undone from here.
        </p>
        <Button variant="destructive" size="sm" onClick={() => setIsDeleteOpen(true)}>
          Delete account
        </Button>
      </div>

      {isDeleteOpen && <DeleteAccountDialog onClose={() => setIsDeleteOpen(false)} />}
    </div>
  );
}
