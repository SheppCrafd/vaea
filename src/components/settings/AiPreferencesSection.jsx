import { useEffect, useState, useRef } from "react";
import { Link } from "react-router-dom";
import { Check, Download, Upload } from "lucide-react";
import { DEFAULTS as IDENTITY_DEFAULTS } from "@/lib/aiPreferences";
import { useAiIdentity, useSaveAiIdentity } from "@/hooks/useAiIdentity";
import { useReflectionPreferences, useSaveReflectionPreferences } from "@/hooks/useReflectionPreferences";
import { useVaultConnected } from "@/hooks/useVaultConnected";

const FIELDS = [
  { key: "name", label: "Name", placeholder: "Vaea Chat (default) — or give it a name of your own", rows: 1 },
  { key: "identity", label: "Identity", placeholder: "Who is it? What's its role here?", rows: 2 },
  { key: "soul", label: "Soul (tone & protocol)", placeholder: "E.g., Direct, no filler. When I mention a bug or ask which approach to take, always give me two alternatives and compare them before answering.", rows: 3 },
  { key: "userProfile", label: "About you", placeholder: "How you work, what you value, how you like to communicate.", rows: 3 },
];

// The in-app analog of a personal identity.md/soul.md/user.md set — three
// distinct fields plus a name, editable by hand here, or drafted by the
// assistant itself via the "/setup" chat command (it interviews you, then
// writes these fields with the SET_AI_IDENTITY tool — same staged/confirm
// mechanism as everything else it does).
export default function AiPreferencesSection() {
  // Cached via react-query (useAiIdentity.js), shared with useChatController —
  // saving here invalidates that shared cache, so an already-mounted chat
  // header picks up a new name immediately instead of only after a reload.
  const { data: savedIdentity, isSuccess } = useAiIdentity();
  const saveIdentity = useSaveAiIdentity();
  const [identity, setIdentity] = useState(IDENTITY_DEFAULTS);
  const [justSaved, setJustSaved] = useState(false);
  const [importError, setImportError] = useState("");
  const fileInputRef = useRef(null);

  // Same value the one-time consent overlay writes (ChatReflectionConsent.jsx) —
  // this toggle is the reversible half of that decision, not a separate
  // setting. Saves immediately on click, independent of the Save button
  // above, since it's its own on/off switch, not part of the identity form.
  const { data: reflectionPrefs } = useReflectionPreferences();
  const saveReflectionPrefs = useSaveReflectionPreferences();
  const { data: vaultConnected } = useVaultConnected();
  const reflectionEnabled = reflectionPrefs?.consent === true;
  const toggleReflection = () => {
    if (!reflectionPrefs) return;
    const consent = !reflectionEnabled;
    saveReflectionPrefs.mutate({
      ...reflectionPrefs,
      consent,
      // Same reasoning as the overlay's own Allow handler — turning it back
      // on shouldn't summarize everything that happened while it was off.
      lastReflectionAt: consent ? new Date().toISOString() : reflectionPrefs.lastReflectionAt,
    });
  };

  useEffect(() => {
    if (isSuccess) setIdentity(savedIdentity);
  }, [isSuccess, savedIdentity]);

  const handleChange = (key, value) => setIdentity((prev) => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    await saveIdentity.mutateAsync(identity);
    setJustSaved(true);
    setTimeout(() => setJustSaved(false), 1500);
  };

  // No server-side storage for this (or any) app data — see the Architecture
  // section in README — so this file is how identity actually gets to a
  // second device/browser: export here, import there.
  const handleExport = () => {
    const blob = new Blob([JSON.stringify(identity, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "vaea-ai-identity.json";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleImportFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file after a failed import
    if (!file) return;
    setImportError("");
    try {
      const parsed = JSON.parse(await file.text());
      const imported = Object.fromEntries(
        FIELDS.map(({ key }) => [key, typeof parsed[key] === "string" ? parsed[key] : identity[key]])
      );
      setIdentity(imported);
      await saveIdentity.mutateAsync(imported);
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch {
      setImportError("Couldn't read that file — expected the JSON exported from here.");
    }
  };

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">AI Assistant</p>
      <p className="text-xs text-muted-foreground mb-4">
        Write these by hand, or type <span className="font-mono">/setup</span> in chat and let it interview you instead. Sent as context with every message. There's no server storage for this (or any) app data, so it stays on this device — use Export/Import below to carry it to another one.
      </p>

      <div className="flex flex-col gap-4">
        {FIELDS.map(({ key, label, placeholder, rows }) => (
          <div key={key}>
            <p className="text-sm font-medium mb-1.5">{label}</p>
            {rows === 1 ? (
              <input
                value={identity[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={placeholder}
                className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
              />
            ) : (
              <textarea
                value={identity[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                placeholder={placeholder}
                rows={rows}
                className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-none"
              />
            )}
          </div>
        ))}
      </div>

      <div className="flex items-center gap-2 mt-4">
        <button
          type="button"
          onClick={handleSave}
          className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm"
        >
          Save
        </button>
        <button
          type="button"
          onClick={handleExport}
          className="flex items-center gap-1.5 text-xs px-3 py-2 border border-input rounded-md hover:bg-accent transition-colors"
        >
          <Download className="w-3.5 h-3.5" /> Export
        </button>
        <input ref={fileInputRef} type="file" accept=".json,application/json" onChange={handleImportFile} className="hidden" />
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs px-3 py-2 border border-input rounded-md hover:bg-accent transition-colors"
        >
          <Upload className="w-3.5 h-3.5" /> Import
        </button>
        {justSaved && (
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <Check className="w-3.5 h-3.5" /> Saved
          </span>
        )}
      </div>
      {importError && <p className="text-xs text-destructive mt-2">{importError}</p>}

      <div className="flex items-start justify-between gap-4 mt-6 pt-6 border-t border-border">
        <div>
          <p className="text-sm font-medium">Proactive check-ins</p>
          <p className="text-xs text-muted-foreground mt-0.5 max-w-md">
            If you're away 3+ hours, opening Vaea Chat may show a message it started on its own — based on a
            read-only look at your own tasks and projects.{" "}
            {vaultConnected ? (
              <>
                It also keeps its own notes in your Vaea Vault and logs what happened while you were gone — those
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
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={reflectionEnabled}
          onClick={toggleReflection}
          disabled={!reflectionPrefs}
          className={`shrink-0 mt-0.5 relative w-9 h-5 rounded-full transition-colors disabled:opacity-50 ${reflectionEnabled ? "bg-primary" : "bg-muted"}`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-background shadow-sm transition-transform ${reflectionEnabled ? "translate-x-4" : ""}`}
          />
        </button>
      </div>
    </div>
  );
}
