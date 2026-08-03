// The actual files Backdoor Mode drops into a freshly-connected folder
// (localBridgeStorage.js's writeWatcherKit) — the point being "just choose a
// folder" gets you all the way to a runnable watcher with nothing to copy,
// paste, or hand-type. bridge_watcher.py is the single source of truth for
// what BackdoorModeSetupGuidePage.jsx shows and what actually lands on disk,
// so the two can never drift apart.

export const BRIDGE_WATCHER_SCRIPT = `#!/usr/bin/env python3
# bridge_watcher.py — the prebuilt Backdoor Mode watcher, written into this
# folder automatically the moment you connected it in Vaea. The folder
# inspection lives here once, so it never has to be re-written per script:
# a prompt counts as NEW only while it has no response yet, which makes
# restarts safe — answered prompts are never re-answered, even before Vaea
# files the pair away into processed/.
#
#   python bridge_watcher.py . --echo     # wiring test, no model
#   python bridge_watcher.py . --url http://localhost:11434/v1/messages
#
# Or import it and bring your own model (see "Forwarding to a real model" in
# the setup guide):
#   from bridge_watcher import run_watcher
#   run_watcher(".", my_answer_function)

import argparse, json, time, urllib.request
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

// Double-click launchers so "run the watcher" never requires opening a
// terminal or typing the python invocation — both just cd into the folder
// they live in (so `bridge_watcher.py`'s relative "." resolves correctly
// regardless of where the folder actually is) and run it with whatever
// endpoint was configured in Settings when the kit was last written.
export function buildBatLauncher(url) {
  const modeArgs = url ? `--url "${url}"` : "--echo";
  return `@echo off\r\ncd /d "%~dp0"\r\npython bridge_watcher.py . ${modeArgs}\r\npause\r\n`;
}

export function buildShLauncher(url) {
  const modeArgs = url ? `--url "${url}"` : "--echo";
  return `#!/bin/bash\ncd "$(dirname "$0")"\npython3 bridge_watcher.py . ${modeArgs}\n`;
}

export function buildReadme(url) {
  return `Backdoor Mode — this folder is already wired up.

Vaea wrote these files the moment you connected this folder:

  bridge_watcher.py     the watcher script (see the comment at its top)
  run_watcher.bat       double-click to run it on Windows
  run_watcher.command   double-click to run it on Mac (first time only:
                         right-click -> Open, since it isn't signed; or run
                         "chmod +x run_watcher.command" once in a terminal)

${url
    ? `Configured to forward to: ${url}`
    : `No model endpoint is configured yet, so the launcher runs in --echo
test mode — it replies with a fixed message so you can confirm the wiring
works. Add your model's URL in Settings -> AI Model -> Backdoor Mode, then
click "Update watcher files" to bake it in here.`}

Prefer the terminal, or need a shape bridge_watcher.py doesn't speak
natively? The full setup guide (Settings -> AI Model -> "Set up your local
watcher script") covers the file protocol and how to bring your own model
call.
`;
}
