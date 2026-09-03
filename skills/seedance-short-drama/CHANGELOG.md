# Changelog

All notable changes to the **seedance-short-drama** skill. Versioning follows SemVer.

This file starts at 1.0.3; earlier versions predate it.

## 1.7.0 — creative brief, structured prompt template, several shots per job

Docs only; no script changes. What moves:

- **Behaviour change: several hard-cut shots in one job.** This skill said
  "one job = one continuous shot" and "Seedance may not honor a hard cut
  mid-clip". Two real runs on Ofox (2026-09-03, `bytedance/seedance-2.5` via
  `byteplus`, 8s, 480p, three shots each) cut where the timestamps said, to
  about ±1s — recorded in `ofox-video-core/references/prompt-structure.md`
  under "Several shots in one job". That section here is now "Shots, cuts and
  jobs": timestamps are cut boundaries, 2–5s per shot, `HARD CUT.` between
  them. What was **not** verified — 30s or 8+ shots, dialogue across a cut,
  resolutions other than 480p, `volcengine` — is listed as unverified rather
  than assumed. `chain` still does not apply here (real person); separate
  jobs remain the route when each shot needs its own approval, seed or
  resolution, or the sequence exceeds 30s.
- **New "Before writing the prompt: the creative brief".** The rules for it —
  three tiers (must-ask / ask-if-open / never-ask), one AskUserQuestion round
  of at most four questions with at most one branch follow-up, zero questions
  as the normal case when the input settles everything, the recommendation
  first and "Let the AI decide" always last and never preselected, a
  delegated choice resolved to a concrete value marked `(AI's pick)`, the
  recap riding in the same message as the cost table, the generic skip rows,
  the no-`AskUserQuestion` fallback and the anti-patterns — live once in
  `ofox-video-core/references/creative-brief.md`, which this section links
  rather than restating. What this skill carries is its own: six questions
  (beat, aspect, arc, camera, lines over budget, drafts), the short-drama
  inference rows (the language of quoted lines maps to the spoken language
  and is never asked; stage directions and tone words build the emotional
  arc), the answer-to-prompt map, and a worked recap. The `Beat` question is
  must-ask and therefore carries **no** "Let the AI decide" option, per the
  shared rule — if the user says "you pick", name the beat you chose in the
  recap and let the cost table be the check.
- **New "Prompt template"**, replacing "Writing a good short-drama prompt": a
  15–30s manifest + timestamped-shots template and a 10s-or-less single-shot
  one, each with a worked example adapted from the gallery (cases 3 and 20,
  translated). Vocabulary is linked from `prompt-structure.md`, not copied.
  Scenario slots: the emotional-arc arrow chain, 1–3 visible signals per shot,
  delivery notes on lines, off-screen partners, wardrobe colour blocks, ending
  state, a sound block, the negative list.
- **Dialogue budget is two tiers.** Dialogue drama averages 0.4–1.7 words/s
  (2–3 words/s is a ceiling, not a target; most seconds carry no line);
  talking head runs 3.5 words/s English or 5 characters/s Chinese/Japanese.
  The old single figure over-wrote drama and under-wrote monologue.
- **Defaults.** `--aspect-ratio 9:16` is now the brief's Aspect question,
  falling back to 9:16 when skipped or delegated; the gallery's short-drama
  sample is mostly 16:9 (5 of the 6 that state a ratio), which the table now
  says. Character description: clothing with colour and material is the one
  field every gallery prompt writes; the other fields are as needed.
- **Reference images.** Both meanings of an attached image are named — frame
  lock (`--frame-first-image`) and identity reference (`input_references`) —
  with what is actually verified: the frame path refuses real people; the
  identity path is untested with real people; `--real-person true` on 2.5 is
  untested. Cross-job consistency here stays text-based.
- `description` now says a clip may be one shot or a few hard-cut shots, that
  the skill runs a brief when the input leaves things open, and that
  anime/manga scenes belong to `seedance-anime-drama`.
- Sentences that restated `approval-gate.md` — where an estimate comes from,
  how a batch is itemised, how the real bill is reported — are pointers now.
  The gate itself has not changed.

**What callers do**: nothing mechanical — same script, same flags. An agent
that had learned to split every cut into its own job can put two or three
shots in one 8–15s job. Expect one question round before the cost table when
a request leaves beat, aspect, arc or camera open; "just do it" delegates the
taste questions, not the must-ask ones.

## 1.6.0 — link the shared approval gate instead of restating it

- "Cost: quote it, get a yes, then spend it" and "Before you spend: show the
  prompt, not just the price" are replaced by one section that links
  [`ofox-video-core/references/approval-gate.md`](../ofox-video-core/references/approval-gate.md),
  the spec now shared by every Ofox skill in this repo. Both sections were
  right; keeping four private copies of them was the problem.
- What stays here is scenario-specific: the quoted dialogue goes in front of
  the user in full, because a line silently rewritten or translated is the
  most expensive thing that can go wrong in this scenario.
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
- **Prompt language now documented.** Audio follows the language the prompt is
  written in, and every example here is English — so an agent handed Chinese
  dialogue could reasonably translate it and ship an English-dubbed clip the
  user has already paid for. Quoted dialogue stays in the user's language; the
  word-per-second budget is noted as English-calibrated, with a character
  count for Chinese and Japanese.

## 1.2.0 — chaining does not apply here, and now says so

`ofox-video-core` 1.6.0 added `chain`, which carries one shot's closing frame
into the next for visual continuity. **It cannot be used for this skill**:
Seedance 2.5 image-to-video refuses reference frames containing a real person
(`input_moderation_failed`, nothing billed), and this skill is
realistic-human by definition. Documented up front so a user doesn't discover
it mid-sequence — consecutive short-drama shots are generated independently,
with continuity coming from repeating the character description verbatim.

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

## 1.0.3 — ClawHub frontmatter

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
