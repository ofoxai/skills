# Changelog

All notable changes to the **seedance-ad-creative** skill. Versioning follows SemVer.

This file starts at 1.0.4; earlier versions predate it.

## 1.7.0 — creative brief, timestamped ad template, multi-shot inside one job

New:

- **"Before writing the prompt: the creative brief."** Before any prompt is
  written the skill fills a four-axis brief — product photo (must-ask, no
  delegation option), brand tone, hero camera move, aspect ratio — and asks
  only the open axes. The rules that govern that — the three tiers, **one**
  `AskUserQuestion` call of at most four questions with one dependency
  follow-up, "Let the AI decide" always last and never pre-selected, a
  delegated pick resolved to a concrete value marked `(AI's pick)`, the recap
  in the same message as the prompt and the cost table, the generic skip
  rows, the fixed flow (read → brief → ask → prompt → `--dry-run` → recap +
  prompt + table → yes → generate), and the anti-patterns — live once in
  `ofox-video-core/references/creative-brief.md` and are linked, not
  restated. This skill keeps its own question set and its own inference rows
  ("premium" → Luxury, "young" → Playful, "orbit" → slow orbit, "spin" or
  "white background" → out of scope, that is `seedance-product-video`), so
  that **zero questions is a normal outcome**. Resolution is never asked —
  720p and 1080p are two rows in the cost table.
- **"Prompt template."** Template A (15–30s: header manifest, then hook →
  showcase → slow-motion climax → hero close with slogan or logo, 3–5s per
  segment, AUDIO / CONSISTENCY / AVOID blocks), Template B (10s or less,
  three beats, marked as inferred — the gallery has no ad under 20s), a UGC
  variant slot table (cases 24–27), and a worked example adapted from the
  official fruit-biscuit ad (case 12, translated, timestamps added).
  Vocabulary is not restated: the template points at
  `ofox-video-core/references/prompt-structure.md` by section heading.

Behaviour changes a caller may notice:

- **Prompt order is no longer product-first.** All nine gallery ad prompts
  open with a style/format line (or the reference-image anchor) and place
  the product second or third; none leads with the product. Prompts of 15s
  and longer now use a header manifest (FORMAT → STYLE → CHARACTER → PRODUCT
  → SCENE → timeline → CAMERA → AUDIO → CONSISTENCY / AVOID); 10s and
  shorter follow the vendor's subject-first formula. The file says plainly
  that there is no A/B evidence for either order, only no case for the old
  one.
- **Several shots inside one job are now the documented route for cuts.**
  Verified on Ofox 2026-09-03 (two three-shot prompts, `seedance-2.5`,
  `byteplus`, 8s, 480p, 16:9, no audio, pure text-to-video with no image
  attached — both cut within about one second of the written timestamps).
  Not covered by those runs: more than three shots, clips longer than 8s,
  an attached reference image, cuts with dialogue, other resolutions,
  `volcengine`. Template A's own four or five beats are therefore flagged
  as beyond the tested count. "Multi-shot ad sequences" is replaced by
  "Several shots: timestamps inside one job, `chain` across jobs" — `chain`
  is for sequences past the 30s ceiling or shots that need their own
  approval, seed or resolution, not for every cut.
- **Duration default stays at 10s but is now flagged as a draft length**:
  every gallery ad with a stated length runs 20–30s. When the user gives no
  duration the recap says so and offers 15–20s as a row.
- **The product-photo section names both image semantics.**
  `--frame-first-image` (first frame, verified) and identity references via
  `--extra-json '{"input_references":[…]}'` (up to 9 images, element shape
  from `api-params.md`, not run end to end here), and states that the two
  are mutually exclusive (`references_conflict`). New failure-table rows for
  `references_conflict`, `input_moderation_failed` and "the clip did not cut
  where written".
- **Real-person reference frames**: the section now says Seedance 2.5
  image-to-video refuses them at submission and that `--real-person true`
  is untested on 2.5; the recommended route is a text-described person with
  the product locked to the image. The UGC variant table repeats this for
  creator-style clips.
- `description` now mentions the brief and the timestamped shape; triggers
  are unchanged.

What to do: nothing breaks. Agents that previously jumped from request to
`--dry-run` should now fill the brief first and expect to ask 0–3 questions
before quoting. Callers who copied the old product-first example still get a
valid prompt; the new order is what the collected ads look like.

## 1.6.0 — link the shared approval gate instead of restating it

- "Cost: quote it, get a yes, then spend it" and "Before you spend: show the
  prompt, not just the price" are replaced by one section that links
  [`ofox-video-core/references/approval-gate.md`](../ofox-video-core/references/approval-gate.md),
  the spec now shared by every Ofox skill in this repo. Both sections were
  right; keeping four private copies of them was the problem.
- What stays here is scenario-specific: dry-run both a 720p draft and a 1080p
  deliverable when that choice is still open, so the difference is a row in
  the table rather than a sentence.
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

## 1.2.0 — multi-shot ad sequences

Documents `ofox-video-core` 1.6.0's `chain` for beat sequences (establishing →
push-in → hero) that would otherwise cut between unrelated renders. Works for
product and environment shots; a sequence built around a photoreal human model
cannot be chained, since Seedance 2.5 refuses real-person reference frames.

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

## 1.0.4 — ClawHub frontmatter

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
