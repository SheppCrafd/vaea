Portfolio Tracker — native executables
=========================================

HOW TO RUN

  Windows:      double-click PortfolioTracker-Windows.exe
  Linux:        chmod +x PortfolioTracker-Linux && ./PortfolioTracker-Linux
                (or just run it — many file managers can launch an
                executable directly if you mark "allow executing as program"
                in its Properties)

Each is a single native executable with the Node.js runtime AND the entire
app embedded inside it. Nothing else is required — no Python, no
PowerShell scripting, no Node.js install, no companion files. Safe to
rename, move, or email on its own, and works from any folder.

Running it starts a small local server and opens the app in your default
browser at http://127.0.0.1:4173 (or the next free port after it). Close
the terminal/console window (or press Ctrl+C in it) to stop the app.

WHY THIS EXISTS ALONGSIDE standalone/*.bat and *.sh

  Those two are much smaller (a few hundred KB vs. ~45-50MB here) because
  they lean on what the OS already ships (PowerShell on Windows, Python 3
  on Linux/macOS) instead of carrying their own runtime. These executables
  trade that size for having literally zero external dependencies — nothing
  needs to already be installed on the machine running them. Pick whichever
  fits: the small scripts for a quick share where the recipient's machine is
  a known quantity, these executables when you want the strongest "it will
  just run" guarantee, or don't want a console window flashing PowerShell/
  Python commands.

  Because they bundle a full Node runtime, some antivirus tools may be more
  suspicious of these than of the tiny scripts (packed/bundled executables
  are a common pattern for both legitimate tools and malware, and static
  heuristics can't always tell the difference) — and being unsigned, Windows
  SmartScreen may still show a warning ("Windows protected your PC" → "More
  info" → "Run anyway"). There's no way to avoid that without paying for a
  code-signing certificate.

YOUR DATA / THE AI CHAT WIDGET

  Same as the script launchers — see the root standalone/README.txt for
  the full explanation. Short version: all your data stays in that
  browser's local storage on your machine, and the AI chat widget is
  present but can't respond (it needs a live Base44 account/session that
  this offline copy doesn't have).

REBUILDING (for developers)

  These are generated, not hand-edited. To regenerate:

    npm run build                    (from the repo root — produces dist/)
    cd standalone/exe && npm install (first time only)
    node build.cjs

  This uses `pkg` (@yao-pkg/pkg). One thing that cost real debugging time
  once, worth knowing if you touch this: pkg only reads package.json's
  "pkg.assets" field when invoked as `pkg .` — invoking it as `pkg
  server.js` silently ignores that config and produces a binary with no
  embedded files. build.cjs already does this correctly; don't "simplify"
  it to `pkg server.js`.
