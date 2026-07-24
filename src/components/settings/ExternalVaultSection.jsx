import { useEffect, useState } from "react";
import { Check, Github, Loader2, TriangleAlert, Unlink } from "lucide-react";
import { loadVaultConnection, saveVaultConnection, clearVaultConnection, isVaultConnected } from "@/lib/vaultConnection";
import { testVaultConnection } from "@/lib/githubApi";

const DEFAULT_CONNECTION = { owner: "", repo: "", branch: "main", token: "" };

const FIELDS = [
  { key: "owner", label: "GitHub username / org", placeholder: "e.g. octocat" },
  { key: "repo", label: "Repository", placeholder: "e.g. my-second-brain" },
  { key: "branch", label: "Branch", placeholder: "main" },
];

// Connects the Vaea assistant to an external, git-backed Obsidian vault it
// can read from and write to — search it for context, log sessions to it
// ("/vault-log"), audit and fix its wikilinks ("/vault-tidy"). See
// vaultConnection.js for storage and githubApi.js for the actual GitHub
// calls this makes.
export default function ExternalVaultSection() {
  const [connection, setConnection] = useState(DEFAULT_CONNECTION);
  const [status, setStatus] = useState("idle"); // idle | testing | ok | error | saved
  const [error, setError] = useState("");
  const [hasStoredConnection, setHasStoredConnection] = useState(false);

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
  };

  const connected = isVaultConnected(connection) && (status === "ok" || status === "saved");

  return (
    <div className="bg-card border border-border rounded-xl p-6">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">External vault</p>
        {connected && (
          <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
            <Check className="w-3.5 h-3.5" /> Connected
          </span>
        )}
      </div>
      <p className="text-xs text-muted-foreground mb-4">
        Let the assistant read and write a personal Obsidian vault stored on GitHub — pull in context, log
        sessions, keep wikilinks and structure in shape. Reads run on the assistant's own turn; writes always
        happen via a normal request, same as everything else it does. New to this?{" "}
        <a href="/settings/vault-setup" className="underline underline-offset-2 hover:text-foreground">Set one up first.</a>
      </p>

      <div className="flex flex-col gap-3 mb-4">
        {FIELDS.map(({ key, label, placeholder }) => (
          <div key={key}>
            <p className="text-sm font-medium mb-1.5">{label}</p>
            <input
              value={connection[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              placeholder={placeholder}
              className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all"
            />
          </div>
        ))}
        <div>
          <p className="text-sm font-medium mb-1.5">Personal access token</p>
          <input
            type="password"
            value={connection.token}
            onChange={(e) => handleChange("token", e.target.value)}
            placeholder="ghp_..."
            autoComplete="off"
            className="w-full text-sm px-3 py-2 bg-background border border-input rounded-md outline-none focus:ring-1 focus:ring-primary/50 transition-all font-terminal"
          />
          <p className="text-xs text-muted-foreground mt-1.5">
            Needs read/write access to the one repo above (a fine-grained token scoped to just it is safest).
            Stored on this device only — but sent to Vaea's backend for the moment a read happens, so the
            assistant can act on what it finds, the same way your workspace data already is.
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
    </div>
  );
}
