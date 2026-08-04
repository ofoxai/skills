---
name: cloudflare-drop
description: Publish a static site (a folder of HTML/CSS/JS/images/fonts) to Cloudflare and get back a live, shareable URL in seconds. Use when you have a finished static page or site and need to hand someone a link they can open on any device — reports, mockups, one-off landing pages, AI-generated HTML, "give me a link I can share". Runs one packaged command (references/deploy.mjs) built on the Wrangler CLI, which is what Cloudflare's own agent guidance tells agents to use. Deploys permanently to your Cloudflare account when credentials are present, or as a 60-minute claimable preview when they are not — and says plainly which one you got. Bakes an expiry countdown into previews (matched to the real 60-minute limit; --ttl to shorten it), and fails open (deliver the file) rather than invent a link.
license: MIT
metadata:
  author: ofoxai
  version: "2.0.0"
---

# cloudflare-drop: publish a static site as a shareable link

Turn a finished static page into a live URL with one command. Cloudflare serves it
from its edge at `https://<name>.<account>.workers.dev` in seconds.

**Two hosting modes, and the skill picks the one that will actually work:**

| | when | lifetime |
|---|---|---|
| **permanent** | `CLOUDFLARE_API_TOKEN` is set | forever — it's in your account |
| **temporary preview** | no usable credentials | **60 minutes**, unless claimed |

The mode is detected, not guessed, and always reported back — so you never hand
someone a link believing it's permanent when it dies in an hour.

## The one command

```bash
node references/deploy.mjs <page.html> [--ttl 30m] [--name my-report] [--permanent]
```

It resolves the countdown window → stages the page as `index.html` at a clean root
→ deploys via Wrangler → **curl-verifies HTTP 200** → prints:

```
RESULT_URL   https://my-report.ethereal-composer.workers.dev
MODE         temporary
CLAIM_LINK   https://dash.cloudflare.com/claim-preview?claimToken=…
EXPIRY_EPOCH 1785499999
```

It never prints a URL it didn't verify, and never invents one.

> **Why Wrangler and not the browser dropzone**: `cloudflare.com/drop`'s own
> "For AI agents" section instructs agents to prefer Wrangler for local CLI
> workflows. The packaged playwright path was **removed in 2.0.0** — the dropzone
> DOM changed and it silently returned no URL. v1 predicted this switch; this is it.

## Flags

| flag | effect |
|---|---|
| `--ttl 30m` | countdown window shown on the page. Accepts `s`/`m`/`h`/`d`; a bare number is minutes. Default **60m** (the real preview lifetime), or `$CLOUDFLARE_DROP_TTL`. Values above 60m are clamped — see below. |
| `--name my-report` | worker name (becomes the subdomain). Defaults to a sanitized filename. |
| `--permanent` | force a normal (account) deploy. Requires credentials. |
| `--no-pause-oauth` | never touch the local OAuth file (see below). |

## The TTL is a display, not a lifetime

The countdown baked into the page says *how long the link is expected to be
useful*. It does **not** control the real lifetime — Cloudflare does:

- On a **temporary preview**, Cloudflare hard-expires at 60 minutes. A longer TTL
  is **clamped down** and `TTL_CLAMPED` is printed. The page must never promise
  three hours on a link that dies in one.
- On a **permanent deploy**, no countdown is injected at all — a countdown on a
  link that never dies is the same lie in the other direction.

**The default is 60m for exactly this reason.** A longer default would be dead
configuration: previews clamp it away, permanent deploys drop it entirely, so it
would never once reach a reader's screen. `--ttl` is therefore for *shortening*
the window ("this is only good for the next 30 minutes"), not extending it.

**Want a link that outlives the hour?** That's not a TTL problem — set
`CLOUDFLARE_API_TOKEN` and deploy permanently, or claim the preview.

## The OAuth trap (why `--no-pause-oauth` exists)

Wrangler **refuses `--temporary` when it detects any existing auth**, but a
non-interactive shell **can't complete an OAuth login** either. A machine with a
browser-based `wrangler login` therefore deadlocks: too authenticated for a
preview, not authenticated enough to deploy.

The escape is to move the OAuth config aside for the duration of the deploy. This
touches the user's credential file, so it is:

- **opt-out-able** (`--no-pause-oauth`),
- restored in a `finally` block — **even if the deploy crashes**,
- covered by a test that asserts restoration after a thrown deploy.

If you want the permanent path instead, set `CLOUDFLARE_API_TOKEN` (Workers
Scripts: Edit is enough) and the pause never happens.

## Renewing an expired preview

```bash
node references/deploy.mjs renew <old-url|id> [--ttl 30m]
```

Every deploy is archived to a content-addressed index, so a renew rebuilds the
page, strips the stale countdown, stamps a fresh one, and redeploys.

**A renew returns a NEW url** — Cloudflare can't revive a dead link. Say so when
you deliver it, and offer the claim link as the real fix. If the id was never
archived, renew fails loudly rather than guessing.

### The deploy index, briefly

- **Home** resolves in layers: `$CLOUDFLARE_DROP_HOME` > (hal2099)
  `~/.hal2099-<inst>/drop/` > `~/.cloudflare-drop/`. Never the skill dir or a
  session workspace — those get committed or cleaned up, so an index there dangles.
- `index.jsonl` — one line per deploy; `artifacts/<sha256>.html` — deduped copies.
- Pruning is safe and simple: `find <home>/artifacts -mtime +2 -delete`.

## When NOT to use

- The deliverable **isn't a static site** (a server app, an image, a PDF to
  download) → wrong tool.
- You have **no Node/npm** → can't run Wrangler; offer the file instead.

## Delivery discipline

1. **Always state the mode.** Permanent → say it's permanent. Temporary → say it
   expires in ~60 minutes and offer the claim link.
2. **Upload the whole folder for multi-file pages.** A lone `index.html` that
   references `style.css` renders broken. The stager copies siblings automatically.
3. **Fail open, never fabricate.** No URL, failed verify, no Node? Say so plainly
   and offer the HTML file: *"I couldn't publish it just now — want the file?"*
   A made-up `workers.dev` link is worse than an honest failure.
4. **Check the content before publishing.** Deploying makes it publicly reachable
   by URL; don't publish credentials or someone else's private data.

## Anti-patterns

- Handing back a preview URL **without the 60-minute caveat** — it silently breaks
  an hour later.
- **Inventing** a `*.workers.dev` link, or reporting one that never returned 200.
- Passing `--ttl 3h` and then telling the user the link lasts 3 hours — the clamp
  exists precisely because it doesn't. Only a permanent deploy outlives the hour.
- Leaving the user's OAuth config parked (only possible if you bypass the CLI and
  call `deployWithWrangler` yourself without the `finally`).
- Using this for something that must persist without setting a token — use the
  permanent path or Pages/Workers.
- **Uploading a page without its assets** — a lone `index.html` that references
  `style.css`/`app.js`/images renders broken.
