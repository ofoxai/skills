# Changelog

All notable changes to the **cloudflare-drop** skill. Versioning follows SemVer.

## 2.1.0 — `--no-countdown`

- New `--no-countdown` flag: skip baking the countdown banner into the page.
  The real expiry is unchanged — a temporary preview still dies at 60 minutes
  and the CLI still prints `EXPIRY_EPOCH`; only the on-page banner is omitted.
  For when the reader finds the banner noisy and the operator owns the
  claim-before-expiry responsibility. Covered by `cli-args.test.mjs` (57 tests
  passing).

## 2.0.0 — Wrangler CLI backend, honest TTL, playwright path removed

**Breaking**: the headless-playwright dropzone upload is gone. The dropzone DOM
changed and silently returned no URL, and Cloudflare's own "For AI agents"
guidance says to use Wrangler for local CLI workflows — v1 predicted this switch.

- **`wrangler.mjs`** (new): detects the hosting mode that can actually work —
  `CLOUDFLARE_API_TOKEN` → permanent account deploy; no credentials → 60-min
  `--temporary` preview. The OAuth config is moved aside during the deploy
  (wrangler refuses `--temporary` under existing auth) and restored in a
  `finally`; opt out with `--no-pause-oauth`.
- **`ttl.mjs`** (new): single source of truth for the countdown window
  (`--ttl` / `$CLOUDFLARE_DROP_TTL`, units `s/m/h/d`, bare number = minutes).
  The TTL is a display, not a lifetime: over 60m on a preview is clamped
  (`TTL_CLAMPED`); permanent deploys get no countdown at all. The default stays
  60m — `--ttl` shortens the window, never extends it; outliving the hour is a
  hosting-mode decision (token → permanent).
- **`deploy.mjs`** rewritten around the CLI: prints `MODE`, archives only
  temporary deploys. The 1.0.2 content self-verify (size + sentinel) is the
  single verification exit for deploy AND renew.
- **`idFromUrl`** re-keyed for the `<worker>.<account>.workers.dev` shape
  (legacy `drop-{id}` urls stay renewable); **`renew` keeps the original worker
  name** so a renewed link stays recognisable.
- Tests: 55 passing (new `ttl.test.mjs`, `wrangler.test.mjs`).

## 1.0.2 — renew integrity, content self-verify, portable home, claim etiquette

- **Renew integrity**: the countdown block is fenced by a unique comment pair,
  so `stripCountdown` excises exactly it — a renew can no longer eat the page
  body (a 33.7KB page had renewed down to a 1.8KB head-only husk).
- **Content self-verify**: after the HTTP 200 backoff, the served page must
  match the source's byte size (allowing the countdown's growth) and carry a
  body sentinel — a blank/truncated 200 fails loudly as `URL_UNVERIFIED`.
- **Portable home**: exactly two layers, `$CLOUDFLARE_DROP_HOME` >
  `~/.cloudflare-drop/`; the host-app middle layer is gone.
- **Claim etiquette**: `RENEW_COUNT` is surfaced and the claim/permanent link
  is offered only at the 3rd renew of the same content — every other delivery
  is just the link + a one-line expiry reminder.

## 1.0.1 — deploy index + renew + self-verify backoff

- **Content-addressed deploy index**: every deploy writes an `index.jsonl`
  entry plus a deduped HTML copy at `artifacts/<sha256>.html`, never inside the
  skill dir or a session workspace.
- **`renew <url|id>`**: rebuilds an expired link from the archive, re-stamps
  the countdown, records `renewed_from`, and returns the NEW url (Drop can't
  revive the original). An unarchived id fails loudly.
- **Self-verify backoff**: the post-deploy 200-check polls with escalating gaps
  (~5 tries, ~60s budget) to ride out edge propagation before reporting
  `URL_UNVERIFIED`.

## 1.0.0 — first release

Publish a static site to Cloudflare Drop and get a live, shareable
`*.workers.dev` URL in seconds — no account, no build, no config. Packaged
headless-playwright upload, a 60-minute expiry countdown baked into the page,
real-machine gotchas encoded as guards, the URL read from the DOM (never
invented), and fail-open delivery (offer the file rather than guess a link).
Proven end-to-end on real `cloudflare.com/drop`.
