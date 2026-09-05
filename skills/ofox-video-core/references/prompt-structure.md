# Prompt structure for Seedance video jobs

## What this file is

The shared prompt-structure reference for every Seedance scenario skill in
this repo — `seedance-short-drama`, `seedance-anime-drama`,
`seedance-ad-creative`, `seedance-product-video`, and any scenario skill added
later. A scenario skill loads this file **before it writes a prompt**, then
applies its own scenario-specific template on top. `ofox-video-core/SKILL.md`
links here and does not restate the content; scenario skills should do the
same.

It lives here for the same reason `approval-gate.md` does: every scenario
skill depends on `ofox-video-core`, so this is the one place a shared file is
guaranteed to be installed next to them. Nothing in it changes what
`ofox-video.sh` does — it is about the text that goes into `--prompt`.

This file starts where
[`creative-brief.md`](./creative-brief.md) stops. That one is the shared rule
for what to ask the user before a prompt exists; this one is how to build the
prompt once the answers are in.

**Where the evidence comes from.** Every rule and vocabulary entry below is
tagged with case numbers like `(cases 1, 7, 34)`. They refer to the Seedance
2.5 prompt gallery: 63 prompts, 24 first-party from ByteDance (official docs,
the Seed blog, Volcano Engine examples) and 39 from the community, collected
in the `awesome-seedance-2.5` repository and numbered 1–63 there. Case 28 is
the vendor's own worked example. Chinese-language prompts are quoted here in
translation — the wording is ours, the structure is theirs.

**Two kinds of evidence, tagged differently.** A case number is gallery
practice: a prompt somebody kept, on a platform and with parameters usually
unrecorded. A **job id** like `50f623b2-c54a-4d9d-9646-31dd06e2a926` is an
Ofox run made from this repo, where the parameters, the bill and the delivered
frames were all read directly. Job ids are the stronger evidence and the
narrower — usually one or two runs — so a section carrying them says how many.
When the two disagree, the job ids win for behaviour on this API and the cases
still win for what a good prompt looks like.

**Frequency is not effect.** The gallery records prompts and their finished
videos. It has no ratings, no A/B comparisons and, for most community entries,
no generation parameters and no input assets. "Present in 32 of 63 prompts"
means the pattern is common among prompts good enough to be collected; it does
not prove the pattern caused the result. Where a statement is inferred rather
than observed, it says so.

**Two shapes, both collected.** Official prompts are short (median 158
characters, range 22–1299) and lean on reference assets; community prompts are
long (median 1300, up to 12790) and lean on text. Pick by what the user has:
assets → short prompt with asset roles (see "Reference assets as visual
anchors"); text only → long prompt with a header manifest (see "Prompt
skeleton: header manifest, timeline, closing block").

## The vendor's own formula (ByteDance first-party)

This section is ByteDance's own prompting guidance, as reproduced in the
gallery's methodology record. It is the one first-party source in this file;
everything from "Prompt skeleton: header manifest, timeline, closing block"
onward is community practice.

### The formula

```
Subject + action or event + scene and environment (optional) + visual style (optional) + camera movement or cuts (optional) + sound (optional)
```

### The five slots

| Slot | Required | What goes in it (vendor wording, translated) |
|---|---|---|
| Subject + action or event | **yes** | Who or what is doing what — the foundation of the clip. Summarise the main process; give concrete detail only for key actions; do not describe the same action twice. |
| Scene and environment | no | Place, time, weather, spatial relationships, background state. |
| Visual style | no | Light, colour, materials, image texture, overall mood. |
| Camera movement or cuts | no | Shot size, camera position, camera movement, focus subject, and how shots connect. |
| Sound | no | Dialogue, voice timbre, ambient sound, sound effects, music. |

Only the first slot is mandatory. "Camera movement or cuts" is the vendor's
name for what "Transitions" and "Camera language" expand.

### The four-sentence template

```
<Subject> in <scene and environment> <main action or event>.
The picture presents <visual style>.
The camera uses <shot size, camera position, camera movement or cuts>.
Sound includes <dialogue, ambient sound, sound effects or music>.
```

One slot per sentence. Official cases 28, 58 and 59 are essentially this
template expanded.

### The three rules

| # | Rule (translated) | What it means when writing |
|---|---|---|
| 1 | Follow the base formula: organise the prompt in the order subject + action/event + scene + visual style + camera + sound; omit what you don't need. | **The order is the rule.** Subject and action come first, sound last. An unused slot is left out, not padded. |
| 2 | Make each asset's job explicit: refer to assets as `@image1`, `@video1`, `@audio1`, and say what each one supplies (appearance, motion, voice timbre …) and what is *not* to be taken from it. | An asset is not "attached and done" — the prompt states its role and its boundary. "Reference assets as visual anchors" has the sentence patterns (cases 1, 34, 40, 43). |
| 3 | Mark sound with dedicated brackets: music in `()`, sound effects in `<>`, dialogue in `{}`, on-screen captions in fullwidth lenticular brackets (U+3010/U+3011). For non-Chinese dialogue, name the language before the line. | **Almost nobody follows the bracket part** — see below. The language-tag part *is* followed (cases 1, 33, 57). |

### The parameter note

> Generation parameters do not need to be written into the prompt; adjustable
> parameters are set on the generation page or via the API.

In practice 30+ of the 63 prompts open with a format line anyway ("16:9, 30
seconds, 4K" — cases 4, 5, 8, 9, 18, 25, 41, 44, 57 among others), and four
official ones do too (cases 1, 43, 57, 59). Both shapes are in the gallery. On
the Ofox API the real duration, resolution and aspect ratio come from the
flags, so a format line in the prompt is redundant at best and contradictory
at worst — if you write one, make it match the flags.

### How the bracket rule fares in the gallery

Counted across all 63 prompts: `{}` around dialogue — 0. `()` around music —
0 (the one `()` in case 18 is a stage direction). `<>` — only case 43, and
there for asset tags (`<video1>`, `<2pic>`), not sound effects. Lenticular
brackets — used as **section headings** (cases 1, 44) and as an **asset
name** (case 54), never for captions.

The dominant dialogue form is **speaker + quoted line**: `Dialogue (Grandma):
"…"` (case 1), `Man: "…"` (case 5), `She says, "…"` (case 24), `Dialogue:
"…"` (case 22), `VOICEOVER (CHASE): "…"` (case 36). Use one of those;
"Dialogue and sound" has the details.

### The vendor's worked example (case 28), slot by slot

Official text-to-video, 8 seconds implied by its timestamps. Translated:

```
Realistic nature-documentary style, cinematic true-to-life light, a warm afternoon; on a forest grass slope, a round panda cub rolls down the slope.

The panda's black-and-white fur is fluffy and realistic, its body small and chubby, its movements clumsy and adorable. The setting is a green forest slope: grass, moss, clover, soil, small stones, dry twigs and a few small yellow flowers on the ground; tall trunks and woodland in the blurred background. Camera: low-angle medium-long shot, slight handheld feel, essentially fixed, the panda kept in frame throughout.

0s-3s: The cub lies on the green slope, body round; it starts to roll slowly sideways down the slope, clumsy, grass blades pressed gently flat by its body. A light breeze; sunlight through the trees from the upper left, dappled light.
3s-8s: The panda rolls to the lower right of the frame; the motion stops and it goes from lying on its side to lying on its belly. Its round face turns toward the camera, front paws on the grass; it settles in the foreground grass, lifts its head slightly and lowers it again, with a soft whimper.

Low camera position, slight handheld feel, drifting gently with the panda toward the lower right. Natural depth of field: foreground grass slightly soft, panda sharp, background woodland softly blurred. Natural ambient sound — wind, the soft muffled thump of the roll; overall warm, real, natural.
```

| Paragraph | Slots it fills |
|---|---|
| 1 | Visual style + scene + **subject and action**, in one summary sentence |
| 2 | Subject detail, environment detail, camera (low angle, medium-long, handheld, fixed, subject never leaves frame) |
| 3 | **Timestamped beats** (`0s-3s:` / `3s-8s:`) expanding the action |
| 4 | Camera supplement + focus (foreground soft / subject sharp / background soft) + sound |

The formula does not say "summary → timestamped beats → camera and sound
wrap-up", but the vendor's own example is exactly that sandwich. "Prompt
skeleton: header manifest, timeline, closing block" generalises it.

## Prompt skeleton: header manifest, timeline, closing block

Long prompts in the gallery — community ones especially, but also official
cases 1 and 44 — converge on one shape:

```
HEADER MANIFEST   global facts, declared once
TIMELINE          the action, in order, usually timestamped
CLOSING BLOCK     camera/texture supplements, audio, consistency locks, negative list
```

### Header manifest — the order

Observed across cases 1, 3, 8, 10, 14, 25, 34, 36, 44 and 60. Each uses a
different labelling style; the order is what they share:

1. **Format / duration** — one line, if written at all (see "The parameter
   note").
2. **Style** — the visual anchor: medium, era, film or lens texture, palette
   (cases 1, 5, 8, 14, 22).
3. **Characters, one block per character** — appearance once, then a short
   tag used everywhere else (cases 1, 7, 8, 10, 14, 18).
4. **Scene** — place, time, light direction, weather, foreground elements
   (cases 1, 3, 7, 10).
5. **Timeline** — see "Segmenting the timeline".
6. **Camera / texture supplement** — anything not already said per beat
   (cases 8, 14, 28).
7. **Audio** — see "Dialogue and sound".
8. **Consistency locks and negative list** — see "Consistency locks and the
   negative list".

Case 28 is the minimal version of this order; case 8 (12790 characters) is
the maximal one.

### Header manifest — five labelling styles

Pick one and keep it. No gallery prompt mixes styles.

| Style | Example (translated where needed) | Cases |
|---|---|---|
| Bracketed section headings | `[SUBJECT SETUP]` `[OVERALL STYLE]` `[STRICTLY EXCLUDE]` `[SHOT LIST] (9 shots, about 30s)` | 1; 44 (`[CONTINUITY]` `[ABILITY RULES]` `[PHYSICAL CONTACT LOCK — HIGHEST PRIORITY]`) |
| Uppercase labels | `OVERALL STYLE:` `UNIFIED COLOR PALETTE:` `MAIN CHARACTER:` `HER OBJECTIVE:` `CAMERA AND PACING:` `SOUND DESIGN:` `CONTINUITY RESTRICTIONS:` | 8; 34 (`IDENTITY:` `GEAR:` `PHYSICS:` `AUDIO:` `STYLE:`); 25 (`FORMAT:` `AUDIO` `VISUAL REALISM` `STRICTLY AVOID:`); 36 (`**CAMERA:**` `**LOOK:**` `**STYLE:**`) |
| Key–value lines | `Style: … Character: … Subject: … Setting: … Camera: … Lighting: … Color palette: … Audio: …` | 14; 60 (`Subject:` `Scene:` `Shooting strategy:` `Background music spec:`) |
| Square-bracket sections | `[Project type]` `[Global setup]` `[Character: cute anime girl]` `[Scene description]` `[Audio]` `[Visual style]` | 10 |
| Markdown headings | `## 1. Shot core` `## 2. Character and setting` `## 3. 15-second continuous performance script` `## 4. Cinematography execution notes` `## 5. Continuity and prohibitions` | 3 |

### Style anchor — the texture layer

The style slot is most often filled with a **capture-medium anchor** rather
than adjectives: 8 of the 11 short-drama and talking-head prompts, and 4 of
the 8 animation-adjacent prompts, name a film stock, an era, an analogue
defect or a consumer camera. That vocabulary travels across scenarios, so it
sits here; scenario-specific style words (which animation school, which ad
tone) belong in the scenario skill.

| Anchor | Wording seen (translated where needed) | Cases |
|---|---|---|
| Film stock / format | `colour 35mm cinema film texture, fine real film grain` · `IMAX large format` · `35mm TV film texture` · `visible film grain, slight exposure fluctuation` · `restrained film grain, gentle halation, lifted shadows` | 1, 5, 6, 7 |
| Era | `1990s multi-camera sitcom` · `inspired by grand 1970s/80s space films, practical effects` · `1969 American TV cartoons` · `the slight imperfections characteristic of 1990s animation` | 5, 22, 11, 61 |
| Analogue defects | `soft VHS grain` · `subtle VHS-era imperfections, analogue noise, light flicker` · `faded 35mm colors, soft lens bloom, subtle gate weave` | 18, 61, 11 |
| Consumer capture | `real phone / mirrorless capture texture, slight sensor noise` · `Old iPhone everyday-video aesthetic, heavy noise/compression` · `autofocus hunting, exposure shifts, compression artifacts` | 20, 40, 25 |
| Palette | `white balance 4000K, teal-and-amber grade, 35mm` · a `UNIFIED COLOR PALETTE:` block per location · a `Color palette:` line | 57, 8, 14 |

Placement is a sandwich as well: the first sentence names the medium (8 of 8
animation-adjacent prompts), a mid-prompt block deepens it, and the closing
block restates it as a quality line (cases 9, 18, 61, 29).

### Short prompts (10 seconds or less)

Skip the manifest. Use the vendor's formula order directly — subject and
action, scene, style, camera, sound — in two to four sentences (cases 42, 45,
50, and the first paragraph of 28). No gallery prompt of 10s or less carries a
header manifest.

### Skeleton to copy

```
<FORMAT LINE, optional — must match the flags>
<STYLE: medium / era / texture anchor, palette>
<CHARACTER A tag>: <appearance once — age range, build, hair, clothing item by item with colours, one signature accessory>. Referred to below as "<tag>".
<CHARACTER B tag>: …
<SCENE: place, time, light direction and colour temperature, foreground elements, weather>

<0–Ns>  <shot size + camera position>, <camera movement>. <tag> <one action, 1–3 visible signals>. [<Speaker>: "<line>" — <delivery note>.] <sound for this beat>
<TRANSITION — one of the nine kinds, named on purpose; an unnamed boundary renders as a hard cut — see "Transitions">
<N–Ms>  …
<M–Ts>  … <ending state — see "Endings">

<CAMERA / TEXTURE SUPPLEMENT: lens, depth of field, what stays in focus>
<AUDIO: ambience list; recorded sfx tied to actions; dialogue language; or "no music", "no dialogue" — a generated music cue risks output moderation on copyright, see "Asking for music can fail output moderation on copyright">
<CONSISTENCY LOCK — see "Consistency locks and the negative list">
<NEGATIVE LIST — see "Consistency locks and the negative list">
```

Paragraph order from cases 1, 8, 28; per-beat field order from cases 1, 7, 22
(see "Segmenting the timeline").

## Segmenting the timeline

### When to segment

Over all 63 prompts, 35 (56%) use some explicit segmentation — timestamps or
numbered shots — and 32 (51%) use absolute timestamps. The split by clip
length is the useful number (lengths include ones stated inside the prompt
where the gallery's parameter field was blank):

| Clip length | Timestamped | Any explicit segmentation | Plain prose |
|---|---|---|---|
| 10s or less | 3 of 6 | 3 of 6 | 3 (cases 42, 45, 50) |
| 11–15s | 3 of 8 | 5 of 8 | 3 (cases 12, 35, 49) |
| 16–30s | **25 of 32 (78%)** | 25 of 32 | 7 (cases 9, 27, 41, 55, 46, 58, 59) |
| Edit / extend jobs | 0 | 0 | all (cases 48, 51, 52, 53 — one or two sentences each) |

Short clips are mostly one shot with beats in prose; anything from 16s up is
overwhelmingly timestamped. Short-drama is the only category at 100%
timestamped (cases 1–8).

### Timestamp formats seen

All of these are in the gallery; none is "the" format. Pick one and use it
for the whole prompt.

| Format | Example | Cases |
|---|---|---|
| `N-Ns:` / `N–Ns:` | `0–4s:` · `Shot 1 (0-3s):` · `0-3s (first-frame reference <2pic>)` · `0-2s \| … [Cut]` | 40, 1, 43, 56, 34 |
| `Ns-Ns:` | `0s-3s:` | 28 (vendor example) |
| `N-N seconds:` | `0-5 seconds:` · `[0-10 seconds]:` | 2, 4, 39, 47, 13 |
| `m:ss–m:ss` | `0:00–0:05` · `[0:00–0:04]` · `Shot 1 [0:00–0:03] —` · `Shot 1 (0:00-0:05)` · `Scene 1 (0:00 - 0:01):` | 5, 18, 57, 60, 63, 22, 33 |
| `mm:ss–mm:ss` | `00:00–00:05 —` · `[00:00–00:05 — VORTEX REDIRECT + HYDRAULIC BURST]` | 30, 32, 44 |
| `N–N seconds — Title` | `0–4 seconds — Iconic opening pose` · `0-5 SECONDS: TAKEOFF FROM ICELAND'S BLACK-SAND BEACH` · `0–8 seconds:` | 15, 8, 6 |
| Sentence form | `0 to 3 seconds.` · `From 0 to 4 seconds,` | 7, 26 |
| `NN–NNs — TITLE` | `00–05s — ARRIVAL` | 25 |
| Decimal seconds | `### 0.0–0.8 s \| door opens, character revealed` · `SHOT 1 — 0.0–2.0` | 3, 11 |
| Numbered + time | `1. 0–2 seconds: fixed camera.` | 31 (15 shots) |
| Numbered + relative length, no timeline | `1. *(~3s, dorm, propped camera, dim early light)*` · `Shot 1: … hold still for about 1 second` · `roughly two seconds per outfit` | 36, 29, 41 |
| Bracketed label + time | `[Opening, 0–6 seconds]` `[Fun moment, 6–15 seconds]` | 10 |

### Segment length

Measured on the 32 timestamped prompts against their stated durations:

| Segment length | Driven by | Cases |
|---|---|---|
| **3–5s (the default)** | one moment per segment; a storyboard grid; keyframes | 1, 43, 7, 18, 56, 26, 15, 39, 40 |
| 2–3s | dialogue beats, music beats, fight choreography (`Cuts every 2-3s, no shot over 3s, one camera movement per shot`) | 31, 34, 11, 57, 20 |
| 5s, evenly split | dialogue paragraphs, emotional stages | 22, 25, 44, 4, 5, 30 |
| 7–10s | one continuous shot with an orbit or push; emotional immersion | 2, 6, 10, 13 |
| Sub-second to 2s, decimal notation | performance micro-beats inside one held shot (3: eight beats in 15s); per-shot fight choreography (11) | 3, 11 |

Segment counts follow: a 30s clip runs 6–9 segments at the default, 13–15
when beat-driven, 3–4 when continuous.

### Shot density, measured per case

`Segment length` gives the ranges; these are the individual counts they were
read off, which is what a draft can be compared against. Counted from the
numbered shots, timestamp spans or `CUT` markers in the prompt text, against
the duration the gallery records.

| Case | Category | Length | Cuts | Per shot | Form |
|---|---|---|---|---|---|
| 11 | anime-drama | 24s | 10 | 2.4s | `SHOT 1 — 0.0–2.0` … `SHOT 10 — 21.5–24.0` |
| 34 | shorts-reels | 30s | 13 | ~2.3s | `[Cut]` between bare `0-2s` spans |
| 1 | short-drama | 30s | 9 | 3.3s | nine numbered shots, official, against a storyboard-grid reference image |
| 18 | product-video | 30s | 8 | 3.75s | `[0:00–0:04]` … `[0:25–0:30]` |
| 14 | ad-creative | not stated | 9 | — | prose beats separated by `CUT` |
| 22 | talking-head | 30s | 6 | 5.0s | `SHOT 1`–`SHOT 6`, three fixed fields each |
| 15 | ad-creative | 20s | 5 | 4.0s | `0–4 seconds — Iconic opening pose` … |
| 8 | short-drama | 30s | **0** | 6.0s a phase | one continuous shot; five movement phases across four locations, with an occlusion and a pass-through carrying two of the boundaries |
| 6 | short-drama | 30s | **0** | 7.5s a phase | one take, four phases, three spaces; the camera follows her out of each one |
| 2 | short-drama | 20s | **0** | 6.7s a phase | official one take; the back-flags sweeping past the lens are the transition |
| 3 | short-drama | 15s | **0** | 1.9s a beat | one held frame, eight sub-2s performance beats |

Two readings of the same table. Among the prompts that cut, **the dense end
is 2–3 seconds a shot and the slow end is 5** — nothing collected holds a cut
shot longer than about five seconds. And the one-takes are not the slow
option: they replace cuts with movement phases and in-camera transitions, so
a clip with zero cuts still changes what it is looking at every six to eight
seconds. **A timeline of 5-second shots with a static camera in each is the
one shape the gallery does not contain** — it is reachable by filling a
scenario template's defaults without choosing a register, and it renders
correctly, which is what makes it easy to ship by accident (measured: this
repo's first real short-drama job, `38ca8311-5b2d-47d5-a45d-e8ebea0e6312`,
2026-09-03, 20s at 480p, four static shots, cuts landing where they were
written, discarded for being plain).

**The one-take has the same failure mode, and it is easier to walk into.**
Job `16023efe-48d6-45fe-8fd8-f5c6fbfe6519` (2026-09-04, 20s at 720p, one
continuous shot, an attached first frame, zero detected cuts) executed
exactly as written and was rejected as too static: its only camera movement
was a single very slow push, and the actors held one standing position
throughout. Read against cases 2, 6 and 8 in the table above — all one-takes,
all accepted — the difference is that **their cameras cross space** (a stage,
three club rooms, four locations) rather than closing distance in place. A
slow push is a beat inside a one-take, not the movement plan for one. Choose
the one-take when the beat has somewhere to go.

Set against this, the Ofox-measured envelope for cuts inside one job reaches
**10 shots in 30 seconds**, and separately **up to 6 hard cuts** among a
job's boundaries, at 480p and 720p, with or without an attached first frame
("Several shots in one job" has the six jobs and which of them reached which
maximum). Past that — more shots, more hard cuts, 1080p, the
`volcengine` upstream — is gallery practice, so a first attempt is an
experiment and should be priced as one.

### Two things a timestamp can mean

The same `0-4s:` notation carries two different meanings in the gallery, and
the prompt has to say which:

| Meaning | How the prompt signals it | Cases |
|---|---|---|
| **Cut boundary** — a new shot starts here | numbered shots, `Cut to`, `Hard cut`, a shot-size change at every stamp | 1, 7, 34, 57, 22 |
| **Performance beat inside one shot** — same shot, next action | the prompt also declares `one continuous shot`, `fixed camera`, `no cuts`, `do not cut to shot/reverse-shot` | 3, 20, 28, 2 |

If you mean beats, declare "one continuous shot" in the first sentence (cases
2, 3, 6, 8 all do). Without that, a timestamped list reads as a cut list.

### Field order inside a segment

Stable across the multi-shot prompts: **time → shot size / camera position →
action → dialogue → sound**.

```
Shot 3 (6-10s): Facial close-up, the grandmother's eyes full of reluctance. Dialogue (Grandma): "Fly safe, my child…"          (case 1)
3 to 6 seconds. Interior macro shot through a round washer door. … Cut to Mara opening a dryer. … The score briefly drops out.  (case 7)
SHOT 3 - 0:10-0:15 / Visual: … / Camera: Medium-wide, slow push in … / Dialogue: "…"                                            (case 22 — three fixed fields per shot)
```

### Segment skeleton to copy

```
<0–4s>   <Wide / medium / close-up>, <low / eye-level / high>, <static / handheld / push / orbit>. <Tag> <one action>. [<Speaker>: "<line>."] <ambience / sfx>
<4–8s>   [Cut to | Without cutting,] <shot> …
<8–12s>  … <ending state>
```

Adapted from cases 1, 7, 22.

Two slots here are traps, both measured, and both are about the *form* of the
text rather than its content — see "A camera move needs its waypoint frames,
not just a verb":

- the fourth slot's `orbit` (and any other move with a destination) is a
  summary the model may drop silently when it is the only thing written; add
  waypoint frames at their own stamps beside it, and expect their interior
  stamps to be approximate;
- **the shot-size slot is not optional on any segment.** Leave it out and the
  segment inherits the previous one's framing, which is how a move written
  correctly still came back at the wrong closeness for its whole duration —
  and took one of its waypoints' content with it, since the feature that
  waypoint described was outside the inherited frame.

## Several shots in one job

The gallery holds many prompts that ask for **several hard cuts inside a
single generation** and were collected with a finished video attached:

- Official: case 1 (9 numbered shots in about 30s, with a storyboard-grid
  reference image); case 29 (4 numbered shots joined by in-frame element
  moves, declared as one continuous take); case 43 (9 keyframe-bound spans).
- Community: cases 4 (`Cut to a close-up of her terrified face`), 5 (`1990s
  multi-camera sitcom`), 7 (`Cut to` / `Cut back inside` / `Use a fast
  sequence of close shots`), 11 (`SHOT 1 — 0.0–2.0` … 10 shots in 24s), 18
  (8 timestamped segments), 22 (`SHOT 1`–`SHOT 6`), 34 (`[Cut]` 13 times in
  30s), 56.

Six of the eleven short-drama and talking-head prompts are written this way;
the other five are one continuous shot.

What the gallery **cannot** show is whether the delivered video honoured every
cut as written. It holds prompt text and a video link, not a shot-by-shot
check, and the platform that generated each community entry is unrecorded.

### Verified on Ofox (2026-09-03)

Two real `bytedance/seedance-2.5` generations through Ofox, both pinned to
`byteplus`, 8 seconds, 480p, 16:9, `--generate-audio false`, each asking for
three shots joined by two hard cuts. Each delivered file was sampled at 2 fps
(16 frames) and read frame by frame for where the cuts fell.

| Job | Prompt shape | What the frames show |
|---|---|---|
| `fe6e7130-3771-40ee-a1ac-05d60340aed1` | three unrelated subjects (a red convertible on a desert highway at noon, a blue teacup indoors, a lighthouse at night); bare timestamps — `0-3s: … Hard cut. 3-6s: … Hard cut. 6-8s: …`; `no dissolves, no camera move carries across a cut` | both cuts happened; no dissolve; no camera move crossed a cut. First cut between 2.5s and 3.0s, as written. Second between 5.0s and 5.5s — **0.5–1s earlier** than the written 6s |
| `13b75096-38e5-41a3-a063-339e5502c951` | one character in one place (a woman in her 30s, short black hair, yellow raincoat, on a wooden pier by a grey lake); a `FORMAT: / STYLE: / CHARACTER:` manifest, then `SHOT 1 (0-3s): … HARD CUT. SHOT 2 (3-6s): … HARD CUT. SHOT 3 (6-8s): …` | both cuts within half a second of the written stamps; wide → facial close-up → low angle on her boots, exactly as written; the same woman, raincoat, pier and overcast light in all three shots |

So on this path timestamps **are executed as cut boundaries**, in both
notations, to about **±1 second**; segments of 2–3 seconds were honoured; and
a character described once in a manifest survived three shots on text alone,
with no image attached.

**Not covered by those two runs**: clips near the 30-second ceiling or with
more than three shots; dialogue running across a cut; any resolution other
than 480p; the `volcengine` upstream. Six later jobs cover most of that list
— read the next subsection before treating any of it as unmeasured. What
neither those two nor the six touch is still an experiment, and should be
priced as one.

### Past that envelope: six jobs, and what the mix does to a boundary

The three-shot/8-second envelope above is deliberately narrow. Six
`bytedance/seedance-2.5` jobs now sit past it, all pinned to `byteplus`, all
scene-detected at threshold 0.3 and then read frame by frame. Together they
widen the measured envelope and settle the *direction* of one rule; they do
not turn either into a threshold.

| Job | Length / res / mode | Boundaries | Written mix | What the frames show |
|---|---|---|---|---|
| `844c9145-9b10-4335-9fdc-ec4937793a2f` | 30s, 480p, t2v | 8 | 3 hard, 5 continuous | all 3 hard cuts within about 1.5s of their stamps; 4 of the 5 continuous boundaries stayed continuous; the fifth (a no-cut pull-back) triggered a detection that may be its own large frame change rather than a cut |
| `4e5c9581-d462-443b-9663-b1aa6d72f527` | 30s, 720p, t2v | 9 | 3 hard, 6 continuous | **zero of the 3 written hard cuts**; the whole 30 seconds read as one continuous flow. At the looser threshold 0.12, 9 changes turned up, none aligned with a written hard-cut stamp |
| `41f87ac7-d7a6-4c8c-8efd-feb7bdc4818d` | 20s, 720p, t2v | 7 | 5 hard, 2 continuous | all 5 hard cuts landed, two of them visible only frame by frame; 8 of 8 shots in the written order; the one written occlusion (2s) rendered as a plain hard cut instead |
| `036ac3a8-6f68-47ad-a553-86a29aa3e5b8` | 20s, 720p, t2v | 6 | 3 hard, 3 continuous | 7 of 7 shots in the written order, carrying five lines of dialogue; the detector reported 2 boundaries, and the 9s hard cut was visible only frame by frame |
| `7ae7d49e-7eb9-4165-9d95-09cd525d53ed` | 15s, 720p, **i2v** | 4 | 4 hard, 0 continuous | all 4 cuts present *and* the attached first frame held across them (see "Reference assets as visual anchors"); the detector reported 2 of the 4 |
| `ac927785-92ef-4e28-97b9-ff8172ec5554` | 20s, 720p, **i2v** | 6 | 6 hard, 0 continuous | all 6 present; 5 detected within about 0.3s of their stamps, the 6th visible only frame by frame |

**What the six add to the envelope.** Measured inside one job now: durations
of 8, 15, 20 and 30 seconds; 3 to 10 shots; up to **6 hard cuts** — the last
two maxima come from different jobs, the 10-shot one having 3 hard cuts and
the 6-hard-cut one 7 shots; 480p and 720p; dialogue spoken in several shots
of one clip (`036ac3a8`, five lines over seven shots); and — on `7ae7d49e`
and `ac927785` — **several cuts in a job that also carries a
`--frame-first-image`**, which no run in this repo had exercised before and
which is the normal shape for `seedance-anime-drama` and both commerce
skills. **Still unmeasured**: more than 10 shots or more than 6 hard cuts in
one job; 1080p; the `volcengine` upstream; and one line of dialogue split
across a cut — the tooling used here cannot hear audio, so word-level
content is unchecked in every run above.

**The mix decides the boundary, and the direction is settled even though the
threshold is not.** Read side by side, the first two jobs contradict each
other on the one claim either alone would support: the same explicit `HARD
CUT` label, same model, same duration, rendered as written in one and as
nothing of the kind in the other. The four later jobs break the tie. Ordered
by hard-cut share of the boundaries:

| Hard-cut share | Job | Hard cuts that rendered as cuts |
|---|---|---|
| 3 of 9 | `4e5c9581` | **0 of 3** |
| 3 of 8 | `844c9145` | 3 of 3 |
| 3 of 6 | `036ac3a8` | 3 of 3 |
| 5 of 7 | `41f87ac7` | 5 of 5 |
| 4 of 4 | `7ae7d49e` | 4 of 4 |
| 6 of 6 | `ac927785` | 6 of 6 |

So **a boundary's rendering is not decided independently of the rest of the
timeline** — five consistent samples against one, which is enough to act on:
a timeline weighted far enough toward continuous transitions can pull an
explicitly labeled hard cut toward continuous along with it, and **weighting
the mix toward hard cuts is what buys a cutting rhythm.** It is not enough
to name the threshold. The gap between 3-of-8 (held all three) and 3-of-9
(lost all three) is a single boundary, and with six samples the real trigger
could still be the boundary count, the resolution, or the particular
transition kinds rather than the ratio itself. Check the cut points on a
480p draft — reading frames, per the next subsection — before paying for a
longer or higher-resolution take.

### Checking the cuts: read frames, never a detector count alone

Scene detection under-reports cuts, and it does so in one predictable way:
**two shots in the same place under the same light have too little pixel
difference to trigger it.** Four of the six runs above hit this at threshold
0.3, and **both clips of a later text-to-video pair hit it at the looser
0.25** — which makes it the normal case for any scene that stays in one
location, not a curiosity of dialogue coverage, and not something a lower
threshold fixes.

| Job | What the detector missed | What the frames show |
|---|---|---|
| `41f87ac7` | the 9.5s hard cut — his close-up to her close-up, the turn the whole scene is built on — and again at 17s | t=9.0s is still him speaking, t=9.5s is already her reaction |
| `036ac3a8` | the 9s hard cut, the mother's close-up to the son's | t=8.5s is the mother, t=9.0s is the son |
| `7ae7d49e` | 2 of its 4 cuts | all four are there; the same product under the same studio light sits on both sides of each |
| `ac927785` | the 10.5s boundary, the entry into the slow-motion shot | the shot size changes visibly across it |
| `1cf5ac46` | the third cut, at **9.750s**, **at threshold 0.25** — while the cuts at 3.12s and 6.00s were found in the same pass. It appears only once the threshold is dropped to **0.05** | one uniform grey studio for the whole clip, so the two shots either side of the missed boundary differ by less than the two shots either side of a boundary it caught |
| `50f623b2` | the third cut, at **10.041667s**, also at threshold 0.25 — and this one needs **0.10** before it registers | the same uniform grey studio; this is `1cf5ac46`'s controlled twin, so the two of them are the same set and the same light with the same boundary missed |

**Those last two rows are the strongest form this finding has taken, because
they are a pair and their misses are at two *different* thresholds.** Same
subject, same set, same light, same seed, one paragraph of prompt apart — and
the boundary that a 0.25 pass could not see needed 0.05 in one clip and 0.10
in the other. **No single lower number would have caught both**, which is
what "not something a lower threshold fixes" means concretely: the threshold
that works is a property of the individual clip, discovered after the fact,
which is not a setting anyone can choose in advance.

So a detector count is where a check starts, never where it ends. Sample the
delivered file (1–2 fps is enough) and read the frames either side of every
written stamp. A missing detection on a shot/reverse-shot pair says nothing
about whether that cut happened — and a detection *reported* inside a written
continuous boundary may be the camera move's own frame change rather than a
cut, which is what `844c9145`'s no-cut pull-back above looks like.

**The converse is worth stating too, because it is easy to bank: a
detector reporting nothing inside a segment you asked to be continuous is
weak evidence that it is.** In `50f623b2` the 0.25 pass reported no boundary
inside the ORBIT segment, which is what `no cut anywhere inside this segment`
asked for — but the same pass also missed the real boundary at the end of
that segment. A pass that demonstrably cannot see one cut in a clip has not
established the absence of another one three seconds earlier. Read the frames
for that claim as well.

### Measuring a camera's travel: only inside one continuous shot

The check above is about *whether* a boundary exists. This one is about a
measurement people reach for immediately afterward — how far the camera moved
— and it has its own precondition, which is the same class of mistake:
trusting a reading whose conditions were never checked.

**A camera's azimuth is only measurable within a continuous shot.** Across a
cut the camera can be anywhere, so how far it travelled cannot be read off
two endpoints that span the cut — the cut itself may have supplied the
difference. And even inside a continuous shot the reading depends on the
subject carrying an **asymmetric feature** to track; a rotationally
symmetric subject removes the orientation cue entirely and there is nothing
to measure against.

Both halves were learned the expensive way, on `50f623b2`'s orbit, which was
measured wrongly twice in opposite directions before it was measured within
its limits:

| Attempt | Endpoints used | Result claimed | Why it was wrong |
|---|---|---|---|
| 1 | the moving segment's own first frame → its last | about 180 degrees, presented as the total, and never back to the front | the segment *starts* at the rear, so its first frame is not the clip's front view. The return is demonstrably there and this reading denied it; the 180 was right about the segment's interior and wrong to call it a total |
| 2 | the clip's opening frame (2.8s, before the cut at 6.291667s) → the segment's last | the full 360 completed and returned to the front | the endpoints are not connected by continuous motion: the hard cut sits between them, and the shot before it is a macro of a knurled ring — rotationally near-symmetric, so it carries no azimuth at all — over-reads the travel |
| 3 | endpoints inside the continuous segment, plus one orientation match against the opening frame | the segment ends on the opening orientation; travel inside it is rear → side → front, about 180 degrees; **total travel unmeasurable** | the two claims the frames support, and the limitation that comes with them |

So the honest form of a rotation finding is often a limitation rather than a
verdict: **the move ends where it was written to end; how far it travelled is
unmeasurable in this clip.** That is a smaller claim than either wrong one,
and it is the one that survives. Write it that way and check the arrival
against a named frame — see "A camera move needs its waypoint frames, not
just a verb".

### Where `chain` fits

`ofox-video.sh chain` carries the last frame of one job into the first frame
of the next. That is **continuity across jobs** — the tool when a sequence
exceeds one job's duration ceiling, or when each shot needs its own approval,
seed or resolution. Timestamped cuts are **structure inside one job**. The
two are not alternatives: a `chain` of three jobs can each carry three
timestamped shots. `chain` adds one constraint of its own — no real person in
the carried frame on `bytedance/seedance-2.5` (`SKILL.md`, `api-params.md`).

## Transitions

Nine kinds appear in the gallery. Every phrase below is quoted or translated
from a prompt; use them as written.

| Kind | Phrases | Cases |
|---|---|---|
| **Hard cut** | `Hard cut. Shot 2 [0:03–0:05] —` · `[Cut] 2-4s \|` · `Hard cut to a gigantic wall of water` · `Cut to Mara opening a dryer` · `Cut to a close-up of her terrified face` · `hard rhythmic cuts` · `cut to a medium seated shot` | 57, 34, 56, 7, 4, 55, 26 |
| **One continuous shot; cuts forbidden** | `one continuous take, smooth camera movement, no editing` · `one continuous shot, no cuts` · `no hard cuts` · `do not cut to shot/reverse-shot` · `no jump cuts, no flicker` · `one continuous generation` | 2, 6, 8, 3, 51, 44, 29, 58 |
| **Occlusion** — something sweeps across the lens; the next view is behind it | `his body and back-flags sweep quickly past the lens, forming a natural occlusion; the camera swings around to the side of …` · `Its steel structure moves across the top of the frame as a brief physical occlusion` · `The roof completely covers the frame, creating the second natural transition` · `her palm very close to the lens, briefly obscuring most of the frame` · `the frame is first largely covered by the male lead's dark, heavily out-of-focus silhouette … revealed from behind the occlusion` | 2, 8, 41, 3 |
| **Pass-through** — the camera goes through a gap, window, gear, curtain | `the camera plunges down through the gears` · `seamlessly passes into a rapidly spinning ornate brass phantom box` · `she enters a natural crevice beneath the ice wall … creating the first natural transition` · `after the window opens, enter the gallery interior of @video2; finally the camera enters the painting in @video3` · `the camera pushes slowly in through a gap in the heavy red curtain` · `flies toward a large open industrial window` | 13, 8, 49, 58, 39 |
| **Morph** — one object becomes another | `the mahjong tiles slowly become skyscrapers` · `at the end of the waves, seamlessly evolves into a glowing giant moon` · `spinning fire becomes fabric, fabric becomes a painted eye, expanding arms become the drummer's arms` | 54, 13, 55 |
| **Flash / light** | `A powerful white flash freezes her pose, followed by a horizontal blue lens flare` · `dozens of camera flashes fire from impossible angles. Each flash captures a different powerful pose` · `bass-impact flashes` | 15, 55 |
| **Match cut / pose-matched cut** | `pose matched cuts timed to the music … Each gesture should begin in one outfit and end in the next so the cut feels practical and intentional, never like body morphing` · `natural jump cut. The same woman, clothing and appearance fully identical. She repeats the action sequence` | 41, 33 |
| **Speed ramp as transition** | `Use an extreme speed ramp as she swings the blade directly past the lens, creating a seamless transition into three rapid flash-frozen editorial poses` · `Return to normal speed as the human staggers backward` | 15, 11 |
| **Narrative ordering words** — prose prompts, implicit transitions | `Opening … then … climax … then quickly back to fast-paced editing. Ending …` · `opens with … Cut to … Transition to a POV shot … Follow with … Close-up of … End with … Finish with` · `Then cut to the voice only … Then cut back to [image1]` · `close-up → medium → tracking shot → low-angle foot shot → corridor wide → close-up` | 12, 27, 21, 9 |

### Transitions the gallery forbids most often

`No fast cutting. No time-lapse. No jump cuts.` (18) · `no dissolves … hard
cuts only` (57) · `do not use shot/reverse-shot, fast push-ins, orbits,
sudden zooms or multi-camera switching` (3) · `scene cuts, time jumps` in a
STRICTLY AVOID list (25) · `Do not use hard cuts, sudden spinning, random
shaking, abrupt zooms` (8). No prompt in the 63 asks for a dissolve; when a
transition is named at all it is a cut or an in-camera move.

### Transition sentences to copy

```
Without cutting, <foreground object> sweeps across the lens; the camera comes out of the occlusion on <next subject / place>.   (occlusion — cases 2, 8)
Hard cut. <Shot size>, <subject> <action>.                                                                                       (hard cut — cases 57, 7)
The camera pushes through <gap / window / curtain> into <next space>.                                                            (pass-through — cases 13, 58)
```

## A camera move needs its waypoint frames, not just a verb

**What is described as a picture gets rendered. What is described only as a
motion does not.** Two Ofox runs on 2026-09-05 turned that from a suspicion
into a controlled result, and it changes how every camera and action line in
this file should be written: a move is specified by the frames it passes
through — each with a timestamp and its own shot size — while a verb like
`orbits`, on its own, is a summary of those frames rather than an instruction
that produces them.

Decomposed into frames, the move happens **and it arrives**: the run below
was asked to end on a named frame and ended on it. How far it travelled to
get there is a separate question, and one this clip cannot answer — see
"What the arrival does and does not establish" below. What survives the
decomposition least well is the *schedule* — see "The timing between
waypoints is approximate".

The failure mode of the undecomposed form is silent. The clip comes back
looking competent, minus the movement that was asked for, which is why it
survives a glance and only shows up when the frames are read.

### The three observations, weakest to strongest

| Job | Shape | What was written | What rendered |
|---|---|---|---|
| `60fbea52-b14b-4796-80bf-03afe0aa4fa0` | 15s, 720p, i2v, accepted | at `10.5-12s`, back at full speed, a drop `lands on the surface of the oil in the bottle, one clean ring spreads out and dies against the glass` — the tail of a five-second climax whose earlier beats described the build-up | the build-up rendered beautifully: a drop swelling at a glass tip, lit through. **The payoff never happened** — at 11.8s the drop still hangs from the pipette, and at 12.25s the clip cuts away |
| `1cf5ac46-058f-4615-a47b-067743f76f8c` | 12s, 720p, **t2v**, seed `642303335`, rejected | `the camera orbits the grinder a full 360 degrees at constant height and constant speed, ending back at the front view. The product does not move and does not rotate; only the camera travels.` | 6.0s to about 9.7s is a near-static front view with a slight push-in, the crank arm pointing right in every frame. **The negative clause held and the positive instruction produced nothing** — the product genuinely never rotated, and the camera genuinely never travelled |
| `50f623b2-c54a-4d9d-9646-31dd06e2a926` | **same seed, same parameters, same prompt except that one paragraph**, accepted | the paragraph rewritten as waypoint pictures, e.g. `at about 8s the camera is directly behind the grinder, the crank arm pointing away from the lens so that only the smooth back of the brushed steel collar and the walnut knob beyond it are visible` | that picture rendered: the arm entirely hidden, only the knob above the collar — its appearance clause, at least; the same waypoint's position label contradicts its own appearance clause, so the run cannot say which half was followed. **The camera moved, and the segment ended on the orientation it was told to end on** — inside the continuous segment (the hard cut at 6.291667s to about 10s) the frames read rear → side → front, roughly 180 degrees, finishing on the opening frame's own orientation. Whether it travelled further than that is **unmeasurable here** |

The third row is the controlled experiment: one variable, one seed held
constant, with the second row as its negative control on the same subject. It
is also still two runs — read it as a direction with one clean test behind it,
not as a measured law.

### What the arrival does and does not establish

The subject is its own protractor, which is the only reason any of this is
readable: the grinder's crank arm rises from the centre of the collar and
bends once at a right angle, so it extends cleanly sideways from the **front
or the rear** (mirrored between the two) and hides behind the collar from
either **side**, leaving only the knob visible above it. The clip's front
view is fixed by the frame at 2.8s, at the end of the shot before the orbit:
knob at the left, arm extending cleanly sideways.

Inside the continuous ORBIT segment — the hard cut at 6.291667s to about 10s
— the frames read:

| Time | What the frame shows | Camera |
|---|---|---|
| 6.40 – 8.40s, six sampled frames | knob at the right, arm sideways | the rear |
| ~8.80 – 9.20s, the crossing | arm hidden, only the knob above the collar — dead centre above it at 9.00, offset right at 8.80 and left at 9.20 | a side — the one axis crossing visible on screen |
| 9.60 – 10.00s | knob back at the left, arm sideways | the front, matching 2.8s |

Two claims and one limitation:

1. **The segment ends on the orientation it was written to end on.** The
   return worked, and it was written as a named frame — `back on the exact
   front view of the opening shot` — rather than as a quantity of rotation.
2. **The observable travel inside the segment is rear → side → front, about
   180 degrees.**
3. **The total travel is not measurable at all.** The written path's other
   half, front to rear, could only have happened across the hard cut at
   6.291667s, and azimuth is unreadable there — the shot before the cut is a
   macro of the knurled ring, rotationally near-symmetric, carrying no
   orientation cue. The segment simply *starts* at the rear; whether the
   camera travelled there or was cut there cannot be told from this clip.

So the finding is "the move arrives", not "the move completes a circuit".
Both of the wrong readings this repo published first, and the precondition
they each skipped, are in "Measuring a camera's travel: only inside one
continuous shot" above — read it before measuring a rotation off any clip.

### The timing between waypoints is approximate

The pictures rendered and the arrival landed; **the spacing between them did
not hold.** Ten frames sampled at 0.4s intervals across 6.4–10.0s of
`50f623b2`, against four written waypoints at 7s, 8s, 9s and the return by
10s — three interior views and the ending frame, evenly spaced on paper:

- **Three interior views were written; two appeared** as distinct pictures
  (the rear, and one side). The third never appeared at all.
- **Six of the ten sampled frames are the same picture.** 6.40, 6.80, 7.20,
  7.60, 8.00 and 8.40 all read crank-right; 8.80 is the transition. So
  roughly 2 seconds near-stationary, and the rest of the move compressed into
  about 1.2 seconds.
- **The arrival was on time**, on the orientation named for it.

Those are counts and durations, deliberately, and not a per-waypoint
schedule: which written waypoint a given rendered frame corresponds to is not
attributable here, because each waypoint carried both a camera-position label
and an appearance description and on one of them the two contradict each
other. "This waypoint was a second late" is a sentence this run cannot
support, and an earlier version of this subsection wrote it anyway — as a
four-row table pairing each written stamp with a verdict. That table is
retracted, not merely reworded.

Two consequences, and they are the practical half of this section:

- **Do not plan a segment in which a specific angle has to land at a specific
  second.** If a beat must be frame-accurate — a cut on it, a line spoken
  over it — give it its own shot or its own job rather than trusting an
  interior waypoint's stamp. This is the same tolerance the cut timestamps
  have, and for the same reason (see "Several shots in one job").
- **Do not write more interior waypoints than the segment can absorb.** Four
  waypoints in four seconds lost one of them. Two or three across a move,
  with the endpoints carrying the ones that matter, is what has been observed
  to survive.

So the boundary is not "long prompts fail", and it is not "orbits fail". A
move written as frames happens and arrives; what stays soft is *when* each
intermediate frame turns up, and how many of them turn up at all.

### What that means for writing

- **State every angle, position or beat you actually need as a still frame
  with a timestamp**: what is in shot, what is hidden, what is foreshortened,
  from where. That is the form the model honours.
- **Give each waypoint its own shot size**, because an unspecified one does
  not merely crop the picture — it can silently delete part of what a
  waypoint asks for. A segment inherits the framing of the one before it
  unless told otherwise: in `50f623b2` the whole move ran at the macro
  closeness of the detail segment preceding it, so the subject's base was out
  of frame for every waypoint. One waypoint then became **physically
  unrenderable** — it asked for a knurled ring seen edge-on, and that ring
  was outside the frame for the entire move, so half of that waypoint's
  content had nowhere to appear. The framing was inherited rather than
  chosen, and it took a waypoint's meaning with it.
- **A small, fast physical event needs to be its own timestamped frame**, not
  the tail of a longer beat. A drop landing, a ring spreading, a latch
  closing: compress the build-up to pay for it, give the result its own stamp,
  and name it as a required visible event (`the drop must be seen to leave the
  tip, land, and ring the surface`) rather than trailing it off the end of a
  shot whose earlier seconds already handed the model something it is good at
  drawing.
- **Two or three waypoints are enough for a move**, one every few seconds, at
  the lengths in "Segmenting the timeline". The point is not to enumerate
  frames; it is that the frames you care about exist in the prompt *as*
  frames. Four in four seconds is past what one measured segment absorbed —
  see "The timing between waypoints is approximate".
- **A total quantity is fine as long as it is not the only thing you wrote.**
  `a full 360 degrees, ending back at the front view` was in the prompt that
  worked, and the frame it named is the frame the move ended on — so the
  quantity is not recorded here as a failing form, and an earlier version of
  this section wrongly said it was. It is not the mechanism either: what made
  the move happen was the waypoint pictures beside it. Nor is there any
  evidence the 360 itself was performed — that is the unmeasurable half above.
  Keep the quantity if it reads well, and put the closing angle in as a
  picture at its own stamp, because the picture is the part that can be
  checked.

### Negative clauses are honoured more reliably than positive ones

In `1cf5ac46` one sentence carried both a prohibition and an instruction, and
only the prohibition survived. Two working rules follow:

- **A prohibition is not evidence that the corresponding action will occur.**
  Do not read `the product does not rotate; only the camera travels` as two
  halves of one working instruction. The second half needs waypoints of its
  own, and the first half holds with or without them.
- It matches what negative wording does elsewhere in this file: under
  "Unwanted text is designed out of the set, not forbidden in the list", a
  negative item held in a set with no lettered surfaces and failed on a street
  full of them. Prohibitions that remove a whole class of thing are the
  reliable end of the range; a positive instruction with nothing but a verb
  behind it is the unreliable one.

### Waypoint block to copy

Replaces a bare `the camera orbits <subject>` in any timeline — keep the
quantity alongside it if you like, but these lines are what makes the move
happen. Slots in `<angle brackets>`; every line is a picture, and each names
its own shot size. Three waypoints, not four: the stamps are approximate and
an interior one can be absorbed.

```
<6–7s>    <shot size>, camera at <position: three-quarter front right, at <subject> height>. <What is visible from there: the <feature> foreshortened toward the lens, <surface> catching the key light>. <sound for this beat>
<7–8.5s>  <shot size>, camera <directly behind / on the far side of> <subject>. <What is hidden from there: the <feature> points away from the lens, so only <what remains> is visible>.
<8.5–10s> <shot size>, camera at <the mirrored position>. <What is visible again, and how it differs from the first waypoint>.
```

Adapted from the three pictures `50f623b2` actually delivered — two interior
views and the arrival — rather than from the four its prompt asked for; field
order is the one in "Field order inside a segment". Nothing here asks for
music — check "Asking for music can fail output moderation on copyright"
before adding an audio line to it.

## Camera language

These are the sub-dimensions of the vendor's "camera movement or cuts" slot:
**shot size, camera position, camera movement, focus subject** (the slot's own
definition) plus **shot linkage** (see "Transitions"). Composition and lens/format
parameters are community additions to the same slot.

**This is a vocabulary, not a specification.** Every phrase below is quoted
from a collected prompt, and the "Camera movement" table in particular is
full of the summary form that the section above — "A camera move needs its
waypoint frames, not just a verb" — measured as unreliable on Ofox when it is
*all* the prompt says. Use these words to name what a move is,
then write the frames it passes through to actually get it. A move that only
has to hold the frame roughly where it is (`locked`, `handheld sway`, a push
inside one beat) is safe as a phrase on its own; one that has to arrive
somewhere specific needs the waypoints too.

### Shot size

| Term | As written (translated where needed) | Cases |
|---|---|---|
| Extreme close-up | `extreme facial close-up, the grandmother's pupils contract` · `Extreme close-up of frightened eyes` · `extreme close-up as a gloved hand lifts the diamond` | 1, 56, 19, 14 |
| Close-up | `close-up` — the most used term, 23 prompts | 1, 4, 6, 9, 12, 13, 14, 15, 16, 18, 19, 22, 27, 29, 31, 34, 36, 39, 45, 56, 57, 61, 63 |
| Macro / insert | `compact macro close-up of the USB drive` · `macro close-up of the antique brass clock face` · `macro insert, fixed camera, the guitarist's fingers moving fast on the strings` · `Tight insert on the teenage attendant` · `Macro on her heel leaving the lip` | 4, 13, 57, 7, 34, 17, 24, 36, 45 |
| Medium close-up / chest-up | `opens on a medium close-up of the Overlord` · `from a close, chest-up framing … a slightly looser medium close-up` · `medium close-up from the chest up` | 2, 3, 20, 1 |
| Medium / two-shot | `frontal medium shot, handheld` · `Low medium two shot` · `three-quarter side medium on one musician` · `medium full shot from mid thigh upward` | 1, 7, 57, 41, 14, 22 |
| Wide / extreme wide / establishing | `extreme wide, low angle looking up` · `low-angle extreme wide establishing` · `opens on a high overhead wide of the concert hall` · `Exterior wide shot through falling rain` · `Extreme wide, geared figure punches the cloud layer` · `wide establishing shot with a slow handheld push` | 1, 57, 59, 7, 34, 26, 8, 43, 58 |
| Over-the-shoulder | `third-person, frontal over-the-shoulder composition` · `Over-the-shoulder from behind the human` · `over-the-shoulder walking shot` · `three-quarter rear tracking` | 3, 11, 27, 8 |

### Camera position / angle

| Term | As written | Cases |
|---|---|---|
| Low angle | `low-angle medium-long shot` · `ultra-low angle, almost vertical, looking up` · `low-angle dolly-in` · `Worm-eye far below, whip tilt up` · `Low canvas-level angle` · `low-angle gangster perspective` | 28, 1, 15, 34, 11, 61, 25, 7 |
| High angle / top-down / drone | `overhead wide slowly pushing toward the girl on the ground` · `High-angle view of the packed arena` · `Top-down on her back, falling with her` · `overhead drone shots` · `A majestic vertical drone shot rises` | 43, 11, 34, 56, 59, 8 |
| Eye level | `camera behind the male lead's shoulder, near the female lead's eye height` · `locked on a tripod at eye level` | 3, 41 |
| Dutch angle | `slightly tilted Dutch angle` | 1 |

### Camera movement

| Term | As written | Cases |
|---|---|---|
| Push-in / dolly-in | `the camera pushes slowly toward the hotel-room door` · `tight, aggressive push, handheld` · `hard push-in on her back` · `slow centered dolly backward` · `The camera rushes toward her with a low-angle dolly-in` | 4, 57, 34, 22, 15, 39, 43, 58 |
| Pull-back | `the camera pulls back slowly from a medium close-up of the warrior to a full stage wide` · `smooth spiral pull-out` · `the camera pulls back slowly, showing how small she is in the vast garden` · `a slow pullback that reveals the bright clinic` | 2, 13, 10, 26, 58 |
| Orbit | `the camera slowly orbits the upper body and transitions to a medium` · `slow prowling orbit` · `The camera performs a tight orbit around her body and rises into a close-up` · `360-degree orbit` | 2, 57, 15, 42, 43, 10, 39 |
| Tracking / follow | `the camera follows the running children throughout` · `close handheld follow shot, staying just behind and slightly beside her` · `Side-profile tracking shot` · `fast lateral dolly sweeps past him` · `Smooth camera tracking following his jump` | 62, 6, 22, 57, 35, 8, 29, 45, 56, 60 |
| Pan / tilt / whip | `extreme wide, tilt up` · `fast handheld tilt up` · `handheld whip in` · `whip-pans around her` · `Lightning-fast whip pan reveals` · `Large-scale tilting motion from bottom to top-left diagonal` | 1, 57, 15, 56, 60, 62, 44 |
| Handheld / breathing | `handheld, breathing sway` · `restrained handheld` · `The camera feels intimate, bumped and instinctive` · `brief handheld movement that feels operated by a human` · `an extremely slight, steady breathing feel` | 1, 4, 6, 7, 3 (and 19 more) |
| Static / locked | `fixed camera, essentially no movement` · `fixed close, shallow depth of field` · `Camera is locked on a tripod at eye level` · `static phone propped on bathroom sink` · `Macro on her heel leaving the lip, static` | 20, 3, 41, 40, 34, 31, 14, 36 |
| FPV / Steadicam / gimbal | `stable FPV movement` · `Steadicam pushes slowly through golden sunset and sea mist` · `one-take handheld gimbal follow` | 8, 57, 58 |
| Phone POV | `POV alternates between CHASE and PARTNER, sometimes propped on gym equipment` · `as if a friend casually left a phone recording on a nearby bench` · `POV shot from inside a shopping cart` | 31, 25, 27, 36 |

### Focus

| Term | As written | Cases |
|---|---|---|
| Shallow depth of field | `shallow depth of field, wide aperture` · `cinematic shallow depth of field` · `shallow depth of field so Captain stays dominant while Mike and Ron remain visible` | 1, 13, 22, 3, 9, 18, 24, 26, 27, 39, 57 |
| Focus locked on a subject | `focus stays locked on the female lead's eyes` · `the male lead's outline stays out of focus` · `the customer is always the focal point` · `subject sharp, motion blur on background only` | 3, 18, 34, 28 |
| Rack focus / focus pull | `Camera racks focus from the meter to white headlights sliding across the glass` · `a brief focus pull from the hands to the client's relieved expression` · `delayed focus pulls` | 7, 26, 36 |
| Autofocus hunting (UGC texture) | `autofocus shifts between the steaming bowl and her face` · `mild autofocus hunting` · `autofocus tug between the shelves and her face` · `focus lag` | 30, 25, 32, 31, 33 |
| Foreground / background softness | `foreground grass slightly soft, panda sharp, background woodland softly blurred` · `bookshelf behind slightly blurred` · `sea surface behind out of focus, glittering` | 28, 20, 57 |

### Composition

| Term | As written | Cases |
|---|---|---|
| Centered / offset | `She remains centered in frame` · `female lead centered, slightly left` · `The subject remains centered with enough space on both sides` · `keeping her slightly right of center` | 6, 3, 41, 8, 22, 26 |
| Symmetry | `Wide symmetrical shot of a long cream-and-chrome spaceship corridor` · `symmetrical medium shot of the four characters framed by spinning washer doors` | 22, 7 |
| Foreground layer | `grass blades, sparks and ash drifting continuously in the foreground` · `ropes in the foreground` · `oversized buttons in the foreground` | 1, 11, 22, 43, 28 |
| Silhouette | `the two embrace tightly, in silhouette` · `the band in silhouette against the dusk sea` · `half in silhouette, ship lights glowing behind him` | 1, 57, 22, 13, 50 |
| Subject never leaves frame / axis | `the panda kept in frame throughout` · `must not circle around to the front or allow her to leave the frame` · `keep the same eye-line axis throughout, do not cross the line` | 28, 8, 3 |
| Occlusion as relationship | `the male lead's blurred outline stays on the right of frame as relational pressure` | 3 |

### Lens, film and capture parameters written into prompts

| Parameter | As written | Cases |
|---|---|---|
| Focal length | `24mm wide-angle lens` · `full-frame-equivalent 70–100mm medium telephoto` · `natural 35 mm equivalent smartphone lens` · `standard 1x lens, no distortion` | 8, 3, 41, 40 |
| Film / white balance | `colour 35mm cinema film texture` · `white balance 4000K, teal-and-amber grade, 35mm` · `35mm TV film texture` · `DV 16mm tape` | 1, 57, 5, 31, 36 |
| Frame rate / resolution | `24fps` · `60fps` · `native 4K, 24fps` · `4K HDR` | 14, 27, 16, 17, 44, 24 |

Whether these parameters change the output is not something the gallery can
show; they are recorded as common practice. Resolution on the Ofox API is set
by `--resolution`, not by the prompt.

### Camera line to copy

```
<Shot size>, <camera position>, <movement>; <lens / format, if any>. Focus on <subject>; <foreground / background softness>. <Subject> stays <centered / slightly left> and never leaves frame.
```

From cases 28, 3, 22. The `<movement>` slot is the one to be careful with:
fill it with a texture the camera keeps for the whole beat (`locked with a
breathing sway`, `restrained handheld`) rather than with a destination. If the
camera has to *get somewhere*, that belongs in waypoint frames — "A camera
move needs its waypoint frames, not just a verb" — and this line carries only
the lens, the focus and the framing rule.

## Pacing

| Device | Phrases (translated where needed) | Cases |
|---|---|---|
| **One thing per segment** | `Show only one salon action at a time. Each action must last long enough to show the process clearly.` · `one camera movement per shot` · `keep only 1–3 visible signals per emotional beat` | 18, 34, 3, 11 |
| **Slow-motion insert** | `instantly drops into slow motion, the fruit filling bursts open` · `slow-motion splash inserts` · `0.4x slow motion` · `Slow-motion for one second before time accelerates again` · `in slow motion, pollen shakes off the bee's fur` | 12, 14, 34, 56, 45, 18, 35 |
| **Speed ramp** | `extreme speed ramp` · `speed ramps` · `Use rapid punch-ins, speed ramps` | 15, 55, 56 |
| **Cut on the beat** | `HARD CUT on the beat` · `the music downbeat hits as we cut in` · `cuts landing on strong beats` · `every movement, punch-in, transition and hard cut must hit the beat` · `punchy percussion hits synced to splash moments` · `about 112 beats per minute … clean beat drops for every outfit change` · `Tempo: BPM 170` | 57, 12, 41, 55, 14, 52, 60 |
| **Pause / silence** | `hold the frame still for about 1 second` · `half beat of silence at 25.5s` · `Silence for half a second except muffled underwater sound` · `lips close softly after the line, a half-second pause` · `Let silence, rain, and machine motors carry the tension` | 29, 34, 56, 3, 7 |
| **Escalation curve** | `Emotional path: tense preparation → hears the familiar greeting → brief wavering → wry smile as cover → resolute declaration → restrained exit` · `Her emotional progression moves from concentration to wonder, then finally to freedom` · `starts with mysterious slow motion … as the rhythm builds, the editing speeds up. Ends on a powerful close-up` · `heat and sweat escalate from start to finish` | 3, 8, 61, 31, 30 |
| **Sound carries the segment change** | `The sound transitions from overwhelming club techno, to muffled bass and corridor ambience, to distant low-frequency vibration outside` · `SOUND DESIGN: Iceland: … London: … Paris: …` | 6, 8 |

⚠️ **The "Cut on the beat" row is evidence, not a phrase bank to copy from.**
Five of its seven phrasings ask the model to generate music, which is exactly
what failed output moderation on copyright in this repo (see "Asking for music
can fail output moderation on copyright" under "Dialogue and sound"). The
gallery cases wrote them; the one Ofox job that did came back refused. If a
cut needs to land on something, land it on a visible action or a recorded
sound effect, and leave the music to an editor afterwards.

Two overall shapes recur. Ads: **hook → showcase → physical-event climax in
slow motion → hero freeze** (cases 12, 14, 15). UGC-style clips: **a flat
action chain with no climax**, ending "naturally, not promotionally" (cases
24, 25, 26). Which shape a scenario uses is the scenario skill's call; the
vocabulary is shared.

### Pacing line to copy

```
Each segment shows one action only. <Climax event> drops into slow motion for one second, then returns to speed. Cuts land on the action's sharpest moments, not on a generated music cue. Hold the final frame for one second.
```

From cases 18, 12, 41, 29.

`<Climax event>` needs one more thing than this line gives it when the event
is small and fast — a landing, a snap, a ring spreading. Measured on job
`60fbea52-b14b-4796-80bf-03afe0aa4fa0`: written as the tail of a five-second
climax, the build-up rendered and the event itself was dropped. Give the
result its own timestamp and its own frame, per "A camera move needs its
waypoint frames, not just a verb".

## Consistency locks and the negative list

Two blocks close most long prompts: a **consistency lock** (25 of 63) and a
**negative list** (30 of 63). Official prompts use both sparingly (case 1 has
a one-line exclusion list; case 57 a four-item one); community prompts use
them heavily (case 25's list has 21 items, case 4's has 22).

### Consistency lock — enumerate the invariants

The strong form names every attribute that must not change, instead of saying
"consistent":

```
Strictly keep her recognisable face, facial proportions, skin tone, body type, hairstyle, hair colour, all visible accessories and the clothing from image1 consistent.          (case 44)
Her identity, hairstyle, earrings, necklace, grey turtleneck knit top, body type and apparent age stay consistent throughout.                                                (case 3)
keeping the same face, proportions, red gloves, and striped shorts                                                                                                          (case 11)
Maintain perfect product consistency, including the frame shape, lenses, hinges, colors, materials, and proportions.                                                        (case 24)
Keep every architectural line perfectly fixed across all cuts                                                                                                                (case 41)
Preserve consistent faces, clothing, props, screen direction, reflections, hand anatomy, and spatial continuity                                                              (case 7)
The dragon's identity, anatomy, scale pattern, horns, wings and proportions must stay completely consistent                                                                 (case 39)
```

The invariant list, from those seven: **face, facial proportions, skin tone,
body type, hairstyle and colour, accessories, clothing item by item, props,
background geometry, screen direction, lighting direction**. Pick the ones
that apply and list them.

Two supporting habits: describe each character **once** in full and then use
one **short tag** everywhere else (`the lilac-haired girl`, `the girl`, `the
customer`, `the stylist` — cases 9, 10, 18); and anchor identity on a
**signature accessory** (flower hairpin and bow, ribbon, round glasses and
nose ring, sunglasses and gold chain, red gloves — cases 9, 10, 18, 61, 11).

### Negative list — the frequent items

| Item | Phrases (translated where needed) | Cases |
|---|---|---|
| Subtitles / on-screen text / logos / watermarks (15+ prompts) | `no subtitles, no text overlays, no dissolves, no duplicated characters, hard cuts only` · `no text, no logos, no watermarks` · `subtitles, captions, logos, readable text` under STRICTLY AVOID · `Do not add captions, logos, watermarks, interface graphics, or generated text` | 57, 4, 25, 41; also 5, 8, 18, 20, 24, 26, 38, 40 |
| Extra limbs / deformation | `extra limbs` · `duplicated limbs, warped hands` · `no facial deformation, no extra limbs` · `warped fingers … duplicated accessories` | 5, 25, 15, 41 |
| CGI / plastic look | `plastic CG, greasy over-exposed CG` · `no CGI feel` · `no skin smoothing, no influencer filter, no plastic skin` · `no CGI feel, no floating objects` | 1, 4, 20, 38 |
| Existing IP, real actors, real landmarks | `no references to any existing film, character, actor`; cases 32 and 33 exclude famous landmarks and real performers | 8, 32, 33 |
| Fast cutting / jump cuts / dissolves | `No fast cutting. No time-lapse. No jump cuts.` · `no dissolves` · `scene cuts, time jumps` | 18, 57, 25 |
| Style drift | `Never make him realistic` · `no face swap, no AI plastic skin, no 3D, no game CG` · `Never change the visual style` · `black-and-white, monochrome, greyscale; hand-drawn, sketch, line art, illustration, comic, animation; storyboard frames; tilt-shift miniature, doll look, plastic CG` | 11, 44, 56, 1 |
| Random character change | `Strictly no random character changes` · `no identity drift, no wardrobe change` | 61, 15 |
| Impossible physics (when realism is the point) | `no super-hero physics, no impossible jumps, no falls, no teleportation, no exploding doors` · `no floating objects, no deformed food, no machinery clipping through itself, no excess steam, no light flicker` | 4, 38 |
| UGC anti-polish | `cinematic color grading, beauty filters, artificial skin smoothing, dramatic slow motion, music, perfect lighting` under STRICTLY AVOID · `No beauty filter, grading, cinematic/CG look, fisheye, vignette, or legible text` | 25, 40 |

A negative list is where you forbid **the style you are not making**: a
live-action prompt excludes animation and sketch (case 1); an animation prompt
excludes photorealism and game CG (cases 11, 44); a UGC prompt excludes
cinematic grading (case 25).

### Unwanted text is designed out of the set, not forbidden in the list

`no subtitles, no on-screen text, no watermarks` is the most-written item in
the gallery's negative lists, and on Ofox it is **only partly obeyed**.
Measured across four jobs, the thing that actually decides whether invented
signage shows up is the set — whether the frame contains a surface that
lettering can grow on — not how strongly the prompt forbids it.

| Job | Set | Negative list | Result |
|---|---|---|---|
| `41f87ac7-d7a6-4c8c-8efd-feb7bdc4818d` | a 1930s neon street at night | the strongest wording available: signs, street signs, posters, characters in **any** language named individually, deep background included, with an instruction to render them as blurred light only | sign-like characters still appeared on the neon street in the closing wide. The two concept images for the same job produced legible signage under the same instruction |
| `036ac3a8-6f68-47ad-a553-86a29aa3e5b8` | a New Year courtyard — door couplets and paper cuts everywhere by definition | ordinary | **worked** — five of the seven shots had couplets in frame and none produced readable text, because every shot handled them by composition instead (below) |
| `7ae7d49e-7eb9-4165-9d95-09cd525d53ed` | near-black studio, no street, no shelf, no wall | ordinary | zero invented text |
| `ac927785-92ef-4e28-97b9-ff8172ec5554` | bright empty studio, plus a product that carries brand marks by convention | ordinary, plus one explicit constraint on the one known blemish | zero invented text; the small coloured patch on the product was never resolved into a wordmark |

Two workable defences, both structural:

- **Remove the surface it would sit on.** A set with nothing for lettering
  to sit on cannot invent lettering (`7ae7d49e`, `ac927785`). That is a
  location decision made while choosing the set, not a line in the prompt.
- **Compose the text out of each shot when the subject requires it.** For
  `036ac3a8`, all seven shots were planned around the couplets, each with its
  own device: pushed to the frame edge and softened by dusk light; the doorway
  framed out entirely; the two core close-ups given backgrounds with **no
  text-bearing surface at all** (a woodpile and lantern light); far edge plus
  shallow depth of field; half occluded by the father's shoulder; outer-edge
  crop washed out by warm flare. Every one held — the delivered close-up's
  background is a blurred wall and one soft red edge with nothing readable in
  it.

So for a text-dense subject, **move the lettered surfaces out of the depth of
field or out of the frame while writing the shots** — the negative list is a
backstop, not the defence. The same asymmetry runs the other way for text you
*want*: lock it in an attached first frame and let the video preserve it
rather than render it from scratch (see "Reference assets as visual
anchors").

### Closing block to copy

```
CONSISTENCY: <tag>'s face, proportions, skin tone, hairstyle and colour, <accessory>, <clothing items> stay identical in every shot. Background geometry and light direction do not change.
AVOID: subtitles, on-screen text, logos, watermarks; extra or warped limbs; <the style you are not making: CGI / plastic skin | photorealism | cinematic grading>; <cuts you forbid: jump cuts | dissolves | fast cutting>; random changes to character or wardrobe.
```

From cases 44, 3, 57, 25, 41.

## Dialogue and sound

### Writing a line

**Speaker + quoted line, in that order.** Seven of the eight short-drama and
talking-head prompts with dialogue use quotation marks; none uses the vendor's
`{}`.

| Shape | Example (translated where needed) | Cases |
|---|---|---|
| Label in parentheses | `Dialogue (Robot): "I'm right here. I won't let go."` | 1 |
| Script form, one line per speaker | `Man: "No. Stop it. What even is this?"` / `Cat: "Book club."`, stage directions between the lines | 5 |
| Narrated | `The male lead says off-screen, casually: "Hey, what's up, baby?"` · `A deep male voice says: "Open the door. We know you're in there."` · `She says: "…"` | 3, 4, 21 |
| Field per shot | `Dialogue: "…"` | 22 |
| Unquoted (rare) | `He says quietly, You said clean the suit.` | 7 |

**Add a delivery note** — volume, tone, accent, what the face does on which
word (6 of the 8 prompts with dialogue):

```
in a very quiet, very clear voice with no anger: "We're done." A short intake of breath before speaking; "We're" still carries residual tenderness, and on "done" the eyes become steadier.   (case 3)
Keep the delivery controlled and intimate, not theatrical.                                                                                                                              (case 7)
confident Australian accent                                                                                                                                                             (case 22)
elegant British accent                                                                                                                                                                  (case 5)
when she says "actually, no", she shakes her head once, lightly                                                                                                                         (case 20)
```

**Name the language when it is not the prompt's language** (vendor rule 3,
and followed): Chinese-body prompts carry English dialogue verbatim in cases 1
and 3; case 33 names Korean; case 57 names eight languages for eight singers.
The line's language decides the voice's language — write the line in the
language you want spoken.

### Density — two tiers, not one

Measured counts against clip duration (English by words, Chinese by
characters, punctuation stripped):

| Tier | Measured | Cases |
|---|---|---|
| **Dialogue drama** | 0.4–1.7 words/s overall; peaks of 3.5–5 words/s in a single 2–4s beat; most seconds have no line | 1 (51 words / 30s), 3 (6 words / 15s), 7 (43 words / 30s), 4 (16 characters / 30s) |
| **Monologue / talking head** | 3.5 words/s English (peak 4.4 in one shot); 5 characters/s Chinese | 22 (103 words / 30s), 20 (50 characters / 10s) |
| Sitcom, between the two | 3.4 characters/s, peak 4.4 | 5 |

So "2–3 words per second" is a **ceiling for drama**, where the gallery's
prompts average far below it and leave most beats wordless — not a target.
For a talking head it is too low; those prompts run at 3.5 words/s and 5
Chinese characters/s. Budget by tier. When a script overruns the budget,
lengthen the clip or cut the script; do not compress the delivery.

### A separate sound block

Six of eleven short-drama and talking-head prompts, and most long ad prompts,
carry sound as its own block, distinct from dialogue:

| Element | Phrases (translated where needed) | Cases |
|---|---|---|
| Ambience list | `Sound design must include rain on glass …` (a closing list) · `distant city ambience, footsteps, breathing, door impacts, lock rattle, the sliding glass door, night wind` · eight named gym sounds, `Natural gym ambience only` | 7, 4, 25 |
| Per-beat sound | `Sound: light door click, fabric friction, quiet outdoor room tone` after each beat | 3 |
| Music in/out points | `Music begins with muted upright bass …` · `The score briefly drops out` · `as the final bass note lands` · `at the end keep only the music and a light breeze` | 7, 10 |
| Sound following the location | one `SOUND DESIGN:` list per location, plus `one warm sustained string note` across all of them · a three-stage sound transition | 8, 6 |
| Explicit silence | `No music` · `no BGM, no subtitles, no narration, no dialogue` · `no narration, no background music`, with the effects itemised | 11, 44, 38 |
| Diegetic detail | `mouth shape strictly matched to the Chinese speech` · `natural audience laughter … a short, cheerful 90s sitcom end-credits cue` · an onomatopoeia allow-list, `THWACK! POW! SMACK! WHAM! CRACK!` | 20, 5, 11 |
| Mix note | `Dialogue must remain clean and naturally mixed above the music` | 7 |

Official cases 1 and 2 carry no sound block at all (case 1 has dialogue lines
only). That is also a valid choice; if you take it, make sure
`--generate-audio` is set the way the user expects.

### Asking for music can fail output moderation on copyright

**Output moderation checks the audio track, not only the picture** — measured
once, 2026-09-04. A `bytedance/seedance-2.5` ad prompt whose `AUDIO` block
asked for "one sustained low cello note" and "a soft bell chime" came back
`failed` with `error.code: output_moderation_failed` and the upstream message
`the output audio may be related to copyright restrictions` (job
`1ff72400-0f30-4be1-a417-f52d43955d09`). **Nothing was billed** — the
response carried no `usage` field, exactly as `api-params.md` records for
that code. Removing the music and keeping only recorded sound effects passed
on the next run, same model, same shots, same first frame (job
`7ae7d49e-7eb9-4165-9d95-09cd525d53ed`, 3.60 dollars).

One sample, so the trigger is not pinned down: whether it was the named
instrument, the word for a musical phrase, or the generated audio itself
being matched against something is unknown. What is known is the shape of a
prompt that passed and one that did not, and that the failure costs a
round-trip rather than money.

The workable form, used from the start on the next job in the same category
and also clean (`ac927785-92ef-4e28-97b9-ff8172ec5554`):

```
AUDIO: <room tone>, <two or three recorded sounds tied to visible actions: the cap breaking its seal, fabric, a footfall in dust>. No music.
AVOID: … score, soundtrack, instrumental, melody, rhythm track, percussion, <named instruments: cello, strings, piano, bell, chime>, humming, singing.
```

Naming the instruments and the words for a music bed in **both** blocks is
what those two runs did; a single `no music` line has not been tested on its
own. This is also closer to how the work is really done — an ad's music is
laid in afterwards — so the gallery's `Music in/out points` row above is a
pattern to borrow from platforms other than this one, not a safe default
here.

### Dialogue and sound block to copy

```
<Speaker> (<accent / tone>): "<line, in the language to be spoken>" — <delivery: quiet / no anger / breathless>; on "<word>" <the face or a hand does one thing>.
SOUND: <ambience 1>, <ambience 2>, <sfx tied to an action>. Music <none — recommended, see "Asking for music can fail output moderation on copyright" above | enters at … / drops out at …, only if the user accepts that same risk>. [No narration. No subtitles.]
```

From cases 3, 7, 20, 38.

## Reference assets as visual anchors

### Two semantics, two API fields

An attached image means one of two different things, and the Ofox API has a
separate field for each. They **cannot be combined in one job**
(`references_conflict`, rejected client-side — `api-params.md`).

| | First / last frame | Identity / appearance reference |
|---|---|---|
| What it does | The video **starts on (or ends on) this exact image**. | The model **borrows appearance, style or motion** from it; no frame is locked. |
| API field | `frame_images` | `input_references` |
| `ofox-video.sh` | `--frame-first-image PATH-or-URL`, `--frame-last-image PATH-or-URL` — local files preferred, auto base64 | no dedicated flag — pass `{"input_references":[…]}` through `--extra-json` |
| Limits | one first, one last | ≤9 images, ≤3 audio clips (each ≤15s), ≤1 video; a video must be a URL |
| Aspect ratio on `bytedance/seedance-2.5` | forced to `adaptive`; output ratio follows the image, so **crop the image to the target ratio before generating** — cropping only, never padding, per the measured runs below. When `ofox-image-core` generated the frame, `--target-aspect W:H` does this for you | not tested here; if the API rejects a fixed ratio, `--aspect-ratio adaptive` is the thing to try |
| Gallery prompts using this meaning | 42 (first + last frame, 5s, `360-degree orbit`); the `0-3s (first-frame reference <2pic>)` span of 43 | 1, 2, 11, 12, 13, 23, 29, 34, 37, 40, 43, 44, 57, 59 |
| Real-person content | refused at submission on `bytedance/seedance-2.5` (`input_moderation_failed`, verified, nothing billed) | not tested in this repo either way; do not assume it passes |

**Nearly every gallery prompt with an image uses the second meaning** — the
image supplies who the character is or what the product looks like, and the
prompt says which attributes to take. That is a different job from "animate
this picture", and the sentence patterns below are for it.

One open point: whether the vendor's `@image1` token is resolved to the
right attachment on the Ofox `input_references` path has **not been verified
in this repo**. The reference is attached either way; the untested part is
whether the model maps the token to the attachment by position. Write the
role sentence so it still reads correctly as plain text ("image 1 provides
…").

### What a frame lock actually holds, measured

Three `bytedance/seedance-2.5` runs on `byteplus`, all 720p, all with a
generated image passed as `--frame-first-image`. What they show is that the
lock is not just an opening instant — it holds the attached appearance for
the whole clip, and it survives both cuts and a person walking into frame.

| Job | Shape | What the frames show |
|---|---|---|
| `16023efe-48d6-45fe-8fd8-f5c6fbfe6519` | 20s, one continuous shot, anime | the delivered first frame matches the fed image on composition, both characters, wardrobe, the wire fence, the sunset, the distant town and the falling petals; no identity drift for the full 20s |
| `7ae7d49e-7eb9-4165-9d95-09cd525d53ed` | 15s, 5 shots, 4 hard cuts, a product | the first frame held **and** all four cuts happened — the two do not trade off. The wordmark on the product's label stayed legible and in the frame's own typeface, across every shot |
| `ac927785-92ef-4e28-97b9-ff8172ec5554` | 20s, 7 shots, 6 hard cuts, a product, with a person entering at 4s and in frame for seven or eight seconds | a three-way comparison of the input image, the delivered first frame and t=19.6s has the product's colour blocking identical in all three. **The lock did not decay over 20 seconds, and the seven or eight seconds with a person in frame did not pull it off.** |

Two consequences worth naming:

- **It is the reliable way to get specific lettering into a clip.** Text
  rendered from a description is the classic failure; text approved on a
  still and then *preserved* is a different task, and `7ae7d49e` did it.
  Read the wordmark on the image at full size before spending on the video.
- **Measure the image file; don't trust the numbers around it.** The output
  ratio follows the attached image (`adaptive`, forced — see "API
  constraints that decide the route"), and on all three of the image runs
  behind the table the requested size, the size the image API reported and
  the file's real dimensions were three different numbers (requested
  1792x1024, reported 1354x774, file 1344x768). Cropping that file to
  1344x756 — cropping only, never padding — is what produced an exact
  1280x720 clip; feeding it uncropped delivers 1.75:1 instead. Read the real
  pixels (`sips -g pixelWidth -g pixelHeight <file>`, `identify <file>`) and
  crop before generating.

Attaching a frame does **not** move the job to the dearer video-to-video
tier: `16023efe` and `ac927785` each billed 4.80 dollars for 20s at 720p,
which is the t2v rate of 24 cents/s, not v2v's 30 cents/s. Only a *video*
input does that (`pricing.md`).

### Sentence patterns for pointing at an asset

| Pattern | Example (translated where needed) | Cases |
|---|---|---|
| **Role list up front**, one line per asset | `image1: nine-panel storyboard reference, for overall shot structure, shot sizes and camera rhythm. image2: live-action reference, for environment composition and the realistic colour-film texture baseline. image3: appearance reference for Subject 1 (the guardian robot). image4: appearance reference for Subject 2 (the grandmother).` · `Use Image 1 for the large muscular cartoon bulldog boxer, Image 2 for the live-action Caucasian American boxer, and Image 3 for the vintage arena, ring, crowd, and lighting.` · `image1 = PYONA's sole and highest-priority identity and costume reference.` | 1, 11, 44 |
| **Take X, not Y** — vendor rule 2's "and what not to take" | `IDENTITY: @Image1 supplies identity only — face, long black hair, low-brim cap…` · `Face and hairstyle must match Image1 exactly; do not change identity. Ignore its outfit, background, pose, and text.` · `the white-model video is a reference for camera movement and character animation only, not for picture content` · `take camera, framing, shot size and spatial relationships from @whitemodel1; take materials, lighting, colour, reflections and atmosphere from @image1` · `do not alter the original images; keep them highly consistent` | 34, 40, 43, 37, 23 |
| **Inline @ inside the action** | `@image2, the Overlord, opens in medium close-up` · `motion and camera per @video2` · `(running pose per @image5)` · `flat stone ground, @image1` · `this man is @image1, Xin Qiji` · `the logo appears in the last second, per @image1` | 2, 12, 29, 52, 62, 13 |
| **Keyframe bound to a time span** | `0-3s (first-frame reference <2pic>) … 3-5s (reference <3pic>) … 10-19s (reference <6pic>, <7pic>)` · `Shot 1: static display of @image1 … Shot 2: after @image1's text area disappears, @image2's … slides in` | 43, 29 |
| **Start / composition declaration** | `Use [image1] as the start of the video` · `Begin with the exact composition of the reference image` · `the girl in the picture says "cheese" to the camera` · `build the frame from @image1: a band on a golden beach …` | 21, 15, 42, 57 |
| **Edit verbs** — video inputs | `continue @video1 for 5 seconds` · `extend @video1; after the window opens, enter the gallery interior of @video2 …` · `keep @video1's composition, camera, light and performance rhythm; rewrite only the female lead's face and expression` · `delete everyone in @video1 except the lead` · `join [video 1] and [video 2]` · `render the green-screen background of @video1 into scenery, obstacles, costumes and supporting characters` | 45, 49, 51, 48, 54, 47 |
| **Asset + lock in one sentence** | `Use the female figure in the reference image as the only character reference; keep her features, hairstyle, skin tone, clothing and overall bearing highly consistent.` · `Use the uploaded reference image as the exact character reference. Preserve her facial identity, hairstyle, eye color, makeup, skin tone, body proportions, …` | 20, 24, 15 |

The vendor's canonical tokens are `@image1`, `@video1`, `@audio1`. The
gallery uses a dozen spellings (`image1:`, `Image 1`, `[image1]`, `@Image1`,
`<2pic>`, `{{Mixed 1}}`, `[video 1]`, `the provided image`, `uploaded
reference image`). Normalise to the vendor's form.

### When to generate or supply an image first

From the 34 prompts that use an asset against the 29 that don't. Each
criterion lists a prompt that met it with an image and, where one exists, a
text-only prompt that compensated without.

| # | Generate or supply an image first when … | With an image | Text-only compensation seen |
|---|---|---|---|
| 1 | **the same character must survive several generations** — sequel, series, chained shots | 44 (`must be the same real Korean woman continuing the fight from PART 1`); 1 (one appearance image per lead); 11 (three images: two characters, one venue); 34, 40 (`identity only`) | 8, 30, 33, 41: `consistent throughout` + itemised wardrobe + `no deformation` — holds inside one job, cannot reproduce across jobs |
| 2 | **a product, logo, UI or on-screen text must be literally right** | 12 (`strawberry flavour per @image1`); 13 (`logo per @image1`); 24 (`locked product references … frame shape, lenses, hinges`); 29 (logo, book and UI copy all as images) | text-only prompts **avoid readable text** instead: `unreadable signage` (7), `all labels illegible` (40), `completely out of focus and unreadable` (25), `no text overlays, logos or watermarks` (38) |
| 3 | **the opening frame's composition must be exact** | 15 (`Begin with the exact composition of the reference image`); 21 (`Use [image1] as the start`); 42 (first and last frame); 43 (`0-3s (first-frame reference <2pic>)`) | 58, 59 describe the establishing shot in words and accept variance |
| 4 | **several characters or elements must be placed in space** — a band, an orchestra, an ensemble | 57 (`build the frame from @image1: a band …`); 59 (18 images assigned to venue, players, choir, audience) | 7: four characters told apart by wardrobe colour blocks (`cobalt trench / rust knit polo / faded green / pale gray suit`) + `Preserve consistent faces` |
| 5 | **camera movement or rhythm must replicate a specific reference** | 1 (storyboard grid `for overall shot structure, shot sizes and camera rhythm`); 37, 43, 50 (a white-model video); 12 (six clips, one attribute taken from each) | 8: a `CAMERA AND PACING:` block describes every move in words |
| 6 | **a texture or lighting baseline is hard to put in words** | 1 (`image2 … realistic colour-film texture baseline`); 37 (`materials, lighting, colour, reflections and atmosphere from @image1`) | 1 also spends 60+ words on style plus an exclusion list — image and text together |
| 7 | **each time span has its own target frame** — keyframe animation | 29 (4 shots, 6 images); 43 (9 spans, 9 images) | — |
| 8 | **Reverse criterion — text alone is enough**: one shot, no cross-job consistency needed, a generic or fictional subject, mood-led, freedom welcome | — | 16, 17, 19 (fictional products: `"Honey Crunch Cereal"`, a flawless diamond, a blue-and-copper hair dryer); 28 (the vendor's panda); 35, 38, 58; case 30 states `no reference image needed` |

Two facts sharpen criterion 2 for products: the gallery's four product-video
prompts are **all text-only and all fictional products** (cases 16–19), while
every prompt that had to match a **real** SKU, logo or package used an image
(12, 13, 24, 29). By that split a generated image is not a substitute for a
photo of a real product — it can be wrong in the same ways the video can
(inferred from the split, not observed as a failure).

### API constraints that decide the route

All from `api-params.md`; listed here because they change which of the two
semantics you can use.

- **A photoreal person in the attached image is refused by
  `bytedance/seedance-2.5` image-to-video** (`input_moderation_failed` at
  submission; verified; nothing billed), so criteria 1 and 3 are unavailable
  on the `frame_images` path for a live-action human. It is a rule about the
  **attached picture only**: a non-photoreal character frame passes (measured
  on job `16023efe-48d6-45fe-8fd8-f5c6fbfe6519`, an anime pair), and a
  photoreal person **generated from the prompt text** is fine either way —
  five 20–30s text-to-video jobs full of them all completed. Which means the
  useful shape is: lock the object in the frame, write the person in text.
  The full statement of that route, with job ids, is under "Real-person
  reference images are refused by seedance-2.5 image-to-video" in
  `api-params.md`. Gallery cases with a real person in an i2v prompt (20, 24,
  40) came from other platforms and say nothing about Ofox behaviour.
  `--real-person true` exists for authorised references; whether it lifts the
  refusal on 2.5 is **untested here**.
- **`frame_images` and `input_references` are mutually exclusive.** One job
  either locks a frame or borrows appearance, not both.
- **`input_references` limits**: ≤9 images, ≤3 audio, ≤1 video; a video must
  be a URL. Case 59's 18 images and case 12's six reference clips exceed those
  limits — page-level capabilities, not reproducible through this API.
- **Attaching a frame on `bytedance/seedance-2.5` forces `aspect_ratio:
  adaptive`**; the script does this and prints a NOTE. The output ratio
  follows the image, so the ratio has to be decided **before** the image
  exists — a scenario skill that generates the image asks for platform and
  ratio first.
- **Local files beat URLs for `frame_images`** — a valid public image URL has
  been rejected upstream with a download error while the same file,
  base64-encoded, went through.

### Identity-reference example

The element shape is the one `api-params.md` documents:
`{"type": "image_url", "image_url": {"url": …}}`. `--extra-json` is merged
last, so its keys win over any flag. Do not combine with
`--frame-first-image`.

```bash
bash references/ofox-video.sh generate --dry-run \
  --model bytedance/seedance-2.5 \
  --duration 10 --resolution 720p \
  --prompt "image1 provides the heroine's identity only: face, short lilac hair, blue-and-white flower hairpin. Ignore its outfit, background and pose. image2 provides the venue: the bright school corridor, its overcast daylight and floor reflections. The lilac-haired girl walks down the corridor toward the camera; medium shot, slow handheld follow, shallow depth of field. No subtitles, no text, no watermarks." \
  --extra-json '{"input_references":[{"type":"image_url","image_url":{"url":"https://example.com/heroine-sheet.png"}},{"type":"image_url","image_url":{"url":"https://example.com/corridor.jpg"}}]}'
```

Role sentences adapted from cases 34, 40 and 11; the subject from case 9.
Drop `--dry-run` only after the approval gate (`approval-gate.md`). Whether
the `image1` / `image2` tokens are resolved to the attachments by position on
this path is the unverified point noted above; the sentences read as plain
role descriptions either way.

## Endings

Twenty of 63 prompts state how the clip ends; leaving it unstated is the
other common choice. When you state it:

| Ending | Phrases (translated where needed) | Cases |
|---|---|---|
| **Freeze frame** | `the frame freezes` · `final freeze` · `freeze the final frame` · `freeze final frame` · `Hold the final frame like an animated movie poster` | 5, 29, 39, 40, 56 |
| **Cut to black** | `end with a hard cut to black at the peak of suspense` · `the video stops abruptly and goes to black` | 4, 30 |
| **Pull back** | `the camera pulls back slowly, showing how small she is in the vast garden` · `finish with … a slow pullback that reveals the bright clinic` | 10, 26 |
| **Push in, then fade** | `The camera slowly pushes in on the sunglasses before fading out` | 24 |
| **Settle** — the camera comes to rest and holds | `the camera becomes completely stable … all clearly visible` · `camera continues recording for a moment before the clip stops` | 8, 25 |
| **End on a detail with the music** | `End on the transmitter signal fading … as the final bass note lands` | 7 |
| **Face the lens** | `walks toward the camera … looks straight into the lens, expression serious and resolute, the others blurred behind her` | 9 |
| **Hero pose** | `Finish on a slow-motion hero frame, perfectly centered` · `Final hero shot, slow motion` · the referee raises the arm, confetti, flashbulbs, push in to the last frame | 15, 14, 11 |

Pair the ending with its sound: a freeze with the closing music (case 5), a
pull-back as the score resolves (`ending on a clean resolved note`, case 26),
a fade after the final push-in (case 24). On Ofox, treat the music and the
score in the first two as something laid in afterward by an editor, not
asked of the model — see "Asking for music can fail output moderation on
copyright".

Four of the eight rows above are camera moves rather than pictures, so they
inherit the caveat in "A camera move needs its waypoint frames, not just a
verb": **write the last frame as a picture as well as the move that arrives at
it.** `pulls back slowly, showing how small she is in the vast
garden` is the model to copy, because it says what the final frame contains;
a bare `pull back to a wide` leaves the arrival unspecified, and an
unspecified arrival is the form a measured run dropped entirely. Freeze,
black and fade need no help — they are states, not destinations.

**`hold the final frame` is not honoured as a freeze, and the two clips that
show this are a controlled pair.** Both grinder clips closed on that
instruction; measured over each one's last half second, `1cf5ac46` really is
still (every frame under a 0.0005 scene score) while `50f623b2` is not — six
frames above 0.0005 and one above 0.002, a visible drift rather than a hold.
Same instruction, same seed, same everything but one paragraph earlier in the
prompt, and only one of them held. So write the hold if you want it, and
expect a settle rather than a freeze; if the last frame genuinely has to be
frozen, that is an editing step, not a prompt clause.

### Ending line to copy

```
<T-2 – T s>: <the last action completes>. The camera <settles / pulls back to a wide / pushes in on the product>; hold the final frame for one second [as the last sound fades | in silence] — a music resolve is a real ending too, but leave it to an editor afterward rather than asking the model for it, see "Asking for music can fail output moderation on copyright".
```

From cases 29, 26, 24, 5.

## Quick checklist before submitting a prompt

1. **Subject + action is the first sentence** — the vendor's only required
   slot — not the format line, not the style (cases 28, 58, 59).
2. **Declared once: format (optional, matching the flags), style anchor, each
   character's appearance with a short tag, the scene** (cases 1, 8, 10).
3. **Segmented if 16s or longer**, one timestamp format throughout; 3–5s per
   segment by default, 2–3s when beat- or dialogue-driven (cases 1, 7, 34),
   and a shot count that matches the register rather than the template's
   floor (see "Shot density, measured per case").
4. **Said which kind of timestamp it is** — cut boundaries, or beats inside
   `one continuous shot` (cases 3, 6, 8 against 1, 22) — and **named a
   transition kind at each boundary on purpose**: nine kinds exist, a hard cut
   is one of them, and an unnamed boundary becomes one by default (see
   "Transitions"). If a cutting rhythm is the point, hard cuts hold every
   boundary they are written on in the measured jobs where they are at least
   3 of 8 of the boundaries, and held none in the one job below that (see
   "Past that envelope").
5. **Every segment runs time → shot size / position → action → dialogue →
   sound** (cases 1, 7, 22), **with its own shot size stated** — a segment
   that omits it inherits the previous segment's framing.
6. **No movement is left phrased only as a movement.** Every angle, position
   and beat that has to appear is written as a still frame at its own
   timestamp, with its own shot size — a bare `the camera orbits it` and a
   small fast event trailing off the end of a longer beat are the two forms
   measured as silently dropped (see "A camera move needs its waypoint
   frames, not just a verb"). Two or three waypoints per move, and **no beat
   that has to land on an exact second**, since interior stamps
   drift and one can be absorbed. A prohibition in the same sentence is no
   evidence the instruction beside it will run.
7. **Dialogue is speaker + quoted line + delivery note, in the language to be
   spoken, budgeted by tier** — drama far under 2–3 words/s, talking head
   about 3.5 words/s (cases 3, 20, 22).
8. **A consistency lock that enumerates invariants, and a negative list that
   names the style you are not making** (cases 44, 3, 57, 25).
9. **Every attached asset has a role sentence** ("image1 provides X; ignore
   Y"), and the job uses **either** a frame lock **or** identity references,
   never both (cases 34, 40; `api-params.md`).
10. **No photoreal person in a `bytedance/seedance-2.5` attached frame** —
   people generated from the prompt text are fine; **aspect ratio decided
   before any image is generated**, and the image file's real pixels
   measured and cropped, since adaptive follows the image
   (`api-params.md`, "What a frame lock actually holds, measured").
11. **An ending is stated** — freeze, black, pull-back or fade — paired with
    its sound (cases 5, 26, 24). If the sound includes music the model has to
    invent, expect `output_moderation_failed` on copyright (see "Asking for
    music can fail output moderation on copyright").

Then `--dry-run`, the cost table, and a yes — `approval-gate.md`. Afterwards,
check the delivered file by reading frames, not by counting a scene
detector's hits — "Checking the cuts: read frames, never a detector count
alone" — and before claiming how far a camera travelled, check that the
endpoints you measured are inside one continuous shot and that the subject
has an asymmetric feature to read the angle off: "Measuring a camera's
travel: only inside one continuous shot".
