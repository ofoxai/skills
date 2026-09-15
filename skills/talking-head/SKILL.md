---
name: talking-head
description: Requires OFOX_API_KEY — create one at https://app.ofox.ai. Turn a portrait plus a short script into a clip of one person speaking those words to camera. You supply the text and the model generates the voice — audio cannot be uploaded, measured. Defaults to alibaba/wan-3.0-prime rather than this repo's usual seedance-2.5, because seedance-2.5 refuses a real person's photo at submission. Use when a user has a face and some words and wants the face to say them, e.g. "make this headshot read my intro", "a spokesperson clip from this portrait", "have her say this line to camera", "use this avatar to read the announcement". Do not use for a scene between two or more people (see seedance-short-drama), a polished brand or product ad (see seedance-ad-creative), a handheld creator clip (see ugc-ads), or when the words still have to be pulled out of an article and no particular face is required (see explainer).
license: MIT
version: "1.0.0"
homepage: https://github.com/ofoxai/skills/tree/main/skills/talking-head
metadata:
  author: ofoxai
  version: "1.0.0"
  openclaw:
    requires:
      env: [OFOX_API_KEY]
      bins: [curl, jq]
    primaryEnv: OFOX_API_KEY
    envVars:
      - name: OFOX_API_KEY
        required: true
        description: Ofox API key. Create one at https://app.ofox.ai (Settings -> API Keys). The same key works across every Ofox skill.
    emoji: "🗣️"
    homepage: https://github.com/ofoxai/skills/tree/main/skills/talking-head
---

# talking-head: one face, to camera, saying a short script

One person, framed chest-up, speaking words the user wrote. The portrait is
the opening frame; the script is text in the prompt; the voice is generated.

This skill is a thin, scenario-specific layer over
[`ofox-video-core`](../ofox-video-core/SKILL.md). It owns the talking-head
prompt craft, the brief, the defaults and the pre-generation cost estimate;
`ofox-video-core` owns talking to the Ofox API correctly and safely (the
`OFOX_API_KEY` handling, the no-resubmit rule, error-code mapping,
download/verification, and reporting the downloaded file's absolute
`VIDEO_PATH`). **Read that skill's safety contract before using this one** —
it is not restated here.

Shared prose is linked rather than copied: the prompt formula, camera and
delivery vocabulary, the word-rate tiers and the negative-list items are in
[`../ofox-video-core/references/prompt-structure.md`](../ofox-video-core/references/prompt-structure.md);
the pre-prompt question rules in
[`../ofox-video-core/references/creative-brief.md`](../ofox-video-core/references/creative-brief.md);
the spend rule in
[`../ofox-video-core/references/approval-gate.md`](../ofox-video-core/references/approval-gate.md).

## Three facts to say out loud before anyone pays

They are the whole shape of this scenario, and every one of them surprises
someone who has used a lip-sync product before.

### 1. You cannot upload the voice. You supply words; the model speaks them

The API takes an `audio_url` reference, validates it, fetches it and bills the
job — and the delivered audio is **not** the audio that was sent. Measured
2026-09-15 on job `d8561509-dcc6-4f2c-8864-a193cd239b14`,
`bytedance/seedance-2.5`, a real five-second speech clip as a `data:` URI,
billed 55 cents: the input is near-continuous speech, the delivered track is
sparse, envelope correlation 0.41. The model generated its own track, exactly
as it does with no reference at all. The write-up is
`api-params.md` → "An `audio_url` reference is accepted, fetched, and does not
become the audio".

So: **do not offer to sync a voice recording, and do not accept one.** If the
user has a recording they want heard, this API is the wrong tool and the
honest answer is an editor. What this skill does is take the *text* and let
the model produce a voice for it.

The language of that voice follows **the language the quoted line is written
in**. Keep the user's own words in their own language; translating them to
match the English examples below buys them an English-dubbed clip they find
out about after paying.

### 2. A thirty-second clip holds about ninety words

The measured word rates and their gallery cases live in the shared file —
[`prompt-structure.md`](../ofox-video-core/references/prompt-structure.md) →
"Dialogue and sound" → "Density — two tiers, not one" — and are not restated
here. **The tier that applies here is the one named after this skill**:
monologue / talking head, one person to camera, at 3.5 words a second in
English and 5 characters a second in Chinese. The other tier, dialogue drama
at 0.4–1.7 words/s, measures a different shape — two people with silence
between their lines — and is a *floor* here rather than a budget: it only
describes a clip whose delivery has long written pauses in it.

Plan a little under the tier, at **3 words a second** (4 characters a second
for Chinese or Japanese), and treat 3.5 / 5 as the ceiling:

| Clip | Plan for about | In Chinese | Which is |
|---|---|---|---|
| 10s | 30 words | 40 characters | two sentences |
| 15s | 45 words | 60 characters | a short paragraph |
| 20s | 60 words | 80 characters | a paragraph with a point in it |
| 30s | 90 words | 120 characters | a claim, its reason, and what to do about it |

**Why under the ceiling rather than at it.** 3.5 words/s is the densest
practice the gallery shows, and this skill's template spends clip time on
things that are not words — an opening beat of eye contact, a written ending
where the lips close and the shot holds — while asking for an unhurried
delivery. A script budgeted at the ceiling asks for maximum density, an
unhurried register and a silent close in the same prompt. The asymmetry
settles which way to round: under-filling costs a pause at the end, and
overrunning comes back rushed, garbled or cut off, which costs the whole clip.

**What kind of evidence this is.** Both tiers are counts of *gallery prompt
text* against clip length. The prompts are real and the clips they produced
were published, but the platform and parameters behind most of them are
unrecorded, and none of it is a measurement of what this API delivers. On this
skill's default model it is weaker still — see "Wan's speech is unmeasured"
below — which is a reason to read the first clip's delivery rather than a
reason to plan at the other tier.

**If the user's script is longer than its clip**, say so before quoting
anything, and offer the two real options — cut it to one idea, or split it
across jobs. "Split it" costs what the section "Splitting a long script"
below spells out, and it is more than N times the money.

### 3. This skill's default model is not this repo's default model

`bytedance/seedance-2.5` is the default in every other video scenario here.
It is **not** the default here, and the reason is a measurement rather than a
preference: it refuses a real person's photograph as an image-to-video input,
at submission, before anything is generated.

```
HTTP 400  error.code: input_moderation_failed
Upstream message: The request failed because the input image 'content[1]'
may contain real person.
```

Nothing is billed — but nothing is delivered either, and a portrait is this
scenario's defining input. `alibaba/wan-3.0-prime` accepted the same portrait
and completed. So that is the default. The full comparison, and everything it
does *not* establish, is the next section.

## What is measured, and what is not

**This skill has no paid run of its own.** Nothing here has been generated
from this file's template; no clip has been read frame by frame against it.
What it stands on is a set of measurements made elsewhere in this repo, and
they answer narrower questions than this scenario asks.

### The portrait comparison — 2026-09-15

One synthetic photoreal portrait — generated for the test, not any real
person's likeness — sent as `--frame-first-image` to three models, same
wording, each at its own minimum duration and cheapest tier to keep the check
cheap:

| Model | Result | Billed |
|---|---|---|
| `bytedance/seedance-2.5` | `HTTP 400 input_moderation_failed` at submission | nothing |
| `alibaba/wan-3.0-prime` | job completed | 12.8 cents (2s, 480p) |
| `minimax/hailuo-3` | job completed | 32 cents (4s, 768p) |

The refusal replicates a separate 2026-08-30 verification of the same code on
the same model. The two acceptances are first-run results. The spec entry is
`.trellis/spec/skills/external-api-integration.md` → "moderation policy is
per-model, not a platform-wide constant".

**What that table establishes**: seedance-2.5 will not take this input, and
two other models will. That is enough to settle the default.

**What it does not establish, and must not be implied**:

- **Nobody read the frames.** "Completed" is a job status. Whether the
  delivered clip looks like the person in the portrait, whether the mouth
  moves with the words, whether a 2-second clip at 480p resembles anything
  usable — none of it was checked. This repo's own standing rule is that
  `STATUS completed` proves nothing about an artifact.
- **The portrait was synthetic.** One generated face is one content class. A
  real photograph of a real person may moderate differently on any of the
  three.
- **Wan's speech is unmeasured.** Every word-rate number this skill plans
  against was measured on gallery clips, and every *Ofox* run in this repo
  that produced spoken dialogue was `bytedance/seedance-2.5` — the one model
  this route cannot use. Whether `wan-3.0-prime` speaks at a similar rate, or
  lip-syncs convincingly, or at all, has not been measured here.
- **Wan's frame lock is unmeasured.** "What a frame lock actually holds" in
  the shared file — the first frame reproduced exactly, identity held for
  twenty seconds, survives cuts — is three `bytedance/seedance-2.5` jobs.
  None of it has been re-run on wan. Treat "the clip opens on your portrait
  and stays that person" as the hypothesis this route is built on, not as a
  finding.
- **Wan is not upstream-pinned.** The script pins `byteplus` for Seedance
  only; `alibaba/wan-3.0-prime` runs on two upstreams and Ofox routes between
  them by weight. Upstreams moderate differently, so one accepting run is one
  upstream's verdict at best. A refusal on a later run of the same portrait
  is not a contradiction — it is the routing.

Practical consequence: **the first clip on this skill is an experiment.**
Price it as one, run it short and cheap, and read the frames — does it look
like the person, does the mouth match the words — before anyone pays for a
deliverable.

## Before you attach someone's face

A portrait is a person's likeness, and this skill's whole job is to make it
appear to say something it never said.

- **Confirm the user has the right to use that face this way**, and say what
  the clip will do with it. A colleague's headshot from a company directory is
  not consent.
- **Do not build a clip of an identifiable public figure**, whatever the
  script says. Moderation aside, this is the category where a generated clip
  does real damage.
- The API's `--real-person true` flag exists for authorised references on
  `bytedance/seedance-2.0`. Whether it lifts the 2.5 refusal is **untested in
  this repo**, and it must not be offered as a workaround. It is not the
  route this skill takes.

## Where the core skill lives

Resolve once, before the first call:

```bash
for d in ../ofox-video-core \
         ../ofoxai-skills-ofox-video-core \
         ~/.agents/skills/ofox-video-core \
         ~/.agents/skills/ofoxai-skills-ofox-video-core \
         ~/.claude/skills/ofox-video-core; do
  [ -f "$d/references/ofox-video.sh" ] && echo "$d" && break
done
```

Examples below are written as `../ofox-video-core/...` (the skills.sh /
ClawHub / `npx ofox-skills` layout, where a skill's directory is named after
the skill). If the probe found a different directory — LobeHub unpacks each
skill as `ofoxai-skills-<name>`, so the sibling there is
`ofoxai-skills-ofox-video-core` — substitute it, in the `ofox-video.sh`
commands and in the `references/*.md` links alike.

**That `../` is relative to this skill's own directory**, which is also where
the probe has to run. From anywhere else nothing resolves — use the absolute
path the probe printed (candidates 3–5 are absolute already), or, in a clone
of this repo, `skills/ofox-video-core/references/ofox-video.sh` from the repo
root.

Nothing found → the core skill isn't installed; see "If the script isn't
found".

## Before generating: the availability check

Run this once per session (not on every request):

```bash
bash ../ofox-video-core/references/ofox-video.sh check
```

If it fails, follow `ofox-video-core`'s guidance (install `curl`/`jq`, or get
an `OFOX_API_KEY` at `https://app.ofox.ai`) — don't dead-end the conversation,
and don't re-run this check on every subsequent request once it has passed.

`check` reports whether the key is **present**, not whether it is valid, and
makes no network call. It reads an ordinary environment variable in the shell
that runs the script — nothing is loaded from a `.env` file.

A failing `check` is not a stop sign: `models`, `providers` and
`generate --dry-run` all run without a key, so the brief, the script and the
price can all be settled first.

## Two routes, and the model follows the route

The user either has a face or doesn't, and that single fact decides the whole
job.

| | **Portrait route** (the default) | **Described-presenter route** |
|---|---|---|
| Input | a photo of the person, as the first frame | no photo; the presenter is written in text |
| Model | `alibaba/wan-3.0-prime` — the measured default, because seedance-2.5 refuses the photo | the script's own default, `bytedance/seedance-2.5`, which is where this repo's spoken-dialogue evidence lives |
| Identity | should follow the attached frame — **unmeasured on this model**, see above | generated fresh; a second job is a different person, and no flag changes that |
| Across jobs | re-attach the same portrait to each job | nothing carries a photoreal person between jobs; only the words route, and it does not hold a face |
| Aspect ratio | follows the attached image — **crop the portrait first**, see below | `--aspect-ratio` is yours |
| Evidence | one accepting job, frames unread | five Ofox text-to-video jobs of 20–30s built around photoreal people, all completed |

**The default is wan because the defining input is a photograph. Drop the
photograph and the reason for the default drops with it** — a
described-presenter clip is ordinary text-to-video, seedance-2.5 takes it, and
this repo has actually run that shape. Say which route you are on in the
recap, and say which model it puts you on.

If the user names a model, that wins on either route. `minimax/hailuo-3` also
accepted the portrait; it caps shorter than wan, which is why it is not the
default — check the current ranges with `ofox-video.sh models` rather than
trusting a number written here.

## Before writing the prompt: the brief

The shared rules — the three tiers, one round of at most four questions, the
shape of a question, the "Let the AI decide" discipline, the order with the
approval gate, the fallback without `AskUserQuestion` — are in
[`../ofox-video-core/references/creative-brief.md`](../ofox-video-core/references/creative-brief.md).
This section adds only this scenario's question set.

| Tier | Talking-head axes |
|---|---|
| **must-ask** | is there a portrait, and is it of someone the user may use this way; what the script actually is, word for word; what to do when the script overruns its clip |
| **ask-if-open** | aspect ratio, delivery register |
| **never-ask** | resolution, provider, audio on/off, the spoken language (it follows the script), duration once the word count has fixed it. Model is never-ask too — but it is *reported*, because this scenario's default is unusual |

### The question set

| # | Tier | `header` | Question | Options — first is recommended; "Let the AI decide" comes last where it appears, and never on a must-ask row | Ask when |
|---|---|---|---|---|---|
| 1 | must-ask | `Portrait` | Do you have a photo of the person who should be on screen? | **Yes — a local path (recommended)**: the clip opens on that face. Confirm in the same breath that the user may use this likeness. / **No — describe them instead**: a presenter generated from text; a different person every job. **No AI option** — a photo either exists or it doesn't. | No image attached and the user didn't say there isn't one. |
| 2 | must-ask | `Script` | These are the exact words to be spoken — confirm them? | The user's own text, quoted back **verbatim and untranslated**, with its word (or character) count and the clip length it implies. **No AI option** — inventing someone's words is the one thing this skill must never do. | Always, unless the user pasted the script and named the duration in the same message. |
| 3 | must-ask | `Overrun` | The script is `<N>` words, which needs about `<T>` seconds. What should give? | `Cut to <T_max> seconds of it (recommended)` — show the exact cut text before the cost table / `Run the clip to <T> seconds` — only if `<T>` is inside the model's range, and it bills per second / `Split across <k> jobs` — `<k>` bills, a visible join, and the face is only as stable as re-attaching the portrait makes it. **No AI option.** | Only when the word count overruns the duration the user asked for. |
| 4 | ask-if-open | `Aspect` | Where will it be watched? | `9:16 vertical (recommended)` — one face, mobile feeds / `16:9 landscape` — web, slides, YouTube / `1:1` / `Let the AI decide`. On the portrait route this decides **how to crop the photo**, not a flag. | No platform word and no ratio in the input. |
| 5 | ask-if-open | `Delivery` | How should it be said? | `Warm and conversational (recommended)` — unhurried, small gestures, reads as a person / `Brisk and professional` — an announcement, minimal movement / `Quiet and serious` — slow, low, few gestures / `Let the AI decide` | The script carries no tone word and the user gave no direction. |

Four slots, five questions. `Portrait` and `Script` always come first when
both are open; `Overrun` is a follow-up that only exists once the count is
known, so it never competes for a slot in round one.

### Skip rows specific to this scenario

On top of the generic rows in `creative-brief.md`:

| Input says… | Axis | Value |
|---|---|---|
| an image is attached, or a path is given | Portrait | have one — open it, check it is one person, chest-up, front-facing |
| the language the script is written in | spoken language | that language, **never asked** |
| "for LinkedIn", "for the website", "for a slide" | Aspect | 16:9 |
| "for TikTok", "Reels", "Shorts", "vertical" | Aspect | 9:16 |
| a tone word in the request ("friendly", "serious", "excited") | Delivery | as stated |
| "read this out", "have her say", "narrate this" | — | already this skill |
| "and then he replies…", two speakers, a scene | — | that is `seedance-short-drama`, not this |
| "summarise this article into a video" | — | that is `explainer` — the labour there is choosing the idea, not reading a finished script |

### Every answer lands somewhere

| Answer | Where it goes |
|---|---|
| Portrait | `--frame-first-image PATH`, the model, and the `IDENTITY` line of the prompt |
| Script | the quoted `LINE`, verbatim, and the word count that sets `--duration` |
| Overrun | `--duration`, the cut text shown in the recap, or the number of rows in the cost table |
| Aspect | the crop applied to the portrait (portrait route) or `--aspect-ratio` (text route) |
| Delivery | the `DELIVERY` note and the micro-beats on the timeline |

### The recap for this scenario

```
Brief
- Portrait: /Users/me/pics/anna-headshot.jpg — cropped to 9:16 first (you gave it;
  you confirmed you may use this likeness)
- Script: "We shipped the new dashboard this morning. It is faster, it is quieter,
  and it finally remembers where you were. If you had it pinned to a workaround,
  you can drop that now." — 33 words, your words, unchanged
- Duration: 12s (33 words at about 3 words/s, the talking-head tier)
- Delivery: warm and conversational (AI's pick)
- Model: alibaba/wan-3.0-prime — not this repo's usual seedance-2.5, which refuses
  a real person's photo at submission (measured)
- 9:16, 480p draft, audio on
- Note: this scenario has no paid run behind it, and wan's speech rate and lip-sync
  are unmeasured here. Treat this first clip as the experiment and read its frames.
```

Then the full prompt, then the cost table `approval-gate.md` specifies, all in
one message.

## The portrait itself

Three things to do before it is attached, none of which costs anything.

1. **Look at it.** One person, chest-up or head-and-shoulders, facing roughly
   camera, eyes open, mouth closed or neutral, nothing crossing the face. A
   full-length shot leaves the head a few pixels wide and the mouth has
   nowhere to move.
2. **Crop it to the delivery ratio — crop, never pad.** With a frame attached
   the script sets `aspect_ratio: adaptive` on models that offer it (it prints
   a `NOTE:` saying so), and the clip then takes the *image's* shape. Padding
   bakes the bars into the video. If the portrait was generated with
   `ofox-image-core`, `--target-aspect W:H` does the crop for you and
   measures the file rather than trusting the response.
3. **Read the real pixels** (`sips -g pixelWidth -g pixelHeight <file>`, or
   `identify <file>`). This repo has measured a requested size, a reported
   size and a file's real size being three different numbers.

A local path beats a URL: `ofox-video.sh` base64-encodes local files, and a
valid public URL has been rejected upstream with a download error while the
same file inline went through.

## The prompt template

Vocabulary is not repeated here — delivery notes, camera and focus terms,
negative-list rows and asset role sentences are in
[`../ofox-video-core/references/prompt-structure.md`](../ofox-video-core/references/prompt-structure.md).
A talking head is a single shot with performance beats inside it, so the
shared file's "Short prompts (10 seconds or less)" shape applies even above
10 seconds: **no shot manifest, no cut list.**

Slots in `<angle brackets>`; optional lines in `[square brackets]`.

```
One continuous shot, <T> seconds, fixed camera, no cuts.
IDENTITY: image1 is the speaker — take the face, hair and clothing from it exactly and keep them unchanged for the whole clip. [Ignore its background.]
[SPEAKER: <only when no portrait is attached: age range, build, hair, top with colour and material, one bearing word>.]
SCENE: <where they are — a plain wall, a home study, an office with the room softly out of focus behind>. <One light source and its direction: soft window light from front-left.>
FRAMING: chest-up medium close-up, <fixed camera | a faint breathing handheld>, <background softness>; <capture medium: real mirrorless texture, slight sensor noise>, real skin texture, no smoothing.

<Speaker> faces the camera and says, <delivery: conversational and unhurried | brisk, no theatricality | quiet and level>: "<the script, verbatim, in the language to be spoken>"
0–<a>s: <eye contact, one natural blink>. <a>–<b>s: on "<word>", <one gesture — a small head shake, a single open-palm beat>. <b>–<c>s: <second gesture, or stillness>. <c>–<T>s: after "<last word>", <the ending: the lips close and a half-second pause | the smallest nod>.

SOUND: <room tone>, no music. Speech in <language>, mouth shape matched to it.
CONSISTENCY: face, hair, <clothing items>, background and light direction identical from the first frame to the last.
AVOID: subtitles, captions, on-screen text, watermarks, logos; a second person, an off-screen voice, a cutaway; music, score, soundtrack, instrumental, humming, singing; presenter cadence, theatrical over-acting, wild gesturing; skin smoothing, beauty filter, plastic skin, CGI look; camera movement, zooms, cuts.
```

Seven notes on that shape:

- **The words are quoted verbatim and never paraphrased.** A line silently
  rewritten or translated is the most expensive thing that can go wrong here,
  because it looks fine until the clip plays. Put the full script inside the
  prompt shown at the approval gate so the user can read it.
- **`mouth shape matched to <language>`** is gallery practice (case 20 writes
  it explicitly). It is a request, not a guarantee, and on this model it is
  one of the unmeasured things.
- **One gesture per beat, at most.** The shared file's short-drama evidence
  caps visible signals at one to three per beat; a talking head sitting still
  and blinking reads far better than one conducting.
- **Give the ending its own beat.** The shared "Endings" section and this
  repo's `"Hold one second" buys about two` note both apply: without a written
  close, the last second is a coin flip.
- **No music, ever.** Not taste: a prompt asking this model for a scored cue
  came back `output_moderation_failed` on audio copyright in this repo,
  unbilled. Name the music words in `AVOID` as well as writing `no music` —
  that is the pair of blocks the two clean runs used.
- **No on-screen text, ever.** The model invents lettering, and this is the
  genre where a user most wants a name card. Captions, lower thirds and titles
  go on in an editor afterwards. The one route that works is a *prepared
  still* attached as a frame — text approved on an image and then preserved
  is a different and measured task — and on this route the frame slot is
  already spent on the portrait.
- **`--generate-audio` stays at the server default (`true`).** A talking head
  with audio off is a silent film of someone's mouth moving.

### Worked example — 12 seconds, 33 words, portrait attached

**This has not been generated as written.** It is the template filled in.

```
One continuous shot, 12 seconds, fixed camera, no cuts.
IDENTITY: image1 is the speaker — take the face, hair and clothing from it exactly and keep them unchanged for the whole clip.
SCENE: a home study; a bookshelf softly out of focus behind her. The only light is a window to the front-left, soft and slightly cool, with a gentle falloff across the far cheek.
FRAMING: chest-up medium close-up, fixed camera, background softly blurred; real mirrorless texture with slight sensor noise, real skin texture, no smoothing.

She faces the camera and says, conversational and unhurried, with a small smile at the start: "We shipped the new dashboard this morning. It is faster, it is quieter, and it finally remembers where you were. If you had it pinned to a workaround, you can drop that now."
0-2s: she looks straight into the lens, one natural blink, the smile settles. 2-5s: on "faster" one small open-palm beat, low in frame, and the hand leaves again. 5-8s: stillness; the head tilts a few degrees on "quieter". 8-11s: on "workaround" the hand opens once and drops. 11-12s: after "now" the lips close, one slow blink, the smallest nod, and the shot holds.

SOUND: quiet room tone, a little distant street. No music. Speech in English, mouth shape matched to it.
CONSISTENCY: face, hair, the grey knit top, the bookshelf and the light direction identical from the first frame to the last.
AVOID: subtitles, captions, on-screen text, watermarks, logos; a second person, an off-screen voice, a cutaway; music, score, soundtrack, instrumental, humming, singing; presenter cadence, theatrical over-acting, wild gesturing; skin smoothing, beauty filter, plastic skin, CGI look; camera movement, zooms, cuts.
```

33 words over 12 seconds is 2.75 words a second overall — about three a second
across the eleven seconds that carry speech, with the last second given to the
closing hold. The duration was chosen from the word count rather than the other
way round.

## Splitting a long script

When the script will not fit one clip and the user will not cut it, splitting
is the remaining option. Say what it costs before they choose it:

- **Each part is a separately billed job.** Two 15-second clips cost two
  15-second clips; there is no discount and no shared context.
- **There is a visible join.** This skill produces individual jobs. Putting
  them end to end is an editing step outside it.
- **Continuity is only as good as the portrait.** Re-attach the *same* photo,
  cropped the same way, to every part, and repeat the `SCENE`, `FRAMING` and
  `CONSISTENCY` lines word for word. That is the best instrument available —
  and on this model it is untested, so a two-part clip may come back as two
  slightly different people in two slightly different rooms. Draft part 1 and
  part 2 cheaply and look at them side by side before paying for the finals.
- **Sentence boundaries, never mid-sentence.** A line split across a job
  boundary is the one thing this API has no mechanism for.
- **The cost table gets a row per part plus a total**, per
  `approval-gate.md` → "Batches get an itemised table, not one total".

Cutting to one idea is usually the better product, and it is worth saying
so plainly rather than quoting a five-part job with a straight face.

## Recommended defaults

| Parameter | Default | Why |
|---|---|---|
| `--model` | `alibaba/wan-3.0-prime` on the portrait route; the script's own default on the described-presenter route; **whatever the user named**, always | seedance-2.5 refuses a real person's photo at submission (measured, nothing billed); wan accepted the same portrait. See "Two routes" |
| `--frame-first-image` | the portrait, cropped to the delivery ratio, as a **local path** | it is the scenario's defining input; local files beat URLs on this field |
| `--duration` | derived from the word count at about 3 words a second (4 characters a second in Chinese or Japanese), then clamped to the model's range — which `ofox-video.sh models` prints | the script decides the length; a default that ignores it produces rushed speech |
| `--resolution` | draft at the model's cheapest tier, deliver one tier up | a face at the cheapest tier is where lip and eye detail goes first, so read the draft's frames rather than shipping it |
| `--aspect-ratio` | **not passed** when a portrait is attached — the crop decides it, and the script prints a `NOTE:` about `adaptive`; `9:16` on the text-only route unless the user said otherwise | one face is a vertical composition by default |
| `--generate-audio` | leave at the server default (`true`) | the speech *is* the deliverable |
| `--provider` | leave unset | the script pins an upstream for Seedance only; wan routes by weight across two, which is worth relaying rather than hiding |
| `--seed` | let the script roll one and keep it | printed as `SEED` and written to the `.json` sidecar. It does **not** reproduce a take — measured, an identical request on a fixed seed came back a visibly different clip — so a re-render is another roll aimed at the same shot. Say that before the user pays for one |
| `--real-person` | leave unset | untested on 2.5 in this repo, and irrelevant on the route this skill takes |

**Model ids, prices, resolutions, durations and aspect ratios are deliberately
not tabulated in this file.** They are catalog facts, they change, and this
repo has recorded defects that trace to a hardcoded copy of somebody else's
value table. Read them live, free, with no API key:

```bash
bash ../ofox-video-core/references/ofox-video.sh models
bash ../ofox-video-core/references/ofox-video.sh providers alibaba/wan-3.0-prime
```

`providers` with no model argument prints the flagship's matrix, not the
catalog — pass the id you actually mean. The rate `models` shows is the one at
each model's **own default resolution**, which differs between models, so it
ranks rather than quotes.

## Before you spend: the approval gate

**Never submit a paid job until the user has seen a cost table and said yes.**
The rule, the required columns and where the numbers must come from are
written down once for every Ofox skill in this repo:
[`../ofox-video-core/references/approval-gate.md`](../ofox-video-core/references/approval-gate.md).

Get the numbers from `--dry-run`, which validates everything and prints the
estimate **without sending a request**:

```bash
bash ../ofox-video-core/references/ofox-video.sh generate --dry-run \
  --model alibaba/wan-3.0-prime \
  --prompt "..." --duration 12 --resolution 480p \
  --frame-first-image /absolute/path/to/portrait-9x16.jpg \
  --out-dir /absolute/path/to/out
```

Relay the `Estimated cost:` line it prints — never a number of your own — then
wait for a yes, then re-run the identical command with `--dry-run` removed.
The estimate a *real* run prints comes microseconds before the request goes
out, too late to relay. Pass the same `--out-dir` to both.

Two things belong in that message beyond the table:

- **the script, quoted in full**, so the user can see their own words
  unaltered;
- **one line saying this scenario has no paid run behind it**, and that the
  model it uses has no speech measurement in this repo. A user approving an
  experiment should know it is one.

This skill has **no cost anchor**, because it has never been billed. The
`--dry-run` figure at the parameters you are about to send is the only number
to put in front of anyone.

Afterwards the **actual** bill is `VIDEO_COST` from the finished job. Report
it as money, not as the raw ten-decimal string.

## Several takes

A face is a roll like any other, and this one has two things to judge that a
single take cannot settle — does it look like them, and does the mouth match
the words. `batch` prices the whole set up front, waits concurrently, and
tiles a contact sheet:

```bash
bash ../ofox-video-core/references/ofox-video.sh batch --dry-run \
  --model alibaba/wan-3.0-prime \
  --prompt "..." --takes 3 --duration 6 --resolution 480p \
  --frame-first-image /absolute/path/to/portrait-9x16.jpg \
  --out-dir /absolute/path/to/out
```

Quote `BATCH_COST_TOTAL`, not `BATCH_COST_PER_TAKE`, and give the takes a row
each. Hand over the `CONTACT_SHEET` path on its own line, then the take paths
beneath it. **A contact sheet cannot tell you whether the mouth matches the
speech** — it is frames, and lip-sync is a relationship between frames and
audio. Watch one take before promoting it.

A cheap early draft is worth more here than in most scenarios: run a short
clip carrying only the first sentence, at the cheapest tier, to find out
whether this route works for this face at all before the full script is
priced.

## Pricing a job with no API key

`models`, `providers` and `generate --dry-run` all work with `OFOX_API_KEY`
unset. So when a user hasn't signed up yet, **quote the job first and let them
decide whether it's worth registering** — don't open by sending them to a
signup form.

## If the script isn't found

```
bash: ../ofox-video-core/references/ofox-video.sh: No such file or directory
```

Nothing is broken — this skill delegates all execution to `ofox-video-core`
and reaches it by relative path, and that path just missed. Two different
situations wear this message, so run the probe in "Where the core skill lives"
before deciding which:

- **The probe printed a directory** — the core is installed and only the
  directory *name* was wrong, which is the normal LobeHub case
  (`ofoxai-skills-ofox-video-core`). Re-run against what the probe printed.
- **The probe printed nothing** — `ofox-video-core` really is absent, and the
  fix belongs to whichever installer the user already has: `npx ofox-skills`
  (this repo's own) or the underlying
  `npx skills add ofoxai/skills --skill '*' --agent '*' --global --yes` for
  skills.sh; on LobeHub or ClawHub, install `ofox-video-core` from the same
  publisher.

Either way, name the missing skill and where it was expected rather than
relaying the raw path error, which names neither.

A broken link to a shared reference has the same two causes. This skill
degrades gracefully: the question set, the template, the word budget and the
defaults are all written out here. What is out of reach is the detail behind
them — the full delivery and camera vocabulary, the gallery cases behind the
word rates, and the exact wording of the spend gate, which stays mandatory
either way.

## Exit codes worth knowing

Full table in [`../ofox-video-core/SKILL.md`](../ofox-video-core/SKILL.md).
The ones that come up:

| Code | Meaning | What to do |
|---|---|---|
| `1` | Parameter rejected locally, no network call, nothing billed | Fix the flag and retry freely |
| `2` | Environment problem — `curl`/`jq` missing, or no `OFOX_API_KEY` | Ask the user to fix it; `check` reports the same |
| `3` | API rejected it, or the job ended failed/cancelled/expired | Read the mapped message; a rejected create was not billed |
| `4` | Timed out waiting — **the job is still running and billable** | `poll JOB_ID`, never re-run `generate` |
| `5` | Ambiguous network failure on create | Do not retry blindly; check https://app.ofox.ai first |
| `6` | `--out-dir` unusable | Fix the path; if it happened after a create, `poll JOB_ID` |

## How long to tell the user it will take

`generate` blocks while it polls, up to `--max-wait` (default 540s). A short
low-resolution clip is usually one to three minutes. Say so before starting,
so the wait isn't silent.

If your tool call can't stay open that long, use `create` (submits and returns
a job id in seconds) followed by `poll`. That way a timeout can never strand a
job whose id you never saw.

## Where the file lands

Always pass `--out-dir`, and **make it an absolute path**. Without it the
script writes to the current working directory — which, given that the
examples here run from this skill's own directory, would drop the user's video
inside an installed skill. Relay the **absolute** `VIDEO_PATH` the script
prints, on its own line.

Pass `--name` too, named after the clip rather than left for the script to
guess from the prompt's opening words, which here describe a shot length. The
clip lands as `<name>-<short job id>.mp4` with a `.json` sidecar holding the
full job id, the prompt, the seed and the real cost.

## Generating

```bash
bash ../ofox-video-core/references/ofox-video.sh generate \
  --model alibaba/wan-3.0-prime \
  --prompt "<the talking-head prompt built above>" \
  --name "<short clip name, e.g. anna dashboard intro>" \
  --duration 12 \
  --resolution 480p \
  --frame-first-image /absolute/path/to/portrait-9x16.jpg \
  --out-dir /absolute/path/to/out
```

Drop `--frame-first-image` and add `--aspect-ratio 9:16` on the
described-presenter route, and drop `--model` with it — that route goes to the
script's own default.

This one call validates the parameters, submits the job, polls to completion,
downloads the mp4, and prints `STATUS`, `JOB_ID`, `VIDEO_PATH`,
`VIDEO_SECONDS`, `SEED` and `VIDEO_COST`. Report the **actual** values from
that output — never the estimate, and never a path or cost you didn't see the
script print. Do not re-implement any of the request, poll or download logic
here.

## After it lands: what to actually check

Three things, in this order, before calling it done. None of them is
`STATUS completed`.

1. **Is it the right person?** Open the first frame and compare it against the
   portrait. On this model that comparison has never been made in this repo,
   so it is the check that carries the most new information.
2. **Do the mouth and the words agree?** Watch it once with sound. A contact
   sheet cannot answer this.
3. **Were all the words said?** Count them against the script. Rushed,
   clipped or dropped endings mean the clip was over budget, and the fix is a
   longer clip or fewer words — never a faster delivery.

Report what you checked, not just that it finished.

## Common failure modes and fixes

| Symptom | Cause | Fix |
|---|---|---|
| Exit `3`, `input_moderation_failed` on create | A real person's photo was sent to a model that refuses it — `bytedance/seedance-2.5` does, measured | Re-run on `alibaba/wan-3.0-prime`. Nothing was billed. Do not reach for `--real-person true`; it is untested on 2.5 here |
| `input_moderation_failed` on `wan-3.0-prime`, after an earlier portrait went through | Wan is not upstream-pinned and Ofox routes by weight across two upstreams that moderate differently | Re-run; if it repeats, try `minimax/hailuo-3`, which also accepted a portrait in the same comparison. Nothing was billed either way |
| The speech is rushed, garbled, or the last words are missing | More words than the clip holds | Longer clip (inside the model's range) or fewer words. Never compress the delivery. New prompt, new cost table |
| The clip ends mid-sentence | Same cause, and a missing ending beat | Re-budget at about 3 words a second **and** write the final beat explicitly — "after `<last word>` the lips close and the shot holds" |
| The voice speaks the wrong language | The quoted line was translated on the way into the prompt | Put the user's own words in, untouched. The line's language decides the voice's language |
| The person in the clip is not the person in the photo | The frame lock is unmeasured on this model — this is the known-weak point of the route, not a bug you can flag-fix | Re-roll cheaply; try a tighter, better-lit, more frontal portrait; try `minimax/hailuo-3`. If it will not hold, say so rather than spending again — and tell the user what was tried |
| The mouth moves without matching the words | Unmeasured on this model | Same as above, plus keep `mouth shape matched to <language>` in the prompt. Judge it on a cheap draft, not on the deliverable |
| Garbled lettering, a name card nobody asked for | The model invents text | Keep the text items in `AVOID`, and compose lettered surfaces out of the background. Real captions go on in an editor |
| A music bed nobody asked for | `--generate-audio true` and a prompt that didn't exclude music | Keep `no music` in `SOUND` *and* the music words in `AVOID` |
| Exit `3`, `output_moderation_failed` mentioning audio copyright | The prompt asked for music | Rewrite `SOUND` as room tone only and re-run — a new request, safe immediately, nothing was billed |
| The clip is not the ratio that was asked for | A frame is attached, so the ratio follows the image | Crop the portrait to the target ratio and re-run. Crop, never pad |
| A second person, or a cutaway, appears | A talking head is one shot; anything suggesting a scene invites one | Declare `one continuous shot, fixed camera, no cuts` in the first sentence and keep the cutaway items in `AVOID` |
| Exit `4`, timed out waiting | Still running upstream, not failed | `poll JOB_ID` with the id printed before the timeout; never re-run `generate` |
| Exit `5`, ambiguous network failure on create | No HTTP response at all — can't tell whether a job exists | Don't guess or retry; tell the user to check https://app.ofox.ai |

## When NOT to use

- **Two or more people talking to each other** — `seedance-short-drama`. The
  boundary is not "is there dialogue", it is *who is being addressed*: a scene
  between characters is that skill, one person addressing the viewer is this
  one. Short drama also owns shot lists, cuts and stage direction, none of
  which belongs in a talking head.
- **The words still have to be found** — `explainer`. If the user has an
  article, a doc or a changelog and no script, the work is choosing one idea
  and compressing it, which is that skill's entire subject. Come back here
  when there is a face and a finished sentence.
- **A polished brand or product ad** — `seedance-ad-creative`. A spokesperson
  in an ad is an ad.
- **A handheld, phone-shot creator clip** — `ugc-ads`, even when the creator
  talks to camera. That skill inverts the polish this one defaults to.
- **The user has a voice recording they want heard.** Nothing here can be
  made to speak supplied audio — measured. An editor over a generated or
  filmed picture is the answer, and saying so early is cheaper than a job.
- **A long script.** Past about ninety words there is no single clip for it,
  and past two or three parts the honest advice is to film it or use a
  dedicated avatar product. Say so before quoting a five-part job.
- **Someone whose likeness the user cannot use.** Not a routing note; a stop.
