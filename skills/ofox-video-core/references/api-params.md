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
| `model` | string | yes | `--model` | Default `bytedance/seedance-2.5`. Run `ofox-video.sh models` for the live list with each model's limits and base price — 8 video models at last check. |
| `prompt` | string | yes | `--prompt` | Text description of the video. |
| `duration` | integer | no | `--duration` | Seconds, any integer in the chosen model's range. The script enforces each model's real range (Seedance 2.5 4–30, Wan 2.x 2–15, HappyHorse 3–15, Seedance 2.0* 4–15), read from the live model list. |
| `resolution` | string | no | `--resolution` | Validated per model. Seedance 2.5: `480p` `720p` `1080p`. Seedance 2.0: also `4k` (lowercase, as the API reports it). Wan 2.x / HappyHorse: `720p` `1080p` only. No video model advertises `1K` or `2K` — an earlier version of this table listed them in error. |
| `aspect_ratio` | string | no | `--aspect-ratio` | Validated per model. Seedance 2.5: `21:9` `16:9` `4:3` `1:1` `3:4` `9:16` `adaptive`. Seedance 2.0*: `16:9` `9:16` `1:1` `adaptive`. Wan 2.x / HappyHorse: `16:9` `9:16` `1:1`. `3:2`, `2:3` and `9:21` are supported by **no** video model — an earlier version of this table listed them in error, and they were passing client-side validation only to be rejected by the API. **`bytedance/seedance-2.5` image-to-video requires `adaptive`** — see below, the script forces this for you and prints a notice when it does. |
| `size` | string | no | `--size` | `WIDTHxHEIGHT` (e.g. `1280x720`) — alternative to `resolution`. Don't send both unless you've confirmed the model accepts it; prefer `resolution` for Seedance 2.5. |
| `generate_audio` | boolean | no | `--generate-audio true\|false` | Default `true` server-side. |
| `seed` | integer | no | `--seed` | Deterministic generation. |
| `frame_images` | array | no | `--frame-first-image URL\|PATH`, `--frame-last-image URL\|PATH` | Image-to-video via first/last frame. Accepts a remote URL (used as-is) or a local readable file path (auto base64-encoded into a `data:image/<ext>;base64,...` URI). The script builds the `{type, image_url, frame_type}` objects for you — pass either or both flags. |
| `input_references` | array | no | via `--extra-json` | ≤9 images, ≤3 audio clips (each ≤15s), ≤1 video. Element types are `image_url`, `audio_url`, `video_url` — see below. Not exposed as its own flag (structure is nested/varied) — pass `{"input_references": [...]}` through `--extra-json`. **Cannot be combined with `frame_images`** — the script rejects this client-side (`references_conflict`) if you try. |
| `real_person` | boolean | no | `--real-person true\|false` | Default `false`. Routes an **authorized** real-person reference image through Ofox's privacy-preserving preprocessing, which is otherwise refused by the upstream. Ofox documents this for `bytedance/seedance-2.0`; **not confirmed for 2.5** — see the real-person section below. |
| `callback_url` | string | no | `--callback-url` | Must be `https://` and must not point to a private network. |
| `provider` | object | no | `--provider SLUG` | Pins the upstream that serves the job. **Defaults to `byteplus` for `bytedance/seedance-*`** — see below. `--provider auto` sends no pin. `provider.options.<slug>` passthrough is not exposed as a flag; use `--extra-json`. |

`--extra-json` is merged into the built request body last (object merge —
its keys win over anything the flags set), so it's the escape hatch for any
field not exposed as a dedicated flag. It must be valid JSON; the script
checks that with `jq` before submitting.

## Reference inputs (`input_references`) and video-to-video

Element shapes, per the create-video docs and confirmed for video by a real
accepted request:

```json
{"type": "image_url", "image_url": {"url": "https://example.com/subject.jpg"}}
{"type": "audio_url", "audio_url": {"url": "https://example.com/voice.mp3"}}
{"type": "video_url", "video_url": {"url": "https://example.com/ref.mp4"}}
```

Note the type is `video_url`, **not** `video`. Getting that wrong is not
cosmetic: the cost estimate keys off it, and an earlier version of this script
guessed `video` and therefore quoted the t2v rate for a v2v job (estimated
$0.44, billed $0.56).

**A video reference must be a URL.** No base64 data URI form is documented for
video, and none has been tested — unlike `frame_images`, where a local file is
supported and is in fact *preferred* over a URL. So anything wanting v2v needs
its input hosted somewhere publicly reachable first.

A working source, if the input is something this API produced: the
`unsigned_urls` link from a completed job. Verified 2026-08-31 — an
unauthenticated ranged GET returned `HTTP 206 video/mp4`, and the upstream
fetched it successfully. Those links are documented as temporary (may expire
within 24h), so this works for a fresh job, not an archival one.

### What v2v does — and what one real run did not settle

Ofox describes a video reference as "Guide subject / style
(reference-to-video), **not precise frame anchors**." The duration ceiling is
unchanged at 4-30s, so there is **no mechanism here for extending a video
beyond a single job's length**.

One real run (4s 480p, feeding a previous job's output, prompt asking to
continue the scene) produced an output whose opening frame closely matched the
input's closing frame. That is consistent with continuation — and equally
consistent with a style reference reproducing a near-identical static scene,
because the subject was a motionless cup. **The run does not distinguish the
two**, and nothing here should be read as proving continuation works.

For multi-shot continuity, `chain` is the better tool on every axis that was
measured: it bills at the t2v rate ($0.11/s vs $0.14/s at 480p), takes a local
file instead of requiring a hosted URL, and anchors on an actual frame rather
than a soft reference.

## Upstream providers (`provider.type`)

A model can be served by more than one upstream. Ofox's own words for what
happens when you don't say which:

> When no `provider` field is sent, ofox distributes the request by weight
> across the channels currently serving that model — and which provider serves
> any single request is not predictable.

Measured 2026-08-30 across all eight video models:

| Model | Upstreams |
|---|---|
| `bytedance/seedance-2.5` | `byteplus`, `volcengine` |
| `bytedance/seedance-2.0` | `byteplus`, `volcengine` |
| `bytedance/seedance-2.0-fast` | `byteplus`, `volcengine` |
| `bytedance/seedance-2.0-mini` | `byteplus`, `volcengine` |
| `alibaba/wan-2.6`, `alibaba/wan-2.7` | `aliyun` |
| `alibaba/happyhorse-1.0`, `-1.1` | `aliyun` |

### The two that serve Seedance

| | `volcengine` | `byteplus` |
|---|---|---|
| Platform | Volcengine Ark — ByteDance's mainland China platform | BytePlus — ByteDance's platform for markets outside mainland China |
| Moderation | Standard | More permissive |
| Price | identical | identical |

**Pricing is identical across upstreams** — verified tier by tier
(480p/720p/1080p × t2v/v2v). Choosing one is a region, reliability and
moderation decision, never a cost one. Don't let anyone believe otherwise.

Because the two moderate differently, an unpinned job that fails
`output_moderation_failed` may simply have landed on the stricter upstream —
and the user has no way to tell which one they got. That is the main reason
this skill pins by default.

### What the script does

- **Default**: `byteplus` for `bytedance/seedance-*`. This is a prefix rule,
  not a lookup — the 4/4 measurement above makes it accurate, and it keeps the
  common path free of any network call.
- **Single-upstream models get no pin.** With one upstream, weighted routing is
  already deterministic; pinning would change nothing and would only add a
  hardcoded fact that can rot if the model later gains a second upstream.
- **Override**: `--provider volcengine` (mainland, standard moderation),
  `--provider auto` (no pin, back to weighted routing), or `OFOX_VIDEO_PROVIDER`
  for a persistent default. An explicit flag beats the environment variable.
- **Validation**: an unknown slug is rejected locally. A real slug that doesn't
  serve the chosen model is rejected too, naming the ones that do — but only
  when catalog data is at hand. If the catalog can't be reached, the request
  goes through with the pin as given; a check we couldn't run is never a reason
  to block a request (fail open).
- The chosen upstream is printed on the submit line, so it's never a mystery
  which one a given job used.

### Discovering upstreams (`GET /v2/models/catalog/...`)

Public and keyless, like the model list:

```
GET https://api.ofox.ai/v2/models/catalog/{owner}/{slug}?include=provider_price
```

Returns `provider_cards[]`: each upstream, its `provider_type`, and a full
`pricing.video_pricing.tiers[]` matrix of resolution × input_type × price.
`ofox-video.sh providers [MODEL]` prints exactly this. Cached for 24h next to
the model list, per model.

## The model list (`GET /v1/models`)

Public, keyless and free — verified by calling it with `OFOX_API_KEY` unset
(HTTP 200). `ofox-video.sh` fetches it to validate parameters against the model
the caller actually picked, and exposes it as `ofox-video.sh models`.

Each entry carries what the script needs:

```json
{
  "id": "bytedance/seedance-2.5",
  "is_deprecated": false,
  "pricing": { "output_video_per_second": "0.11" },
  "supported_endpoints": ["/v1/videos"],
  "video_attributes": {
    "modes": ["t2v", "i2v", "v2v"],
    "resolutions": ["480p", "720p", "1080p"],
    "default_resolution": "720p",
    "min_duration_seconds": 4,
    "max_duration_seconds": 30,
    "supports_audio": true,
    "aspect_ratios": ["21:9","16:9","4:3","1:1","3:4","9:16","adaptive"]
  }
}
```

**`pricing.output_video_per_second` is not a quote.** It is not consistently
the cheapest tier or the default-resolution tier: `seedance-2.5` reports
`0.11`, which is its 480p rate even though its `default_resolution` is 720p
(really $0.24/s); `seedance-2.0-mini` reports `0.04`, which *is* its 720p rate.
Use it to rank models by rough cost, never to tell a user what they will pay —
that comes from the per-resolution tables in `pricing.md`.

Caching: fresh cache (24h, `${XDG_CACHE_HOME:-$HOME/.cache}/ofox/models.json`)
→ live fetch → stale cache → bundled `references/models-snapshot.json` → no
per-model check at all. Every fallback below "live" prints a NOTE to stderr.
A model id missing from a **live** list is a local error; missing from a
**snapshot** it is passed through to the API, because the snapshot may simply
predate the model. `OFOX_SKIP_MODEL_VALIDATION=1` turns the per-model checks
off. Regenerate the snapshot with `bash references/refresh-snapshot.sh`.

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
| `usage.video_seconds` | Billed duration. **Measured**: for a v2v job with a 4s input and a 4s output this was `4`, not `8` — the input video's duration is *not* added on top. (An earlier version of this table claimed it was; that claim was never measured and is wrong for this case.) The v2v *rate* still applies, which is where the extra cost comes from. |
| `usage.video_cost` | Actual cost, a string with 10 decimal places. The script prints this exactly — never estimate or invent a number here. |

## Output filenames and the metadata sidecar

A completed download is written as `<slug>-<short job id>.<ext>`, plus a
`.json` sidecar with the same stem.

The slug comes from `--name` when the caller gives one, and otherwise from
the job's own `prompt`. The prompt is in every poll response, which is what
makes a bare `poll JOB_ID` in a fresh shell produce a readable name rather
than falling back to the raw id. `--name` is the better source whenever the
caller knows what the shot actually is — a prompt opens on setting and
lighting, so a prompt-derived slug tends to describe the room rather than the
scene.

Both sources are treated as untrusted path input: whitespace collapses to a
dash, control characters and characters illegal on Windows filesystems are
removed, non-alphanumeric runs are trimmed off both ends, and the result is
capped at 40 codepoints — sliced in `jq`, which cuts by codepoint, so CJK text
is never split mid-character regardless of locale.

The short id is 8 hex characters. It exists to keep two runs of the same
prompt from overwriting each other, **not** as a way back to the job: there is
no list endpoint to expand a prefix against, so a truncated id cannot be
resolved. That is what the sidecar is for.

| Sidecar field | Source |
|---|---|
| `job_id` | Full id, the handle for `poll` and for reconciling against app.ofox.ai. |
| `status`, `model`, `prompt`, `created_at`, `updated_at` | The poll response. |
| `video_seconds`, `video_cost` | `usage.*` — the real bill, not an estimate. |
| `video_file` | Basename of the video this sidecar describes. |
| `name` | The `--name` given, when there was one. |
| `request` | The create payload as submitted. **Only on the generate path.** |

That last row is the one worth knowing. The poll response reports the model
and prompt but **not `resolution`, `aspect_ratio` or `seed`** — they are
echoed nowhere, so they reach the sidecar only through the create payload.

`generate` has that payload in hand. `create` does not hand it to the
`poll` that follows, because they are separate processes on purpose — that
separation is what stops a short tool timeout from stranding a billable job.
So `create` writes the compacted payload to `<out-dir>/.ofox-request-<job
id>.json`, and `poll` reads it, folds it into the sidecar, and deletes it
once the sidecar is safely written (not before — a failed download would
otherwise have nothing to retry from).

A missing handoff is normal, not an error: polling from a different
`--out-dir`, from another machine, or a job someone else created leaves
none, and the sidecar simply omits `request`, exactly as it did before
handoffs existed.

### Seed

Without `--seed` the script used to send none, leaving the server to pick one
and report it nowhere — so nothing generated could be reproduced. `generate`
and `create` now roll a seed when the caller doesn't supply one (the same way
`batch` always has), send it, and print it as a `SEED <n>` line. It is
random either way; choosing it client-side is what makes it recordable.

Between the seed and the handoff, a sidecar written by `generate`, or by
`create` + `poll` into the same `--out-dir`, holds everything needed to
re-render the same shot at a different resolution.

`frame_images` is replaced by a `frame_images_count` — a resolved
`--frame-first-image` is a base64 data URI that can exceed a megabyte, and
that does not belong in a metadata file.

A sidecar that would be unparseable is discarded with a warning instead of
being left next to the video: a file that looks like a record but isn't is
worse than no file. The video is never failed over a sidecar problem.

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
| 400 | `invalid_provider_type` | The provider slug is not one Ofox recognises. |
| 400 | `provider_type_unavailable` | A real slug, but it does not serve this model. `ofox-video.sh providers MODEL` lists the ones that do. |
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
| 400 | `input_moderation_failed` | The **input** image/video was rejected before generation — most often a real person's face. Distinct from `output_moderation_failed` below: this happens at submission, so nothing was generated and nothing was billed. |
| n/a (seen on a terminal `failed` job, not a create-time HTTP error) | `output_moderation_failed` | The generated **output** failed a post-generation content check — happens *after* the job ran, not at submission, so it cannot be caught by client-side validation. Verified: the response's `usage` field is `null`/absent, so **this job is not billed**. Safe to retry with a brand-new `generate` call using a different prompt/reference — that's a new request, not a resubmission of the failed one. |

`real_person: true` image validation failures (checked when Ofox fetches
the reference image, not by this script): `bad_data_uri`, `download_failed`,
`unreachable`, `not_image`, `too_large`.

### Real-person reference images are refused by seedance-2.5 image-to-video

**Verified against the real API 2026-08-30.** Feeding a frame containing a
photoreal human into `bytedance/seedance-2.5` image-to-video returns:

```
HTTP 400  error.code: input_moderation_failed
Upstream message: The request failed because the input image 'content[1]'
may contain real person.
```

Nothing is generated and nothing is billed. This is a **submission-time**
rejection, unlike `output_moderation_failed` which happens after a job has
already run.

What this means in practice:

- Any workflow that carries a photoreal human between shots (chaining a
  short-drama sequence, reusing a live-action character reference) hits this
  wall on Seedance 2.5.
- Non-photoreal references are unaffected — illustration, anime, product
  shots, landscapes. This is why `seedance-anime-drama`, which reuses an
  anime character sheet as a first frame, works fine.
- `real_person: true` exists precisely for authorized real-person references
  and routes them through Ofox's privacy-preserving preprocessing. Ofox
  documents that path for `bytedance/seedance-2.0`. **Whether it lifts this
  restriction on 2.5 has not been tested here** — do not assume it does
  without a real call.

The script maps `input_moderation_failed` to this explanation and names both
options rather than leaving a bare error code.

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
