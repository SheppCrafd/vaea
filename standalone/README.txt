Portfolio Tracker — standalone launchers
==========================================

HOW TO RUN

  Windows:      double-click PortfolioTracker-Windows.bat
  macOS/Linux:  open a terminal and run:
                  ./PortfolioTracker-Linux.sh
                (if that says "permission denied", run:  bash PortfolioTracker-Linux.sh)

Each is a single, self-contained file — the entire app is embedded inside
it as data. There is nothing else to download or keep together with it; it
is safe to rename, email, or move on its own.

Running it starts a small local server and opens the app in your default
browser at http://127.0.0.1:4173 (or the next free port after it). Close
the terminal/console window (or press Ctrl+C in it) to stop the app.

REQUIREMENTS

  Windows:      nothing extra — uses PowerShell, which ships with Windows.
  macOS/Linux:  Python 3, which is preinstalled on virtually all modern
                macOS and Linux systems. If it's missing, the script prints
                a link to install it and exits cleanly instead of crashing.

No Node.js, no npm install, no separate build step, no account.

There's also a heavier but zero-dependency alternative in exe/ — native
executables (PortfolioTracker-Windows.exe, PortfolioTracker-Linux) with the
Node.js runtime itself embedded, so even PowerShell/Python aren't required.
~45-50MB each instead of a few hundred KB. See exe/README.txt for details
on when to prefer one over the other.

YOUR DATA

  Everything you create — areas, products, projects, tasks, stakeholders,
  notes — is stored locally in that browser's storage on your machine only.
  Nothing is uploaded anywhere. Using a different browser, or clearing this
  browser's site data, starts you with an empty workspace. (If you're a
  developer running the actual git repo instead of this standalone copy via
  `npm run dev`, data is stored as plain JSON files in a `data/` folder in
  your clone instead — see the main README.md's "Local data storage"
  section. That doesn't apply here; this standalone copy has no dev server
  behind it, so it's always browser storage.)

SIGNING IN

  The live hosted version of this app requires signing in (Base44's own
  Google/Microsoft/Apple/email login). This standalone copy does not — it
  has no Base44 app id baked in, so the login check has nothing to check
  against and the app just opens straight to the dashboard.

THE AI CHAT WIDGET

  The chat bubble is present in the UI, but it won't be able to respond in
  this standalone copy — it's backed by a Base44 serverless function that
  needs an authenticated Base44 account and Base44's own hosting to run,
  neither of which this offline copy has. Everything else in the app works
  normally without it. (When it does work, on the live hosted version, it
  acts on your real local data directly — the same areas/products/projects/
  tasks/etc. you see on the dashboard, not a separate copy somewhere else.
  Your data is sent to an AI service only for the single exchange it takes
  to answer you; nothing about your data is ever stored on a server.)

  If you have (or set up) your own Base44 account and want the AI chat
  working too, you'd need the full source project instead of this file:
  install the Base44 CLI, run `base44 dev` from the project root (it runs
  `npm install` and starts both the frontend and the chat backend together),
  and open the URL it prints.

REBUILDING (for developers)

  These two files are generated, not hand-edited. To regenerate them after
  a source change: `npm run build` (from the project root), then
  `node standalone/build.cjs`. The editable source lives in
  standalone/templates/*.tpl.
