# Threat model

What Vaea defends against, how, and what risk is left over. Written for
anyone deciding whether to trust it with real work — a security reviewer, an
enterprise buyer's IT team, or a curious user. Plain-language companion at
`/security` on the site; the formal reporting process is in `SECURITY.md`.

Vaea's architecture already removes a category of risk other tools carry:
project data lives in files on the user's own device by default, so there is
no company database of everyone's work to steal. The entries below cover
what's left — the hosted pieces (sign-in, chat, opt-in cloud sync) and the
AI features.

## 1. Compromised Base44 account

- **Threat:** An attacker gains access to a user's Base44-hosted sign-in
  (password reuse, phishing, a leaked session token).
- **Impact:** Chat history is exposed. If the user opted into cloud storage,
  their project data is exposed too. The attacker could also send chat
  messages as that user, triggering approved actions if they also control
  the confirm step.
- **Likelihood:** Low-to-moderate — depends entirely on the user's own
  credential hygiene, since sign-in is Base44's hosted login (Google,
  Microsoft, Apple, or email), not a Vaea-built auth system.
- **Mitigation:** Vaea doesn't handle passwords or sessions itself — it
  inherits Base44's auth, including whatever MFA options the identity
  provider (Google/Microsoft/Apple) offers. Cloud-stored project data is
  row-level-security scoped per user. Every chat action still requires an
  explicit approve step in the UI before it runs.
- **Residual risk:** A user who reuses a weak password and skips MFA on
  their identity provider is exposed regardless of anything Vaea does.
  Device-local users (the default) have no cloud project data to lose even
  in this scenario — only chat history.

## 2. XSS / injection via stored project data

- **Threat:** A user (or an attacker who gets to write to a shared field)
  puts a script payload or malicious markup into a project name, task
  title, or note, hoping it executes when rendered.
- **Impact:** Could run arbitrary script in the viewing user's session if
  unescaped.
- **Likelihood:** Low — Vaea is single-user by design (no shared team
  spaces, no collaborators writing into someone else's board), which
  removes the classic multi-tenant XSS vector. The main exposure is a
  malicious CSV import or vault note a user brings in themselves.
- **Mitigation:** React escapes rendered text by default; project fields
  are rendered as text, not `dangerouslySetInnerHTML`. CSV import
  (`src/lib/csv.js`, `csvImport.js`) parses fields as plain strings.
- **Residual risk:** Any future feature that renders user content as raw
  HTML or Markdown would need its own sanitization pass — noted here so it
  isn't missed later.

## 3. AI chat data exposure to the model provider

- **Threat:** A chat message sends a snapshot of the current board to an AI
  provider (the built-in model, or a bring-your-own-key provider) so it can
  answer. That snapshot could contain sensitive project details.
- **Impact:** The provider's servers see that data for the duration of the
  request. Depending on the provider's own retention policy, it could be
  logged or used to improve their models unless the user's account settings
  say otherwise.
- **Likelihood:** Happens by design, every time chat is used outside Local
  Mode — this is a known, disclosed tradeoff, not a bug.
- **Mitigation:** Vaea itself never persists the snapshot server-side — it's
  sent for that one request and discarded on Vaea's side. A visible privacy
  notice (the info icon in both chat surfaces) says this in the product.
  Users who want zero exposure can run Local Mode, which answers chat
  entirely on their own machine with no outbound request.
- **Residual risk:** Whatever the chosen AI provider does with the request
  on their end is between the user and that provider — Vaea discloses this
  rather than controls it. BYOK users should check their own provider's
  data-use terms.

## 4. Local Mode: device loss and the backup gap

- **Threat:** Project data lives only in files on one device by default.
  If that device is lost, stolen, or its disk fails, the data goes with it.
- **Impact:** Total loss of project data for a user who never enabled cloud
  sync or took their own backup.
- **Likelihood:** Moderate over a long enough time horizon — this is the
  direct tradeoff of "no server holding your data."
- **Mitigation:** `backupSnapshots.js` keeps same-day local rollback
  snapshots (capped at 8) for undo safety, not disaster recovery. CSV
  export is available at any time. Cloud sync is offered as an explicit,
  reversible opt-in for users who want off-device redundancy.
- **Residual risk:** A device-local user who never exports or syncs is
  trusting their own device's reliability. This is disclosed plainly on
  `/privacy` rather than hidden behind a false sense of "it's saved
  somewhere."

## 5. Bring-your-own-key handling

- **Threat:** A user's AI provider API key (Anthropic, OpenAI, Google, xAI)
  is exposed or misused.
- **Impact:** Unauthorized use of the user's AI account, potentially
  running up their own usage costs.
- **Likelihood:** Low under normal use — the key never leaves the user's
  own device.
- **Mitigation:** BYOK keys are stored via `deviceStorage.js`, the same
  local-only storage pattern as project data — never sent to Vaea's own
  servers, never included in the cloud-sync payload. The browser talks to
  the provider directly (`anthropicAdapter.js` / `openaiCompatibleAdapter.js`).
- **Residual risk:** Malware or another user with access to the same
  browser profile could read the stored key, the same as any locally-held
  credential. Standard device hygiene applies.

## What this doesn't cover

Base44's own infrastructure security (hosting, its login system's internals)
is out of scope here — see `SECURITY.md` for what's in scope for reports to
this project specifically.

_Last updated 2026-09-14._
