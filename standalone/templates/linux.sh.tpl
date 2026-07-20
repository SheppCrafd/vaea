#!/usr/bin/env bash
set -u

SELF="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/$(basename "${BASH_SOURCE[0]}")"
WORKDIR="$(mktemp -d "${TMPDIR:-/tmp}/portfolio-tracker.XXXXXX")"
APPDIR="$WORKDIR/app"
PAYLOAD="$WORKDIR/payload.b64"
mkdir -p "$APPDIR"

cleanup() { rm -rf "$WORKDIR"; }
trap cleanup EXIT

awk '/^#__PAYLOAD_START__$/{found=1;next} found' "$SELF" > "$PAYLOAD"

PYTHON=""
if command -v python3 >/dev/null 2>&1; then
  PYTHON=python3
elif command -v python >/dev/null 2>&1; then
  PYTHON=python
fi

if [ -z "$PYTHON" ]; then
  echo ""
  echo "This launcher needs Python 3 (used only to run a tiny local web server)."
  echo "Install it from https://www.python.org/downloads/ (or via your system's"
  echo "package manager, e.g. 'sudo apt install python3'), then run this script again."
  echo ""
  read -rp "Press Enter to exit..." _
  exit 1
fi

SERVER_PY="$WORKDIR/serve.py"
cat > "$SERVER_PY" <<'PYEOF'
import base64
import http.server
import io
import os
import sys
import tarfile
import webbrowser

PAYLOAD_PATH = sys.argv[1]
APP_DIR = sys.argv[2]
START_PORT = 4173
MAX_ATTEMPTS = 20

os.makedirs(APP_DIR, exist_ok=True)
with open(PAYLOAD_PATH, 'rb') as f:
    raw_b64 = f.read()
tar_bytes = base64.b64decode(raw_b64)
with tarfile.open(fileobj=io.BytesIO(tar_bytes), mode='r:gz') as tf:
    tf.extractall(APP_DIR)


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=APP_DIR, **kwargs)

    def translate_path(self, path):
        # SPA fallback: any route that isn't a real file goes to index.html
        # so client-side routing (react-router) still works on refresh/deep link.
        resolved = super().translate_path(path)
        return resolved if os.path.isfile(resolved) else os.path.join(APP_DIR, 'index.html')

    def log_message(self, fmt, *args):
        pass


def find_server():
    for port in range(START_PORT, START_PORT + MAX_ATTEMPTS):
        try:
            return http.server.ThreadingHTTPServer(('127.0.0.1', port), Handler), port
        except OSError:
            continue
    raise SystemExit('Could not find a free port.')


server, port = find_server()
url = f'http://127.0.0.1:{port}'
print('')
print('  Portfolio Tracker is running.')
print(f'  {url}')
print('')
print('  All your data is stored locally in this browser only -- nothing')
print('  is sent to a server. The AI chat widget is included but needs a')
print('  Base44 account to work.')
print('')
print('  Press Ctrl+C to stop the app.')

try:
    webbrowser.open(url)
except Exception:
    pass

try:
    server.serve_forever()
except KeyboardInterrupt:
    pass
PYEOF

"$PYTHON" "$SERVER_PY" "$PAYLOAD" "$APPDIR"
exit 0

#__PAYLOAD_START__
__PAYLOAD_B64__
