# Changelog

All notable changes to the **ugc-ads** skill. Versioning follows SemVer.

## 1.0.0 — first release

A scenario skill for handheld, phone-shot creator clips — an unboxing, a first
impression, a use-it-once review — where amateur texture is the deliverable
rather than a compromise. Text-to-video through `ofox-video-core`, with an
image-to-video route for locking a real product's label.

**The load-bearing content is an inversion, and it is stated first.** Every
other video scenario in this repo pushes toward polish, and so does most of
the shared prompt guidance: cinematic anchors, studio keys, a slow-motion
climax and a hero freeze. All of that is a defect here. The skill opens with a
default-versus-here table, names the three habits that leak in from the other
scenarios (style words carried across, the ad beat structure, a camera that
behaves), and ends that section with the check worth running every time —
re-read your own prompt for `cinematic`, `studio`, `professional`,
`film grain`, `rim light`, `shallow depth of field`, `slow motion`. The
failure mode is silent: a polished clip has not errored, it has rendered
exactly what it was asked for and stopped being UGC.

**The anti-polish vocabulary is linked, not copied.** It already exists in
`ofox-video-core/references/prompt-structure.md`, derived from real gallery
cases 25 and 40, and duplicating it would mean one copy getting corrected
while the other kept the old wording. The skill carries a table of *which*
section to load for each need — the UGC anti-polish row for the AVOID list,
`Consumer capture` for phone-capture anchors, the handheld and autofocus rows
for camera behaviour, `Pacing` for the flat action chain, and
`The plastic look is designed out, not forbidden` for why a prohibition alone
is never enough. The prompt template's AVOID slot is an instruction to quote
that row, and the worked example shows the quoted result.

**The one edit that quoted row routinely needs is called out.** It ends
`…fisheye, vignette, or legible text`, which was written for a text-only clip
where every letter would be invented — and in an unboxing of a *real* product
it points at the label the user is advertising. The skill says to lock a real
label in an attached first frame instead, drop that clause, and replace it
with the specific lettered carriers to exclude; the worked example sidesteps
the question by giving its product a plain unprinted box.

**No paid run backs this scenario, and the skill says so in three places** —
its own "What has been tested, and what has not" section, the approval gate
(no cost anchor of its own; the dry run is the only honest number), and the
worked example, which is labelled as a filled-in template rather than a clip
anyone generated. What it is built on instead is stated plainly: gallery
practice for what a good UGC prompt looks like, and mechanism facts measured
in this repo — the attached-photoreal-person refusal, the music/moderation
failure, prohibitions on object classes holding better than on tempo, and a
camera move written only as a verb tending not to happen.

Also in this release:

- **Four positive levers**, because the negative list cannot carry the clip on
  its own: the device is part of the fiction (a DEVICE line no other skill
  here has), one practical light that behaves badly, framing that is a little
  wrong, and a real room rather than a set.
- **The clutter-versus-invented-text tension is named and resolved.** A UGC
  set is supposed to be cluttered; this repo's one measured rule about
  invented signage says a set full of lettered surfaces produces it however
  strongly the AVOID list forbids it. The skill keeps the clutter and moves
  the lettered carriers out of frame or out of focus, forbids them **as
  objects** rather than as "text", and locks the product's own packaging with
  a photo instead of describing it.
- **The person route, split correctly.** A photoreal person in an attached
  frame is refused at submission; a photoreal person generated from text is
  not. So a product photo carries the product **alone** — no hand, no foot —
  and the person is written into the timeline. Hands-only is recommended as
  both the most common real unboxing shape and the lowest-anatomy-risk one,
  with the measured note that a written size limit on a limb is not a defence:
  one job stated `only the fingertips and the first knuckle ever visible`
  twice, in the shot and in AVOID, and rendered most of the hand anyway.
- **No music, with the reason attached** — a prompt asking this model for
  music came back `output_moderation_failed` on audio copyright in this repo,
  unbilled. Ambient and action sounds only.
- **No hardcoded model, price, resolution, duration or aspect-ratio table.**
  Those are catalog facts and the skill points at `ofox-video.sh models` /
  `providers MODEL` / `generate --dry-run` instead — with the note that
  `providers` without an argument prints the flagship's matrix rather than the
  catalog, and that the rate `models` shows is each model's own *default*
  resolution, so it ranks rather than quotes.
- **The core-directory probe ships from day one**, so the skill works on
  LobeHub's `ofoxai-skills-<name>` layout as well as skills.sh / ClawHub /
  `npx ofox-skills`.
- **It says what degrades without the core installed**, which for this skill
  is more than usual: everything is written out locally except the
  anti-polish AVOID list, deliberately. The fallback is named.
- **It says when not to buy.** A real unboxing filmed on a real phone costs
  nothing and cannot fail an authenticity check.

**What a caller has to do**: install `ofox-video-core` beside this skill.
`npx ofox-skills` installs every skill in this repo, which is what keeps the
sibling path resolvable.
