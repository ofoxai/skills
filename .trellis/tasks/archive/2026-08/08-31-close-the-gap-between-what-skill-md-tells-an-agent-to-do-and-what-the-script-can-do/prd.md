# Close the gap between what SKILL.md tells an agent to do and what the script can do

## Goal

A sub-agent was given only the SKILL.md files and asked to role-play delivering
a video to a user. It found eight places where following the documentation
literally produces a bad or impossible outcome. Every one was verified against
the source. The worst is a regression introduced two tasks ago: the docs now
tell an agent to relay an estimate the script only prints **after** the money
is spent.

These are user-facing defects in the exact surface the repo sells — "we tell
you what it cost" — so they matter more than their size suggests.

## What I already know

All eight verified by direct inspection, not taken on report:

| # | Defect | Evidence |
|---|---|---|
| 1 | Estimate is unreachable before spending | `print_estimate` at `ofox-video.sh:944`, `curl -X POST` at :949 — five lines apart, no pause, no confirm. `dry.run` greps **0** hits in the whole script. |
| 2 | Estimate vanishes silently with no `--duration` | `if [ -n "$duration" ]` guards all three call sites (:657, :943, :1099). Not "unavailable" — nothing at all. |
| 3 | `BATCH_COST_PER_TAKE` doc contradicts itself | `SKILL.md:143-145` calls it "the number that matters", then says the number that matters is the **total**. |
| 4 | Ten-decimal figure in prose meant for humans | `ofox-video.sh:1164` interpolates `$total` (a `%.10f`) into "That is $… for N takes". |
| 5 | Scenario skills never mention `--out-dir` | `grep -c` = **0** for short-drama and ad-creative. Script defaults to `$PWD`, so output lands in the user's repo root as a bare UUID. `test-output/` has 4 such files as evidence. |
| 6 | No guidance on prompt language | short-drama mentions language **0** times; every example is English. Audio follows the prompt's language, so an agent translating a user's Chinese dialogue ships an English-dubbed drama — already billed. |
| 7 | Scenario skills don't know `batch` exists | `grep -c batch` = **0** across all four. "Give me a few to choose from" is the most typical short-drama request, and the agent would run `generate` four times: no total, no contact sheet, no stop-on-failure. |
| 8 | Relative script path unexplained | Scenario skills all show `bash ../ofox-video-core/references/ofox-video.sh`; how that resolves is documented only in the *core* skill. |

### On #1 specifically

The scenario skills used to tell the agent to compute an estimate by hand from
`pricing.md`. The "dynamic pricing" task replaced that with "relay what the
script prints" — correct in spirit (the hand-maintained table was going stale)
but it moved the estimate to a point the agent can only reach by spending. The
sub-agent, given only the docs, chose to work around it by pricing with
`providers` first — then noted plainly that it had invented that flow, because
nothing in SKILL.md says to confirm before submitting. A more literal agent
bills the user $3.60 with no warning.

For a project whose spec already records an unauthorized-paid-call incident,
this is the one to fix properly rather than paper over.

## Decisions (mine)

- **Add `--dry-run`** to `generate`, `batch` and `chain`: validate, price,
  print, exit 0 without submitting. This makes "quote before spending" actually
  executable, is testable for free, and is the standard shape for this. Then
  rewrite the scenario guidance around it: dry-run → quote → confirm → run.
- **Estimate unconditionally.** Remove the `-n "$duration"` guards; when
  duration is unknown, say the estimate is unavailable and why. Silence is the
  one outcome an agent cannot relay.
- **Round in prose, keep precision in the contract.** Human-facing lines get
  2 decimals; `VIDEO_COST` / `BATCH_COST_TOTAL` KEY VALUE lines keep the exact
  string, since those are the machine contract and the billing record.
- **Fix #3 by pointing at the right field**, not by softening the wording:
  `BATCH_COST_TOTAL` is what to quote for a usable clip; `PER_TAKE` is just
  total ÷ count.
- **Scenario skills get `--out-dir` in every example.** An agent copying an
  example should not litter the user's repo root.
- **A short language rule** in the two dialogue-driven skills: keep the user's
  language in quoted dialogue, because the generated audio follows it.
- **Scenario skills point at `batch`** for "several to choose from", with the
  cheap-draft/expensive-final ladder, rather than leaving it in the core skill
  where a scenario-only agent never sees it.

## Requirements

1. `--dry-run` on `generate`, `batch`, `chain` — full validation and estimate,
   no submission, exit 0.
2. Estimates print in all cases, including when they cannot be computed.
3. Prose rounds to 2 decimals; KEY VALUE lines keep full precision.
4. `SKILL.md:143-145` rewritten to name `BATCH_COST_TOTAL`.
5. `--out-dir` in every scenario-skill example.
6. Language guidance in short-drama and anime-drama.
7. `batch` (and the draft-cheap ladder) surfaced in the scenario skills.
8. Script-path resolution stated in the scenario skills, not only the core.
9. Scenario cost sections rewritten around dry-run → quote → confirm → run.
10. Tests, free by construction.

## Acceptance Criteria

- [x] `--dry-run` prints an estimate and exits 0 with no network call, on
      `generate`, `batch` and `chain`
- [x] Omitting `--duration` still yields an estimate line stating why it
      cannot be computed
- [x] No human-facing line prints more than 2 decimals; `VIDEO_COST` and
      `BATCH_COST_TOTAL` still emit the exact API string
- [x] All four scenario skills mention `--out-dir`, `batch`, and the script
      path rule; both dialogue skills document prompt language
- [x] `grep -c batch` > 0 in all four (was 0/4)
- [x] Existing suites green; shellcheck clean; zero CJK

## Verification

| Check | Result |
|---|---|
| dryrun tests | 19/19 (new) |
| chain / pricing / provider / batch / validation | 18 / 17 / 27 / 21 / 36 |
| image validation | 18/18 |
| cloudflare-drop | 57/57 |
| shellcheck | zero warnings |
| CJK under skills/ | zero |
| frontmatter version sync | 9/9 |
| Cost of this task | $0 — every defect was verifiable and fixable for free |

Live spot-check:

```
$ ofox-video.sh generate --prompt x --duration 15 --resolution 720p --dry-run
Estimated cost: ~$3.60 (15s x $0.24/s). ...
DRY RUN — nothing was submitted and nothing was billed.
STATUS dry_run

$ ... --dry-run          # no --duration
Estimated cost: unavailable — no --duration given, so there is nothing to
multiply the per-second rate by. Pass --duration to get a quote up front.
```

## One mistake made and corrected during this task

The scenario-skill cost sections were replaced by a regex matching any
`## …Cost…` heading through to the next heading. Three of the four had only
generic content there, so that was right — but `seedance-anime-drama` has a
**two-part** cost section (image once per character, video once per shot), and
the replacement swallowed the image half. Caught by grepping for content that
should have survived, and restored, with the image guidance folded into the
new dry-run flow.

Worth noting because it is the same shape as the bug this task fixed: a change
that is correct for the common case, applied uniformly, silently destroying
the one case that was different.

## Why a sub-agent found what the tests could not

The suites drive the script through its flags and assert on exit codes and
output. Every defect here lived in the *instructions* — and the only way to
exercise instructions is to have something follow them with nothing else to go
on. A sub-agent given the skill files, no repo context, and a hard bar on
spending found eight issues in one pass.

Two mechanical checks fell out of it and are now in the spec:

- `grep -c` the scenario skills for capabilities the core skill added — a
  feature documented only in the core is invisible to a scenario-only agent.
- `grep -c -- --out-dir` in any skill whose script writes files.

## Definition of Done

- All acceptance criteria checked
- CHANGELOG entries + version bumps
- Committed locally on the dev branch, not pushed

## Out of Scope

- Publishing to the four directories
- Re-running any paid generation — everything here is verifiable for free

## Technical Notes

- Findings came from a sub-agent restricted to zero-cost commands; the
  role-play transcript is not preserved, but every claim was re-verified
  against source before this PRD was written.
- Branch note: `.trellis/` exists only on `feat/seedance-video-skills`. The
  published `main` carries product files only, so development happens here.
