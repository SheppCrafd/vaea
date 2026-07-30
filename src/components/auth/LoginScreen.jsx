import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import AuthAmbience from "@/components/auth/AuthAmbience";

// Rendered at the real, linkable /login route (src/pages/marketing/LoginPage.jsx)
// — replaces the old auto-redirect-to-Base44's-hosted-/login flow. That page
// route only gets a real hosted login form for apps built through Base44's
// own builder UI; Vaea is a custom Vite build deployed via `site deploy`, so
// `/login` just reloads this SPA instead, which redirected again, forever
// (see Decisions/Vaea - Full-App Login Gate Restored.md in the vault). These
// provider/email calls hit real Base44 API routes instead
// (/api/apps/auth/.../login), which work regardless of how the app is
// hosted. `?from=` carries the originally-requested path when
// AuthenticatedApp redirects here for an unauthenticated deep link (App.jsx)
// — falls back to /app (the dashboard) when reached directly, e.g. from the
// marketing nav's own "Log in" button.
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
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { continueAsGuest } = useAuth();

  const returnTo = searchParams.get("from") || "/app";

  const handleSkip = () => {
    continueAsGuest();
    navigate(returnTo);
  };

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
      // A full navigation to returnTo re-evaluates everything from the
      // now-persisted token, the same way returning from an OAuth redirect
      // already does — window.location.href (not react-router's navigate)
      // specifically because that fresh evaluation needs a real reload.
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Couldn't sign in — check your email and password.");
      setSubmitting(false);
    }
  };

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <AuthAmbience />
      <div className="relative max-w-sm w-full rounded-[1.75rem] bg-card/75 backdrop-blur-xl p-8 space-y-5 shadow-[0_0_0_1px_hsl(var(--foreground)/0.05),inset_0_1px_0_0_hsl(var(--card)),0_32px_64px_-32px_hsl(200_30%_12%/0.35)] dark:shadow-[0_0_0_1px_hsl(var(--foreground)/0.10),inset_0_1px_0_0_hsl(var(--card)),0_0_60px_-10px_hsl(var(--foreground)/0.12)]">
        <div className="text-center space-y-3">
          {/* Placeholder mark until there's a real logo — swap the src below when there is one.
              The source PNG has its own white background baked in (not transparent) — shown at
              its natural resolution/proportions, just clipped to a circle by overflow-hidden. */}
          <div className="w-16 h-16 mx-auto rounded-full overflow-hidden shadow-[0_0_0_1px_hsl(var(--foreground)/0.06),0_10px_28px_-10px_rgba(70,186,209,0.4)]">
            <img src="/android-chrome-512x512.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">Sign in to Vaea</p>
            <p className="text-xs text-muted-foreground">
              Your workspace data stays on this device either way — signing in unlocks Vaea Chat.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-2">
          {PROVIDERS.map(({ key, label }) => (
            <button
              key={key}
              type="button"
              onClick={() => handleProvider(key)}
              className="text-sm px-4 py-2.5 rounded-xl bg-secondary/60 hover:bg-secondary text-foreground shadow-[inset_0_1px_3px_0_rgba(255,255,255,0.5)] transition-colors"
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex-1 h-px bg-gradient-to-r from-transparent to-foreground/15" />
          <span className="text-[11px] text-muted-foreground">or</span>
          <div className="flex-1 h-px bg-gradient-to-l from-transparent to-foreground/15" />
        </div>

        <form onSubmit={handleEmailLogin} className="flex flex-col gap-2">
          <input
            type="email"
            required
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            aria-label="Email"
            className="text-sm px-3.5 py-2.5 bg-muted/60 rounded-xl outline-none focus:bg-card focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/70"
          />
          <input
            type="password"
            required
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            aria-label="Password"
            className="text-sm px-3.5 py-2.5 bg-muted/60 rounded-xl outline-none focus:bg-card focus:ring-2 focus:ring-primary/30 transition-all placeholder:text-muted-foreground/70"
          />
          <button
            type="submit"
            disabled={submitting}
            className="mt-1 text-sm px-4 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-full transition-all shadow-[0_10px_24px_-10px_hsl(var(--primary)/0.6)] hover:-translate-y-0.5 disabled:opacity-50 disabled:hover:translate-y-0"
          >
            {submitting ? "Signing in…" : "Sign in with email"}
          </button>
        </form>

        {error && <p className="text-xs text-destructive text-center">{error}</p>}

        <div className="pt-4 [background:linear-gradient(to_right,transparent,hsl(var(--foreground)/0.12),transparent)_top/100%_1px_no-repeat] text-center space-y-1">
          <button
            type="button"
            onClick={handleSkip}
            className="text-xs text-muted-foreground hover:text-foreground underline transition-colors"
          >
            Continue without signing in
          </button>
          <p className="text-[11px] text-muted-foreground/80">
            You won't be able to use Vaea Chat until you sign in — everything else works either way.
          </p>
        </div>

        <p className="text-center text-xs text-muted-foreground">
          New here?{" "}
          <Link to={`/signup${searchParams.get("from") ? `?from=${searchParams.get("from")}` : ""}`} className="underline hover:text-foreground transition-colors">
            Create an account
          </Link>
          {" · "}
          <Link to="/" className="underline hover:text-foreground transition-colors">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
