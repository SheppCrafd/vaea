import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Check, Github, Loader2, Search, TriangleAlert, Unlink } from "lucide-react";
import { loadVaultConnection, saveVaultConnection, clearVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import {
  testVaultConnection, readVaultNoteContent, writeVaultFile, searchVaultNotes,
  SELF_NOTE_PATH, SELF_NOTE_TARGET_MAX_CHARS,
  MEMORY_NOTE_PATH, MEMORY_NOTE_TARGET_MAX_CHARS,
} from "@/lib/githubApi";
import { SettingsCard } from "@/components/ui/settings-card";
import { Input } from "@/components/ui/input";

const DEFAULT_CONNECTION = { owner: "", repo: "", branch: "main", token: "" };

// Read/edit surface for Vaea Self.md — the reflection feature's own notes
// about itself (see reflectionSummary.js), normally only auto-written by
// that feature. This is the in-app alternative to opening the vault
// directly in Obsidian: mostly for peeking at what it's written, occasionally
// for a manual correction. Save here is a real, explicit user action (the
// user is literally looking at Settings and clicking Save), so it writes
// directly via writeVaultFile — no need to route through the chat/confirm
// pipeline the way an assistant-proposed write does.
// Generic read/edit surface for a force-loaded vault note — Vaea Self.md
// (the reflection feature's own notes about itself) and Vaea Memory.md
// (durable facts about the user, written automatically during chat — see
// REMEMBERING FACTS in systemPrompt.js/entry.ts) both use this exact same
// shape, just a different path/description/placeholder. Save here is a
// real, explicit user action, so it writes directly via writeVaultFile — no
// need to route through the chat/confirm pipeline the way an
// assistant-proposed write does.
function VaultNoteEditor({ connection, path, maxChars, description, placeholder, commitMessage }) {
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    // Any failure here (most commonly: the file doesn't exist yet — nothing
    // has written to it since this feature shipped) is treated as "starts
    // empty," not an error — the connection itself is already known-good by
    // the time this renders (it's only shown once `connected` is true), so
    // there's nothing useful to surface here beyond a blank editor.
    readVaultNoteContent({ ...connection, path })
      .catch(() => "")
      .then((text) => {
        if (!cancelled) setContent(text);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [connection.owner, connection.repo, connection.branch, connection.token, path]);

  const handleSave = async () => {
    setSaving(true);
    setError("");
    try {
      await writeVaultFile({ ...connection, path, content, commitMessage });
      setJustSaved(true);
      setTimeout(() => setJustSaved(false), 1500);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const overCap = content.length > maxChars;

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <p className="text-sm font-medium mb-1">
        <span className="font-terminal">{path}</span>
      </p>
      <p className="text-xs text-muted-foreground mb-3">{description}</p>
      {loading ? (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground py-4">
          <Loader2 className="w-3.5 h-3.5 animate-spin" /> Loading…
        </div>
      ) : (
        <>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={placeholder}
            rows={8}
            className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all resize-y font-terminal"
          />
          <div className="flex items-center justify-between mt-1.5">
            <p className={`text-[11px] ${overCap ? "text-destructive" : "text-muted-foreground"}`}>
              {content.length.toLocaleString()} / {maxChars.toLocaleString()} characters
              {overCap ? " — over the target it's asked to stay under" : ""}
            </p>
          </div>
          <div className="flex items-center gap-2 mt-2">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
            >
              {saving ? "Saving…" : "Save"}
            </button>
            {justSaved && (
              <span className="text-xs text-muted-foreground flex items-center gap-1">
                <Check className="w-3.5 h-3.5" /> Saved
              </span>
            )}
          </div>
          {error && (
            <p className="flex items-start gap-1.5 text-xs text-destructive mt-2">
              <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
            </p>
          )}
        </>
      )}
    </div>
  );
}

// A plain search box over the connected vault's note content — GitHub code
// search under the hood (same call chat's own search_vault tool makes), not
// a natural-language Q&A engine: real snippet matches you read yourself,
// honestly labeled as search rather than oversold as something that
// synthesizes an answer. Ask Vaea Chat directly for that instead — this is
// for a quick "did I write anything about X" without opening a chat at all.
function VaultSearchBar({ connection }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSearch = async (e) => {
    e.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError("");
    try {
      const { matches } = await searchVaultNotes(connection, query.trim());
      setResults(matches);
    } catch (err) {
      setError(err.message);
      setResults(null);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mt-6 pt-6 border-t border-border">
      <p className="text-sm font-medium mb-1">Search your vault</p>
      <p className="text-xs text-muted-foreground mb-3">
        A plain keyword search over your note content — for a real synthesized answer, ask Vaea Chat instead.
      </p>
      <form onSubmit={handleSearch} className="flex items-center gap-2">
        <div className="flex-1 flex items-center gap-2 bg-background border border-input rounded-md px-3 py-2 focus-within:ring-1 focus-within:ring-primary/50">
          <Search className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="e.g. client pricing"
            className="flex-1 min-w-0 text-sm bg-transparent outline-none"
          />
        </div>
        <button
          type="submit"
          disabled={loading || !query.trim()}
          className="text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
        >
          {loading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Search"}
        </button>
      </form>
      {error && (
        <p className="flex items-start gap-1.5 text-xs text-destructive mt-2">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      )}
      {results && (
        results.length === 0 ? (
          <p className="text-xs text-muted-foreground mt-3">No matches.</p>
        ) : (
          <ul className="flex flex-col gap-2.5 mt-3">
            {results.map((r) => (
              <li key={r.path} className="text-xs">
                <p className="font-terminal text-foreground">{r.path}</p>
                {r.snippet && <p className="text-muted-foreground mt-0.5">{r.snippet}</p>}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}

const FIELDS = [
  { key: "owner", label: "GitHub username / org", placeholder: "e.g. octocat" },
  { key: "repo", label: "Repository", placeholder: "e.g. my-second-brain" },
  { key: "branch", label: "Branch", placeholder: "main" },
];

// "Vaea Brain" (renamed from "Vaea Vault" — same feature, new name only;
// internal identifiers like vaultConnection.js/externalVault/isVaultConnected
// stay as-is, this is purely the user-facing label) — connects the
// assistant to a personal, git-backed Obsidian vault it can read from and
// write to — search it for context, log sessions to it ("/vault-log"),
// audit and fix its wikilinks ("/vault-tidy"). It's still the user's own
// external GitHub repo (Vaea just connects to it, the same way it always
// has); see vaultConnection.js for connection storage and githubApi.js for
// the actual GitHub calls this makes.
export default function ExternalVaultSection() {
  const [connection, setConnection] = useState(DEFAULT_CONNECTION);
  const [status, setStatus] = useState("idle"); // idle | testing | ok | error | saved
  const [error, setError] = useState("");
  const [hasStoredConnection, setHasStoredConnection] = useState(false);
  const queryClient = useQueryClient();

  useEffect(() => {
    loadVaultConnection().then((loaded) => {
      setConnection(loaded);
      if (isVaultConnected(loaded)) {
        setStatus("saved");
        setHasStoredConnection(true);
      }
    });
  }, []);

  const handleChange = (key, value) => {
    setConnection((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
  };

  const handleTestAndSave = async () => {
    setStatus("testing");
    setError("");
    try {
      const { defaultBranch } = await testVaultConnection(connection);
      const withBranch = { ...connection, branch: connection.branch || defaultBranch || "main" };
      setConnection(withBranch);
      await saveVaultConnection(withBranch);
      setHasStoredConnection(true);
      setStatus("ok");
      // Lets ChatReflectionConsent.jsx/AiPreferencesSection.jsx's vault-aware
      // copy (useVaultConnected.js) pick this up immediately instead of only
      // after a reload.
      queryClient.invalidateQueries({ queryKey: ["vaultConnected"] });
    } catch (err) {
      setStatus("error");
      setError(err.message);
    }
  };

  const handleDisconnect = async () => {
    await clearVaultConnection();
    setConnection(DEFAULT_CONNECTION);
    setHasStoredConnection(false);
    setStatus("idle");
    queryClient.invalidateQueries({ queryKey: ["vaultConnected"] });
  };

  const connected = isVaultConnected(connection) && (status === "ok" || status === "saved");

  return (
    <SettingsCard>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Vaea Brain</p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> Connected
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Vaea Brain lets the assistant read and write a personal Obsidian vault stored on GitHub — pull in context,
        log sessions, keep wikilinks and structure in shape. On-demand reads run on the assistant's own turn mid-
        conversation; writes always happen via a normal request, same as everything else it does. It also pulls a
        lightweight overview once when a chat session opens — <span className="font-terminal">vault.md</span> if your
        vault has one, any note marked <span className="font-terminal">**Priority: high**</span>, and a handful of
        recently-changed notes — so the assistant already has real vault context before it decides whether to search
        for anything. New to this?{" "}
        <Link to="/app/settings/vault-setup" className="underline underline-offset-2 hover:text-foreground">Set one up first.</Link>
      </p>

      <div className="flex flex-col gap-3 mb-4">
        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <p className="text-sm font-medium mb-1.5">{label}</p>
            <Input
              value={connection[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className="bg-background"
            />
          </div>
        ))}
        <div>
          <p className="text-sm font-medium mb-1.5">Personal access token</p>
          <Input
            type="password"
            value={connection.token}
            onChange={(e) => handleChange("token", e.target.value)}
            placeholder="ghp_..."
            autoComplete="off"
            className="bg-background font-terminal"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Needs read/write access to the one repo above (a fine-grained token scoped to just it is safest).
            Stored on this device only. It's sent to Vaea's backend for the moment an on-demand read happens
            mid-conversation, so the assistant can act on what it finds, the same way your workspace data already
            is — but the once-per-session overview above is fetched directly from this browser to GitHub instead,
            never touching Vaea's backend at all.
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={handleTestAndSave}
          disabled={status === "testing" || !connection.owner || !connection.repo || !connection.token}
          className="flex items-center gap-1.5 text-sm px-4 py-2 bg-primary hover:bg-primary/90 text-primary-foreground font-medium rounded-md transition-colors shadow-sm disabled:opacity-50"
        >
          {status === "testing" ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Github className="w-3.5 h-3.5" />}
          {status === "testing" ? "Connecting…" : "Connect"}
        </button>
        {hasStoredConnection && (
          <button
            type="button"
            onClick={handleDisconnect}
            className="flex items-center gap-1.5 text-xs px-3 py-2 border border-input rounded-md hover:bg-accent transition-colors text-muted-foreground"
          >
            <Unlink className="w-3.5 h-3.5" /> Disconnect
          </button>
        )}
      </div>

      {status === "error" && (
        <p className="flex items-start gap-1.5 text-xs text-destructive mt-3">
          <TriangleAlert className="w-3.5 h-3.5 shrink-0 mt-0.5" /> {error}
        </p>
      )}

      {connected && (
        <>
          <VaultNoteEditor
            connection={connection}
            path={SELF_NOTE_PATH}
            maxChars={SELF_NOTE_TARGET_MAX_CHARS}
            description="What the assistant has written about itself — what it's learned working in this workspace, corrections to how it operates. It updates this on its own during a check-in; you can read or correct it here anytime."
            placeholder="Nothing written yet — this fills in the first time it checks in."
            commitMessage="Update Vaea Self.md (manual edit)"
          />
          <VaultNoteEditor
            connection={connection}
            path={MEMORY_NOTE_PATH}
            maxChars={MEMORY_NOTE_TARGET_MAX_CHARS}
            description="Durable facts about you and your work — never how the assistant should act, just things worth not re-explaining every conversation. It writes here on its own as facts come up in chat, organized by project; you can read or correct it here anytime."
            placeholder="Nothing written yet — this fills in as facts come up in chat."
            commitMessage="Update Vaea Memory.md (manual edit)"
          />
          <VaultSearchBar connection={connection} />
        </>
      )}
    </SettingsCard>
  );
}
