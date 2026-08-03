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
#   python bridge_watcher.py . --url http://host/custom-endpoint
#
# Or import it and bring your own model entirely (see "Forwarding to a real
# model" in the setup guide):
#   from bridge_watcher import run_watcher
#   run_watcher(".", my_answer_function)

import argparse, json, os, time, urllib.request
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

def run_watcher(root, answer, interval=5):
    responses = Path(root) / "responses"
    print(f"Watching {Path(root) / 'prompts'} every {interval}s...")
    while True:
        for name, request in scan_new_prompts(root):
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
export function buildBatLauncher(config) {
  return `@echo off\r
cd /d "%~dp0"\r
where python >nul 2>nul\r
if %errorlevel% neq 0 (\r
  echo Python wasn't found on this device.\r
  set /p INSTALL_PY="Install it now via winget? [y/N] "\r
  if /I not "%INSTALL_PY%"=="y" (\r
    echo Skipped. Install Python yourself from https://python.org/downloads, then run this again.\r
    pause\r
    exit /b 1\r
  )\r
  where winget >nul 2>nul\r
  if %errorlevel% neq 0 (\r
    echo winget isn't available on this device either. Install Python from https://python.org/downloads, then run this again.\r
    pause\r
    exit /b 1\r
  )\r
  winget install -e --id Python.Python.3.12 --accept-package-agreements --accept-source-agreements\r
  echo.\r
  echo Python installed. Close this window and double-click run_watcher.bat again so it picks up the new install.\r
  pause\r
  exit /b 0\r
)\r
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
};

export function buildReadme(config) {
  const connector = config?.connector || "echo";
  let statusBlock;
  if (connector === "custom" && config.url) {
    statusBlock = `Configured to forward to: ${config.url}`;
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

${statusBlock}

Built in, no scripting required: Ollama, LM Studio, GPT4All, and
text-generation-webui/llama.cpp's server all answer directly the moment you
pick them in Settings and type the model's name — Vaea already knows how to
talk to each one. Something else, or want to see the file protocol itself?
The full setup guide (Settings -> AI Model -> "Set up your local watcher
script") covers it.
`;
}
