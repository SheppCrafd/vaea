# Changelog

All notable changes to Vaea, in [Keep a Changelog](https://keepachangelog.com/en/1.1.0/)
style. Vaea ships continuously rather than in numbered releases, so entries
are grouped by date instead of a version number.

## 2026-09-14

### Added

- A `/security` page, `SECURITY.md`, `security.txt`, and a threat model
  (`docs/threat-model.md`) — the security controls in place, known
  limitations stated plainly, and how to report a problem.
- `CHANGELOG.md` (this file).

## 2026-08-31

### Changed

- FocusFeed redesigned as a real to-do list with an inline row editor.
- Project card layout pass: full-card masonry, mini-card square clamp,
  high-contrast empty task bar, "Show on card" toggles for built-in fields.
- A new Notepad surface with per-product consolidated notes and an AI
  summary.
- Marketing: dropped the standalone `/product` page and folded self-hosting
  into `/privacy` as "Local Mode."

### Removed

- Vaea Meetings — removed entirely rather than left half-working; the app
  says plainly that meeting-transcript support isn't available.

## 2026-08-26 – 2026-08-30

### Changed

- The marketing site was rebuilt from scratch: tropical/coastal-photography
  redesign, real coastal photography across every sub-page, a redesigned
  404 page, and a professional-writing pass to cut hobby-voice phrasing.
- Every marketing demo now renders the real app component with fixture
  data, not a lookalike.

## 2026-08-27 – 2026-08-28

### Added

- New `/pricing`, `/compare`, and `/about` marketing pages, plus a formal
  `/privacy-policy` and `/terms`.
- An interactive Vaea Brain hero graph and working terminal copy buttons.

### Changed

- Vaea Chat renamed and its marketing page rebuilt, alongside new Brain,
  Workplace, and self-hosting pages.

### Removed

- The "Vaea is free" claim, site-wide, and the `/pricing` page — every
  feature is available to every user, so a pricing page implied tiers that
  don't exist.

## 2026-08-17

### Added

- A hand-built maintainer profile card on `/about`, sourced from the public
  SheppCrafd Gravatar profile — avatar, bio, GitHub, and contact address.

## 2026-07-24 – 2026-07-28

### Added

- Bring-your-own-key chat: connect an Anthropic, OpenAI, Google, or xAI
  account and Vaea Chat talks to it directly from the browser, with no
  server in between.
- Local Mode: run Vaea Chat against a model on your own machine (or Claude
  Code, via a small relay skill) with no outbound request at all.
- Vaea Vault: an optional connection to a user's own notes repository,
  read and written directly by the assistant.

## 2026-07-22 – 2026-07-23

### Changed

- Renamed to Vaea (full rebrand — repo, remote, folder, and branding).
- Project data moved off browser `localStorage` entirely, onto a real
  local file-backed store (dev) or a device-storage layer with File System
  Access support (everywhere else). `localStorage` is now read once, as a
  legacy carry-forward for returning users, and never written to again.

---

Earlier history is available in the [commit log](https://github.com/SheppCrafd/vaea/commits/main).
