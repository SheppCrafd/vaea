# Local Mode: code-signing roadmap (scoping only, not started)

Local Mode already has two working paths around Group Policy/AppLocker/WDAC
blocking unsigned `.bat`/`.py` execution on managed Windows devices:

- **Terminal-first launch** (shipped): typing `python bridge_watcher.py . --...`
  into an already-open, already-trusted terminal instead of double-clicking
  the launcher — see `LocalModeSetupGuidePage.jsx` and `buildReadme()` in
  `bridgeWatcherKit.js`.
- **Local HTTP provider** (shipped): the browser calls a local model server
  (Ollama, LM Studio) directly via `fetch()` — no separate process launches at
  all, so no policy engages. See `providers.js`'s `local-http` entry.

Neither covers the remaining case: a device with **no network reachability at
all**, not even to `localhost` (genuinely air-gapped), where some process
still has to poll the prompts/responses folders and that process itself needs
IT's trust before it can run. That's what this scopes.

## What it would take

**1. A code-signing certificate.** An Authenticode certificate from a public
CA (DigiCert, Sectigo, etc.), ideally EV (Extended Validation) since EV certs
get instant SmartScreen reputation instead of building it up over time from
download volume. Real recurring cost (roughly $300–500/year for standard,
more for EV) and a real identity-verification process for whoever the
certificate is issued to — this has to be a real legal entity, not a
placeholder.

**2. A compiled, signed binary instead of a raw `.py`/`.bat`.** Package
`bridge_watcher.py` with PyInstaller (or similar) into a single `.exe`, then
sign it with the certificate via `signtool sign`. This becomes the artifact
IT reviews and allowlists — not the Python source. Means adding a build step
somewhere (could be a one-off local build, doesn't need CI unless releases
become frequent).

**3. A signing pipeline, even a minimal one.** The private key can't live in
the repo or in a browser-writable folder — needs a real secrets story
(a password-protected `.pfx` kept offline, or a cloud HSM/signing service).
Worth deciding *before* buying a cert, since key-handling mistakes here are
hard to walk back (a leaked signing key means revoking and re-issuing).

**4. IT-facing documentation for the allowlist request.** Even a signed
binary generally still needs an org to explicitly trust it once — either by
publisher/certificate rule (added org-wide, no per-device work after that) or
by hash rule (has to be redone every time the binary changes). A one-page doc
explaining what the binary does, what it doesn't do (no telemetry, no network
calls beyond what the user's own chosen model needs), and the exact
publisher/thumbprint to allowlist would materially speed up getting this past
an actual IT department.

## What this is not

Not a way to make an *unsigned* script run somewhere it's currently blocked —
that would be circumventing a security control IT put there on purpose, which
isn't something to build regardless of how much friction it removes. This is
the legitimate version: get IT's actual, informed trust once, org-wide,
through the standard mechanism (a verified publisher signature) — the same
way any other vetted desktop tool earns its way onto a managed device.

## Recommendation

Not worth building until an actual air-gapped enterprise user hits this
specific wall — terminal-first launch and the Local HTTP provider already
cover the far more common "networked but script-execution-blocked" case for
free. If/when it comes up: buy a standard (not EV) cert first as the cheapest
way to test whether publisher-rule allowlisting is what a real prospective
org actually wants, before committing to the ongoing EV/HSM overhead.
