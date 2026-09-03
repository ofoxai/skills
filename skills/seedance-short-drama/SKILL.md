---
name: seedance-short-drama
description: Generate a realistic-human, dialogue-driven short-drama clip — one shot, or a few hard-cut shots inside one job — from a script or scene description using the Ofox video API (Seedance 2.5). Runs a short creative brief when the input leaves beat, aspect ratio, emotional arc or camera feel open ("Let the AI decide" is offered on the taste questions, never on a must-ask one, and never as the default), writes a structured prompt (header manifest, timestamped shots, quoted dialogue with delivery notes, consistency lock), shows a cost estimate, then calls ofox-video-core to submit, poll, download, and report the real cost. Use when a user asks to turn a script beat into video, e.g. "generate scene 3 of this script, two characters talking, 15 seconds", "make a vertical short-drama clip of these two arguing in a kitchen", "turn this dialogue into a 12-second video", or "give me a realistic short-drama shot of a couple breaking up at a train station". Do not use for silent product/brand shots (see seedance-ad-creative), for anime- or manga-styled scenes (see seedance-anime-drama), or for anything not involving people/dialogue.
license: MIT
version: "1.7.0"
homepage: https://github.com/ofoxai/skills/tree/main/skills/seedance-short-drama
metadata:
  author: ofoxai
  version: "1.7.0"
  openclaw:
    requires:
      env: [OFOX_API_KEY]
      bins: [curl, jq]
    primaryEnv: OFOX_API_KEY
    envVars:
      - name: OFOX_API_KEY
        required: true
        description: Ofox API key. Create one at https://app.ofox.ai (Settings -> API Keys). The same key works across every Ofox skill.
    emoji: "🎭"
    homepage: https://github.com/ofoxai/skills/tree/main/skills/seedance-short-drama
---

# seedance-short-drama: dialogue-driven short-drama shots

Turns one beat of a script into a realistic-human video clip — one shot, or a
few hard-cut shots inside a single job. A short creative brief settles what
the script leaves open; a structured prompt (character block, timestamped
shots, quoted dialogue with delivery notes, consistency lock) goes to
Seedance 2.5; this skill submits, polls, downloads and reports the cost.

This skill is a thin, scenario-specific layer over
[`ofox-video-core`](../ofox-video-core/SKILL.md). It owns the short-drama
prompt craft, the pre-generation brief, recommended defaults, and this
scenario's rows in the approval table; `ofox-video-core` owns talking to the
Ofox API correctly and safely (the `OFOX_API_KEY` handling, the no-resubmit
rule, error-code mapping, download/verification). **Read that skill's safety
contract before using this one** — it is not restated here.

Three shared references from `ofox-video-core` are load-bearing here and are
linked, not copied:

- [`../ofox-video-core/references/creative-brief.md`](../ofox-video-core/references/creative-brief.md)
  — what to ask the user before a prompt exists: the three tiers, one round of
  at most four questions, the "Let the AI decide" discipline, the skip rows,
  and the anti-patterns. Read it before the brief section below, which adds
  only this scenario's question set.
- [`../ofox-video-core/references/prompt-structure.md`](../ofox-video-core/references/prompt-structure.md)
  — the vendor's formula, the header-manifest → timeline → closing-block
  skeleton, timestamp formats and segment lengths, transition and camera
  vocabularies, consistency locks and negative lists, dialogue density,
  reference-image semantics, endings. Load it before writing a prompt; this
  file adds only what is specific to short drama.
- [`../ofox-video-core/references/approval-gate.md`](../ofox-video-core/references/approval-gate.md)
  — never spend before an approved cost table.

## Before generating: the availability check

Run this once per session (not on every request):

```bash
bash ../ofox-video-core/references/ofox-video.sh check
```

If it fails, follow `ofox-video-core`'s guidance (install `curl`/`jq`, or get
an `OFOX_API_KEY` at `https://app.ofox.ai`) — don't dead-end the
conversation, and don't re-run this check on every subsequent request once
it has passed.

## Shots, cuts and jobs

One job is one clip of 4–30 seconds, and a clip **can hold several shots
joined by hard cuts**. Write the timestamps as cut boundaries — `SHOT 2
(3-6s): … HARD CUT.` — and on the runs measured so far Seedance 2.5 cuts
there. Default to **2–5 seconds per shot**.

The evidence is exactly two real runs, 2026-09-03: `bytedance/seedance-2.5`
on `byteplus`, 8 seconds, 480p, 16:9, `--generate-audio false`, no image
attached, three shots and two hard cuts each, in two different notations.
Both cut at the written stamps to about ±1 second, and the character
described once in a manifest survived all three shots on text alone. The job
ids, the prompts and the frame-by-frame reading are under "Several shots in
one job" in `../ofox-video-core/references/prompt-structure.md`; that section
also lists what those two runs did **not** cover — clips near 30 seconds or
with more than three shots, dialogue running across a cut, any other
resolution, the `volcengine` upstream. Add one more for this skill: those
runs were silent, and every real short-drama job has audio on with lines in
it. A first attempt outside that envelope is an experiment — say so, and
price it as one.

If you mean beats inside one held shot rather than cuts, declare `one
continuous shot` in the first sentence; without it a timestamped list reads
as a cut list ("Two things a timestamp can mean" in the shared file).

### Where separate jobs and `chain` fit

- **Separate `generate` calls** when each shot needs its own approval, seed,
  resolution or duration, or when the sequence runs past 30 seconds. Each is
  a separately billed job; this skill does not stitch clips.
- **`ofox-video-core`'s `chain`** carries one job's closing frame into the
  next. **It does not work in this scenario** — the carried frame holds a
  photoreal person, which Seedance 2.5 refuses ("Reference images and real
  people"). Say so up front rather than letting the user discover it
  mid-sequence. Consecutive short-drama jobs are generated independently;
  continuity across them is text — the same character block word for word
  plus the `CONSISTENCY` line of the template.

A script that spans several scenes is still not one job. Which beat gets the
clip is the brief's first question; do not compress a chapter into 30
seconds.

## Prompt language follows the audio

Audio is generated on by default, and the model speaks **whatever language the
quoted lines are written in**. So keep dialogue in the user's own language —
if they give you Chinese lines, put Chinese in the prompt. Translating them to
match the English examples in this file produces an English-dubbed clip, and
the user only finds out after paying for it.

The rest of the prompt (setting, camera, lighting) can be English regardless;
it is the quoted speech that determines the spoken language. The dialogue
budget is in two tiers, below; for Chinese and Japanese count characters
rather than words.

## Before writing the prompt: the creative brief

The shared rules are in
[`../ofox-video-core/references/creative-brief.md`](../ofox-video-core/references/creative-brief.md)
— the three tiers, the one-round limit, the shape of a question, the "Let the
AI decide" discipline, the generic skip rows, the order with the approval
gate, the fallback for a runtime without `AskUserQuestion`, and the
anti-patterns. Read it before writing a prompt. This section adds only what
is specific to short drama.

Read the user's message and attachments first, and mark every axis of the
clip **settled** or **open**. Zero questions is common here: a beat pasted
with its stage directions plus "15 seconds, vertical, for Reels" has settled
every axis — write the prompt.

| Tier | Short-drama axes |
|---|---|
| **must-ask** | which beat of a multi-scene script to render; whether an asset the request implies actually exists |
| **ask-if-open** | aspect ratio, emotional arc, camera feel; a draft batch versus one final, but only when the user is already exploring |
| **never-ask** | resolution, model, provider, audio on/off, duration once stated |

### The short-drama questions

| # | Tier | Header | Question | Options — first is recommended; "Let the AI decide" comes last wherever it appears, and never on a must-ask row | Ask when |
|---|---|---|---|---|---|
| 1 | must-ask | `Beat` | Which beat gets this clip? One job holds 4–30 seconds. | Two or three beats extracted from the script, each named by its turning line or action (`Kitchen confrontation — "Where were you last night?"`, `She walks out — no lines`); recommended = the one with the clearest reversal. **No "Let the AI decide" here** — a must-ask axis never gets one, and no model can tell which beat the user meant. If they answer "you pick" in free text, choose the strongest beat, name it in the recap, and let the gate be the check | The script spans more than one scene or more than about 30s of action. A single beat: skip. |
| 2 | ask-if-open | `Aspect` | Where will it be watched? Vertical and landscape are different framings, not a crop. | `9:16 vertical (recommended)` — mobile short-drama feeds, the default below / `16:9 landscape` — web and YouTube; the gallery's own short-drama sample is mostly landscape (5 of the 6 cases that state a ratio) / `Let the AI decide` | No platform word and no ratio in the input. |
| 3 | ask-if-open | `Arc` | How does the feeling move across the clip? It decides the shots. | Two or three arrow chains built from the script (`braced → hears him → wavers → wry smile → "We're done." → steps back`, adapted from case 3; `calm → the lie lands → silence → she leaves`); recommended = the one the lines support most directly / `Let the AI decide` | Lines with no stage directions and no tone word. Stage directions present: skip. |
| 4 | ask-if-open | `Camera` | What should the camera feel like? | `Handheld documentary (recommended)` — breathing sway, 35mm grain; the realistic short-drama convention (cases 1, 4, 6) / `Steady cinematic` — slow push from a medium two-shot into a close-up (cases 1, 22) / `Static over-the-shoulder` — locked at the partner's eye height, reframing comes from the actors, no shot/reverse-shot (case 3) / `Let the AI decide` | No camera word in the input. |
| 5 | follow-up | `Lines` | The lines overrun this duration's budget (tiers below). | `Extend to <N> seconds (recommended)` — keeps every line; state N / `Trim to budget` — the cut lines are shown before the cost table / `Let the AI decide` | Only when the dialogue exceeds its tier for the chosen duration. |
| 6 | ask-if-open | `Drafts` | Several takes to choose from, or one final? | `One 720p final on seedance-2.5 (recommended)` / `Four 480p drafts on seedance-2.0-mini, then the final` — a different model is a different look, not only a different price; see "Several takes to choose from" / `Let the AI decide` | Only when the user asks for versions, or says they are unsure what they want. |

If more than four are open, ask in this order: `Beat`, `Aspect`, `Arc`,
`Camera`; `Lines` is the follow-up; `Drafts` folds into the cost table as a
second row. Never asked: the language of the lines (follows the script),
resolution, model, provider, audio on/off — all rows in the table.

### Skip rows specific to short drama

On top of the generic rows in `creative-brief.md`:

| Signal in the input | Axis | Value |
|---|---|---|
| The language the quoted lines are written in | spoken language | that language — **never asked**; see "Prompt language follows the audio" |
| Stage directions in the script ("crying", "slams the door", "deadpan") | emotional arc | build the arc from them |
| A tone adjective ("tense", "tender", "bitter") | emotional arc | build the arc from it |
| A camera word ("handheld", "locked off", "slow push") | camera feel | as stated |
| An image attached to the request | asset question | settled; see "Reference images and real people" for the route it takes and the real-person refusal |

### Every answer lands somewhere

| Answer | Where it goes |
|---|---|
| Beat | which lines and actions the timeline covers; the `--name` |
| Aspect | `--aspect-ratio` |
| Arc | the `ARC` arrow chain in the header and the 1–3 signals in each shot |
| Camera feel | the `CAMERA` line and each shot's size / position / movement |
| Lines over budget | `--duration`, or the trimmed lines shown in the recap |
| Drafts | `batch` on `bytedance/seedance-2.0-mini` at 480p, or a single `generate` |

### The recap for this scenario

```
Brief
- Beat: the kitchen confrontation — "Where were you last night?" (your choice)
- Aspect: 9:16 (inferred from "for Reels")
- Arc: composed → hears the excuse → wavers → wry smile → "We're done." → steps back (AI's pick)
- Camera: handheld documentary, over-the-shoulder into a held close-up (your choice)
- 720p, 15s, byteplus, audio on (defaults — rows in the table below)
```

Then the full prompt, then the table `approval-gate.md` specifies, all in one
message.

## Prompt template

Load these sections of `../ofox-video-core/references/prompt-structure.md`
first: "Prompt skeleton: header manifest, timeline, closing block",
"Segmenting the timeline", "Camera language", "Consistency locks and the
negative list", "Dialogue and sound", "Endings". The vocabulary — shot sizes,
movements, transition phrases, negative-list items — lives there and is not
repeated. What follows is the short-drama shape laid over that skeleton.

Gallery evidence for the shape: the eight short-drama prompts (cases 1–8) are
the only category timestamped 8 of 8. Of the 11 short-drama and talking-head
prompts, 8 carry a capture-medium style anchor and 8 carry a negative list —
two overlapping sets of eight, not the same eight. 6 of the 8 prompts with
dialogue attach a delivery note. Chinese-language cases are quoted in
translation.

### 15–30 seconds: one or several shots

Slots in `<angle brackets>`; optional lines in `[square brackets]`. Two to
five seconds per shot; most shots carry no line.

```
[FORMAT: <ratio>, <T> seconds, <N shots, hard cuts on the timestamps | one continuous shot, no cuts>]      — optional; must match the flags
STYLE: live-action, <colour 35mm film grain | phone or mirrorless realism, slight sensor noise>, <light: soft cool key from front-left, warm rim from behind | tungsten practicals>, <palette or grade>.
<TAG A>: <age range, build>, <hair>, <clothing item by item, colour + material — "grey turtleneck knit top, small gold hoops, thin chain">, <one bearing word>. Referred to as "<tag A>".
<TAG B>: <same fields> — or: heard only, never shown | seen only as a dark, heavily out-of-focus shoulder at frame right.
SCENE: <place, time of day, light direction and colour temperature, one foreground element, weather or room tone>.
ARC: <state 1> → <what she hears or sees> → <wavering> → <the cover: wry smile, looks down> → <the line that turns it> → <the exit action>.

SHOT 1 (0–<a>s): <shot size, camera position, movement>. <tag A> <one action — at most 1–3 visible signals: eyes, hands, breath>. [<Tag B> (off-screen, <tone>): "<line>".] <sound for this beat>
HARD CUT.                                                                — or: Without cutting, <what changes the framing: she steps back; the camera drifts>
SHOT 2 (<a>–<b>s): … [<Tag A> (<tone>): "<line>" — <delivery: quiet, no anger; on "<word>" the eyes steady>.]
SHOT <N> (<x>–<T>s): … <ending state: hold on her face for one second | hard cut to black at the peak | the camera settles and the clip runs on a moment>.

CAMERA: <lens: 70–100mm medium telephoto | 24mm wide>, <depth of field>, focus stays on <tag A>'s eyes; <axis rule: one eye-line axis, never crossed>.
SOUND: <room tone>, <two diegetic sounds tied to actions: door click, fabric>; music <none | enters at <t> | drops out at <t>>. Dialogue in <language>, mouths matched to it.
CONSISTENCY: <tag A>'s face, hairstyle, <accessory>, <clothing items> identical in every shot; <tag B>'s <items>; positions and light direction do not change.
AVOID: subtitles, on-screen text, watermarks; extra or warped limbs; CGI look, plastic skin, skin smoothing; <the cuts you forbid: jump cuts, dissolves | shot/reverse-shot when one continuous shot>; theatrical over-acting, sudden tears.
```

What each short-drama slot is for, and where it comes from:

| Slot | Why it is here | Cases |
|---|---|---|
| `ARC` arrow chain | Five or six states in a row give the model a path rather than a mood; each shot then owns one step of it | 3 (`tense preparation → hears the familiar greeting → brief wavering → wry smile as cover → resolute declaration → restrained exit`), 8 |
| 1–3 visible signals per shot | More reads as over-acting; the gallery's most controlled performance prompt caps it and bans the tear | 3, 20 |
| Delivery note on every line | Volume, tone, accent, and what the face does on which word — present in 6 of the 8 dialogue prompts | 3, 7 (`controlled and intimate, not theatrical`), 22 (`confident Australian accent`), 5 |
| Off-screen or unseen partner | A voice without a face, or a silhouette kept out of focus, is cheaper to keep consistent and stronger dramatically | 3 (the man is heard off-screen and seen only as an out-of-focus shoulder), 21 (`cut to the voice only … as a voiceover`) |
| Two people told apart by wardrobe colour blocks | Case 7's four characters are `cobalt trench / rust knit polo / faded green workwear / pale gray suit` and nothing else, and stay distinguishable | 7, 1 |
| Ending state | Stated in 6 of the 11: freeze, black, `End on …`, the camera settling | 4 (`hard cut to black at the peak of suspense`), 5 (`the frame freezes`), 7, 8 |
| Separate `SOUND` block | Room tone plus two or three sounds keyed to actions; music in and out points | 3, 4, 7, 6 |
| `AVOID` — the short-drama items | subtitles / text / watermarks (6 of 11); CGI or plastic skin (1, 4, 20); over-acting (3, 20); the transitions you are not making (3, 8) | 4, 5, 20 |
| Clothing with colour and material | The one appearance field every gallery prompt that describes a character writes; age, build, hair, eyes appear as needed | 1, 3, 4, 5, 7, 8 |

Camera choices that recur in this category, all in the shared "Camera
language" tables: over-the-shoulder at the partner's eye height, held (case
3); a fixed close-up where the reframing comes from an actor stepping back,
not a zoom (3); a close handheld follow that stays just behind and beside (6);
a frontal medium two-shot with a slow push into a close-up (1, 22); `do not
cut to shot/reverse-shot` when the point is one held take (3).

### Dialogue budget — two tiers

| Tier | Budget | What the gallery measured |
|---|---|---|
| **Dialogue drama** — two people, an exchange | **0.4–1.7 words/s over the clip**; one 2–4s beat may peak at 3.5–5. Treat 2–3 words/s as a ceiling, never a target — most seconds carry no line | case 3: 6 words in 15s; case 1: 51 words in 30s; case 7: 43 words in 30s |
| **Monologue / talking head** — one person to camera | **3.5 words/s English; 5 characters/s Chinese or Japanese** | case 22: 103 words in 30s; case 20: 50 characters in 10s |

A script that overruns its tier is the brief's `Lines` question: extend the
duration (within 30s) or trim and show the trimmed lines in the recap.
Compressing the delivery is what produces rushed, garbled speech.

### Worked example — adapted from case 3 (translated): 15 seconds, one continuous shot

The original attached a photo of the actress; on Ofox that is refused (real
person), so this version carries her in text. Six spoken words in fifteen
seconds — this is what the drama tier looks like in practice.

```
STYLE: live-action, natural light, soft cool-white key from about 45 degrees front-left, a little warm gold rim from behind; real skin texture, no smoothing; nothing theatrical in the lighting.
HER: woman around 30, slim, dark hair in a low knot, small silver hoops and a thin chain, grey turtleneck knit top; composed, tired. Referred to as "her".
HIM: heard off-screen; seen only as a dark, heavily out-of-focus shoulder and jaw at frame right, never in focus, never turning to camera.
SCENE: an apartment doorway at dusk; she is inside, he has just opened the door; quiet street tone outside.
ARC: braced → hears the familiar greeting → a flicker of the old warmth → wry smile as cover → "We're done." → one step back.

One continuous shot, 15 seconds, no cuts, no shot/reverse-shot.
0.0–0.8s: The door opens toward camera; the frame is mostly his dark blurred shoulder; she is revealed behind it, chest-up, centred slightly left, eyes down.
0.8–3.2s: Him (off-screen, casual, a smile in it): "Hey, what's up, baby?" Her eyes lift to his; one slow blink. Sound: door click, fabric.
3.2–6.0s: A half-breath. The corner of her mouth moves — the start of a smile that does not arrive. Nothing else moves.
6.0–9.5s: Her (very quiet, very clear, no anger): "We're done." A short intake of breath before it; "We're" still carries warmth, on "done" the eyes steady.
9.5–13.0s: Lips close. She holds his look a full second, then one step back; the framing loosens from close to medium close-up because she moved, not the lens.
13.0–15.0s: She turns her head a few degrees away. Hold. Room tone only; no music.

CAMERA: over-the-shoulder from behind his right shoulder at her eye height, 70–100mm equivalent, shallow depth of field, focus locked on her eyes throughout; his outline stays out of focus at frame right; one eye-line axis, never crossed; no push, no zoom, at most a faint breathing sway.
SOUND: door hinge, knit fabric, distant street; no score. Dialogue in English.
CONSISTENCY: her face, hair knot, hoops, chain, grey turtleneck and apparent age identical throughout; his position and the light direction do not change.
AVOID: subtitles, on-screen text, watermarks; tears rolling, hysterics, exaggerated frowning; shot/reverse-shot, fast push-ins, orbits, sudden zooms, multi-camera switching; plastic skin, beauty filter.
```

### 10 seconds or less: one shot, no manifest

No header — the vendor's formula order in three or four sentences (no gallery
prompt of 10s or less carries a manifest). The micro-beats are performance
beats inside the one shot, so say `fixed camera` or `one shot` to keep them
from reading as cuts.

```
<Tag>, <appearance in one clause — hair, top with colour>, <place and light>. <Shot size — chest-up medium close-up>, <fixed camera | faint handheld>, <background softness>; <capture medium: real phone or mirrorless texture, slight sensor noise>.
<Tag> faces <the camera | someone off-screen> and says, <tone>: "<line — talking-head tier: up to 3.5 words/s English or 5 characters/s Chinese; drama tier: far fewer>".
0–<a>s: <eye contact, a blink>. <a>–<b>s: on "<word>", <one gesture: a small head shake>. <b>–<c>s: <second gesture>. <c>–<T>s: after "<last word>", <ending: lips close, half-second pause | the smallest nod>.
Natural blinks, breath, micro-expressions, real skin texture; mouth matched to <language>. No presenter cadence, no over-acting, no smoothing, no filters, no camera movement, no subtitles, no on-screen text.
```

Adapted from case 20 (translated), 10 seconds, 9:16 — 19 words in ten
seconds, inside the talking-head tier:

```
A woman in her late 20s, straight dark hair past the shoulders, plain oatmeal knit sweater, in a bright home study; soft window light from front-left, a bookshelf softly blurred behind her. Chest-up medium close-up, fixed camera, no movement; real mirrorless texture with slight sensor noise, like a knowledge creator filming herself.
She faces the camera and says, conversational, unhurried: "People think AI understands you. It doesn't. It predicts the next word — and that turns out to be enough."
0–2s: she looks straight into the lens, one natural blink. 2–5s: on "It doesn't" a single light head shake. 5–8s: one hand enters low in frame for a small open-palm gesture on "predicts". 8–10s: after "enough" her lips close and she gives the smallest nod.
Natural blinks and breath, real skin texture, mouth matched to English. No presenter cadence, restrained hands, no smoothing, no influencer filter, no dramatic lighting, no camera movement, no subtitles, no watermark, no on-screen text.
```

### Reference images and real people

Both meanings of an attached image ("Reference assets as visual anchors" in
the shared file) meet the same wall in this scenario:

- `--frame-first-image` / `--frame-last-image` with a photoreal person is
  refused by `bytedance/seedance-2.5` at submission
  (`input_moderation_failed`; verified 2026-08-30; nothing billed).
- The identity-reference route (`input_references` through `--extra-json`)
  has **not been tested with a real person in this repo either way** — do not
  assume it passes.
- `--real-person true` is the documented path for authorised likenesses on
  `bytedance/seedance-2.0`; whether it lifts the refusal on 2.5 is **untested
  here** (`../ofox-video-core/references/api-params.md`).

So a short-drama character's consistency across jobs is text: the same
appearance block word for word, plus the `CONSISTENCY` line. If a user
attaches a photo of a real person anyway, say what will happen before
spending anything, and confirm they have rights to the likeness.

## Recommended defaults

| Parameter | Default | Why |
|---|---|---|
| `--model` | `bytedance/seedance-2.5` (script default, no flag needed) | current-generation model |
| `--duration` | `10`; match the user's stated length; when the brief settles on several shots, sum 2–5s per shot | enough room for a short exchange; Seedance 2.5 accepts 4–30 |
| `--resolution` | `720p` | realistic detail on faces and lip movement at a reasonable cost; `1080p` only for a hero shot the user will publish |
| `--aspect-ratio` | whatever the brief's `Aspect` answer was; `9:16` when that question was skipped, delegated or never asked | short drama is consumed vertically on mobile feeds. Note the gallery's own short-drama sample skews landscape — 5 of the 6 cases that state a ratio are 16:9 (1, 2, 3, 7, 8) — so the default is about the audience, not about what the gallery did |
| `--generate-audio` | `true` (server default, no flag needed) | dialogue needs an audio track — never set this `false` for a scene with spoken lines |
| `--real-person` | leave unset (`false`) | see "Reference images and real people" — a text-described character does not need it, and its effect on 2.5 is untested |

Always confirm the actual duration/aspect ratio with the user's request first
(e.g. "15 seconds" in the trigger example overrides the 10s default).

## Which upstream renders it

Jobs are pinned to the `byteplus` upstream (ByteDance's platform for markets
outside mainland China). Ofox otherwise picks between it and Volcengine Ark by
weight, and the two moderate differently, so pinning keeps results consistent.
Pass `--provider volcengine` for the mainland platform, or `--provider auto` to
let Ofox choose. Pricing is identical either way. See
`ofox-video-core/references/api-params.md` for the detail.

## Before you spend: the approval gate

**Never submit a paid job until the user has seen a cost table and said yes.**
The rule, the table's required columns, where the numbers must come from, how
to itemise a batch and what to do when no estimate is possible are written
down once, for every Ofox skill in this repo:
[`../ofox-video-core/references/approval-gate.md`](../ofox-video-core/references/approval-gate.md).
Follow it rather than improvising; everything below is only what this scenario
adds to it.

The numbers come from `--dry-run`, per "Where the numbers come from" in the
shared spec:

```bash
bash ../ofox-video-core/references/ofox-video.sh generate --dry-run \
  --prompt "..." --duration 15 --resolution 720p --out-dir ./out
```

After the yes, re-run the identical command with `--dry-run` removed — same
prompt, same flags. A prompt edited between the quote and the run is a new
table.

What this scenario's message needs beyond the table: the **brief recap** (the
block shown above, with `(AI's pick)` and `(inferred …)` marked) and the
**quoted dialogue in full** inside the prompt, since a line silently
rewritten or translated is the most expensive thing that can go wrong here
(see the audio/language note above). One row for the clip at the duration and
resolution you settled on; a second row when the brief's `Drafts` answer adds
a draft batch.

## Several takes to choose from

Video generation is a slot machine — most takes go in the bin. When the user
wants options rather than one clip, use `batch` instead of running `generate`
repeatedly:

```bash
bash ../ofox-video-core/references/ofox-video.sh batch --dry-run \
  --prompt "..." --takes 4 --duration 8 --resolution 480p --out-dir ./out
```

It prices the whole batch up front, stops on the first failure instead of
burning the remaining takes, and produces a contact sheet — three frames per
take, one row each — so the user picks from one image instead of opening N
files. Price it the way the shared gate's "Batches get an itemised table, not
one total" requires: a row per take and `BATCH_COST_TOTAL`.

Hand the user the `CONTACT_SHEET` path on its own line, the same way you hand
over a video — in this flow it is the artifact they actually look at first,
since it is how they pick. Then list the individual take paths beneath it.

Each `TAKE` line carries `seed=N`. That seed is the handle for "take 3 was the
good one": re-run the same prompt with that seed on a better model or higher
resolution to reproduce that take rather than rolling a new one.

A single `generate` prints a `SEED` line too, and records it in the clip's
`.json` sidecar along with the resolution and aspect ratio. So "that one was
good, give me it at 1080p" works off one clip — you do not need a batch to
get a reusable handle.

Worth offering when the user is exploring (the brief's `Drafts` question):
draft cheap on `bytedance/seedance-2.0-mini` at 480p, then render the winner
on `bytedance/seedance-2.5`. Four 8-second drafts cost about 64 cents on mini
versus $7.68 on 2.5 at 720p. But **don't switch models on their behalf** — a
different model is a different look, not just a different price.

## Pricing a job with no API key

**No API key needed** to find out what something costs. All three of these
work with `OFOX_API_KEY` unset:

```bash
bash ../ofox-video-core/references/ofox-video.sh models      # models and rates
bash ../ofox-video-core/references/ofox-video.sh providers   # full price matrix
bash ../ofox-video-core/references/ofox-video.sh generate --dry-run \
  --prompt "..." --duration 15 --resolution 720p             # a real quote
```

So when a user hasn't signed up yet, **quote the job first and let them decide
whether it's worth registering.** Don't open by sending them to a signup form
— price it, show them the number, then point at
[app.ofox.ai](https://app.ofox.ai) if they want to proceed.

## If the script isn't found

```
bash: ../ofox-video-core/references/ofox-video.sh: No such file or directory
```

This means `ofox-video-core` isn't installed alongside this skill — not that
anything is broken. This skill delegates all execution to it and reaches it by
relative path. Fix: `npx skills add ofoxai/skills` (the whole repo). Say that
plainly rather than relaying the raw path error, which names neither the
missing skill nor the fix.

The same missing install also makes the shared reference files this skill
links to unreadable — `prompt-structure.md`, `creative-brief.md`,
`approval-gate.md` and `api-params.md` ship with `ofox-video-core`, not with
this skill (a scenario skill packages only its `SKILL.md` and
`CHANGELOG.md`), and the fix is the same one command. Until then this skill
still stands on its own: the prompt templates, the brief's question table and
the defaults are all in this file. What is out of reach is the detail behind
the general rules they point at — the full vocabulary lists, the wider
question-flow rules, and the exact wording of the spend gate, which stays
mandatory either way.

## Exit codes worth knowing

Full table in [`../ofox-video-core/SKILL.md`](../ofox-video-core/SKILL.md) —
the ones that come up:

| Code | Meaning | What to do |
|---|---|---|
| `1` | Parameter rejected locally, no network call, nothing billed | Fix the flag and retry freely |
| `2` | Environment problem — `curl`/`jq` missing, or no `OFOX_API_KEY` | Ask the user to fix it; `check` reports the same |
| `3` | API rejected it, or the job ended failed/cancelled/expired | Read the mapped message; a rejected create was not billed |
| `4` | Timed out waiting — **the job is still running and billable** | `poll JOB_ID`, never re-run `generate` |
| `5` | Ambiguous network failure on create | Do not retry blindly; check https://app.ofox.ai first |
| `6` | `--out-dir` unusable | Fix the path; if it happened after a create, `poll JOB_ID` instead of regenerating |

## How long to tell the user it will take

`generate` blocks while it polls, up to `--max-wait` (default 540s). A short
480p draft is usually one to three minutes; longer or higher-resolution jobs
take longer. Say so before starting, so the wait isn't silent.

If your tool call can't stay open that long, use `create` (submits and returns
a job id in seconds) followed by `poll`, instead of `generate`. That way a
timeout can never strand a job whose id you never saw. For `batch`, the worst
case is `takes x max-wait` — lower `--max-wait` for drafts, or create and poll
each take yourself.

## Where the file lands

Always pass `--out-dir`. Without it the script writes to the current working
directory, which is usually the user's project root. Pick something sensible
(`./out`, or wherever the user asked) and relay the absolute `VIDEO_PATH` the
script prints, on its own line.

Pass `--name` too. You know what the shot is — you just wrote the prompt for
it — so name the file after the beat rather than leaving the script to guess
from the prompt's opening words, which describe the style and the lighting.
The clip lands as `<name>-<short job id>.mp4` with a `.json` sidecar beside
it holding the full job id, the prompt and the real cost.

## Running the script

Paths in the examples above are written relative to **this skill's own
directory** (`skills/<this-skill>/`), which is where `../ofox-video-core/...`
resolves from. If you are running from somewhere else, adjust accordingly —
from the repo root it is `skills/ofox-video-core/references/ofox-video.sh`.

## Generating

```bash
bash ../ofox-video-core/references/ofox-video.sh generate \
  --prompt "<the short-drama prompt built from the template above>" \
  --name "<short beat name, e.g. doorway breakup>" \
  --duration 15 \
  --resolution 720p \
  --aspect-ratio 9:16 \
  --out-dir ./out
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
| Exit `3`, `error.code: input_moderation_failed` on create | An attached frame contains a real person — refused at submission, nothing billed | Drop the image and carry the character in text (see "Reference images and real people"); `--real-person true` is untested on 2.5 |
| Exit `3`, job ends `failed`, or `invalid_request` on create, with no other error code hint | Likely a moderation rejection: prompts describing real/identifiable public figures, sexual content, or graphic violence are commonly rejected before or during generation | Rewrite the prompt: use a generic character description instead of naming a real person, tone down graphic detail, then call `generate` again — this is a **new** request with a new prompt, not a resubmission of the failed one, so it's safe to retry immediately |
| Generated speech sounds rushed, garbled, or cut off | Too many words for the clip's tier — see "Dialogue budget — two tiers" | Extend `--duration` (within 4–30s) or trim the lines; never compress the delivery |
| A cut lands up to a second off its timestamp | Expected: the verified runs placed cuts within about ±1s of the written stamps | Give each shot 2s or more of slack around a line; if a cut must be frame-exact, generate the shots as separate jobs |
| Character's appearance drifts between two clips of the "same" script | Each `generate` call is stateless — no persistent character memory | Reuse the exact same character block word for word and keep the `CONSISTENCY` line in every prompt for that script |
| Exit `4`, timed out waiting for completion | Job is still running upstream, not failed | Do **not** re-run `generate`; run `bash ../ofox-video-core/references/ofox-video.sh poll JOB_ID` using the job id printed before the timeout |
| Exit `5`, ambiguous network failure on create | No HTTP response received at all — can't tell if a job was created | Do not guess or retry `generate`; tell the user to check `https://app.ofox.ai` for a job that may already be running, per `ofox-video-core`'s no-resubmit rule |

## When NOT to use

- Silent product/brand footage with no characters or dialogue — use
  `seedance-ad-creative` instead.
- The user wants to animate an existing photo of a real person (a specific
  actor/likeness) rather than a described fictional character — Seedance 2.5
  refuses real-person frames; `--real-person true` is untested on 2.5. Say
  so before anything is spent, and confirm the user has rights to the
  likeness before trying.
- Stitching several generated clips into one file — this skill produces
  individual jobs (each of which may hold a few hard-cut shots); joining
  jobs is an external editing step.
- Anime- or manga-style scenes, especially ones needing the same character
  to look identical across multiple shots — use `seedance-anime-drama`
  instead: it starts every shot on a generated image of the character (not
  just repeated text), which Seedance permits for non-photoreal characters.
