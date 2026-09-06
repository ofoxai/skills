# Changelog

All notable changes to the **seedance-anime-drama** skill. Versioning follows SemVer.

This file starts at 1.0.2; earlier versions predate it.

## 1.11.0 — the image refusal was blamed on the wrong clause, and there was a second way out all along

Docs only; no script changes. Two of the three changes land on one row of the
failure table — the `image_generation_user_error` row added in 1.10.0; the
third is a pointer into the shared prompt-structure file.

**Correction.** 1.10.0 told you to drop the age numbers, ease off minor-coded
wardrobe detail and write the clash as two forces meeting rather than a blow
landing on a body, on the strength of a retry that passed. Three things changed
in that retry, so none of them was isolated. A single-variable bisect on
2026-09-06 (write-up in `ofox-image-core`'s `references/api-params.md`) pinned
the trigger to one wardrobe word — `cropped`, in `cropped jacket` — with the
prompts either side of that step identical apart from the word. The school
setting and the powers were each swapped alone in a step that passed, so those
two are cleared. On `gpt-image-2` the weapons and the covered faces only ever
appeared in prompts that were refused — taking them out did not lift the
refusal, so neither is the cause on its own, and neither is cleared either. The
ages and the blow-landing strike are untested: every step of the bisect started
from the retry that had already dropped both. All three states are now recorded
as what they are. The advice is: change the wardrobe wording first.

**One pointer corrected.** The four shared subsections named under "Prompt
template" now say which section each sits in. "What a prohibition cannot buy:
timing and behaviour" moved in `ofox-video-core` 1.19.0 from "A camera move
needs its waypoint frames, not just a verb" — a section this skill's load list
never named — into "Consistency locks and the negative list", which it does.
The list of sections to load is unchanged; it is now accurate about where that
subsection is.

**A second repair path.** `openai/gpt-image-2` refused a bladed character sheet
twice with this same error while `microsoft/mai-image-2.5-flash` produced it
with the blade kept — already known in this repo, written down only in a task
record, and therefore not reached for across six refusals in one session. The
row now carries `--model microsoft/mai-image-2.5-flash` as a route alongside
rewriting the clause, and says which to prefer: switch the model when the
refused element is one the shot needs, bisect when you want to know what the
trigger was.

## 1.10.0 — two refusals this skill will actually meet, and the cause chain moves out

Docs only; no script changes. A 30s water-versus-fire corridor fight
(`c192dbe6-ae09-4dba-8e81-3a3e82ff5912`, 720p, seed `457047702`, 7.20 USD,
opening frame `openai/gpt-image-2` at 0.15352 USD) and its attempted
continuation, all 2026-09-06.

**Two failure rows, both for things this skill's normal input invites.**
The image step can be refused by the safety system —
`image_generation_user_error`, nothing billed — when a character frame names
ages explicitly and describes a blow landing on a person. An action excerpt
with school-age characters is exactly what this skill is handed, so the row
says what got through on the retry rather than just what failed. And the video
step can be refused for **copyright** when a frame this model itself delivered
is fed back in as the next job's `--frame-first-image`: `5440c21e` on byteplus
and `c4cff71a` on volcengine, the same code both times, neither billed. The
usual switch-upstream fix does not apply when both upstreams refuse, so the
row points at the two routes that do work.

**The cause chain now lives in the shared file.** Its row in the pattern table
pointed at cases 44 and 11 — writing someone had done, never checked here.
`c192dbe6`'s finishing kick read frame by frame put every link on a timestamp,
so the full treatment moved to "The cause chain: ordering what happens inside
a segment" in `ofox-video-core`'s `prompt-structure.md` and the row now links
to it. Linked, not copied, per this repo's own rule.

**The load list gained a pointer** to the four shared subsections that carry
most of an action beat, including "The plastic look is designed out, not
forbidden" — which matters here even though nothing in this scenario is
photoreal, because for animation the plastic read is the 3D-CG read.

## 1.9.1 — a dependency's chain reorder broke every image command in this file

Docs only; no script changes. `ofox-image-core` made `openai/gpt-image-2` the
head of its model chain on 2026-09-04. That model rejects `--quality
standard` — HTTP 400, `Invalid value: 'standard'. Supported values are:
'low', 'medium', 'high', and 'auto'`, nothing billed — and all four image
commands in this file passed `standard` while pinning no `--model`, so every
one of them resolved to the new head and failed at submission. Nothing here
changed: they had worked verbatim right up to the reorder, because
`microsoft/mai-image-2.5-flash`, the previous head, accepts `standard`. This
is what a copy-pasteable command in one skill costs when the model it
silently resolves to is chosen in another.

- **Step 1 now passes two different values, on purpose.** An opening frame is
  `high` — it is the clip's literal first frame, so its fidelity reaches the
  deliverable, and `high` is what the one real run of this step used. A design
  sheet is `medium` — a checking artifact, discarded once the design is
  confirmed. The `Recommended defaults` row and the brief recap match. That
  row's old reasoning ("the frame is a starting point, not the deliverable")
  argued for a midpoint value that no longer exists on this model, so the
  reasoning is rewritten rather than having the flag swapped underneath it.
- **Approval 1's cost paragraph named the wrong model and the wrong number.**
  It said "about 2.7 cents for `microsoft/mai-image-2.5-flash`", which is no
  longer the chain's preferred model. Both of the current head's measured
  points are now stated with the pair each was measured at: about 0.6 cents at
  `low` / `1024x1024`, and **15.4 cents** at `high` / `1792x1024` (5063 output
  tokens, the job's own reported `IMAGE_COST`) — a 26x spread from two flags,
  whose cheap end was quoted on a real run for a frame that billed the dear
  end. **The instruction is to relay the printed line verbatim, label and
  all, not to substitute a figure by hand**: `ofox-image-core` 1.7.0 made the
  lookup pair-aware the same day, so hand-correcting it now reintroduces the
  error it was meant to prevent. Which label each of this skill's own
  commands produces is spelled out — `16:9` at `high` resolves to a measured
  pair and comes back plain `ROUGH`, while `9:16` at `high` and a `medium`
  sheet have never been measured and come back `ROUGH UPPER BOUND` at the
  same 15.4-cent ceiling. Both are correct; neither gets flattened into the
  other.
- **`--quality medium` has no measured token count on this model at any
  size**, so the sheet's line is a labelled ceiling rather than an estimate.
  Relay it as a ceiling; nothing is interpolated between two measured points.
- New failure-table row for the `standard` rejection: that
  `openai/gpt-image-2` accepts only `low`/`medium`/`high`/`auto` by its own
  enumeration, that nothing is billed, that the cause was the dependency's
  reorder, and the two fixes (one of the four accepted values, or pin
  `--model microsoft/mai-image-2.5-flash`). It records **exit `1`, no network
  call** — `ofox-image-core` 1.7.0 validates `--quality` against the resolved
  model, so a `--dry-run` catches it for free — with the pre-1.7.0 exit `3` /
  HTTP 400 shape noted as the older behaviour rather than the current one.
- **Every opening-frame command now passes `--target-aspect`**, and the
  hand-crop instruction is gone with it. This file used to say "check the
  delivered file's real dimensions and crop it" and "crop or pad it before
  Step 2"; `ofox-image-core` 1.6.0 added the flag that measures the written
  file and centre-crops it exactly, and 1.7.0's guidance for scenario skills
  says a skill producing a video first frame should treat one of the two
  target flags as mandatory. It applies to the Step 1 commands, the worked
  example and the Approval 1 dry run — which has to carry the *same* flag as
  the real call, because the flag decides the `--size` the estimate is priced
  at. The sheet command deliberately does not take it, and now says why: a
  sheet is never attached to a video, so its ratio decides nothing. "Crop or
  pad" is now "cropping only, never padding" throughout, matching the shared
  reference, and the one remaining hand-crop is the honest one — an image the
  user supplied.
- **The `--size` paragraph described the old head's behaviour as if it were
  everyone's.** Its three-way mismatch (request `1792x1024`, API reporting
  `1354x774`, file `1344x768`) was measured on `mai-image-2.5-flash`, and
  quoting a cost at `1792x1024` while that paragraph said a `1792x1024`
  request does not come back at `1792x1024` left the file contradicting
  itself. Both measurements are now attributed: the old head's three runs,
  and the current head's single run where all three numbers agreed. The crop
  step survives either way — `1792x1024` is 1.75, not 16:9, so an
  exactly-honoured request still needs cropping to `1792x1008`.

**What callers do**: stop passing `--quality standard` unless
`--model microsoft/mai-image-2.5-flash` is pinned alongside it, and pass
`--target-aspect` on anything that becomes a video's first frame. Relay the
`Estimated cost:` line as printed, including an `UPPER BOUND` or `Weak
ceiling` label — picking the right measured pair and cropping the frame are
both the script's job as of `ofox-image-core` 1.7.0, not the caller's.

## 1.9.0 — the multi-cut-plus-frame combination is measured, the crop rule is measured, and the one-take has a movement floor

Docs only; no script changes. One rejected anime clip
(`16023efe-48d6-45fe-8fd8-f5c6fbfe6519`, 20s 720p, rejected on subject matter
and pacing while every technical result held) and two accepted product ads
that share this skill's mechanism close three gaps here.

- **"A multi-cut job that also carries a `--frame-first-image` is untested"
  was this skill's own words about its normal shape, and it is no longer
  true.** It has now been run twice — 15s/5 shots/4 cuts and 20s/7 shots/6
  cuts (`7ae7d49e-7eb9-4165-9d95-09cd525d53ed`,
  `ac927785-92ef-4e28-97b9-ff8172ec5554`) — with every cut happening *and*
  the frame holding across all of them. "Shots, cuts and jobs" now states the
  measured envelope (10 shots in 30s, up to 6 hard cuts) and narrows the
  remaining gap to the art style rather than the cutting.
- **The frame lock is measured, and so is the crop it needs.** This skill's
  own run matched the fed image on composition, both characters, wardrobe,
  fence, sunset and petals. The `--size` warning is now a measurement rather
  than a caution: a request for `1792x1024` came back with the API reporting
  `1354x774` and the file on disk at `1344x768` — three numbers, none
  matching, on all three image runs. Cropping to `1344x756` produced an exact
  `1280x720` clip; feeding it uncropped delivers 1.75:1.
- **`--frame-first-image` is confirmed at the t2v rate at 720p as well as
  480p**: 20s billed $4.80 ($0.24/s), where v2v would have been $0.30/s.
- **New warning: a one-shot clip needs the camera to cross space.** The
  rejected run's whole movement plan was one very slow push while the actors
  held a standing position; the accepted gallery one-takes all travel. The
  measurement is in the shared file's "Shot density, measured per case".
- **Music is out of the templates and out of the brief.** Asking this model
  for a scored cue has failed output moderation on audio copyright (unbilled,
  on an ad job), so the `AUDIO` slot in both templates, the `AUDIO` row of the
  slot table, the `Sound` question and both worked examples now use diegetic
  sound only and say where a score belongs — an editor, afterwards. Case 10's
  music-box melody is called out as the one part of that prompt not to copy.

## 1.8.0 — a transition menu on the template line, and a shot count to aim at

Docs only; no script changes. This follows the same review that produced
`seedance-short-drama` 1.8.0, where a real clip rendered correctly and was
rejected for being visually plain. Two of the four faults found there were
present here too; the other two were not (this template already carries
`<shot size, camera position, movement>` in every segment, and its `RULES —
action` block already prescribes 2–5s shots with a cause chain and an
escalation curve). What moves:

- **The transition slot offered two of the nine kinds.** The line was `HARD
  CUT.` or `Without cutting, …`, so the other seven kinds in the shared
  "Transitions" table were reachable only by an author who already knew to go
  looking. It is now a `TRANSITION` slot that names the choice as a choice,
  with occlusion, pass-through, case 29's in-frame element move and case 11's
  speed ramp spelled out inline. A new "Choosing a transition, not defaulting
  to a cut" subsection lists all nine kinds and which have animation-adjacent
  instances (hard cut 18/11/63, cuts forbidden 29/44, speed ramp 11,
  narrative ordering 9, morph 54/13), says plainly that occlusion,
  pass-through, flash and match cut have none, and notes that animation is
  where the in-frame options are cheapest because nothing has to stay
  photoreal across the change.
- **The density guidance was a segment length with no count.** "Two to five
  seconds per shot for action" is now paired with what that means as a
  number: case 11 is 10 shots in 24s, case 18 is 8 in 30s, case 9's chain is
  six sizes in 30s, and the worked example adapted from case 10 is the quiet
  end at four segments in 30s. Both ends are real; an action beat written as
  four 7-second segments is below every action prompt in the gallery.

## 1.7.0 — creative brief, structured template, several shots per job, and the sheet is no longer a first frame

Docs only; no script changes.

- **Fixed a contradiction.** "Two different images, do not confuse them" said
  a character reference sheet must never go to `--frame-first-image` (verified
  on a real run: the clip animates out of a grid with a caption). The full
  example at the bottom did exactly that. The example now generates an
  opening frame for a single shot; for several shots the sheet exists only to
  confirm the design with the user, and each shot gets its own opening frame
  written from the same description. "The mechanism", Step 2, the failure
  table and `description` say the same thing. "Reuse the identical
  `IMAGE_PATH` across every shot" is gone — two different shots do not start
  on the same frame.
- **Behaviour change: several hard-cut shots in one job.** "One job = one
  continuous shot … never try to cram multiple hard cuts into one call" is
  replaced by "Shots, cuts and jobs": verified on Ofox 2026-09-03 (two 8s /
  480p / three-shot runs, cuts at the timestamps to about ±1s — see
  `ofox-video-core/references/prompt-structure.md`, "Several shots in one
  job"), with the unverified range (30s or 8+ shots, dialogue across a cut,
  other resolutions, `volcengine`) stated as such. `chain` stays the tool for
  continuation across jobs and for sequences past 30s.
- **Step 0 becomes the creative brief.** The anime-versus-manga binary is
  gone — manga/screentone has no gallery case; the split the gallery shows
  is cel-shaded modern theatrical / hand-drawn 90s TV anime / 3D-stylised,
  with pixel 8-bit and American retro cartoon as alternates. Five questions:
  shots (must-ask), aspect (must-ask, **before** any image exists — adaptive
  follows the image; cropping later costs a second image), style, sheet-first
  (follow-up, several shots only), sound. The shared rules — tiers, the
  one-round limit, the "Let the AI decide" discipline, the recap in the
  approval message, the skip rows, the anti-patterns — live once in
  `ofox-video-core/references/creative-brief.md` and are linked, not restated;
  this section keeps the question set, the anime inference rows, the
  answer-to-prompt map, and the one timing constraint that is specific to a
  two-phase scenario: the ratio must be settled before the first image is
  paid for. Showing the generated image is the second participation point,
  not a new question round. The two must-ask questions (`Shots`, `Aspect`)
  carry **no** "Let the AI decide" option, per the shared rule: a blanket
  "you decide" delegates the taste questions and leaves those two standing,
  because a paid image freezes the ratio.
- **New "Prompt template"**: a 15–30s manifest with the style sandwich (first
  sentence, mid-prompt block, closing quality line), action-scene rules (cause
  chain, escalation, effects allow-list, terminal pose), quiet-scene rules, an
  optional sequel block adapted from case 44, an AUDIO block and the negative
  list; plus an 8–15s single-shot template for frame-lock prompts. Worked
  examples adapted from case 10 (translated).
- **Two ways an image can enter a shot.** `--frame-first-image` (frame lock,
  this skill's mechanism) versus `input_references` through `--extra-json`
  (identity reference, what the gallery's image-bearing anime prompts use);
  mutually exclusive per job. The identity route is documented in
  `api-params.md` and has not been exercised end-to-end from this skill —
  the file says so rather than claiming it.
- Default `--duration 8` kept, with the note that the gallery's segmented
  anime prompts run 24–30s and a multi-shot job sums 2–5s per shot.
- Multiple characters: still out of scope for v1; noted that gallery cases 1,
  11 and 44 did it with several identity references, which maps to
  `input_references` (untested here).
- A sub-dollar price in Approval 1 written with a dollar sign and a leading
  zero is now "about 2.7 cents" (CONTRIBUTING rule 8 — that sequence is
  expanded when a skill loads).
- Sentences that restated `approval-gate.md` — where an estimate comes from,
  the missing-estimate rule, batch itemisation, phase 1 still billing when
  phase 2 is declined — are pointers now. The gate itself has not changed.
- Two claims were narrowed to what was actually run: the `chain` continuity
  observation is `ofox-video-core`'s, and its recorded run was a static
  object, not a character; the identity-reference row no longer implies
  chained *anime* shots were the thing verified.

**What callers do**: an agent following the old example must stop passing a
sheet to `--frame-first-image`; generate an opening frame instead. Expect the
aspect ratio to be asked before the image when the request names no platform.
Several shots inside one job are now an option alongside `chain` and separate
jobs.

## 1.6.1 — the image step usually *can* be priced now

Docs only. Phase 1 of the approval table told the agent to **expect** "cannot
be predicted" for the character image, because when 1.6.0 shipped only
`google/gemini-3.1-flash-image` had a measured token anchor and the chain's
default did not. `ofox-image-core` 1.3.0 measured the chain's top two models,
so the dry-run now prints a real `ROUGH` figure (~$0.027) in the normal case.
Instructing an agent to write "cannot be predicted" into an approval table when
a number was printed is the opposite of the honesty this gate exists for. The
"cannot be predicted" branch is still documented — it is what happens whenever
the chain resolves to an unmeasured model — just no longer described as the
expected one.

## 1.6.0 — stop hardcoding the image model; two approvals, not one

**Behavior change: `--model` is no longer passed to `ofox-image-core`.** This
skill hardcoded `google/gemini-3.1-flash-image` — the sixth-cheapest image
model Ofox serves, 2.3x the price of the cheapest, with no recorded reason.
`ofox-image-core` 1.2.0 resolves a model from its own cheapest-first priority
chain and prints the id it settled on, so this skill omits `--model` and
relays what it gets. Pass `--model` only when the user names one.

- **Two approvals, not one.** Phase 2's prompt depends on what phase 1
  produced — the clip literally opens on that image — so a single combined
  estimate would have the user paying for shots of a character they have not
  seen. Approval 1 covers the image and previews phase 2's size; approval 2
  covers the shots and carries phase 1's **actual** `IMAGE_COST` plus the
  running total.
- The general rules moved to the shared
  [`ofox-video-core/references/approval-gate.md`](../ofox-video-core/references/approval-gate.md);
  what is left here is the two-phase shape, which is this skill's own.
- **The image phase now usually says "cannot be predicted".** The old "~6.7
  cents per reference sheet" planning figure was `google/gemini-3.1-flash-image`'s
  measured cost, and that is no longer the model in use. Quoting it for
  another model would be inventing a measurement — say the cost cannot be
  predicted, and still wait for a yes.
- The `SIZE` gotcha is now stated as verified for
  `google/gemini-3.1-flash-image` specifically and unconfirmed elsewhere,
  rather than as a property of whichever model runs.
- Restates, with its evidence, that attaching `--frame-first-image` bills at
  the **t2v** tier (a real i2v run billed 4s at 11 cents/s at 480p) — only a
  video input moves a job to v2v.

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
- **Prompt language now documented.** Audio follows the language the prompt is
  written in, and every example here is English — so an agent handed Chinese
  dialogue could reasonably translate it and ship an English-dubbed clip the
  user has already paid for. Quoted dialogue stays in the user's language; the
  word-per-second budget is noted as English-calibrated, with a character
  count for Chinese and Japanese.
- The two-part cost breakdown (image once per character, video once per shot)
  is preserved and folded into the new flow.

## 1.2.0 — multi-shot sequences can now be chained

`ofox-video-core` 1.6.0's `chain` feeds each shot's closing frame into the
next and joins the results. **It works for this skill and not for live-action
ones** — Seedance 2.5 refuses real-person reference frames, but an anime
character is not a photoreal person. Documents how chaining composes with the
existing character sheet: the sheet locks *who* the character is across
unrelated setups, `chain` locks *where everything is* between consecutive
shots.

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

### Inherited from ofox-video-core 1.2.0 and ofox-image-core 1.1.0

This skill delegates execution to both cores, so it picks up their fixes for
free:

- Per-model video validation: a bad `--duration`/`--resolution`/
  `--aspect-ratio` for the chosen model is caught locally with that model's own
  legal values named, instead of costing a round trip.
- The character-reference-image step can now use any image model Ofox serves,
  not just the three that used to be hardcoded — `google/gemini-3-pro-image`
  and `volcengine/doubao-seedream-5.0-pro` among them.
