import { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

// Real account-creation flow, alongside LoginScreen.jsx's sign-in-only one —
// previously the marketing site's "Sign up" button just pointed at /login,
// which has no way to create an account (loginViaEmailPassword requires one
// to already exist). base44's own auth module supports the full flow
// (auth.js): register() creates the account and emails a one-time code,
// verifyOtp() confirms it, then loginViaEmailPassword() actually signs the
// now-verified user in and sets the token — verifyOtp's response does not
// itself carry a usable session despite its own SDK docstring, matching the
// exact three-call sequence in that docstring's own example. OAuth
// (Google/Microsoft/Apple) skips all of this — base44 creates the account on
// first login automatically — so those buttons behave identically to
// LoginScreen's.
const PROVIDERS = [
  { key: "google", label: "Continue with Google" },
  { key: "microsoft", label: "Continue with Microsoft" },
  { key: "apple", label: "Continue with Apple" },
];

export default function SignUpScreen() {
  const [step, setStep] = useState("details"); // "details" | "verify"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [resent, setResent] = useState(false);
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
      setError("Couldn't start sign-up — try again in a moment.");
    }
  };

  const handleRegister = async (e) => {
    e.preventDefault();
    setError("");
    if (password !== confirmPassword) {
      setError("Passwords don't match.");
      return;
    }
    setSubmitting(true);
    try {
      await base44.auth.register({ email, password });
      setStep("verify");
    } catch (err) {
      setError(err.response?.data?.error || err.message || "Couldn't create your account — try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setError("");
    setSubmitting(true);
    try {
      await base44.auth.verifyOtp({ email, otpCode });
      // verifyOtp confirms the code but doesn't itself set a session token —
      // sign in for real right after, same as base44's own documented flow.
      await base44.auth.loginViaEmailPassword(email, password);
      window.location.href = returnTo;
    } catch (err) {
      setError(err.response?.data?.error || err.message || "That code didn't work — check it and try again.");
      setSubmitting(false);
    }
  };

  const handleResend = async () => {
    setError("");
    setResent(false);
    try {
      await base44.auth.resendOtp(email);
      setResent(true);
    } catch {
      setError("Couldn't resend the code — try again in a moment.");
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background px-4 py-16">
      <div className="max-w-sm w-full space-y-5">
        <div className="text-center space-y-3">
          <div className="w-16 h-16 mx-auto rounded-full border border-border shadow-sm overflow-hidden">
            <img src="/android-chrome-512x512.png" alt="" className="w-full h-full object-cover" />
          </div>
          <div className="space-y-1">
            <p className="text-sm font-medium">
              {step === "details" ? "Create your Vaea account" : "Check your email"}
            </p>
            <p className="text-xs text-muted-foreground">
              {step === "details"
                ? "Your workspace data stays on this device either way — signing up unlocks Vaea Chat."
                : `We sent a code to ${email}.`}
            </p>
          </div>
        </div>

        {step === "details" && (
          <>
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

            <form onSubmit={handleRegister} className="flex flex-col gap-2">
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
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
              <input
                type="password"
                required
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm password"
                className="text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
              <button
                type="submit"
                disabled={submitting}
                className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors disabled:opacity-50"
              >
                {submitting ? "Creating account…" : "Create account"}
              </button>
            </form>
          </>
        )}

        {step === "verify" && (
          <form onSubmit={handleVerify} className="flex flex-col gap-2">
            <input
              type="text"
              inputMode="numeric"
              required
              autoFocus
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value)}
              placeholder="Verification code"
              className="text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all text-center tracking-widest"
            />
            <button
              type="submit"
              disabled={submitting}
              className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors disabled:opacity-50"
            >
              {submitting ? "Verifying…" : "Verify & continue"}
            </button>
            <button
              type="button"
              onClick={handleResend}
              className="text-xs text-muted-foreground hover:text-foreground underline transition-colors self-center mt-1"
            >
              {resent ? "Code resent — check your email" : "Resend code"}
            </button>
          </form>
        )}

        {error && <p className="text-xs text-destructive text-center">{error}</p>}

        <div className="pt-3 border-t border-border text-center space-y-1">
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
          Already have an account?{" "}
          <Link to={`/login${searchParams.get("from") ? `?from=${searchParams.get("from")}` : ""}`} className="underline hover:text-foreground transition-colors">
            Sign in
          </Link>
          {" · "}
          <Link to="/" className="underline hover:text-foreground transition-colors">Back to home</Link>
        </p>
      </div>
    </div>
  );
}
