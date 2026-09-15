# Changelog

All notable changes to the **keyframe-animation** skill. Versioning follows SemVer.

## 1.0.0 — first release (not yet published)

1.0.0 has never shipped, so the live-fire run of 2026-09-15 is folded into
this entry rather than given a version of its own.

A scenario skill for the case where the user already has both ends: image A is
attached as the first frame, image B as the last frame, in one
`ofox-video-core` job, and the model generates the motion between them.

**Built on two measured runs, and the skill says so throughout.** Job
`259c3ce2`, `bytedance/seedance-2.5`, 4 seconds, 480p, both frames attached,
44 cents billed. Two things came out of it, both read off the delivered
video's own frames rather than off `STATUS completed`:

- **Both ends are honoured to the pixel.** The inputs put a red square at
  x=120–240 and x=614–734; the delivered clip's first and last frames measure
  x=120–239 and x=614–733.
- **The motion is front-loaded, not linear.** Sampling the same scan at
  t=1/2/3s gives x≈384, 564, 614 — roughly 53% of the distance in the first
  quarter of the clip, 90% by halfway, arrival at 3 seconds of 4. **The last
  beat of an A→B clip is a hold, not travel**, and the duration advice is
  written around that.

**The second run tested this file's prompt template, and the endpoint result
replicated.** Job `2514540e` (2026-09-15), same model, duration, tier and
input pair, 44 cents, with the prompt filled in from this skill's own template
by an agent working from this file and nothing else — so what it exercised was
the skill, not the API. The delivered clip's own first and last frames measure
x=120–239 and x=614–733: the same figures, to the pixel, as the first run.
"Both ends are honoured" is now the only claim here with more than one job
behind it.

What the skill deliberately does **not** claim, because two jobs on one pair
cannot support it: that the second run widened anything about the **inputs**
— it is a replication, not a broadening, and a different subject, canvas or a
pair carrying lettering is still untested; that the easing fraction scales to
other durations; that first+last works on any other model (the catalog's
`i2v` flag does not distinguish one locked end from two); that a pair of
mismatched pixel dimensions works; or anything about how a widely-differing
pair is interpolated — that section is labelled as reasoning.

Also in this release:

- **No hardcoded model, price, resolution or duration table.** Those are
  catalog facts and the skill points at `ofox-video.sh models` / `providers` /
  `generate --dry-run` instead. The one cost figure it prints carries the
  exact parameter pair it was measured at.
- **The core-directory probe ships from day one** — an ordered candidate list
  rather than a hardcoded `../ofox-video-core/...`, so the skill works on
  LobeHub's `ofoxai-skills-<name>` layout as well as skills.sh / ClawHub /
  `npx ofox-skills`.
- **Aspect ratio written against `ofox-video-core` 1.22.0**: with frames
  attached, `adaptive` is *forced* on `bytedance/seedance-2.5` and *defaulted*
  on a model whose catalog entry lists it. The advice is to crop both frames
  to the target shape first and pass no `--aspect-ratio` on any model.
- **A way to confirm both frames are attached before paying for the answer.**
  A dry run quotes the price but names only the model, duration and
  resolution, so a flag that didn't take looks exactly like a healthy quote.
  The skill points at `generate --dry-run --print-payload`, greps the two
  `frame_type` entries out of the request body, and says what one line or a
  reversed order means. No new tooling — the flag already existed and its
  output is dumped before the dry run stops.
- **`--out-dir` is stated as absolute and passed to the dry run**, which is
  where the script creates and enters it: a bad path exits `6` with nothing
  submitted, instead of after a job is paid for.
- Shared prose is linked, not restated: the approval gate, the prompt formula
  and the pre-prompt question rules all live in
  `ofox-video-core/references/`.

**What a caller has to do**: install `ofox-video-core` 1.22.0 or newer beside
this skill. `npx ofox-skills` installs every skill in this repo, which is what
keeps the sibling path resolvable.
