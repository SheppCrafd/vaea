# Security policy

Vaea is a single-maintainer project. This page explains what's covered, how
to report a problem, and what to expect back.

## Reporting a vulnerability

Email **mwallis31@outlook.com** with a description of the issue, the steps
to reproduce it, and its impact. Please don't open a public GitHub issue for
anything that could put a user's data at risk until it's fixed.

You'll get a reply within a few days. Fixes ship as soon as they're ready —
there's no fixed release train to wait on, since this is a single maintainer
shipping directly. If you'd like credit for the report, say so and where;
otherwise you'll be kept anonymous.

## Safe harbor

Good-faith security research against Vaea won't be treated as a violation of
any policy, as long as it:

- Only targets your own account and your own data,
- Doesn't degrade the service for other users (no load testing, no denial
  of service),
- Doesn't access, modify, or destroy another user's data, and
- Is reported to the address above before any public disclosure.

## What's in scope

- The hosted app at https://vaea.base44.app
- The source at https://github.com/SheppCrafd/vaea
- The `base44/functions/` server-side functions (`aiChatStream`,
  `deactivateAccount`)

## What's out of scope

- Base44's own hosted infrastructure (authentication, hosting, its
  platform-level APIs) — report those to Base44 directly, not here.
- Third-party AI providers (Anthropic, OpenAI, Google, xAI) when used in
  bring-your-own-key mode — Vaea's browser code talks to them directly; a
  provider-side issue is theirs to fix.
- Anything that requires physical access to a user's own device, or a
  compromised local machine.

See `docs/threat-model.md` for the fuller breakdown of what's defended
against and what residual risk remains, and `/security` on the site for the
plain-language version.

_Last updated 2026-09-14._
