# Changelog

All notable changes to the **seedance-anime-drama** skill. Versioning follows SemVer.

This file starts at 1.0.2; earlier versions predate it.

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
