# Changelog

All notable changes to the **seedance-product-video** skill. Versioning follows SemVer.

This file starts at 1.0.2; earlier versions predate it.

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
