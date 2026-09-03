---
name: seedance-ad-creative
description: Generate a cinematic brand/product ad clip from a product description or photo using the Ofox video API (Seedance 2.5) — runs a short creative brief (product photo, brand tone, camera move, aspect ratio) when the request leaves them open, writes a timestamped shot-craft prompt (hook, showcase, slow-motion climax, hero close), shows a cost estimate, then calls ofox-video-core to submit, poll, download, and report the real cost. Use when a user asks for a commercial-style product or brand video, e.g. "give this perfume bottle a 10-second cinematic brand ad", "make a product ad for our new sneaker", "turn this product photo into a hero video for the landing page", or "I need a 15-second brand video with a slow orbit around the bottle". Do not use for dialogue-driven scenes with people talking (see seedance-short-drama).
license: MIT
version: "1.8.0"
homepage: https://github.com/ofoxai/skills/tree/main/skills/seedance-ad-creative
metadata:
  author: ofoxai
  version: "1.8.0"
  openclaw:
    requires:
      env: [OFOX_API_KEY]
      bins: [curl, jq]
    primaryEnv: OFOX_API_KEY
    envVars:
      - name: OFOX_API_KEY
        required: true
        description: Ofox API key. Create one at https://app.ofox.ai (Settings -> API Keys). The same key works across every Ofox skill.
    emoji: "📺"
    homepage: https://github.com/ofoxai/skills/tree/main/skills/seedance-ad-creative
---

# seedance-ad-creative: cinematic product/brand ad clips

Turns a product description (or a product photo) into a commercial-style
video clip: camera language, product framing, and brand tone become a
Seedance 2.5 prompt, which this skill submits, polls, downloads, and reports
the cost for.

This skill is a thin, scenario-specific layer over
[`ofox-video-core`](../ofox-video-core/SKILL.md). It owns the ad-creative
prompt craft, the creative brief, recommended defaults, and the
pre-generation cost estimate; `ofox-video-core` owns talking to the Ofox API
correctly and safely (the `OFOX_API_KEY` handling, the no-resubmit rule,
error-code mapping, download/verification). **Read that skill's safety
contract before using this one** — it is not restated here.

The prompt structure shared by every Seedance scenario skill — the vendor's
formula, timestamp formats and segment lengths, transition and camera
vocabulary, consistency locks and negative lists, the two meanings of an
attached image — lives in
[`../ofox-video-core/references/prompt-structure.md`](../ofox-video-core/references/prompt-structure.md).
Load it before writing a prompt. This file only adds what is specific to
ads.

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
This section adds only what is specific to ads.

The brief is what turns "make an ad for this bottle" into choices the user
actually made instead of choices made for them in silence. Zero questions is
common here: "15-second vertical TikTok ad for this sneaker photo, young and
energetic, slow orbit" has settled every axis.

| Tier | Ad-creative axes |
|---|---|
| **must-ask** | is there a product photo? Ask this **first** — the answer changes the whole prompt route, and every gallery ad that had to match a real product, logo or person locked it to an image (cases 12, 13, 15, 24). |
| **ask-if-open** | brand tone, the hero camera move, aspect ratio |
| **never-ask** | resolution, model, provider, audio on/off, duration when the user gave one. 720p preview vs 1080p deliverable is **two rows in the cost table**, not a question. |

If four slots are not enough: `Photo` first, then the axis that changes the
picture most (`Tone`), then `Camera`, then `Aspect`; anything left falls to a
default and the cost table.

**The product-photo question has no "Let the AI decide" option.** A photo
that does not exist cannot be invented, and "you decide" from the user
delegates the taste axes only — it never answers this one.

### The ad-creative question set

| # | Tier | `header` | Question | Options (1 = recommended, last = delegation) | Ask when |
|---|---|---|---|---|---|
| 1 | must-ask | `Photo` | Do you have a photo or render of the product? With one, label text and shape stay faithful. | **Yes — I'll give a local path (recommended)**: the real product is rendered from the image; the gallery's product, logo and packaging shots all lock to one (cases 12, 13, 24). / **No — describe it in text**: fine for a generic or fictional product; on a real SKU the label and logo may drift. The gallery's text-only ads all stay on generic categories — a bowl of ramen (case 14), juice bottles and produce (case 27), gym gear (case 25) — and its text-only product prompts (cases 16, 17, 19) are all fictional brands. **No AI option.** | No image attached and the user did not say "no photo". |
| 2 | ask-if-open | `Tone` | Brand tone — it sets the palette, the pace and the light. | Put the archetype that fits the product category first, marked `(recommended)`: perfume / watch / jewellery → **Luxury** — slow, dark background, warm gold highlights (cases 13, 15). snack / drink / sneaker → **Playful/consumer** — bright, saturated, cuts on the beat (cases 12, 14). headphones / gadget / app → **Minimalist-tech** — white or grey, cool light, steady precise camera. Then the other two. Then **Let the AI decide** — "I'll use the recommended archetype and mark it (AI's pick)". | No tone word in the request. |
| 3 | ask-if-open | `Camera` | The camera move for the hero segment. | **Slow 30-degree orbit (recommended)**: the whole product in one move; the orbit is the gallery's most reused rotation (cases 13, 15; official case 42 does a full 360 in 5s). The 30 degrees is this skill's convention, not a gallery figure. / **Travelling move — the camera goes somewhere and the move *is* the transition**: it plunges down through the gears, passes into a spinning brass box, spirals out to a wide (case 13, all three in one 30s piece, which never cuts); pick this when the product sits in a world worth crossing rather than on a table. / **Slow push-in, shallow depth of field**: one detail fills the frame (cases 19, 24) — with a rack focus as its variant when there is a background worth showing sharp first, then snapping off (the phrasing is in the shared file's `Camera language`; its examples, cases 7 and 26, are not ads). / **Let the AI decide**. | No camera word in the request. |
| 4 | ask-if-open | `Aspect` | Where will it run? That fixes the frame shape. | **16:9 hero (recommended)**: website, YouTube, landing page — this skill's default. / **9:16 vertical**: TikTok, Reels, Shorts. / **1:1 square**: feed placements. / **Let the AI decide**. When a product photo is attached the output ratio follows the image (`adaptive`), so each description must add "= I crop or pad the photo to this ratio before generating". | No platform or ratio in the request. |

Not asked: 720p vs 1080p (two rows in the cost table); duration — take the
user's number, and if there is none use the default and say in the recap
that every gallery ad with a stated length runs 20–30s (see Recommended
defaults);
model, provider, the audio flag.

### Skip rows specific to ad-creative

On top of the generic rows in `creative-brief.md`:

| Input says… | Axis | Value |
|---|---|---|
| a product photo is attached, or a path is given | Photo | have one → image-to-video; do not ask whether there is one |
| luxury, premium, high-end, elegant, "expensive-looking" | Tone | Luxury |
| young, fun, energetic, playful, bold | Tone | Playful/consumer |
| minimal, clean, tech, precise, "no clutter" | Tone | Minimalist-tech |
| "orbit", "circle around", "move around it" | Camera | slow orbit |
| "push in", "get closer", "zoom in on the detail" | Camera | slow push-in |
| "reveal", "come into focus" | Camera | rack-focus reveal |
| "spin", "turn", "360", "white background", "for my listing" | scope | that is `seedance-product-video`'s job — see When NOT to use |

### From answers to prompt — traceability

Every answer has to be findable in the prompt or the flags.

| Answer | Lands in |
|---|---|
| Photo: yes, path | `--frame-first-image PATH`, and the anchor sentence at the top of the prompt (`Begin with the exact composition of the reference image …`) |
| Photo: no | a text-only PRODUCT block; `--aspect-ratio` becomes effective |
| Tone | the STYLE and COLOR PALETTE lines of the header, the music line in AUDIO, and the segment pacing (Luxury: 5s segments, slow moves; Playful: 3s segments, cuts on the beat) |
| Camera | the SHOWCASE segment's camera sentence in Template A |
| Aspect | `--aspect-ratio` on text-to-video; the crop/pad step on the photo before image-to-video |
| Duration | `--duration`, and the timestamps in the timeline |

### The recap for this scenario

```
Brief:
- Photo: /Users/me/ads/bottle.jpg (given)
- Tone: Luxury (you chose)
- Camera: slow 30-degree orbit (AI's pick)
- Aspect: 9:16 (inferred from "Reels") — I will pad the photo to 9:16 first
- Duration / resolution: 15s / 720p preview and 1080p deliverable — two rows below
```

Then the full prompt, then the cost table, all in one message — the order and
the rule for a change made at the gate are in `creative-brief.md`'s `Order,
with the approval gate`.

## Prompt template

Vocabulary is not repeated here. Timestamp formats and segment lengths:
`Segmenting the timeline`; cut and continuous-shot phrasing: `Transitions`
and `Several shots in one job`; shot sizes and moves: `Camera language`;
slow motion, speed ramps and cuts on the beat: `Pacing`; the closing
blocks: `Consistency locks and the negative list`; asset role sentences:
`Reference assets as visual anchors` — all headings in
`../ofox-video-core/references/prompt-structure.md`. What follows is the
ad-specific shape.

All nine gallery ad and UGC prompts (cases 12–15, 23–27) share one skeleton:
a style or format declaration first — or the asset anchor, when an image is
attached — then a multi-beat body and a stated closing action. Seven of the
nine end on a technical tail, and six carry a negative list (cases 14, 15,
23, 24, 25, 26). The cinematic ones pace as
**hook → showcase → physical-event climax in slow motion → hero freeze**
(cases 12, 14, 15); the UGC ones as a flat action chain that ends
"naturally, not promotionally" (cases 24–27).

### Template A — cinematic ad, 15–30s

Segments run 3–5s (cases 15, 25, 26, 27); the one official 30s piece with
10s segments (case 13) never cuts. Slots are in `<angle brackets>`; optional
lines in `[square brackets]`. Pick one header labelling style and keep it.

**The five beats below are a floor, not a ceiling.** Counted per case: the
gallery's ads run 5 shots in 20s (case 15, 4s each) up to 9 `CUT`s in one
generation (case 14), and case 26 runs seven segments in 30s — so a 30s spot
written as five 6-second beats is the slowest ad in the set. Split a beat into
two shots rather than holding one for six seconds; the per-case counts are in
"Shot density, measured per case" in the shared file. Against that, the
Ofox-verified envelope is three shots in eight seconds (see "Several shots:
timestamps inside one job, `chain` across jobs" below), so any count above
three cuts is gallery practice and a first attempt at it is an experiment.

```
[FORMAT: <N> seconds, <16:9 | 9:16 | 1:1>, hard cuts on the timestamps.]            — optional; must match the flags
STYLE: <ad category> commercial, <capture anchor: 8K photoreal studio | 35mm film grain | glossy high-speed>, <tone: luxury — slow, dark, warm gold | playful — bright, saturated, fast | minimalist-tech — white or grey, cool, steady>.
COLOR PALETTE: <dominant>, <the product's warm or cool accent>, <contrast colour>, <metallic accent>.                        (case 14)
[CHARACTER: <one block — age range, build, hair, wardrobe item by item with colours, one signature accessory>. Referred to below as "<tag>".]   (case 14; text only — see the real-person note below)
PRODUCT: <shape> <material and finish> <colour> <product name>, <label text in quotes, verbatim>, <contents or accessories item by item>.
         [image1 provides the product exactly — <shape, label, cap, colour>; ignore its background.]                     (cases 12, 24)
SCENE: <backdrop>, <one or two props framing the shot>, <light: saturated studio key with a warm rim | golden hour | single hard key>.

0–<3–5>s    HOOK — <one visual focus: a macro of one ingredient | the cap | the clock face>; <one strong move: the music downbeat hits as we cut in | low-angle dolly-in | a white flash freezes the frame | layers unfold>.   (cases 12, 13, 15, 14)
<TRANSITION between any two beats — name a kind; a hard cut is one of nine and an unnamed boundary becomes one: HARD CUT on the downbeat. | The camera plunges through <the gears / the pour / the open lid> into the next beat. (case 13) | <The product / the blade / a hand> sweeps past the lens and the camera comes out of the occlusion on <the next arrangement>. (the phrasing is cases 2, 8, 41, none of them ads) | A white flash freezes the frame, then <the next pose>. (case 15) | An extreme speed ramp carries <the event> into <the next beat>. (case 15) | Without cutting, <the array reassembles in frame>.>
<>–<>s      SHOWCASE — <arrangement: a strict geometric array of the variants | <tag> holds the product toward the lens, steam rising | the camera orbits the product 30 degrees>; cut to close-ups of <two or three details>.   (cases 12, 14, 24)
<>–<>s      CLIMAX — <one physical event: the biscuit snaps | the broth erupts | the blade sweeps past the lens>; drops into slow motion for one second — <micro-detail: the filling bursts, crumbs fly, droplets hang> — then back to speed.   (cases 12, 14, 15)
[<>–<>s     VARIATION — back at full tempo, <a second arrangement>.]                                                        (case 12)
<>–<N>s     CLOSE — product hero frame, <centered | in slow motion>; [the slogan "<text>" enters word by word on the beat;] [the logo per image2 in the last second;] hold the final frame.   (cases 12, 13, 14, 15)

CAMERA: handheld energy and high-speed slow motion on the <climax>; smooth static holds on the <showcase>; cinematic shallow depth of field throughout.   (case 14)
AUDIO: <upbeat | cinematic | minimal> instrumental; percussion hits synced to <the climax event>; SFX: <snap | pour | sizzle>; no dialogue. [One playful vocal ad-lib on the last shot.]   (cases 12, 14)
CONSISTENCY: the product's shape, label, colours and proportions stay identical in every shot[; <tag>'s face, hair and wardrobe do not change].   (cases 24, 15)
AVOID: dialogue, subtitles, on-screen text other than the slogan card, watermarks, jitter, identity drift, wardrobe change, warped hands, extra limbs.   (cases 15, 24, 14)
```

Notes on the slots:

- **Anchor sentences when an image is attached** — put them first, before
  STYLE (cases 15, 24 both open on the asset):
  `Begin with the exact composition of the reference image.` (case 15, a
  `--frame-first-image` job) ·
  `Preserve the product exactly as in @image1 throughout — frame shape,
  lenses, hinges, colours, materials, proportions.` (adapted from case 24) ·
  one role line per asset, `image1: product appearance. image2: logo, last
  second only.` (cases 12, 13). Sentence patterns and the `@image1` caveat:
  `Reference assets as visual anchors`.
- **Several pieces or an unboxing** (case 24): name every piece and lock each
  — `Use the uploaded sunglasses, retail box and leather case as locked
  product references` — then run the showcase as a chain: box opens → case →
  product lifted → rotated to show hinges and lenses → worn, turned to
  catch the light → held beside the face → push in on the product, fade.
- **A person interacting with the product** (case 14): one CHARACTER block,
  then the tag in every segment (`the model holds the bowl toward the lens
  with both hands, steam rising`). **Describe the person in text** — a
  reference frame containing a photoreal person is refused at submission
  (see `If the user has an actual product photo` below). Gallery cases 15
  and 24 attached real-person images on other platforms; do not read them as
  Ofox behaviour.
- **Slot pacing by tone**: Luxury runs 5s segments and slow moves (case 13);
  Playful runs 3s segments and cuts on the downbeat (cases 12, 14).
- **Four or five beats is one or two beyond what has been verified here.**
  Cuts inside one job were tested on Ofox at three shots in an 8-second clip
  (see Several shots below); the gallery's five-to-nine-shot ads ran on
  unrecorded platforms. Say so in the recap when the timeline has more than
  three cuts, and drop VARIATION first if the cut count matters more than the
  beat.

### Template B — 10 seconds or less, three beats

Inferred from the 15–30s cases; **the gallery has no ad prompt of 10s or
less** (the shortest stated length is 20s, cases 15 and 27). No header
manifest — the vendor's formula order, subject and action first (shared
file, `The vendor's own formula (ByteDance first-party)`).

```
<Product> <one action or event> on <backdrop>; <tone archetype>, <capture anchor>. [image1 provides the product exactly.]
0–3s: <a macro of one detail>; the music downbeat hits as we cut in.
3–7s: <the physical event> in slow motion — <micro-detail>; rim light along the edge.
7–10s: product hero frame, centered; [the slogan "<text>" | the logo per image2 in the last second;] hold the final frame.
<light line>. <palette line>. Music on the beat; no dialogue. No subtitles, no watermarks, no jitter.
```

### Worked example — adapted from case 12 (translated), timestamps added

The official fruit-biscuit ad, moved from its prose-ordered original into
Template A at 20 seconds. The original reads the strawberry variant from an
attached image and takes composition, motion and impact from six reference
clips; Ofox allows one video reference, so this version keeps only the
image. Word choice is ours; the beat order, the snap-in-slow-motion climax,
the word-by-word slogan and the scatter ending are the original's.

```
FORMAT: 20 seconds, 16:9, hard cuts on the timestamps.
STYLE: bright, multicoloured snack commercial; clean, premium, strongly rhythmic; glossy high-speed capture.
COLOR PALETTE: strawberry red, mango yellow, blueberry violet and kiwi green on white; gold foil accents.
PRODUCT: rectangular fruit-filled biscuits in four flavours, each beside its fruit; image1 provides the strawberry variant's exact packaging and filling colour.
SCENE: white seamless backdrop, the fruit as the only props, saturated studio key light with a warm rim.

0–3s    HOOK — a single strawberry fills the frame in macro; the music downbeat hits as we cut in.
3–9s    SHOWCASE — the four biscuits and their fruits in a strict geometric array, orderly and bright; cut to a close-up of each variant.
9–13s   CLIMAX — one biscuit snaps; the instant drops into slow motion, the fruit filling bursts open and crumbs fly; back to speed.
13–16s  VARIATION — full tempo again, the biscuits in a horizontal row.
16–20s  CLOSE — the words "One bite of crispness, a heart full of delight" enter word by word on the beat; product freeze frame, centered; biscuits and fruit scatter outward.

CAMERA: handheld energy on the snap, smooth static holds on the arrays, shallow depth of field throughout.
AUDIO: upbeat instrumental; the downbeat lands on the cut-in and on the snap; SFX: a crisp snap; no dialogue.
CONSISTENCY: packaging colours, biscuit shape and filling colour identical in every shot.
AVOID: dialogue, subtitles, on-screen text other than the slogan, watermarks, jitter.
```

### UGC variant

Five of the nine gallery ad prompts are creator-style clips (cases 23–27).
This skill's `description` does not claim them, but the request "make it
look like a real customer filmed it" lands here often enough that the slot
differences are worth having. The boundary is what carries the clip: a
creator holding, using and describing the product stays here; a scene
carried by the performance and the exchange between people is
`seedance-short-drama`, per this skill's `description`. Same skeleton as
Template A; these slots change:

| Slot | Template A (cinematic) | UGC variant | Cases |
|---|---|---|---|
| STYLE | commercial + studio anchor | `realistic UGC-style … filmed on a smartphone`, `handheld`, `authentic, imperfect, no polished commercial look` | 24, 25, 27 |
| Device line (new) | — | where the phone is (`selfie mode` · `propped on a gym bench, slightly low angle` · `handheld`) plus its flaws: `autofocus hunting, exposure shifts, compression artifacts, mild sharpening` | 25, 27 |
| Anchors | product image | a person image **and** each product piece, locked item by item — real-person frames are refused on Seedance 2.5 image-to-video, so on Ofox this is a text-described person | 24 |
| HOOK | macro + downbeat | the person enters the scene, or the first line to camera | 24, 27 |
| CLIMAX | physical event in slow motion | none — a flat action chain (unbox → turn → try on → catch the light) | 24 |
| Dialogue | none | one quoted line per beat (a review), or a single closing line that is `spontaneous, slightly breathless, not scripted` | 24, 25 |
| AUDIO | music + SFX on the beat | an ambience list (`natural gym ambience only`, eight sounds named); no music or low music | 25, 26 |
| CLOSE | hero freeze + slogan | `holds them beside her face` + push in + fade · walks out of frame while `the camera continues recording for a moment` · `not promotional` | 24, 25, 26 |
| AVOID | text, jitter, drift | adds `cinematic color grading, beauty filters, artificial skin smoothing, dramatic slow motion, music, perfect lighting` — the opposite of this skill's default look | 25 |
| Aspect | 16:9 | 9:16 appears (case 27); 16:9 also (cases 24–26) | 27 |

## Writing a good ad-creative prompt

### Where the product goes

Earlier versions of this skill said: product first, then camera, then mood.
The gallery does not support that order. All nine ad and UGC prompts open
with a style or format declaration — or, when a reference image is attached,
with the asset's anchor sentence, as cases 15 and 24 do — and place the
product second or third (case 14 runs `Style:` → `Character:` → `Subject:` →
`Setting:`). There is
no A/B evidence that either order renders the product better; there is
simply no collected prompt that leads with the product. So:

- **15s and longer**: header manifest — FORMAT → STYLE / COLOR PALETTE →
  CHARACTER (if any) → PRODUCT → SCENE → timeline → CAMERA → AUDIO →
  CONSISTENCY / AVOID. Template A above; the shared file's `Prompt skeleton:
  header manifest, timeline, closing block`.
- **10s and shorter**: the vendor's formula order — subject and action first,
  then scene, style, camera, sound, in two to four sentences and no
  manifest. Template B above; the shared file's `The vendor's own formula
  (ByteDance first-party)`.

### 1. The product, described precisely

Shape, material, colour, finish, and any text on it verbatim in quotes.
Finish drives how light behaves on the surface (glass, brushed metal, matte
plastic), so name it (case 14's `Subject:` lists five ingredients; case 17
names the accent colour and every accessory).

```
A tall clear glass perfume bottle with a gold cap, "NOCTURNE" embossed on the front, centered on a reflective black surface.
```

### 2. Camera as a real shot, with a speed

Concrete cinematography terms steer the model; "make it look cool" does not.
The full vocabulary is in the shared file's `Camera language`; the moves ads
reuse most are the **30-degree orbit**, the **slow push-in with shallow
depth of field**, the **rack focus from background to product** and the
**pull-back reveal** (cases 13, 15, 19, 24, 26). Ads also carry a speed
dimension the other scenarios rarely use — **slow-motion insert**, **speed
ramp**, **freeze**, **static hold**, **cut on the beat** — in the shared
file's `Pacing` (cases 12, 14, 15).

```
The camera orbits the bottle 30 degrees; soft rim light along the glass edge; shallow depth of field, the background gently blurred. The cap turn drops into slow motion for one second.
```

### 3. Brand tone, as an archetype plus a palette line

One archetype word steers grade and pacing more reliably than a paragraph of
adjectives; a `Color palette:` line (case 14) pins the colours it implies.

- **Luxury**: slow movement, dark or moody background, warm gold highlights,
  5s segments (cases 13, 15).
- **Playful/consumer**: bright saturated colours, faster movement, cuts on
  the beat, 3s segments (cases 12, 14).
- **Minimalist/tech**: clean white or grey background, precise steady camera,
  cool light.

The negative list is where you name the tone you are *not* making — a Luxury
prompt excludes `cartoonish, oversaturated`; a UGC prompt excludes
`cinematic color grading` (case 25).

### 4. No dialogue — but a sound block

Cinematic ad clips carry no speech (cases 12, 13, 15; case 14 allows one
vocal ad-lib), so say `no dialogue` to steer away from voice generation. Do
not stop there: the collected ads write an AUDIO line — the music's
character, percussion hits synced to the climax event, and the SFX that
event makes (case 14). Shape and phrases: the shared file's `Dialogue and
sound`.

### If the user has an actual product photo

Prefer image-to-video over describing the product purely in text. The
evidence is the gallery's split rather than a measured comparison: every
collected prompt that had to match a real product, logo or package attached
an image (cases 12, 13, 24, 29), while the text-only ones avoid readable
text instead (`all labels illegible`, case 40). Fine label detail and logos
are what text descriptions lose. Prefer a local file over a remote URL when
the user has one: `ofox-video-core` auto-base64-encodes a local file, which real
testing found more reliable than depending on the upstream provider being
able to fetch an arbitrary third-party URL (some hosts' bot/hotlink
protection can reject an otherwise valid, publicly reachable image URL).

An attached image means one of two things, and the API has a field for each
(shared file, `Reference assets as visual anchors`):

| Meaning | Flag | What it does | Status in this repo |
|---|---|---|---|
| **First frame** — the clip starts on this exact picture | `--frame-first-image PATH` | locks the opening composition (case 15's `Begin with the exact composition of the reference image`); on `bytedance/seedance-2.5` forces `aspect_ratio: adaptive`, so crop or pad the photo to the target ratio first | verified with real runs; this skill's default route |
| **Identity reference** — the model borrows the product's appearance, no frame is locked | `--extra-json '{"input_references":[{"type":"image_url","image_url":{"url":"…"}}]}'`, up to 9 images | what nearly every gallery prompt with an image does (cases 12, 13, 24): one role line per image, `image1: the product's exact packaging; image2: the logo, last second only` | element shape documented in `api-params.md`; no image-reference job has been run end to end in this repo, and whether `@image1` tokens resolve by position is unverified — the role sentence must read correctly as plain text either way |

**The two are mutually exclusive** in one job: the script rejects a request
that carries both (`references_conflict`). Choose the first-frame route when
the opening composition matters; choose identity references when several
product images (front, back, box, logo) should inform the whole clip.

```bash
bash ../ofox-video-core/references/ofox-video.sh generate \
  --prompt "Begin with the exact composition of the reference image. Camera slowly orbits 30 degrees around the product, soft rim light, cinematic color grade, no dialogue" \
  --frame-first-image "/path/to/local/product-photo.jpg" \
  --duration 10 --resolution 1080p
```

**Do not pass `--aspect-ratio` on this route.** With an image attached,
`ofox-video-core` forces `aspect_ratio` to `adaptive` on
`bytedance/seedance-2.5` and prints a notice; the flag only takes effect on
the pure text-to-video path. That is why the brief's Aspect question, when a
photo exists, means "crop or pad the photo to this ratio first".

If the reference image includes an actual person (e.g. a spokesperson or
model in the shot, not just the product), Seedance 2.5 image-to-video
refuses it at submission (`input_moderation_failed`, nothing billed).
`--real-person true` exists for authorised references per the API contract,
but whether it lifts the refusal on 2.5 is untested here; the safer route is
to describe the person in text and lock only the product to the image. The
`--real-person` path validates the image server-side and can fail with
`bad_data_uri`/`download_failed`/`unreachable`/`not_image`/`too_large` if
the image isn't a small, valid file the API can use — see the failure table
below.

## Recommended defaults

| Parameter | Default | Why |
|---|---|---|
| `--model` | `bytedance/seedance-2.5` (script default, no flag needed) | current-generation model |
| `--duration` | `10` when the user gives no length; otherwise the user's number | 10s is a cheap, readable draft length. **Every gallery ad prompt with a stated length runs 20–30s** (cases 13, 15, 25, 26, 27; case 12 rendered at 26s), and Template A needs 15s or more for its four beats. When the user gave no duration, say in the brief recap that the collected ads run longer and offer 15–20s as a row; Seedance 2.5 accepts 4–30 |
| `--resolution` | `1080p` for a deliverable brand asset; `720p` as a cheaper draft/preview pass | brand assets are usually published, so higher fidelity is worth the extra cost — show both as rows in the cost table rather than asking (see the approval gate below) |
| `--aspect-ratio` | `16:9` (landscape) unless the brief set another — **pure text-to-video only** | cinematic/hero framing for websites and YouTube; `9:16` for a vertical social cut, `1:1` for feed placements. **Does not apply once an image is attached** with the default model — `ofox-video-core` forces `adaptive` in that case (see above) |
| `--generate-audio` | `true` (server default, no flag needed) | ambient/music track; the prompt says "no dialogue" and carries an AUDIO line |

## Which upstream renders it

Jobs are pinned to the `byteplus` upstream (ByteDance's platform for markets
outside mainland China). Ofox otherwise picks between it and Volcengine Ark by
weight, and the two moderate differently, so pinning keeps results consistent.
Pass `--provider volcengine` for the mainland platform, or `--provider auto` to
let Ofox choose. Pricing is identical either way. See
`ofox-video-core/references/api-params.md` for the detail.

## Several shots: timestamps inside one job, `chain` across jobs

Two different tools, not alternatives.

**Cuts inside one job are written as timestamps.** Verified on Ofox on
2026-09-03: two three-shot prompts on `bytedance/seedance-2.5`, both pinned
to `byteplus`, 8s, 480p, 16:9, `--generate-audio false`, **pure
text-to-video with no image attached**. Both rendered all three shots with
hard cuts landing within about one second of the written timestamps — one in
the bare `0-3s: … Hard cut. 3-6s: …` form, one with a header manifest and
`SHOT N (a-bs)` + `HARD CUT`. **Not covered by those two runs**: more than
three shots, clips longer than 8 seconds, an attached reference image,
dialogue running across a cut, any resolution other than 480p, the
`volcengine` upstream. The record is in the shared file's `Several shots in
one job`. The gallery's ad prompts run five to nine shots in one generation
(case 14: nine `CUT`s; case 26: seven segments) on unrecorded platforms —
treat any count above three as gallery practice on this path until tested,
Template A's own four or five beats included, and price a first attempt as
an experiment.

**`chain` carries the last frame of one job into the first frame of the
next**, then joins the clips into one file. Use it when the sequence exceeds
one job's 30s ceiling, or when each shot needs its own approval, seed or
resolution; each shot is a separately billed job and the run estimates the
total before spending. `chain` adds one constraint: no photoreal person in
the carried frame on `bytedance/seedance-2.5` (`input_moderation_failed`), so
a sequence built around a human model cannot be chained, while product and
environment shots can. A chain of jobs can each carry timestamped cuts.

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

What this scenario's table usually needs a row for: the clip itself, priced
at the duration, resolution and aspect ratio you settled on. When the choice
between a 720p draft and a 1080p deliverable is still open, dry-run **both**
and show two rows — the difference is a decision, and it reads as one only
when both numbers are on screen.

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

Expect the shared reference files to be missing for the same reason:
`prompt-structure.md`, `creative-brief.md`, `approval-gate.md` and
`api-params.md` are shipped by `ofox-video-core`, while this skill packages
only its `SKILL.md` and `CHANGELOG.md` — one install brings back both the
script and the docs. Nothing here becomes unusable in the meantime; the
prompt templates, the brief's question table and the defaults are all local.
The part you lose is the detail those links carry — the full transition and
camera vocabulary, the general question-flow rules, and the gate's precise
wording, which is still required before spending.

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

```bash
bash ../ofox-video-core/references/ofox-video.sh generate \
  --prompt "<the ad-creative prompt built above>" \
  --name "<short spot name, e.g. perfume bottle hero ad>" \
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
| Exit `3`, `error.code: input_moderation_failed` on an image-to-video job | The reference frame contains a photoreal person — refused at submission on Seedance 2.5, nothing billed | Describe the person in text and lock only the product to the image; or crop the person out of the reference |
| Exit `3`, job ends `failed`, or `invalid_request` on create, with no other error code hint | Likely a moderation rejection: prompts referencing a real celebrity/spokesperson likeness without consent, another brand's trademarked logo, or copyrighted characters are commonly rejected | Remove the flagged real-person/trademark/copyrighted reference from the prompt (or reference image), then call `generate` again — this is a **new** request, not a resubmission of the failed one, so it's safe to retry immediately |
| Exit `3`, job ends `failed`, `error.code: output_moderation_failed` | The generated **output** failed a post-generation content check — happens after the job ran, not at submission. Not billed (no `usage` field on the response) | Retry with a brand-new `generate` call using a different prompt or reference image — a new request, not a resubmission of the failed one, so it's safe |
| Exit `1`, `references_conflict` | `--frame-first-image` and an `input_references` array in `--extra-json` in the same job | Pick one meaning — first frame, or identity references — and drop the other |
| `bad_data_uri` / `download_failed` / `unreachable` / `not_image` / `too_large` | `api-params.md` documents these as `real_person: true` image-validation failures, raised when Ofox fetches the reference image: it isn't a small, valid image the API can use (a remote URL that isn't publicly reachable, or a local file that failed to read/encode) | Prefer a local file (auto-base64'd, more reliable than some remote URLs — see above); confirm it's a real image file under the size limit and retry |
| Product label text or logo looks distorted/illegible in the result | Pure text-to-video can't render fine label detail reliably | Switch to image-to-video with `--frame-first-image` pointing at the real product photo instead of describing the label in text |
| The clip did not cut where the timestamps said, or cut fewer times than written | Cuts inside one job are verified only up to three shots in 8s at 480p; more shots or longer clips are gallery practice, not tested here | Reduce the shot count, lengthen the segments to 3–5s, or split the sequence across `chain` jobs |
| Exit `4`, timed out waiting for completion | Job is still running upstream, not failed | Do **not** re-run `generate`; run `bash ../ofox-video-core/references/ofox-video.sh poll JOB_ID` using the job id printed before the timeout |
| Exit `5`, ambiguous network failure on create | No HTTP response received at all — can't tell if a job was created | Do not guess or retry `generate`; tell the user to check `https://app.ofox.ai` for a job that may already be running, per `ofox-video-core`'s no-resubmit rule |

## When NOT to use

- Dialogue-driven scenes with characters talking — use `seedance-short-drama`
  instead.
- Plain catalog/listing footage (white background, literal orbit or
  turntable rotation, no mood or camera language) rather than a cinematic
  brand ad — use `seedance-product-video` instead. The border case is a
  clean studio showcase with a lid-opening reveal (gallery case 17): it
  belongs here only if there is a brand narrative or an emotional tone to
  carry; a listing that just needs to show the item belongs there.
