# Changelog

All notable changes to the **seedance-anime-drama** skill. Versioning follows SemVer.

This file starts at 1.0.2; earlier versions predate it.

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
