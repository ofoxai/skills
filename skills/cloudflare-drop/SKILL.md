---
name: cloudflare-drop
description: Publish a static site (a folder or zip of HTML/CSS/JS/images/fonts) to Cloudflare Drop and get back a live, shareable URL in seconds — no account, no build, no config. Use when you have a finished static page or site and need to hand someone a link they can open on any device, and a 60-minute ephemeral preview is enough (reports, mockups, one-off landing pages, AI-generated HTML, "give me a link I can share"). Cloudflare Drop has no API or CLI yet, so this runs a packaged headless-playwright script (references/deploy.mjs) that uploads via setInputFiles and reads back the real drop-{id}.{words}.workers.dev URL from the DOM — one command, no hand-driving a browser. It bakes a 60-minute expiry countdown into the page (top-right) so the viewer knows when the link dies, always flags the expiry, and fails open (deliver the file) rather than invent a link. For permanent hosting, claim the deployment or use Cloudflare Pages/Workers instead.
license: MIT
metadata:
  author: ofoxai
  version: "1.0.1"
---

# cloudflare-drop: publish a static site as a shareable link, no account

**Cloudflare Drop** (`cloudflare.com/drop`, shipped July 2026) is the fastest way
to turn a folder of static files into a live URL: drag a folder or zip onto the
page and Cloudflare serves it from its edge at
`https://drop-{id}.{words}.workers.dev` in seconds — **no login, no build step, no
config**. The catch: the deployment is a **60-minute ephemeral preview**. Within
that hour you can share it or *claim* it (sign in) to keep it; after 60 minutes an
unclaimed drop expires.

That trade-off is the whole point of this skill: it's a frictionless way to hand
someone a **link they can open and share on any device** for a report, a mockup,
an AI-generated page — anything where a one-hour window is enough. For a permanent
home, claim the drop or deploy to Cloudflare Pages/Workers instead.

## The default path: one packaged script (don't hand-drive a browser)

**Cloudflare Drop has no API, CLI, or MCP endpoint** (as of this writing) — the
upload is a browser dropzone. But you do **not** hand-drive a browser step by step
(that was slow and error-prone). The default is a **packaged headless-playwright
script** proven on real Drop:

```bash
npx playwright install chromium   # once, if the chromium binary isn't cached
node references/deploy.mjs <page.html>
```

`deploy.mjs` does the whole thing in one shot: injects the 60-minute expiry
countdown into the page → stages it as `index.html` at a clean zip root → uploads
via `setInputFiles` (reliable, no OS drag) → **reads the real
`*.workers.dev` URL from the DOM** → curl-self-verifies HTTP 200 before printing
`RESULT_URL` / `CLAIM_LINK` / `EXPIRY_EPOCH`. It never invents a URL and never
reports one that didn't 200.

Why a script, not a live-driven browser: Drop is an **anonymous dropzone — no login
state** — so headless playwright is faster, deterministic, and needs no resident
browser. Hand-driving a browser (e.g. hal-chrome) is only worth it for a
**login-required** site; Drop isn't one. See `references/upload-flow.md` for the
low-level dropzone details and the fallback backends.

> This skill does exactly one thing — deploy a static site to Cloudflare Drop and
> return a temporary URL. Choosing between a temporary link and a permanent host,
> and any credential onboarding that a permanent host needs, belong to **hal-html**
> (the delivery orchestrator), not here.

## When to use

- You (or a colleague) produced a **static page or site** — a report, dashboard,
  plan, infographic, landing page, AI-generated HTML — and someone needs a
  **link they can open and share**, not a raw `.html` file to download.
- A **60-minute preview is enough**: sharing a result, a quick review, a mockup,
  a "look at this" link. This is proof/preview hosting, not a permanent home.
- You have **some** browser-automation capability available.

## When NOT to use

- **You need the link to last** beyond an hour and can't claim it → use Cloudflare
  Pages or Workers (a real deploy with a stable domain), not Drop.
- The deliverable is **not a static site** (a dynamic app with a server, an
  image, a PDF, a zip *for the user to download*) → this is the wrong tool.
- You have **no browser automation at all** → you can't drive the dropzone; say so
  and offer the file instead (see fail-open below).

## The core disciplines (get these right, everything else follows)

### 1. Go to the right place, don't guess the URL

The entry point is exactly **`https://cloudflare.com/drop`**. Do not guess
`drop.cloudflare.com` or any other host — a wrong/lookalike host is where you'd
upload content to the wrong place. If the page doesn't look like Cloudflare's
dropzone (a big drop-a-folder-or-zip area, Cloudflare branding), **stop** and
re-check rather than uploading.

### 2. Don't fight the literal "drag" — target the file input

Automating a real drag of an **OS file** onto a **web dropzone** is unreliable:
most in-page "drag" primitives simulate drags *within* the DOM, not from the
operating system's file system. Every real dropzone is backed by an
`<input type="file">`. **The reliable path is to set that input's file(s)
directly** with your backend's upload primitive (e.g. claude-in-chrome
`file_upload`, Playwright `setInputFiles`, a native file-chooser handler). Only if
there is genuinely no file input do you fall back to a simulated drag — and expect
friction. Details and per-backend mapping: `references/upload-flow.md`.

**Always upload a folder (or a zip of it), never a bare file.** Drop deploys a
*site*, so it wants a directory whose root is served. Even a single HTML file goes
**inside** a clean folder as `index.html` — stage it, then upload that folder (or
zip the folder and upload the zip). Don't hand the dropzone a lone `report.html`
and hope; make it `index.html` at a folder root first, so the deployed URL serves
the page directly. A page that references local assets (CSS/JS/images/fonts) must
be uploaded **with those assets** in the same folder, or the deployed page renders
broken. When in doubt across backends, **zip the folder and upload the one zip** —
it's the most portable move (see `references/upload-flow.md`).

### 3. Read the real URL from the page — never transcribe or invent it

After the upload settles, the page shows the live URL, shaped like
`https://drop-{id}.{words}.workers.dev`, next to a copy button and a
`Claim (59:xx)` countdown. **Extract that URL from the DOM** (read the link
element's `href`/value, or the copy-target), not by eyeballing a screenshot — so you
hand back the exact string. If you cannot find a `*.workers.dev` URL on the page,
the drop did **not** succeed: do not invent one (see fail-open).

### 4. Always tell the user it's a 60-minute preview

This is not optional honesty — it's the defining property of the link. When you
deliver, state plainly that it's a **temporary preview that expires in ~60 minutes**
and how to keep it (claim it via the claim link, or move to Pages/Workers for a
permanent home). Handing over a `workers.dev` URL as if it were permanent is a
silent failure waiting to happen an hour later.

### 5. Fail open and stay honest

If the browser isn't available, the page won't load, the upload fails, or no URL
appears — **say so plainly and offer the fallback**: *"I couldn't get it published
to Cloudflare Drop just now — want me to send you the HTML file instead?"* Never
fake success, and **never invent a `*.workers.dev` link**. A made-up URL is worse
than an honest failure.

## Check availability first

This skill's "underlying tool" is **a working browser-automation surface** — Drop
has no CLI to check. Before you start, confirm you actually have one:

- You can drive a browser (navigate to a URL, read the DOM, set a file input) via
  *some* backend — claude-in-chrome, Playwright/Puppeteer, Selenium, a dedicated
  browser profile (e.g. hal-chrome), or a generic `computer`-style tool.
- That backend can reach the public internet and load `https://cloudflare.com/drop`.

If you have **no** browser automation, or it can't reach the page, you can't drive
the dropzone — **fail open**: tell the user plainly and offer to send the HTML
file instead (or deploy via another route). Don't stall pretending you'll get to
it; say what you can't do and offer the fallback.

## The flow, end to end

1. **Stage the site as a clean folder** (always a folder, even for one file).
   Single file → copy it to `index.html` inside a fresh directory. Multi-file site
   → make sure the folder holds the entry `index.html` plus every asset it
   references. Then upload that folder, or zip it and upload the zip (most portable).
2. **Open `https://cloudflare.com/drop`** in your browser surface. Confirm it's the
   real Cloudflare dropzone.
3. **Accept the terms dialog** if one appears.
4. **Upload the folder/zip via the file input** (not a literal OS drag). See
   `references/upload-flow.md` for your backend's exact primitive.
5. **Wait for the deploy to finish** — it's seconds. The page swaps to a result
   view with the live URL, a copy button, and the `Claim (59:xx)` countdown.
6. **Read the `https://drop-{id}.{words}.workers.dev` URL from the DOM.** Optionally
   grab the "Copy claim link" URL too, so you can offer the user a way to keep it.
7. **Deliver the URL with the 60-minute caveat.** Example reply:
   > "Here's the live preview: `https://drop-ab12.brave-lion.workers.dev` — opens
   > on any device, shareable. Heads-up: it's a Cloudflare Drop preview, so it
   > **expires in ~60 minutes**. Want it kept permanently? I can give you the claim
   > link (sign in to keep it), or deploy it to Cloudflare Pages for a stable URL."

## Renewing an expired link (the 60-minute window ran out)

A Drop link dies after 60 minutes. When someone comes back to an expired link,
you don't have to re-run the whole pipeline by hand — every deploy is **archived
to a content-addressed index**, so one command rebuilds and redeploys it:

```bash
node references/deploy.mjs renew <old-url|id>
```

What it does: resolves the `drop-{id}` from the url → reads the deploy index →
takes the archived HTML copy → **strips the stale countdown and re-injects a
fresh one** → redeploys → records `renewed_from` (the chain back to the
original) → prints the **NEW** url, claim link, expiry, and `RENEWED_FROM`.

**Expectation honesty — renew returns a *new* url, not the original.** Drop
cannot revive a dead link; a renew is a fresh deploy of the same content, so the
`*.workers.dev` address changes. Say this plainly when you deliver a renewed
link, and offer the **claim link** as the way to make it permanent (claiming is
the only escape from the 60-minute cycle). If the id was never archived (deployed
before indexing, or from another machine), renew **fails loudly** — it won't
guess or invent a link.

### The deploy index, briefly

- **Home** resolves in layers: `$CLOUDFLARE_DROP_HOME` > (hal2099)
  `~/.hal2099-<inst>/drop/` > (standalone) `~/.cloudflare-drop/`. It is **never**
  the skill dir or a session workspace — those get committed or cleaned up, so an
  index there would dangle.
- **`index.jsonl`** — one line per deploy, keyed on the drop id
  (title/summary/deploy-time/`expires_at`/`claim_url`/`sha256`/`renewed_from`).
- **`artifacts/<sha256>.html`** — a content-addressed copy of the deployed page;
  identical content is stored once (sha256 dedupe).
- **Pruning** (keep it small, don't over-build a GC): artifacts are
  content-addressed, so it's safe to periodically delete old files —
  `find <home>/artifacts -mtime +2 -delete`. An expired drop can't be renewed
  once its content is gone anyway, and a fresh deploy re-archives.

## v2 / upgrade path (keep this in mind)

v1 drives the browser because that's the only surface Drop exposes today. **The
moment Cloudflare ships an API, CLI, or MCP for Drop, switch to programmatic
upload** — it'll be faster and more reliable than driving a dropzone. Until then,
the browser path is the honest, working way, and this skill is the placeholder that
already knows the flow.

## Anti-patterns

- **Guessing the URL** (`drop.cloudflare.com`, etc.) instead of going to the exact
  `cloudflare.com/drop` — you can end up uploading to the wrong or a lookalike host.
- **Fighting the literal OS-file drag** when the reliable move is to target the
  `<input type="file">` directly.
- **Handing back a `workers.dev` URL without the 60-minute caveat** — it silently
  breaks an hour later. Always flag the expiry.
- **Inventing a `*.workers.dev` link** or claiming success when no URL appeared —
  fail open and offer the file instead.
- **Transcribing the URL from a screenshot** instead of reading it from the DOM —
  read the exact string so you don't hand over a typo'd link.
- **Using Drop for something that must persist** — for a permanent link, claim the
  drop or use Pages/Workers; don't pretend a 60-minute preview is permanent hosting.
- **Uploading a page without its assets** — a lone `index.html` that references
  `style.css`/`app.js`/images renders broken; upload the whole folder.
