// The actual files Backdoor Mode drops into a freshly-connected folder
// (localBridgeStorage.js's writeWatcherKit) — the point being "just choose a
// folder" gets you all the way to a runnable watcher with nothing to copy,
// paste, or hand-type. bridge_watcher.py is the single source of truth for
// what BackdoorModeSetupGuidePage.jsx shows and what actually lands on disk,
// so the two can never drift apart.
//
// Config shape passed around here and from Settings (AiModelSection.jsx):
//   { connector: "echo" | "ollama" | "lmstudio" | "gpt4all" | "textgen"
//              | "anthropic" | "custom",
//     model: string,   // model name for every preset except custom/echo
//     url: string }    // raw endpoint, custom connector only
//
// Every preset except "anthropic" and "custom" talks to a real local model
// with zero scripting required — found (by actually testing this against a
// real local Ollama model) to be the single biggest barrier for anyone
// without Python/API experience: Ollama's own API doesn't speak Vaea's
// {system, tools, messages} -> {content: [...]} shape natively, so getting
// any real reply out of it used to require hand-writing a translation
// script. Ollama, LM Studio, GPT4All, and text-generation-webui/llama.cpp's
// server all happen to implement the same OpenAI-compatible
// /v1/chat/completions shape at different default local ports — one
// generic translator (openai_compatible_model) covers all four, so this
// only had to be written once.
//
// Only round 0's prompt file carries `system`/`tools` — see run_watcher's
// own `_with_context` below for why (they're identical every round of a
// turn, so writing them into every round's file was pure duplication —
// found via a real multi-round conversation hitting ~44,000 tokens per
// prompt file). Every connector function here (echo_model/ollama_model/
// etc.) still receives the full {round, system, tools, messages} shape on
// every round regardless — `_with_context` reconstructs it before `answer`
// is ever called, so none of them needed to change for this.

export const BRIDGE_WATCHER_SCRIPT = `#!/usr/bin/env python3
# bridge_watcher.py — the prebuilt Backdoor Mode watcher, written into this
# folder automatically the moment you connected it in Vaea. The folder
# inspection lives here once, so it never has to be re-written per script:
# a prompt counts as NEW only while it has no response yet, which makes
# restarts safe — answered prompts are never re-answered, even before Vaea
# files the pair away into processed/.
#
#   python bridge_watcher.py . --echo                  # wiring test, no model
#   python bridge_watcher.py . --ollama llama3.2        # local Ollama
#   python bridge_watcher.py . --lmstudio some-model     # local LM Studio
#   python bridge_watcher.py . --gpt4all some-model      # local GPT4All
#   python bridge_watcher.py . --textgen some-model       # text-generation-webui / llama.cpp server
#   python bridge_watcher.py . --anthropic claude-sonnet-5  # real Claude API
#                                                         # (needs ANTHROPIC_API_KEY set in
#                                                         # your terminal — never stored by Vaea)
#   python bridge_watcher.py . --claude-code             # a local Claude Code CLI, already
#                                                         # logged in on this device — no API
#                                                         # key, uses your existing session
#   python bridge_watcher.py . --url http://host/custom-endpoint
#
# Or import it and bring your own model entirely (see "Forwarding to a real
# model" in the setup guide):
#   from bridge_watcher import run_watcher
#   run_watcher(".", my_answer_function)

import argparse, json, os, re, shutil, subprocess, tempfile, time, urllib.request
from pathlib import Path

def scan_new_prompts(root):
    """Yield (name, request) for each prompt that has no response yet."""
    prompts, responses = Path(root) / "prompts", Path(root) / "responses"
    for f in sorted(prompts.glob("*.json")):
        if (responses / f.name).exists():
            continue  # answered — Vaea will file the pair into processed/
        try:
            # Vaea writes these as real UTF-8 (the browser's File System
            # Access API always does) — explicit here because Python's
            # read_text() otherwise defaults to the OS's own codepage, which
            # on Windows is rarely UTF-8 and crashes on the em dashes this
            # app's own prompts/system text is full of.
            yield f.name, json.loads(f.read_text(encoding="utf-8"))
        except (FileNotFoundError, json.JSONDecodeError):
            continue  # mid-write or just archived; the next pass gets it

_context_cache = {}  # requestId -> {"system": ..., "tools": ...}

def _request_id(name):
    return name.rsplit("-r", 1)[0]  # "<uuid>-r<round>.json" -> "<uuid>"

def _with_context(root, name, request):
    """Only round 0's prompt file actually carries system/tools — they're
    identical on every round of the same turn, so Vaea only writes them
    once (a real multi-round conversation was hitting ~44,000 tokens PER
    ROUND FILE before this, almost entirely duplicated content). Every
    later round gets system/tools filled back in here, from an in-memory
    cache keyed by request id, before the connector ever sees it — so
    echo_model/ollama_model/etc. above never had to change at all."""
    req_id = _request_id(name)
    if "system" in request:
        _context_cache[req_id] = {"system": request["system"], "tools": request["tools"]}
        return request
    cached = _context_cache.get(req_id)
    if cached is None:
        # This watcher process started after round 0 already happened (a
        # restart mid-conversation) — round 0's own prompt file has already
        # been filed into processed/prompts/ by Vaea by the time any later
        # round exists, so recover the context from there instead of
        # failing outright.
        try:
            r0 = json.loads((Path(root) / "processed" / "prompts" / f"{req_id}-r0.json").read_text(encoding="utf-8"))
            cached = {"system": r0["system"], "tools": r0["tools"]}
            _context_cache[req_id] = cached
        except (FileNotFoundError, KeyError, json.JSONDecodeError):
            raise RuntimeError(
                f"No cached system/tools for {req_id} and round 0's prompt file is gone — "
                f"can't answer round {request['round']}. This shouldn't happen in normal use; "
                f"if it does, the conversation this round belongs to needs to be retried from scratch."
            )
    request["system"] = cached["system"]
    request["tools"] = cached["tools"]
    return request

def run_watcher(root, answer, interval=5):
    responses = Path(root) / "responses"
    print(f"Watching {Path(root) / 'prompts'} every {interval}s...")
    while True:
        for name, request in scan_new_prompts(root):
            request = _with_context(root, name, request)
            print(f"Got round {request['round']} from {name}")
            reply = answer(request)
            (responses / name).write_text(json.dumps(reply, indent=2), encoding="utf-8")
            print(f"Answered {name}")
        time.sleep(interval)

def echo_model(request):
    return {"content": [{"type": "text", "text": "Hello from your local watcher script."}]}

def http_model(url):
    """Raw passthrough — for anything that already speaks Vaea's own
    {system, tools, messages} -> {content: [...]} shape natively."""
    def answer(request):
        body = json.dumps({
            "system": request["system"],
            "tools": request["tools"],
            "messages": request["messages"],
        }).encode()
        req = urllib.request.Request(url, data=body, headers={"content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=600) as res:
            return json.loads(res.read())  # expected shape: {"content": [...]}
    return answer

def _flatten(content):
    # Later tool-calling rounds carry structured content (tool_use/
    # tool_result blocks) that a plain chat-completions message can't hold
    # natively — flattened to text so the request stays valid. Simple
    # single-turn questions (the common case for a first real test) never
    # hit this path at all.
    return content if isinstance(content, str) else json.dumps(content)

def openai_compatible_model(url, model):
    """Covers every local runner that implements an OpenAI-compatible
    /v1/chat/completions endpoint — which in practice is most of them
    (Ollama, LM Studio, GPT4All, text-generation-webui, llama.cpp's own
    server). One translation, reused as a named preset per tool below."""
    def answer(request):
        messages = [{"role": "system", "content": request["system"]}]
        for m in request["messages"]:
            messages.append({"role": m["role"], "content": _flatten(m["content"])})
        body = json.dumps({"model": model, "messages": messages, "stream": False}).encode()
        req = urllib.request.Request(url, data=body, headers={"content-type": "application/json"})
        with urllib.request.urlopen(req, timeout=600) as res:
            data = json.loads(res.read())
        text = data["choices"][0]["message"]["content"]
        return {"content": [{"type": "text", "text": text}]}
    return answer

def ollama_model(model):
    return openai_compatible_model("http://localhost:11434/v1/chat/completions", model)

def lmstudio_model(model):
    return openai_compatible_model("http://localhost:1234/v1/chat/completions", model)

def gpt4all_model(model):
    return openai_compatible_model("http://localhost:4891/v1/chat/completions", model)

def textgen_model(model):
    return openai_compatible_model("http://localhost:5000/v1/chat/completions", model)

def claude_code_model():
    """Relays each round to a real Claude Code CLI running non-interactively
    on this device (\`claude -p\`) — the "captive AI already open in VS
    Code" case: no API key, no separate model server, uses whatever
    session the \`claude\` CLI is already logged into. Genuinely automated,
    not a manual copy-paste-into-the-sidebar relay: this just shells out to
    it once per round, same as every other connector here.

    Claude Code has real file/bash/web tools of its own in this
    environment — the prompt tells it explicitly those are for reading/
    research only. Every actual Vaea action still has to come back as a
    tool_use block in the JSON response, exactly like every other
    connector; Vaea's own client-side executor (with its own
    confirm-before-destructive gate) is what actually applies it, same as
    always. This is the one thing every connector in this file has in
    common and the one rule this prompt exists to hold the line on."""
    claude_path = shutil.which("claude")
    if not claude_path:
        raise SystemExit("Couldn't find the \\"claude\\" command on PATH — install Claude Code (https://claude.com/claude-code) or make sure it's on PATH, then try again.")
    def answer(request):
        last = request["messages"][-1] if request["messages"] else None
        last_text = last["content"] if last and isinstance(last["content"], str) else json.dumps(last["content"]) if last else "(none)"
        prompt = (
            "A task-tracking app called Vaea needs you to answer one real message from one of its "
            "users, right now. This is a live task, not a hypothetical or a test — treat it exactly "
            "like you would if the user had typed this straight to you.\\n\\n"
            "THE USER'S MESSAGE TO ANSWER:\\n" + last_text + "\\n\\n"
            "Background you'll need to answer it well — Vaea's own system prompt (its product rules and "
            "conventions), the tools it can carry out on your behalf, and the rest of this "
            "conversation's history leading up to the message above:\\n\\n"
            "=== VAEA'S SYSTEM PROMPT ===\\n" + request["system"] + "\\n\\n"
            "=== TOOLS VAEA CAN ACT THROUGH ===\\n" + json.dumps(request["tools"]) + "\\n\\n"
            "=== FULL CONVERSATION HISTORY (the message above is the last item in this) ===\\n"
            + json.dumps(request["messages"]) + "\\n\\n"
            "Now answer the user's message. Output format: respond with ONLY one raw JSON object, no "
            "markdown fence, no text outside it: {\\"content\\": [...]}, where each item is "
            "{\\"type\\": \\"text\\", \\"text\\": \\"...\\"} for a plain reply, or {\\"type\\": \\"tool_use\\", "
            "\\"id\\": \\"toolu_1\\", \\"name\\": \\"TOOL_NAME\\", \\"input\\": {...}} to have Vaea run one of the "
            "tools above on your behalf (Vaea applies it afterward, with its own confirmation step for "
            "anything destructive — you're only ever proposing it, same as any tool-calling model would "
            "through a normal API). You have your own file/web tools available too, separate from "
            "Vaea's — feel free to use them to read something or look something up if it'd genuinely "
            "help you answer well."
        )
        result = subprocess.run(
            # The prompt goes in via stdin (input=), not as a CLI argument —
            # confirmed for real: passing it as an argv entry silently
            # corrupted it (the model kept insisting no user message was
            # included, even though it clearly was) because on Windows
            # "claude" resolves to an npm-installed .cmd shim, and a long,
            # multi-line, quote-and-brace-heavy argument gets mangled going
            # through that shim's own cmd.exe argument re-parsing. stdin has
            # no such parsing step on any platform, which is also just a
            # more robust way to hand a CLI an arbitrarily large/special
            # payload in general.
            [claude_path, "-p"], input=prompt,
            capture_output=True, text=True, timeout=600, encoding="utf-8",
            # Also run from a neutral directory, not the connected folder's
            # own — if that folder is (or sits inside) a real dev repo with
            # its own CLAUDE.md/AGENTS.md, there's no reason to let Claude
            # Code pick that up as ambient project context for what's
            # supposed to be a self-contained one-off relay.
            cwd=tempfile.gettempdir(),
        )
        if result.returncode != 0:
            raise RuntimeError(f"claude -p exited {result.returncode}: {result.stderr.strip()[:500]}")
        return _extract_content_json(result.stdout)
    return answer

def _extract_content_json(text):
    """claude -p is told to output raw JSON and nothing else, but in
    practice sometimes wraps it in a markdown fence anyway, or occasionally
    just answers in plain prose despite the instruction — this strips a
    fence if present, falls back to grabbing the first {...} span, and if
    truly no JSON object exists anywhere, treats the whole reply as a plain
    text answer rather than failing the turn outright. A real, disclosed
    reply Vaea can show is better than a hard error over a formatting
    slip."""
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        pass
    if text.startswith("\`\`\`"):
        stripped = re.sub(r"^\`\`\`[a-zA-Z]*\\n?", "", text)
        stripped = re.sub(r"\`\`\`\\s*$", "", stripped).strip()
        try:
            return json.loads(stripped)
        except json.JSONDecodeError:
            text = stripped
    start, end = text.find("{"), text.rfind("}")
    if start != -1 and end > start:
        try:
            return json.loads(text[start:end + 1])
        except json.JSONDecodeError:
            pass
    return {"content": [{"type": "text", "text": text}]} if text else {
        "content": [{"type": "text", "text": "(claude -p returned an empty response)"}]
    }

def anthropic_model(model):
    """The real Claude API — a genuine network call, so this is really only
    useful if you specifically want your own script sitting between Vaea
    and Anthropic (logging, a compliance boundary, etc). If you just want
    Claude answering Vaea Chat with no extra setup, Settings -> AI Model's
    own \\"Anthropic\\" provider (bring-your-own-key) already does that
    directly, no folder or script involved.

    Reads the key from ANTHROPIC_API_KEY in your own shell environment —
    Vaea never asks for, stores, or sees it; it only ever exists in your
    terminal for this process."""
    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key:
        raise SystemExit("Set ANTHROPIC_API_KEY in your terminal first, e.g.:\\n  set ANTHROPIC_API_KEY=sk-ant-...  (Windows)\\n  export ANTHROPIC_API_KEY=sk-ant-...  (Mac/Linux)")
    def answer(request):
        body = json.dumps({
            "model": model,
            "max_tokens": 4096,
            "system": request["system"],
            "tools": request["tools"],
            "messages": request["messages"],
        }).encode()
        req = urllib.request.Request(
            "https://api.anthropic.com/v1/messages",
            data=body,
            headers={
                "content-type": "application/json",
                "x-api-key": api_key,
                "anthropic-version": "2023-06-01",
            },
        )
        with urllib.request.urlopen(req, timeout=600) as res:
            return json.loads(res.read())  # already {"content": [...]}
    return answer

if __name__ == "__main__":
    p = argparse.ArgumentParser()
    p.add_argument("folder")
    mode = p.add_mutually_exclusive_group(required=True)
    mode.add_argument("--echo", action="store_true", help="reply with a fixed test message")
    mode.add_argument("--ollama", metavar="MODEL", help="local Ollama, e.g. llama3.2")
    mode.add_argument("--lmstudio", metavar="MODEL", help="local LM Studio")
    mode.add_argument("--gpt4all", metavar="MODEL", help="local GPT4All")
    mode.add_argument("--textgen", metavar="MODEL", help="local text-generation-webui / llama.cpp server")
    mode.add_argument("--anthropic", metavar="MODEL", help="real Claude API (needs ANTHROPIC_API_KEY set)")
    mode.add_argument("--claude-code", action="store_true", help="relay to a local Claude Code CLI (\`claude -p\`) already logged in on this device")
    mode.add_argument("--url", help="forward each round to a Claude-compatible endpoint")
    args = p.parse_args()
    if args.echo:
        fn = echo_model
    elif args.ollama:
        fn = ollama_model(args.ollama)
    elif args.lmstudio:
        fn = lmstudio_model(args.lmstudio)
    elif args.gpt4all:
        fn = gpt4all_model(args.gpt4all)
    elif args.textgen:
        fn = textgen_model(args.textgen)
    elif args.anthropic:
        fn = anthropic_model(args.anthropic)
    elif args.claude_code:
        fn = claude_code_model()
    else:
        fn = http_model(args.url)
    run_watcher(args.folder, fn)`;

const PRESET_FLAGS = {
  ollama: "--ollama",
  lmstudio: "--lmstudio",
  gpt4all: "--gpt4all",
  textgen: "--textgen",
  anthropic: "--anthropic",
};

// Turns a Settings config into the actual CLI invocation — single source of
// truth for both launchers below, so they can never disagree with each
// other about how a given connector is invoked.
function watcherArgs(config) {
  const connector = config?.connector || "echo";
  if (connector === "custom") return config.url ? `--url "${config.url}"` : "--echo";
  // No model name to pick — claude-code always uses whatever the "claude"
  // CLI on this device is already configured/logged into.
  if (connector === "claude-code") return "--claude-code";
  if (connector === "echo" || !config?.model) return "--echo";
  const flag = PRESET_FLAGS[connector];
  return flag ? `${flag} "${config.model}"` : "--echo";
}

// Double-click launchers so "run the watcher" never requires opening a
// terminal or typing the python invocation — both just cd into the folder
// they live in (so `bridge_watcher.py`'s relative "." resolves correctly
// regardless of where the folder actually is) and run it with whatever
// connector was configured in Settings when the kit was last written.
//
// Both also check for Python first and, if it's missing, offer to install
// it via the OS's own package manager — winget (built into Windows 10 2004+
// and Windows 11, so nothing extra to fetch first) or Homebrew — rather
// than just failing with "'python' is not recognized". This can't happen
// from Vaea itself: a browser tab has no way to install anything on the
// device (the same hard sandboxing boundary that stops it from launching
// the watcher process in the first place — see the setup guide). A local
// script the user runs themselves has no such limit, so that's where this
// lives. Consent is real, not assumed: an explicit y/n prompt gates the
// install before anything runs, on top of whatever winget/Homebrew (and,
// on Windows, UAC) ask on their own.
//
// The .bat below is goto/label-based rather than nested parenthesized
// if-blocks on purpose: cmd.exe parses an entire `( ... )` block up front,
// so a variable both `set` AND read inside the SAME block (the original
// shape here) reads back empty every time — the exact classic gotcha that
// made the "install it? [y/N]" prompt always take the "no" branch
// regardless of what was typed, on every device that actually needed the
// auto-install path (one with Python missing; a device that already has
// Python never hits the buggy branch at all, hence "works on some devices,
// not others"). Sequential goto/label lines read a just-`set` variable
// correctly with no such trap, and don't need `setlocal
// enabledelayedexpansion` either, which some locked-down environments
// disable. Also checks `python --version` (a real invocation), not `where
// python` — Windows registers a Microsoft Store stub under that name by
// default even with no real Python installed, which `where` would find and
// report as "present" while it isn't actually usable.
export function buildBatLauncher(config) {
  return `@echo off\r
cd /d "%~dp0"\r
\r
python --version >nul 2>nul\r
if not errorlevel 1 goto :run\r
\r
echo Python wasn't found on this device.\r
set /p INSTALL_PY="Install it now via winget? [y/N] "\r
if /I "%INSTALL_PY%"=="y" goto :install\r
echo Skipped. Install Python yourself from https://python.org/downloads, then run this again.\r
pause\r
exit /b 1\r
\r
:install\r
where winget >nul 2>nul\r
if errorlevel 1 goto :nowinget\r
winget install -e --id Python.Python.3.12 --scope user --accept-package-agreements --accept-source-agreements\r
echo.\r
echo Python installed. Close this window and double-click run_watcher.bat again so it picks up the new install.\r
pause\r
exit /b 0\r
\r
:nowinget\r
echo winget isn't available on this device either. Install Python from https://python.org/downloads, then run this again.\r
pause\r
exit /b 1\r
\r
:run\r
python bridge_watcher.py . ${watcherArgs(config)}\r
pause\r
`;
}

export function buildShLauncher(config) {
  return `#!/bin/bash
cd "$(dirname "$0")"
if ! command -v python3 &>/dev/null; then
  echo "Python 3 wasn't found on this device."
  read -p "Install it now via Homebrew? [y/N] " INSTALL_PY
  if [[ ! "$INSTALL_PY" =~ ^[Yy]$ ]]; then
    echo "Skipped. Install Python yourself from https://python.org/downloads, then run this again."
    read -p "Press Enter to close..."
    exit 1
  fi
  if ! command -v brew &>/dev/null; then
    echo "Homebrew isn't installed either. Install it from https://brew.sh, or get Python directly from https://python.org/downloads, then run this again."
    read -p "Press Enter to close..."
    exit 1
  fi
  brew install python3
  echo "Python installed."
fi
python3 bridge_watcher.py . ${watcherArgs(config)}
`;
}

const CONNECTOR_LABELS = {
  ollama: "Ollama",
  lmstudio: "LM Studio",
  gpt4all: "GPT4All",
  textgen: "text-generation-webui / llama.cpp server",
  anthropic: "the real Claude API",
  "claude-code": "a local Claude Code CLI",
};

export function buildReadme(config) {
  const connector = config?.connector || "echo";
  let statusBlock;
  if (connector === "custom" && config.url) {
    statusBlock = `Configured to forward to: ${config.url}`;
  } else if (connector === "claude-code") {
    statusBlock = `Configured to forward to ${CONNECTOR_LABELS[connector]} ("claude -p" on this device) — no
API key, uses whatever session the "claude" CLI is already logged into.`;
  } else if (connector !== "echo" && connector !== "custom" && config?.model) {
    statusBlock = `Configured to forward to ${CONNECTOR_LABELS[connector]}, model "${config.model}".${
      connector === "anthropic"
        ? " Set ANTHROPIC_API_KEY in your terminal before running the launcher — Vaea never stores or sees this key, it only lives in your own shell."
        : ""
    }`;
  } else {
    statusBlock = `No model is configured yet, so the launcher runs in --echo test mode — it
replies with a fixed message so you can confirm the wiring works. Pick a
local model in Settings -> AI Model -> Backdoor Mode, then click "Update
watcher files" to bake it in here.`;
  }

  return `Backdoor Mode — this folder is already wired up.

Vaea wrote these files the moment you connected this folder:

  bridge_watcher.py     the watcher script (see the comment at its top)
  run_watcher.bat       double-click to run it on Windows
  run_watcher.command   double-click to run it on Mac (first time only:
                         right-click -> Open, since it isn't signed; or run
                         "chmod +x run_watcher.command" once in a terminal)

No Python installed? The launchers check for it themselves and offer to
install it for you (winget on Windows, Homebrew on Mac) — you'll get a real
yes/no prompt before anything installs.

"This app can't run on your PC" when you double-click run_watcher.bat? On a
work/managed device this is almost always Group Policy, AppLocker, or
Windows Defender Application Control blocking unsigned scripts launched
from Explorer — not a Vaea bug, and not fixable by editing the script.
Ask IT to allow it, or open Command Prompt/PowerShell yourself and run
"python bridge_watcher.py . --..." directly — that's often not caught by
the same rule, since it targets double-click execution of .bat/.cmd/.ps1
specifically, not python.exe itself.

${statusBlock}

Built in, no scripting required: Ollama, LM Studio, GPT4All,
text-generation-webui/llama.cpp's server, and a local Claude Code CLI all
answer directly the moment you pick them in Settings — Vaea already knows
how to talk to each one. Something else, or want to see the file protocol
itself? The full setup guide (Settings -> AI Model -> "Set up your local
watcher script") covers it.

Already have a coding agent open in your editor (Copilot Chat, Cursor,
Claude Code, Windsurf, anything with real file read/write tools) and would
rather hand it one prompt by hand than run a persistent watcher process at
all? See AGENT_RELAY_INSTRUCTIONS.md, also in this folder — paste something
like "check backdoor/prompts and answer what's there, per
AGENT_RELAY_INSTRUCTIONS.md" into it.
`;
}

// The manual-relay path for anyone who'd rather hand ONE prompt to a coding
// agent already open in their editor than run a persistent watcher process
// at all — the exact scenario that led to bridge_watcher.py's own
// --claude-code mode existing (a fully automated version of this same idea,
// for Claude Code specifically), written up here in plain language so it
// works for any agent with real file read/write tools, not just Claude
// Code's own scriptable -p mode.
export function buildAgentRelayInstructions() {
  return `AGENT_RELAY_INSTRUCTIONS.md — for a coding agent already open in your editor
(GitHub Copilot Chat, Cursor, Windsurf, Claude Code, or anything similar with
real file read/write tools) to answer ONE pending Vaea Chat message by hand,
instead of running bridge_watcher.py as a persistent background process.

If you're the coding agent and the user just pointed you at this file (e.g.
"check backdoor/prompts and answer what's there, per
AGENT_RELAY_INSTRUCTIONS.md"), here's exactly what to do:

1. List the files in prompts/ in this same folder. For each one that has no
   same-named file yet in responses/ (that means it's still unanswered):

2. Read it — it's JSON shaped like {"round": N, "messages": [...]}. Only
   round 0's file also carries "system" and "tools" (they're identical on
   every round of one turn, so Vaea only writes them once). If you're
   looking at a round > 0 file and don't already have system/tools from
   earlier in this same session, go read the matching round 0 file instead
   — check prompts/<same-id>-r0.json first, then
   processed/prompts/<same-id>-r0.json if Vaea has already filed it away.

3. The LAST item in "messages" is the real question/request to answer right
   now — treat it exactly like the user asked you directly, using "system"
   as the app's own instructions for how to behave.

4. You have your own real tools (reading files, searching, etc.) — use them
   freely if they'd genuinely help you answer well. Do NOT use them to
   directly create, edit, or delete anything as a way of accomplishing what
   the user asked. The ONLY way to make Vaea actually do something is a
   "tool_use" block in your response, using one of the tools listed in
   "tools" and matching its input_schema exactly. Vaea's own app applies it
   afterward, with its own confirmation step for anything destructive —
   that gate has to stay real regardless of who or what answered this
   prompt.

5. Write your answer to responses/<the exact same filename> as raw JSON:
   {"content": [...]}, where each item is either
   {"type": "text", "text": "..."} for a plain reply, or
   {"type": "tool_use", "id": "toolu_1", "name": "TOOL_NAME", "input": {...}}
   for an action.

6. Don't delete the prompt file yourself — Vaea moves the pair into
   processed/ automatically once it reads your answer. If your reply
   included a tool_use block, Vaea runs it and writes the NEXT round's
   prompt file on its own; check prompts/ again and repeat from step 1 if a
   new one appears.

Prefer this to be fully automatic instead of triggered by hand each time?
If your agent is Claude Code specifically, bridge_watcher.py's own
--claude-code mode already does exactly this in a loop — no per-message
prompting needed. See the full setup guide (Settings -> AI Model -> "Set up
your local watcher script") for details.
`;
}
