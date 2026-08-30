---
name: seedance-anime-drama
description: Turn a novel/script excerpt into an anime- or manga-style storyboard shot using the Ofox image and video APIs — generates one character reference image with ofox-image-core, then reuses that exact same image as `--frame-first-image` across every shot of that character via ofox-video-core, for real visual consistency instead of relying on repeated text description alone. Use when a user asks to turn a story excerpt into an anime video, e.g. "turn this novel excerpt into an anime video", "make an anime-style storyboard clip of this scene", "generate a manga-drama shot with this character", or "turn this chapter into an anime short with the same character in every shot". Do not use for realistic-human dialogue scenes with no anime/manga styling (see seedance-short-drama), silent product/brand shots (see seedance-ad-creative), or plain catalog footage (see seedance-product-video).
license: MIT
version: "1.0.2"
homepage: https://github.com/ofoxai/skills/tree/main/skills/seedance-anime-drama
metadata:
  author: ofoxai
  version: "1.0.2"
  openclaw:
    requires:
      env: [OFOX_API_KEY]
      bins: [curl, jq]
    primaryEnv: OFOX_API_KEY
    envVars:
      - name: OFOX_API_KEY
        required: true
        description: Ofox API key. Create one at https://app.ofox.ai (Settings -> API Keys). The same key works across every Ofox skill.
    emoji: "🎨"
    homepage: https://github.com/ofoxai/skills/tree/main/skills/seedance-anime-drama
---

# seedance-anime-drama: anime/manga storyboard shots with real character consistency

Turns one shot of a novel/script excerpt into an anime- or manga-style video
clip, using a genuine image-based mechanism for character consistency across
every shot of the same character — not just a repeated text description.

This is the first scenario skill in this repo that orchestrates **two**
execution-layer skills rather than one:

1. [`ofox-image-core`](../ofox-image-core/SKILL.md) generates ONE character
   reference image (text-to-image).
2. [`ofox-video-core`](../ofox-video-core/SKILL.md) generates each shot,
   passing that same image back in as `--frame-first-image`.

Neither core skill's request-building, error-mapping, or download/reporting
logic is duplicated here — this skill owns only the anime-specific prompt
craft, the two-step orchestration order, and the combined cost estimate.
**Read both core skills' safety contracts before using this one** — neither
is restated here.

## The mechanism — the whole point of this skill

Generate the character once as an image in Step 1, then pass that **exact
same image file** to `--frame-first-image` on every Step-2 call for every
shot of that character. This is what produces real visual consistency,
instead of `seedance-short-drama`'s text-only approach of repeating the same
description across stateless jobs and hoping the model renders it the same
way twice. Reusing the identical `IMAGE_PATH` is not an optional refinement
of this skill — it is the mechanism this skill exists to provide. See "When
NOT to use" below for the full comparison with `seedance-short-drama`.

## Before generating: two availability checks

Run each once per session (not on every request):

```bash
bash ../ofox-image-core/references/ofox-image.sh check
bash ../ofox-video-core/references/ofox-video.sh check
```

If either fails, follow that core skill's own guidance (install `curl`/`jq`,
or get an `OFOX_API_KEY` at `https://app.ofox.ai`) — don't dead-end the
conversation, and don't re-run either check on every subsequent request once
both have passed.

## One job = one continuous shot

Seedance 2.5 generates a single continuous clip per job (4–30 seconds). A
multi-scene "storyboard" from a novel excerpt maps to **one `generate` call
per shot** — never try to cram multiple hard cuts into one call. If a story
beat spans multiple hard cuts (e.g. an establishing shot then a close-up),
either:

- describe it as one continuous camera move within a single clip (a
  push-in, a pan, a walk-and-follow), or
- generate one clip per cut as **separate `generate` calls** (each a
  separately billed job) and stitch them with an external video tool — this
  skill does not do multi-clip editing/stitching.

Don't assume how many shots a novel excerpt needs — confirm the shot count
and content with the user first; deciding that is the user's/calling
agent's job, not this skill's.

## Step 0: ask which visual look the user wants

Before building any prompt, ask whether the user wants:

- **Anime/animated-film style** — smooth cel-shading, clean line art,
  vibrant flat colors, expressive character animation. Example descriptors:
  "modern theatrical-anime style, cel-shaded, vibrant colors", "soft
  cinematic anime style, detailed backgrounds, gentle lighting", "90s-anime
  style, bold outlines, saturated colors".
- **Manga-panel/screentone style** — black-and-white or limited-color panel
  look, screentone shading, ink line art, comic-panel framing. Example
  descriptors: "black-and-white manga panel style, screentone shading, ink
  linework", "shoujo-manga style, delicate linework, soft screentone
  gradients", "seinen-manga style, high-contrast ink, dramatic screentone
  hatching".

Don't assume one over the other — the two produce visually very different
reference images and shots, and the choice belongs to the user. Carry the
chosen style descriptor into **both** steps below (the character reference
image prompt and every shot's video prompt), so the character image and
every shot stay visually consistent with each other, not just internally
consistent shot-to-shot.

## Step 1: generate ONE character reference image

Extracting the character description is **this skill's calling agent's own
reasoning to do — not something a script performs**. Read the user's
story/script excerpt and write a precise, reusable character description
covering:

- age and build
- hair (color, length, style)
- clothing (exact garments, colors)
- distinguishing features (scars, accessories, eye color, etc.)

Combine that description with the chosen art-style descriptor (Step 0) into
a text-to-image prompt, then call:

```bash
bash ../ofox-image-core/references/ofox-image.sh generate \
  --model google/gemini-3.1-flash-image \
  --prompt "<character description>, <anime/manga style descriptor>, character reference sheet, plain neutral background, front-facing full body" \
  --quality standard \
  --out-dir <a directory for this project's generated assets>
```

`google/gemini-3.1-flash-image` is the recommended default for this step —
no strong reason to use `openai/gpt-image-2` or `bailian/qwen-image-3.0-pro`
unless the user asks for one of those specifically. Per `ofox-image-core`'s
own documented gotcha: whatever `--size` you pass (or omit), Gemini appears
to always actually generate at its native 1024x1024 resolution and just
echoes back the requested size — don't promise the user a specific output
size, and don't fight this if you do pass `--size`.

Take the printed `IMAGE_PATH` (an absolute path). **Show it to the user as
its own standalone line, and explicitly say it will be reused for every
shot featuring this character.** This file is the artifact the rest of the
skill depends on.

If the story needs more than one character, repeat Step 1 once per
character who needs their own reference image — see "Multiple characters in
one shot" below for the v1 scoping limit on this.

## Step 2: generate each shot, reusing the SAME character image

**Reuse the identical `IMAGE_PATH` from Step 1 across every shot of that
character.** Do not regenerate the character image per shot, and do not
swap in a different image between shots of the same character — that reuse
is the entire mechanism this skill provides.

For each shot, build an anime-style video prompt covering:

- scene action (what happens in the shot)
- dialogue in quotes, attributed, if the shot has any
- camera framing (wide/medium/close-up, pan/push-in), consistent with the
  chosen art style from Step 0

then call:

```bash
bash ../ofox-video-core/references/ofox-video.sh generate \
  --prompt "<anime-style shot prompt built above>" \
  --frame-first-image "<the character reference image's ABSOLUTE path from Step 1>" \
  --duration 8 \
  --resolution 720p
```

`ofox-video-core` auto-base64-encodes a local file path like this one — no
need to upload it anywhere first. Always pass the **same absolute
`IMAGE_PATH`** printed in Step 1, never a relative path, a re-derived guess,
or a freshly generated image for this shot.

### `aspect_ratio: adaptive` will fire automatically here — expected, not a bug

Because every shot in this skill attaches a `--frame-first-image`, and the
default model is `bytedance/seedance-2.5`, `ofox-video-core` will force
`aspect_ratio` to `adaptive` and print a `NOTE:` every time, regardless of
whether `--aspect-ratio` is passed. **Don't pass `--aspect-ratio` here** —
it has no effect once an image is attached with this model. The output's
frame shape follows the character reference image's own aspect ratio
instead. If a specific output ratio matters for a platform, crop/pad the
character reference image to that ratio before Step 1, not after.

## Multiple characters in one shot: out of scope for v1

This skill scopes to one primary character reference per shot, matching
`ofox-video-core`'s single `--frame-first-image` slot. If a shot needs two
characters interacting:

- generate a reference image for the primary/foreground character only
  (Step 1),
- pass that image as `--frame-first-image` for the shot,
- describe the secondary character in the shot's video prompt text
  (appearance, action, dialogue) — the same text-only approach
  `seedance-short-drama` already uses for all of its characters.

This is a real accuracy tradeoff, not a full solution: the secondary
character has no image-based consistency guarantee across shots. Treat it
as the workaround it is, not as feature parity with the primary character's
mechanism.

## Cost estimate — show this before calling either API

Two separate costs, paid at different rates as noted:

**Step 1 (image) — paid once per character, not once per shot.**
`ofox-image-core/references/pricing.md` does not have a single confirmed
dollar-per-image figure: the model page's "$60/M output image" rate is
ambiguous as documented, and a real test call left roughly a 20x spread
between the two possible interpretations, unresolved against actual
billing history. Present this honestly rather than inventing a number: "a
character reference image costs a small amount — likely well under $0.10
based on observed token counts, but not a firm, confirmed figure yet."
Whatever the exact number turns out to be, it is paid **once per
character** — generating N shots of the same character does not repeat this
cost.

**Step 2 (video) — paid once per shot.** Use
[`ofox-video-core/references/pricing.md`](../ofox-video-core/references/pricing.md)'s
formula:

```
estimated_cost = duration_seconds * price_per_second(resolution, t2v)
```

The t2v column applies — image-to-video via `--frame-first-image` still
bills at t2v rates; v2v pricing only applies when a *video* (not an image)
is the input, which this skill never does. Example at this skill's
suggested defaults: 8 seconds at 720p ($0.24/s) ≈ **$1.92 per shot**.

**Put both in front of the user before generating anything**, broken out
rather than blended into one number, e.g.: "1 character reference image
(likely a few cents, unconfirmed exact figure) + 3 shots at 8s/720p
(≈$1.92 each) ≈ ~$5.76 for the video plus a small one-time image cost." The
point of breaking it out is so the user sees the image cost does not scale
with shot count.

## Generating: putting the two steps together

Example full sequence (the character/shot content is illustrative — the
calling agent fills in the real content extracted from the user's story):

```bash
# Step 1 — once per character
bash ../ofox-image-core/references/ofox-image.sh generate \
  --model google/gemini-3.1-flash-image \
  --prompt "A teenage girl, silver bob haircut, wearing a navy school uniform with a red ribbon, sharp green eyes, modern theatrical-anime style, cel-shaded, vibrant colors, character reference sheet, plain neutral background, front-facing full body" \
  --quality standard \
  --out-dir ./assets

# Step 2 — once per shot, reusing the SAME IMAGE_PATH printed by Step 1
bash ../ofox-video-core/references/ofox-video.sh generate \
  --prompt "The girl stands on a rooftop at sunset, wind blowing through her hair, she looks toward the horizon and says, \"I'm not going back.\" Medium shot, slow push-in, modern theatrical-anime style, cel-shaded" \
  --frame-first-image "/absolute/path/to/assets/ofox_image_20260829_1234.png" \
  --duration 8 \
  --resolution 720p
```

Report the **actual** printed `IMAGE_PATH` / `VIDEO_PATH` / `VIDEO_COST`
from each script's own output — never an estimate, and never a path or cost
you didn't see a script print. Do not re-implement any of the
request/decode/poll/download logic here; always call into
`ofox-image.sh`/`ofox-video.sh`.

## Common failure modes and fixes

Combining both core skills' documented exit codes (full tables:
[`ofox-image-core/references/api-params.md`](../ofox-image-core/references/api-params.md),
[`ofox-video-core/references/api-params.md`](../ofox-video-core/references/api-params.md)),
plus this skill's own:

| Step | Symptom | Cause | Fix |
|---|---|---|---|
| 1 (image) | Exit `1`, no network call made | Missing `--quality`, bad `--model`, or `--n` combined with Gemini | Fix the flag per the error message and re-run `generate` — free to retry, nothing was submitted |
| 1 (image) | Exit `2` | `curl`/`jq` missing, or `OFOX_API_KEY` not set | Re-run `ofox-image-core`'s `check` and follow its install/signup guidance |
| 1 (image) | Exit `3`, `error.type: invalid_request_error` | The request was rejected as malformed/unsupported. The confirmed error shape is `{"error":{"message","type","code"}}` — `error.code` is just the HTTP status as a number here, `error.type` is the real classifier | Read the printed `Upstream message`, fix the prompt/flags, retry — a rejected request has not been confirmed to bill |
| 1 (image) | Exit `4` | `--out-dir` could not be created or entered | Caught before any network call, so no money was spent finding this out. Fix `--out-dir` and retry |
| 1 (image) | Exit `5`, ambiguous network failure | No HTTP response at all — this is a synchronous, no-job-id API, so there's nothing to poll afterward | Do not guess or retry blindly; check `https://app.ofox.ai`'s usage/billing history first |
| 1 (image) | `SIZE` in the printed output doesn't match what you asked for | `google/gemini-3.1-flash-image` always generates at its native 1024x1024 and just echoes back the requested `size` regardless of the real output | Don't promise the user a specific size; if a guaranteed size matters, check the real file's dimensions (`file <path>` / `sips -g pixelWidth -g pixelHeight <path>`), not the `SIZE` line |
| 2 (video) | Exit `1`, no network call made | Bad `--duration`/`--resolution`, or missing `--prompt` | Fix the flag per the error message and re-run `generate` — free to retry, nothing was submitted |
| 2 (video) | Exit `1`, "local image file ... exists but is not readable" | `--frame-first-image`'s path exists locally but this script/OS can't read it (permissions) — caught by `resolve_image_ref()` before any network call | Fix the file's permissions (confirm it's the exact `IMAGE_PATH` printed in Step 1) and retry — free, nothing was submitted |
| 2 (video) | Exit `2` | `curl`/`jq` missing, or `OFOX_API_KEY` not set | Re-run `ofox-video-core`'s `check` and follow its install/signup guidance |
| 2 (video) | Exit `3`, `error.code: insufficient_credits` | Ofox balance too low | No charge was made; the user needs to add credits at `https://app.ofox.ai` before retrying |
| 2 (video) | Exit `3`, job ends `failed`, `error.code: output_moderation_failed` | The generated output failed a post-generation content check, after the job ran — not billed (no `usage` field) | Retry with a brand-new `generate` call using a different prompt — a new request, safe to retry immediately |
| 2 (video) | Exit `3`, request rejected when the API tries to use the reference image (commonly `error.code: invalid_request`) | The `IMAGE_PATH` doesn't exist locally and isn't a URL either, so `resolve_image_ref()` passed it through unchanged and the API rejected it as an unusable value — `ofox-video-core`'s docs confirm `bad_data_uri`/`download_failed`/`unreachable`/`not_image`/`too_large` only for `--real-person`'s reference-photo validation, not for `--frame-first-image`/`frame_images`, so don't assume one of those five specific codes here | Confirm the exact `IMAGE_PATH` printed in Step 1 still exists and is a valid, readable image file, then retry |
| 2 (video) | Unexpected aspect ratio / frame shape in the output | `bytedance/seedance-2.5` + `--frame-first-image` always forces `aspect_ratio: adaptive` (printed as a `NOTE:`, never silent) — the output follows the reference image's own aspect ratio | Expected behavior, not a bug — see "`aspect_ratio: adaptive` will fire automatically" above; crop/pad the reference image before Step 1 if a specific ratio is required |
| 2 (video) | Exit `4`, timed out waiting for completion | Job is still running upstream, not failed | Do **not** re-run `generate`; run `bash ../ofox-video-core/references/ofox-video.sh poll JOB_ID` using the job id printed before the timeout |
| 2 (video) | Exit `5`, ambiguous network failure on create | No HTTP response received at all — can't tell if a job was created | Do not guess or retry `generate`; check `https://app.ofox.ai` first, per `ofox-video-core`'s no-resubmit rule |
| 2 (video) | Exit `6`, `--out-dir` could not be created or entered | Local filesystem problem, not an API problem | The job itself is unaffected — fix `--out-dir` and re-run `poll JOB_ID --out-dir <a writable directory>`; do not re-run `generate` |
| both | Character looks visibly different between two shots | The same `IMAGE_PATH` wasn't reused, or Step 1 was accidentally re-run per shot | Reuse the exact same absolute path from the ONE Step-1 call for every shot of that character — this is the entire mechanism, see above |

## When NOT to use

- Realistic-human dialogue scenes with no anime/manga styling — use
  `seedance-short-drama` instead. That skill's character-consistency
  approach is text-only (repeating the same description across stateless
  jobs); this skill replaces that with a real, reused reference image, but
  only for an anime/manga art style — every prompt this skill builds bakes
  in the Step-0 style descriptor, so it is not a general-purpose "add image
  consistency to any style" tool.
- Silent product/brand footage with no characters — use `seedance-ad-creative`
  instead.
- Plain catalog/listing product shots — use `seedance-product-video` instead.
- More than one character needing independent image-based consistency in the
  same shot — out of scope for v1 (see "Multiple characters in one shot"
  above); only one primary character gets a reference image per shot.
- Editing an existing character's outfit/appearance mid-story — this skill
  only does fresh text-to-image generation (`ofox-image-core` doesn't
  implement `/v1/images/edits`); generate a new Step-1 reference image
  instead, treated as a new "version" of the character from that point on.
