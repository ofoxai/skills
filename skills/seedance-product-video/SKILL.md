---
name: seedance-product-video
description: Generate a clean, catalog-style e-commerce product video from a real product photo (or, for a generic or fictional product, a text description) using the Ofox video API (Seedance 2.5) — runs a short creative brief (product photo, target platform and aspect ratio, background, camera orbit or turntable) when the request leaves them open, writes a plain-background, literal-accuracy prompt (precise product description, a simple camera orbit or turntable motion, no dramatic cinematography), shows a cost estimate, then calls ofox-video-core to submit, poll, download, and report the real cost. Use when a user asks to turn a product photo into catalog/listing footage, e.g. "make this product photo a 360-degree white-background showcase", "turn this photo into a white-background product video", "make a clean turntable video of this item", or "give me a 5-second white-background rotation video of this product for my listing". Do not use for cinematic brand/mood advertising (see seedance-ad-creative) or for anything involving people/dialogue (see seedance-short-drama).
license: MIT
version: "1.10.1"
homepage: https://github.com/ofoxai/skills/tree/main/skills/seedance-product-video
metadata:
  author: ofoxai
  version: "1.10.1"
  openclaw:
    requires:
      env: [OFOX_API_KEY]
      bins: [curl, jq]
    primaryEnv: OFOX_API_KEY
    envVars:
      - name: OFOX_API_KEY
        required: true
        description: Ofox API key. Create one at https://app.ofox.ai (Settings -> API Keys). The same key works across every Ofox skill.
    emoji: "📦"
    homepage: https://github.com/ofoxai/skills/tree/main/skills/seedance-product-video
---

# seedance-product-video: clean e-commerce product showcase videos

Turns a product photo — or, for a fictional or prototype product, a text
description — into a plain-background catalog/listing clip: a precise product
description plus a simple camera move, written as timestamped waypoints,
become a Seedance 2.5 prompt, which this skill submits, polls, downloads, and
reports the cost for.

This skill is a thin, scenario-specific layer over
[`ofox-video-core`](../ofox-video-core/SKILL.md). It owns the product-video
prompt craft, the creative brief, recommended defaults, and the
pre-generation cost estimate; `ofox-video-core` owns talking to the Ofox API
correctly and safely (the `OFOX_API_KEY` handling, the no-resubmit rule,
error-code mapping, download/verification, and reporting the downloaded
file's absolute `VIDEO_PATH`). **Read that skill's safety contract before
using this one** — it is not restated here.

The prompt structure shared by every Seedance scenario skill — the vendor's
formula, timestamp formats and segment lengths, camera vocabulary,
consistency locks and negative lists, the two meanings of an attached image
— lives in
[`../ofox-video-core/references/prompt-structure.md`](../ofox-video-core/references/prompt-structure.md).
Load it before writing a prompt. This file only adds what is specific to
catalog footage.

The rules for the questions that come **before** a prompt exists are shared
the same way, in
[`../ofox-video-core/references/creative-brief.md`](../ofox-video-core/references/creative-brief.md);
the brief section below carries only this scenario's question set.

## Before generating: the availability check

Run this once per session (not on every request):

```bash
bash ../ofox-video-core/references/ofox-video.sh check
```

If it fails, follow `ofox-video-core`'s guidance (install `curl`/`jq`, or get
an `OFOX_API_KEY` at `https://app.ofox.ai`) — don't dead-end the
conversation, and don't re-run this check on every subsequent request once
it has passed.

## Before writing the prompt: the creative brief

The shared rules are in
[`../ofox-video-core/references/creative-brief.md`](../ofox-video-core/references/creative-brief.md)
— the three tiers, one round of at most four questions, the shape of a
question, the "Let the AI decide" discipline, the generic skip rows, the order
with the approval gate, the fallback for a runtime without
`AskUserQuestion`, and the anti-patterns. Read it before writing a prompt.
This section adds only what is specific to catalog footage.

For catalog footage two of the axes are not taste at all: without the photo
the product may come out wrong, and without the ratio the photo cannot be
prepared, because once an image is attached the output ratio follows the image
and cannot be changed afterwards — a wrong ratio is a paid clip in the bin.
Zero questions is still common: "5-second white-background orbit of this mug
for my Etsy listing" plus an attached photo has settled every axis.

| Tier | Product-video axes |
|---|---|
| **must-ask** | is there a product photo? which platform, hence which aspect ratio? Both come **first** — the answers decide the prompt route and the crop applied to the photo. |
| **ask-if-open** | background, the camera motion |
| **never-ask** | resolution, model, provider, audio (off in this scenario), duration. 720p vs 1080p is **two rows in the cost table**, not a question. |

If four slots are not enough: the two must-ask items first, then
`Background`, then `Motion`; anything left falls to a default and the cost
table.

**Neither must-ask question carries a "Let the AI decide" option.** A photo
that does not exist cannot be invented, and a ratio chosen after the image
exists is too late. The aspect question fills its slot with four platform
options instead; if the user answers "I don't know" in free text, fall to
`1:1` and mark it `(AI's pick)` in the recap.

### The product-video question set

| # | Tier | `header` | Question | Options (1 = recommended) | Ask when |
|---|---|---|---|---|---|
| 1 | must-ask | `Photo` | Do you have a photo of the product? A listing is compared against the real item, so the photo is what keeps the shape and label right. | **Yes — I'll give a local path (recommended)**: image-to-video from the real photo; every gallery prompt that had to match a real product or logo used an image (cases 12, 13, 24). / **No — describe it in text**: acceptable for a generic item or a fictional brand (the gallery's product prompts, cases 16–19, are all text-only and all fictional); for a real SKU the result may not match the item — I will say so. **No AI option.** | No image attached and the user did not say "no photo". |
| 2 | must-ask | `Aspect` | Which platform is this for? It fixes the frame shape, and with a photo I have to crop or pad the photo to that shape before generating. | **1:1 marketplace grid (recommended)**: Amazon, Etsy, Shopify, eBay listings. / **9:16 TikTok Shop and mobile storefronts**. / **16:9 website product-detail page**. / **4:3 legacy catalog template**. **No AI option** — four platform options fill the slot; a free-text "don't know" falls to 1:1, marked (AI's pick). | No platform or ratio in the request. |
| 3 | ask-if-open | `Background` | What should sit behind the product? | **Pure white (recommended)**: what most marketplace listing rules ask for; no props, no shadows on the backdrop. / **Light grey studio**: a soft neutral surface with true reflections (the gallery's cleanest product prompt, case 17, uses a bright reflective surface with softbox light). / **Keep the photo's own background**: the scene stays as shot, pinned in place (case 41 locks its background geometry rather than removing it). / **Let the AI decide**. | No background word in the request. |
| 4 | ask-if-open | `Motion` | How should the product be shown? | **Camera orbits, product still (recommended)**: every rotation in the gallery is written as camera movement or as a hand turning the product (`360-degree orbit`, official case 42; `the camera slowly circles the build platform`, case 39). Answering this does not settle how the segment gets written — the words "the camera orbits" produced no orbit at all on a real run, and the option only delivers in the **waypoint** form of "3. Camera motion: waypoint pictures, not a camera verb" below, whose spacing between angles is approximate rather than scheduled. / **Product turntable 360, camera fixed**: the classic listing spin; no gallery prompt writes it this way and it has never been run here — kept because platforms and users ask for it by name. / **Slow push-in on a detail**: one feature fills the frame (cases 19, 24, 39). / **Let the AI decide**. | No motion word in the request. |

Not asked: 720p vs 1080p (two rows in the cost table); duration (5s for a
single orbit, 10–15s for the segmented template — a row, and the recap says
which); model, provider, the audio flag (off here).

### Skip rows specific to product-video

On top of the generic rows in `creative-brief.md`:

| Input says… | Axis | Value |
|---|---|---|
| a product photo is attached, or a path is given | Photo | have one → image-to-video; do not ask whether there is one |
| eBay, "marketplace", "main image", "listing grid" | Aspect | `1:1` |
| TikTok Shop, "mobile store" | Aspect | `9:16` |
| "product page", "detail page" | Aspect | `16:9` |
| "catalog template", "4:3", "legacy" | Aspect | `4:3` |
| "white background", "white", "cut out", "clean" | Background | pure white |
| "grey", "studio", "neutral" | Background | light grey studio |
| "keep the background", "as shot", "in place" | Background | the photo's own background |
| "orbit", "circle around", "camera moves around" | Motion | camera orbits, product still |
| "spin", "turntable", "rotate", "360 on its axis" | Motion | product turntable, camera fixed |
| "close-up", "zoom in on the detail", "push in" | Motion | slow push-in on a detail |

### From answers to prompt — traceability

Every answer has to be findable in the prompt or the flags.

| Answer | Lands in |
|---|---|
| Photo: yes, path | `--frame-first-image PATH`, the `image1 provides the product exactly` sentence in the PRODUCT block, and the crop/pad step before generating |
| Photo: no | a text-only PRODUCT block, an expectation note in the recap, and `--aspect-ratio` becomes effective |
| Aspect | the crop/pad ratio for the photo (image-to-video), or `--aspect-ratio` (text-to-video) |
| Background | the SCENE line: `pure white surface and backdrop` / `light grey studio surface` / `keep the background exactly as in image1` |
| Motion | the ORBIT segment's camera sentence, or the compact template's single motion sentence |
| Duration | `--duration`, and the timestamps in the timeline |

### The recap for this scenario

```
Brief:
- Photo: /Users/me/shop/mug-front.jpg (given) — I will pad it to 1:1 first
- Aspect: 1:1 (inferred from "Etsy")
- Background: pure white (you chose)
- Motion: camera orbits 360 degrees, product still (AI's pick)
- Duration / resolution / audio: 5s / 720p / off — one row below; 1080p as a second row
```

Then the full prompt, then the cost table, all in one message — the order and
the rule for a change made at the gate are in `creative-brief.md`'s `Order,
with the approval gate`. Here a ratio change also means re-padding the photo.

## Prompt template

Vocabulary is not repeated here. Timestamp formats and segment lengths:
`Segmenting the timeline`; the orbit, push-in, macro and static terms:
`Camera language`; the closing blocks: `Consistency locks and the negative
list`; asset role sentences and the two image semantics: `Reference assets as
visual anchors`; freeze and settle endings: `Endings` — all headings in
`../ofox-video-core/references/prompt-structure.md`. What follows is the
catalog-specific shape.

The gallery's product prompts (cases 16–19, 37–41) share a first line that
names the format and places the product, a product block built from
material, colour and physical words rather than adjectives, and a short
action chain of three or four beats with one action per beat. The closing
blocks are common but not universal: a consistency lock in cases 19, 39 and
41, a negative list in 18, 38, 40 and 41, a technical tail in 16, 17, 19 and
39. None of the nine is a white-background listing clip — they are ads and
demos — so the plain background below is a marketplace convention, not a
gallery observation. The beat structure and the locks are the gallery's.

### Full template — 10–15s, three or four segments

One action per segment (case 18: `Show only one salon action at a time. Each
action must last long enough to show the process clearly`), 3–5s each (case
39 runs 4/3/4/4; case 41 about 2s per outfit). Slots in `<angle brackets>`;
optional lines in `[square brackets]`. `a`/`b`/`c` scale to the chosen
`--duration` — see "Scale the segments, don't copy the stamps" below the
template.

```
[<N> seconds, <1:1 | 9:16 | 16:9 | 4:3>.]                                  — optional; must match the flags (cases 18, 39, 41 write it; the vendor says it is not needed)
PRODUCT: <product name>, <main colour> with <accent colour>, <material and finish>, <shape and structural points>[, printed text verbatim: "<text>"][, accessories: <A>, <B>, <C>].
         The product stays identical in shape, colour, proportions and label throughout.          (cases 19, 24, 39, 41)
         [image1 provides the product exactly as it is; take nothing from its background.]
SCENE: the product centered on a <pure white | light grey | matte neutral> surface against a <pure white | neutral> backdrop; even studio softbox lighting, soft true reflections, no props, no shadows on the backdrop. Background and light do not change.   (case 17 for the surface and light; the white is a listing convention)

0–<a>s     [REVEAL, optional — <the box lid lifts away | a hand moves away from the lens | the product fades up from dark> to show the product]   (cases 17, 19, 41)
           | <static front view, product centered, camera still>.
<a>–<b>s   DETAIL — the camera pushes in to a macro of <the seam | hinge | logo | fabric weave>; reflections slide across the surface.   (cases 19, 39, 24)
<b>–<c>s   ORBIT — one single continuous camera move, no cut anywhere inside this segment. The camera travels around the product at constant height and constant speed, the product centered the whole way, and the frame shows a new side as it goes: at about <t1>s <what is in shot and what is out of sight — an appearance description, not a camera position>; at about <t2>s <the same, for a view the first one could not see>; by <c>s the camera is back on the exact front view of the opening shot. At every one of those positions the whole product is in frame, <top> to <bottom>, with margin. The product does not move, does not rotate on its axis and does not tip.   (the orbit is cases 42, 39; the waypoint form is measured — "3. Camera motion" — and its budget and loose timing are section 4)
           | TURNTABLE — the product rotates 360 degrees on its own axis at constant speed; the camera is fixed and centered.   (no gallery prompt, and never run here; kept as the listing convention)
<c>–<N>s   [ACCESSORIES — <A>, <B>, <C> lie neatly beside the main unit; a slow macro pan across them]   (case 17)
           | back to the front view; hold the final frame.   (cases 39, 40)

SOUND: none.                                                                — and `--generate-audio false`
AVOID: subtitles, logo overlays, watermarks, interface graphics; deformation, parts clipping through each other, duplicated accessories; floating objects; camera shake, zoom, sudden reframing; fast cuts, jump cuts; a CGI look.   (cases 38, 40, 41, 18, 24)
hyper-realistic textures, realistic reflections, smooth 60fps motion, 4K.   (cases 16, 17, 19, 24, 39 — a gallery habit, effect unverified; resolution comes from --resolution, not the prompt)
```

**Scale the segments, don't copy the stamps.** REVEAL, DETAIL and ORBIT
alone already run to about 12s at their default lengths, so a literal
`0–3s / 3–7s / 7–12s / 12–<N>s` reading only fits a 15s clip — at 10s or 12s
it leaves ACCESSORIES zero or negative seconds. Scale `a`, `b` and `c` to
the `--duration` actually chosen instead. The worked example below keeps the
same shape at a shorter total (3/6/10/12): REVEAL and DETAIL get one beat
each, ORBIT gets the single largest share because showing the product from
every angle is the point of a catalog clip, and ACCESSORIES — the one
segment that isn't the product itself — stays the smallest, 2–3s, never the
majority of the clip.

**Four segments do fit 12 seconds, and an uneven split is carried through.**
Both of this scenario's own clips were written at 3/3/4/2 in 12 seconds — the
worked example's own `3/6/10/12` stamps — and the rejected one measured
3.12/2.88/3.7/2.3, every segment within 0.3s of plan ("Measured on this
scenario's own clips" below).

Notes on the slots:

- **Write the consistency lock every time**, even though only some gallery
  prompts do — for a listing it is the whole point. The ones that carry it:
  `consistent diamond throughout the entire shot`
  (case 19), `Maintain perfect product consistency, including the frame
  shape, lenses, hinges, colors, materials, and proportions` (case 24), the
  dragon's `identity, anatomy, scale pattern, horns, wings and proportions
  must stay completely consistent` (case 39), `Keep every architectural line
  perfectly fixed across all cuts` (case 41).
- **Printed text goes in quotes, verbatim** (`yellow "Honey Crunch Cereal"
  box`, case 16). If the text must match a real package, that is a reason
  for the photo, not for more adjectives.
- **The reveal is optional** and the only place the gallery's product prompts
  add any drama (a jewellery box opening, case 19; a storage box lid, case
  17; a palm leaving the lens, case 41). Keep it to one plain gesture; a
  cinematic reveal with mood lighting is `seedance-ad-creative`'s job.
- **Timestamps here are cut boundaries** between camera set-ups. Three shots
  in one job are verified on Ofox (see Several shots below); if the user
  wants the whole clip as one continuous move, drop the timestamps and use
  the compact template.
- **Write ORBIT as waypoint pictures, and give each one a shot size.** Naming
  the camera's move got no move at all on a real run; timestamped
  descriptions of *what the frame contains* got a camera that moved and
  landed on the frame it was told to land on. The measurement — a controlled
  pair, one paragraph apart — what the waypoints did not buy, and what the
  clip cannot establish about how far the camera went are all in "3. Camera
  motion: waypoint pictures, not a camera verb".
- **A segment inherits the previous segment's framing unless told otherwise.**
  DETAIL sits immediately before ORBIT in this order, and on the accepted clip
  the orbit stayed at DETAIL's macro closeness — several angles of the collar
  and the crank, and the product's base out of frame the whole way. Any
  segment that needs a different shot size has to say so, per waypoint. It
  also cost a waypoint outright: one of them asked for a detail that the
  inherited framing had already put outside the frame, so half of it could
  not render at all (§3).
- **`beside` puts the accessories on both sides.** Written as `in a row on
  the grey surface beside the standing grinder`, both clips split the row so
  items sat on either side of the product. Identical in both, so it is a
  stable reading rather than a roll — if the row has to stay to one side, name
  the side and say the product is not between any two of the items.
- **`hold the final frame` buys a settle, not a freeze.** One of the two clips
  held still through its last half second and the other drifted visibly, from
  the same instruction at the same seed. Ask for it, expect the settle, and
  freeze in an editor when the last frame really has to stop.

### Compact template — 5s orbit

The single-motion clip most listings want. No segments, no header; vendor
formula order — subject first (shared file, `The vendor's own formula (ByteDance first-party)`).

```
<Product name>, <main colour>, <material and finish>, <shape point>[, "<label text verbatim>"]. Centered on a pure white surface against a pure white backdrop; even studio softbox lighting, true reflections, no props, no shadows. The camera orbits the product 360 degrees at constant height and speed; the product stays still and identical in shape, colour, proportions and label throughout. No subtitles, no logo overlays, no watermarks; no deformation, no floating parts; no camera shake, no zoom. Hyper-realistic textures, realistic reflections, smooth motion.
```

Swap the motion sentence for `The product rotates 360 degrees on its own
axis at constant speed; the camera is fixed and centered` when the brief
chose the turntable — that phrasing has **no gallery source and has never been
run here**; it is the listing convention written out. Sources for the rest: 5s +
`360-degree orbit` from official case 42;
surface and light from case 17; the lock from cases 19 and 24; the negative
list from cases 38 and 41.

**The compact template's own orbit sentence is the phrasing that failed at 12
seconds**, so at 5 seconds it is untested rather than safe: nothing in this
repo has run the one-sentence form. If the clip has to show more than one
side, prefer the full template's waypoint ORBIT even at a short duration, and
read the draft before paying for the final — see "3. Camera motion: waypoint
pictures, not a camera verb".

### Worked example — adapted from case 17

The community hair-dryer reveal, moved from prose into the full template at
12 seconds, 1:1. The original's purple leather storage box and "minimalist
luxury" wording are dropped for catalog neutrality; the lid reveal, the
copper-accent product block, the accessory row and the technical tail are
the original's. Timestamps are added.

Its ORBIT segment is the one line here that is neither the original's nor a
plain translation of it. Until 1.10.0 it read `the camera orbits the dryer 360
degrees at constant height; the product does not move` — the exact phrasing
that produced no orbit on a real run — so it is now written in the waypoint
form that did produce one: two interior pictures written as appearance
descriptions, plus a return to the opening front view — the budget a
four-second orbit was measured to absorb ("3. Camera motion: waypoint
pictures, not a camera verb" and section 4 below).

```
12 seconds, 1:1.
PRODUCT: a hair dryer, deep blue body with copper accents, matte finish with polished copper trim, slim cylindrical barrel with a round rear intake; accessories: straight nozzle, diffuser nozzle, styling barrel. The product stays identical in shape, colour, proportions and trim throughout. image1 provides the product exactly as it is; take nothing from its background.
SCENE: the product centered on a pure white surface against a pure white backdrop; even studio softbox lighting, soft true reflections, no props, no shadows on the backdrop. Background and light do not change.

0–3s    REVEAL — a plain white box lid lifts away, showing the hair dryer standing upright.
3–6s    DETAIL — the camera pushes in to a macro of the copper trim and the intake grille; reflections slide across the surface.
6–10s   ORBIT — one continuous camera move, no cut inside this segment. The camera travels around the standing dryer anticlockwise at constant height and constant speed, the whole dryer in frame from the top of the barrel to the base at every point: at about 7s the copper trim reads as one thin bright line along the barrel and the nozzle mount is out of sight; at about 8.5s the round rear intake grille fills the centre of the frame and no part of the nozzle mount shows; by 10s the camera is back on the exact front view of the opening shot. The dryer does not move, does not rotate on its axis and does not tip.
10–12s  ACCESSORIES — the three nozzles lie neatly in a row beside the dryer; a slow macro pan across them; hold the final frame.

SOUND: none.
AVOID: subtitles, logo overlays, watermarks; deformation, clipping; floating objects; camera shake, zoom, sudden reframing; fast cuts.
hyper-realistic textures, realistic reflections, smooth 60fps motion.
```

## Measured on this scenario's own clips

Until 2026-09-05 this skill had generated nothing of its own — every figure it
quoted came from the gallery, from `seedance-ad-creative`'s product jobs, or
from `ofox-video-core`'s two three-shot test runs. It now has two clips, and
they are a controlled pair: **same seed (`642303335`), same model, same flags,
the same prompt text except one paragraph** — the ORBIT segment. Both
`bytedance/seedance-2.5` on `byteplus`, **pure text-to-video with no image
attached**, 12s, 720p, `--aspect-ratio 16:9`, `--generate-audio false`, billed
2.88 USD each (5.76 USD for the pair).

| | Job | Outcome |
|---|---|---|
| Clip A | `1cf5ac46-058f-4615-a47b-067743f76f8c` | rejected — the ORBIT segment delivered no new angle |
| Clip B | `50f623b2-c54a-4d9d-9646-31dd06e2a926` | accepted 2026-09-05 |

The subject was a fictional hand coffee grinder — walnut body, brushed steel
collar and crank arm, knurled steel base ring, accessories a glass jar with a
steel lid, a steel scoop and a wooden-handled brush, and **no printed text
anywhere by design** — written with the full template's four segments at
3/3/4/2. Versions in force when they ran: this skill 1.8.0, `ofox-video-core`
1.15.0. Clip B is the gallery's first `ofox`-sourced case in the
`product-video` category (`n: 1009`; the category's other four are
community-sourced).

The ORBIT half of the pair is the headline finding and lives with the rule it
produced, in "3. Camera motion: waypoint pictures, not a camera verb". The
rest of what the template delivered:

| Slot | What was written | What rendered |
|---|---|---|
| REVEAL | a plain light grey box lid lifting straight up and out of the top of frame | exactly that — the optional reveal slot works as documented |
| DETAIL | macro on the knurled ring and the metal/wood seam, a slow straight push-in, a highlight sliding along the grooves | exactly that |
| ORBIT | clip A: the camera's move named; clip B: four timestamped moments — three interior views and the return | clip A: nothing. Clip B: the camera moved and the segment ended on the opening front orientation; two of the three interior views appeared, unevenly spaced. About 180 degrees of the travel is observable and the total is **unmeasurable** — sections 3 and 4, with what the run can and cannot attribute |
| ACCESSORIES | three named items **in a row, beside** the standing grinder, evenly spaced, not touching, **only in the final segment** | the items themselves: exactly that — three correct items, no duplication, none appearing early. AVOID named `no accessory appearing before the final segment` and `no duplicated accessory`, the two failure modes this slot risks, and both were prevented. **The placement is where it deviates**, in both clips identically — see below |

And what else the pair showed — first the things that held, then the four
that did not or that hold only with a hedge:

- **Zero invented text, on an all-bare set of metal, glass and wood, with no
  first frame to anchor anything.** The glass jar's brushed steel screw lid is
  exactly where a brand name shows up, and it stayed blank. This skill's own
  guidance says text-only prompts *avoid* readable text rather than
  controlling it; here the PRODUCT block's explicit `there is no printed text,
  no logo, no engraving and no marking anywhere on the product or on any
  accessory`, plus an AVOID list naming each carrier one by one (product,
  accessories, surface, backdrop), produced a genuinely clean set on the
  text-to-video route. Two clips, so it is evidence for that construction, not
  a guarantee.
- **Zero deformation of the crank arm** — a thin protruding right-angle part,
  the predicted main risk. It held its length, thickness and bend through both
  clips, including through clip B's orbit.
- **The consistency lock worked with no first frame at all.** Every earlier
  accepted clip in this repo that needed a product's identity held had an
  attached image doing that work. This is the first clean test of the text lock
  on its own, so the template's "write the consistency lock every time" now has
  direct evidence behind it rather than only a rationale.
- **`--generate-audio false` produced no audio stream at all** in the delivered
  file, not a silent track. The defaults table says the flag sets
  `generate_audio: false` on the request; this is the end-to-end result.
- **`--aspect-ratio 16:9` took effect — the output is exactly 1280x720.** First
  clean confirmation of ratio control in this repo: every earlier
  product-adjacent clip attached a frame and was forced to `adaptive`. It
  worked *because* the route was text-only, which is the point made under "A
  product photo" below.
- **`beside` is read as `on either side of`.** The prompt put the three
  accessories `in a row on the grey surface beside the standing grinder`, and
  both clips split that row so items sit on both sides of the grinder instead
  of together to one side. **Both clips did the same thing**, which makes it a
  stable reading of the instruction rather than a roll — the useful kind of
  deviation, since it is predictable. If the row has to stay on one side, say
  which side and say the grinder is not between any two of the items; `beside`
  alone will not do it.
- **An explicit "no cut anywhere inside this segment" was not contradicted,
  which is weaker than "held".** In clip B the 0.25 detector pass reports
  boundaries at 3.12s and 6.29s and nothing inside the orbit. But the same
  pass also missed that segment's own closing boundary (next bullet), so a
  pass that cannot see one cut in this clip has not established the absence of
  another one three seconds earlier. The frames across the orbit are
  consistent with continuous travel; the detector's silence is not what
  establishes it.
- **The scene detector missed a real cut in *both* clips, at two different
  thresholds.** Clip A's third boundary is at **9.750s** and appears only once
  the threshold is dropped to **0.05**; clip B's is at **10.041667s** and
  needs **0.10**. Neither is visible at the 0.25 both clips were first checked
  at, while the earlier boundaries were found in the same passes. A uniform
  grey studio under unchanging light is the known same-lighting blind spot,
  and these are the **fifth and sixth** confirmations of it in this repo —
  and the strongest, because they are a controlled pair and **no single lower
  threshold would have caught both**. Read frames either side of every written
  stamp instead of trusting a count; the record lives in `Checking the cuts:
  read frames, never a detector count alone` in
  [`../ofox-video-core/references/prompt-structure.md`](../ofox-video-core/references/prompt-structure.md),
  not here.
- **`hold the final frame` produced a hold in one clip and a drift in the
  other.** Over each clip's last half second, clip A is still — every frame
  under a 0.0005 scene score — while clip B has six frames above 0.0005 and
  one above 0.002. Same instruction, same seed, one paragraph of prompt apart,
  and only one of them held. Write the hold, expect a settle, and do the
  freeze in an editor if the last frame really has to be frozen.

## A product photo: when it is required, when text is enough

For a listing, a shopper compares the clip against the real item, so literal
accuracy (shape, printed text, logo, colour, material) matters more here than
in any other Seedance scenario — an invented detail is a real problem, not
an aesthetic one. The gallery splits the question in two, and so does this
skill:

| The product is… | Route | Evidence |
|---|---|---|
| a **real SKU** — a logo, a printed label, distinctive geometry (hinges, seams, a particular cap), brand packaging | **Photo required.** Image-to-video from the real photo. | every gallery prompt that had to match a real product, logo or package used an image (cases 12, 13, 24, 29); text-only prompts avoid readable text instead — `all labels illegible` (case 40), `unreadable signage` (case 7) |
| a **category prototype** or a fictional brand — "a matte white ceramic mug", "a blue-and-copper hair dryer", a made-up label the user is happy to have invented | Text is acceptable. Say so, and set expectations. | the gallery's four product-video prompts are all text-only and all fictional (cases 16–19); this skill's own accepted clip is text-only on a fictional product (job `50f623b2-c54a-4d9d-9646-31dd06e2a926`), and it held both the product's identity across four segments and a completely text-free set |

**An AI-generated product image is not a substitute for a photo of the real
product.** No gallery product case goes generate-an-image-then-animate; the
ones with images used real photos or the vendor's own white-model assets
(cases 24, 37). The reason follows from that split rather than from an
observed failure: a generated image can be wrong about the label, the cap and
the proportions in exactly the ways the video can — and then locks those
errors in as the first frame. If the user has no photo of a real SKU, say the
result may not match the item, and offer to proceed as a category prototype
rather than offering to generate a reference first.

**The text-only route keeps one control the photo route gives up: the aspect
ratio stays a flag.** With a photo attached, `bytedance/seedance-2.5` forces
`aspect_ratio: adaptive` and the clip comes out the photo's shape, so the
platform ratio is a crop made before generating. With no image,
`--aspect-ratio` takes effect — measured on the accepted clip, `16:9` in and
exactly 1280x720 out. So for a fictional or prototype product, following this
skill's own rule against generating a reference image is not only about not
locking in invented details; it is also what keeps the frame shape a
parameter rather than a pre-processing step.

**Prefer a local file over a remote URL** when the user has one available.
`ofox-video-core` auto-base64-encodes a local, readable file into the
request; real testing found this more reliable than a remote URL in at
least one case (an otherwise valid, publicly reachable image URL was
rejected by the upstream provider — likely host-side bot/hotlink
protection, not something under our control). A remote URL also works if
that's all the user has, it's just the less-reliable option of the two.

### Two ways to attach the photo

An attached image means one of two things, and the API has a field for each
(shared file, `Reference assets as visual anchors`):

| Meaning | Flag | What it does | Status in this repo |
|---|---|---|---|
| **First frame** — the clip starts on this exact picture | `--frame-first-image PATH` | locks the opening view to the photo; on `bytedance/seedance-2.5` forces `aspect_ratio: adaptive`, so the photo is cropped or padded to the target ratio **before** generating | verified with real runs; this skill's default route |
| **Identity reference** — the model borrows the product's appearance from one or more images, no frame is locked | `--extra-json '{"input_references":[{"type":"image_url","image_url":{"url":"…"}}, …]}'`, up to 9 images | lets front, back, top and box photos all inform the clip, with one role line per image (`image1: front view; image2: the label, verbatim`) — the pattern nearly every gallery prompt with an image uses (cases 24, 37) | element shape documented in `api-params.md`; **no image-reference job has been run end to end in this repo**, and whether the `image1` tokens resolve by position is unverified — write role sentences that read correctly as plain text either way |

**The two are mutually exclusive** in one job: the script rejects a request
carrying both (`references_conflict`). For a single photo, the first-frame
route is the tested one and the default here. Reach for identity references
only when the user has several angles of the product and wants them all to
count.

```bash
bash ../ofox-video-core/references/ofox-video.sh generate \
  --prompt "<the compact template above>" \
  --frame-first-image "/path/to/local/product-photo.jpg" \
  --duration 5 --resolution 720p --generate-audio false
```

**Do not pass `--aspect-ratio` here** for the default model
(`bytedance/seedance-2.5`) — `ofox-video-core` forces `aspect_ratio` to
`adaptive` whenever an image is attached with this model (verified against
the real API: every other value fails for image-to-video on this model),
overriding anything else and printing a notice when it does. The output's
frame shape follows the **photo's** shape, which is why the brief settles
the platform before anything is generated and the photo is cropped or padded
to that ratio first.

If the reference image includes an actual person (e.g. a hand modeling a
ring, a person wearing the product), Seedance 2.5 image-to-video refuses it
at submission (`input_moderation_failed`, nothing billed). `--real-person
true` exists for authorised references per the API contract, but whether it
lifts the refusal on 2.5 is untested here; the reliable route is a photo of
the product alone. The `--real-person` path validates the image server-side
and can fail with
`bad_data_uri`/`download_failed`/`unreachable`/`not_image`/`too_large` if the
image isn't a small, valid file the API can use — see the failure table
below.

## Writing a good product-video prompt

Keep the prompt plain and literal — this is the opposite instinct from
`seedance-ad-creative`'s cinematic mood-building. The templates above are
the shape; these are the four things that go into them.

### 1. Product description, precise and neutral

Shape, material, colour, finish, structural points, and any printed text
verbatim in quotes — the same precision `seedance-ad-creative` uses for
product accuracy, without its mood or brand-tone layer, since a catalog shot
has no brand story to tell. The gallery's product blocks are built from
physical words: `glowing copper accents`, `physically accurate diamond
refraction`, `realistic stainless-steel reflections` (cases 17, 19, 38).

```
A matte ceramic coffee mug, off-white, cylindrical with a curved handle, "MORNING" printed in dark grey on one side.
```

### 2. Explicit plain-background language

A pure white background is what marketplace listing rules ask for and what a
shopper expects of catalog footage. It is a **platform convention, not
something the gallery shows**: the gallery's cleanest product prompt (case
17) uses a bright reflective surface under studio softbox light, and case 41
pins a grey stone background in place rather than removing it. Whatever the
brief chose, state it directly instead of assuming the model will remove
whatever is behind the product in the reference photo:

```
Pure white surface and backdrop, clean studio background, no props, no shadows on the backdrop, even lighting.
```

### 3. Camera motion: waypoint pictures, not a camera verb

Describe the motion as a plain mechanical move, not a "shot". The default is
**the camera orbits, the product stays still**: every rotation in the
gallery's thirteen product-adjacent prompts is written as camera movement
(`360-degree orbit`, official case 42 — whose subject is a person, not a
product; `the camera slowly circles the build platform`, case 39; `smooth
spiral pull-out`, case 13) or as a hand turning the product (case 24) — none
writes a turntable with a fixed camera. The turntable stays as an
alternative because listing platforms and users ask for it by name.

**That gallery evidence is about which motion to pick. It says nothing about
how to write it, and how to write it turns out to decide whether the motion
happens at all.** This scenario's first two clips are a controlled pair on
exactly that: same seed (`642303335`), same model, same flags, the same prompt
text except the ORBIT paragraph. Full parameters and job ids: "Measured on
this scenario's own clips" above.

| | Clip A — rejected | Clip B — accepted |
|---|---|---|
| ORBIT written as | the camera's move: `the camera orbits the grinder a full 360 degrees at constant height and constant speed, ending back at the front view. The product does not move and does not rotate; only the camera travels.` | one continuous move with `no cut anywhere inside this segment`, then **four timestamped moments** — three interior views and the return — each describing what the frame contains at that point |
| What rendered | **no orbit at all** — from 6.0s to about 9.7s a near-static front view with a slight push-in, the crank arm pointing right in every frame. 3.7 of 12 seconds, the core segment of a catalog clip, delivered no new angle | **the camera moved, and the segment ended on the orientation it was told to end on.** Inside the segment the travel reads rear → side → front, about 180 degrees; whether it went further than that is unmeasurable — below. Two of the three interior views written appeared, unevenly spaced — see "4. A timestamp orders the pictures; it does not schedule them" |

**The camera moved and it arrived, and the product is its own protractor.**
The grinder's crank arm rises from the centre of the collar and bends once at
a right angle, so it extends horizontally in one direction: from the **front
or the rear** it reads as running cleanly sideways, mirrored between the two,
and from either **side** it points along the optical axis and disappears
behind the collar, leaving only the knob visible above it. The clip's front
view is fixed by the frame at 2.8s, at the end of REVEAL: knob at the left,
arm extending cleanly sideways.

The ORBIT segment is continuous from the hard cut at 6.291667s to about 10s,
and inside it the frames read:

| Time | What the frame shows | Where the camera is |
|---|---|---|
| 6.40 – 8.40s, **six sampled frames** | knob at the right, arm sideways | the rear |
| ~8.80 – 9.20s, the crossing | arm entirely hidden, only the knob visible above the collar — dead centre above it at 9.00, offset right at 8.80 and left at 9.20 | a side — the one axis crossing visible on screen |
| 9.60 – 10.00s | knob back at the left, arm sideways — the 2.8s orientation | the front |

Two claims and one limitation, and the limitation is the point:

1. **The segment ends on the opening orientation.** The return landed, and it
   was written as a named frame — `back on the exact front view of the
   opening shot` — not as a quantity of rotation. (The 11.5s frame inside
   ACCESSORIES still shows that orientation, but it sits past the 10.04s
   boundary, so it corroborates the orientation and says nothing about
   travel.)
2. **The observable travel is rear → side → front, roughly 180 degrees.**
3. **The total travel is not measurable at all.** The written path's other
   half — front to rear — could only have happened across the hard cut at
   6.291667s, and a camera's azimuth is unreadable across a cut. Worse here
   than usual: the shot before that cut is DETAIL's macro of the knurled
   ring, which is rotationally near-symmetric and therefore carries no
   orientation cue at all. The segment simply *starts* at the rear. Whether
   the camera travelled there or was cut there cannot be told from this clip.

**So this skill does not claim the orbit completed a circuit, and it did
claim that once.** Two earlier readings of these same frames were published
and both were wrong, in opposite directions — one measured from the moving
segment's own first frame and under-read the travel, the other measured
across the hard cut and over-read it. Neither pair of endpoints was connected
by continuous motion. The general rule that came out of it lives in
`Measuring a camera's travel: only inside one continuous shot` in
[`../ofox-video-core/references/prompt-structure.md`](../ofox-video-core/references/prompt-structure.md),
because it applies to checking any clip: **the honest form is "the move ends
where it was written to end; how far it travelled is unmeasurable here".**

**What this pair cannot tell you is which half of a waypoint's wording did the
work.** Each of clip B's waypoints carried two kinds of description at once: a
camera-position label ("level with the right side", "directly behind the
grinder") *and* an appearance description ("the crank arm running away from
the lens in sharp foreshortening", "only the smooth back of the brushed steel
collar and the walnut knob beyond it are visible"). On the 8s waypoint those
two contradict each other — from directly behind, that arm does not point away
from the lens, it extends sideways — so the prompt held neither kind constant.
The rendered arm-hidden frame at about 9.0s matches that waypoint's
**appearance** clause while contradicting its **position** clause, and
nothing in this run separates the two. Read every "the waypoint appeared" statement here as "that
picture appeared somewhere in the move", never as "the model obeyed the
position label".

**The claim that survives is the one worth having, and it is about movement
versus no movement rather than about degrees.** A waypoint written as a
picture produced real travel and a landing on the frame it named, where a
single sentence of camera motion produced no movement at all: **describe each
angle as a still picture with a timestamp on it — a camera verb is not
honoured.** Clip A is the negative control and clip B the positive one, one
variable apart, which is what makes the prompt the attributable cause rather
than the roll. It is still two runs.

**Reasoning from that confound rather than measuring it: write a waypoint as
an appearance description, not a camera-position label.** Say what is in shot,
what is hidden and what is foreshortened; leave out where the camera stands.
Two reasons, neither of them a measurement: the appearance clause is the half
the model has to produce pixels for, and — as the 8s waypoint shows — the
position label is the half that can quietly contradict it while you are still
writing the prompt. The one wording with evidence behind it is the return,
below, which named a frame the clip already contained.

Two more things come from the same pair:

- **The return worked, and it was written as neither a position label nor a
  degree count.** `by 10s the camera has returned to the exact front view of
  the opening shot` points at a frame the clip already contains, and the 10.0s
  frame is that frame. Write a return that way, and check it against the
  opening frame on the draft.
- **Clip A's negative clause held while its positive one failed.** The product
  genuinely did not rotate. `The product does not move and does not rotate` is
  worth keeping in every orbit — it just does not produce the camera's travel
  by itself.

**Clip B's other remaining defect: the orbit inherited DETAIL's macro
framing.** Independent of the pacing in section 4, and unaffected by it. No
shot size was written on any waypoint, so the segment stayed as close as the
macro push-in before it — the base and the knurled ring are out of frame for
the whole orbit, which gives several angles of the collar and the crank and
never the whole product from the side or the back. For a catalog clip that is
a partial loss of the very thing the segment exists for.

**And it cost more than framing: it made one waypoint physically
unrenderable.** The 7s waypoint asked for the knurled ring seen edge-on — and
the knurled ring is outside the frame for the entire orbit, so half of that
waypoint's content had nowhere to appear. An unspecified shot size does not
merely crop the picture; it can silently delete part of what a waypoint asks
for, and then the missing beat reads as the model ignoring the waypoint when
in fact the prompt had already made it impossible.

The fix is aimed at that observed cause and is **not yet run**: give every
waypoint its own shot size — "the whole product in frame, `<top>` to
`<bottom>`, with margin". It generalises past this segment: a segment
inherits the framing of the one before it unless told otherwise, and DETAIL
sits immediately before ORBIT in the recommended order.

The waypoint form, as a slot to fill:

```
One single continuous camera move, no cut anywhere inside this segment. The camera travels around the standing <product> anticlockwise at a constant height and a constant speed, the <product> centered in frame the whole way, and what the frame shows changes as it goes: at about <t1>s <what is in shot and what is not — "the <feature> runs the other way across the frame and the <other feature> is out of sight">; at about <t2>s <the same, for a view the first one could not see — "the <protruding part> is hidden behind the body and only its <tip> shows above the <collar>">; by <c>s the camera is back on the exact front view of the opening shot. At every one of those positions the whole <product> is in frame, <top> to <bottom>, with margin. The <product> itself does not move, does not rotate on its axis and does not tip — every change in the picture comes from the camera having travelled.
```

Each waypoint is an appearance clause and carries no camera position; the
timestamps are there to order them, not to schedule them. **Two interior
pictures plus the return, for a segment of about four seconds** — the budget
and the reason for it are in "4. A timestamp orders the pictures; it does not
schedule them" below.

The turntable alternative is unchanged and **untested here** — no gallery
prompt writes it and this repo has never run it:

```
The product rotates smoothly 360 degrees on its own axis at a constant speed, camera fixed and centered.
```

Whether the waypoint rule carries over to a rotating product — waypoints
describing **what the frame shows** as the product turns, rather than the
rotation as a verb and a degree count — is an untested inference from the pair
above, not a measurement: **a rotating product has never been run here at
all.** Worth noticing what the sentence above is made of, though. One motion
verb plus a degree count is the shape that produced no movement when the verb
belonged to the camera; whether it behaves the same way when the verb belongs
to the product is precisely what nobody here has measured. Say so if you write
it either way.

Use only orbit, push-in, macro pan and static from the shared file's `Camera
language`. Avoid `seedance-ad-creative`'s vocabulary (dolly-in with a speed
ramp, rack focus, rim light, moody backlight) — the point is to see the
product clearly from several angles, not to evoke a mood.

### 4. A timestamp orders the pictures; it does not schedule them

Same controlled pair as §3 — same seed, same flags, the ORBIT paragraph the
only difference, and the frame readings are up there. This is the half of that
run that is about *when*, and it has its own heading because it bites even
when everything in §3 went right: the pictures can all be honoured and the
timeline still not be the one you wrote.

Clip B's ORBIT ran 6–10s and was written as four evenly spaced moments: three
interior views at 7s, 8s and 9s, then the opening front view again by 10s.
What came back was neither evenly spaced nor as many views:

- **Three interior views were written; two rendered.** The frames hold the
  rear, one view with the arm hidden behind the collar, and the front again.
  One of the three written interior views never appeared as a distinct
  picture at all. And one of the three — which of the rendered pictures it
  corresponds to is exactly what the confound in §3 makes unattributable —
  was asking, in part, for a detail the inherited framing had already put
  outside the frame, so part of it could not have rendered wherever it
  landed (§3).
- **The move spends roughly half the segment on one view.** Sampled every 0.4s
  from 6.4s to 10.0s, **six** of the ten frames still show the crank pointing
  right — 6.40, 6.80, 7.20, 7.60, 8.00 and 8.40, with 8.80 the transition —
  so roughly 2 seconds near-stationary, and the rest of the move compressed
  into about 1.2 seconds.

Both of those are counts and durations rather than a per-waypoint schedule, on
purpose: which written waypoint each rendered frame corresponds to is the
confound described in §3, so "this waypoint was N seconds late" is not
something this run can support.

Two rules follow:

- **Do not plan a segment where a particular angle has to land on a particular
  second.** If a specific picture has to exist at a specific time — a cut, an
  overlay, a hand-off to another clip — make it a segment boundary, where
  timestamps have held to about a second across every run in this repo, not an
  interior waypoint.
- **Do not write more interior waypoints than the segment can absorb.** Two
  interior pictures plus the return is what a four-second orbit delivered
  against three asked for. More pictures do not buy more angles; they buy a
  beat that vanishes and a timeline nobody can check against.

Then check the draft by reading frames at the written stamps rather than
assuming them — the same discipline the cut check needs (`Checking the cuts:
read frames, never a detector count alone` in
[`../ofox-video-core/references/prompt-structure.md`](../ofox-video-core/references/prompt-structure.md)).

## Recommended defaults

| Parameter | Default | Why |
|---|---|---|
| `--model` | `bytedance/seedance-2.5` (script default, no flag needed) | current-generation model |
| `--duration` | `5` for the compact orbit; `10`–`15` for the segmented template | a full 360-degree orbit reads clearly in 5 seconds (official case 42 does it in 5s) and keeps cost low; three or four segments need 3–5s each; Seedance 2.5 accepts 4–30 |
| `--resolution` | `720p` | catalog/listing thumbnails rarely benefit from more; show `1080p` as a second row in the cost table when the target platform might require it |
| `--aspect-ratio` | settled by the brief's `Aspect` question (must-ask); `1:1` is the recommended option | e-commerce platforms vary: `1:1` fits most marketplace grids (Amazon, Etsy, Shopify), `4:3` matches older catalog templates, `9:16` suits mobile-first storefronts and TikTok Shop, `16:9` suits a website product-detail page. With a photo attached the flag is not sent — the photo is cropped or padded to the ratio instead, per `Two ways to attach the photo` above. On the text-only route the flag really does decide the frame: `16:9` in, exactly 1280x720 out, measured on this scenario's own clips |
| Motion | camera orbits, product still — **written as timestamped waypoint pictures**: two interior views plus a return to the opening frame, each carrying its own shot size | *Which* motion comes from the gallery: every rotation there is written as camera movement or as a hand turning the product, and none writes a fixed-camera turntable, which is also untested here. *How to write it* is measured rather than inferred, and the default would not survive without it: `the camera orbits ... a full 360 degrees` produced no orbit at all (job `1cf5ac46-058f-4615-a47b-067743f76f8c`), and the same prompt at the same seed with the angles written out as pictures produced a camera that moved and ended on the front view it named (job `50f623b2-c54a-4d9d-9646-31dd06e2a926`; about 180 degrees of it is observable and the total is unmeasurable — §3). Their **spacing** is another matter — three interior views were written and two rendered, unevenly spaced, so no angle should be planned to land on a given second. Write each one as an appearance description rather than a camera position, which is reasoning from that run's confound rather than a measurement. See "3. Camera motion: waypoint pictures, not a camera verb" and "4. A timestamp orders the pictures; it does not schedule them" |
| `--generate-audio` | `false` (this scenario's default) | a silent product clip needs no audio track; this **overrides** the server's `generate_audio: true` default, unlike `seedance-short-drama`/`seedance-ad-creative` which leave audio on. Verified against `ofox-video-core`'s script: `--generate-audio false` sets `generate_audio: false` directly on the request — and measured end to end on both of this scenario's clips, whose delivered files carry **no audio stream at all**, not a silent one. |
| `--real-person` | leave unset (`false`) | Seedance 2.5 image-to-video refuses photoreal people at submission; whether `true` lifts that on 2.5 is untested — prefer a photo of the product alone |

## Which upstream renders it

Jobs are pinned to the `byteplus` upstream (ByteDance's platform for markets
outside mainland China). Ofox otherwise picks between it and Volcengine Ark by
weight, and the two moderate differently, so pinning keeps results consistent.
Pass `--provider volcengine` for the mainland platform, or `--provider auto` to
let Ofox choose. Pricing is identical either way. See
`ofox-video-core/references/api-params.md` for the detail.

## Several shots: timestamps inside one job, `chain` across jobs

Two different tools, not alternatives.

**Cuts inside one job are written as timestamps** — the full template's
REVEAL → DETAIL → ORBIT → ACCESSORIES is one generation. Verified on Ofox on
2026-09-03: two three-shot prompts on `bytedance/seedance-2.5`, both pinned
to `byteplus`, 8s, 480p, 16:9, `--generate-audio false`, **pure
text-to-video with no image attached**. Both rendered all three shots with
hard cuts landing within about one second of the written timestamps — one in
the bare `0-3s: … Hard cut. 3-6s: …` form, one with a header manifest and
`SHOT N (a-bs)` + `HARD CUT`.

**Those two runs no longer set the ceiling, and the route this skill actually
uses has since been measured.** Two accepted `seedance-ad-creative` jobs at
720p attached a generated product image as `--frame-first-image` and cut
inside the same job: `7ae7d49e-7eb9-4165-9d95-09cd525d53ed` (15s, 5 shots, 4
hard cuts) and `ac927785-92ef-4e28-97b9-ff8172ec5554` (20s, 7 shots, 6 hard
cuts). Every written cut happened, and in both the attached frame held the
product's shape and colours across all of them — on the second, verified as
far as t=19.6s. So **the full template's four segments are inside the
measured envelope, image attached and all**; there is no need to fall back to
three, and no need to hedge about it in the recap. Still unmeasured: more
than 10 shots or 6 hard cuts in one job, 1080p, the `volcengine` upstream.
The record, including the reason a written `HARD CUT` can still soften, is in
the shared file's `Several shots in one job`.

**This scenario's own clips add the text-to-video half at 720p**: 12s, the
full template's four segments, all three boundaries written as `HARD CUT`, and
all three there on a frame-by-frame read — in **both** clips, though a scene
detector at threshold 0.25 saw only two of the three in each. The reverse
instruction was not contradicted in the accepted clip: `one single continuous
camera move with no cut anywhere inside this segment` produced no detected cut
inside the orbit, and the frames are consistent with that — but the same
detector pass missed a real boundary in the same clip, so read that as "not
contradicted" rather than "verified". Both in "Measured on this scenario's own
clips" above.

**`chain` carries the last frame of one job into the first frame of the
next**, then joins the clips into one file. Use it when the sequence exceeds
one job's 30s ceiling, or when each shot needs its own approval, seed or
resolution — a 5s orbit approved first, then a 5s detail push-in as a second
decision. Each shot is a separately billed job; the run estimates the total
before spending and reports real per-shot cost. The real-person restriction
that blocks chaining live-action sequences doesn't apply to objects, so
product footage chains freely.

```bash
bash ../ofox-video-core/references/ofox-video.sh chain \
  --shot "the product centered on a pure white surface and backdrop; the camera orbits it 360 degrees at constant height; the product does not move" \
  --shot "the camera pushes in to a macro of the same product's label, same white background, same light" \
  --duration 5 --resolution 720p --generate-audio false
```

## Before you spend: the approval gate

**Never submit a paid job until the user has seen a cost table and said yes.**
The rule, the table's required columns, where the numbers must come from, how
to itemise a batch and what to do when no estimate is possible are written
down once, for every Ofox skill in this repo:
[`../ofox-video-core/references/approval-gate.md`](../ofox-video-core/references/approval-gate.md).
Follow it rather than improvising; everything below is only what this scenario
adds to it.

Get the numbers from `--dry-run`, which validates everything and prints the
estimate **without sending a request**:

```bash
bash ../ofox-video-core/references/ofox-video.sh generate --dry-run \
  --prompt "..." --duration 15 --resolution 720p --out-dir ./out
```

Relay the `Estimated cost:` line it prints — never a number of your own — then
wait for a yes, then re-run the identical command with `--dry-run` removed.
The estimate a *real* run prints comes microseconds before the request goes
out, too late to relay; that is what `--dry-run` is for.

The brief recap (see the creative brief section) goes in the **same
message** as the prompt and the table, above them — the user approves the
choices, the prompt and the price together.

What this scenario's table usually needs a row for: the clip itself, at the
duration and resolution you settled on — plus one row per shot when a
`chain` sequence is planned, since each shot is a separately billed job.
When the choice between a 720p draft and a 1080p deliverable is still open,
dry-run both and show two rows.

Afterwards the **actual** bill is `VIDEO_COST` from the finished job, read
from `usage.video_cost`. Report it as money (`$3.60`), not as the raw
ten-decimal string. An estimate is never a bill.

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
files.

**Quote `BATCH_COST_TOTAL`, not `BATCH_COST_PER_TAKE`**, and give the takes a
row each — the approval gate wants the itemised shape, not just the sum. If
one take in four is usable, that clip cost the whole total; the per-take
figure understates it by 4x.

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

**The seed reproduces a take only while the prompt is byte-identical.**
Measured on this scenario's own pair: both clips ran seed `642303335` and the
grinder is visibly a different design in each — a wide steel collar on a short
body in one, a narrow collar on a longer body with the crank pointing the
other way in the other. One paragraph of prompt text changed and the product's
appearance moved with it. So "that take was good, give it to me at 1080p" is
still the seed's job; "that take was good, let me tweak one line and keep the
look" is not something the seed can do.

Worth offering when the user is exploring: draft cheap on
`bytedance/seedance-2.0-mini` at 480p, then render the winner on
`bytedance/seedance-2.5`. Four 8-second drafts cost about 64 cents on mini versus
$7.68 on 2.5 at 720p. But **don't switch models on their behalf** — a
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

A broken link to a shared reference has the same single cause. This skill
packages only its `SKILL.md` and `CHANGELOG.md`, so `prompt-structure.md`,
`creative-brief.md`, `approval-gate.md` and `api-params.md` — all shipped by
`ofox-video-core` — are absent whenever the script is, and return with the
same command. The skill remains usable without them: the prompt templates,
the brief's question table and the defaults are written out in this file. What
is unavailable is the depth behind the rules they reference — the full camera
and consistency vocabulary, the general question-flow rules, and the exact
wording of the spend gate, which applies regardless.

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
it — so name the file after the scene rather than leaving the script to guess
from the prompt's opening words, which describe the setting and the lighting.
The clip lands as `<name>-<short job id>.mp4` with a `.json` sidecar beside
it holding the full job id, the prompt and the real cost.

## Running the script

Paths in the examples above are written relative to **this skill's own
directory** (`skills/<this-skill>/`), which is where `../ofox-video-core/...`
resolves from. If you are running from somewhere else, adjust accordingly —
from the repo root it is `skills/ofox-video-core/references/ofox-video.sh`.

## Generating

With a product photo (the common case — prefer a local file path over a
remote URL when one is available; the photo already cropped or padded to the
platform's ratio):

```bash
bash ../ofox-video-core/references/ofox-video.sh generate \
  --prompt "<the product-video prompt built above>" \
  --name "<short product name, e.g. sneaker orbit>" \
  --frame-first-image "<local path or URL to the product photo>" \
  --duration 5 \
  --resolution 720p \
  --generate-audio false
```

No `--aspect-ratio` flag here on purpose — with an image attached the
default model forces `adaptive` anyway (see `Two ways to attach the photo`).
Without a product photo (category prototype or fictional brand) the flag does
take effect, and is set to the platform ratio the brief settled:

```bash
bash ../ofox-video-core/references/ofox-video.sh generate \
  --prompt "<the product-video prompt built above>" \
  --duration 5 \
  --resolution 720p \
  --aspect-ratio 1:1 \
  --generate-audio false
```

This one call validates the parameters, submits the job, polls to
completion, downloads the mp4, and prints `STATUS`, `JOB_ID`, `VIDEO_PATH`,
`VIDEO_SECONDS`, and `VIDEO_COST`. Report the **actual** values from that
output to the user — never the estimate, and never a path/cost you didn't
see the script print. Always state the printed `VIDEO_PATH` as its own
standalone absolute-path line in your reply, per `ofox-video-core`'s
reporting requirement. Do not re-implement any of the request/poll/download
logic here; always call into `ofox-video.sh`.

## Common failure modes and fixes

These are `ofox-video-core`'s documented exit codes and error codes
(full table: [`../ofox-video-core/references/api-params.md`](../ofox-video-core/references/api-params.md)),
plus the product-video-specific ones:

| Symptom | Cause | Fix |
|---|---|---|
| Exit `1`, no network call made | Bad `--duration`/`--resolution`/`--aspect-ratio`, or missing `--prompt` | Fix the flag per the error message and re-run `generate` — free to retry, nothing was submitted |
| Exit `1`, `references_conflict` | `--frame-first-image` and an `input_references` array in `--extra-json` in the same job | Pick one meaning — first frame, or identity references — and drop the other |
| Exit `2` | `curl`/`jq` missing, or `OFOX_API_KEY` not set | Re-run `ofox-video-core`'s `check` and follow its install/signup guidance |
| Exit `3`, `error.code: insufficient_credits` | Ofox balance too low | No charge was made; the user needs to add credits at `https://app.ofox.ai` before retrying |
| Exit `3`, `error.code: input_moderation_failed` on an image-to-video job | The reference photo contains a photoreal person (a hand, a model) — refused at submission on Seedance 2.5, nothing billed | Use a photo of the product alone, or crop the person out; `--real-person true` is untested on 2.5 |
| Exit `3`, job ends `failed`, or `invalid_request` on create, with no other error code hint | Likely a moderation rejection: a reference photo showing someone else's trademarked packaging/logo without rights, or a prohibited product category, is commonly rejected | Remove or crop the flagged trademark/brand element from the reference photo or prompt, then call `generate` again — this is a **new** request, not a resubmission of the failed one, so it's safe to retry immediately |
| Exit `3`, job ends `failed`, `error.code: output_moderation_failed` | The generated **output** failed a post-generation content check — happens after the job ran, not at submission. Not billed (no `usage` field on the response) | Retry with a brand-new `generate` call using a different prompt or reference photo — a new request, not a resubmission of the failed one, so it's safe |
| `bad_data_uri` / `download_failed` / `unreachable` / `not_image` / `too_large` | `api-params.md` documents these as `real_person: true` image-validation failures, raised when Ofox fetches the reference image: it isn't a small, valid image the API can use (a remote URL that isn't publicly reachable, or a local file that failed to read/encode) | Prefer a local file (auto-base64'd, more reliable than some remote URLs — see above); confirm it's a real image file under the size limit and retry |
| Product shape, printed text, or logo looks distorted or inaccurate in the result | Pure text-to-video was used for a real SKU instead of a real reference photo | Switch to image-to-video with `--frame-first-image` pointing at the real product photo — for a real SKU the photo is required, not preferred (see the photo section); for a category prototype, tighten the PRODUCT block instead |
| Background isn't plain, or shows props/shadows from the original photo | The prompt didn't state the background explicitly, or the source photo's busy background carried through | Add the SCENE line verbatim ("pure white surface and backdrop, no props, no shadows on the backdrop"); a reference photo with a cluttered background can still bleed through in image-to-video since the model anchors on that image |
| The output is the photo's shape, not the platform's ratio | The photo was attached without being cropped or padded first; `adaptive` follows the image | Crop or pad the photo to the brief's ratio and generate again — a new job, billed again, which is why `Aspect` is asked before generating |
| The ORBIT segment renders as a near-static front view — no new angle at all | The segment named the camera's move (`the camera orbits the product a full 360 degrees ...`) instead of picturing the frame at each angle. Measured on job `1cf5ac46-058f-4615-a47b-067743f76f8c`, where 3.7 of 12 seconds delivered nothing new | Rewrite ORBIT as timestamped waypoints — what the frame contains at two interior views, written as appearance rather than as camera positions, then "back on the exact front view of the opening shot". The same prompt at the same seed, written that way, moved and returned to the front view it named (job `50f623b2-c54a-4d9d-9646-31dd06e2a926`; how far it travelled is unmeasurable there, and that is stated in §3). New prompt, so a new cost table — see "3. Camera motion: waypoint pictures, not a camera verb" |
| The orbit travels, but the product's base or top is out of frame the whole way | No shot size was written on the waypoints, so the segment inherited the framing of the macro DETAIL segment before it. Observed on job `50f623b2-c54a-4d9d-9646-31dd06e2a926` | Give every waypoint its own shot size ("the whole product in frame, top to base, with margin"). Aimed at the observed cause and not yet re-run. New prompt, new cost table |
| The orbit moves and arrives, but one written angle never shows up, or the views are bunched instead of evenly spaced | Expected: the pictures are honoured, their spacing is not. On job `50f623b2-c54a-4d9d-9646-31dd06e2a926` three interior views were written and two rendered, and the move held one of them for roughly 2 of its 4 seconds | Nothing to fix in a delivered clip — plan for it instead: two interior pictures plus the return for a four-second orbit, no angle required to land on a given second, and read the frames rather than assuming the stamps. See "4. A timestamp orders the pictures; it does not schedule them" |
| The clip did not cut where the timestamps said, or ran the four segments as fewer | Four segments are inside the measured envelope, so the usual cause is not the count — a timeline weighted toward named continuous transitions can soften a written `HARD CUT` too | Keep the boundaries as hard cuts (this scenario has no reason to write in-camera transitions), then re-check the draft by reading frames rather than a scene detector's count — see `Checking the cuts` in the shared file |
| A scene detector reports fewer cuts than were written, and the clip looks right | Not a defect: detection cannot see a cut between two shots of the same subject under unchanging light, which is every cut in a studio product clip. This scenario's own clips are the fifth and sixth confirmations in this repo — **both** of them hid their third boundary at threshold 0.25 while the earlier ones were found in the same pass, and the two needed *different* lower thresholds to appear (0.05 at 9.750s in clip A, 0.10 at 10.041667s in clip B), so no single threshold is the fix | Read the frames either side of every written stamp instead of trusting the count — `Checking the cuts: read frames, never a detector count alone` in the shared file |
| Exit `4`, timed out waiting for completion | Job is still running upstream, not failed | Do **not** re-run `generate`; run `bash ../ofox-video-core/references/ofox-video.sh poll JOB_ID` using the job id printed before the timeout |
| Exit `5`, ambiguous network failure on create | No HTTP response received at all — can't tell if a job was created | Do not guess or retry `generate`; tell the user to check `https://app.ofox.ai` for a job that may already be running, per `ofox-video-core`'s no-resubmit rule |
| Exit `6`, `--out-dir` could not be created or entered | Local filesystem problem (bad path, permissions), not an API problem | The job itself is unaffected — do not re-run `generate`; fix `--out-dir` and re-run `bash ../ofox-video-core/references/ofox-video.sh poll JOB_ID --out-dir <a writable directory>` |

## When NOT to use

- Cinematic brand/mood advertising — dramatic lighting, camera language like
  dolly-ins or rim light, a brand-tone background — use `seedance-ad-creative`
  instead. This skill's prompts are deliberately plain (plain background,
  a simple orbiting camera or turntable) for literal catalog accuracy, not
  brand storytelling. The border case is a clean studio showcase with a
  lid-opening reveal (gallery case 17): the test is whether there is a brand
  narrative or an emotional tone to carry. A listing that just needs to show
  the item is this skill; a reveal that sells a feeling is the other one.
- Anything involving people, characters, or dialogue — use
  `seedance-short-drama` instead; this skill is for inanimate product objects
  only.
