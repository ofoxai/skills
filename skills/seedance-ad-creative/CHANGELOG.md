# Changelog

All notable changes to the **seedance-ad-creative** skill. Versioning follows SemVer.

This file starts at 1.0.4; earlier versions predate it.

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
