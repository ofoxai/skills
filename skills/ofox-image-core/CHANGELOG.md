# Changelog

All notable changes to the **ofox-image-core** skill. Versioning follows SemVer.

This file starts at 1.1.0; earlier versions predate it.

## 1.2.0 — a default model, a `--dry-run`, and the gate that pays for both

**Behavior change: `--model` is now optional.** Omit it (or pass `auto`) and
the script walks a cheapest-first priority chain and uses the first model that
is actually available. Passing `--model <id>` still pins any model, exactly as
before, so existing callers are unaffected.

- **The chain lives in one place**, `MODEL_CHAIN` in `references/ofox-image.sh`:
  `microsoft/mai-image-2.5-flash` → `openai/gpt-image-2` →
  `google/gemini-3.1-flash-lite-image` → `microsoft/mai-image-2.5`, cheapest
  first by the catalog's `output_image` rate. Skills built on this one resolve
  a model by calling the script; none of them keeps a copy of the list.
- **Fallback is reported, never silent.** A preferred model that is missing
  from the model list, doesn't serve `/v1/images/generations`, or is
  deprecated gets skipped, and the run prints `MODEL_FALLBACK_FROM`,
  `MODEL_FALLBACK_REASON` and `MODEL_PRICE_DELTA` ("1.80x the preferred rate").
- **The model is resolved before anything is quoted.** There is deliberately
  no path where the model is chosen after a price was approved.
- **New `--dry-run`**, matching `ofox-video-core`'s: validate, resolve the
  model, create and check `--out-dir`, build the payload, print the estimate,
  then return — before the `POST`. Nothing submitted, nothing billed, and no
  `OFOX_API_KEY` required, so a job can be priced before signing up.
- **The estimate is honest about being rough, or refuses.** Images bill per
  output token and the count only exists in the response, so the figure is
  anchored to a real measured call with the *same* model, from the new
  `references/token-anchors.json`, and is labelled `ROUGH`. A model with no
  measurement gets "cannot be predicted" and the reason — never another
  model's token count, which in an approval table would be indistinguishable
  from a measured one. Exactly one `Estimated cost:` line either way, printed
  on a real run too.
- `google/gemini-3.1-flash-image` is the only measured anchor so far (1120
  output tokens). The chain's top two models are recorded as **awaiting
  measurement**, which is why a default `generate --dry-run` says the cost
  cannot be predicted today. Two real calls fix that; nothing else does.
- **Why a default is acceptable now, when 1.1.0 documented refusing one as
  deliberate:** the objection was that defaulting silently picks a price. The
  new shared approval gate
  (`ofox-video-core/references/approval-gate.md`) puts the resolved model and
  its cost in front of the user before every spend, so it no longer does. That
  reasoning is written into SKILL.md next to the default, not just here.
- `models` now prints the chain and the model it resolves to right now.
- **An unquantifiable price gap names the right model.** When one of the two
  rates is missing, `MODEL_PRICE_DELTA` says which model lacks a published
  rate. It no longer blames the preferred model in every case, and no longer
  claims the missing rate was "part of why it was skipped" — `resolve_model`
  never looks at pricing when deciding what to skip, so that reason could
  not be true. A wrong reason in an approval table is worse than no reason.
- **A chain with nothing usable in it says so on stdout.** That case sets
  `MODEL_CHAIN_EXHAUSTED` (not the fallback fields — nothing was fallen back
  *to*), so the caller can tell the user that the model in the table is one
  the script already expects the API to reject. Previously the reason was
  recorded internally and dropped from the structured output, leaving only
  stderr prose.
- New `references/test/dryrun.test.sh` (25 cases: the dry run's early return,
  the single estimate line, every fallback reason, each price-delta branch,
  the exhausted chain, and that no anchor is ever borrowed across models).
  Free by construction.

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
