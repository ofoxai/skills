# Changelog

All notable changes to the **cloudflare-drop** skill. Versioning follows SemVer;
this skill starts at 1.0.0 and self-increments PATCH per iteration.

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
