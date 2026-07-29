import { Link } from "react-router-dom";
import { ArrowLeft, FolderOpen, RefreshCw, Cpu, ShieldCheck, FileJson, TerminalSquare, Settings } from "lucide-react";
import TerminalBlock from "@/components/settings/TerminalBlock";

const PIPELINE = [
  { Icon: FolderOpen, label: "Connect a folder" },
  { Icon: FileJson, label: "Vaea writes a prompt" },
  { Icon: RefreshCw, label: "Your script polls" },
  { Icon: Cpu, label: "Your model answers" },
];

const WATCHER_SCRIPT = `#!/usr/bin/env python3
# bridge_watcher.py — the prebuilt Backdoor Mode watcher. The folder
# inspection lives here once, so it never has to be re-written per script:
# a prompt counts as NEW only while it has no response yet, which makes
# restarts safe — answered prompts are never re-answered, even before Vaea
# files the pair away into processed/.
#
#   python bridge_watcher.py <folder> --echo     # wiring test, no model
#   python bridge_watcher.py <folder> --url http://localhost:11434/v1/messages
#
# Or import it and bring your own model (see "Forwarding to a real model"):
#   from bridge_watcher import run_watcher
#   run_watcher("<folder>", my_answer_function)

import argparse, json, time, urllib.request
from pathlib import Path

def scan_new_prompts(root):
    """Yield (name, request) for each prompt that has no response yet."""
    prompts, responses = Path(root) / "prompts", Path(root) / "responses"
    for f in sorted(prompts.glob("*.json")):
        if (responses / f.name).exists():
            continue  # answered — Vaea will file the pair into processed/
        try:
            yield f.name, json.loads(f.read_text())
        except (FileNotFoundError, json.JSONDecodeError):
            continue  # mid-write or just archived; the next pass gets it

def run_watcher(root, answer, interval=5):
    responses = Path(root) / "responses"
    print(f"Watching {Path(root) / 'prompts'} every {interval}s...")
    while True:
        for name, request in scan_new_prompts(root):
            print(f"Got round {request['round']} from {name}")
            reply = answer(request)
            (responses / name).write_text(json.dumps(reply, indent=2))
            print(f"Answered {name}")
        time.sleep(interval)

def echo_model(request):
    return {"content": [{"type": "text", "text": "Hello from your local watcher script."}]}

def http_model(url):
    def answer(request):
        body = json.dumps({
            "system": request["system"],
            "tools": request["tools"],
            "messages": request["messages"],
        }).encode()
        req = urllib.request.Request(url, data=body, headers={"content-type": "application/json"})
        with urllib.request.urlopen(req) as res:
            return json.loads(res.read())  # expected shape: {"content": [...]}
    return answer

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("folder")
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--echo", action="store_true", help="reply with a fixed test message")
    mode.add_argument("--url", help="forward each round to a Claude-compatible endpoint")
    args = p.parse_args()
    run_watcher(args.folder, echo_model if args.echo else http_model(args.url))`;

const CUSTOM_MODEL_SNIPPET = `# your_model_watcher.py — bring any model; the folder handling is already done.
from bridge_watcher import run_watcher

def answer(request):
    # request has "system", "tools", "messages" — call your model however
    # you like and return {"content": [...]} (text and/or tool_use blocks).
    ...

run_watcher("/path/to/the/folder/you/connected", answer)`;

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
        <strong className="text-foreground">Backdoor Mode</strong> as the provider, then choose (or create) an
        empty folder. Vaea creates two subfolders inside it automatically —{" "}
        <span className="font-terminal text-xs text-foreground">prompts/</span> and{" "}
        <span className="font-terminal text-xs text-foreground">responses/</span> — and remembers the folder for
        next time (Chrome/Edge desktop only — this uses the File System Access API, which Firefox and Safari
        don't support). Once a prompt has been answered and Vaea has read the answer, the pair is filed away
        into a third folder, <span className="font-terminal text-xs text-foreground">processed/</span> — so{" "}
        <span className="font-terminal text-xs text-foreground">prompts/</span> only ever holds what's still
        waiting, and Settings shows you both counts at a glance.
      </>
    ),
  },
  {
    title: "Run a watcher script against it",
    body: (
      <>
        Nothing polls the folder on its own — that's a script you (or your IT/platform team) run, on this device
        or wherever your model actually lives, as long as it can see the same folder (a local path, or a synced/
        shared/mounted one). The prebuilt{" "}
        <span className="font-terminal text-xs text-foreground">bridge_watcher.py</span> below handles all the
        folder inspection — run it with <span className="font-terminal text-xs text-foreground">--echo</span> to
        prove the wiring works, then point it at your model with{" "}
        <span className="font-terminal text-xs text-foreground">--url</span> (or import it and bring your own).
      </>
    ),
  },
  {
    title: "Chat normally",
    body: "Send a message in Vaea Chat like always. Every capability (creating/updating projects and tasks, the /slash commands, multi-step plans) works the same way it does with any other provider — see \"What your script needs to handle\" below for the one thing that's different: staying in the loop for follow-up tool rounds.",
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
          Every other mode — Vaea's built-in model, or bring-your-own-key — sends a request to some company's API.
          Backdoor Mode doesn't: Vaea writes each prompt as a plain JSON file on your own device, and a script you
          control (running wherever your model actually lives — your laptop, an internal server, an air-gapped
          box) picks it up, runs it against your own model, and writes the answer back the same way. Nothing ever
          leaves the folder you chose.
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
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">The prebuilt watcher — save it once, reuse it for everything</p>
          <p className="text-sm text-muted-foreground mb-4">
            Save this as <span className="font-terminal text-xs text-foreground">bridge_watcher.py</span> (Python
            3, no extra packages) and run it with{" "}
            <span className="font-terminal text-xs text-foreground">--echo</span> pointed at the folder you
            connected, then send any message in Vaea Chat — you should see it print the round it received and get
            "Hello from your local watcher script." back as the reply.
          </p>
          <TerminalBlock title="bridge_watcher.py" code={WATCHER_SCRIPT} showPrompt={false} />
        </div>

        <div className="mt-14 pt-10 border-t border-border">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-4">Part 2 · The file protocol</p>
          <p className="text-sm text-muted-foreground leading-relaxed mb-6">
            Each turn of the conversation can take several rounds — the model replies with tool calls (create this
            task, update that project), Vaea runs them, and your script needs to send the results back for another
            round, same as it would in a normal back-and-forth tool-calling API. The only difference is the
            transport: instead of one HTTP request per round, it's one file pair per round.
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
            <span className="font-semibold text-foreground">What your script needs to handle:</span> if your
            model's reply contains any <span className="font-terminal text-xs text-foreground">tool_use</span>{" "}
            blocks, Vaea runs those tools and immediately writes the <em>next</em> round file (same id, round + 1)
            with the results appended to <span className="font-terminal text-xs text-foreground">messages</span> —
            your script just needs to keep watching{" "}
            <span className="font-terminal text-xs text-foreground">prompts/</span> and repeat the same call. Once
            a reply has no tool_use blocks left, that round's text is the final answer and the turn is done. Vaea
            polls for each response every 5 seconds, so there's no strict latency requirement — but a script that's
            not running at all just means the chat waits (and eventually times out with a clear error) rather than
            failing silently. After Vaea reads each answer it files the round's pair into{" "}
            <span className="font-terminal text-xs text-foreground">processed/</span> — anything still sitting in{" "}
            <span className="font-terminal text-xs text-foreground">prompts/</span> is by definition new and
            unanswered, which is exactly the rule{" "}
            <span className="font-terminal text-xs text-foreground">bridge_watcher.py</span> uses to never
            re-answer history after a restart.
          </p>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Forwarding to a real model</p>
          <p className="text-sm text-muted-foreground mb-4">
            The <span className="font-terminal text-xs text-foreground">system</span>/
            <span className="font-terminal text-xs text-foreground">tools</span>/
            <span className="font-terminal text-xs text-foreground">messages</span> fields in the request are
            already shaped like Anthropic's Messages API — if your local/on-prem model speaks that shape (or you
            put a small translation layer in front of it), the same prebuilt watcher forwards directly:
          </p>
          <TerminalBlock
            title="terminal"
            code={`python bridge_watcher.py /path/to/your/folder --url http://localhost:11434/v1/messages`}
            showPrompt={false}
          />
          <p className="text-sm text-muted-foreground mt-4 mb-4">
            Speaking some other shape? Import the watcher and supply just the model call — the folder handling
            never has to be written again:
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
                  Destructive actions (deleting things, bulk changes) still require an explicit "Yes, do it" click
                  in the chat UI before they run — your model can propose them, but Vaea's own client-side executor
                  is what actually applies anything, exactly like the built-in and bring-your-own-key modes.
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
                  Web search — Anthropic and xAI's own models have that built in natively, but Backdoor Mode's
                  whole point is running your own model, so there's no hosted search to inherit. Reading attached
                  files and your Vaea Vault notes both work normally; the assistant is told about the search gap
                  outright and won't pretend otherwise.
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="text-sm text-muted-foreground leading-relaxed mt-12 pt-8 border-t border-border">
          That's the whole thing — a folder, a script you control, and a model that never talks to anything outside it.
        </p>
      </div>
    </div>
  );
}
