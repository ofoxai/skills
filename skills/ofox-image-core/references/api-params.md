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
| `model` | string | yes | `--model` | `openai/gpt-image-2`, `google/gemini-3.1-flash-image` (this is "Nano Banana 2" — use this exact model id string, **not** `-preview`; the model catalog page's URL slug differs from the actual API model id), `bailian/qwen-image-3.0-pro`. |
| `prompt` | string | yes | `--prompt` | Text description of the image. |
| `quality` | string | yes per doc | `--quality` | One of `auto`/`low`/`medium`/`high`/`standard`/`hd`. Not every value is confirmed to apply to every model — the script requires you to pass one explicitly rather than guessing a safe default. |
| `n` | integer | no | `--n` | 1-10, server default 1. **`google/gemini-3.1-flash-image` does not support `n` at all — passing it (even `n: 1`) errors.** The script rejects `--n` client-side whenever the effective model is Gemini, and also rejects an `n` key set via `--extra-json` for that model. |
| `size` | string | no | `--size` | One of `auto`/`1024x1024`/`1536x1024`/`1024x1536`/`256x256`/`512x512`/`1792x1024`/`1024x1792`. |
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
| `model` / `size` / `quality` | The values Ofox actually used to generate the image — may not always exactly echo what was requested (e.g. `auto` resolving to a concrete value). The script prints these from the response, not from the request, for exactly this reason. |
| `usage.input_tokens` / `usage.output_tokens` / `usage.total_tokens` | Real token counts for this specific generation. The script prints these directly (`USAGE_INPUT_TOKENS`/`USAGE_OUTPUT_TOKENS`/`USAGE_TOTAL_TOKENS`) — never estimate or invent these numbers. See `references/pricing.md` for why a dollar cost is not computed from these yet. |

There is no documented `output_format`/file-format field in the response
body itself — if you need to know the actual format Ofox produced and you
didn't request one via `output_format`, the safest source of truth is
inspecting the decoded file's own magic bytes (e.g. `file <path>`), not
guessing from any response field.

### Confirmed gotcha: the response's `size` field is not reliable evidence of the real output dimensions

A real, paid call (2026-08-29, `google/gemini-3.1-flash-image`, `size:
512x512` requested) returned `"size": "512x512"` in the response body — but
the actual decoded PNG's real pixel dimensions, verified with `file` and
`sips -g pixelWidth -g pixelHeight` (macOS; `identify` from ImageMagick
works too), are **1024x1024**. The model appears to always generate at its
native 1024x1024 resolution and simply echoes back whatever `size` was
requested, regardless of what it actually produced.

This is confirmed only for `google/gemini-3.1-flash-image`. It is
**unconfirmed** whether `openai/gpt-image-2` or `bailian/qwen-image-3.0-pro`
have the same behavior — don't assume either way until tested.

`ofox-image.sh`'s printed `SIZE` line is taken directly from the response
body (see the table above), so it inherits this unreliability. **If a
caller genuinely needs a specific output size guarantee** (e.g. a pipeline
step downstream expects an exact resolution), verify the saved file's real
dimensions directly rather than trusting `SIZE`/the response's `size`
field. This is the same "don't trust a documented/response field's claim
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
| n/a (message-only, no distinct type/code documented) | — | — | `google/gemini-3.1-flash-image` + `/v1/images/edits` → "Image editing is not supported for model". | Doc prose only, **not** confirmed by a real call. Not reachable through this script (edits endpoint out of scope). |
| n/a (message-only, no distinct type/code documented) | — | — | `google/gemini-3.1-flash-image` + `n` param → errors. | Doc prose only, **not** confirmed by a real call. Prevented client-side by this script before any network call — should never actually be observed against the real API through `ofox-image.sh`. |

**Everything else is unconfirmed for this endpoint as of writing.** This is
deliberate, not an oversight — the research behind this skill only had one
real error example to go on, and inventing a full mapping (the way
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
flags this explicitly as unverified. Confirm this the first time a real
error case is observed end-to-end, and update this file and `SKILL.md`
accordingly.

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
