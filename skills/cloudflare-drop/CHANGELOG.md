# Changelog

All notable changes to the **cloudflare-drop** skill. Versioning follows SemVer.

## 2.4.0 — Pinned Wrangler, allowlisted deploy environment, staging review

Answers the two findings ClawHub's scanner raised against 2.3.0. Neither was a
false positive; both named a capability that really existed.

**Wrangler is pinned to `4.134.0`** (`references/wrangler.mjs`,
`WRANGLER_VERSION`). It was `wrangler@latest`, so every deploy fetched and
executed whatever npm resolved that minute. The pin was verified on a real
machine before it was written down — `npm exec --yes wrangler@4.134.0 --
--version` printed `4.134.0` and exited 0 — as this repo requires of every
command it publishes. Bumping it is now a reviewable one-line change.

**The deploy subprocess gets an allowlisted environment, not `process.env`.**
It previously saw every variable in the session, including API keys belonging
to other vendors. What it gets now, and why each group is there rather than
guessed at:

- `PATH` / `HOME` / `TMPDIR` plus the Windows equivalents — without them the
  process cannot run at all.
- `HTTP_PROXY` / `HTTPS_PROXY` / `NO_PROXY` (and lowercase) plus
  `NODE_EXTRA_CA_CERTS` — measured, not assumed: the verification run above
  printed *"Proxy environment variables detected. We'll use your proxy for
  fetch requests."* Withholding these would have broken deploys behind a proxy.
- `CLOUDFLARE_API_TOKEN` / `CF_API_TOKEN` (what `detectAuthMode()` reads), plus
  `CLOUDFLARE_ACCOUNT_ID` / `CF_ACCOUNT_ID` / `CLOUDFLARE_API_KEY` /
  `CF_API_KEY` / `CLOUDFLARE_EMAIL` / `CF_EMAIL` (the other auth inputs
  wrangler 4.134.0 reads).
- `WRANGLER_HOME` / `XDG_CONFIG_HOME` / `XDG_CACHE_HOME` — `oauthConfigPath()`
  keys off the first two, so wrangler has to resolve the same paths this skill
  does, or the OAuth pause and wrangler disagree about which file matters.
- `CI`.

**Withheld on purpose**, and worth knowing if you relied on it:
`CLOUDFLARE_API_BASE_URL` / `CF_API_BASE_URL` / `CLOUDFLARE_BASE_URL`, which
redirect the Cloudflare token to a host of someone else's choosing, and
`CLOUDFLARE_INCLUDE_PROCESS_ENV`, which asks wrangler to copy the process
environment into the deployed Worker.

**Callers who need a withheld variable**: name it in
`CLOUDFLARE_DROP_ENV_PASSTHROUGH="NAME1,NAME2"`. The forwarded names are
printed back. A narrowing with no route around it would block work that used to
succeed, which this repo treats as the worse bug — but a silent one reads, to
whoever debugs the next failure, as "wrangler broke", so the withheld count is
printed as a `NOTE` on every run that withholds anything.

**Every deploy prints what it staged, before the upload.** Staging copies the
page's whole sibling directory, recursively, and this skill exists to make a
directory public. The pre-existing filter already dropped `node_modules`,
`.git`, `__MACOSX` and every dotfile — `.env` was never the gap. The gap was the
ordinarily-named file: `secrets.json`, `credentials.txt`, `backup.sql`,
`id_rsa`. New on stderr, before anything is uploaded:

```
STAGED_FILES 7
STAGED_REVIEW 4 of 7 staged files are outside HTML/CSS/JS/images/fonts. …
  SENSITIVE_NAME  secrets.json  (312 bytes)
  UNEXPECTED_TYPE  backup.sql  (24 bytes)
```

A clean run prints `STAGED_FILES n` + `STAGED_REVIEW ok`, so the headline is on
every path and its absence means the review did not run. **It never blocks** —
discipline #3 is fail open, and a staging check that could refuse a deploy would
be a worse defect than the one it prevents.

**New `--assets-only`** (opt-in, off by default): stage only recognised static
assets and print `STAGED_SKIPPED` naming every file left behind.

**Caller-visible changes**: `stageForDrop()` now returns `{files, skipped}`
alongside `{stagedDir, indexPath}`; `deployWithWrangler()` returns
`{envWithheld, envPassedThrough}` and accepts a `note` callback; `deployPage()`
accepts `note`, `run` and `assetsOnly`. Anything reading the CLI's **stdout**
is unaffected — the review goes to stderr, next to the existing
`INDEX_WRITE_SKIPPED`.

**Verified by running the shipped command, not only the suites.** With a
deliberately invalid `CLOUDFLARE_API_TOKEN` (so nothing could be published) and
an unrelated vendor key in the session, `node references/deploy.mjs report.html
--permanent --name drop-smoke-test` printed:

```
STAGED_FILES 5
STAGED_REVIEW 2 of 5 staged files are outside HTML/CSS/JS/images/fonts. …
  UNEXPECTED_TYPE  backup.sql  (24 bytes)
  SENSITIVE_NAME  secrets.json  (18 bytes)
NOTE wrangler runs with 7 allowlisted environment variables; 79 were withheld. …
DEPLOY_FAILED Command failed: npm exec --yes wrangler@4.134.0 -- deploy … --name drop-smoke-test …
  A request to the Cloudflare API (/accounts) failed. Invalid request headers
```

Three things that run confirms and the unit tests cannot: the pinned version is
what actually gets executed, wrangler still starts and still reaches the
Cloudflare API on the narrowed environment (its own *"Proxy environment
variables detected"* warning proves the proxy variables arrived), and the
unrelated key was among the 79 withheld. The same page with `--assets-only`
printed `STAGED_FILES 3`, `STAGED_REVIEW ok`, and `STAGED_SKIPPED 2` naming
`secrets.json` and `backup.sql`.

Tests: 79 passing, including two new falsification suites
(`references/test/wrangler-env.test.mjs`, `references/test/staging-review.test.mjs`).
Each was confirmed by planting the defect it exists to catch — `wrangler@latest`
restored, the full `process.env` handed back to the child, the classifier made
blind, and the review computed but never emitted — and watching it go red, then
green on revert.

## 2.3.0 — Optional server-side access code

- Add `-otp` / `--otp` for permanent deployments. Temporary mode and preview
  renewal reject the flag before uploading; existing unprotected flows are unchanged.
- Gate all HTML/assets through a Worker with signed one-hour sessions and a
  persistent Durable Object guessing budget. Access codes never enter public assets.
- Add a responsive, accessible six-digit verification screen with paste/autofill,
  error, busy and rate-limit states. The public skill UI remains English.
- Verify unauthorized routes, wrong codes and exact authenticated content before
  reporting a protected URL. Remove private staging material after deployment.
- Refuse to overwrite an existing OAuth backup during temporary deployment.

## 2.2.0 — English-only copy, ClawHub metadata

- **Breaking for readers, not for callers**: the countdown banner and
  `formatTtl()` now render in English (`Link expires in 04:12`,
  `Link expired — ask for a fresh one`, `45 minutes`). They previously rendered
  in Chinese, which violated CONTRIBUTING rule 1 — these skills are public and
  international. No flag, argument, or exit code changed; only the strings a
  reader sees. If you were matching the old strings downstream, update them.
- Frontmatter now declares `metadata.openclaw` (node/npx, with
  `CLOUDFLARE_API_TOKEN` and `CF_API_TOKEN` marked optional — without one the
  skill publishes a preview rather than failing) and a top-level `version`,
  which is what ClawHub's publish scanner actually reads.
- Verified with `clawhub skill publish --dry-run` (ok, 14 files packaged) and
  the full suite: 57 tests passing.

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
