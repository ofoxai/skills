# Ofox Video Generation API Reference

Source: `https://ofox.ai/docs/api/videos` (Overview / create / retrieve / cancel / webhooks / errors) and `https://ofox.ai/models/bytedance/seedance-2.5`. Verified 2026-08-29 — re-check against the live docs if this is consulted much later, pricing and params can drift.

## Authentication

All video endpoints use: `Authorization: Bearer $OFOX_API_KEY`

Get-key page: `https://app.ofox.ai` (log in → Settings → API Keys → Create New Key; the key is shown only once at creation).

## Create a video job

```
POST https://api.ofox.ai/v1/videos
Authorization: Bearer $OFOX_API_KEY
Content-Type: application/json
```

Success: `202 Accepted`, body `{"id": "...", "status": "pending", "polling_url": "https://api.ofox.ai/v1/videos/{id}"}`

Request body fields:

| Field | Type | Required | Notes |
|---|---|---|---|
| `model` | string | yes | e.g. `bytedance/seedance-2.5`, `bytedance/seedance-2.0`, `alibaba/wan-2.7` |
| `prompt` | string | yes | text description |
| `duration` | integer | no | seconds; Seedance 2.5 supports 4–30, any integer |
| `resolution` | string | no | `480p` / `720p` / `1080p` / `1K` / `2K` / `4K` |
| `aspect_ratio` | string | no | `16:9` `9:16` `1:1` `4:3` `3:4` `3:2` `2:3` `21:9` `9:21` |
| `size` | string | no | `WIDTHxHEIGHT`, e.g. `1280x720` — alternative to `resolution` |
| `generate_audio` | boolean | no | default `true` |
| `seed` | integer | no | deterministic generation |
| `frame_images` | array | no | image-to-video via first/last frame; elements typed `first_frame` / `last_frame` |
| `input_references` | array | no | ≤9 images, ≤3 audio clips each ≤15s, ≤1 video |
| `real_person` | boolean | no | real-person reference preprocessing, default `false` |
| `callback_url` | string | no | webhook, must be HTTPS, must not point to a private network |
| `provider` | object | no | upstream routing options |

Example (text-to-video):

```bash
curl -X POST https://api.ofox.ai/v1/videos \
  -H "Authorization: Bearer $OFOX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bytedance/seedance-2.5",
    "prompt": "A golden retriever running on the beach at sunset",
    "duration": 5,
    "resolution": "1080p",
    "aspect_ratio": "16:9",
    "generate_audio": true
  }'
```

Example (image-to-video via first frame):

```bash
curl -X POST https://api.ofox.ai/v1/videos \
  -H "Authorization: Bearer $OFOX_API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "model": "bytedance/seedance-2.0",
    "prompt": "Make the dog in the frame start running",
    "duration": 5,
    "frame_images": [
      { "type": "image_url", "image_url": { "url": "https://example.com/dog.jpg" }, "frame_type": "first_frame" }
    ]
  }'
```

## Poll job status

```
GET https://api.ofox.ai/v1/videos/{id}
Authorization: Bearer $OFOX_API_KEY
```

States: `pending` → `queued` → `in_progress` → terminal (`completed` / `failed` / `cancelled` / `expired`).

On `completed`, response includes:

- `unsigned_urls` — upstream original video URL, temporary, may expire within 24h
- `mirror_urls` — CDN-signed, persistent URL — **prefer this for download when present**
- `usage.video_seconds` — billed duration (includes v2v input duration when applicable)
- `usage.video_cost` — actual cost, a string with 10 decimal places

**Real-world finding (2026-08-29):** `mirror_urls` is not reliably present on
every completed job. Verified against a real, non-simulated production
response for a completed `bytedance/seedance-2.5` text-to-video job
(`GET /v1/videos/{id}`, terminal `completed` status): the response contained
`unsigned_urls` but no `mirror_urls` field at all. Client code must not
assume `mirror_urls` exists on a completed job — check it first (it's still
the better choice, being persistent/CDN-signed, when it is present), but
treat `unsigned_urls` as a legitimate primary download source in its own
right, not merely a theoretical emergency fallback. A job should only be
treated as undownloadable if *neither* field yields a usable URL.

## Cancel a job

`invalid_request`-style rules apply: cancellation may fail if the upstream provider doesn't support interrupting that task (`cancel_not_supported`) or the task is already in a terminal state (`cancel_failed`).

## Error codes

Program against `error.code`, never parse `error.message` (message text isn't a stable contract).

| HTTP | code | meaning |
|---|---|---|
| 400 | `invalid_request` | missing/invalid parameter |
| 400 | `invalid_callback_url` | callback_url not HTTPS or points to a private network |
| 400 | `references_conflict` | `frame_images` and `input_references` both sent |
| 400 | `too_many_references` | over the 9 image / 3 audio / 1 video reference limits |
| 400 | `cancel_not_supported` | upstream can't interrupt this job |
| 400 | `cancel_failed` | job already in a terminal state |
| 401 | `unauthorized` / `invalid_api_key` | bad or missing key |
| 401 | `upstream_auth_failed` | upstream provider auth error |
| 402 | `insufficient_credits` | account balance too low to create the job |
| 404 | `not_found` | job id invalid or not accessible |
| 404 | `model_not_found` | model unavailable |
| 429 | `rate_limited` | poll too frequently, or upstream rate limit |
| 502 | `upstream_error` / `route_error` | provider-side failure |
| 500 | `internal_error` | platform-side failure |

`real_person: true` image validation failures: `bad_data_uri`, `download_failed`, `unreachable`, `not_image`, `too_large`.

Recommended handling: on 402/429, back off and retry or surface clearly to the user rather than silently looping; treat any non-terminal poll response the same way regardless of how long it's been pending — **never re-POST `/v1/videos` for the same logical request just because polling is slow or a request timed out client-side**. Resubmitting double-charges the user. If a poll call itself fails (network error, 5xx), retry the *poll*, not the *create*.

## Seedance 2.5 pricing (per second)

Source: `https://ofox.ai/models/bytedance/seedance-2.5`.

| Resolution | Text-to-video | Video-to-video |
|---|---|---|
| 480p | $0.11/s | $0.14/s |
| 720p | $0.24/s | $0.30/s |
| 1080p | $0.48/s (list $0.60/s, time-limited) | $0.568/s (list $0.71/s) |

Duration range: 4–30s, any integer. Aspect ratios: 21:9 / 16:9 / 4:3 / 1:1 / 3:4 / 9:16 / adaptive. Audio: on by default (`generate_audio`).

Cost estimate for the skill to show *before* generating: `duration_seconds * price_per_second_for(resolution, mode)`. Actual cost to report *after* generation: `usage.video_cost` from the poll response (may differ slightly from the estimate).
