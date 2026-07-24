import { useState } from "react";
import { base44 } from "@/api/base44Client";

// Shown whenever AuthContext reports auth_required — replaces the old
// auto-redirect-to-Base44's-hosted-/login flow. That page route only gets a
// real hosted login form for apps built through Base44's own builder UI;
// Vaea is a custom Vite build deployed via `site deploy`, so `/login` just
// reloads this SPA instead, which redirected again, forever (see
// Decisions/Vaea - Full-App Login Gate Restored.md in the vault). These
// provider/email calls hit real Base44 API routes instead
// (/api/apps/auth/.../login), which work regardless of how the app is
// hosted.
const PROVIDERS = [
  { key: "google", label: "Continue with Google" },
  { key: "microsoft", label: "Continue with Microsoft" },
  { key: "apple", label: "Continue with Apple" },
];

export default function LoginScreen() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const returnTo = window.location.pathname + window.location.search;

  const handleProvider = (provider) => {
    setError("");
    try {
      base44.auth.loginWithProvider(provider, returnTo);
    } catch {
      setError("Couldn't start sign-in — try again in a moment.");
    }
  };

  const handleEmailLogin = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      // loginViaEmailPassword sets the token client-side (axios headers +
      // localStorage) but nothing here re-reads it — appParams.token is a
      // one-time snapshot taken at module load (see app-params.js), and the
      // AuthContext/base44Client singletons were built from that snapshot.
      // A reload re-evaluates everything from the now-persisted token, the
      // same way returning from an OAuth redirect already does.
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.reload();
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Couldn't sign in — check your email and password.");
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-background px-4">
      <div className="max-w-sm w-full space-y-5">
        <div className="text-center space-y-3">
          {/* Placeholder mark until there's a real logo — swap the src below when there is one.
              The source PNG has its own white background baked in (not transparent) — shown at
              its natural resolution/proportions, just clipped to a circle by overflow-hidden. */}
          <div className="w-16 h-16 mx-auto rounded-full border border-border shadow-sm overflow-hidden">
            <img src="/android-chrome-512x512.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Sign in to Vaea</p>
            <p className="text-xs text-muted-foreground">
              Your workspace data stays on this device either way — signing in unlocks the AI chat.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {PROVIDERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleProvider(key)}
              className="text-sm px-4 py-2 border border-input rounded-md hover:bg-accent transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-border" />
          <span className="text-[11px] text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-border" />
        </div>

        <form onSubmit={handleEmailLogin} className="flex flex-col gap-2">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            className="text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
          />
          <button
            type="submit"
            disabled={submitting}
            className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors disabled:opacity-50"
          >
            {submitting ? "Signing in…" : "Sign in with email"}
          </button>
        </form>

        {error && <p className="text-xs text-destructive text-center">{error}</p>}
      </div>
    </div>
  );
}
