# Changelog

All notable changes to the **seedance-product-video** skill. Versioning follows SemVer.

This file starts at 1.0.2; earlier versions predate it.

## 1.10.1 — the orbit arrived; it did not demonstrably go round, and 1.10.0 said it did

Docs only; no script changes. **This entry corrects 1.10.0, which is
unreleased alongside it — read the two together rather than as an addition,
because the wrong reading here is the intuitive one and a future reader is
likely to re-derive it.** What 1.10.0 got right is the finding this skill's
`Motion` default now rests on: `the camera orbits the grinder a full 360
degrees` produced no movement at all, and the same prompt at the same seed
with the angles written out as pictures produced a camera that moved and
ended on the front view it named. What it got wrong is how far that camera
travelled — recorded as a clean monotonic full circuit, when the clip cannot
support any total at all.

- **The corrected reading, and the reason two earlier ones failed.** The front
  view is fixed by the frame at 2.8s (knob at the left, crank arm extending
  cleanly sideways). Inside the continuous ORBIT segment — the hard cut at
  6.291667s to about 10s — the frames read the rear through 6.40–8.40s, a
  side at about 8.80–9.00s, and the front again from 9.60s. So: **the segment
  ends on the opening orientation**, the **observable travel is about 180
  degrees**, and the **total is unmeasurable**, because the written path's
  other half could only have happened across that hard cut and the shot
  before it is DETAIL's macro of the knurled ring — rotationally
  near-symmetric, carrying no orientation cue. An earlier draft read the
  segment's own first frame as the front and reported 180 degrees with no
  return; 1.10.0 read across the cut and reported the full circuit. Neither
  pair of endpoints was connected by continuous motion. §3 now states the two
  claims and the limitation, and says plainly that this skill claimed the
  circuit once.
- **The general rule went to the shared file, not here**, as
  `Measuring a camera's travel: only inside one continuous shot` in
  `ofox-video-core/references/prompt-structure.md` — it is about checking any
  clip, not about catalog footage, and it sits next to the existing
  read-the-frames-not-the-detector guidance because it is the same class of
  mistake.
- **The near-stationary stretch is six sampled frames, not five** — 6.40,
  6.80, 7.20, 7.60, 8.00 and 8.40, with 8.80 the transition, so roughly 2
  seconds held and the rest of the move in about 1.2. §4 and the failure table
  are corrected.
- **The framing defect voided half a waypoint, which §3 now says.** The 7s
  waypoint asked for the knurled ring seen edge-on, and that ring was outside
  the inherited macro framing for the entire orbit — so an unspecified shot
  size did not merely crop the picture, it deleted part of what a waypoint
  asked for, and the missing beat looks like the model ignoring a waypoint
  when the prompt had already made it impossible.
- **The scene detector missed a real cut in *both* clips, not just the
  rejected one** — clip A at **9.750s** (visible only at threshold 0.05) and
  clip B at **10.041667s** (needs 0.10), neither at the 0.25 both were checked
  at. These are the fifth and sixth confirmations of the same-lighting blind
  spot in this repo and its strongest form, since a controlled pair needed two
  *different* lower thresholds and no single number would have caught both. It
  also weakens one of 1.10.0's own claims, now hedged: `no cut anywhere inside
  this segment` was **not contradicted** rather than verified, because the
  pass that reported nothing inside the orbit is the same pass that missed
  that segment's closing boundary.
- **Two instruction readings recorded, both stable across the pair.**
  `hold the final frame` held in clip A (every frame of its last half second
  under a 0.0005 scene score) and drifted in clip B (six frames above 0.0005,
  one above 0.002) — so ask for it and expect a settle. And `in a row on the
  grey surface beside the standing grinder` put the accessories on **both
  sides** of the grinder in both clips: identical in the pair, so a stable
  reading of `beside` rather than a roll, which makes it plannable — name the
  side and say the product is not between any two items if the row has to
  stay together. 1.10.0's ACCESSORIES row read as if the slot rendered exactly
  as written; the items did, the placement did not.
- **The gallery case number is `n: 1009`, not `n: 1008`.** Another session
  committed 1008 to a different clip while this work was in progress, and `n`
  is append-only, so the uncommitted case moved rather than the committed one.
  Corrected in `SKILL.md` and in 1.10.0's own entry above.

Every hedge 1.10.0 carried survives — it is still two runs, the turntable
phrasing is still unmeasured, and nothing here widens a claim.

## 1.10.0 — an orbit that never happened, and the one paragraph that fixed it

Docs only; no script changes. Until now this skill had generated nothing of
its own — every figure in it came from the gallery, from
`seedance-ad-creative`'s product jobs, or from `ofox-video-core`'s two
three-shot test runs. It now has two 12-second 720p clips of a fictional hand
coffee grinder, `bytedance/seedance-2.5` on `byteplus`, **pure text-to-video
with no image attached**, `--aspect-ratio 16:9`, `--generate-audio false`,
2.88 USD each. They are a controlled pair: **the same seed (`642303335`), the
same model, the same flags, and the same prompt text except the ORBIT
paragraph.** The first was rejected, the second accepted on 2026-09-05 and is
the gallery's first `ofox`-sourced case in the `product-video` category
(`n: 1009` — this entry originally said 1008; see 1.10.1). Versions in force
when they ran: this skill 1.8.0, `ofox-video-core` 1.15.0.

- **`the camera orbits the grinder a full 360 degrees at constant height and
  constant speed` produced no orbit at all.** Job
  `1cf5ac46-058f-4615-a47b-067743f76f8c`: from 6.0s to about 9.7s a
  near-static front view with a slight push-in, the crank arm pointing right
  in every frame — 3.7 of 12 seconds, the core segment of a catalog clip,
  delivering no new angle. Note which half of that sentence was obeyed: the
  product genuinely did not rotate, and the camera genuinely did not travel.
- **The same prompt at the same seed, with that one paragraph rewritten as
  timestamped waypoint pictures, travelled the whole circuit.** *(The extent
  claimed in this bullet — the circuit, and the degree readings below it — is
  corrected in 1.10.1: the move arrives, and its total travel is
  unmeasurable. The rest of the bullet stands.)* Job
  `50f623b2-c54a-4d9d-9646-31dd06e2a926`, read against the clip's own opening
  frame rather than the start of the segment, using the crank arm as a
  protractor — it extends horizontally in one direction, so it runs cleanly
  sideways from the front or the rear and hides behind the collar from either
  side: front at 2.8s, rear at 7.0s, a side at 9.0s, front again at 10.0s, and
  the same orientation still holding at 11.5s. A clean monotonic circuit.
  **So: describe each angle as a still picture with a timestamp on it. A
  camera verb is not honoured.** A negative control and a positive one, one
  variable apart — which is what makes the prompt the attributable cause
  rather than the roll, and it is still two runs.
- **What that pair cannot attribute, now stated as a limitation in the skill
  rather than left to read as more than it is.** Each waypoint carried two
  kinds of description at once — a camera-position label ("directly behind the
  grinder") and an appearance description ("only the smooth back of the collar
  and the walnut knob beyond it are visible") — and on the 8s waypoint the two
  contradict each other, since from directly behind that arm extends sideways
  rather than pointing away from the lens. The rendered arm-hidden frame
  matches the appearance clause and contradicts the position clause, so the
  run cannot say which half the model followed. Section 3 now says so
  explicitly, and every "the waypoint appeared" line is written to mean the
  picture appeared, not that a position label was obeyed. The forward-looking
  line that follows — **write a waypoint as an appearance description, not a
  camera-position label** — is marked as reasoning from that confound, not as
  something measured, and the template, the §3 slot and the worked example are
  rewritten to carry appearance clauses only.
- **Which motion this skill recommends has not changed; how to write it has.**
  The gallery evidence for "camera orbits, product still" is untouched — every
  rotation there is written as camera movement, and the fixed-camera turntable
  still has no gallery source and, now stated plainly, has never been run here.
  What moved is that the recommended option no longer stands on the words "the
  camera orbits": the `Motion` question, the `Recommended defaults` row, the
  full template's ORBIT slot and a new "3. Camera motion: waypoint pictures,
  not a camera verb" all carry the waypoint construction, and the section is
  the single place the measurement lives.
- **A caller copying the old wording got the rejected clip, so the two
  copyable orbit sentences were replaced.** The worked example's ORBIT line
  was the failing phrasing verbatim; it is now the waypoint form, flagged as
  the one line in that example that is neither case 17's nor a translation of
  it. The compact 5s template's one-sentence orbit is the same phrasing at a
  shorter duration — nothing in this repo has run it, so it is now marked
  untested rather than safe, with a pointer to the waypoint form for any clip
  that has to show more than one side.
- **The pictures are honoured; the spacing between them is not — now its own
  subsection, "4. A timestamp orders the pictures; it does not schedule
  them".** It is a different failure mode from "a camera verb is not
  honoured", and someone will need it without reading the whole A/B, so it has
  its own heading and points back to §3 for the pair. Four evenly spaced
  moments were written into a four-second segment — three interior views at
  7s, 8s and 9s, then the opening front view by 10s. Two of the three interior
  views rendered, and sampled every 0.4s from 6.4s to 10.0s, five of ten
  frames still show the crank pointing right: one view is held for roughly
  half the segment and the rest of the circuit is covered in the last second
  and a half. *(1.10.1: **six** of ten, not five — 6.40 through 8.40 all read
  crank-right, with 8.80 the transition. And "the rest of the circuit" is the
  superseded extent: what the last 1.2 seconds covers is the observable
  rear-to-front travel, not a circuit anyone can measure.)* Stated as counts
  and durations rather than as a per-waypoint schedule, because the confound
  above means "this waypoint was a second late" is not attributable. So:
  **two interior pictures plus the return** for a
  four-second orbit, and no angle planned to land on a given second — if a
  picture has to exist at a given time, make it a segment boundary, where
  stamps have held to about a second across every run here. The return is the
  one wording with evidence behind it: `by 10s the camera has returned to the
  exact front view of the opening shot` names a frame the clip already
  contains rather than a quantity of rotation, and the 10.0s frame is that
  frame.
- **What the accepted clip still gets wrong beyond that pacing, cause
  identified and fix not yet run**: no shot size was written on any waypoint,
  so the orbit inherited the macro closeness of the DETAIL segment
  immediately before it — the base and
  the knurled ring are out of frame for the whole orbit, several angles of the
  collar and the crank and never the whole product from the side or the back.
  The template's slot notes now say a segment inherits the previous segment's
  framing unless told otherwise, and every waypoint carries its own shot size.
- **The rest of the template rendered as written, and two AVOID items earned
  their place.** REVEAL (a plain grey box lid lifting straight up out of
  frame) and DETAIL (macro on the knurled ring and the metal/wood seam, slow
  straight push-in) came back exactly as described. ACCESSORIES produced the
  three correct items, evenly spaced, not touching, **only** in the final
  segment and with no duplication — the two failure modes that slot risks, and
  the AVOID list named both (`no accessory appearing before the final segment`,
  `no duplicated accessory`).
- **Three things the text-only route confirmed that this skill previously only
  argued for.** Zero invented text across an all-bare set of metal, glass and
  wood, including the glass jar's steel screw lid, with **no first frame to
  anchor anything** — the PRODUCT block's explicit "there is no printed text,
  no logo, no engraving and no marking anywhere" plus a carrier-by-carrier
  AVOID list. Zero deformation of the crank arm, a thin protruding
  right-angle part, through both clips. And the consistency lock holding on
  text alone: every earlier accepted clip here that needed a product's
  identity held had an attached image doing that work, so "write the
  consistency lock every time" now rests on a measurement rather than only a
  rationale.
- **`--aspect-ratio 16:9` took effect and the output is exactly 1280x720** —
  the first clean confirmation of ratio control in this repo, since every
  earlier product-adjacent clip attached a frame and was forced to `adaptive`.
  It worked *because* the route was text-only, which "A product photo" now
  states as a benefit of this skill's rule against generating a reference
  image: on that route the platform ratio is a flag, not a crop made
  beforehand. `--generate-audio false` was confirmed the same way — the
  delivered files carry no audio stream at all, not a silent one. Four
  segments at 3/3/4/2 also held: the rejected clip measured 3.12/2.88/3.7/2.3,
  every segment within 0.3s of plan.
- **Two boundaries added where the claims they qualify already live.** The
  seed reproduces a take only while the prompt is byte-identical — both clips
  ran seed `642303335` and the grinder is visibly a different design in each,
  so "give me that take at 1080p" is still the seed's job and "let me tweak
  one line and keep the look" is not. And the scene detector missed the
  rejected clip's 9.7s boundary at threshold 0.25 while finding 3.12s and
  6.00s, a fifth confirmation of the same-lighting blind spot; the record
  stays in `ofox-video-core`'s shared `Checking the cuts`, with a failure-table
  row here pointing at it rather than a competing list.

## 1.9.0 — the four-segment template is inside the measured envelope

Docs only; no script changes. This skill's caution about its own full
template — "the full template's four segments sit one beyond that", meaning
beyond three shots in an 8-second 480p clip with no image attached — was
accurate when written and is now stale.

- **"Several shots: timestamps inside one job" is updated with the route this
  skill actually uses.** Two accepted `seedance-ad-creative` jobs at 720p
  attached a generated product image as `--frame-first-image` and cut inside
  the same job: `7ae7d49e-7eb9-4165-9d95-09cd525d53ed` (15s, 5 shots, 4 hard
  cuts) and `ac927785-92ef-4e28-97b9-ff8172ec5554` (20s, 7 shots, 6 hard
  cuts). Every written cut happened, and the attached frame held the product's
  shape and colours across all of them — on the second, verified as far as
  t=19.6s, which is the property a catalog clip depends on. So four segments
  need no fallback and no hedge in the recap. What is still unmeasured (past
  10 shots or 6 hard cuts, 1080p, the `volcengine` upstream) is named.
- **The failure-table row for missing cuts now points at the transition mix
  rather than the shot count**, and at reading frames instead of trusting a
  scene detector's count — detection at threshold 0.3 under-reports cuts
  between shots of the same subject under the same light, which is every cut
  in a studio product clip.

## 1.8.0 — the segmented template's timestamps didn't scale, and ACCESSORIES could go negative

Docs only; no script changes. Prompted by an audit of every scenario
skill's template after a real short-drama clip was accepted but flagged for
spending too much of its runtime on setup and the ending instead of the
part the clip was actually for (`seedance-short-drama`'s 1.9.0). This
skill's own "Full template — 10–15s, three or four segments" was checked
for the same failure shape and found a related but different defect: its
absolute stamps (`0–3s / 3–7s / 7–12s / 12–<N>s`) do not scale with
`--duration`. REVEAL, DETAIL and ORBIT alone already run to 12s at those
literal numbers, so the template only fits a 15s clip as written — at 10s
or 12s, the recommended low end of this skill's own duration default,
ACCESSORIES is left with zero or negative seconds, and the abstract
template's stamps didn't even match its own worked example (which uses
3/6/10/12, not 3/7/12/N).

- **The four stamps are now `<a>`/`<b>`/`<c>` placeholders**, scaled to the
  chosen `--duration` rather than copied literally, with a new note
  directly under the template ("Scale the segments, don't copy the
  stamps") spelling out why and pointing at the worked example's actual
  proportions.
- **ACCESSORIES' proportion was checked, not just its arithmetic**: it
  stays the smallest segment by design — 2–3s, never the majority — while
  ORBIT keeps the single largest share, because showing the product from
  every angle is the point of a catalog clip. This skill's plain,
  restrained positioning is unchanged; this release fixes a template that
  couldn't produce a valid prompt at its own recommended durations, not the
  skill's stance on how showy a listing clip should be.

Ad-creative and anime-drama were audited in the same pass and needed no
change — see `seedance-short-drama`'s 1.9.0 changelog entry for why, and
`ofox-video-core`'s 1.13.0 entry for the shared two-30-second-job finding
that motivated the audit.

## 1.7.0 — creative brief, segmented catalog template, camera-orbit default

New:

- **"Before writing the prompt: the creative brief."** Before any prompt is
  written the skill fills a four-axis brief — product photo and target
  platform / aspect ratio (both must-ask, neither has a delegation option),
  background, motion — and asks only the open axes. The rules that govern
  that — the three tiers, **one** `AskUserQuestion` call of at most four
  questions with one dependency follow-up, "Let the AI decide" always last
  and never pre-selected, a delegated pick resolved to a concrete value
  marked `(AI's pick)`, the recap in the same message as the prompt and the
  cost table, the generic skip rows, the fixed flow (read → brief → ask →
  prompt → `--dry-run` → recap + prompt + table → yes → generate), and the
  anti-patterns — live once in
  `ofox-video-core/references/creative-brief.md` and are linked, not
  restated. This skill keeps its own question set and its own inference rows
  ("Etsy" → 1:1, "4:3 legacy catalog" → 4:3, "white background" → pure
  white, "spin" → turntable, "orbit" → camera orbit, an attached photo →
  image-to-video) so that **zero questions is a normal outcome**.
  Resolution, duration and audio are never asked — they are rows in the cost
  table.
- **"Prompt template."** A full template (10–15s, three or four segments:
  optional plain reveal → detail push-in → orbit or turntable → accessory
  pan, one action per 3–5s segment, consistency lock, negative list,
  technical tail marked "gallery habit, effect unverified"), a compact 5s
  orbit template, and a worked example adapted from the community
  hair-dryer reveal (case 17). Vocabulary is not restated: the template
  points at `ofox-video-core/references/prompt-structure.md` by section
  heading.

Behaviour changes a caller may notice:

- **Default motion is now "the camera orbits, the product stays still".**
  Every rotation in the gallery's product-adjacent prompts is written as
  camera movement (official case 42's `360-degree orbit`, case 39) or a hand
  turning the product (case 24); none writes a turntable with a fixed
  camera. The turntable sentence is kept as the alternative and is what the
  brief picks when the user says "spin" or "turntable".
- **The pure white background is now labelled a marketplace convention, not
  gallery evidence.** The gallery's cleanest product prompt (case 17) uses a
  reflective studio surface; case 41 pins its background rather than
  removing it. The brief offers pure white (recommended), light grey studio,
  or the photo's own background.
- **"Prefer a real product photo — practically require it" is replaced by a
  two-row rule**: a real SKU (logo, printed label, distinctive geometry,
  brand packaging) requires the photo; a category prototype or fictional
  brand may go text-only, with expectations set — the gallery's four
  product-video prompts (cases 16–19) are all text-only and all fictional.
  The section also states that **an AI-generated product image is not a
  substitute for a photo of the real item**: no gallery product case takes
  that route, and a generated image can be wrong in the same ways the video
  can, then lock the error in as the first frame.
- **Aspect ratio moved from "ask the user" in the defaults table to a
  must-ask brief item** with four platform options (1:1 marketplace
  recommended, 9:16 TikTok Shop, 16:9 detail page, 4:3 legacy catalog). The
  reason is unchanged: with a photo attached the output follows the photo's
  shape, so the photo has to be cropped or padded to the ratio before
  generating.
- **Several shots inside one job are now the documented route for cuts.**
  Verified on Ofox 2026-09-03 (two three-shot prompts, `seedance-2.5`,
  `byteplus`, 8s, 480p, 16:9, no audio, pure text-to-video with no image
  attached — both cut within about one second of the written timestamps).
  Not covered by those runs: more than three shots, clips longer than 8s,
  an attached reference image (this skill's usual route), cuts with
  dialogue, other resolutions, `volcengine`. The full template's four
  segments are one beyond the tested count and the file says so.
  "Multi-shot product sequences" is replaced by "Several shots: timestamps
  inside one job, `chain` across jobs" — `chain` is for sequences past the
  30s ceiling or shots that need their own approval, seed or resolution.
- **Both image semantics are named**: `--frame-first-image` (first frame,
  verified, the default here) and identity references via
  `--extra-json '{"input_references":[…]}'` for several angles of one
  product (up to 9 images; element shape from `api-params.md`; not run end
  to end in this repo). The two are mutually exclusive
  (`references_conflict`). New failure-table rows for `references_conflict`,
  `input_moderation_failed`, "the output is the photo's shape" and "the clip
  did not cut where written".
- **Real-person reference photos** (a hand modelling a ring): the file now
  says Seedance 2.5 image-to-video refuses them at submission and that
  `--real-person true` is untested on 2.5; the reliable route is a photo of
  the product alone.
- Duration default is `5` for the compact orbit and `10`–`15` for the
  segmented template, instead of a single `5`.
- `description` now mentions the brief and "a simple camera orbit or
  turntable motion"; scope (catalog footage, no people, no brand mood) and
  triggers are unchanged. When NOT to use adds the border case with
  `seedance-ad-creative` (a clean showcase with a lid reveal, case 17): the
  test is whether there is a brand narrative or emotional tone to carry.

What to do: nothing breaks. Agents that previously jumped from request to
`--dry-run` should now fill the brief first and expect to ask 0–3 questions
before quoting — and must settle the platform ratio before any photo is
attached. Callers who copied the old turntable example still get a valid
prompt; it is now the alternative rather than the default.

## 1.6.0 — link the shared approval gate instead of restating it

- "Cost: quote it, get a yes, then spend it" and "Before you spend: show the
  prompt, not just the price" are replaced by one section that links
  [`ofox-video-core/references/approval-gate.md`](../ofox-video-core/references/approval-gate.md),
  the spec now shared by every Ofox skill in this repo. Both sections were
  right; keeping four private copies of them was the problem.
- What stays here is scenario-specific: one table row per shot for a
  multi-shot sequence, since each shot is a separately billed job.
- Batches get an itemised table, not just `BATCH_COST_TOTAL`.

## 1.5.0 — tell people they can get a price without signing up

- New section: `models`, `providers` and `--dry-run` all work with no API key,
  so quote the job first and point at signup second. Opening with "go get an
  API key" asks someone to register before they know what it costs.
- New troubleshooting entry for
  `bash: ../ofox-video-core/…: No such file or directory` — it means the core
  skill isn't installed alongside this one, not that anything is broken. That
  raw error names neither the missing skill nor the fix, and a non-programmer
  reads it as "this is broken".

## 1.4.0 — exit codes, timeouts, contact sheets, and showing the prompt

Follow-up to `ofox-video-core` 1.8.0, closing gaps a second role-play review
found in this skill specifically:

- **Exit codes are listed here now.** This skill pointed at
  `references/api-params.md` for them; that file only has the `error.code`
  table, so an agent looking up exit 6 found nothing where it was sent.
- **Timeout guidance.** `generate` can block nine minutes, longer than a
  default agent tool call allows. Names `create` + `poll` as the way out, and
  the `takes x max-wait` arithmetic for `batch`.
- **Duration expectations**, so the wait isn't silent for the user.
- **Hand over the `CONTACT_SHEET` path.** In a batch flow it is the artifact
  the user looks at first, and this skill never said to give it to them.
- **Per-take seeds** are now reported by `batch`, which makes "take 3 was the
  good one, render it properly" a real command instead of a reroll.
- **Show the prompt, not just the price.** The user is paying for the prompt;
  a clip that costs exactly what was quoted and shows a character they never
  pictured is still a wasted job.

## 1.3.0 — quote before spending, and stop littering the user's repo

Rewrites the cost and delivery guidance around `ofox-video-core` 1.7.0's new
`--dry-run`. Previously this skill told the agent to relay an estimate that
the script only prints once the job is already billable — following it
literally billed the user with no warning.

- Cost flow is now: `--dry-run` to quote, wait for a yes, re-run without it.
- **`--out-dir` in every example.** This skill never mentioned it, and the
  script defaults to the current directory — so an agent copying an example
  dropped a bare-UUID mp4 into the user's project root.
- **`batch` is documented here now.** "Give me a few to choose from" is a
  normal request, and this skill previously offered no path to it but running
  `generate` repeatedly: no batch total, no contact sheet, no stop-on-failure.
  Includes the draft-cheap-then-render-expensive ladder.
- Quote `BATCH_COST_TOTAL`, not `BATCH_COST_PER_TAKE`.
- Report costs as money, not as the raw ten-decimal string.
- States how the relative script path resolves, instead of leaving it to the
  core skill's documentation.

## 1.2.0 — multi-shot product sequences

Documents `ofox-video-core` 1.6.0's `chain`: each shot opens on the previous
shot's closing frame, so the product keeps its position and lighting across
cuts, and the shots are joined into one file. Applies here because the
real-person restriction that blocks chaining live-action sequences does not
apply to objects.

## 1.1.1 — cost guidance uses the script's own estimate

`ofox-video.sh` now prints a cost estimate before submitting, read from live
rates. This skill's guidance no longer tells the agent to compute one by hand
from a table that can go stale — relay the printed figure, and if it says the
estimate is unavailable, say that rather than substituting a number.

## 1.1.0 — jobs are pinned to the byteplus upstream

**Behavior change, inherited from ofox-video-core 1.4.0.** Jobs now go to the
`byteplus` upstream (ByteDance's platform for markets outside mainland China)
instead of wherever Ofox's weighted routing sent them. The two upstreams
moderate differently and routing was explicitly unpredictable, so the same
prompt could pass one run and be rejected the next. Pass `--provider
volcengine` for the mainland platform or `--provider auto` for the old
behavior. Pricing is identical either way.

No change to prompts or defaults otherwise.

## 1.0.2 — ClawHub frontmatter

- Frontmatter now carries a top-level `version` and
  `metadata.openclaw.homepage`/`envVars`/`primaryEnv`. ClawHub's publish
  scanner reads those, not `metadata.version` or the top-level `homepage`
  this skill already had.
- No change to prompts, defaults, or behavior.

### Inherited from ofox-video-core 1.2.0

This skill delegates execution, so it picks up per-model parameter validation
for free: a bad `--duration`/`--resolution`/`--aspect-ratio` for the chosen
model is now caught locally, with that model's own legal values named, instead
of costing a round trip to come back as a generic `invalid_request`.
