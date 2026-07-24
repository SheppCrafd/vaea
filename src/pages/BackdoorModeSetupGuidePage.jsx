import { Link } from "react-router-dom";
import { ArrowLeft, FolderOpen, RefreshCw, Cpu, ShieldCheck, FileJson, TerminalSquare, Settings } from "lucide-react";
import TerminalBlock from "@/components/settings/TerminalBlock";

const PIPELINE = [
  { Icon: FolderOpen, label: "Connect a folder" },
  { Icon: FileJson, label: "Vaea writes a prompt" },
  { Icon: RefreshCw, label: "Your script polls" },
  { Icon: Cpu, label: "Your model answers" },
];

const ECHO_SCRIPT = `#!/usr/bin/env python3
# watcher.py — the smallest possible Backdoor Mode watcher. It doesn't call
# a real model yet; it just echoes a fixed reply back, so you can confirm
# the folder wiring works end to end before plugging in your own model.
#
# Usage: python watcher.py /path/to/the/folder/you/connected/in/vaea

import json, sys, time
from pathlib import Path

root = Path(sys.argv[1])
prompts, responses = root / "prompts", root / "responses"
seen = set()

print(f"Watching {prompts} every 5s...")
while True:
    for f in sorted(prompts.glob("*.json")):
        if f.name in seen:
            continue
        seen.add(f.name)
        request = json.loads(f.read_text())
        print(f"Got round {request['round']} from {f.name}")

        # Replace this with a real call to your own model — see the
        # "Wiring up a real model" section below for what request/response
        # actually contain.
        reply = {"content": [{"type": "text", "text": "Hello from your local watcher script."}]}

        (responses / f.name).write_text(json.dumps(reply, indent=2))
        print(f"Wrote {f.name}")
    time.sleep(5)`;

const REAL_SCRIPT = `#!/usr/bin/env python3
# watcher.py — forwards each round straight to a local Claude-compatible
# endpoint (e.g. your own model gateway listening on localhost, or an
# on-prem proxy in front of your company's model). Swap MODEL_URL and the
# request shape for whatever your actual endpoint expects — the point is
# just: read the round file, call your model, write its answer back.

import json, sys, time, urllib.request
from pathlib import Path

MODEL_URL = "http://localhost:11434/v1/messages"  # <- point this at your model

root = Path(sys.argv[1])
prompts, responses = root / "prompts", root / "responses"
seen = set()

def call_model(request):
    body = json.dumps({
        "system": request["system"],
        "tools": request["tools"],
        "messages": request["messages"],
    }).encode()
    req = urllib.request.Request(MODEL_URL, data=body, headers={"content-type": "application/json"})
    with urllib.request.urlopen(req) as res:
        return json.loads(res.read())  # expected shape: {"content": [...]}

print(f"Watching {prompts} every 5s...")
while True:
    for f in sorted(prompts.glob("*.json")):
        if f.name in seen:
            continue
        seen.add(f.name)
        request = json.loads(f.read_text())
        reply = call_model(request)
        (responses / f.name).write_text(json.dumps(reply, indent=2))
        print(f"Answered {f.name}")
    time.sleep(5)`;

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
        don't support).
      </>
    ),
  },
  {
    title: "Run a watcher script against it",
    body: (
      <>
        Nothing polls the folder on its own — that's a script you (or your IT/platform team) run, on this device
        or wherever your model actually lives, as long as it can see the same folder (a local path, or a synced/
        shared/mounted one). Start with the echo script below just to prove the wiring works, then swap in a real
        call to your model.
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
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Test script — confirms the wiring, no model needed</p>
          <p className="text-sm text-muted-foreground mb-4">
            Run this (Python 3, no extra packages) pointed at the folder you connected, then send any message in
            Vaea Chat — you should see it print the round it received and get "Hello from your local watcher
            script." back as the reply.
          </p>
          <TerminalBlock title="watcher.py (echo)" code={ECHO_SCRIPT} showPrompt={false} />
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
            failing silently.
          </p>

          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-1">Forwarding to a real model</p>
          <p className="text-sm text-muted-foreground mb-4">
            The <span className="font-terminal text-xs text-foreground">system</span>/
            <span className="font-terminal text-xs text-foreground">tools</span>/
            <span className="font-terminal text-xs text-foreground">messages</span> fields in the request are
            already shaped like Anthropic's Messages API — if your local/on-prem model speaks that shape (or you
            put a small translation layer in front of it), forwarding is nearly a direct pass-through:
          </p>
          <TerminalBlock title="watcher.py (real model)" code={REAL_SCRIPT} showPrompt={false} />
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
                <p className="font-heading font-semibold text-sm mb-1">Not available in this mode</p>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  Same limits as bring-your-own-key: web search, reading attached files, and the external notes
                  vault only work through Vaea's own built-in model — the assistant is told this outright and
                  won't pretend otherwise.
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
