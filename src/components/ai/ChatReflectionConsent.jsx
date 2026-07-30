import { useState } from "react";
import { Link } from "react-router-dom";
import { Sparkles } from "lucide-react";
import { useReflectionPreferences, useSaveReflectionPreferences } from "@/hooks/useReflectionPreferences";
import { useVaultConnected } from "@/hooks/useVaultConnected";
import { dismissReflectionConsentThisPageLoad, hasReflectionConsentBeenDismissedThisPageLoad } from "@/lib/reflectionTrigger";

// One-time, explicit opt-in — shown only while consent is still `null`
// (never asked). Modeled on ChatAuthPrompt.jsx's compact bordered banner,
// not a hard modal: undecided consent shouldn't block normal chatting, so
// this sits above the message list rather than replacing the composer.
// Allow/Not now are both real, terminal decisions (persisted as
// consent:true/false); the separate "×" only dismisses for this tab
// session (dismiss isn't a decision — reappears on a fresh reload) so the
// banner doesn't nag every single time chat is opened before the user's
// made up their mind.
export default function ChatReflectionConsent() {
  const { data: prefs } = useReflectionPreferences();
  const savePrefs = useSaveReflectionPreferences();
  const { data: vaultConnected } = useVaultConnected();
  // Local state mirrors the module-level flag so a click actually re-renders
  // this instance — the flag itself lives in reflectionTrigger.js (not here)
  // so it still holds if the banner unmounts/remounts as ChatBox opens and
  // closes within the same tab session.
  const [dismissed, setDismissed] = useState(hasReflectionConsentBeenDismissedThisPageLoad);
  // Only matters if "Allow" is clicked below — "Not now" leaves this at its
  // default (off), same as every other field prefs.consent === false leaves
  // untouched.
  const [userAnalysisOptIn, setUserAnalysisOptIn] = useState(false);

  if (!prefs || prefs.consent !== null || dismissed) return null;

  const decide = (consent) => {
    // Setting lastReflectionAt/lastDreamAt to now on Allow, not leaving them
    // null — opting in shouldn't retroactively summarize all of history or
    // fire the moment consent is granted; the clocks start here, same as
    // every later cycle (see reflectionTrigger.js/useChatController.js).
    savePrefs.mutate({
      ...prefs,
      consent,
      userAnalysisConsent: consent ? userAnalysisOptIn : prefs.userAnalysisConsent,
      lastReflectionAt: consent ? new Date().toISOString() : prefs.lastReflectionAt,
      lastDreamAt: consent ? new Date().toISOString() : prefs.lastDreamAt,
    });
  };

  const dismiss = () => {
    dismissReflectionConsentThisPageLoad();
    setDismissed(true);
  };

  return (
    <div className="px-3 py-2.5 bg-secondary/60 border-t border-border flex flex-col gap-2 text-xs">
      <div className="flex items-start gap-2.5">
        <Sparkles className="w-3.5 h-3.5 shrink-0 mt-0.5 text-muted-foreground" />
        <p className="flex-1 text-muted-foreground leading-relaxed">
          Vaea Chat can check in on its own. If you're away 3+ hours, opening chat may show a message it started —
          based on a read-only look at your own tasks and projects.{" "}
          {vaultConnected ? (
            <>
              It can also keep its own notes in your Vaea Vault and log what happened while you were gone — those
              save automatically. Everything else still needs your okay first.
            </>
          ) : (
            <>
              It can never change anything without asking you first.{" "}
              <Link to="/app/settings/vault-setup" className="underline underline-offset-2 hover:text-foreground">
                Connect Vaea Vault
              </Link>{" "}
              to let it keep its own notes there too.
            </>
          )}
        </p>
        <button onClick={dismiss} aria-label="Dismiss" className="shrink-0 text-muted-foreground hover:text-foreground">
          ×
        </button>
      </div>
      {/* A deliberate, visible trust statement, not a buried disclaimer.
          Roughly once a day it also looks back at its own replies from real
          conversations, not just workspace facts, to get better at
          responding — that's always about ITS replies, not you, unless the
          checkbox below is checked. */}
      <p className="text-[11px] text-muted-foreground/80 pl-6">
        Roughly once a day it also looks back at its own replies from your real conversations — not just workspace
        facts — to notice what worked and what didn't, and get better at responding. That's always about its own
        replies, not you: it still never analyzes your tone, habits, or personality unless you check the box below.
      </p>
      <label className="flex items-start gap-2 pl-6 text-[11px] text-muted-foreground/80">
        <input
          type="checkbox"
          checked={userAnalysisOptIn}
          onChange={(e) => setUserAnalysisOptIn(e.target.checked)}
          className="mt-0.5 shrink-0"
        />
        <span>Also let it notice patterns in how I communicate or work, and save what it learns.</span>
      </label>
      <div className="flex items-center justify-between gap-2 pl-6">
        <p className="text-[11px] text-muted-foreground/80">Turn this on or off anytime in Settings → AI Preferences.</p>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={() => decide(false)}
            className="px-2.5 py-1 text-muted-foreground hover:text-foreground transition-colors"
          >
            Not now
          </button>
          <button
            onClick={() => decide(true)}
            className="px-2.5 py-1 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors"
          >
            Allow
          </button>
        </div>
      </div>
    </div>
  );
}
