# Changelog

All notable changes to the **image-edit** skill. Versioning follows SemVer.

## 1.1.1 — the under-quote warning 1.1.0 added is withdrawn; it was never true

**Documentation only. No flag, default, question set or command changed.**

1.1.0 told callers to *"treat a `ROUGH UPPER BOUND` on a large input as a
floor, not a ceiling"*, on the premise that the 1792x1008 run's output-token
count was unrecoverable. It was not — the figures had scrolled out of the
terminal, not vanished, and they close the pricing formula exactly
(`63*0.000005 + 1508*0.000008 + 129*0.00003 = 0.016249`). The anchor is now
complete and a 1792x1008 input quotes `ROUGH ~$0.0164` against a real
$0.016249. **Ignore that warning; `--dry-run` on the real file is the figure
to relay, as it always was.**

⚠️ **What replaces it is a different and better-supported caution: do not
reason about an edit's cost from its output tokens.** They do not track input
size — 129 (320x180), 229 (256x256), 301 (854x480), **129** (1792x1008), with
the largest input tying the smallest for the lowest count. The uploaded
picture is what moves, and on a large source it is **74%** of the bill. The
lever is the size of the file you upload.

## 1.1.0 — the skill's own path was run, and "specific pixels" was the wrong promise

**Documentation only. No default, flag, question set or command changed.**
This skill had generated nothing of its own; every figure in it was borrowed
from `ofox-image-core`'s build-time runs or from two probes made directly
against the script. One run through this file's own documented flow
(2026-09-17, a real 1792x1008 photograph, the two-sentence instruction,
`--dry-run` first, 1.6 cents) closes that and corrects one claim.

**What a caller has to do differently:**

- **Stop verifying an edit by diffing pixels outside the region you named.**
  "Say what stays, every time" said the second sentence turns "did this work?"
  into *a question about specific pixels*. Measured, the protection is
  **feature-level**: every named feature survived intact, **and** the lighting
  changed with the background (it has to — a new background is a new light),
  and the subject sat slightly lower and slightly larger in the same crop.
  Check the features you listed, at magnification. Do not tell a user the rest
  of the picture is untouched to the pixel.
- ⚠️ **Treat a `ROUGH UPPER BOUND` on a large input as a floor, not a
  ceiling.** The new point's `USAGE_OUTPUT_TOKENS` was never recorded, only
  its image tokens (1508) and its bill (1.6 cents), and `token-anchors.json`
  will not hold a derived figure — so the estimator skips it and quotes the
  854x480 point (~1.4 cents) instead. A big source therefore **quotes under
  what it bills**. Say so in the cost table until the pair is re-measured.
  This is the never-under-quote rule failing in the direction that rule
  exists to prevent, and it is written down rather than papered over.

**What it confirmed rather than changed:** the ~1.57 MP output budget now has
a fourth point, and the fourth is the first where the **input was larger than
the output** — 1792x1008 in, 1672x941 out — so the budget holds in both
directions rather than only as an upsample floor. Image tokens stay non-linear
at the top end too: 4.4x the pixels of 854x480 for 2.6x the tokens. And the
"it edits rather than redraws" evidence, previously three runs on synthetic
flat-colour inputs, now includes a continuous-tone photograph.

Also re-worded, from Stage 1's measurement: the video content-editing dead end
in the description and in "When NOT to use" used to say "no path in this
repo". It now says what was measured — the video API's `mode` field is
**accepted and discarded** (job `4686f434`, `200`, billed as ordinary
text-to-video) — because an agent told the request is "refused" will wait for
an error that never comes.

## 1.0.1 — routing only: video content editing has no path in this repo

A blind routing tester was given "change my 10-second video's background to a
beach, keep the product exactly as it is". It reached the right conclusion —
no skill fits — but only because it happened to open `video-extend-edit`, the
one file in the repo carrying the sentence "there is no video content-editing
path here". An agent handling a background swap has no reason to open that
file. **This skill is where such a request actually lands**, so it now says it
too: a bullet in "When NOT to use", a skip row for "my video / this clip / the
footage", and a clause in the frontmatter description, which is the surface an
agent routes from before it opens anything.

The row states the honest alternative rather than only the refusal: a still
can be edited, and a still can be turned into video — but that **generates new
footage** instead of editing theirs, and whatever real motion, lighting and
timing their clip had does not carry over. It also names the specific wrong
turn, because the tester named it: `seedance-product-video`'s worked example
contains *"image1 provides the product exactly as it is; take nothing from its
background"*, a near-verbatim match for what this user asks for, and routing
there spends money on a brand-new clip.

No behaviour, defaults, pricing or instruction craft changed.

## 1.0.0 — first release

The first of two **image** scenario skills in this repo. Every scenario skill
before these produced video and delegated to `ofox-video-core`; this one
delegates to `ofox-image-core`, whose documented delegation contract had never
had a real scenario caller until now.

It exists because `ofox-image-core` 1.11.0 added `edit` (`POST
/v1/images/edits`) a few hours earlier. Before that there was nothing for this
skill to sit on.

**One image in, one edited image out**, and the craft is the second half of
the instruction rather than the first. The skill's whole shape is built around
the fact that the interesting question is not "what should the picture look
like" — the picture already exists — but "what must survive", and that the
answer to that is what makes a result checkable at all.

**The instruction is two sentences and the second one is the one people leave
out.** Name the change concretely, then name what must not change concretely.
Without the second sentence, "did this work?" is a question about your memory
of the source rather than about specific pixels.

**The source file is opened and confirmed before it is trusted.** A path in a
request is a claim about which file, and a wrong source does not fail — the
edit succeeds, bills, and hands back a correct edit of the wrong picture. The
skip row that says not to ask whether there is a file now also says to look at
it, and to say what you actually see if it does not match the request rather
than proceeding on the theory that the user knows their own folder. Same rule,
same wording, in `product-image`, where a wrong source costs four calls
instead of one.

**One change per call**, argued from a measurement rather than from taste: at
`--n 2` both token components scaled exactly with the count, so two calls cost
what one call with two clauses costs. There is no saving to trade the control
away for.

**The evidence and its boundary are stated together, everywhere.** The
endpoint genuinely edits rather than redrawing — a UI screenshot asked for one
button colour change returned every string verbatim, mean absolute difference
5.27/255 overall against 84.27 inside the button, a region that is 1.1% of the
frame carrying 58% of substantially-changed pixels, replicated three times.
That is what makes "leave the rest alone" a reasonable thing to write. It is
also three runs on **one** model, on inputs with hard edges and flat colour,
which is why the verify-the-artifact step is an instruction rather than an
assumption.

**This skill has generated nothing of its own**, and says so in its third
paragraph. Every measured figure names the run it came from: `ofox-image-core`
built the `edit` subcommand and measured it, and two probe calls were made
directly against `ofox-image.sh` on 2026-09-15 while this file was written.
None of them came through this skill's flow.

**No model, price or size table.** Edit support is `models --endpoint edits`,
read live from each model's `supported_endpoints`; prices are whatever
`--dry-run` prints, relayed as the line prints rather than as a figure copied
into prose. `--model` is omitted so `ofox-image-core` resolves its own chain
against the edits endpoint.

**The dry run is documented as the guard, not a politeness.** `POST
/v1/images/generations` refuses a bad `--quality` for free; `POST
/v1/images/edits` does not — measured 2026-09-15, an unknown value was
silently ignored, rendered and billed on six models. On this endpoint the
client-side checks are the only thing between a typo and a bill.

**The input image decides the output's shape and part of the price**, with
both stated as one model's three runs rather than as general behaviour: the
output follows the input's ratio at a near-constant ~1.57 MP, and the uploaded
picture is billed — 576 of 608 input tokens on an 854x480 source — at a rate
that is *not* linear in pixels.

**Routing is explicit in six directions**, because a fresh agent picks a skill
from the descriptions and the "When NOT to use" list: `ofox-image-core` for a
text-to-image render or low-level API work, `product-image` for a set,
`seedance-product-video` / `seedance-ad-creative` when the deliverable is
video, `seedance-anime-drama` for character images inside its own consistency
flow, and `hal-image` when the change has to be exact rather than generative.
