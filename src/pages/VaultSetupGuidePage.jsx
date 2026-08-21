import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, FolderOpen, GitBranch, Github, ArrowRight, KeyRound, Settings, Search, PenLine, Wrench, Check, Download, RefreshCw, Sparkles } from "lucide-react";
import TerminalBlock from "@/components/settings/TerminalBlock";
import { loadVaultConnection, isVaultConnected } from "@/lib/vaultConnection";

const BUILD_STEPS = [
  {
    title: "Install Obsidian",
    body: (
      <>
        Download it from <strong className="text-foreground">obsidian.md</strong> — free, Windows/Mac/Linux.
        On first launch, choose <strong className="text-foreground">"Open folder as vault"</strong> and point
        it at an empty folder.
      </>
    ),
  },
  {
    title: "Set up a folder structure",
    body: (
      <>
        <p className="mb-3">A structure that scales well, one purpose per folder:</p>
        <div className="rounded-lg border border-border overflow-hidden">
          <table className="w-full text-sm">
            <tbody>
              {[
                ["/Projects", "One file per project — status, stack, key decisions"],
                ["/Decisions", "Decisions you made, with the reasoning behind them"],
                ["/Daily", "Short, date-named logs of what you did each day"],
                ["/Knowledge", "Reusable patterns, snippets, things you've learned"],
                ["/MOC", '"Map of Content" — index files linking related notes by theme'],
              ].map(([folder, desc], i) => (
                <tr key={folder} className={i > 0 ? "border-t border-border" : ""}>
                  <td className="px-4 py-2.5 font-terminal text-xs whitespace-nowrap text-foreground align-top">{folder}</td>
                  <td className="px-4 py-2.5 text-muted-foreground align-top">{desc}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-sm text-muted-foreground">
          Link notes with <span className="font-terminal text-xs text-foreground">[[Other Note Name]]</span> — Obsidian
          turns these into clickable links automatically.
        </p>
      </>
    ),
  },
  {
    title: "Turn the folder into a git repository",
    body: "Makes the vault versioned and recoverable, not just loose local files.",
  },
  {
    title: "Create a GitHub repository",
    body: (
      <>
        Go to <strong className="text-foreground">github.com/new</strong>, name it, choose public or private —
        leave it empty, no README.
      </>
    ),
  },
  {
    title: "Connect and push",
    body: "Link the local folder to the GitHub repo and push your first commit.",
  },
];

const CONNECT_STEPS = [
  {
    title: "Create a personal access token",
    body: (
      <>
        On GitHub: <strong className="text-foreground">Settings → Developer settings → Personal access tokens → Fine-grained tokens → Generate new token</strong>.
        Scope it to <strong className="text-foreground">only this one repository</strong>, with{" "}
        <strong className="text-foreground">Contents: Read and write</strong>.
      </>
    ),
  },
  {
    title: "Connect it in Vaea",
    body: (
      <>
        Open <strong className="text-foreground">Settings → Vaea Brain</strong> (or the{" "}
        <Settings className="w-3.5 h-3.5 inline -mt-0.5" /> icon in chat). Enter the GitHub username/org, repo,
        branch, and the token from the step above, then hit <strong className="text-foreground">Connect</strong>.
      </>
    ),
  },
];

const PIPELINE = [
  { Icon: FolderOpen, label: "A folder" },
  { Icon: GitBranch, label: "Version-controlled" },
  { Icon: Github, label: "Backed up" },
  { Icon: Settings, label: "Connected to Vaea" },
];

const USES = [
  {
    Icon: Search,
    title: "Ask naturally",
    body: 'The assistant searches and reads notes on its own — try "what did I decide about X?"',
  },
  {
    Icon: PenLine,
    title: "/vault-log",
    body: "Writes a session summary to Daily/<today>.md as a real commit — Decisions too, if one came up.",
  },
  {
    Icon: Wrench,
    title: "/vault-tidy",
    body: "Scans every note's [[wikilinks]] for broken links, then proposes fixes as a confirmable plan.",
  },
  {
    Icon: Sparkles,
    title: "Proactive check-ins",
    body: 'Opt in via Settings → AI Assistant, and the vault also becomes where the assistant keeps its own notes automatically.',
  },
];

// Shown instead of the generic "build one from scratch" flow when Settings
// -> Vaea Brain already has a real connection — the exact gap the from-
// scratch guide below doesn't cover: getting a repo that already exists
// (whatever its history) open in Obsidian on THIS device, using the real
// owner/repo/branch already connected rather than a <placeholder>.
function ConnectedVaultWalkthrough({ connection }) {
  const cloneUrl = `https://github.com/${connection.owner}/${connection.repo}.git`;
  return (
    <div className="mb-14 rounded-xl border border-primary/30 bg-primary/5 p-6">
      <p className="flex items-center gap-1.5 text-xs font-medium text-primary uppercase tracking-wider mb-1">
        <Check className="w-3.5 h-3.5" /> Already connected
      </p>
      <p className="text-sm text-muted-foreground mb-5">
        Settings → Vaea Brain is already pointed at{" "}
        <span className="font-terminal text-xs text-foreground">{connection.owner}/{connection.repo}</span>{" "}
        (branch <span className="font-terminal text-xs text-foreground">{connection.branch}</span>). Vaea reads
        and writes it over the GitHub API already — what's left is a real, editable copy on this device.
      </p>

      <ol className="relative mb-6">
        <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
        {[
          { Icon: Download, title: "Clone it", body: "Pulls down whatever's already in the repo." },
          { Icon: FolderOpen, title: "Open it in Obsidian", body: <>Install Obsidian from <strong className="text-foreground">obsidian.md</strong> if you haven't, then <strong className="text-foreground">"Open folder as vault"</strong> on the folder you cloned.</> },
          { Icon: RefreshCw, title: "Keep it in sync", body: "Vaea writes on its own schedule — pull before editing, push when done, same as any collaborator." },
        ].map(({ Icon, title, body }, i) => (
          <li key={title} className="relative pl-11 pb-6 last:pb-0">
            <span className="absolute left-0 top-0 w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center text-primary">
              <Icon className="w-3.5 h-3.5" />
            </span>
            <h3 className="font-heading font-semibold text-sm mb-1">{i + 1}. {title}</h3>
            <div className="text-sm text-muted-foreground leading-relaxed">{body}</div>
          </li>
        ))}
      </ol>

      <TerminalBlock
        title="connect-obsidian"
        code={`# 1. Clone the repo Vaea is already connected to
git clone ${cloneUrl}
cd ${connection.repo}

# 3a. Whenever you come back to edit locally
git pull

# 3b. After editing in Obsidian
git add .
git commit -m "Update notes"
git push`}
      />

      <p className="text-sm text-muted-foreground leading-relaxed mt-6">
        Want to set up the folder structure — <span className="font-terminal text-xs text-foreground">/Projects</span>,{" "}
        <span className="font-terminal text-xs text-foreground">/Decisions</span>,{" "}
        <span className="font-terminal text-xs text-foreground">/Daily</span>, etc — Part 1 below still applies,
        just starting from step 2.
      </p>
    </div>
  );
}

export default function VaultSetupGuidePage() {
  const [connection, setConnection] = useState(null);

  useEffect(() => {
    loadVaultConnection().then(setConnection);
  }, []);

  const connected = isVaultConnected(connection);

  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/app/settings" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>
          <h1 className="font-heading text-lg font-semibold">Vaea Brain Setup</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Hero */}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Optional · your own Obsidian + GitHub vault
        </p>
        <h2 className="font-heading text-3xl font-semibold leading-tight mb-3">
          Set up Vaea Brain
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8">
          A personal, freeform space for decisions, things you learned, and a running daily log — Obsidian for
          writing, GitHub for backup, and once connected, Vaea's assistant reads and writes it too.
        </p>

        <div className="flex items-center justify-center gap-3 mb-12 py-6 rounded-xl border border-border bg-card">
          {PIPELINE.map(({ Icon, label }, i) => (
            <div key={label} className="flex items-center gap-3">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{label}</span>
              </div>
              {i < PIPELINE.length - 1 && <ArrowRight className="w-4 h-4 text-muted-foreground/40 mb-5" />}
            </div>
          ))}
        </div>

        {connected && <ConnectedVaultWalkthrough connection={connection} />}

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Part 1 · Build the vault</p>

        {/* Steps */}
        <ol className="relative mb-14">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
          {BUILD_STEPS.map((step, i) => (
            <li key={step.title} className="relative pl-11 pb-10 last:pb-0">
              <span className="absolute left-0 top-0 w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center font-terminal text-xs text-foreground">
                {i + 1}
              </span>
              <h3 className="font-heading font-semibold mb-1.5">{step.title}</h3>
              <div className="text-sm text-muted-foreground leading-relaxed">{step.body}</div>
            </li>
          ))}
        </ol>

        {/* Terminal */}
        <div className="mb-6">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Terminal commands</p>
          <p className="text-sm text-muted-foreground mb-4">
            Steps 2, 3, and 5 above, in order. Run these from inside the folder you chose as your vault —
            swap in your own username and repo name.
          </p>
          <TerminalBlock
            title="vault-setup"
            code={`# 2. Create the folder structure
mkdir Projects Decisions Daily Knowledge MOC

# 3. Turn it into a git repo
git init
git add .
git commit -m "Initial vault structure"

# 5. Connect to GitHub and push
git branch -M main
git remote add origin https://github.com/<username>/<repo-name>.git
git push -u origin main`}
          />
        </div>

        <div>
          <p className="text-sm text-muted-foreground mb-3">
            Have the <a href="https://cli.github.com" target="_blank" rel="noopener noreferrer" className="text-foreground underline underline-offset-2 hover:text-primary">GitHub CLI</a> installed?
            Steps 4 and 5 collapse into one line:
          </p>
          <TerminalBlock title="gh cli (optional)" code={`gh repo create <repo-name> --private --source=. --remote=origin --push`} />
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mt-8">
          Vault's sorted. Next: give Vaea access to it.
        </p>

        <div className="mt-14 pt-10 border-t border-border">
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Part 2 · Connect it to Vaea</p>
            {connected && (
              <span className="flex items-center gap-1 text-[11px] text-primary font-medium">
                <Check className="w-3.5 h-3.5" /> Already done
              </span>
            )}
          </div>
          <ol className="relative mb-10">
            <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
            {CONNECT_STEPS.map((step, i) => (
              <li key={step.title} className="relative pl-11 pb-10 last:pb-0">
                <span className="absolute left-0 top-0 w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center text-primary">
                  {i === 0 ? <KeyRound className="w-3.5 h-3.5" /> : <Settings className="w-3.5 h-3.5" />}
                </span>
                <h3 className="font-heading font-semibold mb-1.5">{step.title}</h3>
                <div className="text-sm text-muted-foreground leading-relaxed">{step.body}</div>
              </li>
            ))}
          </ol>
        </div>

        <div>
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Using your connected vault</p>
          <div className="flex flex-col gap-4">
            {USES.map(({ Icon, title, body }) => (
              <div key={title} className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4">
                <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Icon className="w-4 h-4 text-primary" />
                </div>
                <div>
                  <p className="font-heading font-semibold text-sm mb-1">{title}</p>
                  <p className="text-sm text-muted-foreground leading-relaxed">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mt-12 pt-8 border-t border-border">
          A real personal vault, and an assistant that reads and writes it.
        </p>
      </div>
    </div>
  );
}
