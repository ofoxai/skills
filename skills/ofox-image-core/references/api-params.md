# Ofox image API — parameter reference

Source: `https://ofox.ai/docs/api/openai/images`,
`https://ofox.ai/models/google/gemini-3.1-flash-image` (verified
2026-08-29). Re-check the live docs before relying on exact values far in
the future — params, model ids, and pricing can drift.

This is the parameter surface `references/ofox-image.sh` builds a request
from. Use this table to decide what to pass; the script validates the
documented value lists and the known `n` + Gemini incompatibility before it
ever calls the API.

## Generate request fields (`POST /v1/images/generations`)

Synchronous — no job id, no polling. The image comes back in the response
body directly, always base64-encoded (no URL option, ever).

| Field | Type | Required | `ofox-image.sh` flag | Notes |
|---|---|---|---|---|
| `model` | string | yes | `--model` (optional flag) | The API field is required; the flag is not — omit it and the script resolves one from its cheapest-first priority chain (`MODEL_CHAIN` in `ofox-image.sh`, the only place that list exists) and reports any fallback. Run `ofox-image.sh models` for the live list — 14 image models at last check, and the script accepts any of them. Documented in depth here: `openai/gpt-image-2`, `google/gemini-3.1-flash-image` (this is "Nano Banana 2" — use this exact model id string, **not** `-preview`; the model catalog page's URL slug differs from the actual API model id), `bailian/qwen-image-3.0-pro`. Others work but their size/quality support is not documented here. |
| `prompt` | string | yes | `--prompt` | Text description of the image. |
| `quality` | string | yes per doc | `--quality` | One of `auto`/`low`/`medium`/`high`/`standard`/`hd` — that is the union across models, and **no model is known to accept all six**. The script requires you to pass one explicitly rather than guessing a safe default, and since 1.7.0 validates it twice: against the union, then against the resolved model's own accepted set where that set has been enumerated first-hand. So `openai/gpt-image-2` + `standard` is now a client-side rejection at `--dry-run` (exit `1`, no call) instead of a submission-time HTTP 400. Where a model has never enumerated its set, the union still stands — see "Confirmed gotcha: supported `--quality` values differ per model" below. |
| `n` | integer | no | `--n` | 1-10, server default 1. **`google/gemini-3.1-flash-image` does not support `n` at all — passing it (even `n: 1`) errors.** The script rejects `--n` client-side whenever the effective model is Gemini, and also rejects an `n` key set via `--extra-json` for that model. |
| `size` | string | no | `--size` | One of `auto`/`1024x1024`/`1536x1024`/`1024x1536`/`256x256`/`512x512`/`1792x1024`/`1024x1792`. **This enum cannot express 16:9 or 9:16** — see the ratio table below. `--target-aspect W:H` / `--target-size WxH` are not API fields: they are client-side, and they pick this value, then crop the written file to the ratio asked for. |
| `input_images` | string[] | no | not exposed — out of scope | URL or base64, 1-3 items, **Qwen only**, for image-to-image. **Any other field name is silently ignored** — the request silently degrades to text-to-image with no error, so get the field name exactly right if you ever add this. Out of scope for `ofox-image-core` v1 (text-to-image only); the script rejects `input_images` set via `--extra-json` with a clear message rather than silently sending a request that would ignore it. |
| `output_format` | string | no | `--output-format` | One of `png`/`jpeg`/`webp`. The script maps `jpeg` to a `.jpg` file extension; `png`/`webp` keep their own extension. Defaults to `png` when not set (the documented example uses `png`, it's lossless, and it's the safest cross-model assumption — the response body itself does not include an explicit format field to infer from). |
| `background` | string | no | `--background` | One of `transparent`/`opaque`/`auto`. No cross-field requirement with `output_format` is documented for this endpoint specifically (some background/format interactions are common in similar APIs, but this hasn't been confirmed here) — the script does not enforce one; if you get an unexpected error combining `background: transparent` with a non-alpha format, that's a starting hypothesis to test, not yet a confirmed rule. |
| `stream` | boolean | no | not exposed — out of scope | Default `false`. `ofox-image.sh` only parses a plain JSON response body, not a streamed one — the script rejects `stream: true` set via `--extra-json`. |
| `extra_body.provider.type` | string | no | via `--extra-json` | `openai`/`azure_foundry`, `gpt-image-2` only. Pass `{"extra_body":{"provider":{"type":"..."}}}` through `--extra-json`. |

`--extra-json` is merged into the built request body last (object merge —
its keys win over anything the flags set), so it's the escape hatch for any
field not exposed as a dedicated flag. It must be valid JSON; the script
checks that with `jq` before submitting, and additionally rejects
`input_images`, `stream: true`, and (for `google/gemini-3.1-flash-image`
only) `n` if set this way, for the reasons above.

### Confirmed gotcha: supported `--quality` values differ per model

`quality` is required, has no safe default, and **is not the same enum on
every model**. What this repo has actually observed:

| Model | Observed to accept | Observed to reject | Evidence |
|---|---|---|---|
| `openai/gpt-image-2` | `high`; and `low`, `medium`, `auto` per the rejection message's own list | **`standard`** | a real 400 on 2026-09-04 (below), plus a completed `--quality high` run the same day |
| `microsoft/mai-image-2.5-flash` | `standard` | — | the nine images this repo's asset work generated before the 2026-09-04 chain reorder, all on this model, all with `standard` |
| `google/gemini-3.1-flash-image` | `low` | — | the paid run recorded in `references/pricing.md` |

The rejection, verbatim from the run that hit it — `openai/gpt-image-2`,
`--quality standard`, HTTP 400, **nothing billed**:

```
Invalid value: 'standard'. Supported values are: 'low', 'medium', 'high', and 'auto'
```

Four things follow from that one line:

- **A wrong `--quality` costs a round-trip, not money.** Upstream refuses it
  before any image is generated, so it surfaced as `ofox-image.sh` exit `3`
  with the message above, free to fix and retry. The run that hit it
  reported no charge — evidence for, but not a full answer to, "Billing on
  rejection — open question" below.
- **Since 1.7.0 the script does not let that round trip happen for this
  model.** `model_qualities()` in `ofox-image.sh` holds the four values the
  message above enumerates, and `generate` checks `--quality` against the
  model it resolves to — so the combination fails at `--dry-run` with exit
  `1` and an error naming the model, including when the model came from
  `MODEL_CHAIN` rather than from a `--model` the caller typed. The table
  holds **one row**, deliberately: `mai-image-2.5-flash` accepting `standard`
  nine times is evidence a value works, not an enumeration of what it takes,
  and inventing a narrower set for it would reject calls that succeed. A
  false rejection is worse than this 400, which costs nothing but a
  round trip. Models with no enumeration keep the full union.
- **`standard` is not a portable value**, even though it is in the documented
  union and the model that used to head the priority chain accepts it. When
  `MODEL_CHAIN`'s preferred model changed to `openai/gpt-image-2` on
  2026-09-04, the value every previous call in this repo had passed became an
  instant 400 on a default `generate` — a per-model enum silently became a
  breaking change of a default.
- **`hd` has not been accepted by any model here**, and the message above
  omits it from `gpt-image-2`'s four, so expect it to fail there too. That
  expectation is read off the message, not tested.

Only the model **id** is validated against live data (see "The model list"
below); there is no `image_attributes` to check a quality value against, so
this table is the only per-model record and grows one confirmed row at a
time.

## Response (`POST /v1/images/generations`, HTTP 200)

Fixed shape, always base64, no URL option ever:

```json
{
  "created": 1777385517,
  "data": [{ "b64_json": "<base64>", "index": 0 }],
  "model": "openai/gpt-image-2",
  "size": "1024x1024",
  "quality": "low",
  "usage": {
    "input_tokens": 14,
    "input_tokens_details": { "text_tokens": 14 },
    "output_tokens": 208,
    "total_tokens": 222
  }
}
```

| Field | Meaning |
|---|---|
| `data[].b64_json` | Base64-encoded image bytes. `ofox-image.sh` decodes each entry and writes it to its own file; if `n` produced more than one image, filenames get a `_<index>` suffix, otherwise the base name is used as-is. |
| `model` / `size` / `quality` | The values Ofox actually used to generate the image — may not always exactly echo what was requested (e.g. `auto` resolving to a concrete value). The script prints these from the response, not from the request, for exactly this reason. **`model` is not always sent**: `openai/gpt-image-2` omits it entirely, so the script falls back to the requested id and flags that with `MODEL_SOURCE request`; when the field *is* present and names a different model, that one wins for both display and pricing. See `references/pricing.md` § "Which-model trap". |
| `usage.input_tokens` / `usage.output_tokens` / `usage.total_tokens` | Real token counts for this specific generation. The script prints these directly (`USAGE_INPUT_TOKENS`/`USAGE_OUTPUT_TOKENS`/`USAGE_TOTAL_TOKENS`) — never estimate or invent these numbers. It also multiplies them by the model's published rates into an `IMAGE_COST` line; `references/pricing.md` has the formula and the invoice it was verified against. |

There is no documented `output_format`/file-format field in the response
body itself — if you need to know the actual format Ofox produced and you
didn't request one via `output_format`, the safest source of truth is
inspecting the decoded file's own magic bytes (e.g. `file <path>`), not
guessing from any response field.

### The `size` enum cannot express 16:9 or 9:16

Every accepted value, with its true ratio:

| `size` | Ratio | What it actually is |
|---|---|---|
| `1024x1024`, `512x512`, `256x256` | 1.0000 | 1:1, exact |
| `1536x1024` | 1.5000 | 3:2, exact |
| `1024x1536` | 0.6667 | 2:3, exact |
| `1792x1024` | **1.7500** | nearest 16:9, which is 1.7778 |
| `1024x1792` | **0.5714** | nearest 9:16, which is 0.5625 |

**16:9 and 9:16 cannot be requested at all**, on any model, at any quality.
This is not a model defect but a structural gap between this endpoint's
`size` enum and the video API's `aspect_ratio` values, so every 16:9 or 9:16
frame produced here has to be cropped afterwards. There is no flag that
removes the crop; `--target-aspect`/`--target-size` only move it into the
script, which measures the written file and centre-crops to exact integer
multiples of the reduced ratio (`1344x768 → 1344x756`,
`1792x1024 → 1792x1008` — both of them real hand-crops before the flags
existed).

**The consequence lives in the video API, not here.** Attaching an image to
`bytedance/seedance-2.5` forces `aspect_ratio: adaptive`
(`ofox-video-core/references/api-params.md`), so the frame's own ratio
becomes the finished clip's ratio whatever the video flags say. A 1.75 frame
delivers a 1.75 clip, and correcting it costs another video generation. A
ratio error in a two-cent image is billed at the price of the clip it was
attached to.

### Confirmed gotcha: the response's `size` field is not reliable evidence of the real output dimensions

A real, paid call (2026-08-29, `google/gemini-3.1-flash-image`, `size:
512x512` requested) returned `"size": "512x512"` in the response body — but
the actual decoded PNG's real pixel dimensions, verified with `file` and
`sips -g pixelWidth -g pixelHeight` (macOS; `identify` from ImageMagick
works too), are **1024x1024**. The model appears to always generate at its
native 1024x1024 resolution and simply echoes back whatever `size` was
requested, regardless of what it actually produced.

This is confirmed only for `google/gemini-3.1-flash-image`, and
`microsoft/mai-image-2.5-flash` has a worse variant of it — requested
`1792x1024`, response echoed `1354x774`, saved file `1344x768`, three
disagreeing numbers rather than two (`references/pricing.md`).

**`openai/gpt-image-2` does not have the problem**: one real, paid run on
2026-09-04 at `--size 1792x1024` had the request, the response's echo and the
file's real pixels all agree at `1792x1024`. That does not retire the check
below, and the same run is why — 1792x1024 is 1.75, not 16:9, so the frame
still had to be cropped to `1792x1008` before it could be attached to a
`bytedance/seedance-2.5` job, which inherits the attached frame's own ratio
(`aspect_ratio: adaptive` is forced). **Measure the file and crop regardless
of the model**; what changes per model is how big the correction is, not
whether one is needed. `bailian/qwen-image-3.0-pro` is still untested.

`ofox-image.sh`'s printed `SIZE` line is taken directly from the response
body (see the table above), so it inherits this unreliability. Its
`SIZE_ACTUAL` line is measured from the written file with `ffprobe` and is
the one to believe; when the two disagree the script says so on stderr
instead of leaving it to be noticed. **If a caller genuinely needs a
specific output size or ratio guarantee** (a video first frame is the
standard case), pass `--target-aspect`/`--target-size` — the script then
measures the file and crops to the target, or fails loudly. Doing it by hand
means verifying the saved file's real dimensions directly rather than
trusting `SIZE`/the response's `size` field. This is the same "don't trust a documented/response field's claim
about media output without checking the real artifact" pattern as the
`mirror_urls`/`unsigned_urls` and `aspect_ratio: adaptive` lessons in
`.trellis/spec/skills/external-api-integration.md` for the video skill.

## Error handling

### Correction: the error response *shape* was initially mis-assumed from doc prose, not just an unconfirmed code

This skill's original research documented `400 provider_type_unavailable` as
a "confirmed" `error.code` for a provider/model mismatch. **That was wrong**
— it was inferred from Ofox's doc prose describing the scenario in words,
never from an actual response body. A real rejected call (2026-08-29, an
invalid `extra_body.provider.type: "bogus_provider_xyz"` on `gpt-image-2` —
exactly the provider-mismatch scenario that prose was describing) returned:

```json
{
  "error": {
    "message": "unknown provider type: bogus_provider_xyz [ofox.ai]",
    "type": "invalid_request_error",
    "code": 400
  }
}
```

The real shape is `{"error": {"message", "type", "code"}}` — an
OpenAI-SDK-style convention, **different** from the video API's `{code,
message}` shape where `code` genuinely was a semantic string
(`insufficient_credits`, etc). Here, `error.code` is literally the HTTP
status **as a number** (`400`) — not a semantic string, and
`provider_type_unavailable` does not appear anywhere in the real response.
The real classifier is `error.type`. No `usage` field was present on this
rejected response (consistent with, but not 100%-certain proof of, rejected
requests going unbilled).

`error.message` free text is not a stable contract to branch logic on — the
exact wording can change — but for this endpoint it remains the **primary**
source of diagnostic detail regardless of `error.type`/`error.code`.
`ofox-image.sh` always prints `error.message` (labeled `Upstream message:
...`) alongside `error.type` (primary classifier) and `error.code`
(reference only — usually just echoes the HTTP status here).

| HTTP | `error.type` | `error.code` | Meaning | Confirmed how |
|---|---|---|---|---|
| 400 | `invalid_request_error` | `400` (number, not semantic) | The request was rejected as malformed/unsupported — observed for an unknown/unsupported `extra_body.provider.type`; likely applies to other malformed-request cases too, not yet tested individually. | **Confirmed by a real call** (2026-08-29). |
| 400 | not recorded from the run | not recorded from the run | `openai/gpt-image-2` + `quality: standard` → `Invalid value: 'standard'. Supported values are: 'low', 'medium', 'high', and 'auto'`. Per-model, not endpoint-wide — `microsoft/mai-image-2.5-flash` takes `standard`. No image was produced and nothing was billed. See the `--quality` gotcha above. | **Confirmed by a real call** (2026-09-04). Only the HTTP status and the message were captured; `error.type`/`error.code` were not read off the body, so they are recorded as unknown rather than assumed to be the row above's. |
| n/a (message-only, no distinct type/code documented) | — | — | `google/gemini-3.1-flash-image` + `/v1/images/edits` → "Image editing is not supported for model". | Doc prose only, **not** confirmed by a real call. Not reachable through this script (edits endpoint out of scope). |
| n/a (message-only, no distinct type/code documented) | — | — | `google/gemini-3.1-flash-image` + `n` param → errors. | Doc prose only, **not** confirmed by a real call. Prevented client-side by this script before any network call — should never actually be observed against the real API through `ofox-image.sh`. |

**Everything else is unconfirmed for this endpoint as of writing.** This is
deliberate, not an oversight — the research behind this skill had two
real error examples to go on (the provider-type one above, and the
`--quality standard` rejection of 2026-09-04, whose message was captured but
whose `error.type`/`error.code` were not), and inventing a full mapping (the way
`ofox-video-core`'s error table was built from many real, paid test calls
across `/v1/videos`) from that would mean guessing types/codes that might
not exist or might mean something different here. In this repo, "confirmed"
for an error field means **observed in an actual response**, not "described
in the vendor's doc prose" — the `provider_type_unavailable` mistake above is
exactly why that distinction matters. If you hit a new `error.type` (or a
value of `error.code` that isn't just the HTTP status) against the real
endpoint, add a row here and to `print_api_error` in `ofox-image.sh` — don't
guess ahead of that evidence.

## Billing on rejection — open question

Unlike `/v1/videos` (where a rejected create call is confirmed not to
create a billable job), whether a rejected `/v1/images/generations` request
is billed has **not** been confirmed with a real call. `ofox-image.sh`'s
documentation assumes the common pattern (no image produced, no charge) but
flags this explicitly as unverified.

Two rejections have been observed since that was written — the
provider-type one of 2026-08-29 (no `usage` field in the body) and the
`--quality standard` one of 2026-09-04 (reported as costing nothing) — and
both point the same way. Neither has been reconciled against a console
billing line, which is the only thing that would close this, so the question
stays open rather than being quietly marked answered.

## No free verification path

There is no job id and no poll endpoint for this API — every real call
that reaches `api.ofox.ai` either produces billed output or (assumed but
unconfirmed) is free because it was rejected before any image was made.
Unlike `ofox-video-core`, there is no "poll an existing job for free"
option to fall back on if a network call's outcome is ambiguous. If a
`generate` call gets no HTTP response at all (`ofox-image.sh` exit `5`),
the only way to find out what happened is to check
`https://app.ofox.ai`'s usage/billing history — there is nothing to poll
by id.

## The model list (`GET /v1/models`)

Public, keyless and free. `ofox-image.sh` uses it to check `--model`, and
exposes it as `ofox-image.sh models`.

**It does not describe image-model capabilities.** Unlike video models, which
carry a `video_attributes` object with real resolution/duration/aspect-ratio
limits, image entries have no `image_attributes` equivalent, and their
`supported_parameters` list is LLM-shaped (`temperature`, `top_p`,
`max_tokens`, `stop`, `response_format`) rather than the `size`/`quality`/
`background` this endpoint actually takes. So only the model **id** is
validated dynamically here; `--size`, `--quality`, `--output-format` and
`--background` stay hardcoded from the docs. Don't assume symmetry with
`ofox-video-core` — this was checked, and it isn't there.

What each entry does give us: `id`, `aliases`, `is_deprecated`,
`supported_endpoints` (so a video model passed to `--model` is caught with
that reason), and `pricing.output_image`.

Caching and fallback behave exactly as in `ofox-video-core`: fresh cache (24h,
`${XDG_CACHE_HOME:-$HOME/.cache}/ofox/models.json`) → live fetch → stale cache
→ bundled `references/models-snapshot.json` → no check. Every fallback below
"live" prints a NOTE to stderr. An id missing from a **live** list is rejected
locally; missing from a **snapshot** it is passed to the API, since the
snapshot may predate the model. `OFOX_SKIP_MODEL_VALIDATION=1` disables the
check. Regenerate the snapshot with `bash references/refresh-snapshot.sh`.
