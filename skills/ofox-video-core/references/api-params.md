# Ofox video API — parameter reference

Source: `https://ofox.ai/docs/api/videos` (verified 2026-08-29). Re-check the
live docs before relying on exact values far in the future — params and
pricing can drift.

This is the parameter surface `references/ofox-video.sh` builds a request
from. Use this table to decide what to pass; the script validates the
common mistakes (bad resolution, bad aspect ratio, out-of-range duration for
Seedance 2.5) before it ever calls the API.

## Create request fields (`POST /v1/videos`)

| Field | Type | Required | `ofox-video.sh` flag | Notes |
|---|---|---|---|---|
| `model` | string | yes | `--model` | Default `bytedance/seedance-2.5`. Also valid: `bytedance/seedance-2.0`, `alibaba/wan-2.7`, others per the live model list. |
| `prompt` | string | yes | `--prompt` | Text description of the video. |
| `duration` | integer | no | `--duration` | Seconds. Seedance 2.5 supports 4–30, any integer. Other models may have different ranges — the script only enforces 4–30 when `model` is exactly `bytedance/seedance-2.5`. |
| `resolution` | string | no | `--resolution` | One of `480p` `720p` `1080p` `1K` `2K` `4K`. |
| `aspect_ratio` | string | no | `--aspect-ratio` | One of `16:9` `9:16` `1:1` `4:3` `3:4` `3:2` `2:3` `21:9` `9:21` `adaptive`. **`bytedance/seedance-2.5` image-to-video requires `adaptive`** — see below, the script forces this for you and prints a notice when it does. |
| `size` | string | no | `--size` | `WIDTHxHEIGHT` (e.g. `1280x720`) — alternative to `resolution`. Don't send both unless you've confirmed the model accepts it; prefer `resolution` for Seedance 2.5. |
| `generate_audio` | boolean | no | `--generate-audio true\|false` | Default `true` server-side. |
| `seed` | integer | no | `--seed` | Deterministic generation. |
| `frame_images` | array | no | `--frame-first-image URL\|PATH`, `--frame-last-image URL\|PATH` | Image-to-video via first/last frame. Accepts a remote URL (used as-is) or a local readable file path (auto base64-encoded into a `data:image/<ext>;base64,...` URI). The script builds the `{type, image_url, frame_type}` objects for you — pass either or both flags. |
| `input_references` | array | no | via `--extra-json` | ≤9 images, ≤3 audio clips (each ≤15s), ≤1 video. Not exposed as its own flag (structure is nested/varied) — pass `{"input_references": [...]}` through `--extra-json`. **Cannot be combined with `frame_images`** — the script rejects this client-side (`references_conflict`) if you try. |
| `real_person` | boolean | no | `--real-person true\|false` | Default `false`. Enables real-person reference preprocessing. |
| `callback_url` | string | no | `--callback-url` | Must be `https://` and must not point to a private network. |
| `provider` | object | no | via `--extra-json` | Upstream routing options; pass `{"provider": {...}}`. |

`--extra-json` is merged into the built request body last (object merge —
its keys win over anything the flags set), so it's the escape hatch for any
field not exposed as a dedicated flag. It must be valid JSON; the script
checks that with `jq` before submitting.

## Image-to-video example (first frame only)

```bash
bash references/ofox-video.sh generate \
  --model bytedance/seedance-2.0 \
  --prompt "Make the dog in the frame start running" \
  --duration 5 \
  --frame-first-image "https://example.com/dog.jpg"
```

A local file path also works and is preferred when available (see below):

```bash
bash references/ofox-video.sh generate \
  --prompt "Make the dog in the frame start running" \
  --duration 5 \
  --frame-first-image "/Users/me/photos/dog.jpg"
```

### `bytedance/seedance-2.5` image-to-video requires `aspect_ratio: adaptive`

Verified against the real API: with the default model
(`bytedance/seedance-2.5`), attaching `frame_images` and sending any
`aspect_ratio` value other than `adaptive` fails — every documented
aspect ratio (or omitting it) was rejected across multiple real attempts,
while `adaptive` succeeded. `ofox-video.sh` forces `aspect_ratio` to
`adaptive` automatically whenever `--frame-first-image`/`--frame-last-image`
is combined with `bytedance/seedance-2.5` (the effective model, whether
passed explicitly or left at the default), and always prints a `NOTE:` to
stderr when it does — it never overrides silently. This requirement is
specific to `bytedance/seedance-2.5`; `bytedance/seedance-2.0` does
image-to-video without it (verified separately, not assumed).

### Local file vs. remote URL reliability

Prefer a local file over a remote URL for `frame_images` when the user has
one. Real testing found a publicly reachable, valid image URL rejected by
the upstream provider with a download-failure-shaped error on more than one
attempt (likely bot/hotlink protection on that host), while the same image
base64-encoded from a local file worked reliably. The script handles the
encoding for you — just pass the local path.

## Poll response (`GET /v1/videos/{id}`)

States: `pending` → `queued` → `in_progress` → terminal (`completed` /
`failed` / `cancelled` / `expired`).

On `completed`:

| Field | Meaning |
|---|---|
| `mirror_urls` | CDN-signed, persistent — the script downloads from here when present. |
| `unsigned_urls` | Upstream original, temporary (may expire within 24h) — used by the script **only when `mirror_urls` is absent or empty**, which does happen on real completed jobs. Once downloaded, the file is local either way, so the expiry window doesn't matter after that. |
| `usage.video_seconds` | Billed duration (includes v2v input duration when applicable). |
| `usage.video_cost` | Actual cost, a string with 10 decimal places. The script prints this exactly — never estimate or invent a number here. |

## Error codes (`error.code`) and `error.message`

`error.message` free text is not a stable contract to branch logic on — the
exact wording can change — but it can carry a specific, useful detail the
generic mapped explanation doesn't (a real example: a minimum reference-image
width, seen in the message even though `error.code` was the generic
`invalid_request`). `ofox-video.sh` maps every documented `error.code` to
its own fixed, actionable message (see `print_error_message` in the
script), and **always** also prints `error.message` when present, labeled
`Upstream message: ...` — not only when `error.code` is absent/unrecognized.

| HTTP | `error.code` | Meaning |
|---|---|---|
| 400 | `invalid_request` | Missing/invalid parameter. |
| 400 | `invalid_callback_url` | `callback_url` not HTTPS or points to a private network. |
| 400 | `references_conflict` | Both `frame_images` and `input_references` were sent. |
| 400 | `too_many_references` | Over the 9 image / 3 audio / 1 video reference limits. |
| 400 | `cancel_not_supported` | Upstream can't interrupt this job. |
| 400 | `cancel_failed` | Job already in a terminal state. |
| 401 | `unauthorized` / `invalid_api_key` | Bad or missing key. |
| 401 | `upstream_auth_failed` | Upstream provider auth error (Ofox-side routing issue). |
| 402 | `insufficient_credits` | Account balance too low to create the job. No charge is made. |
| 404 | `not_found` | Job id invalid or not accessible with this key. |
| 404 | `model_not_found` | Model unavailable. |
| 429 | `rate_limited` | Poll too frequently, or upstream rate limit. |
| 502 | `upstream_error` / `route_error` | Provider-side failure. |
| 500 | `internal_error` | Platform-side failure. |
| n/a (seen on a terminal `failed` job, not a create-time HTTP error) | `output_moderation_failed` | The generated **output** failed a post-generation content check — happens *after* the job ran, not at submission, so it cannot be caught by client-side validation. Verified: the response's `usage` field is `null`/absent, so **this job is not billed**. Safe to retry with a brand-new `generate` call using a different prompt/reference — that's a new request, not a resubmission of the failed one. |

`real_person: true` image validation failures (checked when Ofox fetches
the reference image, not by this script): `bad_data_uri`, `download_failed`,
`unreachable`, `not_image`, `too_large`.

## The no-resubmit rule

Once a create call gets any HTTP response, that job exists (or was
definitively rejected). `ofox-video.sh` never issues a second create call
for the same invocation:

- **Create call times out / connection error with no HTTP response at all**
  → the script exits `5` and refuses to guess. It genuinely cannot tell
  whether the job was created server-side. Check `https://app.ofox.ai`
  before manually retrying.
- **Create call gets an HTTP error response** (4xx/5xx with a real body) →
  no job was created (the request was rejected), so fixing the parameters
  and retrying `generate` is safe.
- **Polling is slow, a poll request errors, or the script's own poll loop
  hits its time budget** → the job was already created and is running. The
  fix is `ofox-video.sh poll JOB_ID`, never a new `generate` call for the
  same request — resubmitting creates a second, separately billed job.
