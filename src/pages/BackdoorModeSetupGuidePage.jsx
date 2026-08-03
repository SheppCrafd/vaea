import { Link } from "react-router-dom";
import { ArrowLeft, FolderOpen, RefreshCw, Cpu, ShieldCheck, FileJson, TerminalSquare, Settings } from "lucide-react";
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
        <strong className="text-foreground">Backdoor Mode</strong>, then choose (or create) an empty folder
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
        connected folder — it starts in test mode (<span className="font-terminal text-xs text-foreground">--echo</span>)
        until you add your model's URL in Settings and click "Update watcher files," which bakes it into the
        launchers directly. Prefer a terminal, or point it wherever your model actually lives? The commands
        below still work the same way.
      </>
    ),
  },
  {
    title: "Chat normally",
    body: "Send a message like always — every capability works the same as any other provider. See \"What your script needs to handle\" below for the one difference: staying in the loop for follow-up tool rounds.",
  },
];

export default function BackdoorModeSetupGuidePage() {
  return (
    <div className="h-full overflow-y-auto bg-background">
      <div className="border-b border-border bg-card sticky top-0 z-10">
        <div className="max-w-2xl mx-auto px-6 py-4 flex items-center gap-3">
          <Link to="/app/settings" className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground shrink-0">
            <ArrowLeft className="w-3.5 h-3.5" />
            Settings
          </Link>
          <h1 className="font-heading text-lg font-semibold">Backdoor Mode Setup</h1>
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
          Every other mode sends a request to some company's API. Backdoor Mode doesn't: Vaea writes each prompt
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

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Forwarding to a real model</p>
          <p className="text-sm text-muted-foreground mb-4">
            The request is already shaped like Anthropic's Messages API — if your model speaks that shape (or
            you put a small translation layer in front), the same prebuilt watcher forwards directly. Paste the
            URL into Settings and click "Update watcher files" to bake it into the launchers, or run it directly:
          </p>
          <TerminalBlock
            title="terminal"
            code={`python bridge_watcher.py . --url http://localhost:11434/v1/messages`}
            showPrompt={false}
          />
          <p className="text-sm text-muted-foreground mt-4 mb-4">
            Some other shape? Import the watcher and supply just the model call:
          </p>
          <TerminalBlock title="your_model_watcher.py" code={CUSTOM_MODEL_SNIPPET} showPrompt={false} />
        </div>

        <div className="mt-14 pt-10 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Good to know</p>
          <div className="flex flex-col gap-4">
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
                  and Vaea Vault notes both still work normally.
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
