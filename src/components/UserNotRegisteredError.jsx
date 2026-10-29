import { useAuth } from "@/lib/AuthContext";

// Shown when someone signs in with an account this Vaea app doesn't know.
// Vaea works without an account (only Vaea Chat needs one), so the two real
// ways forward are offered as buttons rather than described.
const UserNotRegisteredError = () => {
  const { logout, continueAsGuest } = useAuth();

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background px-4">
      <div className="max-w-md w-full p-8 bg-card rounded-xl shadow-sm border border-border text-center">
        <h1 className="font-heading text-2xl font-semibold text-foreground mb-3">
          This account can't sign in to Vaea
        </h1>
        <p className="text-muted-foreground mb-6">
          It isn't set up for this Vaea app. Try a different account, or keep using Vaea without
          signing in — everything except Vaea Chat works the same.
        </p>
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => logout()}
            className="w-full px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:bg-primary/90 transition-colors"
          >
            Sign in with a different account
          </button>
          <button
            type="button"
            onClick={continueAsGuest}
            className="w-full px-4 py-2 rounded-md border border-border text-sm font-medium hover:bg-accent transition-colors"
          >
            Continue without signing in
          </button>
        </div>
      </div>
    </div>
  );
};

export default UserNotRegisteredError;
