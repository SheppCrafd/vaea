Vaea — standalone launchers
==========================================

HOW TO RUN

  Windows:      double-click Vaea-Windows.bat
  macOS/Linux:  open a terminal and run:
                  ./Vaea-Linux.sh
                (if that says "permission denied", run:  bash Vaea-Linux.sh)

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
executables (Vaea-Windows.exe, Vaea-Linux) with the
Node.js runtime itself embedded, so even PowerShell/Python aren't required.
~45-50MB each instead of a few hundred KB. See exe/README.txt for details
on when to prefer one over the other.

YOUR DATA

  The first time you run it, it asks where to keep your data. It'll offer
  a cloud option too, but that needs signing in — and this standalone copy
  has no sign-in (see below) — so pick the device option: a folder on your
  own computer (Chrome/Edge — pick it once, and everything's saved there as
  real files you can open yourself), or, on other browsers, a file you save
  and load by hand. Nothing is uploaded anywhere. Using a different
  folder/file, or a different browser, starts you with an empty workspace.
  (If you're a developer running the actual git repo instead of this
  standalone copy via `npm run dev`, data is stored as plain JSON files in
  a `data/` folder in your clone instead — see the main README.md's "Local
  data storage" section. That doesn't apply here; this standalone copy has
  no dev server behind it, so it uses the same folder/file storage
  described above.)

SIGNING IN

  The live hosted version of this app requires signing in (Base44's own
  Google/Microsoft/Apple/email login). This standalone copy does not — it
  has no Base44 app id baked in, so the login check has nothing to check
  against and the app just opens straight to the dashboard.

THE AI CHAT WIDGET

  The chat bubble is present in the UI. By default it's backed by a Base44
  serverless function that needs an authenticated Base44 account and
  Base44's own hosting to run — neither of which this offline copy has, so
  that default path won't respond here.

  But this copy's Settings screen (gear icon) is fully reachable — there's
  no login blocking it — and from there you can point chat at a working
  provider instead:

    - Bring your own API key (Settings -> AI Model): add an Anthropic,
      OpenAI, Google, or xAI key and chat runs directly from your browser to
      that provider. No Base44 account or hosting involved at all.
    - Local Mode (Settings -> AI Model): connect a local folder that a
      watcher script on your own machine polls, so chat can run against a
      model you host yourself — no API key, no internet call, fully
      offline. See LocalModeSetupGuidePage in the full app (or the full
      source project's src/pages/LocalModeSetupGuidePage.jsx) for setup.

  Either way, it acts on your real local data directly — the same
  areas/products/projects/tasks/etc. you see on the dashboard, not a
  separate copy somewhere else. With your own API key, your data is sent to
  that provider only for the single exchange it takes to answer you; with
  Local Mode, it never leaves your machine at all. Nothing about your
  data is ever stored on a server either way.

  If you'd rather use the default Base44-hosted chat instead of your own
  key, you'd need the full source project instead of this file: install the
  Base44 CLI, run `base44 dev` from the project root (it runs `npm install`
  and starts both the frontend and the chat backend together), and open the
  URL it prints.

REBUILDING (for developers)

  These two files are generated, not hand-edited. To regenerate them after
  a source change: `npm run build` (from the project root), then
  `node standalone/build.cjs`. The editable source lives in
  standalone/templates/*.tpl.
