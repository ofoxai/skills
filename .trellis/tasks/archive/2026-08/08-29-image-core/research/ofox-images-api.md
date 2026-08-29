# Ofox Images API Reference

Source: `https://ofox.ai/docs/api/openai/images`, `https://ofox.ai/models/google/gemini-3.1-flash-image`. Verified 2026-08-29 — re-check before relying on exact numbers much later.

## Generate: POST /v1/images/generations

Synchronous — no job id, no polling, unlike the video API. The image comes back in the response body directly.

```bash
curl -X POST 'https://api.ofox.ai/v1/images/generations' \
  -H 'Authorization: Bearer $OFOX_API_KEY' \
  -H 'Content-Type: application/json' \
  -d '{
    "model": "openai/gpt-image-2",
    "prompt": "A simple red apple on a white table",
    "size": "1024x1024",
    "quality": "low",
    "output_format": "png"
  }'
```

Params:

| Field | Type | Required | Notes |
|---|---|---|---|
| `model` | string | yes | `openai/gpt-image-2`, `google/gemini-3.1-flash-image` (this is "Nano Banana 2" — this exact string, NOT `-preview`; the model catalog page's URL slug differs from the actual API model id, don't copy the URL), `bailian/qwen-image-3.0-pro` |
| `prompt` | string | yes | |
| `quality` | string | yes per doc | `auto`/`low`/`medium`/`high`/`standard`/`hd` — not all values apply to every model, verify empirically before hardcoding a default |
| `n` | integer | no | 1-10, default 1. **Gemini does not support `n` at all — passing it errors.** |
| `size` | string | no | `auto`/`1024x1024`/`1536x1024`/`1024x1536`/`256x256`/`512x512`/`1792x1024`/`1024x1792` |
| `input_images` | string[] | no | URL or base64, 1-3 items, **Qwen only** for image-to-image. Any other field name (`image_urls`, `image`, `images`) is **silently ignored** — the request silently degrades to text-to-image with no error. Get this field name exactly right. |
| `output_format` | string | no | `png`/`jpeg`/`webp` |
| `background` | string | no | `transparent`/`opaque`/`auto` |
| `stream` | boolean | no | default false |
| `extra_body.provider.type` | string | no | `openai`/`azure_foundry`, gpt-image-2 only |

Response (fixed shape, always base64, no URL option ever):

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

### Errors — doc prose vs. a real observed response

Ofox's docs describe (in prose, not as a literal example response) a
scenario where a requested provider doesn't support the model, which this
research doc previously wrote up as "`400 provider_type_unavailable`" as if
it were a confirmed `error.code` value. **That was wrong** — it was an
inference from prose, never an actual response body, and a real call has
since shown the actual shape is different. Corrected 2026-08-29:

A real call with an invalid `extra_body.provider.type` (`bogus_provider_xyz`,
gpt-image-2) — i.e. exactly the "provider doesn't support this" scenario the
docs describe in prose — returned:

```json
{
  "error": {
    "message": "unknown provider type: bogus_provider_xyz [ofox.ai]",
    "type": "invalid_request_error",
    "code": 400
  }
}
```

So the real error shape is `{error: {message, type, code}}` — an
OpenAI-SDK-style convention, distinct from the video API's `{code, message}`
shape where `code` was a real semantic string (`insufficient_credits`, etc).
Here, `error.code` is literally the HTTP status **as a number** (`400`), not
a semantic string — `provider_type_unavailable` does not appear anywhere in
the real response. The actual classifier is `error.type`
(`invalid_request_error`, the only value confirmed so far). No `usage` field
was present on this rejected response (consistent with, but not 100%-certain
proof of, unrejected requests going unbilled).

Still doc-prose-only, **not** confirmed by a real call: Gemini +
`/v1/images/edits` → "Image editing is not supported for model"; Gemini + `n`
param → error. Treat these as informational until a real response is
observed for them too.

## Edit: POST /v1/images/edits

**Different shape — multipart form, not JSON.** Only `openai/gpt-image-2` / `openai/gpt-image-1.5`; not supported by Gemini or Qwen via this endpoint (Qwen does image-to-image via `input_images` on the *generate* endpoint instead, not via `/edits`).

```bash
curl -X POST 'https://api.ofox.ai/v1/images/edits' \
  -H 'Authorization: Bearer $OFOX_API_KEY' \
  -F 'model="openai/gpt-image-2"' \
  -F 'prompt="edit instruction"' \
  -F 'image=@/path/to/file.png' \
  -F 'size="auto"' \
  -F 'quality="low"'
```

Out of scope for the first `ofox-image-core` pass (see PRD) — text-to-image via `/generations` covers the anime-drama "character reference sheet from a description" use case; `/edits` and Qwen's `input_images` image-to-image path are follow-ups if a scenario actually needs them.

## Pricing (Nano Banana 2 / `google/gemini-3.1-flash-image`)

Per the model page: input tokens $0.5/M, output tokens $3/M, output image $60/M (units unclear from the page alone — likely a per-token rate for the image-token portion of `output_tokens`, not a flat per-image price). **Don't hardcode a guessed per-image dollar figure** — the real response includes `usage.input_tokens`/`usage.output_tokens`/`usage.total_tokens`; compute/report actual cost from a real response's token counts rather than a documentation-derived guess, and verify with at least one real call before shipping a cost-estimate formula in `pricing.md` (same discipline as the video pricing work — don't trust the docs' phrasing alone, confirm against a real response).

## Scope for `ofox-image-core` v1

Text-to-image only (`/v1/images/generations`), no `input_images`/image-to-image, no `/v1/images/edits`. This is enough for anime-drama's first step (generate a character reference image from a text description before generating video) — image-to-image / edits are a follow-up if a scenario later needs "regenerate this exact character in a new pose" style editing rather than a fresh reference sheet.
