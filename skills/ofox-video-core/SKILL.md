---
name: ofox-video-core
description: Shared execution layer for the Ofox video generation API (api.ofox.ai) — creates a video job, polls it to completion, downloads the finished mp4 from a persistent CDN URL, and reports the real cost. This is a library skill, not a standalone user-facing one — it is invoked by scenario skills such as seedance-short-drama and seedance-ad-creative, which build model/prompt/resolution choices for a specific use case and then call into this skill's script rather than re-implementing the API calls. Load this skill directly only when a user explicitly names the Ofox video API, asks to call it with specific low-level parameters, or asks to debug/resume a stuck or failed Ofox video job by job id — for a plain scenario request ("make me a short drama scene", "generate a cinematic ad clip"), use the relevant scenario skill instead, which itself depends on this one.
license: MIT
metadata:
  author: ofoxai
  version: "1.0.1"
---

# ofox-video-core: Ofox video API execution layer

Wraps the Ofox video generation API (`https://api.ofox.ai/v1/videos`) behind
one script: submit a job, poll it to a terminal state, download the result,
report the exact cost. Scenario skills (`seedance-short-drama`,
`seedance-ad-creative`) call into this rather than duplicating API logic.

## Safety contract (non-negotiable)

- `OFOX_API_KEY` is read **only from the shell environment** — never from a
  dotenv file, never hardcoded in a script or a skill file.
- **Never print, log, or echo the raw key value** — not in chat, not in a
  file, not in a command you show the user, not in verbose curl output.
  `references/ofox-video.sh` never uses `curl -v`/`--trace` for exactly this
  reason (those would print the `Authorization` header). If you need to
  show that a key is configured, say "OFOX_API_KEY is set" — never the value.
- Never write the key into any file this skill (or a skill built on it)
  creates, including logs, cost reports, or committed code.
- **Check once, then proceed.** Run the availability/key check at most once
  per session (see below). If it passes, don't re-prompt for the key on
  every subsequent call in that session.
- **Fail open on a missing key** — guide the user to get one, don't dead-end
  the conversation. A missing key means "can't call the paid API yet," not
  "stop talking to me."

## Availability check

Before the first call in a session, verify the environment:

```bash
bash references/ofox-video.sh check
```

This checks `curl`, `jq`, and `OFOX_API_KEY` and exits `0` only if all three
are present — it makes no network call. Handle each failure mode plainly:

- **`curl` missing** (rare — usually preinstalled): `brew install curl`
  (macOS) or `sudo apt-get install curl` (Debian/Ubuntu), else
  https://curl.se/download.html.
- **`jq` missing**: `brew install jq` (macOS) or `sudo apt-get install jq`
  (Debian/Ubuntu), else https://jqlang.org/download/.
- **`OFOX_API_KEY` missing**: tell the user to get one at
  `https://app.ofox.ai` (log in → Settings → API Keys → Create New Key,
  shown once), then `export OFOX_API_KEY=...` in their shell. Offer this
  once, plainly, and move on — don't repeat the pitch on every message.

## Invoking the script

```bash
bash references/ofox-video.sh generate --prompt "..." [OPTIONS]
bash references/ofox-video.sh poll JOB_ID [--out-dir DIR]
```

`generate` builds the request, validates parameters client-side (rejecting
bad `resolution`/`aspect_ratio`/`duration` combinations before any network
call), submits it, polls to a terminal state, downloads the video into
`--out-dir` (default: the current directory), and prints:

```
STATUS completed
JOB_ID <id>
VIDEO_PATH <path/to/file.mp4>
VIDEO_SECONDS <billed seconds>
VIDEO_COST <exact cost from usage.video_cost>
```

Download source: `mirror_urls` (CDN-signed, persistent) when present,
falling back to `unsigned_urls` (documented as temporary, may expire within
24h) when `mirror_urls` is absent or empty — this is not just a theoretical
fallback, real completed jobs have been observed with no `mirror_urls` field
at all. Once downloaded, the result is a local file either way, so a video
saved from `unsigned_urls` should be treated identically to one saved from
`mirror_urls` from this point on — the expiry window no longer matters once
the file is on disk.

Key flags: `--model` (default `bytedance/seedance-2.5`), `--duration`,
`--resolution`, `--aspect-ratio`, `--size`, `--generate-audio true|false`,
`--seed`, `--frame-first-image URL`, `--frame-last-image URL`,
`--real-person true|false`, `--callback-url`, `--extra-json '<json>'`
(advanced fields not covered by a flag, e.g. `input_references`,
`provider`), `--max-wait SECONDS` (default 540), `--poll-interval SECONDS`
(default 6). Full parameter reference: `references/api-params.md`. Pricing
and the cost-estimate formula: `references/pricing.md`.

Report results honestly, the same way `cloudflare-drop` reports its mode:
state which model/resolution/duration/aspect ratio were **actually used**
(not just requested) and the **actual** `VIDEO_COST` — never invent a cost
number or claim a video is ready without a real `VIDEO_PATH` from the
script.

## The no-resubmit rule (non-negotiable)

**Never re-run `generate` for the same logical request just because it's
taking a while or a tool call timed out.** A create call that gets any HTTP
response has already either made the job (billable) or been rejected
(not billable) — running `generate` again for "the same video" risks a
second, separately billed job.

If `generate`'s own poll loop hits its time budget (job still
`pending`/`queued`/`in_progress`), it exits with the job id and prints
exactly this instruction — follow it:

```bash
bash references/ofox-video.sh poll JOB_ID
```

If a Claude Code tool call itself times out while `generate` is still
running (the script hasn't printed a result yet), the job may still be
mid-flight upstream — you won't have the job id from stdout in that case.
Don't guess or re-submit; tell the user the request may still be
processing and that checking `https://app.ofox.ai` for recent jobs is the
safe way to find its id and resume with `poll`.

If the create call itself gets an ambiguous network failure (curl exits
nonzero with **no HTTP response at all** — exit code `5`), the script
explicitly refuses to guess whether a job was created. Don't auto-retry;
tell the user to check `https://app.ofox.ai` first.

## Error handling

The script maps every documented `error.code` (never `error.message` — that
text isn't a stable contract) to a fixed, actionable message and a distinct
exit code:

| Exit | Meaning |
|---|---|
| `0` | Success — video downloaded, cost printed. |
| `1` | Usage/parameter validation error — no network call was made. Fix the flag and retry `generate` freely. |
| `2` | Environment error — `curl`/`jq`/`OFOX_API_KEY` missing. Fix the environment, no job was attempted. |
| `3` | The API rejected the request, or the job ended `failed`/`cancelled`/`expired`. The mapped message explains why (see `references/api-params.md` for the full error-code table). |
| `4` | Timed out waiting for a terminal state. The job is still running — `poll JOB_ID`, do not `generate` again. |
| `5` | Ambiguous network failure on create — no HTTP response received. Do not auto-retry; check the dashboard first. |

## For scenario skills built on this

`seedance-short-drama` and `seedance-ad-creative` invoke this skill's
script (typically `../ofox-video-core/references/ofox-video.sh` relative to
their own directory) rather than duplicating any of the request-building,
polling, error-mapping, or download logic above. They own the
scenario-specific prompt template, recommended parameter defaults, and the
pre-generation cost estimate (using `references/pricing.md`'s formula); this
skill owns the mechanics of talking to the API correctly and safely.
