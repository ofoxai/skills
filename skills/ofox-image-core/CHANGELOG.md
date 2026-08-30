# Changelog

All notable changes to the **ofox-image-core** skill. Versioning follows SemVer.

This file starts at 1.1.0; earlier versions predate it.

## 1.1.0 — every image model Ofox serves, not a hardcoded three

- **`--model` is checked against the live model list.** It was previously
  matched against three hardcoded ids, so the script locally rejected the other
  eleven models the API actually serves — `openai/gpt-image-1.5`,
  `google/gemini-3-pro-image`, `volcengine/doubao-seedream-5.0-pro`,
  `microsoft/mai-image-2.5` and the rest all failed before a request was made.
- A model that exists but doesn't serve `/v1/images/generations` (a video
  model, say) is now rejected with that specific reason.
- **New `models` subcommand**: lists the image models and their per-output-token
  price. No API key needed — `GET /v1/models` is public.
- Same fallback ladder as `ofox-video-core`: fresh cache (24h) → live → stale
  cache → bundled `references/models-snapshot.json` → no check. Every fallback
  is announced. An unknown id is rejected against a live list but deferred to
  the API when only a snapshot is available.
- **Unchanged on purpose**: `--size`, `--quality`, `--output-format` and
  `--background` stay hardcoded from the docs. Unlike the video API, the models
  endpoint exposes no per-model capability data for image models — there is no
  `image_attributes` to match `video_attributes` — so only the model id can be
  validated dynamically.
- `--model` stays required with no default, now documented as deliberate: the
  image models differ roughly 4x in price with no obvious winner, so defaulting
  would silently pick a price.
- New `references/refresh-snapshot.sh` and `references/test/validation.test.sh`
  (18 cases; accept cases warm the model cache from the real endpoint and then
  point the API base somewhere unroutable, so no case can reach the real
  generations endpoint even with a live key exported).
- Frontmatter: top-level `version` and `metadata.openclaw.homepage`/
  `envVars`/`primaryEnv` for ClawHub.
