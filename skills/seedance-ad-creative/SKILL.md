---
name: seedance-ad-creative
description: Generate a cinematic brand/product ad clip from a product description or photo using the Ofox video API (Seedance 2.5) — writes a shot-craft prompt (product framing, camera language, brand tone), shows a cost estimate, then calls ofox-video-core to submit, poll, download, and report the real cost. Use when a user asks for a commercial-style product or brand video, e.g. "give this perfume bottle a 10-second cinematic brand ad", "make a product ad for our new sneaker", "turn this product photo into a hero video for the landing page", or "I need a 15-second brand video with a slow orbit around the bottle". Do not use for dialogue-driven scenes with people talking (see seedance-short-drama).
license: MIT
homepage: https://github.com/ofoxai/skills/tree/main/skills/seedance-ad-creative
metadata:
  author: ofoxai
  version: "1.0.3"
  openclaw:
    requires:
      env: [OFOX_API_KEY]
      bins: [curl, jq]
---

# seedance-ad-creative: cinematic product/brand ad clips

Turns a product description (or a product photo) into a commercial-style
video clip: camera language, product framing, and brand tone become a
Seedance 2.5 prompt, which this skill submits, polls, downloads, and reports
the cost for.

This skill is a thin, scenario-specific layer over
[`ofox-video-core`](../ofox-video-core/SKILL.md). It owns the ad-creative
prompt craft, recommended defaults, and the pre-generation cost estimate;
`ofox-video-core` owns talking to the Ofox API correctly and safely (the
`OFOX_API_KEY` handling, the no-resubmit rule, error-code mapping,
download/verification). **Read that skill's safety contract before using
this one** — it is not restated here.

## Before generating: the availability check

Run this once per session (not on every request):

```bash
bash ../ofox-video-core/references/ofox-video.sh check
```

If it fails, follow `ofox-video-core`'s guidance (install `curl`/`jq`, or get
an `OFOX_API_KEY` at `https://app.ofox.ai`) — don't dead-end the
conversation, and don't re-run this check on every subsequent request once
it has passed.

## Writing a good ad-creative prompt

Order the prompt product-first, then camera, then mood — in practice this
keeps the model's attention on rendering the product correctly before it
spends effort on the environment:

### 1. Product framing, described precisely

State the product's shape, material, color, and how it sits in frame before
anything else. Be exact about surface/finish (glass, brushed metal, matte
plastic) since that drives how light behaves on it.

```
A tall clear glass perfume bottle with a gold cap, centered on a reflective
black surface.
```

### 2. Camera language, stated as a real shot

Use concrete cinematography terms rather than vague adjectives — they steer
the model far more reliably than "make it look cool":

- **Framing/move**: slow dolly-in, orbit (specify degrees, e.g. "orbits 30
  degrees left"), macro close-up, rack focus from background to product,
  slow pull-back reveal.
- **Lighting**: soft rim light, backlit silhouette, single hard key light,
  studio softbox lighting.

```
Camera slowly orbits 30 degrees around the bottle, soft rim light along the
glass edge, shallow depth of field with the background gently blurred.
```

### 3. Brand tone, as a short mood/style tag

One or two tone words steer the color grade and pacing more reliably than a
paragraph of adjectives:

- Luxury: slow movement, dark/moody background, warm gold highlights.
- Playful/consumer: bright saturated colors, faster movement, upbeat energy.
- Minimalist/tech: clean white or grey background, precise/steady camera,
  cool light.

```
Minimalist, high-end product photography style, dark background, cinematic
color grade.
```

### Putting it together

```
A tall clear glass perfume bottle with a gold cap, centered on a reflective
black surface. Camera slowly orbits 30 degrees around the bottle, soft rim
light along the glass edge, shallow depth of field with the background
gently blurred. Minimalist, high-end product photography style, dark
background, cinematic color grade, no dialogue, soft ambient music.
```

Since ad-creative clips are typically silent-of-dialogue (ambient
music/sound only), say so explicitly in the prompt ("no dialogue") to steer
away from any voice generation.

### If the user has an actual product photo

Prefer image-to-video over describing the product purely in text — Seedance
renders the real product (label text, exact shape) far more faithfully from
a reference image than from a text description, which can distort fine
label detail or logos. Prefer a local file over a remote URL when the user
has one: `ofox-video-core` auto-base64-encodes a local file, which real
testing found more reliable than depending on the upstream provider being
able to fetch an arbitrary third-party URL (some hosts' bot/hotlink
protection can reject an otherwise valid, publicly reachable image URL).

```bash
bash ../ofox-video-core/references/ofox-video.sh generate \
  --prompt "Camera slowly orbits 30 degrees around the product, soft rim light, cinematic color grade" \
  --frame-first-image "/path/to/local/product-photo.jpg" \
  --duration 10 --resolution 1080p
```

**Note on `--aspect-ratio` with an attached image**: don't pass
`--aspect-ratio` here for the default model — `ofox-video-core` forces
`aspect_ratio` to `adaptive` whenever an image (`--frame-first-image`/
`--frame-last-image`) is combined with `bytedance/seedance-2.5` (this
skill's default model), overriding anything else with a printed notice.
`--aspect-ratio` (`16:9`/`9:16`/`1:1`/etc., see Recommended defaults below)
only takes effect on the **pure text-to-video** path, when no image is
attached.

If the reference image includes an actual person (e.g. a spokesperson or
model in the shot, not just the product), add `--real-person true` per the
API contract. That path validates the image server-side and can fail with
`bad_data_uri`/`download_failed`/`unreachable`/`not_image`/`too_large` if the
image isn't a small, valid file the API can use — see the failure table
below.

## Recommended defaults

| Parameter | Default | Why |
|---|---|---|
| `--model` | `bytedance/seedance-2.5` (script default, no flag needed) | current-generation model |
| `--duration` | `10` (adjust to match the request, e.g. `15` if asked for 15 seconds) | typical short-ad length; Seedance 2.5 accepts 4–30 |
| `--resolution` | `1080p` for a deliverable brand asset; suggest `720p` as a cheaper draft/preview pass | brand assets are usually published, so higher fidelity is worth the extra cost — but confirm with the user given the price difference (see cost estimate below) |
| `--aspect-ratio` | `16:9` (landscape) — **pure text-to-video only** | cinematic/hero framing for websites and YouTube; pass `--aspect-ratio 9:16` for a vertical social-ad cut or `1:1` for feed placements. **Does not apply once an image is attached** with the default model — `ofox-video-core` forces `adaptive` in that case (see above) |
| `--generate-audio` | `true` (server default, no flag needed) | ambient/music track; the prompt should say "no dialogue" if that matters |

## Cost estimate — show this before generating

Compute the estimate with the formula and per-second rates in
[`../ofox-video-core/references/pricing.md`](../ofox-video-core/references/pricing.md)
(`estimated_cost = duration_seconds * price_per_second(resolution, mode)`).
This skill uses text-to-video for a pure text prompt and the same t2v rate
for image-to-video via `--frame-first-image`/`--frame-last-image` (that's
still t2v pricing — v2v pricing only applies when a *video* is supplied as
input, which this skill doesn't do). Two worked examples at this skill's
defaults: 10 seconds at 1080p (time-limited $0.48/s t2v) ≈ **$4.80**; the
cheaper 720p draft pass ≈ **$2.40**. Present both options and the tradeoff
before calling `generate`, and remind the user the real number comes from
`VIDEO_COST` after the job completes — the estimate may differ slightly.

## Generating

```bash
bash ../ofox-video-core/references/ofox-video.sh generate \
  --prompt "<the ad-creative prompt built above>" \
  --duration 10 \
  --resolution 1080p \
  --aspect-ratio 16:9
```

This one call validates the parameters, submits the job, polls to
completion, downloads the mp4, and prints `STATUS`, `JOB_ID`, `VIDEO_PATH`,
`VIDEO_SECONDS`, and `VIDEO_COST`. Report the **actual** values from that
output to the user — never the estimate, and never a path/cost you didn't
see the script print. Do not re-implement any of the request/poll/download
logic here; always call into `ofox-video.sh`.

## Common failure modes and fixes

These are `ofox-video-core`'s documented exit codes and error codes
(full table: [`../ofox-video-core/references/api-params.md`](../ofox-video-core/references/api-params.md)),
plus the ad-creative-specific ones:

| Symptom | Cause | Fix |
|---|---|---|
| Exit `1`, no network call made | Bad `--duration`/`--resolution`/`--aspect-ratio`, or missing `--prompt` | Fix the flag per the error message and re-run `generate` — free to retry, nothing was submitted |
| Exit `2` | `curl`/`jq` missing, or `OFOX_API_KEY` not set | Re-run `ofox-video-core`'s `check` and follow its install/signup guidance |
| Exit `3`, `error.code: insufficient_credits` | Ofox balance too low, especially likely at 1080p | No charge was made; suggest a cheaper 720p draft or adding credits at `https://app.ofox.ai` |
| Exit `3`, job ends `failed`, or `invalid_request` on create, with no other error code hint | Likely a moderation rejection: prompts referencing a real celebrity/spokesperson likeness without consent, another brand's trademarked logo, or copyrighted characters are commonly rejected | Remove the flagged real-person/trademark/copyrighted reference from the prompt (or reference image), then call `generate` again — this is a **new** request, not a resubmission of the failed one, so it's safe to retry immediately |
| Exit `3`, job ends `failed`, `error.code: output_moderation_failed` | The generated **output** failed a post-generation content check — happens after the job ran, not at submission. Not billed (no `usage` field on the response) | Retry with a brand-new `generate` call using a different prompt or reference image — a new request, not a resubmission of the failed one, so it's safe |
| `bad_data_uri` / `download_failed` / `unreachable` / `not_image` / `too_large` on an image-to-video job | The `--frame-first-image`/`--frame-last-image` reference isn't a small, valid image the API can use (a remote URL that isn't publicly reachable, or a local file that failed to read/encode) | Prefer a local file (auto-base64'd, more reliable than some remote URLs — see above); confirm it's a real image file under the size limit and retry |
| Product label text or logo looks distorted/illegible in the result | Pure text-to-video can't render fine label detail reliably | Switch to image-to-video with `--frame-first-image` pointing at the real product photo instead of describing the label in text |
| Exit `4`, timed out waiting for completion | Job is still running upstream, not failed | Do **not** re-run `generate`; run `bash ../ofox-video-core/references/ofox-video.sh poll JOB_ID` using the job id printed before the timeout |
| Exit `5`, ambiguous network failure on create | No HTTP response received at all — can't tell if a job was created | Do not guess or retry `generate`; tell the user to check `https://app.ofox.ai` for a job that may already be running, per `ofox-video-core`'s no-resubmit rule |

## When NOT to use

- Dialogue-driven scenes with characters talking — use `seedance-short-drama`
  instead.
- Plain catalog/listing footage (white background, literal turntable
  rotation, no mood or camera language) rather than a cinematic brand ad —
  use `seedance-product-video` instead.
