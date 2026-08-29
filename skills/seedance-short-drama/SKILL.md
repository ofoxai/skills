---
name: seedance-short-drama
description: Generate a single realistic-human, dialogue-driven short-drama shot from a script or scene description using the Ofox video API (Seedance 2.5) — writes a shot-craft prompt (character appearance, quoted dialogue, scene-cut timing cues), shows a cost estimate, then calls ofox-video-core to submit, poll, download, and report the real cost. Use when a user asks to turn a script beat into video, e.g. "generate scene 3 of this script, two characters talking, 15 seconds", "make a vertical short-drama clip of these two arguing in a kitchen", "turn this dialogue into a 12-second video", or "give me a realistic short-drama shot of a couple breaking up at a train station". Do not use for silent product/brand shots (see seedance-ad-creative) or for anything not involving people/dialogue.
license: MIT
metadata:
  author: ofoxai
  version: "1.0.0"
---

# seedance-short-drama: dialogue-driven short-drama shots

Turns one scene/shot of a script into a realistic-human video clip: a character
description, quoted dialogue, and pacing cues become a Seedance 2.5 prompt,
which this skill submits, polls, downloads, and reports the cost for.

This skill is a thin, scenario-specific layer over
[`ofox-video-core`](../ofox-video-core/SKILL.md). It owns the short-drama
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

## One job = one continuous shot

Seedance 2.5 generates a single continuous clip per job (4–30 seconds). "Scene
3 of this script" maps to **one `generate` call per shot**. If a script beat
spans multiple hard cuts (e.g. exterior establishing shot, then interior
close-up), either:

- describe it as one continuous camera move within a single clip (a push-in,
  a whip-pan, a walk-and-follow — see timing cues below), or
- generate one clip per cut as **separate `generate` calls** (each is a
  separately billed job) and stitch them with an external video tool — this
  skill does not do multi-clip editing/stitching.

Don't try to cram an entire multi-scene script into one call; ask the user
which single scene/shot to render if the request spans more than one.

## Writing a good short-drama prompt

A short-drama prompt needs three things a generic prompt usually skips:

### 1. Character appearance, stated once, per character

Describe age, gender, hair, build, and clothing for each character so the
model renders a consistent, recognizable person — and reuse the *same*
wording across multiple shots of the same scene/script so the character
doesn't visibly change between clips (Seedance has no persistent character
memory across separate jobs; consistent wording is the only lever you have).

```
A woman in her late 20s, shoulder-length black hair, wearing a cream
turtleneck sweater. A man in his early 30s, short dark hair, wearing a
grey wool coat.
```

### 2. Dialogue in quotes, attributed to a character

Put spoken lines in quotes and say who says them. Keep the total spoken word
count realistic for the clip length — roughly **2–3 spoken words per second**
is a safe budget for natural-sounding pacing; more than that tends to make
the generated speech sound rushed or garbled.

```
The woman says, "Where were you last night?" The man replies, "I told you,
I was working late."
```

For a 15-second clip that's a comfortable ceiling of ~30–40 spoken words
total across both lines — trim the dialogue if the script beat has more than
that.

### 3. Scene-cut / timing cues

Since one job is one continuous take, use timestamped beats to shape pacing
and camera movement within the clip rather than implying a hard edit:

```
0-4s: wide shot of a dim kitchen, the woman stands by the counter.
4-10s: camera slowly pushes in to a medium two-shot as the man enters and
the dialogue plays. 10-15s: close-up on the woman's face as she turns away.
```

Treat these as strong hints, not a guaranteed edit list — Seedance may not
honor a hard cut mid-clip. If a literal hard cut matters more than a
continuous take, generate it as two separate clips instead (see above).

### Putting it together

```
A woman in her late 20s, shoulder-length black hair, wearing a cream
turtleneck sweater, stands in a dim kitchen. A man in his early 30s, short
dark hair, grey wool coat, enters. 0-4s: wide shot, she waits by the
counter. 4-10s: camera pushes in to a medium two-shot; she says, "Where were
you last night?" He replies, "I told you, I was working late." 10-15s:
close-up on her face as she turns away, unconvinced. Naturalistic lighting,
handheld camera feel.
```

## Recommended defaults

| Parameter | Default | Why |
|---|---|---|
| `--model` | `bytedance/seedance-2.5` (script default, no flag needed) | current-generation model |
| `--duration` | `10` (adjust to match the requested length, e.g. `15` if the user says 15 seconds) | enough room for a short exchange; Seedance 2.5 accepts 4–30 |
| `--resolution` | `720p` | realistic detail on faces/lip movement at a reasonable cost; use `1080p` only for a hero shot the user will publish |
| `--aspect-ratio` | `9:16` (vertical) | short-drama content is overwhelmingly consumed vertically on mobile/social; pass `--aspect-ratio 16:9` if the user wants landscape instead |
| `--generate-audio` | `true` (server default, no flag needed) | dialogue needs an audio track — never set this `false` for a scene with spoken lines |
| `--real-person` | leave unset (`false`) | only set `true` if you're passing an actual photo of a real person via `--frame-first-image`/`--frame-last-image` as a likeness reference — a purely text-described fictional character does not need this flag |

Always confirm the actual duration/aspect ratio with the user's request first
(e.g. "15 seconds" in the trigger example overrides the 10s default).

## Cost estimate — show this before generating

Compute the estimate with the formula and per-second rates in
[`../ofox-video-core/references/pricing.md`](../ofox-video-core/references/pricing.md)
(`estimated_cost = duration_seconds * price_per_second(resolution, t2v)` — this
skill only ever uses text-to-video, so the t2v column applies). Example at
this skill's defaults: 10 seconds at 720p ($0.24/s t2v) ≈ **$2.40**. Show the
user the estimate for their actual chosen duration/resolution before calling
`generate`, and remind them the real number comes from `VIDEO_COST` after
the job completes (see below) — the estimate may differ slightly.

## Generating

```bash
bash ../ofox-video-core/references/ofox-video.sh generate \
  --prompt "<the short-drama prompt built above>" \
  --duration 10 \
  --resolution 720p \
  --aspect-ratio 9:16
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
plus the short-drama-specific ones:

| Symptom | Cause | Fix |
|---|---|---|
| Exit `1`, no network call made | Bad `--duration`/`--resolution`/`--aspect-ratio`, or missing `--prompt` | Fix the flag per the error message and re-run `generate` — free to retry, nothing was submitted |
| Exit `2` | `curl`/`jq` missing, or `OFOX_API_KEY` not set | Re-run `ofox-video-core`'s `check` and follow its install/signup guidance |
| Exit `3`, `error.code: insufficient_credits` | Ofox balance too low | No charge was made; the user needs to add credits at `https://app.ofox.ai` before retrying |
| Exit `3`, job ends `failed`, or `invalid_request` on create, with no other error code hint | Likely a moderation rejection: prompts describing real/identifiable public figures, sexual content, or graphic violence are commonly rejected before or during generation | Rewrite the prompt: use a generic character description instead of naming a real person, tone down graphic detail, then call `generate` again — this is a **new** request with a new prompt, not a resubmission of the failed one, so it's safe to retry immediately |
| Generated speech sounds rushed, garbled, or cut off | Too many words of dialogue for the clip duration | Trim dialogue to roughly 2–3 spoken words per second of clip, or increase `--duration` (within 4–30s) |
| Character's appearance drifts between two clips of the "same" scene | Each `generate` call is stateless — no persistent character memory | Reuse the exact same character-description wording in every prompt for that script/character |
| Exit `4`, timed out waiting for completion | Job is still running upstream, not failed | Do **not** re-run `generate`; run `bash ../ofox-video-core/references/ofox-video.sh poll JOB_ID` using the job id printed before the timeout |
| Exit `5`, ambiguous network failure on create | No HTTP response received at all — can't tell if a job was created | Do not guess or retry `generate`; tell the user to check `https://app.ofox.ai` for a job that may already be running, per `ofox-video-core`'s no-resubmit rule |

## When NOT to use

- Silent product/brand footage with no characters or dialogue — use
  `seedance-ad-creative` instead.
- The user wants to animate an existing photo of a real person (a specific
  actor/likeness) rather than a described fictional character — still
  possible via `--frame-first-image`/`--frame-last-image` and `--real-person
  true`, but confirm the user has rights to use that likeness before
  proceeding.
- Multi-shot video editing/stitching across several generated clips — this
  skill produces individual clips only.
