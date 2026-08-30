# Changelog

All notable changes to the **seedance-anime-drama** skill. Versioning follows SemVer.

This file starts at 1.0.2; earlier versions predate it.

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
