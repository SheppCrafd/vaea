import { Link } from "react-router-dom";
import { ArrowLeft, FolderOpen, RefreshCw, Cpu, ShieldCheck, FileJson, TerminalSquare, Settings, TriangleAlert } from "lucide-react";
import TerminalBlock from "@/components/settings/TerminalBlock";
import { BRIDGE_WATCHER_SCRIPT } from "@/lib/llm/bridgeWatcherKit";

const PIPELINE = [
  { Icon: FolderOpen, label: "Connect a folder" },
  { Icon: FileJson, label: "Vaea writes a prompt" },
  { Icon: RefreshCw, label: "Your script polls" },
  { Icon: Cpu, label: "Your model answers" },
];

const CUSTOM_MODEL_SNIPPET = `# your_model_watcher.py — bring any model; the folder handling is already done.
from bridge_watcher import run_watcher

def answer(request):
    # request has "system", "tools", "messages" — call your model however
    # you like and return {"content": [...]} (text and/or tool_use blocks).
    ...

run_watcher(".", answer)`;

const REQUEST_SHAPE = `{
  "round": 0,
  "system": "<the full instructions Vaea's assistant follows>",
  "tools": [
    { "name": "CREATE_TASK", "description": "...", "input_schema": { "...": "..." } }
  ],
  "messages": [
    { "role": "user", "content": "<the user's message + the current workspace state>" }
  ]
}`;

const RESPONSE_SHAPE = `{
  "content": [
    { "type": "text", "text": "I'll add that task." },
    { "type": "tool_use", "id": "toolu_1", "name": "CREATE_TASK", "input": { "project_id": "p_123", "description": "..." } }
  ]
}`;

const STEPS = [
  {
    title: "Connect a folder",
    body: (
      <>
        In <strong className="text-foreground">Settings → AI Model</strong>, pick{" "}
        <strong className="text-foreground">Local Mode</strong>, then choose (or create) an empty folder
        (Chrome/Edge desktop only). That's it — Vaea creates{" "}
        <span className="font-terminal text-xs text-foreground">prompts/</span> and{" "}
        <span className="font-terminal text-xs text-foreground">responses/</span> subfolders and writes a
        ready-to-run <span className="font-terminal text-xs text-foreground">bridge_watcher.py</span> plus
        double-click launchers straight into the folder — nothing to save or copy yourself.
      </>
    ),
  },
  {
    title: "Run the watcher it already wrote",
    body: (
      <>
        Double-click <span className="font-terminal text-xs text-foreground">run_watcher.bat</span> (Windows) or{" "}
        <span className="font-terminal text-xs text-foreground">run_watcher.command</span> (Mac) inside the
        connected folder — it starts in test mode until you pick a real one in Settings.{" "}
        <strong className="text-foreground">On a work/managed device, type the command into an already-open
        terminal instead of double-clicking</strong> (see "Good to know" below) — it's the more reliable path
        when IT policy blocks launching scripts from Explorer. Ollama, LM Studio, GPT4All, text-generation-webui,
        the real Claude API, and a local Claude Code CLI are all built in: pick one from the dropdown, type the
        model name (Claude Code needs none — it uses whatever session the "claude" CLI is already logged into),
        and click "Update watcher files" — no script to write yourself. No Python? The launcher checks and offers
        to install it for you (winget on Windows, Homebrew on Mac) — a real yes/no prompt gates it, nothing
        installs silently.
      </>
    ),
  },
  {
    title: "Chat normally",
    body: "Send a message like always — every capability works the same as any other provider. See \"What your script needs to handle\" below for the one difference: staying in the loop for follow-up tool rounds.",
  },
];

export default function LocalModeSetupGuidePage() {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/app/settings" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>
          <h1 className="font-heading text-lg font-semibold">Local Mode Setup</h1>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10">
        {/* Hero */}
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-3">
          Optional · for your own local or on-prem model
        </p>
        <h2 className="font-heading text-3xl font-semibold leading-tight mb-3">
          Answer Vaea Chat without a network call
        </h2>
        <p className="text-muted-foreground leading-relaxed mb-8">
          Every other mode sends a request to some company's API. Local Mode doesn't: Vaea writes each prompt
          as a plain JSON file on your device, a script you control picks it up and runs it against your own
          model, and writes the answer back the same way. Nothing leaves the folder you chose.
        </p>

        <div className="flex items-center justify-center gap-3 mb-12 py-6 rounded-xl border border-border bg-card overflow-x-auto">
          {PIPELINE.map(({ Icon, label }, i) => (
            <div key={label} className="flex items-center gap-3 shrink-0">
              <div className="flex flex-col items-center gap-2">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <Icon className="w-4.5 h-4.5 text-primary" />
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap">{label}</span>
              </div>
              {i < PIPELINE.length - 1 && <span className="text-muted-foreground/40 mb-5">→</span>}
            </div>
          ))}
        </div>

        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Part 1 · Get it running</p>

        <ol className="relative mb-14">
          <div className="absolute left-[15px] top-2 bottom-2 w-px bg-border" aria-hidden="true" />
          {STEPS.map((step, i) => (
            <li key={step.title} className="relative pl-11 pb-10 last:pb-0">
              <span className="absolute left-0 top-0 w-8 h-8 rounded-full border border-border bg-card flex items-center justify-center font-terminal text-xs text-foreground">
                {i + 1}
              </span>
              <h3 className="font-heading font-semibold mb-1.5">{step.title}</h3>
              <div className="text-sm text-muted-foreground leading-relaxed">{step.body}</div>
            </li>
          ))}
        </ol>

        <div className="mb-14">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">The watcher, already sitting in your folder</p>
          <p className="text-sm text-muted-foreground mb-4">
            This is <span className="font-terminal text-xs text-foreground">bridge_watcher.py</span> (Python 3,
            no extra packages) — shown here for reference or if you want to customize it, but it's already been
            written into the folder you connected. Run the launcher (or{" "}
            <span className="font-terminal text-xs text-foreground">python bridge_watcher.py . --echo</span> in a
            terminal there) and send a message in Vaea Chat — you should get "Hello from your local watcher
            script." back.
          </p>
          <TerminalBlock title="bridge_watcher.py" code={BRIDGE_WATCHER_SCRIPT} showPrompt={false} />
        </div>

        <div className="mt-14 pt-10 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Part 2 · The file protocol</p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Each turn can take several rounds — the model replies with tool calls, Vaea runs them, and your
            script sends results back for another round, same as any tool-calling API. The only difference is
            the transport: a file pair per round instead of an HTTP request.
          </p>

          <div className="grid sm:grid-cols-2 gap-4 mb-6">
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <FileJson className="w-4 h-4 text-primary" />
                <p className="font-heading font-semibold text-sm">Vaea writes</p>
                <span className="font-terminal text-[11px] text-muted-foreground ml-auto">prompts/&lt;id&gt;-r&lt;round&gt;.json</span>
              </div>
              <TerminalBlock title="request" code={REQUEST_SHAPE} showPrompt={false} />
            </div>
            <div className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2 mb-2">
                <TerminalSquare className="w-4 h-4 text-primary" />
                <p className="font-heading font-semibold text-sm">Your script writes</p>
                <span className="font-terminal text-[11px] text-muted-foreground ml-auto">responses/&lt;id&gt;-r&lt;round&gt;.json</span>
              </div>
              <TerminalBlock title="response" code={RESPONSE_SHAPE} showPrompt={false} />
            </div>
          </div>

          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            <span className="font-semibold text-foreground">What your script needs to handle:</span> if the
            reply has <span className="font-terminal text-xs text-foreground">tool_use</span> blocks, Vaea runs
            them and writes the next round file — your script just keeps watching{" "}
            <span className="font-terminal text-xs text-foreground">prompts/</span> and repeats the call. No
            tool_use blocks left means that round's text is the final answer. A script that isn't running just
            means the chat waits and eventually times out, not a silent failure.
          </p>

          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            <span className="font-semibold text-foreground">Only round 0's file actually contains{" "}
            <span className="font-terminal text-xs text-foreground">system</span>/
            <span className="font-terminal text-xs text-foreground">tools</span>:</span> they're identical on
            every round of one turn — repeating them was pure duplication, real workspaces were hitting tens of
            thousands of tokens per round file. <span className="font-terminal text-xs text-foreground">bridge_watcher.py</span> caches
            round 0's copy and reconstructs the full request before your <span className="font-terminal text-xs text-foreground">answer()</span> function
            ever sees it, so this is invisible if you're using the prebuilt watcher — only relevant if you're
            reading raw prompt files directly, or writing your own from scratch.
          </p>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Six built-in models, no scripting</p>
          <p className="text-sm text-muted-foreground mb-4">
            Ollama, LM Studio, GPT4All, and text-generation-webui/llama.cpp's server all happen to implement the
            same OpenAI-compatible chat API at different local ports — <span className="font-terminal text-xs text-foreground">bridge_watcher.py</span> already
            speaks it. Pick one in Settings (or run it directly) and just give it a model name:
          </p>
          <TerminalBlock
            title="terminal"
            code={`python bridge_watcher.py . --ollama llama3.2\npython bridge_watcher.py . --lmstudio some-model\npython bridge_watcher.py . --gpt4all some-model\npython bridge_watcher.py . --textgen some-model`}
            showPrompt={false}
          />
          <p className="text-sm text-muted-foreground mt-4 mb-4">
            The real Claude API works the same way — reads{" "}
            <span className="font-terminal text-xs text-foreground">ANTHROPIC_API_KEY</span> from your own
            terminal, never from Vaea:
          </p>
          <TerminalBlock title="terminal" code={`python bridge_watcher.py . --anthropic claude-sonnet-5`} showPrompt={false} />
          <p className="text-sm text-muted-foreground mt-4 mb-4">
            Already have a{" "}
            <a href="https://claude.com/claude-code" target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-foreground">
              Claude Code
            </a>{" "}
            CLI session open (in VS Code's terminal, or anywhere else)? Point the watcher at it directly — no API
            key, it just runs <span className="font-terminal text-xs text-foreground">claude -p</span> for each
            round using whatever you're already signed into. It has its own real file/web tools and is told to
            use them for reading/research only — every actual change to your workspace still comes back as a
            tool-call for Vaea itself to run, through the same confirm-before-destructive gate as any other model:
          </p>
          <TerminalBlock title="terminal" code={`python bridge_watcher.py . --claude-code`} showPrompt={false} />
          <p className="text-sm text-muted-foreground mt-4 mb-4">
            Rather work in Claude Code's own chat (CLI or the VS Code extension) than run a background process at
            all? A real <span className="font-terminal text-xs text-foreground">/local-relay</span> Skill is
            already sitting in{" "}
            <span className="font-terminal text-xs text-foreground">.claude/skills/local-relay/</span> inside
            your connected folder — type <span className="font-terminal text-xs text-foreground">/local-relay</span> whenever
            you want it to check for and answer a pending prompt, using its own file/search tools the same way it
            would for anything else you ask it. The identical skill is also written under a one-letter name,{" "}
            <span className="font-terminal text-xs text-foreground">/l</span> (
            <span className="font-terminal text-xs text-foreground">.claude/skills/l/</span>), for whenever typing
            the full name each time is the actual friction. The same two are also written as classic Claude Code{" "}
            <span className="font-terminal text-xs text-foreground">.claude/commands/</span> files (
            <span className="font-terminal text-xs text-foreground">local-relay.md</span>/
            <span className="font-terminal text-xs text-foreground">l.md</span>) — an older, more broadly-supported
            mechanism than Skills — so if one format doesn't show up in your{" "}
            <span className="font-terminal text-xs text-foreground">/</span> menu, the other usually will; see
            "Good to know" below if neither does. Other agents without a skills system (Copilot Chat,
            Cursor, Windsurf) can still do the same thing manually — see{" "}
            <span className="font-terminal text-xs text-foreground">AGENT_RELAY_INSTRUCTIONS.md</span> in the
            folder.
          </p>
          <p className="text-sm text-muted-foreground mt-4 mb-4">
            Already speaking Vaea's own request shape some other way, or want to write your own translation
            layer? <span className="font-terminal text-xs text-foreground">--url</span> forwards raw, or import
            the watcher and supply just the model call:
          </p>
          <TerminalBlock title="your_model_watcher.py" code={CUSTOM_MODEL_SNIPPET} showPrompt={false} />
        </div>

        <div className="mt-14 pt-10 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Good to know</p>
          <div className="flex flex-col gap-4">
            <div className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <TriangleAlert className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-heading font-semibold text-sm mb-1">"/l" or "/local-relay" not showing up in Claude Code's own "/" menu?</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Two things to check, in order — both catch this every time: <strong className="text-foreground">first, restart your
                  Claude Code session</strong> if it was already open when you connected the folder — it only scans for
                  commands/skills once, at startup, not live. <strong className="text-foreground">Second, launch{" "}
                  <span className="font-terminal text-xs text-foreground">claude</span> from inside the connected
                  folder itself</strong> (or a subfolder of it) — <span className="font-terminal text-xs text-foreground">cd</span>{" "}
                  there first, since Claude Code only looks for a{" "}
                  <span className="font-terminal text-xs text-foreground">.claude/</span> folder relative to wherever
                  it was actually launched, not wherever the connected folder happens to sit on disk. If both are
                  already true and it still doesn't show up, your Claude Code install likely doesn't support one of
                  the two formats — that's exactly why both Skills (
                  <span className="font-terminal text-xs text-foreground">.claude/skills/</span>) and Commands (
                  <span className="font-terminal text-xs text-foreground">.claude/commands/</span>) get written; try
                  the other one before falling back to{" "}
                  <span className="font-terminal text-xs text-foreground">AGENT_RELAY_INSTRUCTIONS.md</span>, which
                  works with any agent that can read a file, no discovery mechanism required.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <TriangleAlert className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-heading font-semibold text-sm mb-1">On a managed work device? Start from a terminal, not a double-click</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  "This app can't run on your PC" (especially on Windows 11 Enterprise) is almost always Group
                  Policy, AppLocker, or Windows Defender Application Control blocking unsigned scripts launched
                  from Explorer — an IT-configured policy, not a Vaea bug, and nothing here can be fixed by
                  editing the script's contents. Open Command Prompt/PowerShell yourself (or VS Code's own
                  integrated terminal, if that's already installed and approved) and run{" "}
                  <span className="font-terminal text-xs text-foreground">python bridge_watcher.py . --...</span> directly
                  — typing a command into an already-running, already-trusted interpreter isn't the same action
                  AppLocker/WDAC is blocking, since that policy specifically targets double-click execution of{" "}
                  <span className="font-terminal text-xs text-foreground">.bat</span>/
                  <span className="font-terminal text-xs text-foreground">.cmd</span>/
                  <span className="font-terminal text-xs text-foreground">.ps1</span> files from Explorer, not{" "}
                  <span className="font-terminal text-xs text-foreground">python.exe</span> itself run from an
                  interactive shell. Double-clicking{" "}
                  <span className="font-terminal text-xs text-foreground">bridge_watcher.py</span> directly usually
                  won't help either — Windows typically opens{" "}
                  <span className="font-terminal text-xs text-foreground">.py</span> files in a text editor rather
                  than running them. If the device can't reach even <span className="font-terminal text-xs text-foreground">localhost</span>{" "}
                  via a terminal at all, ask IT to allow{" "}
                  <span className="font-terminal text-xs text-foreground">run_watcher.bat</span>/
                  <span className="font-terminal text-xs text-foreground">bridge_watcher.py</span> by name — that's
                  a normal AppLocker/WDAC allowlist request, not a workaround. And if your local model already
                  exposes an HTTP endpoint (Ollama, LM Studio), the <strong className="text-foreground">Local
                  HTTP</strong> provider in Settings → AI Model skips this folder/script setup entirely — Vaea's
                  browser tab calls your model directly, so there's no separate process for policy to block at all.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <ShieldCheck className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-heading font-semibold text-sm mb-1">Same safety rules as every other mode</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Destructive actions still require an explicit "Yes, do it" click before they run — your model
                  can propose them, but Vaea's own client-side executor applies anything, same as every other mode.
                </p>
              </div>
            </div>
            <div className="flex items-start gap-3.5 rounded-xl border border-border bg-card p-4">
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <Settings className="w-4 h-4 text-primary" />
              </div>
              <div>
                <p className="font-heading font-semibold text-sm mb-1">The one thing it can't do</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Web search — running your own model means no hosted search to inherit. Reading attached files
                  and Vaea Brain notes both still work normally.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mt-12 pt-8 border-t border-border">
          A folder, a script you control, and a model that never talks to anything outside it.
        </p>
      </div>
    </div>
  );
}
