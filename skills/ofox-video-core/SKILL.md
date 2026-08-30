---
name: ofox-video-core
description: Shared execution layer for the Ofox video generation API (api.ofox.ai) — creates a video job, polls it to completion, downloads the finished mp4 from a persistent CDN URL, and reports the real cost. This is a library skill, not a standalone user-facing one — it is invoked by scenario skills such as seedance-short-drama, seedance-ad-creative, and seedance-product-video, which build model/prompt/resolution choices for a specific use case and then call into this skill's script rather than re-implementing the API calls. Load this skill directly only when a user explicitly names the Ofox video API, asks to call it with specific low-level parameters, or asks to debug/resume a stuck or failed Ofox video job by job id — for a plain scenario request ("make me a short drama scene", "generate a cinematic ad clip"), use the relevant scenario skill instead, which itself depends on this one.
license: MIT
version: "1.2.0"
homepage: https://github.com/ofoxai/skills/tree/main/skills/ofox-video-core
metadata:
  author: ofoxai
  version: "1.2.0"
  openclaw:
    requires:
      env: [OFOX_API_KEY]
      bins: [curl, jq]
    primaryEnv: OFOX_API_KEY
    envVars:
      - name: OFOX_API_KEY
        required: true
        description: Ofox API key. Create one at https://app.ofox.ai (Settings -> API Keys). The same key works across every Ofox skill.
    emoji: "🎬"
    homepage: https://github.com/ofoxai/skills/tree/main/skills/ofox-video-core
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
`--resolution`, `--aspect-ratio` (includes `adaptive` — see below), `--size`,
`--generate-audio true|false`, `--seed`, `--frame-first-image URL|PATH`,
`--frame-last-image URL|PATH`, `--real-person true|false`, `--callback-url`,
`--extra-json '<json>'` (advanced fields not covered by a flag, e.g.
`input_references`, `provider`), `--max-wait SECONDS` (default 540),
`--poll-interval SECONDS` (default 6). Full parameter reference:
`references/api-params.md`. Pricing and the cost-estimate formula:
`references/pricing.md`.

### Image-to-video: local files, remote URLs, and the `adaptive` aspect ratio

`--frame-first-image`/`--frame-last-image` accept either a remote
`http://`/`https://` URL (used as-is) or a local, readable file path — the
script auto-detects a local file and base64-encodes it into a
`data:image/<ext>;base64,...` URI before building the request (content-type
inferred from the file extension, `image/jpeg` as the safe default when the
extension isn't recognized). **Prefer a local file when one is available**:
real testing found at least one otherwise-valid, publicly reachable image
URL rejected by the upstream provider with a download-failure-shaped error,
while the same image worked reliably once base64-encoded — likely
bot/hotlink protection on some hosts, not something under our control.

Local files of any realistic size are supported: the base64 data URI is
built into the request body via a temp file and `jq --rawfile`/`--slurpfile`
and posted to the API via `curl --data-binary @file`, never via a `jq
--arg`/`--argjson` or `curl -d` **command-line** value. An earlier version
of this script did the latter and broke on any real photo whose base64
encoding exceeded the OS's `ARG_MAX` (roughly any real photo over ~750KB) —
verified with a real 885KB PNG (1,179,996-byte base64 encoding) failing
with `jq: Argument list too long` before any network call was made. Fixed
2026-08-29; see `.trellis/spec/skills/external-api-integration.md` for the
general lesson.

**`bytedance/seedance-2.5` (the default model) requires `aspect_ratio:
"adaptive"` for any image-to-video request** — every other value fails,
verified across multiple real attempts. When `--frame-first-image` or
`--frame-last-image` is set and the effective model is
`bytedance/seedance-2.5` (including the default, if `--model` wasn't
passed), the script **forces** `aspect_ratio` to `adaptive` regardless of
what `--aspect-ratio` was passed or left unset, and always prints a
one-line `NOTE:` to stderr explaining the override — it never does this
silently. This does not apply to other models (e.g.
`bytedance/seedance-2.0` works with image-to-video without this
requirement) — don't assume the requirement generalizes beyond
`bytedance/seedance-2.5` without separately verifying it.

Report results honestly, the same way `cloudflare-drop` reports its mode:
state which model/resolution/duration/aspect ratio were **actually used**
(not just requested) and the **actual** `VIDEO_COST` — never invent a cost
number or claim a video is ready without a real `VIDEO_PATH` from the
script.

**Always state the full `VIDEO_PATH` as its own standalone line in your
reply to the user** — not folded into a sentence or buried mid-paragraph.
The script always resolves `--out-dir` to an absolute path before printing
`VIDEO_PATH`, so relay that absolute path exactly as printed; the file's
location is the actual deliverable here, and the user should be able to
find it without re-deriving your working directory.

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

The script maps every documented `error.code` to a fixed, actionable
message and a distinct exit code. `error.message` (the upstream's own free
text) is **not** a stable contract to branch logic on, but it can carry a
specific, useful detail the generic mapped explanation doesn't (e.g. a
minimum reference-image width) — so the script always prints it too,
labeled `Upstream message: ...`, alongside the mapped explanation, not only
when `error.code` itself is absent or unrecognized.

| Exit | Meaning |
|---|---|
| `0` | Success — video downloaded, cost printed. |
| `1` | Usage/parameter validation error — no network call was made. Fix the flag and retry `generate` freely. |
| `2` | Environment error — `curl`/`jq`/`OFOX_API_KEY` missing. Fix the environment, no job was attempted. |
| `3` | The API rejected the request, or the job ended `failed`/`cancelled`/`expired`. The mapped message explains why (see `references/api-params.md` for the full error-code table). Includes `output_moderation_failed` — a **post-generation** failure (the job ran, its output failed a content check afterward), **not billed** (no `usage` field on the response), safe to fix by submitting a new `generate` call with a different prompt/reference — that's a new request, not a resubmission of the failed one. |
| `4` | Timed out waiting for a terminal state. The job is still running — `poll JOB_ID`, do not `generate` again. |
| `5` | Ambiguous network failure on create — no HTTP response received. Do not auto-retry; check the dashboard first. |
| `6` | `--out-dir` could not be created or entered (bad path, permissions) — a local filesystem problem, not an API problem. If this happened during `generate`, the job itself is unaffected (already created or still running server-side); do not re-run `generate`. Fix `--out-dir` and re-run `poll JOB_ID --out-dir <a writable directory>`. |

## For scenario skills built on this

`seedance-short-drama`, `seedance-ad-creative`, and `seedance-product-video`
invoke this skill's script (typically
`../ofox-video-core/references/ofox-video.sh` relative to their own
directory) rather than duplicating any of the request-building, polling,
error-mapping, or download logic above. They own the scenario-specific
prompt template, recommended parameter defaults, and the pre-generation
cost estimate (using `references/pricing.md`'s formula); this skill owns
the mechanics of talking to the API correctly and safely.

## Compatible with existing prompt-writing skills

This skill is an execution layer, not a director layer — it does not compete
with skills that specialize in writing Seedance prompts, it just runs
whatever prompt it's given. If the user already has a well-crafted prompt
from a "director" skill such as
[`LeoYeAI/seedance-skills`](https://github.com/LeoYeAI/seedance-skills) or
[`liyue-aigc/seedance-2-5-video-director`](https://github.com/liyue-aigc/seedance-2-5-video-director),
pass that prompt straight to `ofox-video.sh generate` — there's no need to
run this repo's own scenario-specific prompt-crafting steps (the ones
`seedance-short-drama`/`seedance-ad-creative`/`seedance-product-video`/
`seedance-anime-drama` each document) on top of a prompt that's already been
written. Those scenario skills exist for users who don't already have a
prompt and want one built for them; treat an existing director-skill output
as a ready-to-use prompt, not raw material to rewrite.
