# Changelog

All notable changes to the **keyframe-animation** skill. Versioning follows SemVer.

## 1.2.0 — the duration claim is withdrawn; a real subject with text was run

**Documentation only. No flag, default, price, question set or prompt template
changed.** One section's *advice* is withdrawn rather than corrected, so a
caller who was following it has to stop.

A third paid job (`1b7a3fab`, 2026-09-17, 5s, 480p, 55 cents) used the first
A/B pair that is **not** the red square this skill was built on: a real
photographed product carrying a readable wordmark, left third to right third.

**What a caller has to do differently:**

- 🚨 **Stop telling users the motion arrives early and then holds.** That was
  this file's "Duration" section, stated flatly, including "if they want the
  arrival to land on the final frame, it won't". Measured per second as a
  fraction of total travel:

  | Elapsed | `259c3ce2` (4s) | `1b7a3fab` (5s) |
  |---|---|---|
  | 1s | ~53% | 20% |
  | 2s | ~90% | 51% |
  | 3s | arrived | 80% |
  | 4.5s | — | arrived |

  One clip is strongly front-loaded with a quarter of its length as a hold;
  the other is near-linear and holds for about half a second. **Neither is the
  model's behaviour** — they are two clips that disagree, on four variables at
  once (duration, subject, distance, seed), and one sample each cannot
  attribute the difference. The section is now headed "the easing curve is not
  a property of the tool". Treat the arrival time as a **draft question**: no
  clause is known to control it, and now no default is known either. The
  troubleshooting row that called the early arrival "expected, and measured"
  now says "possible, not expected".
- **Do not budget duration around a promised hold.** "A longer clip buys more
  hold" was the reasoning behind the short-clip default. The default stands;
  that reason does not.

**What improved, and it is the reason the run was worth 55 cents:**

- **Lettering survives.** The wordmark is intact and legible at every sampled
  point through the clip, not only at the two supplied ends. The advice to
  drop the `no on-screen text` AVOID item when your own frames contain
  lettering was inference; it now has a run behind it.
- **Both ends honoured on a second input class**, so the one claim this skill
  most depends on is now three jobs across two pairs — and the only claim that
  came through the third run unchanged.
- The evidence section is re-headed "three measured jobs on **two** pairs",
  and the untested list no longer says "whether the front-loaded easing scales
  with duration" (which assumed the front-loading and questioned only its
  scaling) but that the curve itself is unmeasured, at any duration.

## 1.1.0 — the real-person refusal has an authorised route, and this file said it didn't

Three places in `SKILL.md` told the reader `--real-person true` was untested on
`bytedance/seedance-2.5` and not to reach for it. That is no longer true, and a
file that leaves a known-wrong instruction in place is worse than one that
never tested the question. Minor rather than patch, because a default changed
shape: the flag moves from "don't" to "only under a condition".

**The measurement belongs to `ofox-video-core` and is not restated here.** It
was a single-variable A/B on 2026-09-16 — one synthetic portrait, the same
prompt and parameters, with and without the flag — and this skill links to
[`api-params.md`](../ofox-video-core/references/api-params.md) → the
real-person section for the evidence, exactly as it links that file for
everything else the core owns.

**The wording is the whole of the risk in this release, so it is fixed
wording.** `--real-person true` is Ofox's privacy-preserving preprocessing path
for real-person references the user is **authorised** to use — an authorisation
route, never a way past the check. It is not written anywhere in this skill as
a flag that gets a rejected frame accepted, and it must not be edited into one.

What changed, in three places:

- **"What makes a good A/B pair"** — the bullet no longer reads as a flat
  prohibition. A photoreal person still stops the job by default; the exception
  is stated as an authorisation the user has to hold, with the scenario limit
  attached (the measurement was one *first* frame, and this skill attaches
  two).
- **The `--real-person` row in the defaults table** — "leave unset" becomes
  "leave unset unless the user holds the right to use the likeness and has said
  so", with the same limits.
- **The `input_moderation_failed` row in the failure table** — cropping the
  person out is still the first answer; the flag is named as something to ask
  about, price as an experiment, and never offer as a retry.

What this release deliberately does **not** claim: that a two-ended pair works
with the flag (untested — the run attached one frame), that a real photograph
of a real person behaves like the synthetic portrait (untested), or anything
about an upstream or a tier other than the one measured. All three limits are
in the file rather than in this changelog alone.

## 1.0.1 — the prompt template in this file has now been run

1.0.0 shipped saying this skill rested on **one** measured job. It rests on
two. Nothing about the prompt, the flags or the defaults moved — the change is
a measurement being recorded — so this is a patch.

**The second run tested this file's prompt template, and the endpoint result
replicated.** Job `2514540e` (2026-09-15), `bytedance/seedance-2.5`, 4
seconds, 480p, both frames attached, **44 cents billed** — same model,
duration, tier and input pair as `259c3ce2`, with the prompt filled in from
this skill's own template by an agent working from this file and nothing else,
so what it exercised was the skill, not the API. The delivered clip's own
first and last frames measure x=120–239 and x=614–733: the same figures, to
the pixel, as the first run. "Both ends are honoured" is now the only claim
here with more than one job behind it.

Every "one measured job" framing in `SKILL.md` was rewritten around that. The
evidence section is a two-row table saying what each job tested; the parameter
defaults cite both runs; the prompt template says outright that it has been
run and what came back; and the cost anchor reads 44 cents **twice**, on
`259c3ce2` and `2514540e`, rather than once.

What this release deliberately does **not** claim, because two jobs on one
pair cannot support it: that the second run widened anything about the
**inputs**. It is a replication, not a broadening — a different subject, a
different canvas or a pair carrying lettering is still untested. Everything
1.0.0 declined to claim, it still declines to claim.

## 1.0.0 — first release

A scenario skill for the case where the user already has both ends: image A is
attached as the first frame, image B as the last frame, in one
`ofox-video-core` job, and the model generates the motion between them.

**Built on one measured run, and the skill says so throughout.** Job
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

What the skill deliberately does **not** claim, because one job cannot
support it: that the easing fraction scales to other durations; that
first+last works on any other model (the catalog's `i2v` flag does not
distinguish one locked end from two); that a pair of mismatched pixel
dimensions works; or anything about how a widely-differing pair is
interpolated — that section is labelled as reasoning.

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
