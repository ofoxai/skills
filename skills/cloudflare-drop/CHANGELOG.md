# Changelog

All notable changes to the **cloudflare-drop** skill. Versioning follows SemVer;
this skill starts at 1.0.0 and self-increments PATCH per iteration.

## 2.0.0 — Wrangler CLI backend, honest TTL, playwright path removed

**Breaking**: the headless-playwright dropzone upload is gone (`references/upload.mjs`,
`references/upload-flow.md`, `test/upload-static.test.mjs` deleted). Cloudflare's own
"For AI agents" guidance on cloudflare.com/drop now tells agents to use Wrangler for
local CLI workflows, and the dropzone DOM had changed such that the browser flow
returned `NO_URL_FOUND` on every attempt. v1 explicitly predicted this switch.

- **`references/wrangler.mjs`** (new) — CLI backend. Detects which hosting mode can
  actually work (`CLOUDFLARE_API_TOKEN` → permanent account deploy; nothing → 60-min
  `--temporary` preview) instead of guessing and retrying, since wrangler refuses
  `--temporary` under existing auth and refuses a normal deploy non-interactively
  without a token. Parses the deployed URL and claim link out of real output.
- **OAuth pause** — a machine with a browser `wrangler login` deadlocks: too
  authenticated for a preview, not authenticated enough to deploy non-interactively.
  The config is moved aside for the deploy and restored in a `finally` — with a test
  asserting restoration **after a thrown deploy**. Opt out with `--no-pause-oauth`.
- **`references/ttl.mjs`** (new) — single source of truth for the countdown window.
  `--ttl` / `$CLOUDFLARE_DROP_TTL` accept `s/m/h/d` (bare numbers = minutes), and
  the default stays **60m** — deliberately. A longer default is dead configuration:
  previews clamp it away and permanent deploys inject no countdown at all, so it
  would never reach a reader. `--ttl` is for *shortening* the window; outliving the
  hour is a hosting-mode decision (token → permanent), not a TTL setting.
  The TTL is explicitly a *display*, not a lifetime:
  `honestTtl()` clamps any window over 60m on a temporary preview (printing
  `TTL_CLAMPED`), and permanent deploys get **no countdown at all** — a countdown on
  a link that never dies is as dishonest as 180m on one that dies at 60.
- **`deploy.mjs`** — rewritten around the CLI: `--ttl` / `--name` / `--permanent` /
  `--no-pause-oauth`, prints `MODE` so the caller can state permanent vs temporary,
  and only archives temporary deploys (a permanent url never needs renewing).
  `renew` takes `--ttl`. Self-verify backoff and the deploy index are unchanged;
  the 1.0.2 content self-verify (size + sentinel, single verification exit for
  deploy AND renew) is folded into the wrangler pipeline in the 2.0.0 merge.
- **`idFromUrl` fixed for the new URL shape** (found by dogfooding the release):
  wrangler urls are `<worker>.<account>.workers.dev` with no `drop-` segment, so
  the old regex fell through and stored the ENTIRE url as the index key — `renew
  <worker-name>` could then never find its entry. Now keys on the first host label,
  with the legacy `drop-{id}` shape still recognised so old entries stay renewable.
- **`renew` keeps the original worker name**, so a renewed link stays recognisable
  (it was landing on `page.<account>.workers.dev` from the temp staging filename).
- **Tests**: 55 passing after the merge with 1.0.2. New `ttl.test.mjs`
  (parse/precedence/clamp/format) and
  `wrangler.test.mjs` (mode detection, flag assembly, and the credential-restoration
  guarantees). Existing renew assertions now bind to `DEFAULT_TTL_SECONDS` instead of
  a hard-coded 3600, so changing the default no longer breaks the suite.

## 1.0.2 — renew integrity, content self-verify, portable home, claim etiquette (round-015 feedback)

From round-015 e2e feedback (A3: a 33.7KB page renewed to a 1.8KB head-only husk;
A6: a blank/truncated page still 200'd and was reported as success; U1a: the skill
hardcoded a host-app path layer and assumed playwright was installable; U1b: a
claim/permanent-link pitch was tacked onto ordinary deliveries).

- **Renew content integrity (A3)**: the countdown block is now fenced by a unique
  comment pair, so `stripCountdown` excises exactly it and never the page body.
  The old content-shape regex spanned the page's own `<style>`/`<div>`/`<script>`
  and ate everything between them — renewing a full page down to a head-only husk.
- **Content self-verify (A6)**: `deployHtmlString` verifies the served page's byte
  size (vs the source, allowing the injected countdown's growth) AND a body
  sentinel after the HTTP 200 backoff — a blank/truncated 200 now fails loudly as
  `URL_UNVERIFIED`. Both fresh deploy and renew route through this single
  verification exit, so no caller hand-`sleep`+curls.
- **Portable home (U1a)**: `resolveHome` is exactly two layers —
  `$CLOUDFLARE_DROP_HOME` > `~/.cloudflare-drop/`. The host-app middle layer and
  its instance detection are gone; an embedding app integrates purely by injecting
  `CLOUDFLARE_DROP_HOME`. Playwright is loaded lazily via `ensurePlaywright`, which
  fails with an explicit install-guidance error when it's missing/uninstallable.
- **Claim etiquette (U1b)**: `renew` surfaces `RENEW_COUNT` (the `renewed_from`
  chain depth) and offers the claim/permanent link ONLY at the 3rd renew of the
  same content; every other delivery is just the link + a one-line expiry reminder.

## 1.0.1 — deploy index + renew + self-verify backoff (round-014 spec 05)

From round-013 feedback (#96: a v1 link expired before the user opened it;
#89: self-verify hit edge-propagation 404s and pushed retries onto the caller).

- **Content-addressed deploy index** (`references/drop-index.mjs`): every deploy
  writes an `index.jsonl` entry keyed on the URL's `drop-{id}` segment
  (title/summary/deploy-time/`expires_at`/`claim_url`/`sha256`) plus a
  content-addressed HTML copy at `artifacts/<sha256>.html` (identical content
  deduped). The index home resolves in layers — `$CLOUDFLARE_DROP_HOME` >
  (hal2099) `~/.hal2099-<inst>/drop/` > (standalone) `~/.cloudflare-drop/` — and
  refuses the skill dir or a session workspace (both non-durable).
- **`node deploy.mjs renew <url|id>`**: rebuilds an expired link from the index —
  reads the archived copy, strips the stale countdown, re-injects a fresh one,
  redeploys, records `renewed_from`, and returns the NEW url. An unarchived id
  fails loudly (no silent guess). Renew is honest that Drop can't revive the
  original url and points at the claim link for permanence.
- **Self-verify backoff** (#89): the post-deploy 200-check now polls with
  escalating gaps (~5 tries, ~60s budget) to ride out Drop's edge propagation
  before reporting `URL_UNVERIFIED` — the caller no longer hand-retries.

## 1.0.0 — first release

Publish a static site to Cloudflare Drop and get a live, shareable
`*.workers.dev` URL in seconds — no account, no build, no config.

- **Packaged headless-playwright backend** (`references/deploy.mjs`) as the
  default path — one command, no hand-driving a browser: inject the countdown →
  stage `index.html` at the zip root → upload via `setInputFiles` → read the
  real URL from the DOM → curl-self-verify HTTP 200 before reporting.
- **60-minute expiry countdown baked into the page** (top-right pill): the
  viewer sees when the link dies, not just the person who received the caption.
  A pre-deploy guard injects it if the page lacks one; colors go through `:root`
  vars (light/dark ready).
- **Three real-machine gotchas encoded** as guards: the Terms-of-Service dialog
  appears only *after* upload; the deploy is slow (poll ≥120s); only `/` serves
  (so `index.html` must be the zip root).
- **Reads the URL from the DOM, never invents it**; **fails open** (deliver the
  file) rather than guess a link.
- Proven end-to-end on real `cloudflare.com/drop`.
