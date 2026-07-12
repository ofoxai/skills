# Changelog

All notable changes to the **cloudflare-drop** skill. Versioning follows SemVer;
this skill starts at 1.0.0 and self-increments PATCH per iteration.

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
